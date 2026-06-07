"""
AnomalyAgent — pattern-based operational anomaly detection.

Handles BILLING_ANOMALY and OPERATIONAL_ANOMALY signals.
v1.0: 4 deterministic detectors
v1.1.1: +5 new detectors, priority sorting, 5 Gemini integration functions,
         enriched log_anomaly calls with severity/gemini_assessment/confidence.

Detection/Assessment/Decision boundary:
  Detection  → Python (deterministic)
  Assessment → Gemini (enrichment only; never gates)
  Decision   → Attorney (always)
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date as date_type, timedelta
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

from app import config
from app.db import collection_ref
from app.models import AnomalyType, DeadlineEventType, EscalationType
from app.observability import (
    AgentObservation,
    CommitmentLevel,
    ObservationType,
    generate_observation_id,
)
from app.tools.alerts import log_anomaly

# Default invoice cycle in days — APPROVED entries older than this trigger INVOICE_STALENESS
_DEFAULT_INVOICE_CYCLE_DAYS = 30


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
    severity: str = "BLOCK"
    context: Dict[str, Any] = field(default_factory=dict)
    gemini_assessment: Optional[str] = None
    suggested_narrative: Optional[str] = None
    confidence: Optional[float] = None


# ---------------------------------------------------------------------------
# Scoring override rules
# ---------------------------------------------------------------------------

_OVERRIDE_RULES: List[tuple] = [
    (
        lambda sig: sig.context.get("has_hard_legal_deadline", False),
        +1,
        "CRITICAL",
    ),
    (
        lambda sig: sig.anomaly_type == AnomalyType.AI_DISCLOSURE_GAP
        and sig.context.get("client_ai_disclosure_required", False),
        +1,
        "CRITICAL",
    ),
    (
        lambda sig: sig.anomaly_type == AnomalyType.DUPLICATE_ENTRY_CANDIDATE
        and sig.context.get("has_billed_entries", False),
        +1,
        None,
    ),
    # Hard-coded overrides per spec: severity-5 always ≥ 4.5 (mapped to priority 5)
    (
        lambda sig: sig.priority >= 5,
        0,
        "CRITICAL",
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
# Gemini integration functions
# All return None on any exception — never raise to caller.
# Priority gate: enrichment only called for priority≥3 or specific types.
# ---------------------------------------------------------------------------

def _call_gemini(system_prompt: str, user_prompt: str) -> Optional[str]:
    """Shared Gemini caller. Returns stripped text or None."""
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


def _call_gemini_anomaly_enrichment(signal: AnomalySignal) -> Optional[str]:
    """
    Priority-gated enrichment: only called when priority≥3, HARD_LEGAL context,
    >70% budget context, or specific high-risk types.
    Returns a structured assessment string or None.
    """
    gate_conditions = (
        signal.priority >= 3
        or signal.context.get("has_hard_legal_deadline", False)
        or signal.context.get("budget_pct", 0) > 0.70
        or signal.anomaly_type in (
            AnomalyType.AI_DISCLOSURE_GAP,
            AnomalyType.DUPLICATE_ENTRY_CANDIDATE,
            AnomalyType.SEMANTIC_DUPLICATE_CANDIDATE,
        )
    )
    if not gate_conditions:
        return None

    system_prompt = (
        "You are a legal billing compliance reviewer. Analyze the provided anomaly signal "
        "and return a concise 1-2 sentence assessment of the risk and recommended action. "
        "Return only the assessment — no preamble, no explanation."
    )
    user_prompt = (
        f"Anomaly type: {signal.anomaly_type}\n"
        f"Description: {signal.description}\n"
        f"Priority: {signal.priority}/5\n"
        f"Context: {json.dumps(signal.context, default=str)}"
    )
    return _call_gemini(system_prompt, user_prompt)


def _call_gemini_narrative_quality(entry: dict) -> Tuple[Optional[str], Optional[str], Optional[float]]:
    """
    Assess billing narrative quality.
    Returns (assessment, suggested_narrative, confidence) or (None, None, None) on failure.
    Emits NARRATIVE_INSUFFICIENT signal if confidence ≥ 0.65.
    """
    narrative = entry.get("narrative") or ""
    if not narrative or len(narrative) < 5:
        return None, None, None

    system_prompt = (
        "You are a legal billing compliance reviewer. Analyze the billing narrative for quality. "
        "Return JSON with keys: assessment (string), suggested_narrative (string), "
        "confidence (0.0-1.0 that the narrative is insufficient). "
        "Return only valid JSON."
    )
    user_prompt = (
        f"Matter: {entry.get('matter_id', 'unknown')}\n"
        f"Hours: {entry.get('hours', 0)}\n"
        f"Narrative: {narrative}"
    )
    raw = _call_gemini(system_prompt, user_prompt)
    if not raw:
        return None, None, None
    try:
        # Strip markdown fences if present
        cleaned = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        data = json.loads(cleaned)
        return (
            data.get("assessment"),
            data.get("suggested_narrative"),
            float(data.get("confidence", 0.0)),
        )
    except Exception:
        return None, None, None


def _call_gemini_hours_plausibility(entry: dict) -> Tuple[Optional[str], Optional[float]]:
    """
    Assess plausibility of hour total.
    Returns (assessment, confidence) — confidence ≥ 0.65 = BLOCK, < 0.65 = WARN.
    Never gates on Gemini alone — always emit WARN at minimum.
    """
    hours = float(entry.get("hours", 0))
    if hours <= 6.0:
        return None, None

    system_prompt = (
        "You are a legal billing compliance reviewer. Assess whether the billed hours seem "
        "plausible given the narrative description. Return JSON: {assessment: string, "
        "confidence: 0.0-1.0 that hours are implausible}. Return only valid JSON."
    )
    user_prompt = (
        f"Hours: {hours}\n"
        f"Narrative: {entry.get('narrative', 'none')}\n"
        f"Matter: {entry.get('matter_id', 'unknown')}"
    )
    raw = _call_gemini(system_prompt, user_prompt)
    if not raw:
        return None, None
    try:
        cleaned = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        data = json.loads(cleaned)
        return data.get("assessment"), float(data.get("confidence", 0.0))
    except Exception:
        return None, None


def _call_gemini_semantic_duplicate(entries: List[dict]) -> Optional[List[dict]]:
    """
    Called when Python pre-filter flags ≥4 narratively-similar entries on a matter.
    Returns list of {pair: [id1, id2], rationale: str} or None.
    """
    if len(entries) < 4:
        return None

    summaries = [
        f"- {e['id']}: {e.get('narrative', 'no narrative')[:100]}"
        for e in entries[:10]
    ]
    system_prompt = (
        "You are a legal billing compliance reviewer. Identify any entries that appear to be "
        "semantic duplicates — same activity described in different words. "
        "Return JSON array: [{pair: [id1, id2], rationale: string}]. "
        "Return empty array if no duplicates found. Return only valid JSON."
    )
    user_prompt = "Billing entries to review:\n" + "\n".join(summaries)
    raw = _call_gemini(system_prompt, user_prompt)
    if not raw:
        return None
    try:
        cleaned = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        return json.loads(cleaned)
    except Exception:
        return None


def _call_gemini_matter_synthesis(signals: List[AnomalySignal], matter_id: str) -> Optional[str]:
    """
    Called when ≥2 signals share matter_id.
    Returns MATTER_SYNTHESIS observation text — logged as observation, never gates.
    """
    if len(signals) < 2:
        return None

    summaries = [f"- {s.anomaly_type}: {s.description[:100]}" for s in signals[:6]]
    system_prompt = (
        "You are a legal billing risk analyst. Synthesize the provided anomaly signals for a matter "
        "into a single 2-3 sentence risk summary for the attorney. Focus on compounding risks. "
        "Return only the summary — no bullets, no preamble."
    )
    user_prompt = f"Matter: {matter_id}\nSignals:\n" + "\n".join(summaries)
    return _call_gemini(system_prompt, user_prompt)


# ---------------------------------------------------------------------------
# Detectors — pure functions over pre-fetched data
# ---------------------------------------------------------------------------

def _detect_round_hours_no_session(entries: List[dict]) -> List[AnomalySignal]:
    """PENDING/APPROVED entries with whole-number hours but no session timer."""
    signals = []
    for entry in entries:
        if entry.get("status") not in ("PENDING", "APPROVED"):
            continue
        hours = float(entry.get("hours", 0))
        session_minutes = entry.get("session_minutes_actual")
        if hours == int(hours) and hours > 0 and session_minutes is None:
            signals.append(AnomalySignal(
                entity_id=entry["id"],
                anomaly_type=AnomalyType.ROUND_HOURS_NO_SESSION,
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


def _detect_duplicate_entries(entries: List[dict]) -> List[AnomalySignal]:
    """Entries with identical attorney/matter/date/hours — structural duplicates."""
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
                anomaly_type=AnomalyType.DUPLICATE_ENTRY_CANDIDATE,
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


def _detect_ai_disclosure_gap(entries: List[dict], clients: Dict[str, dict]) -> List[AnomalySignal]:
    """AI-assisted entries missing disclosure status where client requires it."""
    signals = []
    for entry in entries:
        if entry.get("status") not in ("PENDING", "APPROVED"):
            continue
        if not entry.get("ai_assisted", False):
            continue
        client = clients.get(entry.get("client_id", ""), {})
        guidelines = client.get("billing_guidelines", {}) or {}
        if not guidelines.get("ai_disclosure_required", False):
            continue
        if not entry.get("client_ai_disclosure_status"):
            signals.append(AnomalySignal(
                entity_id=entry["id"],
                anomaly_type=AnomalyType.AI_DISCLOSURE_GAP,
                description=(
                    f"Entry {entry['id']} is AI-assisted and client requires disclosure, "
                    f"but client_ai_disclosure_status is not set."
                ),
                matter_id=entry.get("matter_id"),
                priority=3,
                risk_level="ELEVATED",
                context={"client_ai_disclosure_required": True, "ai_tool": entry.get("ai_tool")},
            ))
    return signals


def _detect_stale_verified_deadlines(
    deadlines: List[dict], deadline_events: List[dict], today: date_type,
) -> List[AnomalySignal]:
    """ACTIVE, attorney_verified deadlines ≤14 days out with no recent event."""
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
        has_recent = False
        for evt in events_by_deadline.get(dl_id, []):
            if evt.get("event_type") not in (
                DeadlineEventType.ESCALATION_SENT.value,
                DeadlineEventType.ATTORNEY_CONFIRMED.value,
            ):
                continue
            evt_created = evt.get("created_at")
            if evt_created is None:
                continue
            if isinstance(evt_created, str):
                try:
                    from datetime import datetime
                    evt_date = datetime.fromisoformat(evt_created.replace("Z", "+00:00")).date()
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
                anomaly_type=AnomalyType.STALE_VERIFIED_DEADLINE,
                description=(
                    f"Deadline {dl_id} ({dl.get('description', '')}) is {days_out} day(s) out "
                    f"with no escalation or confirmation event in the past 7 days."
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
# v1.1.1 new detectors
# ---------------------------------------------------------------------------

def _detect_late_entry_creation(entries: List[dict]) -> List[AnomalySignal]:
    """
    LATE_ENTRY_CREATION — fire when created_at is more than 3 days after entry_date.
    Late entries may indicate reconstructed billing from memory, not contemporaneous records.
    Priority 2.
    """
    from datetime import datetime, timezone

    signals = []
    for entry in entries:
        if entry.get("status") in ("WRITTEN_OFF", "CLOSED", "BILLED"):
            continue

        entry_date_raw = entry.get("entry_date")
        created_raw = entry.get("created_at")
        if not entry_date_raw or not created_raw:
            continue

        try:
            if isinstance(entry_date_raw, str):
                entry_date = date_type.fromisoformat(entry_date_raw[:10])
            else:
                entry_date = entry_date_raw if isinstance(entry_date_raw, date_type) else entry_date_raw.date()

            if isinstance(created_raw, str):
                created_at = datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
            elif hasattr(created_raw, "date"):
                created_at = created_raw if hasattr(created_raw, "tzinfo") else created_raw
            else:
                continue

            # Compare as dates only
            if hasattr(created_at, "date"):
                created_date = created_at.date()
            else:
                continue

            delta = (created_date - entry_date).days
            if delta > 3:
                signals.append(AnomalySignal(
                    entity_id=entry["id"],
                    anomaly_type=AnomalyType.LATE_ENTRY_CREATION,
                    description=(
                        f"Entry {entry['id']} for {entry_date} was created {delta} days later. "
                        f"Late entries may be reconstructed from memory rather than contemporaneous records."
                    ),
                    matter_id=entry.get("matter_id"),
                    priority=2,
                    risk_level="ELEVATED",
                    context={"entry_date": str(entry_date), "days_late": delta},
                ))
        except Exception:
            continue

    return signals


def _detect_entry_clustering(entries: List[dict]) -> List[AnomalySignal]:
    """
    ENTRY_CLUSTERING — fire when same attorney/matter/date has >8h total billed OR >5 entries.
    Priority 3.
    """
    from collections import defaultdict

    bucket: Dict[tuple, list] = defaultdict(list)
    for entry in entries:
        if entry.get("status") in ("WRITTEN_OFF", "CLOSED"):
            continue
        key = (
            entry.get("attorney_id", ""),
            entry.get("matter_id", ""),
            str(entry.get("entry_date", ""))[:10],
        )
        bucket[key].append(entry)

    signals = []
    for (attorney, matter, date_str), group in bucket.items():
        if len(group) < 2:
            continue
        total_hours = sum(float(e.get("hours", 0)) for e in group)
        entry_count = len(group)
        if total_hours > 8.0 or entry_count > 5:
            representative_id = group[0]["id"]
            signals.append(AnomalySignal(
                entity_id=representative_id,
                anomaly_type=AnomalyType.ENTRY_CLUSTERING,
                description=(
                    f"Attorney {attorney} has {entry_count} entries on {date_str} for matter {matter} "
                    f"totaling {total_hours:.1f}h. High-volume single-day billing warrants review."
                ),
                matter_id=matter,
                priority=3,
                risk_level="ELEVATED",
                context={
                    "attorney_id": attorney,
                    "date": date_str,
                    "entry_count": entry_count,
                    "total_hours": total_hours,
                    "entry_ids": [e["id"] for e in group],
                },
            ))
    return signals


def _semantic_similar(a: str, b: str, threshold: float = 0.75) -> bool:
    """
    Python pre-filter: SequenceMatcher ratio > threshold OR shared tokens > 60% of shorter narrative.
    No Gemini. Used to identify candidates for _call_gemini_semantic_duplicate().
    """
    if not a or not b:
        return False
    # SequenceMatcher ratio
    ratio = SequenceMatcher(None, a.lower(), b.lower()).ratio()
    if ratio >= threshold:
        return True
    # Shared token check
    tokens_a = set(a.lower().split())
    tokens_b = set(b.lower().split())
    shorter = min(len(tokens_a), len(tokens_b))
    if shorter == 0:
        return False
    shared = len(tokens_a & tokens_b)
    return (shared / shorter) >= 0.60


def _detect_semantic_duplicate_candidates(entries: List[dict]) -> List[AnomalySignal]:
    """
    SEMANTIC_DUPLICATE_CANDIDATE Python pre-filter.
    Groups similar narratives by matter; flags individual entries when ≥2 similar pairs found.
    When ≥4 entries in a matter pass pre-filter, escalates to Gemini (done in run()).
    Priority 2.
    """
    from collections import defaultdict

    matter_entries: Dict[str, list] = defaultdict(list)
    for entry in entries:
        if entry.get("status") in ("WRITTEN_OFF", "CLOSED", "BILLED"):
            continue
        if entry.get("narrative"):
            matter_entries[entry.get("matter_id", "")].append(entry)

    signals = []
    for matter_id, group in matter_entries.items():
        if len(group) < 2:
            continue
        flagged_ids: set = set()
        for i, e1 in enumerate(group):
            for e2 in group[i + 1:]:
                if _semantic_similar(e1.get("narrative", ""), e2.get("narrative", "")):
                    flagged_ids.add(e1["id"])
                    flagged_ids.add(e2["id"])

        for entry_id in flagged_ids:
            entry = next(e for e in group if e["id"] == entry_id)
            signals.append(AnomalySignal(
                entity_id=entry_id,
                anomaly_type=AnomalyType.SEMANTIC_DUPLICATE_CANDIDATE,
                description=(
                    f"Entry {entry_id} narrative on matter {matter_id} is semantically similar "
                    f"to one or more other entries. Review for potential duplicate billing."
                ),
                matter_id=matter_id,
                priority=2,
                risk_level="ELEVATED",
                context={
                    "matter_id": matter_id,
                    "similar_entries_in_matter": len(group),
                },
            ))
    return signals


def _detect_rate_anomaly(entries: List[dict], attorneys: Dict[str, dict]) -> List[AnomalySignal]:
    """
    RATE_ANOMALY — fire when hourly rate deviates >15% from attorney default rate.
    Priority 2.
    """
    signals = []
    for entry in entries:
        if entry.get("status") in ("WRITTEN_OFF", "CLOSED"):
            continue
        attorney = attorneys.get(entry.get("attorney_id", ""), {})
        default_rate = float(attorney.get("default_rate", 0))
        if default_rate <= 0:
            continue
        entry_rate = float(entry.get("rate", 0))
        if entry_rate <= 0:
            continue
        deviation = abs(entry_rate - default_rate) / default_rate
        if deviation > 0.15:
            signals.append(AnomalySignal(
                entity_id=entry["id"],
                anomaly_type=AnomalyType.RATE_ANOMALY,
                description=(
                    f"Entry {entry['id']} billed at ${entry_rate:.0f}/hr, "
                    f"deviating {deviation*100:.0f}% from attorney default (${default_rate:.0f}/hr)."
                ),
                matter_id=entry.get("matter_id"),
                priority=2,
                risk_level="ELEVATED",
                context={
                    "entry_rate": entry_rate,
                    "default_rate": default_rate,
                    "deviation_pct": round(deviation * 100, 1),
                },
            ))
    return signals


def _detect_invoice_staleness(entries: List[dict], today: date_type) -> List[AnomalySignal]:
    """
    INVOICE_STALENESS — APPROVED entries older than _DEFAULT_INVOICE_CYCLE_DAYS.
    Priority 2.
    """
    signals = []
    cutoff = today - timedelta(days=_DEFAULT_INVOICE_CYCLE_DAYS)
    for entry in entries:
        if entry.get("status") != "APPROVED":
            continue
        entry_date_raw = entry.get("entry_date")
        if not entry_date_raw:
            continue
        try:
            if isinstance(entry_date_raw, str):
                entry_date = date_type.fromisoformat(entry_date_raw[:10])
            else:
                entry_date = entry_date_raw if isinstance(entry_date_raw, date_type) else entry_date_raw.date()
            if entry_date <= cutoff:
                days_stale = (today - entry_date).days
                signals.append(AnomalySignal(
                    entity_id=entry["id"],
                    anomaly_type=AnomalyType.INVOICE_STALENESS,
                    description=(
                        f"Entry {entry['id']} has been APPROVED for {days_stale} days "
                        f"without being invoiced. Invoice generation may be overdue."
                    ),
                    matter_id=entry.get("matter_id"),
                    priority=2,
                    risk_level="ELEVATED",
                    context={"entry_date": str(entry_date), "days_stale": days_stale},
                ))
        except Exception:
            continue
    return signals


# ---------------------------------------------------------------------------
# AnomalyAgent
# ---------------------------------------------------------------------------

class AnomalyAgent:
    """
    Pattern-based operational anomaly detection.
    v1.1.1: 9 detectors (4 original + 5 new), priority sorting, 5 Gemini integrations.
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

        # Load data
        clients = {doc.id: doc.to_dict() for doc in collection_ref(firm_id, "clients").stream()}
        attorneys = {doc.id: doc.to_dict() for doc in collection_ref(firm_id, "attorneys").stream()}
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

        # --- Collect signals from all 9 detectors ---
        signals: List[AnomalySignal] = []
        signals.extend(_detect_round_hours_no_session(entries))
        signals.extend(_detect_duplicate_entries(entries))
        signals.extend(_detect_ai_disclosure_gap(entries, clients))
        signals.extend(_detect_stale_verified_deadlines(deadlines, deadline_events, today))
        signals.extend(_detect_late_entry_creation(entries))
        signals.extend(_detect_entry_clustering(entries))
        signals.extend(_detect_semantic_duplicate_candidates(entries))
        signals.extend(_detect_rate_anomaly(entries, attorneys))
        signals.extend(_detect_invoice_staleness(entries, today))

        observations.append(_obs(
            observation_type=ObservationType.TOOL_CALL,
            commitment_level=CommitmentLevel.AUTO_SAFE,
            description=f"Ran 9 detectors — {len(signals)} signal(s) found",
            data={
                "tool": {
                    "name": "run_detectors",
                    "kind": "compute",
                    "signature": "(firm_id, entries: list[TimeEntry]) -> list[AnomalySignal]",
                    "result": {"signal_count": len(signals), "entry_count": len(entries)},
                }
            },
        ))

        # Apply scoring overrides
        for signal in signals:
            apply_scoring_overrides(signal)

        # Sort by priority descending (G1-06)
        signals.sort(key=lambda s: s.priority, reverse=True)

        # --- Gemini: narrative quality pass on PENDING/APPROVED entries ---
        entry_map = {e["id"]: e for e in entries}
        for signal in signals:
            if signal.anomaly_type != AnomalyType.ROUND_HOURS_NO_SESSION:
                continue
            entry = entry_map.get(signal.entity_id)
            if not entry:
                continue
            assessment, suggested, confidence = _call_gemini_narrative_quality(entry)
            if assessment and confidence is not None and confidence >= 0.65:
                signal.anomaly_type = AnomalyType.NARRATIVE_INSUFFICIENT
                signal.gemini_assessment = assessment
                signal.suggested_narrative = suggested
                signal.confidence = confidence

        # --- Gemini: hours plausibility on high-hour entries ---
        for entry in entries:
            hours = float(entry.get("hours", 0))
            if hours <= 6.0 or entry.get("status") not in ("PENDING", "APPROVED"):
                continue
            assessment, confidence = _call_gemini_hours_plausibility(entry)
            if assessment and confidence is not None:
                severity = "BLOCK" if confidence >= 0.65 else "WARN"
                already = any(s.entity_id == entry["id"] and s.anomaly_type == AnomalyType.HOURS_NARRATIVE_MISMATCH for s in signals)
                if not already:
                    sig = AnomalySignal(
                        entity_id=entry["id"],
                        anomaly_type=AnomalyType.HOURS_NARRATIVE_MISMATCH,
                        description=f"Entry {entry['id']}: {assessment}",
                        matter_id=entry.get("matter_id"),
                        priority=3 if confidence >= 0.65 else 2,
                        risk_level="ELEVATED",
                        severity=severity,
                        gemini_assessment=assessment,
                        confidence=confidence,
                    )
                    apply_scoring_overrides(sig)
                    signals.append(sig)

        # --- Gemini: semantic duplicate for matters with ≥4 flagged entries ---
        from collections import defaultdict
        matter_semantic_signals: Dict[str, List[AnomalySignal]] = defaultdict(list)
        for sig in signals:
            if sig.anomaly_type == AnomalyType.SEMANTIC_DUPLICATE_CANDIDATE:
                matter_semantic_signals[sig.matter_id or ""].append(sig)

        for matter_id, matter_sigs in matter_semantic_signals.items():
            if len(matter_sigs) < 4:
                continue
            matter_entry_ids = {s.entity_id for s in matter_sigs}
            matter_entries = [entry_map[eid] for eid in matter_entry_ids if eid in entry_map]
            pairs = _call_gemini_semantic_duplicate(matter_entries)
            if pairs:
                observations.append(_obs(
                    observation_type=ObservationType.REASONING,
                    commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                    description=f"Gemini identified {len(pairs)} semantic duplicate pair(s) on matter {matter_id}",
                    data={"matter_id": matter_id, "duplicate_pairs": pairs},
                    work_kind="llm_assisted",
                ))

        # --- Gemini: enrichment for high-priority signals ---
        for signal in signals:
            if signal.gemini_assessment:
                continue  # already enriched
            enrichment = _call_gemini_anomaly_enrichment(signal)
            if enrichment:
                signal.gemini_assessment = enrichment
                observations.append(_obs(
                    observation_type=ObservationType.TOOL_CALL,
                    commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                    description=f"Gemini assessed anomaly: {signal.anomaly_type} on {signal.entity_id}",
                    work_kind="llm_assisted",
                    model_name=config.GEMINI_MODEL,
                    confidence=signal.confidence,
                    data={
                        "tool": {
                            "name": "assess_narrative_quality",
                            "kind": "gemini",
                            "signature": "(entry_id, narrative, activity_code) -> NarrativeQualityResult | None",
                            "result": {
                                "anomaly_type": signal.anomaly_type,
                                "assessment_length": len(enrichment),
                            },
                        }
                    },
                    evidence=[signal.entity_id],
                ))

        # --- Gemini: matter synthesis for matters with ≥2 signals ---
        matter_signal_groups: Dict[str, List[AnomalySignal]] = defaultdict(list)
        for sig in signals:
            if sig.matter_id:
                matter_signal_groups[sig.matter_id].append(sig)

        for matter_id, matter_sigs in matter_signal_groups.items():
            if len(matter_sigs) < 2:
                continue
            synthesis = _call_gemini_matter_synthesis(matter_sigs, matter_id)
            if synthesis:
                observations.append(_obs(
                    observation_type=ObservationType.MATTER_SYNTHESIS,
                    commitment_level=CommitmentLevel.AUTO_SAFE,
                    description=synthesis,
                    data={"matter_id": matter_id, "signal_count": len(matter_sigs)},
                    work_kind="llm_assisted",
                ))

        # --- Emit observation for highest-priority signal ---
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

        # --- Log via tool layer ---
        new_logged: List[str] = []
        existing_logged: List[str] = []
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
                severity=signal.severity,
                gemini_assessment=signal.gemini_assessment,
                suggested_narrative=signal.suggested_narrative,
                confidence=signal.confidence,
            )
            if hasattr(result, "entity_id"):
                if result.entity_id != result.audit_event_id:
                    new_logged.append(result.entity_id)
                else:
                    existing_logged.append(result.entity_id)

        final_level = CommitmentLevel.REVIEW_REQUIRED if new_logged else CommitmentLevel.AUTO_SAFE
        existing_note = f" · {len(existing_logged)} existing already under review" if existing_logged else ""
        observations.append(_obs(
            observation_type=ObservationType.RESULT,
            commitment_level=final_level,
            description=(
                f"Pattern scan complete: {len(signals)} signal(s) detected, "
                f"{len(new_logged)} new anomal{'ies' if len(new_logged) != 1 else 'y'} logged"
                + existing_note
            ),
            data={
                "signals_detected": len(signals),
                "new_anomalies": len(new_logged),
                "existing_anomalies": len(existing_logged),
            },
        ))

        matters_touched = list({s.matter_id for s in signals if s.matter_id})
        return {
            "agent": self.name,
            "signals_detected": len(signals),
            "anomalies_logged": len(new_logged) + len(existing_logged),
            "new_anomalies": len(new_logged),
            "existing_anomalies": len(existing_logged),
            "escalation_ids": new_logged,
            "matters_touched": matters_touched,
            "observations": observations,
        }
