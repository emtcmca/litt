# 03 — Litt Audit Log & Agent Run Timeline API

**Purpose:** Complete specification for API endpoints and Firestore persistence  
**Audience:** Backend developers, FastAPI + Firestore experience required  
**Time estimate:** 1.5 hours to implement  

---

## May 31 Architecture Corrections

The original version of this spec contained one serious contradiction: it marked `audit_log` CREATE-only, then proposed updating audit rows when a human decides. Do **not** implement audit updates. Human decisions must be appended as new audit events.

Required corrections:

- Keep `audit_log` append-only. `POST /api/audit/{entry_id}/decide` creates a new event whose `event_type` is `human_decision_recorded` and whose `related_audit_event_id` points to the original system suggestion.
- Do not create `_create_audit_log_entry()` inside a route module and import it from tools. Route modules orchestrate HTTP. Tool modules own writes.
- Extend or wrap the existing `backend/app/tools/audit.py::log_audit_event()` rather than adding a parallel audit writer.
- `agent_runs` may be written by the coordinator/timeline persistence path because it is observability telemetry, but business entity writes still happen only in tools.
- Use `firm_id="strand-okafor"` in all examples.
- Include observation fields that help judges: `work_kind`, `model_name`, `attorney_next_action`, `source_excerpt`, and `related_entity_ids`.

---

## Firestore Schema

### Collection: `agent_runs`

Stores complete timeline for each sweep or manual run.

```firestore
/firms/{firm_id}/agent_runs/{run_id}
{
  "run_id": "sweep-strand-okafor-20260529T161500Z",
  "firm_id": "strand-okafor",
  
  "triggered_by": "manual_run",  // scheduled_sweep | manual_run | event_trigger
  "started_at": Timestamp(2026-05-29T16:15:00Z),
  "completed_at": Timestamp(2026-05-29T16:15:02Z),
  "elapsed_seconds": 2.1,
  
  "observations": [
    {
      "observation_id": "obs-coordinator-20260529161500000001-000",
      "timestamp": Timestamp(2026-05-29T16:15:00Z),
      "agent_name": "coordinator",
      "observation_type": "signal_received",
      "commitment_level": "auto_safe",
      "description": "Observed input signals from multiple sources",
      "data": {
        "gmail_threads": 14,
        "calendar_events": 6,
        "pending_entries": 3,
        "total_signals": 23
      },
      "confidence": 1.0,
      "evidence": [],
      "run_id": "sweep-strand-okafor-20260529T161500Z",
      "parent_observation_id": null,
      "audit_log_id": null
    },
    // ... more observations
  ],
  
  "brief_items_count": 7,
  "escalations_count": 3,
  
  "created_at": Timestamp(2026-05-29T16:15:02Z),
}
```

**Implementation note:** If a run could exceed Firestore's 1 MiB document limit in the future, store observations as subcollection documents at `/firms/{firm_id}/agent_runs/{run_id}/observations/{observation_id}`. For the hackathon demo, a single document with roughly 20-40 observations is acceptable and easier to build.

### Collection: `audit_log`

Enhanced audit log with observation chains.

```firestore
/firms/{firm_id}/audit_log/{entry_id}
{
  "entry_id": "audit-20260529-161500-001",
  "firm_id": "strand-okafor",
  
  // ACTION TYPE
  "action_type": "time_entry_approved",  // deadline_confirmed, time_entry_approved, etc.
  "entity_type": "time_entry",
  "entity_id": "entry-mercer-001",
  
  // OBSERVATION CHAIN
  "observation_id": "obs-billing-20260529161515000001-003",
  "observation_chain": [
    "obs-coordinator-20260529161500000001-000",
    "obs-coordinator-20260529161504000001-002",
    "obs-billing-20260529161515000001-003"
  ],
  
  // CONFIDENCE & GATES
  "confidence": 0.95,
  "commitment_level": "review_required",
  "evidence": ["entry-mercer-001", "email-mercer-001"],
  
  // WHAT THE SYSTEM SUGGESTED
  "system_suggestion": {
    "action": "approve_time_entry",
    "rationale": "Entry has complete narrative and passed pre-bill scrubber",
    "suggested_by": "billing_agent"
  },
  
  // WHAT THE HUMAN DECIDED
  // Do not mutate these fields after create. Prefer a separate
  // human_decision_recorded event linked by related_audit_event_id.
  "human_decision": null,
  "human_decided_by": null,
  "human_decided_at": null,
  "human_notes": null,
  
  // OUTCOME
  "outcome": "pending_human_decision",
  "outcome_at": null,
  
  // TIMING
  "created_at": Timestamp(2026-05-29T16:15:15Z),
  "last_modified_at": Timestamp(2026-05-29T16:15:35Z),
}
```

