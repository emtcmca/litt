"""
BillingAgent — pre-bill scrubber + budget monitoring.

v1.0: scans PENDING entries, logs BLOCK anomalies.
v1.1.1:
  - Scans PENDING and APPROVED entries.
  - WARN-severity flags surface as WARN_NOTICE observations (no hard gate).
  - Budget threshold detection at 70% and 90% per client.
  - Returns budget_signals dict keyed by client_id for CommsAgent Round 2.
  - Gemini narrative suggestion on NARRATIVE_INSUFFICIENT entries (no auto-apply).
"""

from __future__ import annotations

import json
from decimal import Decimal
from typing import Any, Dict, List, Optional

from app import config
from app.db import collection_ref
from app.models import AlertStatus, ToolError
from app.observability import (
    AgentObservation,
    CommitmentLevel,
    ObservationType,
    generate_observation_id,
)
from app.scrubber.prebill import run_prebill_checks
from app.tools.alerts import log_anomaly
from app.tools.billing import compute_budget_utilization


def _call_gemini_narrative_suggestion(entry: dict) -> Optional[str]:
    """
    Gemini narrative improvement suggestion for NARRATIVE_INSUFFICIENT entries.
    Returns suggested narrative string or None. Never raises to caller.
    Auto-apply never happens — this populates suggested_narrative only.
    """
    narrative = entry.get("narrative") or ""
    system_prompt = (
        "You are a legal billing compliance reviewer. The attorney's billing narrative "
        "has been flagged as insufficient. Write an improved billing narrative based on "
        "the entry details. Maximum 200 characters. Return only the improved narrative — "
        "no preamble, no explanation. Do not invent facts not in the input."
    )
    user_prompt = (
        f"Matter: {entry.get('matter_id', 'unknown')}\n"
        f"Hours: {entry.get('hours', 0)}\n"
        f"Entry date: {entry.get('entry_date', 'unknown')}\n"
        f"Current narrative: {narrative or '(none)'}"
    )
    try:
        import vertexai
        from vertexai.generative_models import GenerativeModel

        vertexai.init(
            project=config.GOOGLE_CLOUD_PROJECT,
            location=config.VERTEX_AI_LOCATION,
        )
        model = GenerativeModel(
            model_name=config.GEMINI_MODEL,
            system_instruction=system_prompt,
        )
        response = model.generate_content(user_prompt)
        return response.text.strip() if response.text else None
    except Exception:
        return None


