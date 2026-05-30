"""
Billing sub-agent — scans PENDING time entries, runs prebill scrubber,
logs anomaly escalations for entries with BLOCK flags.

Calls tool functions directly (in-process). MCP toolset wiring added in v1.1
when the coordinator runs as a separate service.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List

from app import config
from app.db import collection_ref
from app.scrubber.prebill import run_prebill_checks
from app.tools.alerts import log_anomaly


class BillingAgent:
    """
    Deterministic billing sweep. No Gemini calls.
    Detects pre-bill anomalies and writes escalation records via the tool layer.
    """

    name = "billing_agent"

    def run(self, firm_id: str) -> Dict[str, Any]:
        """
        Sweep all PENDING time entries for the firm.
        Returns a summary dict for the coordinator.
        """
        clients = {
            doc.id: doc.to_dict()
            for doc in collection_ref(firm_id, "clients").stream()
        }

        anomalies_logged: List[str] = []
        entries_scanned = 0

        for doc in collection_ref(firm_id, "time_entries").stream():
            entry = doc.to_dict()
            if entry.get("status") != "PENDING":
                continue

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
                    anomalies_logged.append(outcome.entity_id)

        return {
            "agent": self.name,
            "entries_scanned": entries_scanned,
            "anomalies_logged": len(anomalies_logged),
            "escalation_ids": anomalies_logged,
        }