### Human Decision Audit Event

Append this as a new `audit_log` document when an attorney acts:

```firestore
/firms/{firm_id}/audit_log/{decision_event_id}
{
  "id": "ae-human-decision-20260529-161535",
  "firm_id": "strand-okafor",
  "tier": "legal_defensibility",
  "event_type": "human_decision_recorded",
  "actor": "attorney:dana-strand",
  "entity_type": "time_entry",
  "entity_id": "te-005",
  "related_audit_event_id": "ae-system-suggestion-20260529-161500",
  "decision": "approved_after_edit",
  "decision_notes": "Replaced forbidden phrase before approval.",
  "before_state": {"status": "PENDING"},
  "after_state": {"status": "APPROVED"},
  "created_at": Timestamp(2026-05-29T16:15:35Z),
  "updated_at": Timestamp(2026-05-29T16:15:35Z)
}
```

### Firestore Security Rules

Add to existing rules:

```javascript
// Allow reading agent_runs and audit_log
match /firms/{firm_id}/agent_runs/{run_id} {
  allow read: if request.auth.uid != null;
  allow create: if request.auth.uid != null;
  // No updates or deletes after creation (timeline is immutable telemetry)
}

match /firms/{firm_id}/audit_log/{entry_id} {
  allow read: if request.auth.uid != null;
  allow create: if request.auth.uid != null;
  // No updates or deletes after creation (append-only for audit)
}
```

---

## API Endpoints

### File: `backend/app/routes/timeline.py`

Create new route file for timeline endpoints.

