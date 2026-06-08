"""
Client module routes.
All 11 endpoints: CRUD, extract, pending, maintenance, suggestions, cadence.
"""

import base64
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from app.config import get_effective_datetime
from app.db import collection_ref
from app.models import (
    AuditTier,
    ClientCreateRequest,
    ClientListItem,
    ClientMaintenanceState,
    ExtractionResult,
    MatterCreateRequest,
    PendingClient,
    PendingClientStatus,
    SuggestionStatus,
    ToolError,
)
from app.tools.audit import log_audit_event
from app.tools.client_tools import create_client, create_matter, get_clients
from app.tools.maintenance_tools import (
    apply_suggestion,
    dismiss_suggestion,
    get_maintenance_state,
    run_client_review,
)

router = APIRouter()

FIRM_DEFAULT = "strand-okafor"
ATTORNEY_DEFAULT = "dana-strand"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ts(val: Any) -> Optional[str]:
    """Normalise Firestore timestamp / datetime → ISO string."""
    if val is None:
        return None
    if hasattr(val, "timestamp"):
        return datetime.fromtimestamp(val.timestamp(), tz=timezone.utc).isoformat()
    if isinstance(val, datetime):
        return val.isoformat()
    return str(val)


# ---------------------------------------------------------------------------
# Request/response bodies
# ---------------------------------------------------------------------------

class ClientCreateBody(BaseModel):
    firm_id: str = FIRM_DEFAULT
    client_name: str
    client_type: str = "entity"
    primary_contact_name: str
    primary_contact_email: str
    primary_contact_phone: str = ""
    billing_rate: float
    billing_type: str = "hourly"
    billing_cycle: str = "monthly"
    payment_terms: str = "net_30"
    engagement_type: str
    date_engaged: str
    engagement_letter_ref: Optional[str] = None
    responsible_attorney_id: str = ATTORNEY_DEFAULT
    conflict_check_names: List[str] = []
    silence_threshold_days: int = 14
    budget_cap: Optional[float] = None
    notes: Optional[str] = None
    first_matter: MatterCreateRequest


class CadenceBody(BaseModel):
    cadence: str
    firm_id: str = FIRM_DEFAULT


class ActionBody(BaseModel):
    actor: str = ATTORNEY_DEFAULT
    firm_id: str = FIRM_DEFAULT


class DismissBody(BaseModel):
    reason: str
    actor: str = ATTORNEY_DEFAULT
    firm_id: str = FIRM_DEFAULT


class ConfirmPendingBody(BaseModel):
    firm_id: str = FIRM_DEFAULT
    responsible_attorney_id: str = ATTORNEY_DEFAULT
    edits: Optional[Dict[str, Any]] = None


class DiscardPendingBody(BaseModel):
    reason: str
    firm_id: str = FIRM_DEFAULT


# ---------------------------------------------------------------------------
# GET /clients
# ---------------------------------------------------------------------------

@router.get("/clients")
def list_clients(firm_id: str = FIRM_DEFAULT):
    """Roster — all clients sorted pending DESC, budgetPct DESC."""
    try:
        items = get_clients(firm_id)
        return [item.model_dump() for item in items]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# POST /clients
# ---------------------------------------------------------------------------

