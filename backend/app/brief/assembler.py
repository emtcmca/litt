"""
Brief assembler — builds all 5 sections from live Firestore state.
Deterministic Python only. No Gemini calls.

All Firestore collections are fetched once at the top of assemble_brief()
and passed to section-building helpers. No N+1 queries.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from app import config
from app.db import collection_ref
from app.scrubber.prebill import run_prebill_checks
from app.brief.schemas import (
    AnomaliesSection,
    BriefAnomalyItem,
    BriefBudgetItem,
    BriefClientSilenceItem,
    BriefDeadlineItem,
    BriefResponse,
    BriefScrubberFlag,
    BriefSections,
    BriefTimeEntryItem,
    BudgetRisksSection,
    ClientSilenceSection,
    DeadlineSection,
    TimeEntrySection,
)

FIRM_NAMES: Dict[str, str] = {
    "strand-okafor": "Strand & Okafor LLP",
}

# Escalation cadence thresholds in days
_CADENCE = [(0, "CRITICAL"), (1, "1_DAY"), (3, "3_DAY"), (7, "7_DAY"), (14, "14_DAY")]

# Maps escalation.type → entity_type string for BriefAnomalyItem
_ESC_ENTITY_TYPE: Dict[str, str] = {
    "ANOMALY": "time_entry",
    "DEADLINE": "deadline",
    "BILLING": "time_entry",
    "COMMS": "communication",
}


def _escalation_level(days_out: int) -> Optional[str]:
    """Return highest-severity cadence label for a deadline N days out."""
    for threshold, label in _CADENCE:
        if days_out <= threshold:
            return label
    return None


def _parse_dt(val: Any) -> Optional[datetime]:
    """Parse Firestore datetime, ISO string, or None into datetime."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, str):
        return datetime.fromisoformat(val.replace("Z", "+00:00"))
    if hasattr(val, "timestamp"):
        from datetime import timezone
        return datetime.fromtimestamp(val.timestamp(), tz=timezone.utc)
    return None


def _parse_date(val: Any) -> Optional[date]:
    """Parse Firestore date, ISO string, or None into date."""
    if val is None:
        return None
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, str):
        return date.fromisoformat(val[:10])
    return None


# ---------------------------------------------------------------------------
# Section builders — pure functions over pre-fetched dicts
# ---------------------------------------------------------------------------

def _build_deadlines_section(
    deadlines: List[dict],
    matters: Dict[str, dict],
    clients: Dict[str, dict],
    today: date,
) -> DeadlineSection:
    items: List[BriefDeadlineItem] = []

    for dl in deadlines:
        if dl.get("status") != "ACTIVE":
            continue
        if dl.get("verification_status") != "attorney_verified":
            continue

        due_date = _parse_date(dl.get("due_date"))
        if due_date is None:
            continue

        days_out = (due_date - today).days
        matter = matters.get(dl.get("matter_id", ""), {})
        client = clients.get(matter.get("client_id", ""), {})

        confirmed_dt = _parse_dt(dl.get("last_confirmed_at"))
        detected_dt = _parse_dt(dl.get("created_at"))

        items.append(BriefDeadlineItem(
            deadline_id=dl["id"],
            version=int(dl.get("version", 1)),
            matter_id=dl.get("matter_id", ""),
            matter_name=matter.get("name", dl.get("matter_id", "")),
            client_id=matter.get("client_id", ""),
            client_name=client.get("name", matter.get("client_id", "")),
            description=dl.get("description", ""),
            due_date=due_date.isoformat(),
            days_out=days_out,
            classification=dl.get("classification", ""),
            status=dl.get("status", ""),
            verification_status=dl.get("verification_status", ""),
            last_confirmed_by=dl.get("last_confirmed_by"),
            last_confirmed_at=confirmed_dt.isoformat() if confirmed_dt else None,
            is_unconfirmed=dl.get("last_confirmed_by") is None,
            escalation_level=_escalation_level(days_out),
            source_type=dl.get("source_type"),
            source_document_id=dl.get("source_document_id"),
            source_excerpt=dl.get("source_excerpt"),
            court=dl.get("court"),
            jurisdiction=dl.get("jurisdiction"),
            detected_at=detected_dt.isoformat() if detected_dt else None,
        ))

    items.sort(key=lambda x: x.days_out)
    has_critical = any(
        i.classification == "HARD_LEGAL" and i.days_out <= 7 for i in items
    )
    return DeadlineSection(items=items, count=len(items), has_critical=has_critical)