```python
"""
API endpoints for agent run timelines and audit logs.

POST   /api/sweep                    — Trigger manual coordinator sweep
GET    /api/sweep/{run_id}           — Get specific timeline
GET    /api/audit/{entity_id}        — Get audit history for entity
POST   /api/audit/{entry_id}/decide  — Append human decision audit event
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from app.agents.coordinator import CoordinatorOrchestrator
from app.models.observability import AgentRunTimeline, AgentObservation
from app.models.audit_log import AuditLogEntry
from app.config import get_effective_datetime
from app.db import firestore_client

router = APIRouter(prefix="/api", tags=["timeline"])


# ============================================================================
# REQUEST / RESPONSE MODELS
# ============================================================================

class SweepRequest(BaseModel):
    """Request to trigger a sweep"""
    firm_id: str
    triggered_by: str = "manual_run"


class SweepResponse(BaseModel):
    """Response from a sweep"""
    run_id: str
    firm_id: str
    triggered_by: str
    started_at: str
    completed_at: str
    elapsed_seconds: float
    observations_count: int
    brief_items_count: int
    escalations_count: int
    observations: List[dict]
    summary: str
    
    class Config:
        schema_extra = {
            "example": {
                "run_id": "sweep-strand-okafor-20260529T161500Z",
                "firm_id": "strand-okafor",
                "triggered_by": "manual_run",
                "started_at": "2026-05-29T16:15:00Z",
                "completed_at": "2026-05-29T16:15:02Z",
                "elapsed_seconds": 2.1,
                "observations_count": 24,
                "brief_items_count": 7,
                "escalations_count": 3,
                "observations": [
                    {
                        "timestamp": "2026-05-29T16:15:00Z",
                        "agent": "coordinator",
                        "type": "signal_received",
                        "description": "Observed 14 Gmail threads and 6 calendar events",
                        "gate": "auto_safe",
                        "confidence": 1.0,
                        "evidence": []
                    }
                ],
                "summary": "Observed 14 Gmail threads and 6 calendar events..."
            }
        }


class TimelineItemResponse(BaseModel):
    """Single observation as returned in API response"""
    timestamp: str
    agent: str
    observation_id: str
    type: str
    description: str
    gate: str
    confidence: Optional[float] = None
    evidence: List[str] = []
    data: Optional[dict] = None


class AuditEntryResponse(BaseModel):
    """Audit log entry with human decision info"""
    entry_id: str
    entity_type: str
    entity_id: str
    action_type: str
    
    confidence: Optional[float]
    commitment_level: str
    evidence: List[str]
    
    system_suggestion: dict
    
    human_decision: Optional[str] = None
    human_decided_by: Optional[str] = None
    human_decided_at: Optional[str] = None
    human_notes: Optional[str] = None
    
    outcome: str
    outcome_at: str
    
    created_at: str
    last_modified_at: str


class HumanDecisionRequest(BaseModel):
    """Human decides on an audit entry"""
    decision: str  # approved, rejected, escalated, dismissed, etc.
    decision_by: str  # attorney ID
    notes: Optional[str] = None
    idempotency_key: str


# ============================================================================
# ENDPOINT 1: POST /api/sweep
# ============================================================================

@router.post("/sweep", response_model=SweepResponse)
async def trigger_sweep(request: SweepRequest):
    """
    Trigger a manual coordinator sweep for a firm.
    
    Returns complete timeline with all observations.
    
    This is the main endpoint for the demo — judges watch observations
    stream in as the agent runs.
    
    Example:
    POST /api/sweep
    {
      "firm_id": "strand-okafor",
      "triggered_by": "manual_run"
    }
    
    Returns:
    {
      "run_id": "sweep-strand-okafor-20260529T161500Z",
      "observations": [
        {
          "timestamp": "2026-05-29T16:15:00Z",
          "agent": "coordinator",
          "type": "signal_received",
          "description": "Observed 14 Gmail threads and 6 calendar events",
          "gate": "auto_safe",
          "confidence": 1.0
        },
        ...
      ],
      "summary": "Observed 14 Gmail threads and 6 calendar events..."
    }
    """
    
    try:
        # Execute coordinator sweep
        coordinator = CoordinatorOrchestrator(request.firm_id)
        timeline: AgentRunTimeline = await coordinator.run_sweep(
            triggered_by=request.triggered_by
        )
        
        # Save timeline to Firestore
        await _save_timeline_to_firestore(request.firm_id, timeline)
        
        # Format observations for response
        observations_response = [
            {
                "timestamp": obs.timestamp.isoformat(),
                "agent": obs.agent_name,
                "observation_id": obs.observation_id,
                "type": obs.observation_type.value,
                "description": obs.description,
                "gate": obs.commitment_level.value,
                "confidence": obs.confidence,
                "evidence": obs.evidence,
                "data": obs.data,
            }
            for obs in timeline.observations
        ]
        
        # Return response
        return SweepResponse(
            run_id=timeline.run_id,
            firm_id=timeline.firm_id,
            triggered_by=timeline.triggered_by,
            started_at=timeline.started_at.isoformat(),
            completed_at=timeline.completed_at.isoformat(),
            elapsed_seconds=timeline.elapsed_seconds,
            observations_count=len(timeline.observations),
            brief_items_count=timeline.brief_items_count,
            escalations_count=timeline.escalations_count,
            observations=observations_response,
            summary=timeline.human_readable_summary,
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINT 2: GET /api/sweep/{run_id}
# ============================================================================

@router.get("/sweep/{run_id}", response_model=SweepResponse)
async def get_sweep_timeline(
    run_id: str,
    firm_id: str = Query(..., description="Firm ID for Firestore path"),
):
    """
    Retrieve a previously-run timeline.
    
    Allows judges to review past sweeps.
    
    Example:
    GET /api/sweep/sweep-strand-okafor-20260529T161500Z?firm_id=strand-okafor
    
    Returns: Complete timeline with all observations
    """
    
    try:
        # Fetch from Firestore
        doc = firestore_client.collection("firms").document(firm_id).collection(
            "agent_runs"
        ).document(run_id).get()
        
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Timeline not found")
        
        data = doc.to_dict()
        
        # Format observations for response
        observations_response = [
            {
                "timestamp": obs.get("timestamp").isoformat() if isinstance(obs.get("timestamp"), datetime) else obs.get("timestamp"),
                "agent": obs.get("agent_name"),
                "observation_id": obs.get("observation_id"),
                "type": obs.get("observation_type"),
                "description": obs.get("description"),
                "gate": obs.get("commitment_level"),
                "confidence": obs.get("confidence"),
                "evidence": obs.get("evidence", []),
                "data": obs.get("data"),
            }
            for obs in data.get("observations", [])
        ]
        
        return SweepResponse(
            run_id=data.get("run_id"),
            firm_id=firm_id,
            triggered_by=data.get("triggered_by"),
            started_at=data.get("started_at").isoformat() if isinstance(data.get("started_at"), datetime) else data.get("started_at"),
            completed_at=data.get("completed_at").isoformat() if isinstance(data.get("completed_at"), datetime) else data.get("completed_at"),
            elapsed_seconds=data.get("elapsed_seconds", 0.0),
            observations_count=len(data.get("observations", [])),
            brief_items_count=data.get("brief_items_count", 0),
            escalations_count=data.get("escalations_count", 0),
            observations=observations_response,
            summary=data.get("summary", ""),
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINT 3: GET /api/audit/{entity_id}
# ============================================================================

@router.get("/audit/{entity_id}", response_model=List[AuditEntryResponse])
async def get_entity_audit_history(
    entity_id: str,
    firm_id: str = Query(..., description="Firm ID for Firestore path"),
    entity_type: Optional[str] = Query(None, description="Optional filter by entity type"),
):
    """
    Get all audit log entries for a specific entity.
    
    Shows complete audit trail: what was observed, what was suggested,
    what the human decided, and what the outcome was.
    
    Example:
    GET /api/audit/entry-mercer-001?firm_id=strand-okafor
    
    Returns:
    [
      {
        "entry_id": "audit-20260529-161500-001",
        "entity_id": "entry-mercer-001",
        "action_type": "time_entry_approved",
        "confidence": 0.95,
        "commitment_level": "review_required",
        "system_suggestion": {
          "action": "approve_time_entry",
          "rationale": "Entry has complete narrative..."
        },
        "human_decision": "approved",
        "human_decided_by": "attorney_001",
        "human_decided_at": "2026-05-29T16:15:35Z",
        "outcome": "approved",
        "outcome_at": "2026-05-29T16:15:35Z"
      }
    ]
    """
    
    try:
        # Query audit log for this entity
        query = firestore_client.collection("firms").document(firm_id).collection(
            "audit_log"
        ).where("entity_id", "==", entity_id)
        
        if entity_type:
            query = query.where("entity_type", "==", entity_type)
        
        query = query.order_by("created_at")
        
        docs = query.stream()
        
        entries = []
        for doc in docs:
            data = doc.to_dict()
            entries.append(AuditEntryResponse(
                entry_id=data.get("entry_id"),
                entity_type=data.get("entity_type"),
                entity_id=data.get("entity_id"),
                action_type=data.get("action_type"),
                confidence=data.get("confidence"),
                commitment_level=data.get("commitment_level"),
                evidence=data.get("evidence", []),
                system_suggestion=data.get("system_suggestion", {}),
                human_decision=data.get("human_decision"),
                human_decided_by=data.get("human_decided_by"),
                human_decided_at=data.get("human_decided_at").isoformat() if isinstance(data.get("human_decided_at"), datetime) else data.get("human_decided_at"),
                human_notes=data.get("human_notes"),
                outcome=data.get("outcome"),
                outcome_at=data.get("outcome_at").isoformat() if isinstance(data.get("outcome_at"), datetime) else data.get("outcome_at"),
                created_at=data.get("created_at").isoformat() if isinstance(data.get("created_at"), datetime) else data.get("created_at"),
                last_modified_at=data.get("last_modified_at").isoformat() if isinstance(data.get("last_modified_at"), datetime) else data.get("last_modified_at"),
            ))
        
        return entries
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINT 4: POST /api/audit/{entry_id}/decide
# ============================================================================

@router.post("/audit/{entry_id}/decide")
async def record_human_decision(
    entry_id: str,
    firm_id: str = Query(..., description="Firm ID for Firestore path"),
    decision_request: HumanDecisionRequest = None,
):
    """
    Append a human decision linked to an audit log entry.
    
    Called when attorney approves, rejects, or escalates a suggested action.
    
    Example:
    POST /api/audit/audit-20260529-161500-001/decide?firm_id=strand-okafor
    {
      "decision": "approved",
      "decision_by": "attorney_001",
      "notes": "Narrative is clear and supported by evidence",
      "idempotency_key": "demo-decision-audit-20260529-001"
    }
    """
    
    try:
        # Fetch the entry
        doc = firestore_client.collection("firms").document(firm_id).collection(
            "audit_log"
        ).document(entry_id).get()
        
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Audit entry not found")
        
        # Append human decision. Do not update the original audit event.
        now = get_effective_datetime()
        decision_event_id = log_audit_event(
            firm_id=firm_id,
            tier=AuditTier.legal_defensibility,
            event_type="human_decision_recorded",
            actor=f"attorney:{decision_request.decision_by}",
            entity_type=doc.to_dict().get("entity_type"),
            entity_id=doc.to_dict().get("entity_id"),
            before_state={"related_audit_event_id": entry_id},
            after_state={
                "decision": decision_request.decision,
                "notes": decision_request.notes,
                "decided_at": now.isoformat(),
            },
            idempotency_key=decision_request.idempotency_key,
            notes=decision_request.notes,
        )
        
        return {
            "entry_id": decision_event_id,
            "related_audit_event_id": entry_id,
            "decision": decision_request.decision,
            "decided_at": now.isoformat(),
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def _save_timeline_to_firestore(
    firm_id: str,
    timeline: AgentRunTimeline,
) -> None:
    """
    Save complete timeline to Firestore.
    
    Called after coordinator sweep completes.
    """
    
    # Convert observations to dicts
    observations_data = []
    for obs in timeline.observations:
        observations_data.append({
            "observation_id": obs.observation_id,
            "timestamp": obs.timestamp,
            "agent_name": obs.agent_name,
            "observation_type": obs.observation_type.value,
            "commitment_level": obs.commitment_level.value,
            "description": obs.description,
            "data": obs.data,
            "confidence": obs.confidence,
            "evidence": obs.evidence,
            "run_id": obs.run_id,
            "parent_observation_id": obs.parent_observation_id,
            "audit_log_id": obs.audit_log_id,
        })
    
    # Save to Firestore
    firestore_client.collection("firms").document(firm_id).collection(
        "agent_runs"
    ).document(timeline.run_id).set({
        "run_id": timeline.run_id,
        "firm_id": timeline.firm_id,
        "triggered_by": timeline.triggered_by,
        "started_at": timeline.started_at,
        "completed_at": timeline.completed_at,
        "elapsed_seconds": timeline.elapsed_seconds,
        "observations": observations_data,
        "brief_items_count": timeline.brief_items_count,
        "escalations_count": timeline.escalations_count,
        "created_at": get_effective_datetime(),
    })


async def _create_audit_log_entry(
    firm_id: str,
    entity_type: str,
    entity_id: str,
    action_type: str,
    confidence: Optional[float],
    commitment_level: str,
    evidence: List[str],
    system_suggestion: dict,
) -> str:
    """
    Deprecated direction: do not place this helper in a route module.
    
    Implement this behavior by extending backend/app/tools/audit.py
    or by creating a helper in backend/app/tools/observability.py.
    
    Returns the entry ID.
    """
    
    entry_id = f"audit-{get_effective_datetime().strftime('%Y%m%d-%H%M%S')}-{_get_next_audit_counter()}"
    
    firestore_client.collection("firms").document(firm_id).collection(
        "audit_log"
    ).document(entry_id).set({
        "entry_id": entry_id,
        "firm_id": firm_id,
        "action_type": action_type,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "confidence": confidence,
        "commitment_level": commitment_level,
        "evidence": evidence,
        "system_suggestion": system_suggestion,
        "human_decision": None,
        "human_decided_by": None,
        "human_decided_at": None,
        "human_notes": None,
        "outcome": "pending_human_decision",
        "outcome_at": None,
        "created_at": get_effective_datetime(),
        "last_modified_at": get_effective_datetime(),
    })
    
    return entry_id


# Counter for audit entries (simple; in production use Firestore transactions)
_audit_counter = 0

def _get_next_audit_counter() -> int:
    global _audit_counter
    _audit_counter += 1
    return _audit_counter
```

