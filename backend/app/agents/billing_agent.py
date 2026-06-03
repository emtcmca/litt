"""
Billing sub-agent — scans PENDING time entries, runs prebill scrubber,
logs anomaly escalations for entries with BLOCK flags.

Calls tool functions directly (in-process). MCP toolset wiring added in v1.1
when the coordinator runs as a separate service.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from app import config
from app.db import collection_ref
from app.observability import (
    AgentObservation,
    CommitmentLevel,
    ObservationType,
    generate_observation_id,
)
from app.scrubber.prebill import run_prebill_checks
from app.tools.alerts import log_anomaly


class BillingAgent:
    """
    Deterministic billing sweep. No Gemini calls.
    Detects pre-bill anomalies and writes escalation records via the tool layer.
    """

    name = "billing_agent"

    def run(self, firm_id: str, run_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Sweep all PENDING time entries for the firm.
        Returns a summary dict including an 'observations' list for the coordinator.
        """
        observations: List[AgentObservation] = []
        obs_counter = 0

        def _obs(**kwargs) -> AgentObservation:
            nonlocal obs_counter
            obs_counter += 1
            work_kind = kwargs.pop("work_kind", "deterministic")
            return AgentObservation(
                observation_id=generate_observation_id(self.name, obs_counter),
                timestamp=config.get_effective_datetime(),
                agent_name=self.name,
                run_id=run_id,
                work_kind=work_kind,
                **kwargs,
            )

        clients = {
            doc.id: doc.to_dict()
            for doc in collection_ref(firm_id, "clients").stream()
        }

        # Pre-fetch all time entries to get a count for the scan observation.
        all_entries = [
            doc.to_dict()
            for doc in collection_ref(firm_id, "time_entries").stream()
        ]
        pending_entries = [e for e in all_entries if e.get("status") == "PENDING"]

        observations.append(_obs(
            observation_type=ObservationType.SIGNAL_RECEIVED,
            commitment_level=CommitmentLevel.AUTO_SAFE,
            description=f"Pre-bill scan: {len(pending_entries)} PENDING time entries for {firm_id}",
            data={"pending_count": len(pending_entries), "total_entries": len(all_entries)},
        ))

        observations.append(_obs(
            observation_type=ObservationType.TOOL_CALL,
            commitment_level=CommitmentLevel.AUTO_SAFE,
            description=f"Running pre-bill scrubber on {len(pending_entries)} entries",
        ))

        new_anomalies: List[str] = []
        existing_anomalies: List[str] = []
        entries_scanned = 0
        block_obs_emitted = False  # emit one focused block observation per sweep

        for entry in pending_entries:
            entries_scanned += 1
            client = clients.get(entry.get("client_id", ""), {})
            result = run_prebill_checks(entry, client)

            if not result.has_block:
                continue

            for flag in result.flags:
                if flag.severity != "BLOCK":
                    continue

                entry_id = entry["id"]
                idempotency_key = f"sweep-billing-{entry_id}-{flag.check_name}"

                description = (
                    f"{flag.check_name.upper().replace('_', ' ')} on entry {entry_id}: "
                    f"{flag.message}"
                )

                # Emit focused observations for first BLOCK hit — keeps timeline readable.
                if not block_obs_emitted:
                    block_obs_emitted = True

                    observations.append(_obs(
                        observation_type=ObservationType.RESULT,
                        commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                        description=f"BLOCK flag: {flag.check_name.upper()} on {entry_id} — {flag.message}",
                        data={
                            "entry_id": entry_id,
                            "check_name": flag.check_name,
                            "matched_text": flag.matched_text,
                            "severity": flag.severity,
                        },
                        evidence=[entry_id],
                    ))

                    observations.append(_obs(
                        observation_type=ObservationType.APPROVAL_GATE_APPLIED,
                        commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                        description=f"Pre-bill gate: {entry_id} cannot be auto-approved — attorney review required",
                        data={"entry_id": entry_id, "gate": "REVIEW_REQUIRED"},
                        attorney_next_action=(
                            f"Review time entry {entry_id}: {flag.check_name.upper()} "
                            f"flag before approving or correcting the narrative."
                        ),
                        evidence=[entry_id],
                    ))

                outcome = log_anomaly(
                    firm_id=firm_id,
                    entry_id=entry_id,
                    anomaly_type=flag.check_name.upper(),
                    description=description,
                    routed_to="dana-strand",
                    actor="system",
                    idempotency_key=idempotency_key,
                    matter_id=entry.get("matter_id"),
                )

                if hasattr(outcome, "entity_id"):
                    # New creation: entity_id ≠ audit_event_id. Idempotency hit: they match.
                    if outcome.entity_id != outcome.audit_event_id:
                        new_anomalies.append(outcome.entity_id)
                    else:
                        existing_anomalies.append(outcome.entity_id)

        final_level = CommitmentLevel.REVIEW_REQUIRED if new_anomalies else CommitmentLevel.AUTO_SAFE
        existing_note = f" · {len(existing_anomalies)} existing already under review" if existing_anomalies else ""
        observations.append(_obs(
            observation_type=ObservationType.RESULT,
            commitment_level=final_level,
            description=(
                f"Billing scan complete: {entries_scanned} entries scanned, "
                f"{len(new_anomalies)} new anomal{'ies' if len(new_anomalies) != 1 else 'y'} logged"
                + existing_note
            ),
            data={
                "entries_scanned": entries_scanned,
                "new_anomalies": len(new_anomalies),
                "existing_anomalies": len(existing_anomalies),
            },
        ))

        return {
            "agent": self.name,
            "entries_scanned": entries_scanned,
            "anomalies_logged": len(new_anomalies) + len(existing_anomalies),
            "new_anomalies": len(new_anomalies),
            "existing_anomalies": len(existing_anomalies),
            "escalation_ids": new_anomalies,
            "observations": observations,
        }
