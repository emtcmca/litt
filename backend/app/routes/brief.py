from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.brief.assembler import assemble_brief
from app.brief.schemas import BriefResponse, SweepRunResponse
from app.agents.coordinator import Coordinator
from app.db import collection_ref
from app.observability import AgentRunTimeline

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