---

## Integration with Tools Layer

The tools layer should automatically create audit log entries when actions are executed.

### File: `backend/app/tools/audit.py` or `backend/app/tools/observability.py`

Add function to create audit entries:

```python
"""
Common tool utilities for audit logging.
"""

from app.models import AuditTier
from app.tools.audit import log_audit_event


async def log_observed_action_to_audit(
    firm_id: str,
    entity_type: str,
    entity_id: str,
    action_type: str,
    confidence: Optional[float],
    commitment_level: str,
    evidence: List[str],
    system_suggestion: dict,
    observation_id: Optional[str] = None,
    observation_chain: Optional[List[str]] = None,
) -> str:
    """
    Create an append-only audit event for an action.
    
    Called by tool functions after they complete.
    
    Example:
    
    async def advance_entry_status(...):
        # ... existing validation ...
        
        # If tool succeeds, log it
        audit_id = log_observed_action_to_audit(
            firm_id=firm_id,
            entity_type="time_entry",
            entity_id=entry_id,
            action_type="time_entry_status_advanced",
            confidence=0.95,
            commitment_level="review_required",
            evidence=[entry_id],
            system_suggestion={
                "action": "advance_to_approved",
                "rationale": "Entry has narrative and passed scrubber"
            },
            observation_id=observation_id,  # From brief item
        )
        
        return ToolResult(
            success=True,
            entity_id=entry_id,
            audit_log_id=audit_id,
        )
    """
    
    event_id = log_audit_event(
        firm_id=firm_id,
        tier=AuditTier.legal_defensibility,
        event_type=action_type,
        actor=system_suggestion.get("suggested_by", "system"),
        entity_type=entity_type,
        entity_id=entity_id,
        before_state=None,
        after_state={
            "confidence": confidence,
            "commitment_level": commitment_level,
            "evidence": evidence,
            "system_suggestion": system_suggestion,
            "observation_id": observation_id,
            "observation_chain": observation_chain or [],
        },
    )
    
    return event_id
```