class BillingAgent:
    """
    Pre-bill scrubber + budget monitoring.
    v1.1.1: APPROVED entries included; budget signals returned; WARN surfaced.
    """

    name = "billing_agent"

    def run(self, firm_id: str, run_id: Optional[str] = None) -> Dict[str, Any]:
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

        all_entries = [
            doc.to_dict()
            for doc in collection_ref(firm_id, "time_entries").stream()
        ]
        # V11-P2-01: scan PENDING and APPROVED
        scannable = [e for e in all_entries if e.get("status") in ("PENDING", "APPROVED")]
        pending_count = sum(1 for e in scannable if e.get("status") == "PENDING")
        approved_count = sum(1 for e in scannable if e.get("status") == "APPROVED")

        observations.append(_obs(
            observation_type=ObservationType.SIGNAL_RECEIVED,
            commitment_level=CommitmentLevel.AUTO_SAFE,
            description=(
                f"Pre-bill scan: {len(scannable)} entries for {firm_id} "
                f"({pending_count} PENDING, {approved_count} APPROVED)"
            ),
            data={
                "pending_count": pending_count,
                "approved_count": approved_count,
                "total_entries": len(all_entries),
            },
        ))

        observations.append(_obs(
            observation_type=ObservationType.TOOL_CALL,
            commitment_level=CommitmentLevel.AUTO_SAFE,
            description=f"Running pre-bill scrubber on {len(scannable)} entries",
            data={
                "tool": {
                    "name": "run_prebill_scrubber",
                    "kind": "compute",
                    "signature": "(firm_id, entries: list[TimeEntry]) -> ScrubberResult",
                    "result": {"entry_count": len(scannable)},
                }
            },
        ))

        new_anomalies: List[str] = []
        existing_anomalies: List[str] = []
        warn_count = 0
        entries_scanned = 0
        block_obs_emitted = False
        matters_touched: set = set()

        for entry in scannable:
            entries_scanned += 1
            client = clients.get(entry.get("client_id", ""), {})
            result = run_prebill_checks(entry, client)

            if not result.flags:
                continue

            mid = entry.get("matter_id")
            if mid:
                matters_touched.add(mid)

            for flag in result.flags:
                entry_id = entry["id"]
                idempotency_key = f"sweep-billing-{entry_id}-{flag.check_name}"

                description = (
                    f"{flag.check_name.upper().replace('_', ' ')} on entry {entry_id}: "
                    f"{flag.message}"
                )

                if flag.severity == "BLOCK":
                    # First BLOCK hit: emit focused observations
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

                    # Narrative_insufficient: request Gemini suggestion
                    suggested_narrative = None
                    if flag.check_name == "narrative_absent":
                        suggested_narrative = _call_gemini_narrative_suggestion(entry)
                        if suggested_narrative:
                            observations.append(_obs(
                                observation_type=ObservationType.TOOL_CALL,
                                commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                                description=f"Gemini suggested narrative for entry {entry_id}",
                                work_kind="llm_assisted",
                                model_name=config.GEMINI_MODEL,
                                confidence=None,
                                data={
                                    "tool": {
                                        "name": "suggest_narrative",
                                        "kind": "gemini",
                                        "signature": "(entry_id, activity_code, hours, flags) -> str | None",
                                        "result": {"suggested_length": len(suggested_narrative)},
                                    }
                                },
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
                        severity="BLOCK",
                        suggested_narrative=suggested_narrative,
                    )

                    if hasattr(outcome, "entity_id"):
                        if outcome.entity_id != outcome.audit_event_id:
                            new_anomalies.append(outcome.entity_id)
                        else:
                            existing_anomalies.append(outcome.entity_id)

                elif flag.severity == "WARN":
                    # V11-P2-02: WARN flags → WARN_NOTICE observations, no hard gate
                    warn_count += 1
                    observations.append(_obs(
                        observation_type=ObservationType.WARN_NOTICE,
                        commitment_level=CommitmentLevel.AUTO_SAFE,
                        description=f"WARN: {flag.check_name.upper()} on {entry_id} — {flag.message}",
                        data={
                            "entry_id": entry_id,
                            "check_name": flag.check_name,
                            "severity": "WARN",
                        },
                        evidence=[entry_id],
                    ))

        # V11-P2-03 + V11-P2-04: Budget threshold detection per client
        budget_signals: Dict[str, Dict[str, Any]] = {}
        client_ids_with_entries = {e.get("client_id") for e in all_entries if e.get("client_id")}

        for client_id in client_ids_with_entries:
            butil = compute_budget_utilization(firm_id, client_id)
            if isinstance(butil, ToolError):
                continue  # no budget_cap or client not found

            pct = butil.utilization_pct
            budget_signals[client_id] = {
                "client_id": client_id,
                "utilization_pct": pct,
                "amount_billed": float(butil.billed_to_date),
                "approved_unbilled": float(butil.approved_unbilled),
                "budget_cap": float(butil.budget_cap),
                "alert_status": butil.alert_status,
            }

            if pct >= 0.90:
                observations.append(_obs(
                    observation_type=ObservationType.WARN_NOTICE,
                    commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                    description=(
                        f"CRITICAL budget threshold: {client_id} at "
                        f"{pct*100:.0f}% of budget "
                        f"(${float(butil.total_committed):,.0f} / ${float(butil.budget_cap):,.0f})"
                    ),
                    data=budget_signals[client_id],
                    evidence=[client_id],
                ))
            elif pct >= 0.70:
                observations.append(_obs(
                    observation_type=ObservationType.WARN_NOTICE,
                    commitment_level=CommitmentLevel.AUTO_SAFE,
                    description=(
                        f"Budget threshold: {client_id} at {pct*100:.0f}% of budget — "
                        f"approaching limit (${float(butil.budget_cap):,.0f})"
                    ),
                    data=budget_signals[client_id],
                    evidence=[client_id],
                ))

        final_level = CommitmentLevel.REVIEW_REQUIRED if new_anomalies else CommitmentLevel.AUTO_SAFE
        existing_note = f" · {len(existing_anomalies)} existing already under review" if existing_anomalies else ""
        warn_note = f" · {warn_count} WARN flag(s)" if warn_count else ""
        budget_note = (
            f" · {sum(1 for s in budget_signals.values() if s['utilization_pct'] >= 0.70)} budget alert(s)"
            if any(s["utilization_pct"] >= 0.70 for s in budget_signals.values())
            else ""
        )

        observations.append(_obs(
            observation_type=ObservationType.RESULT,
            commitment_level=final_level,
            description=(
                f"Billing scan complete: {entries_scanned} entries scanned, "
                f"{len(new_anomalies)} new anomal{'ies' if len(new_anomalies) != 1 else 'y'} logged"
                + existing_note + warn_note + budget_note
            ),
            data={
                "entries_scanned": entries_scanned,
                "new_anomalies": len(new_anomalies),
                "existing_anomalies": len(existing_anomalies),
                "warn_flags": warn_count,
                "budget_alerts": sum(1 for s in budget_signals.values() if s["utilization_pct"] >= 0.70),
            },
        ))

        return {
            "agent": self.name,
            "entries_scanned": entries_scanned,
            "anomalies_logged": len(new_anomalies) + len(existing_anomalies),
            "new_anomalies": len(new_anomalies),
            "existing_anomalies": len(existing_anomalies),
            "warn_flags": warn_count,
            "escalation_ids": new_anomalies,
            "budget_signals": budget_signals,
            "matters_touched": list(matters_touched),
            "observations": observations,
        }