@router.post("/clients", status_code=201)
def create_client_endpoint(body: ClientCreateBody):
    """Create client + first matter. Idempotent."""
    try:
        req = ClientCreateRequest(
            firm_id=body.firm_id,
            client_name=body.client_name,
            client_type=body.client_type,
            primary_contact_name=body.primary_contact_name,
            primary_contact_email=body.primary_contact_email,
            primary_contact_phone=body.primary_contact_phone,
            billing_rate=body.billing_rate,
            billing_type=body.billing_type,
            billing_cycle=body.billing_cycle,
            payment_terms=body.payment_terms,
            engagement_type=body.engagement_type,
            date_engaged=body.date_engaged,
            engagement_letter_ref=body.engagement_letter_ref,
            responsible_attorney_id=body.responsible_attorney_id,
            conflict_check_names=body.conflict_check_names,
            silence_threshold_days=body.silence_threshold_days,
            budget_cap=body.budget_cap,
            notes=body.notes,
            first_matter=body.first_matter,
        )
        idem_key = f"create-client-{body.firm_id}-{body.client_name}-{body.date_engaged}"
        result = create_client(req, idem_key)
        if isinstance(result, ToolError):
            raise HTTPException(status_code=422, detail=result.message)

        matter_idem = f"create-matter-{result.entity_id}-{body.first_matter.matter_name}"
        matter_result = create_matter(
            firm_id=body.firm_id,
            client_id=result.entity_id,
            req=body.first_matter,
            responsible_attorney_id=body.responsible_attorney_id,
            idempotency_key=matter_idem,
        )
        if isinstance(matter_result, ToolError):
            raise HTTPException(status_code=422, detail=matter_result.message)

        return {
            "client_id": result.entity_id,
            "matter_id": matter_result.entity_id,
            "status": "created",
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# POST /clients/extract  (stateless — PDF in, ExtractionResult out)
# ---------------------------------------------------------------------------

@router.post("/clients/extract")
async def extract_from_document(
    firm_id: str = Form(default=FIRM_DEFAULT),
    document: UploadFile = File(...),
):
    """
    Stateless extraction. PDF → Gemini 2.5 Pro structured output → ExtractionResult.
    Nothing is written to Firestore.
    """
    try:
        content = await document.read()
        if not content.startswith(b"%PDF"):
            raise HTTPException(status_code=422, detail="Uploaded file is not a PDF")

        import vertexai
        from vertexai.generative_models import GenerativeModel, Part, GenerationConfig
        from app.config import GOOGLE_CLOUD_PROJECT

        vertexai.init(project=GOOGLE_CLOUD_PROJECT, location="us-central1")
        model = GenerativeModel("gemini-2.5-pro")

        pdf_part = Part.from_data(data=content, mime_type="application/pdf")

        system_prompt = (
            "You are a legal document parser. Extract structured client intake data from this "
            "engagement letter. Return only fields explicitly stated. For each field extracted, "
            "add it to confidence as 'high' (explicitly stated), 'medium' (strongly implied), "
            "or 'low' (inferred). Leave fields absent if not found. Return valid JSON only."
        )

        user_prompt = (
            "Extract the following fields from this engagement letter and return as JSON:\n"
            "client_name, client_type (individual/entity/trust/estate), primary_contact_name, "
            "primary_contact_email, primary_contact_phone, billing_rate (number), billing_type, "
            "billing_cycle, payment_terms, engagement_type, date_engaged (YYYY-MM-DD), "
            "matter_name, matter_type, opposing_counsel, court, case_number, conflict_check_names (array).\n\n"
            "Also return a 'confidence' object mapping each field to: 'high', 'medium', 'low', or 'not_found'.\n"
            "And return an 'extraction_notes' string summarising any gaps.\n"
            "Return ONLY valid JSON, no markdown, no prose."
        )

        response = model.generate_content(
            [pdf_part, user_prompt],
            generation_config=GenerationConfig(
                temperature=0.1,
                max_output_tokens=2048,
            ),
            system_instruction=system_prompt,
        )

        import json
        raw_text = response.text.strip()
        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
        raw_text = raw_text.strip()

        extracted = json.loads(raw_text)
        confidence = extracted.pop("confidence", {})
        extraction_notes = extracted.pop("extraction_notes", "")
        conflict_names = extracted.pop("conflict_check_names", [])

        fields_extracted = sum(1 for v in extracted.values() if v)
        fields_total = 16

        return ExtractionResult(
            **{k: v for k, v in extracted.items() if k in ExtractionResult.model_fields},
            conflict_check_names=conflict_names,
            confidence=confidence,
            extraction_notes=extraction_notes,
            fields_extracted_count=fields_extracted,
            fields_total=fields_total,
        ).model_dump()

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {exc}") from exc


# ---------------------------------------------------------------------------
# GET /clients/pending
# ---------------------------------------------------------------------------

@router.get("/clients/pending")
def list_pending_clients(firm_id: str = FIRM_DEFAULT):
    """Return all PendingClients in 'drafted' status."""
    try:
        docs = list(
            collection_ref(firm_id, "pending_clients")
            .where("status", "==", PendingClientStatus.drafted.value)
            .stream()
        )
        result = []
        for doc in docs:
            d = doc.to_dict()
            for field in ("detected_at", "created_at", "updated_at"):
                d[field] = _ts(d.get(field))
            result.append(d)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# POST /clients/pending/{pid}/confirm
# ---------------------------------------------------------------------------

@router.post("/clients/pending/{pid}/confirm")
def confirm_pending_client(pid: str, body: ConfirmPendingBody):
    """Promote a PendingClient to a real Client + Matter."""
    try:
        firm_id = body.firm_id
        ref = collection_ref(firm_id, "pending_clients").document(pid)
        doc = ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail=f"Pending client {pid} not found")

        data = doc.to_dict()
        if data.get("status") != PendingClientStatus.drafted.value:
            raise HTTPException(status_code=422, detail="Pending client is not in drafted status")

        extraction = data.get("extraction", {})
        edits = body.edits or {}

        def _get(field: str, default: Any = "") -> Any:
            return edits.get(field, extraction.get(field, default))

        req = ClientCreateRequest(
            firm_id=firm_id,
            client_name=_get("client_name", data.get("proposed_name", pid)),
            client_type=_get("client_type", "entity"),
            primary_contact_name=_get("primary_contact_name"),
            primary_contact_email=_get("primary_contact_email"),
            primary_contact_phone=_get("primary_contact_phone", ""),
            billing_rate=float(_get("billing_rate", 0)),
            billing_type=_get("billing_type", "hourly"),
            billing_cycle=_get("billing_cycle", "monthly"),
            payment_terms=_get("payment_terms", "net_30"),
            engagement_type=_get("engagement_type", "advisory"),
            date_engaged=_get("date_engaged", ""),
            engagement_letter_ref=data.get("source_file"),
            responsible_attorney_id=body.responsible_attorney_id,
            conflict_check_names=extraction.get("conflict_check_names", []),
            first_matter=MatterCreateRequest(
                matter_name=_get("matter_name", f"{_get('client_name', pid)} matter"),
                matter_type=_get("matter_type", "advisory"),
                opposing_counsel=_get("opposing_counsel"),
                court=_get("court"),
                case_number=_get("case_number"),
            ),
        )

        idem_key = f"confirm-pending-{firm_id}-{pid}"
        result = create_client(req, idem_key)
        if isinstance(result, ToolError):
            raise HTTPException(status_code=422, detail=result.message)

        matter_result = create_matter(
            firm_id=firm_id,
            client_id=result.entity_id,
            req=req.first_matter,
            responsible_attorney_id=body.responsible_attorney_id,
            idempotency_key=f"{idem_key}-matter",
        )

        now = get_effective_datetime()
        ref.update({"status": PendingClientStatus.confirmed.value, "updated_at": now})

        return {"client_id": result.entity_id, "matter_id": matter_result.entity_id if isinstance(matter_result, type(result)) else ""}

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# POST /clients/pending/{pid}/discard
# ---------------------------------------------------------------------------