---

## Testing

### File: `backend/tests/test_timeline_api.py`

```python
"""
Tests for timeline and audit log API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import DEMO_MODE

client = TestClient(app)

@pytest.mark.skipif(not DEMO_MODE, reason="Demo mode only")
class TestTimelineAPI:
    
    def test_sweep_endpoint_returns_timeline(self):
        """POST /api/sweep returns complete timeline with observations"""
        
        response = client.post("/api/sweep", json={
            "firm_id": "strand-okafor",
            "triggered_by": "manual_run"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "run_id" in data
        assert "observations" in data
        assert "summary" in data
        assert len(data["observations"]) > 0
        
        # Verify observations have all required fields
        for obs in data["observations"]:
            assert "timestamp" in obs
            assert "agent" in obs
            assert "type" in obs
            assert "description" in obs
            assert "gate" in obs
    
    def test_sweep_endpoint_emits_signal_received(self):
        """Timeline includes SIGNAL_RECEIVED observation"""
        
        response = client.post("/api/sweep", json={
            "firm_id": "strand-okafor",
            "triggered_by": "manual_run"
        })
        
        data = response.json()
        types = [obs["type"] for obs in data["observations"]]
        
        assert "signal_received" in types
    
    def test_sweep_endpoint_emits_routing_decisions(self):
        """Timeline includes ROUTING_DECISION observations"""
        
        response = client.post("/api/sweep", json={
            "firm_id": "strand-okafor",
            "triggered_by": "manual_run"
        })
        
        data = response.json()
        types = [obs["type"] for obs in data["observations"]]
        
        assert "routing_decision" in types
    
    def test_sweep_endpoint_emits_results(self):
        """Timeline includes RESULT observations"""
        
        response = client.post("/api/sweep", json={
            "firm_id": "strand-okafor",
            "triggered_by": "manual_run"
        })
        
        data = response.json()
        types = [obs["type"] for obs in data["observations"]]
        
        assert "result" in types
    
    def test_get_timeline_returns_saved_sweep(self):
        """GET /api/sweep/{run_id} retrieves previously-saved timeline"""
        
        # First, run a sweep
        sweep_response = client.post("/api/sweep", json={
            "firm_id": "strand-okafor",
            "triggered_by": "manual_run"
        })
        run_id = sweep_response.json()["run_id"]
        
        # Then, retrieve it
        response = client.get(f"/api/sweep/{run_id}", params={
            "firm_id": "strand-okafor"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["run_id"] == run_id
    
    def test_audit_history_returns_entries(self):
        """GET /api/audit/{entity_id} returns audit history"""
        
        # After a sweep that creates audit entries...
        response = client.get("/api/audit/entry-mercer-001", params={
            "firm_id": "strand-okafor"
        })
        
        assert response.status_code in [200, 404]  # 404 if no entries yet
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            for entry in data:
                assert "entry_id" in entry
                assert "entity_id" in entry
                assert "action_type" in entry
    
    def test_human_decision_updates_audit_entry(self):
        """POST /api/audit/{entry_id}/decide records human decision"""
        
        # This test requires an audit entry to exist first
        # In real testing, you'd create one via a sweep
        
        response = client.post("/api/audit/audit-test-001/decide", params={
            "firm_id": "strand-okafor"
        }, json={
            "decision": "approved",
            "decision_by": "attorney_001",
            "notes": "Narrative is clear",
            "idempotency_key": "test-human-decision-001"
        })
        
        # Will be 404 in demo if entry doesn't exist
        assert response.status_code in [200, 404]
```

