"""
Internal routes — Cloud Scheduler / service-to-service only.
Not exposed in public API docs. All endpoints require bearer token auth.
Token source: INTERNAL_SWEEP_TOKEN env var.
"""

import os
import uuid
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.db import collection_ref
from app.tools.maintenance_tools import run_client_review

router = APIRouter()

FIRM_DEFAULT = "strand-okafor"


def _verify_token(authorization: Optional[str]) -> None:
    token = os.getenv("INTERNAL_SWEEP_TOKEN", "")
    if not token:
        raise HTTPException(status_code=503, detail="INTERNAL_SWEEP_TOKEN not configured")
    expected = f"Bearer {token}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


class SweepBody(BaseModel):
    cadence: str = "hourly"
    firm_id: str = FIRM_DEFAULT


@router.post("/internal/maintenance/sweep")
def maintenance_sweep(
    body: SweepBody,
    authorization: Optional[str] = Header(default=None),
):
    """
    Cloud Scheduler target. Iterates all clients in the requested cadence
    bucket and runs a review sweep for each. Idempotent per sweep_id.
    """
    _verify_token(authorization)

    valid_cadences = {"hourly", "daily", "events"}
    if body.cadence not in valid_cadences:
        raise HTTPException(status_code=422, detail=f"cadence must be one of {valid_cadences}")

    client_docs = list(
        collection_ref(body.firm_id, "clients")
        .where("maintenance_cadence", "==", body.cadence)
        .stream()
    )

    results = []
    for doc in client_docs:
        client_id = doc.id
        sweep_id = uuid.uuid4().hex[:12]
        try:
            run_client_review(body.firm_id, client_id, sweep_id)
            results.append({"client_id": client_id, "status": "swept"})
        except Exception as exc:
            results.append({"client_id": client_id, "status": "error", "detail": str(exc)})

    return {"swept": len(results), "cadence": body.cadence, "results": results}
