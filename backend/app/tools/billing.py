"""
Billing tool layer — only write path to time_entries and invoices.
All state machine transitions enforced here. No exceptions raised to callers.
"""

import math
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union

from app.config import get_effective_datetime
from app.db import collection_ref, get_db
from app.models import (
    AlertStatus,
    AuditTier,
    BudgetUtilization,
    TimeEntryStatus,
    ToolError,
    ToolResult,
    WriteDownRecord,
    WriteOffRecord,
)
from app.tools.audit import log_audit_event
from app.tools.validation import check_idempotency, check_optimistic_lock, register_idempotency

# ---------------------------------------------------------------------------
# State machine — hardcoded, not configurable
# ---------------------------------------------------------------------------

VALID_TRANSITIONS: Dict[str, List[str]] = {
    "CAPTURED":    ["PENDING"],
    "PENDING":     ["APPROVED", "WRITTEN_OFF"],
    "APPROVED":    ["BILLED", "WRITTEN_OFF"],
    "BILLED":      ["CLOSED"],
    "WRITTEN_OFF": [],
    "CLOSED":      [],
}


def is_valid_transition(from_status: str, to_status: str) -> bool:
    return to_status in VALID_TRANSITIONS.get(from_status, [])


# ---------------------------------------------------------------------------
# Billing math
# ---------------------------------------------------------------------------

def round_to_increment(minutes: int, increment: float = 0.1) -> Decimal:
    """
    Convert raw minutes to billed hours, rounded up to nearest increment.
    increment=0.1 → 6-minute minimum.  46 min → 0.8 hr.
    """
    hours = minutes / 60
    return Decimal(str(math.ceil(hours / increment) * increment))


def _fs(val: Any) -> Any:
    """Firestore-safe conversion: Decimal→float, date→isoformat."""
    if isinstance(val, dict):
        return {k: _fs(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_fs(v) for v in val]
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, date) and not isinstance(val, datetime):
        return val.isoformat()
    return val


# ---------------------------------------------------------------------------
# advance_entry_status
# ---------------------------------------------------------------------------

def advance_entry_status(
    firm_id: str,
    entry_id: str,
    new_status: str,
    actor: str,
    idempotency_key: str,
    expected_version: int,
) -> Union[ToolResult, ToolError]:
    # Idempotency check
    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=entry_id, entity_type="time_entry", audit_event_id=existing)

    # Optimistic lock
    lock_ok, data = check_optimistic_lock(firm_id, "time_entries", entry_id, expected_version)
    if not lock_ok:
        if data is None:
            return ToolError(error_type="NOT_FOUND", message=f"time_entry {entry_id} not found")
        return ToolError(
            error_type="STALE_STATE",
            message="Version mismatch — reload entry before retrying",
            detail={"expected": expected_version, "actual": data.get("version")},
        )

    current_status = data.get("status", "PENDING")
    if not is_valid_transition(current_status, new_status):
        return ToolError(
            error_type="INVALID_TRANSITION",
            message=f"{current_status} → {new_status} is not a valid transition",
            detail={"valid_next": VALID_TRANSITIONS.get(current_status, [])},
        )

    now = get_effective_datetime()
    new_version = expected_version + 1

    collection_ref(firm_id, "time_entries").document(entry_id).update({
        "status": new_status,
        "version": new_version,
        "updated_at": now,
    })

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.operational,
        event_type="ENTRY_STATUS_ADVANCED",
        actor=actor,
        entity_type="time_entry",
        entity_id=entry_id,
        before_state={"status": current_status, "version": expected_version},
        after_state={"status": new_status, "version": new_version},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, audit_id)
    return ToolResult(entity_id=entry_id, entity_type="time_entry", audit_event_id=audit_id)


# ---------------------------------------------------------------------------
# write_time_entry
# ---------------------------------------------------------------------------