---

## Integration Checklist

### Before Starting Implementation

- [ ] You have FastAPI routes set up in `backend/app/routes/`
- [ ] You have Firestore client initialized
- [ ] Agent instrumentation (02-...) is complete
- [ ] Models are defined and tested

### Implementation Order

- [ ] **Step 1:** Create `backend/app/routes/timeline.py`
- [ ] **Step 2:** Add data models to route file
- [ ] **Step 3:** Implement `/api/sweep` endpoint
- [ ] **Step 4:** Implement `/api/sweep/{run_id}` endpoint
- [ ] **Step 5:** Implement `/api/audit/{entity_id}` endpoint
- [ ] **Step 6:** Implement `/api/audit/{entry_id}/decide` endpoint
- [ ] **Step 7:** Update tools to call `log_audit_event()` or the tool-layer wrapper `log_observed_action_to_audit()`
- [ ] **Step 8:** Add Firestore rules for agent_runs and audit_log collections
- [ ] **Step 9:** Write tests in `backend/tests/test_timeline_api.py`
- [ ] **Step 10:** Test end-to-end: run sweep → verify timeline saved → retrieve via GET

### Testing

```bash
# Unit tests
python -m pytest backend/tests/test_timeline_api.py -v

# Integration test
curl -X POST http://localhost:8000/api/sweep \
  -H "Content-Type: application/json" \
  -d '{"firm_id": "strand-okafor", "triggered_by": "manual_run"}'

# Should return observations in 2-3 seconds
```

