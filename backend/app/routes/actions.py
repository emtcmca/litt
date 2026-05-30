"""
Action endpoints — all writes go through the tool layer.
Returns tool layer ToolResult/ToolError as-is; client inspects `success` field.
"""

import uuid
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.scrubber.prebill import run_prebill_scrubber
from app.tools.alerts import dismiss_alert
from app.tools.billing import (
    advance_entry_status,
    compute_budget_utilization,
    generate_invoice,
    update_entry_narrative,
    write_down_entry,
    write_off_entry,
)
from app.tools.comms import (
    approve_client_comm_draft,
    dismiss_comm,
    log_client_comm_sent,
    queue_client_comm_for_delivery,
)
from app.tools.deadlines import (
    confirm_deadline,
    dismiss_deadline,
    log_deadline_event,
    resolve_deadline,
    supersede_deadline,
    verify_deadline,
)

router = APIRouter()


def _idem(provided: Optional[str]) -> str:
    return provided or f"action-{uuid.uuid4().hex[:16]}"


def _tool_resp(result) -> dict:
    return result.model_dump()


# ---------------------------------------------------------------------------
# Deadline actions
# ---------------------------------------------------------------------------

class DeadlineActionBase(BaseModel):
    firm_id: str
    attorney_id: str
    deadline_id: str
    expected_version: int = 1
    idempotency_key: Optional[str] = None


class DeadlineExtend(DeadlineActionBase):
    new_due_date: str
    reason: str


class DeadlineDismiss(DeadlineActionBase):
    reason: str


class DeadlineVerify(DeadlineActionBase):
    pass


@router.post("/actions/deadline/confirm")
def deadline_confirm(req: DeadlineActionBase):
    return _tool_resp(confirm_deadline(
        firm_id=req.firm_id,
        deadline_id=req.deadline_id,
        attorney_id=req.attorney_id,
        idempotency_key=_idem(req.idempotency_key),
        expected_version=req.expected_version,
    ))


@router.post("/actions/deadline/resolve")
def deadline_resolve(req: DeadlineActionBase):
    return _tool_resp(resolve_deadline(
        firm_id=req.firm_id,
        deadline_id=req.deadline_id,
        attorney_id=req.attorney_id,
        idempotency_key=_idem(req.idempotency_key),
        expected_version=req.expected_version,
    ))


@router.post("/actions/deadline/extend")
def deadline_extend(req: DeadlineExtend):
    """
    Extend by creating a new deadline record, then superseding the old one.
    The new deadline ID is returned — the caller should seed it separately if
    needed (full pipeline wired in v1.1 ingestion flow).
    For v1.0 demo: we log the extension event and update last_confirmed_by.
    """
    idem = _idem(req.idempotency_key)
    # Confirm the existing deadline with the extension note
    result = confirm_deadline(
        firm_id=req.firm_id,
        deadline_id=req.deadline_id,
        attorney_id=req.attorney_id,
        idempotency_key=idem,
        expected_version=req.expected_version,
    )
    if not result.success:
        return _tool_resp(result)

    # Log an ATTORNEY_EXTENDED event with the new date in notes
    log_deadline_event(
        firm_id=req.firm_id,
        deadline_id=req.deadline_id,
        event_type="ATTORNEY_EXTENDED",
        actor=req.attorney_id,
        idempotency_key=f"{idem}-ext-evt",
        attorney_id=req.attorney_id,
        notes=f"Extended to {req.new_due_date}. Reason: {req.reason}",
    )
    return _tool_resp(result)


@router.post("/actions/deadline/dismiss")
def deadline_dismiss(req: DeadlineDismiss):
    return _tool_resp(dismiss_deadline(
        firm_id=req.firm_id,
        deadline_id=req.deadline_id,
        attorney_id=req.attorney_id,
        reason=req.reason,
        idempotency_key=_idem(req.idempotency_key),
        expected_version=req.expected_version,
    ))


@router.post("/actions/deadline/verify")
def deadline_verify(req: DeadlineVerify):
    return _tool_resp(verify_deadline(
        firm_id=req.firm_id,
        deadline_id=req.deadline_id,
        attorney_id=req.attorney_id,
        idempotency_key=_idem(req.idempotency_key),
        expected_version=req.expected_version,
    ))


# ---------------------------------------------------------------------------
# Billing actions
# ---------------------------------------------------------------------------

class BillingActionBase(BaseModel):
    firm_id: str
    attorney_id: str
    entry_id: str
    expected_version: int = 1
    idempotency_key: Optional[str] = None


class BillingUpdateNarrative(BillingActionBase):
    narrative: str


class BillingWriteDown(BillingActionBase):
    new_hours: float
    reason: str


class BillingWriteOff(BillingActionBase):
    reason: str


class GenerateInvoice(BaseModel):
    firm_id: str
    attorney_id: str
    client_id: str
    period_start: str
    period_end: str
    idempotency_key: Optional[str] = None


@router.post("/actions/billing/approve")
def billing_approve(req: BillingActionBase):
    return _tool_resp(advance_entry_status(
        firm_id=req.firm_id,
        entry_id=req.entry_id,
        new_status="APPROVED",
        actor=req.attorney_id,
        idempotency_key=_idem(req.idempotency_key),
        expected_version=req.expected_version,
    ))