def write_time_entry(
    firm_id: str,
    matter_id: str,
    client_id: str,
    attorney_id: str,
    entry_date: date,
    session_minutes: int,
    rate: Decimal,
    actor: str,
    idempotency_key: str,
    task_code: Optional[str] = None,
    activity_code: Optional[str] = None,
    narrative: Optional[str] = None,
    raw_note: Optional[str] = None,
    billing_increment: float = 0.1,
    ai_assisted: bool = False,
    ai_tool: Optional[str] = None,
    model: Optional[str] = None,
    ai_cost_usd: Optional[Decimal] = None,
    human_minutes_actual: Optional[int] = None,
    ai_minutes_estimated: Optional[int] = None,
) -> Union[ToolResult, ToolError]:
    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=existing, entity_type="time_entry", audit_event_id=existing)

    hours = round_to_increment(session_minutes, billing_increment)
    amount = hours * rate
    now = get_effective_datetime()
    entry_id = f"te-{uuid.uuid4().hex[:10]}"

    doc = _fs({
        "id": entry_id,
        "firm_id": firm_id,
        "matter_id": matter_id,
        "client_id": client_id,
        "attorney_id": attorney_id,
        "entry_date": entry_date,
        "hours": hours,
        "rate": rate,
        "amount": amount,
        "session_minutes_actual": session_minutes,
        "billing_increment": billing_increment,
        "task_code": task_code,
        "activity_code": activity_code,
        "narrative": narrative,
        "raw_note": raw_note,
        "status": "PENDING",
        "invoice_id": None,
        "ai_assisted": ai_assisted,
        "ai_tool": ai_tool,
        "model": model,
        "ai_cost_usd": ai_cost_usd,
        "human_minutes_actual": human_minutes_actual,
        "ai_minutes_estimated": ai_minutes_estimated,
        "output_type": None,
        "human_review_completed": False,
        "reviewing_attorney_id": None,
        "client_ai_disclosure_required": False,
        "client_ai_disclosure_status": None,
        "billing_treatment": None,
        "activity_log": [],
        "write_down_record": None,
        "write_off_record": None,
        "version": 1,
        "created_at": now,
        "updated_at": now,
    })

    collection_ref(firm_id, "time_entries").document(entry_id).create(doc)

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.operational,
        event_type="ENTRY_CREATED",
        actor=actor,
        entity_type="time_entry",
        entity_id=entry_id,
        after_state={"hours": float(hours), "amount": float(amount), "status": "PENDING", "raw_note": raw_note},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, entry_id)
    return ToolResult(entity_id=entry_id, entity_type="time_entry", audit_event_id=audit_id)


# ---------------------------------------------------------------------------
# write_down_entry — partial reduction, reason required, preserves original
# ---------------------------------------------------------------------------

def write_down_entry(
    firm_id: str,
    entry_id: str,
    new_hours: Decimal,
    reason: str,
    attorney_id: str,
    idempotency_key: str,
    expected_version: int,
) -> Union[ToolResult, ToolError]:
    if not reason or not reason.strip():
        return ToolError(error_type="VALIDATION_FAILED", message="reason is required for write-down")

    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=entry_id, entity_type="time_entry", audit_event_id=existing)

    lock_ok, data = check_optimistic_lock(firm_id, "time_entries", entry_id, expected_version)
    if not lock_ok:
        if data is None:
            return ToolError(error_type="NOT_FOUND", message=f"time_entry {entry_id} not found")
        return ToolError(error_type="STALE_STATE", message="Version mismatch", detail={"actual": data.get("version")})

    original_hours = Decimal(str(data.get("hours", 0)))
    rate = Decimal(str(data.get("rate", 0)))
    original_amount = original_hours * rate
    new_amount = new_hours * rate
    now = get_effective_datetime()

    write_down_record = {
        "original_hours": float(original_hours),
        "original_amount": float(original_amount),
        "new_hours": float(new_hours),
        "new_amount": float(new_amount),
        "reason": reason,
        "attorney_id": attorney_id,
        "written_down_at": now,
    }

    collection_ref(firm_id, "time_entries").document(entry_id).update({
        "hours": float(new_hours),
        "amount": float(new_amount),
        "write_down_record": write_down_record,
        "version": expected_version + 1,
        "updated_at": now,
    })

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.legal_defensibility,
        event_type="ENTRY_WRITTEN_DOWN",
        actor=attorney_id,
        entity_type="time_entry",
        entity_id=entry_id,
        before_state={"hours": float(original_hours), "amount": float(original_amount)},
        after_state={"hours": float(new_hours), "amount": float(new_amount), "reason": reason},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, audit_id)
    return ToolResult(entity_id=entry_id, entity_type="time_entry", audit_event_id=audit_id)


# ---------------------------------------------------------------------------
# write_off_entry — terminal state, reason required
# ---------------------------------------------------------------------------

