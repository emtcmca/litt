"""
Alert and escalation tool layer — dismiss_alert, log_escalation, log_anomaly.
"""

import uuid
from typing import Any, Dict, Optional, Union

from app.config import get_effective_datetime
from app.db import collection_ref
from app.models import AuditTier, EscalationStatus, EscalationType, RiskLevel, ToolError, ToolResult
from app.tools.audit import log_audit_event
from app.tools.validation import check_idempotency, register_idempotency


def dismiss_alert(
    firm_id: str,
    escalation_id: str,
    actor: str,
    reason: str,
    idempotency_key: str,
) -> Union[ToolResult, ToolError]:
    """Dismiss an escalation. reason required — no silent dismissals."""
    if not reason or not reason.strip():
        return ToolError(error_type="VALIDATION_FAILED", message="reason required to dismiss alert")

    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(entity_id=escalation_id, entity_type="escalation", audit_event_id=existing)

    doc = collection_ref(firm_id, "escalations").document(escalation_id).get()
    if not doc.exists:
        return ToolError(error_type="NOT_FOUND", message=f"escalation {escalation_id} not found")

    now = get_effective_datetime()

    collection_ref(firm_id, "escalations").document(escalation_id).update({
        "status": EscalationStatus.DISMISSED.value,
        "resolved_at": now,
        "updated_at": now,
    })

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.operational,
        event_type="ALERT_DISMISSED",
        actor=actor,
        entity_type="escalation",
        entity_id=escalation_id,
        after_state={"status": "DISMISSED", "reason": reason},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, audit_id)
    return ToolResult(entity_id=escalation_id, entity_type="escalation", audit_event_id=audit_id)


def log_escalation(
    firm_id: str,
    escalation_type: str,
    entity_id: str,
    routed_to: str,
    actor: str,
    idempotency_key: str,
    what_is_happening: str,
    why_it_matters: str,
    what_litt_has_done: str,
    what_attorney_must_decide: str,
    risk_level: str = "ROUTINE",
    matter_id: Optional[str] = None,
    priority: int = 1,
    decision_deadline: Optional[str] = None,
) -> Union[ToolResult, ToolError]:
    """Create an Escalation record with a structured brief."""
    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        # Allow re-escalation if the prior record was dismissed — the underlying issue may persist
        existing_doc = collection_ref(firm_id, "escalations").document(existing).get()
        if not (existing_doc.exists and existing_doc.to_dict().get("status") == EscalationStatus.DISMISSED.value):
            return ToolResult(entity_id=existing, entity_type="escalation", audit_event_id=existing)
        # Fall through to create a fresh PENDING escalation (overwrites idempotency key below)

    now = get_effective_datetime()
    esc_id = f"esc-{uuid.uuid4().hex[:10]}"

    brief = {
        "what_is_happening": what_is_happening,
        "why_it_matters": why_it_matters,
        "what_litt_has_done": what_litt_has_done,
        "what_attorney_must_decide": what_attorney_must_decide,
        "decision_deadline": decision_deadline,
        "risk_level": risk_level,
    }

    doc = {
        "id": esc_id,
        "firm_id": firm_id,
        "type": escalation_type,
        "matter_id": matter_id,
        "entity_id": entity_id,
        "brief": brief,
        "status": EscalationStatus.PENDING.value,
        "routed_to": routed_to,
        "priority": priority,
        "workflow_state": None,
        "workflow_status": None,
        "resolved_at": None,
        "created_at": now,
        "updated_at": now,
    }
    collection_ref(firm_id, "escalations").document(esc_id).create(doc)

    audit_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.operational,
        event_type="ESCALATION_SENT",
        actor=actor,
        entity_type="escalation",
        entity_id=esc_id,
        after_state={"type": escalation_type, "entity_id": entity_id, "risk_level": risk_level},
        idempotency_key=idempotency_key,
    )

    register_idempotency(firm_id, idempotency_key, esc_id)
    return ToolResult(entity_id=esc_id, entity_type="escalation", audit_event_id=audit_id)


def log_anomaly(
    firm_id: str,
    entry_id: str,
    anomaly_type: str,
    description: str,
    routed_to: str,
    actor: str,
    idempotency_key: str,
    matter_id: Optional[str] = None,
) -> Union[ToolResult, ToolError]:
    """
    Convenience wrapper — creates an ANOMALY escalation and logs ANOMALY_DETECTED.
    anomaly_type: e.g. "MISSING_NARRATIVE", "ROUND_HOURS_NO_SESSION"
    """
    result = log_escalation(
        firm_id=firm_id,
        escalation_type=EscalationType.ANOMALY.value,
        entity_id=entry_id,
        routed_to=routed_to,
        actor=actor,
        idempotency_key=idempotency_key,
        what_is_happening=description,
        why_it_matters="Billing anomaly may indicate an error that requires attorney review before invoicing.",
        what_litt_has_done=f"Flagged {anomaly_type} on entry {entry_id} during prebill sweep.",
        what_attorney_must_decide="Review entry and either confirm, correct, or write off.",
        risk_level=RiskLevel.ELEVATED.value,
        matter_id=matter_id,
        priority=2,
    )

    if isinstance(result, ToolResult):
        log_audit_event(
            firm_id=firm_id,
            tier=AuditTier.operational,
            event_type="ANOMALY_DETECTED",
            actor=actor,
            entity_type="time_entry",
            entity_id=entry_id,
            after_state={"anomaly_type": anomaly_type, "escalation_id": result.entity_id},
        )

    return result
