"""
AnomalyAgent — pattern-based operational anomaly detection.

Handles BILLING_ANOMALY and OPERATIONAL_ANOMALY signals.
Distinct from BillingAgent (pre-bill BLOCK scrubber) — focuses on patterns:
  - Round hours without session timer data
  - Possible duplicate entries (same attorney/matter/date/hours)
  - AI disclosure gaps on PENDING/APPROVED entries
  - Stale verified deadlines with no activity

Scoring overrides elevate priority/risk based on contextual factors.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app import config
from app.db import collection_ref
from app.models import DeadlineEventType, EscalationType
from app.observability import (
    AgentObservation,
    CommitmentLevel,
    ObservationType,
    generate_observation_id,
)
from app.tools.alerts import log_anomaly


# ---------------------------------------------------------------------------
# Anomaly signal — internal representation before tool layer call
# ---------------------------------------------------------------------------

@dataclass
class AnomalySignal:
    entity_id: str
    anomaly_type: str
    description: str
    matter_id: Optional[str] = None
    priority: int = 2
    risk_level: str = "ELEVATED"
    context: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Scoring override rules — applied after detection, before logging
# Each rule: (condition_fn, priority_delta, new_risk_level or None)
# ---------------------------------------------------------------------------

_OVERRIDE_RULES: List[tuple] = [
    # Deadline classification context → critical priority
    (
        lambda sig: sig.context.get("has_hard_legal_deadline", False),
        +1,
        "CRITICAL",
    ),
    # AI disclosure gaps on disclosure-required clients → elevated urgency
    (
        lambda sig: sig.anomaly_type == "AI_DISCLOSURE_GAP"
        and sig.context.get("client_ai_disclosure_required", False),
        +1,
        "CRITICAL",
    ),
    # Duplicate on a billed matter → elevated
    (
        lambda sig: sig.anomaly_type == "DUPLICATE_ENTRY_CANDIDATE"
        and sig.context.get("has_billed_entries", False),
        +1,
        None,  # keep current risk level
    ),
]


def apply_scoring_overrides(signal: AnomalySignal) -> None:
    """Mutate signal.priority and signal.risk_level based on override rules."""
    for condition, priority_delta, risk_override in _OVERRIDE_RULES:
        try:
            if condition(signal):
                signal.priority = min(5, signal.priority + priority_delta)
                if risk_override is not None:
                    signal.risk_level = risk_override
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Detectors — pure functions over pre-fetched data lists
# ---------------------------------------------------------------------------

def _detect_round_hours_no_session(
    entries: List[dict],
) -> List[AnomalySignal]:
    """
    PENDING/APPROVED entries where hours is a whole number but
    session_minutes_actual is absent. Different from billing_agent's scrubber
    WARN — this fires on APPROVED entries too and produces an anomaly escalation.
    """
    signals = []
    for entry in entries:
        if entry.get("status") not in ("PENDING", "APPROVED"):
            continue
        hours = float(entry.get("hours", 0))
        session_minutes = entry.get("session_minutes_actual")
        if hours == int(hours) and hours > 0 and session_minutes is None:
            signals.append(AnomalySignal(
                entity_id=entry["id"],
                anomaly_type="ROUND_HOURS_NO_SESSION",
                description=(
                    f"Entry {entry['id']} has round hours ({hours:.0f}h) "
                    f"with no session timer data. Verify accuracy before invoicing."
                ),
                matter_id=entry.get("matter_id"),
                priority=2,
                risk_level="ELEVATED",
                context={"hours": hours},
            ))
    return signals


def _detect_duplicate_entries(
    entries: List[dict],
) -> List[AnomalySignal]:
    """
    Detects entries with identical attorney_id + matter_id + entry_date + hours.
    Reports the second (later-created) entry as a potential duplicate.
    """
    seen: Dict[tuple, str] = {}
    signals = []
    for entry in sorted(entries, key=lambda e: str(e.get("created_at", ""))):
        if entry.get("status") in ("WRITTEN_OFF", "CLOSED"):
            continue
        key = (
            entry.get("attorney_id", ""),
            entry.get("matter_id", ""),
            str(entry.get("entry_date", ""))[:10],
            str(entry.get("hours", "")),
        )
        if key in seen:
            has_billed = any(
                e.get("matter_id") == entry.get("matter_id") and e.get("status") == "BILLED"
                for e in entries
            )
            signals.append(AnomalySignal(
                entity_id=entry["id"],
                anomaly_type="DUPLICATE_ENTRY_CANDIDATE",
                description=(
                    f"Entry {entry['id']} appears to duplicate {seen[key]}: "
                    f"same attorney, matter, date, and hours ({entry.get('hours')}h). "
                    f"Confirm this is not a double-entry."
                ),
                matter_id=entry.get("matter_id"),
                priority=3,
                risk_level="ELEVATED",
                context={"original_entry_id": seen[key], "has_billed_entries": has_billed},
            ))
        else:
            seen[key] = entry["id"]
    return signals


def _detect_ai_disclosure_gap(
    entries: List[dict],
    clients: Dict[str, dict],
) -> List[AnomalySignal]:
    """
    PENDING/APPROVED AI-assisted entries where the client requires disclosure
    but disclosure status is not set.
    """
    signals = []
    for entry in entries:
        if entry.get("status") not in ("PENDING", "APPROVED"):
            continue
        if not entry.get("ai_assisted", False):
            continue

        client = clients.get(entry.get("client_id", ""), {})
        guidelines = client.get("billing_guidelines", {}) or {}
        client_requires = guidelines.get("ai_disclosure_required", False)

        if not client_requires:
            continue

        disclosure_status = entry.get("client_ai_disclosure_status")
        if not disclosure_status:
            signals.append(AnomalySignal(
                entity_id=entry["id"],
                anomaly_type="AI_DISCLOSURE_GAP",
                description=(
                    f"Entry {entry['id']} is AI-assisted and client requires disclosure, "
                    f"but client_ai_disclosure_status is not set. "
                    f"Set to 'included', 'not_required', or 'withheld' before invoicing."
                ),
                matter_id=entry.get("matter_id"),
                priority=3,
                risk_level="ELEVATED",
                context={
                    "client_ai_disclosure_required": True,
                    "ai_tool": entry.get("ai_tool"),
                },
            ))
    return signals


def _detect_stale_verified_deadlines(
    deadlines: List[dict],
    deadline_events: List[dict],
    today,
) -> List[AnomalySignal]:
    """
    ACTIVE, attorney_verified deadlines within 14 days that have had no
    ESCALATION_SENT or ATTORNEY_CONFIRMED event in the past 7 days.
    Surfaces deadlines that may be slipping through without attorney attention.
    """
    from datetime import date as date_type, timedelta
    seven_days_ago = today - timedelta(days=7)

    events_by_deadline: Dict[str, list] = {}
    for evt in deadline_events:
        dl_id = evt.get("deadline_id", "")
        events_by_deadline.setdefault(dl_id, []).append(evt)

    signals = []
    for dl in deadlines:
        if dl.get("status") != "ACTIVE":
            continue
        if dl.get("verification_status") != "attorney_verified":
            continue

        try:
            due_date = date_type.fromisoformat(str(dl.get("due_date", ""))[:10])
        except (ValueError, TypeError):
            continue

        days_out = (due_date - today).days
        if days_out < 0 or days_out > 14:
            continue

        dl_id = dl["id"]
        recent_events = [
            e for e in events_by_deadline.get(dl_id, [])
            if e.get("event_type") in (
                DeadlineEventType.ESCALATION_SENT.value,
                DeadlineEventType.ATTORNEY_CONFIRMED.value,
            )
        ]

        has_recent = False
        for evt in recent_events:
            evt_created = evt.get("created_at")
            if evt_created is None:
                continue
            if isinstance(evt_created, str):
                try:
                    from datetime import datetime, timezone
                    evt_dt = datetime.fromisoformat(evt_created.replace("Z", "+00:00"))
                    evt_date = evt_dt.date()
                except ValueError:
                    continue
            elif hasattr(evt_created, "date"):
                evt_date = evt_created.date()
            else:
                continue
            if evt_date >= seven_days_ago:
                has_recent = True
                break

        if not has_recent:
            signals.append(AnomalySignal(
                entity_id=dl_id,
                anomaly_type="STALE_VERIFIED_DEADLINE",
                description=(
                    f"Deadline {dl_id} ({dl.get('description', '')}) is {days_out} day(s) out "
                    f"and has had no escalation or confirmation event in the past 7 days."
                ),
                matter_id=dl.get("matter_id"),
                priority=2,
                risk_level="ELEVATED",
                context={
                    "days_out": days_out,
                    "has_hard_legal_deadline": dl.get("classification") == "HARD_LEGAL",
                },
            ))
    return signals


# ---------------------------------------------------------------------------
# AnomalyAgent
# ---------------------------------------------------------------------------

class AnomalyAgent:
    """
    Pattern-based operational anomaly detection.
    No Gemini calls — entirely deterministic Python.
    """

    name = "anomaly_agent"

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

        clients = {doc.id: doc.to_dict() for doc in collection_ref(firm_id, "clients").stream()}
        entries = [doc.to_dict() for doc in collection_ref(firm_id, "time_entries").stream()]
        deadlines = [doc.to_dict() for doc in collection_ref(firm_id, "deadlines").stream()]
        deadline_events = [doc.to_dict() for doc in collection_ref(firm_id, "deadline_events").stream()]
        today = config.get_effective_date()

        observations.append(_obs(
            observation_type=ObservationType.SIGNAL_RECEIVED,
            commitment_level=CommitmentLevel.AUTO_SAFE,
            description=(
                f"Pattern scan: {len(entries)} time entries, "
                f"{len(deadlines)} deadlines for {firm_id}"
            ),
            data={"entry_count": len(entries), "deadline_count": len(deadlines)},
        ))

        # Collect all signals from all detectors
        signals: List[AnomalySignal] = []
        signals.extend(_detect_round_hours_no_session(entries))
        signals.extend(_detect_duplicate_entries(entries))
        signals.extend(_detect_ai_disclosure_gap(entries, clients))
        signals.extend(_detect_stale_verified_deadlines(deadlines, deadline_events, today))

        # Apply scoring overrides
        for signal in signals:
            apply_scoring_overrides(signal)

        # Emit one focused observation for the first detected signal.
        if signals:
            first = signals[0]
            observations.append(_obs(
                observation_type=ObservationType.REASONING,
                commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                description=f"Pattern detected: {first.anomaly_type} — {first.description[:120]}",
                data={
                    "anomaly_type": first.anomaly_type,
                    "entity_id": first.entity_id,
                    "risk_level": first.risk_level,
                    "priority": first.priority,
                    "total_signals": len(signals),
                },
                evidence=[first.entity_id],
            ))

        # Log via tool layer (idempotent per entity+type)
        logged: List[str] = []
        for signal in signals:
            idem = f"sweep-anomaly-{signal.entity_id}-{signal.anomaly_type}"
            result = log_anomaly(
                firm_id=firm_id,
                entry_id=signal.entity_id,
                anomaly_type=signal.anomaly_type,
                description=signal.description,
                routed_to="dana-strand",
                actor="system",
                idempotency_key=idem,
                matter_id=signal.matter_id,
            )
            if hasattr(result, "entity_id"):
                logged.append(result.entity_id)

        final_level = CommitmentLevel.REVIEW_REQUIRED if logged else CommitmentLevel.AUTO_SAFE
        observations.append(_obs(
            observation_type=ObservationType.RESULT,
            commitment_level=final_level,
            description=(
                f"Pattern scan complete: {len(signals)} signal(s) detected, "
                f"{len(logged)} anomal{'ies' if len(logged) != 1 else 'y'} logged"
            ),
            data={"signals_detected": len(signals), "anomalies_logged": len(logged)},
        ))

        return {
            "agent": self.name,
            "signals_detected": len(signals),
            "anomalies_logged": len(logged),
            "escalation_ids": logged,
            "observations": observations,
        }
