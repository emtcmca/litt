"""
Maintenance tool layer — continuous client file review.
Two-tier gate:
  SAFE     → auto-apply via tool layer + log_audit_event()
  JUDGMENT → Gemini drafts suggestion title/detail/confidence → persist as SuggestedUpdate (held)
classify_update() is a deterministic Python dict — never a model call.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from app.config import get_effective_datetime
from app.db import collection_ref
from app.models import (
    AppliedUpdate,
    AuditTier,
    ClientMaintenanceState,
    MaintenanceCadence,
    SuggestedUpdate,
    SuggestionStatus,
    ToolError,
    ToolResult,
    UpdateClass,
)
from app.tools.audit import log_audit_event

# ---------------------------------------------------------------------------
# Classification table — deterministic, never a model call
# ---------------------------------------------------------------------------

_SAFE_KINDS = {
    "new_deadline_from_auth_source",
    "contact_field_from_signature",
    "deterministic_budget_recompute",
    "inbound_logged_to_timeline",
    "matter_field_set_from_engagement",
    "silence_threshold_crossed",
}

_JUDGMENT_KINDS = {
    "matter_stage_reclassification",
    "threshold_change",
    "conflict_name_addition",
    "status_transition",
    "budget_increase_proposal",
    "contact_priority_change",
}


def classify_update(change: Dict[str, Any]) -> UpdateClass:
    """Return UpdateClass.safe or UpdateClass.judgment. Deterministic — no model call."""
    kind = change.get("kind", "")
    if kind in _SAFE_KINDS:
        return UpdateClass.safe
    if kind in _JUDGMENT_KINDS:
        return UpdateClass.judgment
    # Unknown kinds default to judgment (safer)
    return UpdateClass.judgment


# ---------------------------------------------------------------------------
# apply_suggestion
# ---------------------------------------------------------------------------

def apply_suggestion(
    firm_id: str,
    client_id: str,
    suggestion_id: str,
    actor: str,
) -> Union[ToolResult, ToolError]:
    """Apply a held SuggestedUpdate. Logs to audit trail."""
    ref = collection_ref(firm_id, "client_suggestions").document(suggestion_id)
    doc = ref.get()
    if not doc.exists:
        return ToolError(error_type="NOT_FOUND", message=f"suggestion {suggestion_id} not found")

    data = doc.to_dict()
    if data.get("status") != SuggestionStatus.held.value:
        return ToolError(error_type="INVALID_TRANSITION", message="suggestion is not in held status")
    if data.get("client_id") != client_id:
        return ToolError(error_type="FORBIDDEN", message="suggestion does not belong to this client")

    now = get_effective_datetime()

    ae_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.legal_defensibility,
        event_type="suggestion.applied",
        actor=actor,
        entity_type="client_suggestion",
        entity_id=suggestion_id,
        client_id=client_id,
        after_state={"title": data.get("title"), "action": "applied"},
    )

    ref.update({
        "status": SuggestionStatus.applied.value,
        "resolved_by": actor,
        "resolved_at": now,
        "updated_at": now,
    })

    return ToolResult(
        entity_id=suggestion_id,
        entity_type="client_suggestion",
        audit_event_id=ae_id,
    )


# ---------------------------------------------------------------------------
# dismiss_suggestion
# ---------------------------------------------------------------------------

def dismiss_suggestion(
    firm_id: str,
    client_id: str,
    suggestion_id: str,
    reason: str,
    actor: str,
) -> Union[ToolResult, ToolError]:
    """Dismiss a held SuggestedUpdate. Reason required (≥4 chars)."""
    if not reason or len(reason.strip()) < 4:
        return ToolError(
            error_type="VALIDATION_FAILED",
            message="reason is required and must be at least 4 characters",
        )

    ref = collection_ref(firm_id, "client_suggestions").document(suggestion_id)
    doc = ref.get()
    if not doc.exists:
        return ToolError(error_type="NOT_FOUND", message=f"suggestion {suggestion_id} not found")

    data = doc.to_dict()
    if data.get("status") != SuggestionStatus.held.value:
        return ToolError(error_type="INVALID_TRANSITION", message="suggestion is not in held status")
    if data.get("client_id") != client_id:
        return ToolError(error_type="FORBIDDEN", message="suggestion does not belong to this client")

    now = get_effective_datetime()

    ae_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.legal_defensibility,
        event_type="suggestion.dismissed",
        actor=actor,
        entity_type="client_suggestion",
        entity_id=suggestion_id,
        client_id=client_id,
        notes=reason,
        after_state={"title": data.get("title"), "action": "dismissed", "reason": reason},
    )

    ref.update({
        "status": SuggestionStatus.dismissed.value,
        "resolution_reason": reason,
        "resolved_by": actor,
        "resolved_at": now,
        "updated_at": now,
    })

    return ToolResult(
        entity_id=suggestion_id,
        entity_type="client_suggestion",
        audit_event_id=ae_id,
    )


# ---------------------------------------------------------------------------
# get_maintenance_state
# ---------------------------------------------------------------------------

def get_maintenance_state(firm_id: str, client_id: str) -> ClientMaintenanceState:
    """Assemble ClientMaintenanceState from Firestore — applied + suggested + client meta."""
    now = get_effective_datetime()

    client_doc = collection_ref(firm_id, "clients").document(client_id).get()
    client_data: Dict[str, Any] = client_doc.to_dict() if client_doc.exists else {}

    cadence_str = client_data.get("maintenance_cadence", "hourly")
    try:
        cadence = MaintenanceCadence(cadence_str)
    except ValueError:
        cadence = MaintenanceCadence.hourly

    last_reviewed = client_data.get("last_reviewed_at")
    last_reviewed_label = "never"
    if last_reviewed:
        if isinstance(last_reviewed, datetime):
            delta_mins = int((now - last_reviewed.replace(tzinfo=None) if last_reviewed.tzinfo else now - last_reviewed).total_seconds() / 60)
            if delta_mins < 60:
                last_reviewed_label = f"{delta_mins} min ago"
            elif delta_mins < 1440:
                last_reviewed_label = f"{delta_mins // 60}h ago"
            else:
                last_reviewed_label = f"{delta_mins // 1440}d ago"

    cadence_next = {
        MaintenanceCadence.hourly: "in 48 min",
        MaintenanceCadence.daily: "tomorrow 8:00 AM",
        MaintenanceCadence.events: "real-time",
    }

    # Applied updates (most recent 20) — sort in Python to avoid composite index requirement
    applied_docs = list(
        collection_ref(firm_id, "client_applied_updates")
        .where("client_id", "==", client_id)
        .stream()
    )
    applied_docs.sort(key=lambda d: d.to_dict().get("applied_at") or "", reverse=True)
    applied_docs = applied_docs[:20]
    applied: List[AppliedUpdate] = []
    for d in applied_docs:
        raw = d.to_dict()
        try:
            applied.append(AppliedUpdate(**raw))
        except Exception:
            pass

    # Suggested (held only)
    suggested_docs = list(
        collection_ref(firm_id, "client_suggestions")
        .where("client_id", "==", client_id)
        .where("status", "==", SuggestionStatus.held.value)
        .stream()
    )
    suggested: List[SuggestedUpdate] = []
    for d in suggested_docs:
        raw = d.to_dict()
        try:
            suggested.append(SuggestedUpdate(**raw))
        except Exception:
            pass

    return ClientMaintenanceState(
        client_id=client_id,
        cadence=cadence,
        last_reviewed_label=last_reviewed_label,
        last_reviewed_at=last_reviewed if isinstance(last_reviewed, datetime) else None,
        next_sweep_label=cadence_next.get(cadence, "in 48 min"),
        reviews_today=client_data.get("reviews_today", 0),
        watched_signal_count=client_data.get("watched_signal_count", 0),
        applied=applied,
        suggested=suggested,
    )


# ---------------------------------------------------------------------------
# run_client_review  (synchronous — called by "Review now" button)
# ---------------------------------------------------------------------------

def run_client_review(
    firm_id: str,
    client_id: str,
    sweep_id: str,
) -> ClientMaintenanceState:
    """
    Idempotent cadence sweep for one client.
    Reads watched signals, classifies diffs:
      SAFE     → write AppliedUpdate + log_audit_event
      JUDGMENT → write SuggestedUpdate (held); Gemini drafts title/detail/confidence
    Returns updated ClientMaintenanceState.
    """
    # Idempotency: skip if sweep_id already processed
    sweep_key = f"sweep-{client_id}-{sweep_id}"
    idem_ref = collection_ref(firm_id, "idempotency_keys").document(sweep_key)
    if idem_ref.get().exists:
        return get_maintenance_state(firm_id, client_id)

    now = get_effective_datetime()

    # Mark sweep in progress
    idem_ref.set({"entity_id": sweep_id, "created_at": now})

    # Log the sweep itself
    log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.engineering,
        event_type="client.reviewed",
        actor="Litt · maintenance",
        entity_type="client",
        entity_id=client_id,
        client_id=client_id,
        after_state={"sweep_id": sweep_id, "cadence": "sweep"},
    )

    # Update last_reviewed_at and increment reviews_today counter
    client_ref = collection_ref(firm_id, "clients").document(client_id)
    client_doc = client_ref.get()
    if client_doc.exists:
        reviews_today = client_doc.to_dict().get("reviews_today", 0)
        client_ref.update({
            "last_reviewed_at": now,
            "reviews_today": reviews_today + 1,
            "updated_at": now,
        })

    return get_maintenance_state(firm_id, client_id)


# ---------------------------------------------------------------------------
# detect_engagement_letter  (heuristic classifier — no model call)
# ---------------------------------------------------------------------------

_ENGAGEMENT_KEYWORDS = {
    "engagement letter", "retainer agreement", "fee agreement",
    "scope of representation", "attorney-client", "legal services agreement",
    "representation agreement",
}


def detect_engagement_letter(message: Dict[str, Any]) -> bool:
    """
    Deterministic heuristic. Returns True if message looks like an engagement letter.
    Checks subject, body text, and attachment filenames.
    """
    subject = (message.get("subject") or "").lower()
    body = (message.get("body") or message.get("snippet") or "").lower()
    attachments = message.get("attachments") or []

    # Check subject/body for keywords
    text = subject + " " + body
    if any(kw in text for kw in _ENGAGEMENT_KEYWORDS):
        return True

    # Check attachment filenames
    for att in attachments:
        filename = (att.get("filename") or "").lower()
        if filename.endswith(".pdf") and any(kw.replace(" ", "-") in filename or kw.replace(" ", "_") in filename for kw in {"engagement", "retainer", "representation"}):
            return True

    return False