@router.post("/clients/pending/{pid}/discard")
def discard_pending_client(pid: str, body: DiscardPendingBody):
    """Discard a drafted PendingClient."""
    try:
        firm_id = body.firm_id
        ref = collection_ref(firm_id, "pending_clients").document(pid)
        doc = ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail=f"Pending client {pid} not found")

        now = get_effective_datetime()
        ref.update({
            "status": PendingClientStatus.discarded.value,
            "updated_at": now,
        })
        log_audit_event(
            firm_id=firm_id,
            tier=AuditTier.operational,
            event_type="pending_client.discarded",
            actor=ATTORNEY_DEFAULT,
            entity_type="pending_client",
            entity_id=pid,
            notes=body.reason,
        )
        return {"status": "discarded"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# GET /clients/{client_id}/maintenance
# ---------------------------------------------------------------------------

@router.get("/clients/{client_id}/maintenance")
def get_client_maintenance(client_id: str, firm_id: str = FIRM_DEFAULT):
    """Return ClientMaintenanceState — applied + held suggestions + meta."""
    try:
        state = get_maintenance_state(firm_id, client_id)
        d = state.model_dump()
        # Serialise datetimes
        for field in ("last_reviewed_at",):
            if d.get(field) and isinstance(d[field], datetime):
                d[field] = d[field].isoformat()
        for item in d.get("applied", []):
            for f in ("applied_at", "created_at", "updated_at"):
                if item.get(f) and isinstance(item[f], datetime):
                    item[f] = item[f].isoformat()
        for item in d.get("suggested", []):
            for f in ("resolved_at", "created_at", "updated_at"):
                if item.get(f) and isinstance(item[f], datetime):
                    item[f] = item[f].isoformat()
        return d
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# POST /clients/{client_id}/review
# ---------------------------------------------------------------------------

@router.post("/clients/{client_id}/review")
def trigger_client_review(client_id: str, firm_id: str = FIRM_DEFAULT):
    """Synchronous 'Review now' sweep. Returns updated ClientMaintenanceState."""
    try:
        sweep_id = uuid.uuid4().hex[:12]
        state = run_client_review(firm_id, client_id, sweep_id)
        d = state.model_dump()
        if d.get("last_reviewed_at") and isinstance(d["last_reviewed_at"], datetime):
            d["last_reviewed_at"] = d["last_reviewed_at"].isoformat()
        return d
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# PATCH /clients/{client_id}/cadence
# ---------------------------------------------------------------------------

@router.patch("/clients/{client_id}/cadence")
def set_cadence(client_id: str, body: CadenceBody):
    """Update maintenance cadence for a client."""
    try:
        firm_id = body.firm_id
        valid = {"hourly", "daily", "events"}
        if body.cadence not in valid:
            raise HTTPException(status_code=422, detail=f"cadence must be one of {valid}")

        now = get_effective_datetime()
        collection_ref(firm_id, "clients").document(client_id).update({
            "maintenance_cadence": body.cadence,
            "updated_at": now,
        })
        log_audit_event(
            firm_id=firm_id,
            tier=AuditTier.operational,
            event_type="client.cadence_changed",
            actor=ATTORNEY_DEFAULT,
            entity_type="client",
            entity_id=client_id,
            client_id=client_id,
            after_state={"maintenance_cadence": body.cadence},
        )
        return {"status": "updated", "cadence": body.cadence}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# POST /clients/{client_id}/suggestions/{sid}/apply
# ---------------------------------------------------------------------------

@router.post("/clients/{client_id}/suggestions/{sid}/apply")
def apply_suggestion_endpoint(client_id: str, sid: str, body: ActionBody):
    """Apply a held suggestion."""
    try:
        result = apply_suggestion(body.firm_id, client_id, sid, body.actor)
        if isinstance(result, ToolError):
            raise HTTPException(status_code=422, detail=result.message)
        return {"status": "applied", "audit_event_id": result.audit_event_id}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# POST /clients/{client_id}/suggestions/{sid}/dismiss
# ---------------------------------------------------------------------------

@router.post("/clients/{client_id}/suggestions/{sid}/dismiss")
def dismiss_suggestion_endpoint(client_id: str, sid: str, body: DismissBody):
    """Dismiss a held suggestion. Reason required (≥4 chars)."""
    try:
        result = dismiss_suggestion(body.firm_id, client_id, sid, body.reason, body.actor)
        if isinstance(result, ToolError):
            code = 422 if result.error_type == "VALIDATION_FAILED" else 400
            raise HTTPException(status_code=code, detail=result.message)
        return {"status": "dismissed", "audit_event_id": result.audit_event_id}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
