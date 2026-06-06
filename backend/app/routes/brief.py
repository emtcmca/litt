from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.brief.assembler import assemble_brief
from app.brief.schemas import BriefResponse, SweepRunResponse
from app.agents.coordinator import Coordinator
from app.db import collection_ref
from app.observability import AgentRunTimeline
from app.tools.registry import TOOL_REGISTRY
from app.agents.deadline_agent import _CADENCE, _get_escalation_level

router = APIRouter()

_coordinator = Coordinator()


class SweepRequest(BaseModel):
    firm_id: str
    attorney_id: str = "dana-strand"


@router.get("/brief", response_model=BriefResponse)
def get_brief(firm_id: str, attorney_id: str = "dana-strand"):
    """Returns Daily Closeout Brief assembled from live Firestore state."""
    try:
        return assemble_brief(firm_id=firm_id, attorney_id=attorney_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/sweep", response_model=SweepRunResponse)
def run_sweep(req: SweepRequest):
    """
    Triggers coordinator sweep, then assembles brief.
    Returns SweepRunResponse {timeline, brief} — one call, no second fetch needed.
    """
    try:
        timeline = _coordinator.execute_sweep(firm_id=req.firm_id)
        brief = assemble_brief(firm_id=req.firm_id, attorney_id=req.attorney_id)

        # Compute brief_items_count from assembled sections and attach to timeline.
        items_count = (
            brief.sections.deadlines.count
            + brief.sections.time_entries.count
            + brief.sections.budget_risks.count
            + brief.sections.client_silence.count
            + brief.sections.anomalies.count
        )
        timeline = timeline.model_copy(update={"brief_items_count": items_count})

        return SweepRunResponse(timeline=timeline, brief=brief)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/source-email/{email_id}")
def get_source_email(email_id: str, firm_id: str):
    """Return a source email by ID from the source_emails collection."""
    try:
        doc = collection_ref(firm_id, "source_emails").document(email_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail=f"Source email {email_id!r} not found")
        d = doc.to_dict()

        received_raw = d.get("received_at")
        if hasattr(received_raw, "timestamp"):
            received_str = datetime.fromtimestamp(received_raw.timestamp(), tz=timezone.utc).isoformat()
        elif isinstance(received_raw, datetime):
            received_str = received_raw.isoformat()
        elif isinstance(received_raw, str):
            received_str = received_raw
        else:
            received_str = None

        return {
            "id": d.get("id", email_id),
            "from_address": d.get("from_address"),
            "from_name": d.get("from_name"),
            "to_address": d.get("to_address"),
            "subject": d.get("subject"),
            "received_at": received_str,
            "body": d.get("body"),
            "source_system": d.get("source_system"),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/audit-log")
def get_audit_log(
    firm_id: str,
    tier: str = "",
    entity_type: str = "",
    actor: str = "",
    limit: int = 200,
):
    """
    Returns recent audit log events, newest first.
    Optional filters: tier, entity_type, actor.
    """
    try:
        query = collection_ref(firm_id, "audit_log")
        docs = list(query.stream())

        events = []
        for doc in docs:
            d = doc.to_dict()
            # normalise Firestore timestamps
            for field in ("created_at", "updated_at"):
                raw = d.get(field)
                if hasattr(raw, "timestamp"):
                    d[field] = datetime.fromtimestamp(raw.timestamp(), tz=timezone.utc).isoformat()
                elif isinstance(raw, datetime):
                    d[field] = raw.isoformat()

            if tier and d.get("tier") != tier:
                continue
            if entity_type and d.get("entity_type") != entity_type:
                continue
            if actor and d.get("actor") != actor:
                continue
            events.append(d)

        events.sort(key=lambda e: e.get("created_at", ""), reverse=True)
        total = len(events)
        events = events[:limit]

        return {"events": events, "count": len(events), "total": total}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/matters")
def get_matters(firm_id: str):
    """Returns all matters for a firm with client display names. Used by the Timer HUD."""
    try:
        clients = {doc.id: doc.to_dict() for doc in collection_ref(firm_id, "clients").stream()}
        result = []
        for doc in collection_ref(firm_id, "matters").stream():
            m = doc.to_dict()
            client_id = m.get("client_id", "")
            client_name = clients.get(client_id, {}).get("name", client_id)
            result.append({
                "id": m.get("id", doc.id),
                "name": m.get("name", doc.id),
                "client_id": client_id,
                "client_name": client_name,
            })
        result.sort(key=lambda x: x["name"])
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/tools")
def get_tools():
    """Returns the full tool registry — machine-readable catalog for Console UI."""
    return [spec.to_dict() for spec in TOOL_REGISTRY.values()]


@router.get("/deadlines")
def get_deadlines_full(firm_id: str):
    """Full book of all ACTIVE deadlines with days_out and escalation_level."""
    from app.config import get_effective_date
    try:
        today = get_effective_date()
        docs = list(collection_ref(firm_id, "deadlines").where("status", "==", "ACTIVE").stream())
        result = []
        for doc in docs:
            d = doc.to_dict()
            due_raw = d.get("due_date")
            if isinstance(due_raw, str):
                from datetime import date as _date
                due = _date.fromisoformat(due_raw)
            elif hasattr(due_raw, "date"):
                due = due_raw.date()
            else:
                due = due_raw
            days_out = (due - today).days if due else None
            level_pair = _get_escalation_level(days_out) if days_out is not None else None
            result.append({
                **d,
                "days_out": days_out,
                "escalation_level": level_pair[0] if level_pair else None,
            })
        result.sort(key=lambda x: x.get("days_out") or 9999)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/inbound")
def get_inbound(firm_id: str, attorney_id: str = "dana-strand"):
    """Returns all inbound_messages for a firm, with inlined draft_body_clean for any suggested reply."""
    try:
        docs = list(collection_ref(firm_id, "inbound_messages").stream())
        result = []
        for doc in docs:
            d = doc.to_dict()
            # Inline the clean draft body for suggested reply if present
            reply_comm_id = d.get("suggested_reply_comm_id")
            if reply_comm_id:
                comm_doc = collection_ref(firm_id, "client_communications").document(reply_comm_id).get()
                if comm_doc.exists:
                    comm = comm_doc.to_dict()
                    d["suggested_reply_body"] = comm.get("draft_body_clean") or comm.get("draft_body")
            result.append(d)
        result.sort(key=lambda x: x.get("urgency", "LOW"), reverse=False)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/sweep/{run_id}", response_model=AgentRunTimeline)
def get_sweep_timeline(run_id: str, firm_id: str):
    """
    Retrieves a stored agent run timeline by run_id.
    Phase 3 writes agent_runs documents; returns 404 until then.
    """
    try:
        doc = collection_ref(firm_id, "agent_runs").document(run_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail=f"Run {run_id!r} not found")
        return AgentRunTimeline(**doc.to_dict())
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
