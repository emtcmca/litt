"""
Client communications tool layer.

CRITICAL: Only log_client_comm_sent() updates last_client_contact.
approve_client_comm_draft() and queue_client_comm_for_delivery() do NOT.
"""

import re as _re
import uuid
from typing import List, Optional, Union

from app.config import get_effective_datetime
from app.db import collection_ref
from app.models import AuditTier, CommStatus, ToolError, ToolResult
from app.tools.audit import log_audit_event
from app.tools.validation import check_idempotency, check_optimistic_lock, register_idempotency

# Valid status transitions for client_communications
_COMM_TRANSITIONS = {
    "DRAFT_GENERATED":      ["DRAFT_APPROVED", "DISMISSED_WITH_REASON"],
    "DRAFT_APPROVED":       ["QUEUED_FOR_SEND", "DISMISSED_WITH_REASON"],
    "QUEUED_FOR_SEND":      ["SENT_CONFIRMED", "DISMISSED_WITH_REASON"],
    "SENT_CONFIRMED":       [],
    "DISMISSED_WITH_REASON": [],
}


def _check_comm_transition(current: str, new: str) -> bool:
    return new in _COMM_TRANSITIONS.get(current, [])


def _strip_citations(text: str) -> str:
    """Remove [f1], [f2], etc. citation markers from draft body."""
    return _re.sub(r"\[f\d+\]", "", text).strip()


def create_client_comm(
    firm_id: str,
    matter_id: str,
    client_id: str,
    trigger: str,
    draft_body: str,
    source_map: List[dict],
    actor: str,
    idempotency_key: str,
    draft_body_clean: Optional[str] = None,
) -> Union[ToolResult, ToolError]:
    """Create a new client_communication record in DRAFT_GENERATED status.
    draft_body_clean: citation-stripped version; auto-generated from draft_body if not provided.
    """
    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=existing, entity_type="client_communication", audit_event_id=existing)

    now = get_effective_datetime()
    comm_id = f"comm-{uuid.uuid4().hex[:10]}"
    clean = draft_body_clean if draft_body_clean is not None else _strip_citations(draft_body)

    doc = {
        "id": comm_id,
        "firm_id": firm_id,
        "matter_id": matter_id,
        "client_id": client_id,
        "trigger": trigger,
        "draft_body": draft_body,
        "draft_body_clean": clean,
        "source_map": source_map,
        "status": CommStatus.DRAFT_GENERATED.value,
        "approved_by": None,
        "approved_at": None,
        "queued_at": None,
        "sent_confirmed_at": None,
        "dismissal_reason": None,
        "version": 1,
        "created_at": now,
        "updated_at": now,
    }
    collection_ref(firm_id, "client_communications").document(comm_id).create(doc)

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.operational,
        event_type="COMM_DRAFT_CREATED",
        actor=actor,
        entity_type="client_communication",
        entity_id=comm_id,
        after_state={"matter_id": matter_id, "client_id": client_id, "trigger": trigger},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, comm_id)
    return ToolResult(entity_id=comm_id, entity_type="client_communication", audit_event_id=audit_id)


def dismiss_comm(
    firm_id: str,
    comm_id: str,
    attorney_id: str,
    reason: str,
    idempotency_key: str,
    expected_version: int,
) -> Union[ToolResult, ToolError]:
    """Dismiss a communication draft. reason required."""
    if not reason or not reason.strip():
        return ToolError(error_type="VALIDATION_FAILED", message="reason required to dismiss communication")

    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=comm_id, entity_type="client_communication", audit_event_id=existing)

    lock_ok, data = check_optimistic_lock(firm_id, "client_communications", comm_id, expected_version)
    if not lock_ok:
        if data is None:
            return ToolError(error_type="NOT_FOUND", message=f"comm {comm_id} not found")
        return ToolError(error_type="STALE_STATE", message="Version mismatch", detail={"actual": data.get("version")})

    current_status = data.get("status", "DRAFT_GENERATED")
    if not _check_comm_transition(current_status, "DISMISSED_WITH_REASON"):
        return ToolError(
            error_type="INVALID_TRANSITION",
            message=f"{current_status} → DISMISSED_WITH_REASON is not valid",
        )

    now = get_effective_datetime()
    collection_ref(firm_id, "client_communications").document(comm_id).update({
        "status": CommStatus.DISMISSED_WITH_REASON.value,
        "dismissal_reason": reason,
        "version": expected_version + 1,
        "updated_at": now,
    })

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.operational,
        event_type="COMM_DISMISSED",
        actor=attorney_id,
        entity_type="client_communication",
        entity_id=comm_id,
        before_state={"status": current_status},
        after_state={"status": "DISMISSED_WITH_REASON", "reason": reason},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, audit_id)
    return ToolResult(entity_id=comm_id, entity_type="client_communication", audit_event_id=audit_id)


