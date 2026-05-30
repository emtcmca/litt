from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.brief.assembler import assemble_brief
from app.brief.schemas import BriefResponse, SweepResponse
from app.agents.coordinator import Coordinator

router = APIRouter()

_coordinator = Coordinator()


class SweepRequest(BaseModel):
    firm_id: str


@router.get("/brief", response_model=BriefResponse)
def get_brief(firm_id: str, attorney_id: str = "dana-strand"):
    """Returns Daily Closeout Brief assembled from live Firestore state."""
    try:
        return assemble_brief(firm_id=firm_id, attorney_id=attorney_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/sweep", response_model=SweepResponse)
def run_sweep(req: SweepRequest):
    """Triggers coordinator sweep — runs all sub-agents and returns summary."""
    try:
        return _coordinator.execute_sweep(firm_id=req.firm_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