@router.post("/actions/billing/update-narrative")
def billing_update_narrative(req: BillingUpdateNarrative):
    return _tool_resp(update_entry_narrative(
        firm_id=req.firm_id,
        entry_id=req.entry_id,
        narrative=req.narrative,
        actor=req.attorney_id,
        idempotency_key=_idem(req.idempotency_key),
        expected_version=req.expected_version,
    ))


@router.post("/actions/billing/write-down")
def billing_write_down(req: BillingWriteDown):
    return _tool_resp(write_down_entry(
        firm_id=req.firm_id,
        entry_id=req.entry_id,
        new_hours=Decimal(str(req.new_hours)),
        reason=req.reason,
        attorney_id=req.attorney_id,
        idempotency_key=_idem(req.idempotency_key),
        expected_version=req.expected_version,
    ))


@router.post("/actions/billing/write-off")
def billing_write_off(req: BillingWriteOff):
    return _tool_resp(write_off_entry(
        firm_id=req.firm_id,
        entry_id=req.entry_id,
        reason=req.reason,
        attorney_id=req.attorney_id,
        idempotency_key=_idem(req.idempotency_key),
        expected_version=req.expected_version,
    ))


@router.get("/billing/scrubber/{entry_id}")
def billing_scrubber(entry_id: str, firm_id: str):
    results = run_prebill_scrubber(firm_id, [entry_id])
    if not results:
        return {"entry_id": entry_id, "flags": [], "has_block": False, "has_warn": False, "clean": True}
    r = results[0]
    return {
        "entry_id": entry_id,
        "flags": [{"check_name": f.check_name, "severity": f.severity, "message": f.message} for f in r.flags],
        "has_block": r.has_block,
        "has_warn": r.has_warn,
        "clean": r.clean,
    }


@router.get("/billing/budget/{client_id}")
def billing_budget(client_id: str, firm_id: str):
    result = compute_budget_utilization(firm_id, client_id)
    return _tool_resp(result)


@router.post("/billing/generate-invoice")
def billing_generate_invoice(req: GenerateInvoice):
    from datetime import date
    return _tool_resp(generate_invoice(
        firm_id=req.firm_id,
        client_id=req.client_id,
        period_start=date.fromisoformat(req.period_start),
        period_end=date.fromisoformat(req.period_end),
        actor=req.attorney_id,
        idempotency_key=_idem(req.idempotency_key),
    ))


@router.get("/billing/ledes/{invoice_id}")
def get_ledes(invoice_id: str, firm_id: str):
    return {
        "invoice_id": invoice_id,
        "ledes_content": "LEDES1998B[]\nINVOICE_DATE|INVOICE_NUMBER|CLIENT_ID|...\n20260529|INV-2026-007|ACME-COM-001|...\n[]",
        "note": "LEDES export stubbed for v1.0 demo",
    }


# ---------------------------------------------------------------------------
# Client comms actions
# ---------------------------------------------------------------------------

class CommsActionBase(BaseModel):
    firm_id: str
    attorney_id: str
    draft_id: str
    expected_version: int = 1
    idempotency_key: Optional[str] = None


class CommsQueue(CommsActionBase):
    channel: str = "demo_outbox"


class CommsConfirmSent(CommsActionBase):
    pass


class CommsDismiss(CommsActionBase):
    reason: str


@router.post("/actions/comms/approve")
def comms_approve(req: CommsActionBase):
    return _tool_resp(approve_client_comm_draft(
        firm_id=req.firm_id,
        comm_id=req.draft_id,
        attorney_id=req.attorney_id,
        idempotency_key=_idem(req.idempotency_key),
        expected_version=req.expected_version,
    ))


@router.post("/actions/comms/queue")
def comms_queue(req: CommsQueue):
    return _tool_resp(queue_client_comm_for_delivery(
        firm_id=req.firm_id,
        comm_id=req.draft_id,
        attorney_id=req.attorney_id,
        idempotency_key=_idem(req.idempotency_key),
        expected_version=req.expected_version,
    ))


@router.post("/actions/comms/confirm-sent")
def comms_confirm_sent(req: CommsConfirmSent):
    return _tool_resp(log_client_comm_sent(
        firm_id=req.firm_id,
        comm_id=req.draft_id,
        actor=req.attorney_id,
        idempotency_key=_idem(req.idempotency_key),
        expected_version=req.expected_version,
    ))


@router.post("/actions/comms/dismiss")
def comms_dismiss(req: CommsDismiss):
    return _tool_resp(dismiss_comm(
        firm_id=req.firm_id,
        comm_id=req.draft_id,
        attorney_id=req.attorney_id,
        reason=req.reason,
        idempotency_key=_idem(req.idempotency_key),
        expected_version=req.expected_version,
    ))


# ---------------------------------------------------------------------------
# Alert dismiss
# ---------------------------------------------------------------------------

class AlertDismiss(BaseModel):
    firm_id: str
    attorney_id: str
    alert_id: str
    reason: str
    idempotency_key: Optional[str] = None


@router.post("/actions/alert/dismiss")
def alert_dismiss(req: AlertDismiss):
    return _tool_resp(dismiss_alert(
        firm_id=req.firm_id,
        escalation_id=req.alert_id,
        actor=req.attorney_id,
        reason=req.reason,
        idempotency_key=_idem(req.idempotency_key),
    ))
