"""
log_audit_event() — the only function all other tools call first.
CREATE-only. Never update or delete audit records.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from app.config import get_effective_datetime
from app.db import collection_ref
from app.models import AuditTier


def log_audit_event(
    firm_id: str,
    tier: AuditTier,
    event_type: str,
    actor: str,
    entity_type: str,
    entity_id: str,
    before_state: Optional[Dict[str, Any]] = None,
    after_state: Optional[Dict[str, Any]] = None,
    idempotency_key: Optional[str] = None,
    notes: Optional[str] = None,
    observation_id: Optional[str] = None,
    run_id: Optional[str] = None,
) -> str:
    """Write a CREATE-only audit event. Returns the new audit event ID."""
    now = get_effective_datetime()
    event_id = f"ae-{uuid.uuid4().hex[:12]}"

    tier_val = tier if isinstance(tier, str) else tier.value

    doc = {
        "id": event_id,
        "firm_id": firm_id,
        "tier": tier_val,
        "event_type": event_type,
        "actor": actor,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "before_state": before_state,
        "after_state": after_state,
        "idempotency_key": idempotency_key,
        "notes": notes,
        "observation_id": observation_id,
        "run_id": run_id,
        "created_at": now,
        "updated_at": now,
    }

    collection_ref(firm_id, "audit_log").document(event_id).create(doc)
    return event_id
