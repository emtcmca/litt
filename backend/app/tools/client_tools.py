"""
Client tool layer — create_client, create_matter, get_clients.
Only write path to clients/ and matters/ collections.
Every write calls log_audit_event().
"""

import re
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union

from app.config import get_effective_datetime
from app.db import collection_ref
from app.models import (
    AuditTier,
    ClientCreateRequest,
    ClientListItem,
    MatterCreateRequest,
    MatterStatus,
    MatterType,
    ToolError,
    ToolResult,
)
from app.tools.audit import log_audit_event
from app.tools.validation import check_idempotency, register_idempotency


def _slugify(name: str) -> str:
    """'Mercer Industries' → 'mercer-industries'"""
    s = name.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s.strip("-")


def _fs_safe(val: Any) -> Any:
    """Firestore-safe conversion: Decimal→float, datetime stays as-is."""
    if isinstance(val, Decimal):
        return float(val)
    return val


def create_client(
    req: ClientCreateRequest,
    idempotency_key: str,
) -> Union[ToolResult, ToolError]:
    """Create a Client document. Idempotent — second call with same key returns existing."""
    firm_id = req.firm_id
    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(
            entity_id=existing,
            entity_type="client",
            audit_event_id="",
            data={"idempotency_hit": True},
        )

    client_id = _slugify(req.client_name)
    now = get_effective_datetime()

    doc: Dict[str, Any] = {
        "id": client_id,
        "firm_id": firm_id,
        "name": req.client_name,
        "billing_contact": req.primary_contact_name,
        "billing_email": req.primary_contact_email,
        "billing_address": "",
        "arrangement": req.billing_type,
        "budget_cap": req.budget_cap,
        "budget_billed": 0.0,
        "retainer_balance": None,
        "retainer_refill_threshold": None,
        "ledes_client_id": client_id,
        "client_matter_id_prefix": client_id[:4].upper(),
        "last_client_contact": None,
        "client_silence_threshold_days": req.silence_threshold_days,
        "notes": req.notes,
        # Client module fields
        "client_type": req.client_type,
        "client_status": "active",
        "primary_contact_name": req.primary_contact_name,
        "primary_contact_phone": req.primary_contact_phone,
        "originating_attorney_id": req.responsible_attorney_id,
        "responsible_attorney_id": req.responsible_attorney_id,
        "engagement_letter_ref": req.engagement_letter_ref,
        "conflict_check_names": req.conflict_check_names,
        "conflict_check_date": None,
        "conflict_check_cleared": False,
        "maintenance_cadence": "hourly",
        "last_reviewed_at": None,
        "watched_signal_count": 0,
        "created_at": now,
        "updated_at": now,
    }

    collection_ref(firm_id, "clients").document(client_id).create(doc)

    ae_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.legal_defensibility,
        event_type="client.created",
        actor=req.responsible_attorney_id,
        entity_type="client",
        entity_id=client_id,
        client_id=client_id,
        after_state={"name": req.client_name, "engagement_type": req.engagement_type},
    )

    register_idempotency(firm_id, idempotency_key, client_id)

    return ToolResult(
        entity_id=client_id,
        entity_type="client",
        audit_event_id=ae_id,
    )


def create_matter(
    firm_id: str,
    client_id: str,
    req: MatterCreateRequest,
    responsible_attorney_id: str,
    idempotency_key: str,
) -> Union[ToolResult, ToolError]:
    """Create a Matter document linked to an existing client."""
    existing = check_idempotency(firm_id, idempotency_key)
    if existing:
        return ToolResult(
            entity_id=existing,
            entity_type="matter",
            audit_event_id="",
            data={"idempotency_hit": True},
        )

    matter_id = f"{client_id}-{_slugify(req.matter_name)}"[:64]
    now = get_effective_datetime()

    # Validate matter_type
    try:
        matter_type_val = MatterType(req.matter_type).value
    except ValueError:
        matter_type_val = "advisory"

    doc: Dict[str, Any] = {
        "id": matter_id,
        "firm_id": firm_id,
        "client_id": client_id,
        "client_matter_id": f"{client_id[:4].upper()}-001",
        "law_firm_matter_id": f"LF-{client_id[:4].upper()}-001",
        "name": req.matter_name,
        "type": matter_type_val,
        "status": MatterStatus.ACTIVE.value,
        "assigned_attorneys": [responsible_attorney_id],
        "opened_at": now,
        "last_activity": now,
        "last_client_contact": None,
        # Litigation fields
        "opposing_counsel": req.opposing_counsel,
        "court": req.court,
        "jurisdiction": None,
        "case_number": req.case_number,
        "expected_resolution": req.expected_resolution,
        "matter_budget_cap": None,
        "created_at": now,
        "updated_at": now,
    }

    collection_ref(firm_id, "matters").document(matter_id).create(doc)

    ae_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.legal_defensibility,
        event_type="matter.created",
        actor=responsible_attorney_id,
        entity_type="matter",
        entity_id=matter_id,
        client_id=client_id,
        after_state={"name": req.matter_name, "type": matter_type_val},
    )

    register_idempotency(firm_id, idempotency_key, matter_id)

    return ToolResult(
        entity_id=matter_id,
        entity_type="matter",
        audit_event_id=ae_id,
    )