def _build_time_entries_section(
    time_entries: List[dict],
    matters: Dict[str, dict],
    clients: Dict[str, dict],
) -> TimeEntrySection:
    items: List[BriefTimeEntryItem] = []
    total_wip = 0.0

    for entry in time_entries:
        if entry.get("status") != "PENDING":
            continue

        client = clients.get(entry.get("client_id", ""), {})
        matter = matters.get(entry.get("matter_id", ""), {})

        result = run_prebill_checks(entry, client)
        flags = [
            BriefScrubberFlag(
                check_name=f.check_name,
                severity=f.severity,
                message=f.message,
                matched_text=f.matched_text,
            )
            for f in result.flags
        ]

        amount = float(entry.get("amount", 0))
        total_wip += amount

        items.append(BriefTimeEntryItem(
            entry_id=entry["id"],
            version=int(entry.get("version", 1)),
            matter_id=entry.get("matter_id", ""),
            matter_name=matter.get("name", entry.get("matter_id", "")),
            client_id=entry.get("client_id", ""),
            client_name=client.get("name", entry.get("client_id", "")),
            attorney_id=entry.get("attorney_id", ""),
            entry_date=str(entry.get("entry_date", "")),
            hours=float(entry.get("hours", 0)),
            amount=amount,
            narrative=entry.get("narrative"),
            status=entry.get("status", ""),
            scrubber_flags=flags,
            has_block=result.has_block,
            has_warn=result.has_warn,
            task_code=entry.get("task_code"),
            activity_code=entry.get("activity_code"),
            session_minutes_actual=entry.get("session_minutes_actual"),
        ))

    # BLOCKs first, then WARNs, then clean
    items.sort(key=lambda x: (0 if x.has_block else 1 if x.has_warn else 2))
    return TimeEntrySection(items=items, count=len(items), total_wip_usd=round(total_wip, 2))


def _build_budget_section(
    time_entries: List[dict],
    clients: Dict[str, dict],
) -> BudgetRisksSection:
    # Sum APPROVED entry amounts per client
    approved: Dict[str, float] = {}
    for entry in time_entries:
        if entry.get("status") == "APPROVED":
            cid = entry.get("client_id", "")
            approved[cid] = approved.get(cid, 0.0) + float(entry.get("amount", 0))

    items: List[BriefBudgetItem] = []
    for client_id, client in clients.items():
        cap_raw = client.get("budget_cap")
        if not cap_raw:
            continue
        cap = float(cap_raw)

        guidelines = client.get("billing_guidelines", {})
        threshold = float(
            guidelines.get("budget_notice_threshold", 0.75)
            if isinstance(guidelines, dict)
            else 0.75
        )

        billed = float(client.get("budget_billed", 0))
        unbilled = approved.get(client_id, 0.0)
        committed = billed + unbilled
        utilization = committed / cap if cap > 0 else 0.0

        if utilization < threshold:
            continue

        items.append(BriefBudgetItem(
            client_id=client_id,
            client_name=client.get("name", client_id),
            budget_cap=cap,
            budget_billed=billed,
            approved_unbilled=round(unbilled, 2),
            total_committed=round(committed, 2),
            utilization_pct=round(utilization * 100, 1),
            alert_status="CRITICAL" if utilization >= 0.90 else "WARN",
            threshold_pct=round(threshold * 100, 1),
        ))

    items.sort(key=lambda x: x.utilization_pct, reverse=True)
    return BudgetRisksSection(items=items, count=len(items))