def approve_client_comm_draft(
    firm_id: str,
    comm_id: str,
    attorney_id: str,
    idempotency_key: str,
    expected_version: int,
) -> Union[ToolResult, ToolError]:
    """Advance comm from DRAFT_GENERATED to DRAFT_APPROVED. Does NOT touch last_client_contact."""
    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=comm_id, entity_type="client_communication", audit_event_id=existing)

    lock_ok, data = check_optimistic_lock(firm_id, "client_communications", comm_id, expected_version)
    if not lock_ok:
        if data is None:
            return ToolError(error_type="NOT_FOUND", message=f"comm {comm_id} not found")
        return ToolError(error_type="STALE_STATE", message="Version mismatch", detail={"actual": data.get("version")})

    current_status = data.get("status", "DRAFT_GENERATED")
    if not _check_comm_transition(current_status, "DRAFT_APPROVED"):
        return ToolError(
            error_type="INVALID_TRANSITION",
            message=f"{current_status} → DRAFT_APPROVED is not valid",
        )

    now = get_effective_datetime()

    collection_ref(firm_id, "client_communications").document(comm_id).update({
        "status": CommStatus.DRAFT_APPROVED.value,
        "approved_by": attorney_id,
        "approved_at": now,
        "version": expected_version + 1,
        "updated_at": now,
    })

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.operational,
        event_type="COMM_DRAFT_APPROVED",
        actor=attorney_id,
        entity_type="client_communication",
        entity_id=comm_id,
        before_state={"status": current_status},
        after_state={"status": "DRAFT_APPROVED", "approved_by": attorney_id},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, audit_id)
    return ToolResult(entity_id=comm_id, entity_type="client_communication", audit_event_id=audit_id)


def queue_client_comm_for_delivery(
    firm_id: str,
    comm_id: str,
    attorney_id: str,
    idempotency_key: str,
    expected_version: int,
) -> Union[ToolResult, ToolError]:
    """Advance comm to QUEUED_FOR_SEND. Does NOT touch last_client_contact."""
    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=comm_id, entity_type="client_communication", audit_event_id=existing)

    lock_ok, data = check_optimistic_lock(firm_id, "client_communications", comm_id, expected_version)
    if not lock_ok:
        if data is None:
            return ToolError(error_type="NOT_FOUND", message=f"comm {comm_id} not found")
        return ToolError(error_type="STALE_STATE", message="Version mismatch", detail={"actual": data.get("version")})

    current_status = data.get("status", "DRAFT_GENERATED")
    if not _check_comm_transition(current_status, "QUEUED_FOR_SEND"):
        return ToolError(
            error_type="INVALID_TRANSITION",
            message=f"{current_status} → QUEUED_FOR_SEND is not valid",
        )

    now = get_effective_datetime()

    collection_ref(firm_id, "client_communications").document(comm_id).update({
        "status": CommStatus.QUEUED_FOR_SEND.value,
        "queued_at": now,
        "version": expected_version + 1,
        "updated_at": now,
    })

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.operational,
        event_type="COMM_QUEUED",
        actor=attorney_id,
        entity_type="client_communication",
        entity_id=comm_id,
        before_state={"status": current_status},
        after_state={"status": "QUEUED_FOR_SEND"},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, audit_id)
    return ToolResult(entity_id=comm_id, entity_type="client_communication", audit_event_id=audit_id)


def log_client_comm_sent(
    firm_id: str,
    comm_id: str,
    actor: str,
    idempotency_key: str,
    expected_version: int,
) -> Union[ToolResult, ToolError]:
    """
    Advance comm to SENT_CONFIRMED.
    ONLY THIS FUNCTION updates last_client_contact on the matter record.
    """
    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=comm_id, entity_type="client_communication", audit_event_id=existing)

    lock_ok, data = check_optimistic_lock(firm_id, "client_communications", comm_id, expected_version)
    if not lock_ok:
        if data is None:
            return ToolError(error_type="NOT_FOUND", message=f"comm {comm_id} not found")
        return ToolError(error_type="STALE_STATE", message="Version mismatch", detail={"actual": data.get("version")})

    current_status = data.get("status", "QUEUED_FOR_SEND")
    if not _check_comm_transition(current_status, "SENT_CONFIRMED"):
        return ToolError(
            error_type="INVALID_TRANSITION",
            message=f"{current_status} → SENT_CONFIRMED is not valid",
        )

    now = get_effective_datetime()
    matter_id = data.get("matter_id")
    client_id = data.get("client_id")

    collection_ref(firm_id, "client_communications").document(comm_id).update({
        "status": CommStatus.SENT_CONFIRMED.value,
        "sent_confirmed_at": now,
        "version": expected_version + 1,
        "updated_at": now,
    })

    # Update last_client_contact on matter AND client records
    if matter_id:
        collection_ref(firm_id, "matters").document(matter_id).update({
            "last_client_contact": now,
            "updated_at": now,
        })
    if client_id:
        collection_ref(firm_id, "clients").document(client_id).update({
            "last_client_contact": now,
            "updated_at": now,
        })

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.legal_defensibility,
        event_type="COMM_SENT_CONFIRMED",
        actor=actor,
        entity_type="client_communication",
        entity_id=comm_id,
        before_state={"status": current_status},
        after_state={"status": "SENT_CONFIRMED", "sent_confirmed_at": now.isoformat()},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, audit_id)
    return ToolResult(entity_id=comm_id, entity_type="client_communication", audit_event_id=audit_id)
