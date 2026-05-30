from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class SweepRequest(BaseModel):
    firm_id: str


@router.get("/brief")
def get_brief(firm_id: str, attorney_id: str = "dana-strand"):
    """
    Returns Daily Closeout Brief for the attorney.
    Day 3: implemented in brief/assembler.py
    """
    return {
        "firm_id": firm_id,
        "attorney_id": attorney_id,
        "message": "Brief assembler not yet implemented — coming Day 3",
        "sections": {
            "deadlines": {"items": [], "count": 0, "has_critical": False},
            "time_entries": {"items": [], "count": 0, "total_wip_usd": 0},
            "budget_risks": {"items": [], "count": 0},
            "client_silence": {"items": [], "count": 0},
            "anomalies": {"items": [], "count": 0},
        },
    }


@router.post("/sweep")
def run_sweep(req: SweepRequest):
    """
    Triggers coordinator sweep.
    Day 3: wired to ADK coordinator.
    """
    return {
        "sweep_id": "not-yet-implemented",
        "firm_id": req.firm_id,
        "message": "Coordinator not yet wired — coming Day 3",
        "sections_updated": [],
        "escalations_created": 0,
        "anomalies_detected": 0,
    }
