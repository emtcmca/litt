"""
Inbound message tool layer — create_inbound_message, snooze_inbound, dismiss_inbound.
Collection: firms/{firm_id}/inbound_messages/
All writes call log_audit_event(). Status transitions enforced via _INBOUND_TRANSITIONS.
"""

import uuid
from datetime import datetime
from typing import List, Optional, Union

from app.config import get_effective_datetime
from app.db import collection_ref
from app.models import AuditTier, InboundStatus, ToolError, ToolResult
from app.tools.audit import log_audit_event
from app.tools.validation import check_idempotency, check_optimistic_lock, register_idempotency

_INBOUND_TRANSITIONS = {
    "AWAITING_TRIAGE": ["TRIAGED", "REPLY_HELD", "SNOOZED", "DISMISSED"],
    "TRIAGED":         ["REPLY_HELD", "HANDLED", "SNOOZED", "DISMISSED"],
    "REPLY_HELD":      ["HANDLED", "DISMISSED"],
    "SNOOZED":         ["AWAITING_TRIAGE", "TRIAGED", "DISMISSED"],
    "HANDLED":         [],
    "DISMISSED":       [],
}


def _valid_inbound_transition(current: str, new: str) -> bool:
    return new in _INBOUND_TRANSITIONS.get(current, [])


def create_inbound_message(
    firm_id: str,
    from_name: str,
    from_role: str,
    received_at: datetime,
    message_excerpt: str,
    actor: str,
    idempotency_key: str,
    source_email_id: Optional[str] = None,
    matter_id: Optional[str] = None,
    client_id: Optional[str] = None,
    wait_days: int = 0,
    urgency: str = "LOW",
    urgency_signals: Optional[List[str]] = None,
    summary: Optional[str] = None,
    action_items: Optional[List[dict]] = None,
    suggested_reply_comm_id: Optional[str] = None,
    cross_agent: bool = False,
) -> Union[ToolResult, ToolError]:
    """Create a new inbound_message record in AWAITING_TRIAGE status."""
    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=existing, entity_type="inbound_message", audit_event_id=existing)

    now = get_effective_datetime()
    msg_id = f"inbound-{uuid.uuid4().hex[:10]}"

    doc = {
        "id": msg_id,
        "firm_id": firm_id,
        "source_email_id": source_email_id,
        "matter_id": matter_id,
        "client_id": client_id,
        "from_name": from_name,
        "from_role": from_role,
        "received_at": received_at,
        "wait_days": wait_days,
        "urgency": urgency,
        "urgency_signals": urgency_signals or [],
        "message_excerpt": message_excerpt,
        "summary": summary,
        "action_items": action_items or [],
        "suggested_reply_comm_id": suggested_reply_comm_id,
        "cross_agent": cross_agent,
        "status": InboundStatus.AWAITING_TRIAGE.value,
        "version": 1,
        "created_at": now,
        "updated_at": now,
    }
    collection_ref(firm_id, "inbound_messages").document(msg_id).create(doc)

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.operational,
        event_type="INBOUND_MESSAGE_CREATED",
        actor=actor,
        entity_type="inbound_message",
        entity_id=msg_id,
        after_state={
            "from_name": from_name,
            "urgency": urgency,
            "matter_id": matter_id,
        },
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, msg_id)
    return ToolResult(entity_id=msg_id, entity_type="inbound_message", audit_event_id=audit_id)


def snooze_inbound(
    firm_id: str,
    message_id: str,
    actor: str,
    idempotency_key: str,
    expected_version: int,
) -> Union[ToolResult, ToolError]:
    """Snooze an inbound message — moves it out of the active triage queue."""
    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=message_id, entity_type="inbound_message", audit_event_id=existing)

    lock_ok, data = check_optimistic_lock(firm_id, "inbound_messages", message_id, expected_version)
    if not lock_ok:
        if data is None:
            return ToolError(error_type="NOT_FOUND", message=f"inbound_message {message_id} not found")
        return ToolError(error_type="STALE_STATE", message="Version mismatch", detail={"actual": data.get("version")})

    current = data.get("status", "AWAITING_TRIAGE")
    if not _valid_inbound_transition(current, "SNOOZED"):
        return ToolError(
            error_type="INVALID_TRANSITION",
            message=f"{current} → SNOOZED is not valid",
        )

    now = get_effective_datetime()
    collection_ref(firm_id, "inbound_messages").document(message_id).update({
        "status": InboundStatus.SNOOZED.value,
        "version": expected_version + 1,
        "updated_at": now,
    })

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.operational,
        event_type="INBOUND_SNOOZED",
        actor=actor,
        entity_type="inbound_message",
        entity_id=message_id,
        before_state={"status": current},
        after_state={"status": "SNOOZED"},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, audit_id)
    return ToolResult(entity_id=message_id, entity_type="inbound_message", audit_event_id=audit_id)


def dismiss_inbound(
    firm_id: str,
    message_id: str,
    actor: str,
    idempotency_key: str,
    expected_version: int,
) -> Union[ToolResult, ToolError]:
    """Dismiss an inbound message permanently."""
    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=message_id, entity_type="inbound_message", audit_event_id=existing)

    lock_ok, data = check_optimistic_lock(firm_id, "inbound_messages", message_id, expected_version)
    if not lock_ok:
        if data is None:
            return ToolError(error_type="NOT_FOUND", message=f"inbound_message {message_id} not found")
        return ToolError(error_type="STALE_STATE", message="Version mismatch", detail={"actual": data.get("version")})

    current = data.get("status", "AWAITING_TRIAGE")
    if not _valid_inbound_transition(current, "DISMISSED"):
        return ToolError(
            error_type="INVALID_TRANSITION",
            message=f"{current} → DISMISSED is not valid",
        )

    now = get_effective_datetime()
    collection_ref(firm_id, "inbound_messages").document(message_id).update({
        "status": InboundStatus.DISMISSED.value,
        "version": expected_version + 1,
        "updated_at": now,
    })

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.operational,
        event_type="INBOUND_DISMISSED",
        actor=actor,
        entity_type="inbound_message",
        entity_id=message_id,
        before_state={"status": current},
        after_state={"status": "DISMISSED"},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, audit_id)
    return ToolResult(entity_id=message_id, entity_type="inbound_message", audit_event_id=audit_id)