def get_clients(firm_id: str) -> List[ClientListItem]:
    """
    Read all clients for a firm and assemble ClientListItem roster rows.
    Sorted: pending_item_count DESC, budget_utilization_pct DESC.
    """
    from app.config import get_effective_datetime as _now_fn

    now = _now_fn()

    clients_docs = list(collection_ref(firm_id, "clients").stream())
    matters_docs = list(collection_ref(firm_id, "matters").stream())
    suggestions_docs = list(collection_ref(firm_id, "client_suggestions").stream())

    # Build lookup: client_id → list of matters
    matters_by_client: Dict[str, List[dict]] = {}
    for m in matters_docs:
        d = m.to_dict()
        cid = d.get("client_id", "")
        matters_by_client.setdefault(cid, []).append(d)

    # Build lookup: client_id → held suggestion count
    held_by_client: Dict[str, int] = {}
    for s in suggestions_docs:
        d = s.to_dict()
        if d.get("status") == "held":
            cid = d.get("client_id", "")
            held_by_client[cid] = held_by_client.get(cid, 0) + 1

    # Fetch attorneys once for rate lookup
    attorneys: Dict[str, dict] = {}
    try:
        for a in collection_ref(firm_id, "attorneys").stream():
            d = a.to_dict()
            attorneys[d["id"]] = d
    except Exception:
        pass

    items: List[ClientListItem] = []
    for doc in clients_docs:
        c = doc.to_dict()
        cid = c.get("id", "")
        client_matters = matters_by_client.get(cid, [])
        primary_matter = client_matters[0] if client_matters else {}

        budget_cap = c.get("budget_cap")
        budget_billed = c.get("budget_billed", 0.0) or 0.0
        budget_pct: Optional[float] = None
        if budget_cap and float(budget_cap) > 0:
            budget_pct = round(float(budget_billed) / float(budget_cap) * 100, 1)

        # Days since contact
        last_contact = c.get("last_client_contact")
        days_since: Optional[int] = None
        contact_label: Optional[str] = None
        if last_contact:
            if isinstance(last_contact, datetime):
                delta = now - last_contact.replace(tzinfo=None) if last_contact.tzinfo else now - last_contact
            else:
                delta = now - last_contact
            days_since = max(0, delta.days)
            contact_label = f"Jun {last_contact.day}" if hasattr(last_contact, "day") else str(last_contact)[:10]

        # Rate from responsible attorney
        rate: Optional[float] = None
        resp_attorney_id = c.get("responsible_attorney_id", "")
        if resp_attorney_id and resp_attorney_id in attorneys:
            rate_val = attorneys[resp_attorney_id].get("default_rate")
            if rate_val is not None:
                rate = float(rate_val)

        # Last reviewed label
        last_reviewed = c.get("last_reviewed_at")
        reviewed_label: Optional[str] = None
        if last_reviewed:
            if isinstance(last_reviewed, datetime):
                delta_mins = int((now - last_reviewed.replace(tzinfo=None) if last_reviewed.tzinfo else now - last_reviewed).total_seconds() / 60)
                if delta_mins < 60:
                    reviewed_label = f"{delta_mins} min ago"
                elif delta_mins < 1440:
                    reviewed_label = f"{delta_mins // 60}h ago"
                else:
                    reviewed_label = f"{delta_mins // 1440}d ago"

        # Matter short name (trim to 30 chars)
        matter_name = primary_matter.get("name", "")
        matter_short = (matter_name[:28] + "…") if len(matter_name) > 30 else matter_name

        engagement = primary_matter.get("type", c.get("arrangement", ""))

        items.append(ClientListItem(
            client_id=cid,
            client_name=c.get("name", ""),
            client_type=c.get("client_type", "entity"),
            client_status=c.get("client_status", "active"),
            engagement=engagement,
            matter_short=matter_short,
            rate=rate,
            billing=c.get("arrangement", "hourly"),
            matter_count=len(client_matters),
            pending_item_count=c.get("pending_item_count", 0),
            budget_utilization_pct=budget_pct,
            budget_used=float(budget_billed) if budget_billed else None,
            budget_cap_val=float(budget_cap) if budget_cap else None,
            days_since_contact=days_since,
            last_contact_label=contact_label,
            last_reviewed_label=reviewed_label,
            held_suggestion_count=held_by_client.get(cid, 0),
        ))

    # Sort: pending_item_count DESC, budget_utilization_pct DESC
    items.sort(key=lambda x: (-(x.pending_item_count or 0), -(x.budget_utilization_pct or 0)))
    return items