def _build_client_silence_section(
    matters: Dict[str, dict],
    clients: Dict[str, dict],
    today: date,
) -> ClientSilenceSection:
    items: List[BriefClientSilenceItem] = []

    for matter_id, matter in matters.items():
        if matter.get("status") != "ACTIVE":
            continue

        client_id = matter.get("client_id", "")
        client = clients.get(client_id, {})
        threshold = int(client.get("client_silence_threshold_days", 14))

        last_contact_dt = _parse_dt(matter.get("last_client_contact"))
        if last_contact_dt is None:
            days_since = 9999
            last_contact_str = None
        else:
            days_since = (today - last_contact_dt.date()).days
            last_contact_str = last_contact_dt.date().isoformat()

        if days_since < threshold:
            continue

        items.append(BriefClientSilenceItem(
            matter_id=matter_id,
            matter_name=matter.get("name", matter_id),
            client_id=client_id,
            client_name=client.get("name", client_id),
            days_since_contact=days_since,
            threshold_days=threshold,
            last_contact_date=last_contact_str,
            comm_draft_id=None,
        ))

    items.sort(key=lambda x: x.days_since_contact, reverse=True)
    return ClientSilenceSection(items=items, count=len(items))


def _build_anomalies_section(escalations: List[dict]) -> AnomaliesSection:
    items: List[BriefAnomalyItem] = []

    for esc in escalations:
        if esc.get("type") != "ANOMALY":
            continue
        if esc.get("status") != "PENDING":
            continue

        brief = esc.get("brief", {})
        created_dt = _parse_dt(esc.get("created_at"))
        esc_type = esc.get("type", "")

        items.append(BriefAnomalyItem(
            escalation_id=esc["id"],
            matter_id=esc.get("matter_id"),
            entity_id=esc.get("entity_id", ""),
            entity_type=_ESC_ENTITY_TYPE.get(esc_type, "unknown"),
            risk_level=brief.get("risk_level", "ROUTINE"),
            priority=esc.get("priority", 1),
            what_is_happening=brief.get("what_is_happening", ""),
            why_it_matters=brief.get("why_it_matters", ""),
            what_litt_has_done=brief.get("what_litt_has_done", ""),
            what_attorney_must_decide=brief.get("what_attorney_must_decide", ""),
            created_at=created_dt.isoformat() if created_dt else "",
        ))

    items.sort(key=lambda x: x.priority, reverse=True)
    return AnomaliesSection(items=items, count=len(items))


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def assemble_brief(firm_id: str, attorney_id: str = "dana-strand") -> BriefResponse:
    """
    Build the Daily Closeout Brief from live Firestore state.
    Fetches each collection once; no N+1 queries.
    """
    today = config.get_effective_date()

    attorneys = {doc.id: doc.to_dict() for doc in collection_ref(firm_id, "attorneys").stream()}
    clients = {doc.id: doc.to_dict() for doc in collection_ref(firm_id, "clients").stream()}
    matters = {doc.id: doc.to_dict() for doc in collection_ref(firm_id, "matters").stream()}
    time_entries = [doc.to_dict() for doc in collection_ref(firm_id, "time_entries").stream()]
    deadlines = [doc.to_dict() for doc in collection_ref(firm_id, "deadlines").stream()]
    escalations = [doc.to_dict() for doc in collection_ref(firm_id, "escalations").stream()]

    attorney = attorneys.get(attorney_id, {})

    return BriefResponse(
        firm_id=firm_id,
        firm_name=FIRM_NAMES.get(firm_id, firm_id),
        attorney_id=attorney_id,
        attorney_name=attorney.get("name", attorney_id),
        generated_at=config.get_effective_datetime().isoformat(),
        demo_mode=config.DEMO_MODE,
        sections=BriefSections(
            deadlines=_build_deadlines_section(deadlines, matters, clients, today),
            time_entries=_build_time_entries_section(time_entries, matters, clients),
            budget_risks=_build_budget_section(time_entries, clients),
            client_silence=_build_client_silence_section(matters, clients, today),
            anomalies=_build_anomalies_section(escalations),
        ),
        resolved_today=[],
    )
