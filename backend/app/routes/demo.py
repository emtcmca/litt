"""
Demo management endpoints.
/api/demo/ready — validates all 5 demo conditions (fully implemented Day 4)
/api/demo/reset — deletes + re-seeds firm data (fully implemented Day 4)
/api/demo/state — debugging view of current demo Firestore state
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app import config
from app.db import collection_ref

router = APIRouter()


@router.get("/demo/ready")
def demo_ready():
    """
    Validates all 5 demo conditions are present in Firestore.
    Run before every demo recording attempt.
    Day 4: full implementation. Day 1: skeleton returns structure with checks=false.
    """
    firm_id = config.DEMO_FIRM_ID

    # Day 4 will replace these with real Firestore checks
    checks = {
        "deadline_mercer_escalates": {
            "pass": False,
            "detail": "Tool layer not yet wired",
        },
        "te_005_scrubber_hit": {
            "pass": False,
            "detail": "Tool layer not yet wired",
        },
        "te_001_missing_narrative": {
            "pass": False,
            "detail": "Tool layer not yet wired",
        },
        "acme_budget_warn": {
            "pass": False,
            "detail": "Tool layer not yet wired",
        },
        "whitmore_client_silence": {
            "pass": False,
            "detail": "Tool layer not yet wired",
        },
    }

    # Basic connectivity check — can we reach Firestore at all?
    try:
        ref = collection_ref(firm_id, "attorneys")
        docs = list(ref.limit(1).stream())
        if docs:
            checks["deadline_mercer_escalates"]["detail"] = (
                "Firestore reachable — full check wired Day 4"
            )
    except Exception as e:
        return {
            "ok": False,
            "error": f"Firestore unreachable: {str(e)}",
            "demo_date": config.DEMO_DATE_STR,
            "firm_id": firm_id,
            "checks": checks,
        }

    all_pass = all(c["pass"] for c in checks.values())
    return {
        "ok": all_pass,
        "demo_date": config.DEMO_DATE_STR,
        "firm_id": firm_id,
        "checks": checks,
    }


class ResetRequest(BaseModel):
    firm_id: str
    confirm: bool


@router.post("/demo/reset")
def demo_reset(req: ResetRequest):
    """
    Deletes all documents under firms/{firm_id}/ and re-seeds.
    Day 4: full implementation.
    """
    if not req.confirm:
        return {"ok": False, "message": "confirm must be true"}
    return {
        "ok": False,
        "message": "Reset not yet implemented — coming Day 4",
        "firm_id": req.firm_id,
    }


@router.get("/demo/state")
def demo_state():
    """Returns collection counts for debugging."""
    firm_id = config.DEMO_FIRM_ID
    collections = [
        "attorneys", "clients", "matters", "time_entries",
        "deadlines", "deadline_events", "client_communications",
        "invoices", "escalations", "audit_log", "ingestion_signals",
    ]
    counts = {}
    try:
        for col in collections:
            docs = list(collection_ref(firm_id, col).stream())
            counts[col] = len(docs)
        return {"firm_id": firm_id, "ok": True, "counts": counts}
    except Exception as e:
        return {"firm_id": firm_id, "ok": False, "error": str(e)}