def write_off_entry(
    firm_id: str,
    entry_id: str,
    reason: str,
    attorney_id: str,
    idempotency_key: str,
    expected_version: int,
) -> Union[ToolResult, ToolError]:
    if not reason or not reason.strip():
        return ToolError(error_type="VALIDATION_FAILED", message="reason is required for write-off")

    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=entry_id, entity_type="time_entry", audit_event_id=existing)

    lock_ok, data = check_optimistic_lock(firm_id, "time_entries", entry_id, expected_version)
    if not lock_ok:
        if data is None:
            return ToolError(error_type="NOT_FOUND", message=f"time_entry {entry_id} not found")
        return ToolError(error_type="STALE_STATE", message="Version mismatch", detail={"actual": data.get("version")})

    current_status = data.get("status", "PENDING")
    if not is_valid_transition(current_status, "WRITTEN_OFF"):
        return ToolError(
            error_type="INVALID_TRANSITION",
            message=f"{current_status} → WRITTEN_OFF is not valid",
            detail={"valid_next": VALID_TRANSITIONS.get(current_status, [])},
        )

    original_hours = Decimal(str(data.get("hours", 0)))
    rate = Decimal(str(data.get("rate", 0)))
    original_amount = original_hours * rate
    now = get_effective_datetime()

    write_off_record = {
        "original_hours": float(original_hours),
        "original_amount": float(original_amount),
        "reason": reason,
        "attorney_id": attorney_id,
        "written_off_at": now,
    }

    collection_ref(firm_id, "time_entries").document(entry_id).update({
        "status": "WRITTEN_OFF",
        "write_off_record": write_off_record,
        "version": expected_version + 1,
        "updated_at": now,
    })

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.legal_defensibility,
        event_type="ENTRY_WRITTEN_OFF",
        actor=attorney_id,
        entity_type="time_entry",
        entity_id=entry_id,
        before_state={"status": current_status, "hours": float(original_hours)},
        after_state={"status": "WRITTEN_OFF", "reason": reason},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, audit_id)
    return ToolResult(entity_id=entry_id, entity_type="time_entry", audit_event_id=audit_id)


# ---------------------------------------------------------------------------
# compute_budget_utilization — read-only
# ---------------------------------------------------------------------------

def compute_budget_utilization(
    firm_id: str,
    client_id: str,
) -> Union[BudgetUtilization, ToolError]:
    client_doc = collection_ref(firm_id, "clients").document(client_id).get()
    if not client_doc.exists:
        return ToolError(error_type="NOT_FOUND", message=f"client {client_id} not found")

    client = client_doc.to_dict()
    budget_cap_raw = client.get("budget_cap")
    if budget_cap_raw is None:
        return ToolError(error_type="VALIDATION_FAILED", message=f"client {client_id} has no budget_cap")

    budget_cap = Decimal(str(budget_cap_raw))
    billed_to_date = Decimal(str(client.get("budget_billed", 0)))
    threshold_raw = client.get("billing_guidelines", {})
    warn_threshold = float(threshold_raw.get("budget_notice_threshold", 0.75)) if isinstance(threshold_raw, dict) else 0.75

    # Sum APPROVED entries not yet billed
    approved_entries = (
        collection_ref(firm_id, "time_entries")
        .where("client_id", "==", client_id)
        .where("status", "==", "APPROVED")
        .get()
    )
    approved_unbilled = sum(
        Decimal(str(e.to_dict().get("amount", 0))) for e in approved_entries
    )

    total_committed = billed_to_date + approved_unbilled
    utilization_pct = float(total_committed / budget_cap) if budget_cap > 0 else 0.0

    if utilization_pct >= 0.90:
        alert_status = AlertStatus.CRITICAL
    elif utilization_pct >= warn_threshold:
        alert_status = AlertStatus.WARN
    else:
        alert_status = AlertStatus.CLEAR

    return BudgetUtilization(
        client_id=client_id,
        firm_id=firm_id,
        budget_cap=budget_cap,
        billed_to_date=billed_to_date,
        approved_unbilled=approved_unbilled,
        total_committed=total_committed,
        utilization_pct=utilization_pct,
        alert_threshold_warn=warn_threshold,
        alert_threshold_critical=0.90,
        alert_status=alert_status,
    )


# ---------------------------------------------------------------------------
# generate_invoice
# ---------------------------------------------------------------------------

