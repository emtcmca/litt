"""
Deadline sub-agent — scans ACTIVE attorney-verified deadlines, determines
escalation cadence level, logs ESCALATION_SENT deadline events and
Escalation records for deadlines that haven't been escalated at the current level.

Calls tool functions directly (in-process). MCP toolset wiring added in v1.1.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from app import config
from app.db import collection_ref
from app.models import DeadlineEventType, EscalationType
from app.tools.alerts import log_escalation
from app.tools.deadlines import log_deadline_event

# Escalation cadence: (max_days_out, level_label, priority)
_CADENCE = [
    (0,  "CRITICAL",  5),
    (1,  "1_DAY",     5),
    (3,  "3_DAY",     4),
    (7,  "7_DAY",     4),
    (14, "14_DAY",    3),
]


def _get_escalation_level(days_out: int) -> Optional[tuple]:
    """Returns (label, priority) for days_out, or None if outside all cadence windows."""
    for max_days, label, priority in _CADENCE:
        if days_out <= max_days:
            return label, priority
    return None


def _already_escalated_at_level(firm_id: str, deadline_id: str, level: str) -> bool:
    """
    Check deadline_events for an existing ESCALATION_SENT record at this level.
    Prevents duplicate escalations per sweep run.
    """
    events = collection_ref(firm_id, "deadline_events").stream()
    for doc in events:
        evt = doc.to_dict()
        if (
            evt.get("deadline_id") == deadline_id
            and evt.get("event_type") == DeadlineEventType.ESCALATION_SENT.value
            and evt.get("escalation_level") == level
        ):
            return True
    return False


class DeadlineAgent:
    """
    Deterministic deadline escalation sweep. No Gemini calls.
    Escalation brief text is structured but not LLM-generated in v1.0.
    Gemini narrative synthesis happens in the coordinator's final brief assembly (Day 4).
    """

    name = "deadline_agent"

    def run(self, firm_id: str) -> Dict[str, Any]:
        """
        Sweep all ACTIVE attorney-verified deadlines.
        Returns a summary dict for the coordinator.
        """
        today = config.get_effective_date()
        matters = {
            doc.id: doc.to_dict()
            for doc in collection_ref(firm_id, "matters").stream()
        }
        clients = {
            doc.id: doc.to_dict()
            for doc in collection_ref(firm_id, "clients").stream()
        }

        escalations_created: List[str] = []
        deadlines_scanned = 0

        for doc in collection_ref(firm_id, "deadlines").stream():
            dl = doc.to_dict()

            if dl.get("status") != "ACTIVE":
                continue
            if dl.get("verification_status") != "attorney_verified":
                continue

            due_raw = dl.get("due_date")
            try:
                due_date = date.fromisoformat(str(due_raw)[:10])
            except (ValueError, TypeError):
                continue

            days_out = (due_date - today).days
            deadlines_scanned += 1

            cadence = _get_escalation_level(days_out)
            if cadence is None:
                continue

            level, priority = cadence
            deadline_id = dl["id"]

            if _already_escalated_at_level(firm_id, deadline_id, level):
                continue

            matter = matters.get(dl.get("matter_id", ""), {})
            client = clients.get(matter.get("client_id", ""), {})
            matter_name = matter.get("name", dl.get("matter_id", ""))
            client_name = client.get("name", matter.get("client_id", ""))
            classification = dl.get("classification", "HARD_LEGAL")

            # Log the deadline event (append-only)
            idem_evt = f"sweep-dl-evt-{deadline_id}-{level}"
            log_deadline_event(
                firm_id=firm_id,
                deadline_id=deadline_id,
                event_type=DeadlineEventType.ESCALATION_SENT.value,
                actor="system",
                idempotency_key=idem_evt,
                escalation_level=level,
                notes=f"Auto-escalated at {level} cadence by sweep",
            )

            # Log the escalation record for the brief
            idem_esc = f"sweep-dl-esc-{deadline_id}-{level}"
            urgency_str = f"{days_out} day{'s' if days_out != 1 else ''}" if days_out > 0 else "TODAY"
            outcome = log_escalation(
                firm_id=firm_id,
                escalation_type=EscalationType.DEADLINE.value,
                entity_id=deadline_id,
                routed_to="dana-strand",
                actor="system",
                idempotency_key=idem_esc,
                what_is_happening=(
                    f"{classification.replace('_', ' ')} deadline due in {urgency_str}: "
                    f"{dl.get('description', deadline_id)}"
                ),
                why_it_matters=(
                    f"Deadline for {matter_name} ({client_name}) is at the {level} escalation "
                    f"threshold and has not been confirmed. Missing this deadline may expose "
                    f"the firm to malpractice liability."
                ),
                what_litt_has_done=(
                    f"Logged {level} escalation event on deadline record. "
                    f"No action has been taken that could change the deadline."
                ),
                what_attorney_must_decide=(
                    "Confirm the deadline is on track, request an extension, or dismiss "
                    "with a reason if the deadline has been resolved by other means."
                ),
                risk_level="CRITICAL" if classification == "HARD_LEGAL" and days_out <= 7 else "ELEVATED",
                matter_id=dl.get("matter_id"),
                priority=priority,
            )

            if hasattr(outcome, "entity_id"):
                escalations_created.append(outcome.entity_id)

        return {
            "agent": self.name,
            "deadlines_scanned": deadlines_scanned,
            "escalations_created": len(escalations_created),
            "escalation_ids": escalations_created,
        }
