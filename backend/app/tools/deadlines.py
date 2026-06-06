"""
Deadline tool layer — log_deadline_event, verify_deadline, supersede_deadline.
deadline_events is CREATE-only (append-only). Never update or delete.
"""

import uuid
from datetime import datetime
from typing import Optional, Union

from app.config import get_effective_datetime
from app.db import collection_ref
from app.models import AuditTier, DeadlineEventType, ToolError, ToolResult, VerificationStatus
from app.tools.audit import log_audit_event
from app.tools.validation import check_idempotency, check_optimistic_lock, register_idempotency


def log_deadline_event(
    firm_id: str,
    deadline_id: str,
    event_type: str,
    actor: str,
    idempotency_key: str,
    escalation_level: Optional[str] = None,
    attorney_id: Optional[str] = None,
    response: Optional[str] = None,
    dismissal_reason: Optional[str] = None,
    notes: Optional[str] = None,
) -> Union[ToolResult, ToolError]:
    """Append a deadline event. CREATE-only — never updates existing events."""
    if event_type == DeadlineEventType.DISMISSED_WITH_REASON and not dismissal_reason:
        return ToolError(
            error_type="VALIDATION_FAILED",
            message="dismissal_reason required for DISMISSED_WITH_REASON events",
        )

    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=existing, entity_type="deadline_event", audit_event_id=existing)

    # Verify deadline exists
    dl_doc = collection_ref(firm_id, "deadlines").document(deadline_id).get()
    if not dl_doc.exists:
        return ToolError(error_type="NOT_FOUND", message=f"deadline {deadline_id} not found")

    now = get_effective_datetime()
    event_id = f"dle-{uuid.uuid4().hex[:10]}"

    event_type_val = event_type if isinstance(event_type, str) else event_type.value

    doc = {
        "id": event_id,
        "firm_id": firm_id,
        "deadline_id": deadline_id,
        "event_type": event_type_val,
        "escalation_level": escalation_level,
        "attorney_id": attorney_id,
        "response": response,
        "dismissal_reason": dismissal_reason,
        "notes": notes,
        "created_at": now,
        "updated_at": now,
    }
    collection_ref(firm_id, "deadline_events").document(event_id).create(doc)

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.legal_defensibility,
        event_type="ESCALATION_SENT" if event_type_val == "ESCALATION_SENT" else "DEADLINE_CONFIRMED",
        actor=actor,
        entity_type="deadline_event",
        entity_id=event_id,
        after_state={"deadline_id": deadline_id, "event_type": event_type_val},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, event_id)
    return ToolResult(entity_id=event_id, entity_type="deadline_event", audit_event_id=audit_id)


def verify_deadline(
    firm_id: str,
    deadline_id: str,
    attorney_id: str,
    idempotency_key: str,
    expected_version: int,
    verification_status: str = VerificationStatus.attorney_verified.value,
) -> Union[ToolResult, ToolError]:
    """
    Update deadline verification_status. Default: attorney_verified.
    Pass verification_status=VerificationStatus.pending_verification.value to
    advance conflict_flagged deadlines to the intermediate pending_verification state
    (used by DeadlineAgent when Gemini extraction confidence >= 0.80).
    """
    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=deadline_id, entity_type="deadline", audit_event_id=existing)

    lock_ok, data = check_optimistic_lock(firm_id, "deadlines", deadline_id, expected_version)
    if not lock_ok:
        if data is None:
            return ToolError(error_type="NOT_FOUND", message=f"deadline {deadline_id} not found")
        return ToolError(error_type="STALE_STATE", message="Version mismatch", detail={"actual": data.get("version")})

    now = get_effective_datetime()

    collection_ref(firm_id, "deadlines").document(deadline_id).update({
        "verification_status": verification_status,
        "verified_by": attorney_id,
        "version": expected_version + 1,
        "updated_at": now,
    })

    event_type = (
        DeadlineEventType.VERIFICATION_COMPLETED.value
        if verification_status == VerificationStatus.attorney_verified.value
        else "VERIFICATION_PENDING"
    )

    dl_event_result = log_deadline_event(
        firm_id=firm_id,
        deadline_id=deadline_id,
        event_type=event_type,
        actor=attorney_id,
        idempotency_key=f"{idempotency_key}-evt",
        attorney_id=attorney_id,
    )

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.legal_defensibility,
        event_type="DEADLINE_VERIFIED",
        actor=attorney_id,
        entity_type="deadline",
        entity_id=deadline_id,
        before_state={"verification_status": data.get("verification_status")},
        after_state={"verification_status": verification_status},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, audit_id)
    return ToolResult(entity_id=deadline_id, entity_type="deadline", audit_event_id=audit_id)


def confirm_deadline(
    firm_id: str,
    deadline_id: str,
    attorney_id: str,
    idempotency_key: str,
    expected_version: int,
) -> Union[ToolResult, ToolError]:
    """Attorney confirms the deadline is on track. Updates last_confirmed_by/at."""
    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=deadline_id, entity_type="deadline", audit_event_id=existing)

    lock_ok, data = check_optimistic_lock(firm_id, "deadlines", deadline_id, expected_version)
    if not lock_ok:
        if data is None:
            return ToolError(error_type="NOT_FOUND", message=f"deadline {deadline_id} not found")
        return ToolError(error_type="STALE_STATE", message="Version mismatch", detail={"actual": data.get("version")})

    now = get_effective_datetime()
    collection_ref(firm_id, "deadlines").document(deadline_id).update({
        "last_confirmed_by": attorney_id,
        "last_confirmed_at": now,
        "version": expected_version + 1,
        "updated_at": now,
    })

    log_deadline_event(
        firm_id=firm_id,
        deadline_id=deadline_id,
        event_type=DeadlineEventType.ATTORNEY_CONFIRMED.value,
        actor=attorney_id,
        idempotency_key=f"{idempotency_key}-evt",
        attorney_id=attorney_id,
    )

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.legal_defensibility,
        event_type="DEADLINE_CONFIRMED",
        actor=attorney_id,
        entity_type="deadline",
        entity_id=deadline_id,
        after_state={"last_confirmed_by": attorney_id},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, audit_id)
    return ToolResult(entity_id=deadline_id, entity_type="deadline", audit_event_id=audit_id)