def update_entry_narrative(
    firm_id: str,
    entry_id: str,
    narrative: str,
    actor: str,
    idempotency_key: str,
    expected_version: int,
) -> Union[ToolResult, ToolError]:
    """Update narrative on a PENDING or APPROVED time entry."""
    if not narrative or not narrative.strip():
        return ToolError(error_type="VALIDATION_FAILED", message="narrative cannot be empty")

    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=entry_id, entity_type="time_entry", audit_event_id=existing)

    lock_ok, data = check_optimistic_lock(firm_id, "time_entries", entry_id, expected_version)
    if not lock_ok:
        if data is None:
            return ToolError(error_type="NOT_FOUND", message=f"time_entry {entry_id} not found")
        return ToolError(error_type="STALE_STATE", message="Version mismatch", detail={"actual": data.get("version")})

    current_status = data.get("status", "PENDING")
    if current_status not in ("PENDING", "APPROVED"):
        return ToolError(
            error_type="INVALID_TRANSITION",
            message=f"Cannot update narrative on entry with status {current_status}",
        )

    now = get_effective_datetime()
    collection_ref(firm_id, "time_entries").document(entry_id).update({
        "narrative": narrative,
        "version": expected_version + 1,
        "updated_at": now,
    })

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.operational,
        event_type="ENTRY_NARRATIVE_AMENDED",
        actor=actor,
        entity_type="time_entry",
        entity_id=entry_id,
        before_state={"narrative": data.get("narrative")},
        after_state={"narrative": narrative},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, audit_id)
    return ToolResult(entity_id=entry_id, entity_type="time_entry", audit_event_id=audit_id)


def generate_invoice(
    firm_id: str,
    client_id: str,
    period_start: date,
    period_end: date,
    actor: str,
    idempotency_key: str,
) -> Union[ToolResult, ToolError]:
    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=existing, entity_type="invoice", audit_event_id=existing)

    # Fetch APPROVED entries for this client in the period (entry_date stored as ISO string)
    period_start_str = period_start.isoformat()
    period_end_str = period_end.isoformat()

    entries_snap = (
        collection_ref(firm_id, "time_entries")
        .where("client_id", "==", client_id)
        .where("status", "==", "APPROVED")
        .where("entry_date", ">=", period_start_str)
        .where("entry_date", "<=", period_end_str)
        .get()
    )

    entries = [e.to_dict() for e in entries_snap]
    if not entries:
        return ToolError(
            error_type="VALIDATION_FAILED",
            message="No APPROVED entries found for this client and period",
        )

    total_hours = sum(Decimal(str(e.get("hours", 0))) for e in entries)
    total_amount = sum(Decimal(str(e.get("amount", 0))) for e in entries)

    # Build exhibit markdown
    lines = ["| Date | Attorney | Hours | Rate | Amount | Narrative |",
             "|------|----------|-------|------|--------|-----------|"]
    for e in sorted(entries, key=lambda x: x.get("entry_date", "")):
        lines.append(
            f"| {e.get('entry_date','')} "
            f"| {e.get('attorney_id','')} "
            f"| {e.get('hours',0):.1f} "
            f"| ${e.get('rate',0):.0f}/hr "
            f"| ${e.get('amount',0):.2f} "
            f"| {e.get('narrative') or ''} |"
        )
    exhibit_md = "\n".join(lines)

    now = get_effective_datetime()
    invoice_id = f"INV-{now.year}-{uuid.uuid4().hex[:4].upper()}"

    invoice_doc = _fs({
        "id": invoice_id,
        "firm_id": firm_id,
        "client_id": client_id,
        "period_start": period_start,
        "period_end": period_end,
        "total_hours": total_hours,
        "total_amount": total_amount,
        "retainer_draw": None,
        "retainer_balance_after": None,
        "exhibit_md": exhibit_md,
        "ledes_file_path": None,
        "status": "DRAFT",
        "issued_at": None,
        "paid_at": None,
        "days_outstanding": None,
        "created_at": now,
        "updated_at": now,
    })
    collection_ref(firm_id, "invoices").document(invoice_id).create(invoice_doc)

    # Batch-update all included entries to BILLED
    db = get_db()
    batch = db.batch()
    for e in entries:
        ref = collection_ref(firm_id, "time_entries").document(e["id"])
        batch.update(ref, {
            "status": "BILLED",
            "invoice_id": invoice_id,
            "version": e.get("version", 1) + 1,
            "updated_at": now,
        })
    batch.commit()

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.legal_defensibility,
        event_type="INVOICE_GENERATED",
        actor=actor,
        entity_type="invoice",
        entity_id=invoice_id,
        after_state={
            "client_id": client_id,
            "total_hours": float(total_hours),
            "total_amount": float(total_amount),
            "entry_count": len(entries),
        },
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, invoice_id)
    return ToolResult(
        entity_id=invoice_id,
        entity_type="invoice",
        audit_event_id=audit_id,
        data={"total_hours": float(total_hours), "total_amount": float(total_amount)},
    )