---

## Response Examples

### POST /api/sweep Response

```json
{
  "run_id": "sweep-strand-okafor-20260529T161500Z",
  "firm_id": "strand-okafor",
  "triggered_by": "manual_run",
  "started_at": "2026-05-29T16:15:00Z",
  "completed_at": "2026-05-29T16:15:02Z",
  "elapsed_seconds": 2.1,
  "observations_count": 24,
  "brief_items_count": 7,
  "escalations_count": 3,
  "observations": [
    {
      "timestamp": "2026-05-29T16:15:00Z",
      "agent": "coordinator",
      "observation_id": "obs-coordinator-20260529161500000001-000",
      "type": "signal_received",
      "description": "Observed input signals from multiple sources",
      "gate": "auto_safe",
      "confidence": 1.0,
      "evidence": [],
      "data": {
        "gmail_threads": 14,
        "calendar_events": 6,
        "pending_entries": 3,
        "total_signals": 23
      }
    },
    {
      "timestamp": "2026-05-29T16:15:02Z",
      "agent": "coordinator",
      "observation_id": "obs-coordinator-20260529161500000001-001",
      "type": "reasoning",
      "description": "Planning comprehensive operational checks",
      "gate": "auto_safe",
      "confidence": 1.0,
      "evidence": [],
      "data": {
        "planned_checks": [
          "deadline_verification",
          "billing_reconciliation",
          "client_comms_check",
          "a_r_watchdog",
          "anomaly_detection"
        ]
      }
    },
    {
      "timestamp": "2026-05-29T16:15:05Z",
      "agent": "coordinator",
      "observation_id": "obs-coordinator-20260529161500000001-002",
      "type": "routing_decision",
      "description": "Routing DEADLINE_CANDIDATE signal to deadline_monitor",
      "gate": "auto_safe",
      "confidence": 1.0,
      "evidence": [],
      "data": {
        "signal_type": "DEADLINE_CANDIDATE",
        "signal_id": "dl-cand-001",
        "routed_to": "deadline_monitor"
      }
    },
    {
      "timestamp": "2026-05-29T16:15:08Z",
      "agent": "deadline_monitor",
      "observation_id": "obs-deadline-monitor-20260529161508000001-000",
      "type": "reasoning",
      "description": "Examining deadline candidate from email",
      "gate": "auto_safe",
      "confidence": 1.0,
      "evidence": [],
      "data": {
        "source_type": "email",
        "signal_id": "dl-cand-001"
      }
    },
    {
      "timestamp": "2026-05-29T16:15:08Z",
      "agent": "deadline_monitor",
      "observation_id": "obs-deadline-monitor-20260529161508000001-001",
      "type": "reasoning",
      "description": "Checking deadline source: email from opposing counsel",
      "gate": "auto_safe",
      "confidence": 1.0,
      "evidence": ["email-rivera-001"],
      "data": {
        "source_excerpt": "Response to your motion is due tomorrow (Friday)",
        "from": "opposite.counsel@rivera-defense.com"
      }
    },
    {
      "timestamp": "2026-05-29T16:15:10Z",
      "agent": "deadline_monitor",
      "observation_id": "obs-deadline-monitor-20260529161510000001-002",
      "type": "escalation",
      "description": "Cannot safely verify deadline. Conflicting or ambiguous evidence.",
      "gate": "escalation",
      "confidence": 0.7,
      "evidence": ["email-rivera-001"],
      "data": {
        "extracted_date": "2026-05-30",
        "confidence": 0.7,
        "reason": "Deictic reference ('tomorrow') or conflicting sources"
      }
    },
    {
      "timestamp": "2026-05-29T16:15:12Z",
      "agent": "billing_agent",
      "observation_id": "obs-billing-agent-20260529161512000001-000",
      "type": "reasoning",
      "description": "Examining billing signal: CALENDAR_ENTRY_NO_TIMEENTRY",
      "gate": "auto_safe",
      "confidence": 1.0,
      "evidence": [],
      "data": {
        "signal_type": "CALENDAR_ENTRY_NO_TIMEENTRY",
        "entry_id": "cal-okafor-call"
      }
    },
    {
      "timestamp": "2026-05-29T16:15:15Z",
      "agent": "billing_agent",
      "observation_id": "obs-billing-agent-20260529161515000001-001",
      "type": "reasoning",
      "description": "Found calendar event with no matching time entry",
      "gate": "review_required",
      "confidence": 0.95,
      "evidence": ["cal-okafor-call"],
      "data": {
        "calendar_event_id": "cal-okafor-call",
        "matter_id": "okafor-contract-review",
        "duration_minutes": 42,
        "description": "Okafor — client call, contract revisions"
      }
    },
    {
      "timestamp": "2026-05-29T16:15:17Z",
      "agent": "billing_agent",
      "observation_id": "obs-billing-agent-20260529161517000001-002",
      "type": "result",
      "description": "Generated narrative suggestion from context",
      "gate": "review_required",
      "confidence": 0.85,
      "evidence": ["calendar-event-okafor-contract-review", "email-okafor-contract-review"],
      "data": {
        "suggested_narrative": "Client call re: contract revisions and fallback position",
        "sources": ["calendar_event", "email_thread"]
      }
    },
    {
      "timestamp": "2026-05-29T16:15:19Z",
      "agent": "comms_agent",
      "observation_id": "obs-comms-agent-20260529161519000001-000",
      "type": "reasoning",
      "description": "Detected client communication gap",
      "gate": "review_required",
      "confidence": 1.0,
      "evidence": [],
      "data": {
        "matter_id": "mercer-v-dunlap",
        "days_since_contact": 16
      }
    }
  ],
  "summary": "Observed 14 Gmail threads and 6 calendar events. Planned deadline verification, billing reconciliation, and client comms checks. Detected one unverified deadline from opposing counsel, one 42-minute billing gap, and one stale client contact. Escalated one conflicting deadline source and flagged one billing anomaly."
}
```

---

## Next Document

Proceed to **04-REACT-TIMELINE-COMPONENT.md** for UI implementation.
