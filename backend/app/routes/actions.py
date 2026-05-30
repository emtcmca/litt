"""
Action endpoints. All write through the tool layer (Day 2).
Stubs return 501 until tool layer is wired.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

NOT_IMPLEMENTED = {"error": True, "error_type": "NOT_IMPLEMENTED", "message": "Tool layer coming Day 2"}


# ---------------------------------------------------------------------------
# Deadline actions
# ---------------------------------------------------------------------------

class DeadlineActionBase(BaseModel):
    firm_id: str
    attorney_id: str
    deadline_id: str
    idempotency_key: Optional[str] = None


class DeadlineExtend(DeadlineActionBase):
    new_due_date: str
    reason: str


class DeadlineDismiss(DeadlineActionBase):
    reason: str


class DeadlineVerify(DeadlineActionBase):
    confirmed_date: str
    classification: str


@router.post("/actions/deadline/confirm")
def deadline_confirm(req: DeadlineActionBase):
    return NOT_IMPLEMENTED


@router.post("/actions/deadline/resolve")
def deadline_resolve(req: DeadlineActionBase):
    return NOT_IMPLEMENTED


@router.post("/actions/deadline/extend")
def deadline_extend(req: DeadlineExtend):
    return NOT_IMPLEMENTED


@router.post("/actions/deadline/dismiss")
def deadline_dismiss(req: DeadlineDismiss):
    return NOT_IMPLEMENTED


@router.post("/actions/deadline/verify")
def deadline_verify(req: DeadlineVerify):
    return NOT_IMPLEMENTED


# ---------------------------------------------------------------------------
# Billing actions
# ---------------------------------------------------------------------------

class BillingActionBase(BaseModel):
    firm_id: str
    attorney_id: str
    entry_id: str
    expected_status: Optional[str] = None
    idempotency_key: Optional[str] = None


class BillingUpdateNarrative(BillingActionBase):
    narrative: str


class BillingWriteDown(BillingActionBase):
    new_hours: float
    new_amount: float
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
    return NOT_IMPLEMENTED


@router.post("/actions/billing/update-narrative")
def billing_update_narrative(req: BillingUpdateNarrative):
    return NOT_IMPLEMENTED


@router.post("/actions/billing/write-down")
def billing_write_down(req: BillingWriteDown):
    return NOT_IMPLEMENTED


@router.post("/actions/billing/write-off")
def billing_write_off(req: BillingWriteOff):
    return NOT_IMPLEMENTED


@router.get("/billing/scrubber/{entry_id}")
def billing_scrubber(entry_id: str, firm_id: str):
    return {"entry_id": entry_id, "warnings": [], "clean": True, "message": "Scrubber coming Day 2"}


@router.get("/billing/budget/{client_id}")
def billing_budget(client_id: str, firm_id: str):
    return {"client_id": client_id, "message": "Budget util coming Day 2"}


@router.post("/billing/generate-invoice")
def generate_invoice(req: GenerateInvoice):
    return NOT_IMPLEMENTED


@router.get("/billing/ledes/{invoice_id}")
def get_ledes(invoice_id: str, firm_id: str):
    # STUBBED — returns fixture LEDES text (cutline decision)
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
    expected_status: Optional[str] = None
    idempotency_key: Optional[str] = None


class CommsQueue(CommsActionBase):
    channel: str = "demo_outbox"


class CommsConfirmSent(CommsActionBase):
    sent_at: str


class CommsDismiss(CommsActionBase):
    reason: str


@router.post("/actions/comms/approve")
def comms_approve(req: CommsActionBase):
    return NOT_IMPLEMENTED


@router.post("/actions/comms/queue")
def comms_queue(req: CommsQueue):
    return NOT_IMPLEMENTED


@router.post("/actions/comms/confirm-sent")
def comms_confirm_sent(req: CommsConfirmSent):
    return NOT_IMPLEMENTED


@router.post("/actions/comms/dismiss")
def comms_dismiss(req: CommsDismiss):
    return NOT_IMPLEMENTED


# ---------------------------------------------------------------------------
# Alert dismiss
# ---------------------------------------------------------------------------

class AlertDismiss(BaseModel):
    firm_id: str
    attorney_id: str
    alert_id: str
    alert_type: str
    reason: str
    idempotency_key: Optional[str] = None


@router.post("/actions/alert/dismiss")
def alert_dismiss(req: AlertDismiss):
    return NOT_IMPLEMENTED
