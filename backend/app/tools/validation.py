"""
Idempotency and optimistic-lock helpers shared by all tool functions.

Idempotency uses a dedicated firms/{firm_id}/idempotency_keys/{key} collection
for O(1) lookup. Note: check + register is NOT atomic — acceptable for v1.0 demo.
"""

from datetime import datetime
from typing import Optional, Tuple

from app.config import get_effective_datetime
from app.db import collection_ref


def check_idempotency(firm_id: str, idempotency_key: str) -> Optional[str]:
    """Return existing entity_id if key already processed, else None."""
    doc = collection_ref(firm_id, "idempotency_keys").document(idempotency_key).get()
    if doc.exists:
        return doc.to_dict().get("entity_id")
    return None


def register_idempotency(firm_id: str, idempotency_key: str, entity_id: str) -> None:
    """Mark idempotency key as processed. Call after successful write."""
    now = get_effective_datetime()
    collection_ref(firm_id, "idempotency_keys").document(idempotency_key).set({
        "entity_id": entity_id,
        "created_at": now,
    })


def check_optimistic_lock(
    firm_id: str,
    coll: str,
    doc_id: str,
    expected_version: int,
) -> Tuple[bool, Optional[dict]]:
    """
    Return (lock_ok, current_data).
    lock_ok=False means version mismatch — caller should return ToolError(STALE_STATE).
    """
    doc = collection_ref(firm_id, coll).document(doc_id).get()
    if not doc.exists:
        return False, None
    data = doc.to_dict()
    return data.get("version", 1) == expected_version, data