def resolve_deadline(
    firm_id: str,
    deadline_id: str,
    attorney_id: str,
    idempotency_key: str,
    expected_version: int,
) -> Union[ToolResult, ToolError]:
    """Mark deadline as RESOLVED. Logs ATTORNEY_RESOLVED event."""
    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=deadline_id, entity_type="deadline", audit_event_id=existing)

    lock_ok, data = check_optimistic_lock(firm_id, "deadlines", deadline_id, expected_version)
    if not lock_ok:
        if data is None:
            return ToolError(error_type="NOT_FOUND", message=f"deadline {deadline_id} not found")
        return ToolError(error_type="STALE_STATE", message="Version mismatch", detail={"actual": data.get("version")})

    now = get_effective_datetime()
    collection_ref(firm_id, "deadlines").document(deadline_id).update({
        "status": "RESOLVED",
        "version": expected_version + 1,
        "updated_at": now,
    })

    log_deadline_event(
        firm_id=firm_id,
        deadline_id=deadline_id,
        event_type=DeadlineEventType.ATTORNEY_RESOLVED.value,
        actor=attorney_id,
        idempotency_key=f"{idempotency_key}-evt",
        attorney_id=attorney_id,
    )

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.legal_defensibility,
        event_type="DEADLINE_RESOLVED",
        actor=attorney_id,
        entity_type="deadline",
        entity_id=deadline_id,
        before_state={"status": data.get("status")},
        after_state={"status": "RESOLVED"},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, audit_id)
    return ToolResult(entity_id=deadline_id, entity_type="deadline", audit_event_id=audit_id)


def dismiss_deadline(
    firm_id: str,
    deadline_id: str,
    attorney_id: str,
    reason: str,
    idempotency_key: str,
    expected_version: int,
) -> Union[ToolResult, ToolError]:
    """Dismiss deadline with required reason. Logs DISMISSED_WITH_REASON event."""
    if not reason or not reason.strip():
        return ToolError(error_type="VALIDATION_FAILED", message="reason required for deadline dismissal")

    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=deadline_id, entity_type="deadline", audit_event_id=existing)

    lock_ok, data = check_optimistic_lock(firm_id, "deadlines", deadline_id, expected_version)
    if not lock_ok:
        if data is None:
            return ToolError(error_type="NOT_FOUND", message=f"deadline {deadline_id} not found")
        return ToolError(error_type="STALE_STATE", message="Version mismatch", detail={"actual": data.get("version")})

    now = get_effective_datetime()
    collection_ref(firm_id, "deadlines").document(deadline_id).update({
        "status": "DISMISSED",
        "version": expected_version + 1,
        "updated_at": now,
    })

    log_deadline_event(
        firm_id=firm_id,
        deadline_id=deadline_id,
        event_type=DeadlineEventType.DISMISSED_WITH_REASON.value,
        actor=attorney_id,
        idempotency_key=f"{idempotency_key}-evt",
        attorney_id=attorney_id,
        dismissal_reason=reason,
    )

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.legal_defensibility,
        event_type="DEADLINE_DISMISSED",
        actor=attorney_id,
        entity_type="deadline",
        entity_id=deadline_id,
        before_state={"status": data.get("status")},
        after_state={"status": "DISMISSED", "reason": reason},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, audit_id)
    return ToolResult(entity_id=deadline_id, entity_type="deadline", audit_event_id=audit_id)


def supersede_deadline(
    firm_id: str,
    old_deadline_id: str,
    new_deadline_id: str,
    actor: str,
    idempotency_key: str,
    expected_version: int,
) -> Union[ToolResult, ToolError]:
    """Mark old deadline as SUPERSEDED and link to the replacement deadline."""
    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=old_deadline_id, entity_type="deadline", audit_event_id=existing)

    lock_ok, data = check_optimistic_lock(firm_id, "deadlines", old_deadline_id, expected_version)
    if not lock_ok:
        if data is None:
            return ToolError(error_type="NOT_FOUND", message=f"deadline {old_deadline_id} not found")
        return ToolError(error_type="STALE_STATE", message="Version mismatch", detail={"actual": data.get("version")})

    now = get_effective_datetime()

    collection_ref(firm_id, "deadlines").document(old_deadline_id).update({
        "status": "SUPERSEDED",
        "supersedes_deadline_id": new_deadline_id,
        "version": expected_version + 1,
        "updated_at": now,
    })

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.legal_defensibility,
        event_type="DEADLINE_RESOLVED",
        actor=actor,
        entity_type="deadline",
        entity_id=old_deadline_id,
        before_state={"status": data.get("status")},
        after_state={"status": "SUPERSEDED", "superseded_by": new_deadline_id},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, audit_id)
    return ToolResult(entity_id=old_deadline_id, entity_type="deadline", audit_event_id=audit_id)
