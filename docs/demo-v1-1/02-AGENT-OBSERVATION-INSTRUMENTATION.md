# 02 — Litt Agent Observation Instrumentation

**Purpose:** Detailed specification for instrumenting agent execution with observable events  
**Audience:** Backend developers, Python experience required  
**Time estimate:** 2 hours to implement  

---

## May 31 Implementation Corrections

Apply these corrections before translating any sample code into the repo:

- The repo currently uses a single canonical model file, `backend/app/models.py`. Either add the observability models there or create a new module only after updating imports consistently. Every persisted Firestore document must extend `LittBaseModel` or otherwise include the same required fields: `id`, `firm_id`, `created_at`, `updated_at`.
- Do not use `datetime.utcnow()`, `datetime.now()`, `date.today()`, or `time.time()` for demo-visible timestamps. Use `config.get_effective_datetime()` so repeated demos are deterministic.
- Treat observations as **explanatory telemetry**, not a second write path. Tools remain the only Firestore write path for business entities, and all writes still call `log_audit_event()`.
- Keep confidence semantics crisp: deterministic checks should be displayed as `source=deterministic` or `confidence=1.0`; LLM-assisted extraction/drafting should show model name, source packet IDs, and confidence.
- Add `work_kind` to observations so judges can see the boundary: `deterministic`, `llm_assisted`, `tool_write`, or `human_gate`.
- Add `attorney_next_action` to observations that produce brief items. A timeline that says "escalated" is useful; a timeline that says "Dana must confirm deadline date before filing" is demo-grade.
- The existing agents are named `deadline_agent`, `billing_agent`, `comms_agent`, and `anomaly_agent`. Prefer those names in implementation and display unless code is renamed.

---

## Data Models

### File: `backend/app/models/observability.py`

Create this new file with complete observation data model.

```python
"""
Agent observation models for making autonomy visible.

Every reasoning step in the agent layer emits an AgentObservation.
These are collected into an AgentRunTimeline for display and audit.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ObservationType(str, Enum):
    """Types of observations agents emit"""
    SIGNAL_RECEIVED = "signal_received"
    REASONING = "reasoning"
    ROUTING_DECISION = "routing_decision"
    TOOL_CALL = "tool_call"
    RESULT = "result"
    ESCALATION = "escalation"
    APPROVAL_GATE_APPLIED = "approval_gate_applied"


class CommitmentLevel(str, Enum):
    """
    Commitment gates determine what happens to an observation.
    
    AUTO_SAFE: Informational only, no action needed. System can proceed.
              Used for: status summaries, informational findings
    
    REVIEW_REQUIRED: Draft/suggestion prepared, awaiting human approval.
                    Used for: draft communications, suggested entries, budget alerts
    
    ESCALATION: Conflicting or insufficient evidence, requires human judgment.
               Used for: conflicting deadline sources, anomalies needing context
    
    BLOCKED: Action exceeds authority, cannot proceed.
            Used for: client email sending, legal conclusions, budget overrides
    """
    AUTO_SAFE = "auto_safe"
    REVIEW_REQUIRED = "review_required"
    ESCALATION = "escalation"
    BLOCKED = "blocked"


class AgentObservation(BaseModel):
    """
    A single observation from an agent.
    
    Every non-deterministic step in agent reasoning emits one of these.
    Multiple observations form an AgentRunTimeline.
    """
    
    # Identity
    observation_id: str = Field(description="Unique ID: obs-{agent}-{timestamp}-{counter}")
    timestamp: datetime = Field(description="When this observation occurred")
    agent_name: str = Field(description="Which agent emitted this (coordinator, deadline_monitor, etc.)")
    
    # Classification
    observation_type: ObservationType = Field(description="Type of observation (signal_received, reasoning, etc.)")
    commitment_level: CommitmentLevel = Field(description="What gate applies to this observation")
    
    # Content
    description: str = Field(
        description="Human-readable description of what was observed. "
                   "Format: imperative verb + object. E.g. 'Detected deadline from opposing counsel'"
    )
    
    # Evidence & Confidence
    data: Dict[str, Any] = Field(
        default_factory=dict,
        description="Structured data backing this observation. "
                   "Example: {'signal_type': 'DEADLINE_CANDIDATE', 'signal_id': 'dl-cand-001'}"
    )
    confidence: Optional[float] = Field(
        default=None,
        description="Confidence (0.0-1.0) if this is an inference. "
                   "None if observation is deterministic (routing, tool calls)."
    )
    evidence: List[str] = Field(
        default_factory=list,
        description="References to evidence supporting this observation. "
                   "Example: ['email-mercer-001', 'calendar-event-456']"
    )
    
    # Context
    run_id: Optional[str] = Field(default=None, description="Which sweep/run this observation belongs to")
    parent_observation_id: Optional[str] = Field(
        default=None,
        description="ID of parent observation (for nested sub-agent work)"
    )
    
    # Audit
    audit_log_id: Optional[str] = Field(
        default=None,
        description="If this observation resulted in an action, the audit log entry ID"
    )
    work_kind: str = Field(
        default="deterministic",
        description="deterministic | llm_assisted | tool_write | human_gate"
    )
    model_name: Optional[str] = Field(
        default=None,
        description="Model used for LLM-assisted work, e.g. gemini-2.5-pro"
    )
    attorney_next_action: Optional[str] = Field(
        default=None,
        description="Plain-language next action for the attorney, when applicable"
    )
    
    class Config:
        use_enum_values = True


class AgentRunTimeline(BaseModel):
    """
    Complete record of a single coordinator sweep or manual run.
    
    Contains all observations in chronological order, final brief, and summary.
    """
    
    # Identity
    run_id: str = Field(description="Unique run ID: sweep-{firm_id}-{timestamp}")
    firm_id: str = Field(description="Which firm this sweep was for")
    
    # Execution context
    triggered_by: str = Field(
        description="What triggered this run: 'scheduled_sweep', 'manual_run', or 'event_trigger'"
    )
    started_at: datetime = Field(description="When coordinator started")
    completed_at: datetime = Field(description="When coordinator finished")
    
    @property
    def elapsed_seconds(self) -> float:
        """Elapsed time in seconds"""
        return (self.completed_at - self.started_at).total_seconds()
    
    # Observations
    observations: List[AgentObservation] = Field(
        default_factory=list,
        description="All observations from this run, in chronological order"
    )
    
    # Output
    brief_items_count: int = Field(
        description="How many items made it into the Daily Closeout Brief"
    )
    escalations_count: int = Field(
        description="How many items were escalated vs. auto-resolved"
    )
    
    # Summary
    @property
    def human_readable_summary(self) -> str:
        """
        Returns a single-paragraph summary like:
        "Observed 14 Gmail threads and 6 calendar events. Planned deadline verification,
        billing reconciliation, and client comms checks. Detected one unverified deadline
        from opposing counsel, one 42-minute billing gap, and one stale client contact.
        Escalated one conflicting deadline source and three billing anomalies."
        """
        summary_parts = []
        
        # Count observations by type
        signal_count = len([o for o in self.observations 
                           if o.observation_type == ObservationType.SIGNAL_RECEIVED])
        escalation_count = len([o for o in self.observations 
                               if o.observation_type == ObservationType.ESCALATION])
        result_count = len([o for o in self.observations 
                           if o.observation_type == ObservationType.RESULT])
        
        # Build summary
        if signal_count > 0:
            summary_parts.append(f"Observed {signal_count} signals from email, calendar, and firm records")
        
        if result_count > 0:
            summary_parts.append(f"Found {result_count} actionable items")
        
        if escalation_count > 0:
            summary_parts.append(f"Escalated {escalation_count} items requiring human judgment")
        
        summary_parts.append(f"Logged all evidence and gates in audit trail")
        
        return ". ".join(summary_parts) + "."
    
    class Config:
        use_enum_values = True


# Helper function for generating observation IDs
def generate_observation_id(agent_name: str, counter: int = 0) -> str:
    """Generate a unique observation ID"""
    # Implementation note: use app.config.get_effective_datetime(), not datetime.utcnow().
    ts = get_effective_datetime().strftime("%Y%m%d%H%M%S%f")
    return f"obs-{agent_name}-{ts}-{counter}"
```

> **Important:** The snippet above is illustrative. If copied directly, import `get_effective_datetime` from `app.config`, add `id`/`firm_id`/`created_at`/`updated_at` fields or inherit from `LittBaseModel`, and use Pydantic v2 `model_config = ConfigDict(use_enum_values=True)` to match the existing codebase.

---

## Updated Audit Log Entry

### Modify: `backend/app/models/audit_log.py`

Add confidence and commitment level tracking to audit log entries.

```python
# Append to existing AuditLogEntry model

class AuditLogEntry(BaseModel):
    """Enhanced audit log with observation chain tracking"""
    
    # ... existing fields ...
    
    # NEW: Observation chain
    observation_id: Optional[str] = Field(
        default=None,
        description="Which observation triggered this audit event"
    )
    observation_chain: List[str] = Field(
        default_factory=list,
        description="List of observation IDs leading to this action"
    )
    
    # NEW: Confidence & gates
    confidence: Optional[float] = Field(
        default=None,
        description="System confidence in the suggested action"
    )
    commitment_level: Optional[str] = Field(
        default=None,
        description="What gate applies: auto_safe, review_required, escalation, blocked"
    )
    evidence: List[str] = Field(
        default_factory=list,
        description="What evidence backed this decision"
    )
    
    # NEW: Human decision
    human_decision: Optional[str] = Field(
        default=None,
        description="What did the human choose: approved, rejected, escalated, etc."
    )
    human_decided_by: Optional[str] = Field(
        default=None,
        description="Attorney ID who made the decision"
    )
    human_decided_at: Optional[datetime] = Field(
        default=None,
        description="When the human made the decision"
    )
    
    # NEW: Outcome
    outcome: str = Field(
        default="pending_human_decision",
        description="What ultimately happened: approved, rejected, escalated, executed, blocked"
    )
```

---

## Coordinator Instrumentation

### File: `backend/app/agents/coordinator.py`

Modify the main coordinator sweep function to emit observations. This is the highest-impact instrumentation.

```python
"""
Modified coordinator.py excerpt showing instrumentation.

Replace the run_coordinator_sweep function with this implementation.
"""

from datetime import datetime
from typing import List, Optional
from app.models.observability import (
    AgentObservation,
    AgentRunTimeline,
    ObservationType,
    CommitmentLevel,
    generate_observation_id,
)
from app.config import get_effective_datetime


class CoordinatorOrchestrator:
    """Main coordinator with instrumentation"""
    
    def __init__(self, firm_id: str):
        self.firm_id = firm_id
        self.observations: List[AgentObservation] = []
        self.observation_counter = 0
        self.run_id: Optional[str] = None
        self.started_at: Optional[datetime] = None
    
    def _emit_observation(
        self,
        observation_type: ObservationType,
        description: str,
        commitment_level: CommitmentLevel,
        data: dict = None,
        confidence: Optional[float] = None,
        evidence: List[str] = None,
    ) -> AgentObservation:
        """
        Emit an observation and add it to the timeline.
        
        Called at every significant step in coordinator execution.
        """
        obs = AgentObservation(
            observation_id=generate_observation_id("coordinator", self.observation_counter),
            timestamp=get_effective_datetime(),
            agent_name="coordinator",
            observation_type=observation_type,
            commitment_level=commitment_level,
            description=description,
            data=data or {},
            confidence=confidence,
            evidence=evidence or [],
            run_id=self.run_id,
        )
        
        self.observations.append(obs)
        self.observation_counter += 1
        
        return obs
    
    async def run_sweep(
        self,
        triggered_by: str = "scheduled_sweep"
    ) -> AgentRunTimeline:
        """
        Main coordinator sweep with full instrumentation.
        
        Emits observations at:
        1. Sweep started
        2. Signals observed
        3. Plan created
        4. Each routing decision
        5. Each sub-agent execution
        6. Brief assembly
        7. Sweep completed
        """
        
        # Initialize
        self.run_id = f"sweep-{self.firm_id}-{get_effective_datetime().isoformat()}"
        self.started_at = get_effective_datetime()
        self.observations = []
        self.observation_counter = 0
        
        # Step 1: OBSERVE — Ingest all signals
        # ========================================
        
        self._emit_observation(
            observation_type=ObservationType.SIGNAL_RECEIVED,
            description="Coordinator initiated, collecting all input signals",
            commitment_level=CommitmentLevel.AUTO_SAFE,
            data={"triggered_by": triggered_by},
            confidence=1.0,
        )
        
        # Pull from all ingestion sources
        gmail_signals = await self._ingest_gmail_candidates(self.firm_id)
        calendar_signals = await self._ingest_calendar_events(self.firm_id)
        timeentry_signals = await self._ingest_pending_entries(self.firm_id)
        
        total_signals = len(gmail_signals) + len(calendar_signals) + len(timeentry_signals)
        
        self._emit_observation(
            observation_type=ObservationType.SIGNAL_RECEIVED,
            description=f"Observed input signals from multiple sources",
            commitment_level=CommitmentLevel.AUTO_SAFE,
            data={
                "gmail_threads": len(gmail_signals),
                "calendar_events": len(calendar_signals),
                "pending_entries": len(timeentry_signals),
                "total_signals": total_signals,
            },
            confidence=1.0,
        )
        
        # Step 2: PLAN — Define what checks will run
        # ==========================================
        
        planned_checks = [
            "deadline_verification",
            "billing_reconciliation",
            "client_comms_check",
            "a_r_watchdog",
            "anomaly_detection",
        ]
        
        self._emit_observation(
            observation_type=ObservationType.REASONING,
            description="Planning comprehensive operational checks",
            commitment_level=CommitmentLevel.AUTO_SAFE,
            data={"planned_checks": planned_checks},
            confidence=1.0,
        )
        
        # Step 3: ROUTE — Classify and route each signal to appropriate sub-agent
        # ======================================================================
        
        brief_items = []
        
        for signal in (gmail_signals + calendar_signals + timeentry_signals):
            # Deterministic routing (not agentic, still logged)
            signal_type = self._classify_signal(signal)
            routed_to = self._determine_routing(signal_type)
            
            self._emit_observation(
                observation_type=ObservationType.ROUTING_DECISION,
                description=f"Routing {signal_type} signal to {routed_to}",
                commitment_level=CommitmentLevel.AUTO_SAFE,
                data={
                    "signal_type": signal_type,
                    "signal_id": signal.get("id"),
                    "routed_to": routed_to,
                },
                confidence=1.0,
            )
            
            # Execute appropriate sub-agent
            sub_agent_result = await self._execute_sub_agent(
                agent_name=routed_to,
                signal=signal,
                parent_observation_id=self.observations[-1].observation_id,
            )
            
            # Collect observations from sub-agent
            if hasattr(sub_agent_result, 'observations'):
                self.observations.extend(sub_agent_result.observations)
            
            # Collect brief items
            if hasattr(sub_agent_result, 'brief_items'):
                brief_items.extend(sub_agent_result.brief_items)
        
        # Step 4: ASSEMBLE — Compile final brief
        # =======================================
        
        self._emit_observation(
            observation_type=ObservationType.RESULT,
            description=f"Assembled Daily Closeout Brief",
            commitment_level=CommitmentLevel.AUTO_SAFE,
            data={
                "brief_items": len(brief_items),
                "awaiting_review": len([i for i in brief_items if i.get("status") == "review_required"]),
                "escalations": len([i for i in brief_items if i.get("status") == "escalation"]),
            },
            confidence=1.0,
        )
        
        # Step 5: COMPLETE — Log summary and return
        # =========================================
        
        completed_at = get_effective_datetime()
        
        self._emit_observation(
            observation_type=ObservationType.RESULT,
            description="Sweep completed, all evidence logged",
            commitment_level=CommitmentLevel.AUTO_SAFE,
            data={"elapsed_seconds": (completed_at - self.started_at).total_seconds()},
            confidence=1.0,
        )
        
        # Create timeline
        timeline = AgentRunTimeline(
            run_id=self.run_id,
            firm_id=self.firm_id,
            triggered_by=triggered_by,
            started_at=self.started_at,
            completed_at=completed_at,
            observations=self.observations,
            brief_items_count=len(brief_items),
            escalations_count=len([i for i in brief_items if i.get("status") == "escalation"]),
        )
        
        return timeline
    
    async def _execute_sub_agent(
        self,
        agent_name: str,
        signal: dict,
        parent_observation_id: str,
    ) -> dict:
        """
        Execute a sub-agent and collect its observations.
        
        Each sub-agent returns its own observations, which get added to timeline.
        """
        
        if agent_name == "deadline_monitor":
            result = await self._deadline_monitor_agent(signal)
        elif agent_name == "billing_agent":
            result = await self._billing_agent(signal)
        elif agent_name == "comms_agent":
            result = await self._comms_agent(signal)
        elif agent_name == "anomaly_agent":
            result = await self._anomaly_agent(signal)
        else:
            raise ValueError(f"Unknown sub-agent: {agent_name}")
        
        return result
    
    # Helper methods (existing, unchanged)
    def _classify_signal(self, signal: dict) -> str:
        """Deterministic signal classification"""
        # Existing implementation
        ...
    
    def _determine_routing(self, signal_type: str) -> str:
        """Deterministic routing decision"""
        # Existing implementation
        ...
    
    async def _ingest_gmail_candidates(self, firm_id: str) -> List[dict]:
        """Fetch Gmail deadline candidates"""
        # Existing implementation
        ...
    
    async def _ingest_calendar_events(self, firm_id: str) -> List[dict]:
        """Fetch Calendar events"""
        # Existing implementation
        ...
    
    async def _ingest_pending_entries(self, firm_id: str) -> List[dict]:
        """Fetch pending time entries"""
        # Existing implementation
        ...
    
    async def _deadline_monitor_agent(self, signal: dict) -> dict:
        """Execute deadline monitor sub-agent"""
        # See "Sub-Agent Instrumentation" section below
        ...
    
    async def _billing_agent(self, signal: dict) -> dict:
        """Execute billing reconciliation sub-agent"""
        # See "Sub-Agent Instrumentation" section below
        ...
    
    async def _comms_agent(self, signal: dict) -> dict:
        """Execute comms sub-agent"""
        # See "Sub-Agent Instrumentation" section below
        ...
    
    async def _anomaly_agent(self, signal: dict) -> dict:
        """Execute anomaly escalation sub-agent"""
        # See "Sub-Agent Instrumentation" section below
        ...
```

---

## Sub-Agent Instrumentation Pattern

### Template: How Each Sub-Agent Emits Observations

All four sub-agents follow this pattern. Implement in order:
1. deadline_monitor_agent
2. billing_agent
3. comms_agent
4. anomaly_agent

```python
"""
Template for sub-agent instrumentation.

Replace the function body in coordinator.py with this pattern.
"""

class SubAgentBase:
    """Base class for instrumented sub-agents"""
    
    def __init__(self, agent_name: str, parent_run_id: str = None):
        self.agent_name = agent_name
        self.parent_run_id = parent_run_id
        self.observations: List[AgentObservation] = []
        self.observation_counter = 0
    
    def _emit_observation(
        self,
        observation_type: ObservationType,
        description: str,
        commitment_level: CommitmentLevel,
        data: dict = None,
        confidence: Optional[float] = None,
        evidence: List[str] = None,
    ) -> AgentObservation:
        """Sub-agents use same emission pattern as coordinator"""
        
        obs = AgentObservation(
            observation_id=generate_observation_id(self.agent_name, self.observation_counter),
            timestamp=get_effective_datetime(),
            agent_name=self.agent_name,
            observation_type=observation_type,
            commitment_level=commitment_level,
            description=description,
            data=data or {},
            confidence=confidence,
            evidence=evidence or [],
            run_id=self.parent_run_id,
        )
        
        self.observations.append(obs)
        self.observation_counter += 1
        
        return obs


# ============================================================================
# DEADLINE MONITOR SUB-AGENT INSTRUMENTATION
# ============================================================================

class DeadlineMonitorAgent(SubAgentBase):
    """Instrumentated deadline monitor with observation emissions"""
    
    def __init__(self, parent_run_id: str = None):
        super().__init__("deadline_monitor", parent_run_id)
    
    async def process_signal(self, signal: dict) -> dict:
        """
        Process a deadline signal with full instrumentation.
        
        Observations emitted:
        1. Signal received
        2. Source investigation (email, calendar, etc.)
        3. Deadline extraction
        4. Classification
        5. Verification status
        6. Escalation or approval
        """
        
        brief_items = []
        
        # OBSERVATION 1: Signal received
        self._emit_observation(
            observation_type=ObservationType.REASONING,
            description=f"Examining deadline candidate from {signal.get('source_type')}",
            commitment_level=CommitmentLevel.AUTO_SAFE,
            data={"source_type": signal.get("source_type"), "signal_id": signal.get("id")},
            confidence=1.0,
        )
        
        # OBSERVATION 2: Investigating source
        source_type = signal.get("source_type")  # "email", "calendar", "manual"
        
        if source_type == "email":
            source_excerpt = signal.get("source_excerpt")
            self._emit_observation(
                observation_type=ObservationType.REASONING,
                description="Checking deadline source: email from opposing counsel",
                commitment_level=CommitmentLevel.AUTO_SAFE,
                data={
                    "source_excerpt": source_excerpt,
                    "from": signal.get("from_address"),
                },
                confidence=1.0,
                evidence=[signal.get("email_id")],
            )
        
        # OBSERVATION 3: Extract and classify deadline
        extracted_date = signal.get("due_date")
        confidence = signal.get("confidence", 0.0)
        
        self._emit_observation(
            observation_type=ObservationType.TOOL_CALL,
            description="Extracting deadline and classification",
            commitment_level=CommitmentLevel.AUTO_SAFE,
            data={"extracted_date": str(extracted_date)},
            confidence=1.0,
        )
        
        # OBSERVATION 4: Classify deadline risk
        classification = await self._classify_deadline(extracted_date, signal.get("matter_id"))
        
        self._emit_observation(
            observation_type=ObservationType.RESULT,
            description=f"Classified as {classification}",
            commitment_level=CommitmentLevel.AUTO_SAFE,
            data={"classification": classification},
            confidence=1.0,
        )
        
        # OBSERVATION 5: Verify or escalate
        # ===================================
        
        # Check: Is this deadline verified?
        is_verified = signal.get("verification_status") == "attorney_verified"
        
        if not is_verified and confidence < 0.85:
            # Case: Unverified deadline with low confidence → ESCALATION
            self._emit_observation(
                observation_type=ObservationType.ESCALATION,
                description="Cannot safely verify deadline. Conflicting or ambiguous evidence.",
                commitment_level=CommitmentLevel.ESCALATION,
                data={
                    "extracted_date": str(extracted_date),
                    "confidence": confidence,
                    "reason": "Deictic reference ('tomorrow') or conflicting sources",
                },
                confidence=confidence,
                evidence=[signal.get("source_id")],
            )
            
            brief_item = {
                "status": "escalation",
                "type": "DEADLINE_VERIFICATION_REQUIRED",
                "matter": signal.get("matter_id"),
                "description": f"Deadline verification required: {source_excerpt}",
                "confidence": confidence,
                "gate": "ESCALATION",
            }
        
        else:
            # Case: Verified deadline or high confidence → REVIEW_REQUIRED or AUTO_SAFE
            days_until = (extracted_date - get_effective_datetime().date()).days
            
            if days_until <= 3:
                gate = CommitmentLevel.ESCALATION  # HARD_LEGAL within 3 days
                status = "escalation"
            else:
                gate = CommitmentLevel.AUTO_SAFE
                status = "approved"
            
            self._emit_observation(
                observation_type=ObservationType.RESULT,
                description=f"Deadline verified: {classification}, {days_until} days out",
                commitment_level=gate,
                data={
                    "due_date": str(extracted_date),
                    "days_until": days_until,
                    "risk_level": "CRITICAL" if days_until <= 3 else "NORMAL",
                },
                confidence=1.0,
                evidence=[signal.get("source_id")],
            )
            
            brief_item = {
                "status": status,
                "type": "DEADLINE_ALERT",
                "matter": signal.get("matter_id"),
                "description": signal.get("description"),
                "due_date": str(extracted_date),
                "days_until": days_until,
                "gate": gate.value,
            }
        
        brief_items.append(brief_item)
        
        return {
            "observations": self.observations,
            "brief_items": brief_items,
        }
    
    async def _classify_deadline(self, due_date, matter_id: str) -> str:
        """Classify deadline as HARD_LEGAL, SOFT_CONTRACTUAL, etc."""
        # Existing implementation
        ...


# ============================================================================
# BILLING AGENT SUB-AGENT INSTRUMENTATION
# ============================================================================

class BillingAgent(SubAgentBase):
    """Instrumented billing reconciliation with observation emissions"""
    
    def __init__(self, parent_run_id: str = None):
        super().__init__("billing_agent", parent_run_id)
    
    async def process_signal(self, signal: dict) -> dict:
        """
        Process a billing signal with full instrumentation.
        
        Observations emitted:
        1. Signal type identified
        2. Entry validation
        3. Narrative check
        4. Task code verification
        5. Suggestion or approval
        """
        
        brief_items = []
        signal_type = signal.get("signal_type")
        
        # OBSERVATION 1: Signal received
        self._emit_observation(
            observation_type=ObservationType.REASONING,
            description=f"Examining billing signal: {signal_type}",
            commitment_level=CommitmentLevel.AUTO_SAFE,
            data={"signal_type": signal_type, "entry_id": signal.get("entry_id")},
            confidence=1.0,
        )
        
        if signal_type == "TIME_ENTRY_PENDING":
            # Handle time entry review
            entry = signal.get("entry")
            
            # OBSERVATION 2: Check narrative
            has_narrative = bool(entry.get("narrative"))
            
            self._emit_observation(
                observation_type=ObservationType.TOOL_CALL,
                description="Checking time entry for complete narrative",
                commitment_level=CommitmentLevel.AUTO_SAFE,
                data={
                    "entry_id": entry.get("id"),
                    "duration_hours": entry.get("duration_hours"),
                    "has_narrative": has_narrative,
                },
                confidence=1.0,
            )
            
            if not has_narrative:
                # OBSERVATION 3: Try to reconstruct narrative from context
                self._emit_observation(
                    observation_type=ObservationType.REASONING,
                    description="Attempting to reconstruct narrative from calendar and email context",
                    commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                    data={
                        "matter_id": entry.get("matter_id"),
                        "date": entry.get("date"),
                    },
                    confidence=1.0,
                )
                
                # Query recent calendar and email for this matter
                suggested_narrative = await self._suggest_narrative(entry)
                
                if suggested_narrative:
                    self._emit_observation(
                        observation_type=ObservationType.RESULT,
                        description="Generated narrative suggestion from context",
                        commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                        data={
                            "suggested_narrative": suggested_narrative,
                            "sources": ["calendar_event", "email_thread"],
                        },
                        confidence=0.85,
                        evidence=[f"calendar-event-{entry.get('matter_id')}", 
                                 f"email-{entry.get('matter_id')}"],
                    )
                    
                    brief_item = {
                        "status": "review_required",
                        "type": "TIME_ENTRY_NARRATIVE",
                        "entry_id": entry.get("id"),
                        "description": "Time entry needs narrative",
                        "suggested_narrative": suggested_narrative,
                        "gate": "REVIEW_REQUIRED",
                    }
                else:
                    brief_item = {
                        "status": "review_required",
                        "type": "TIME_ENTRY_NARRATIVE",
                        "entry_id": entry.get("id"),
                        "description": "Time entry requires manual narrative",
                        "gate": "REVIEW_REQUIRED",
                    }
            
            else:
                # OBSERVATION 4: Run pre-bill scrubber
                self._emit_observation(
                    observation_type=ObservationType.TOOL_CALL,
                    description="Running pre-bill scrubber against narrative",
                    commitment_level=CommitmentLevel.AUTO_SAFE,
                    data={"entry_id": entry.get("id")},
                    confidence=1.0,
                )
                
                scrubber_result = await self._run_prebill_scrubber(entry)
                
                if scrubber_result.get("passed"):
                    self._emit_observation(
                        observation_type=ObservationType.RESULT,
                        description="Pre-bill scrubber passed",
                        commitment_level=CommitmentLevel.AUTO_SAFE,
                        data={"entry_id": entry.get("id")},
                        confidence=1.0,
                    )
                    
                    brief_item = {
                        "status": "approved",
                        "type": "TIME_ENTRY_APPROVED",
                        "entry_id": entry.get("id"),
                        "gate": "AUTO_SAFE",
                    }
                
                else:
                    # Scrubber found issues
                    self._emit_observation(
                        observation_type=ObservationType.ESCALATION,
                        description=f"Pre-bill scrubber flagged issue: {scrubber_result.get('issue')}",
                        commitment_level=CommitmentLevel.ESCALATION,
                        data={
                            "entry_id": entry.get("id"),
                            "issue": scrubber_result.get("issue"),
                            "reason": scrubber_result.get("reason"),
                        },
                        confidence=0.95,
                    )
                    
                    brief_item = {
                        "status": "escalation",
                        "type": "TIME_ENTRY_SCRUBBER_FLAG",
                        "entry_id": entry.get("id"),
                        "issue": scrubber_result.get("issue"),
                        "gate": "ESCALATION",
                    }
        
        elif signal_type == "CALENDAR_ENTRY_NO_TIMEENTRY":
            # Handle billing gap: calendar event without corresponding time entry
            calendar_event = signal.get("calendar_event")
            duration_minutes = signal.get("duration_minutes")
            
            self._emit_observation(
                observation_type=ObservationType.REASONING,
                description="Found calendar event with no matching time entry",
                commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                data={
                    "calendar_event_id": calendar_event.get("id"),
                    "matter_id": calendar_event.get("matter_id"),
                    "duration_minutes": duration_minutes,
                    "description": calendar_event.get("summary"),
                },
                confidence=0.95,
                evidence=[calendar_event.get("id")],
            )
            
            # Suggest time entry
            suggested_entry = await self._suggest_timeentry_from_calendar(calendar_event)
            
            self._emit_observation(
                observation_type=ObservationType.RESULT,
                description="Generated suggested time entry from calendar event",
                commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                data={
                    "suggested_narrative": suggested_entry.get("narrative"),
                    "suggested_hours": duration_minutes / 60,
                },
                confidence=0.85,
                evidence=[calendar_event.get("id")],
            )
            
            brief_item = {
                "status": "review_required",
                "type": "TIME_ENTRY_SUGGESTION",
                "calendar_event_id": calendar_event.get("id"),
                "matter_id": calendar_event.get("matter_id"),
                "suggested_narrative": suggested_entry.get("narrative"),
                "suggested_hours": duration_minutes / 60,
                "gate": "REVIEW_REQUIRED",
            }
        
        brief_items.append(brief_item)
        
        return {
            "observations": self.observations,
            "brief_items": brief_items,
        }
    
    async def _suggest_narrative(self, entry: dict) -> Optional[str]:
        """Reconstruct narrative from calendar + email"""
        # Implementation: query recent calendar and email for this matter
        ...
    
    async def _run_prebill_scrubber(self, entry: dict) -> dict:
        """Run pre-bill rules (LEDES, firm guidelines)"""
        # Existing implementation
        ...
    
    async def _suggest_timeentry_from_calendar(self, calendar_event: dict) -> dict:
        """Generate suggested time entry from calendar"""
        # Implementation: extract narrative from event title + description
        ...


# ============================================================================
# COMMS AGENT SUB-AGENT INSTRUMENTATION
# ============================================================================

class CommsAgent(SubAgentBase):
    """Instrumented comms agent with observation emissions"""
    
    def __init__(self, parent_run_id: str = None):
        super().__init__("comms_agent", parent_run_id)
    
    async def process_signal(self, signal: dict) -> dict:
        """
        Process a comms signal with full instrumentation.
        
        Observations emitted:
        1. Client silence detected
        2. Last contact checked
        3. Matter history analyzed
        4. Draft prepared
        """
        
        brief_items = []
        signal_type = signal.get("signal_type")
        
        if signal_type == "CLIENT_SILENCE":
            matter_id = signal.get("matter_id")
            days_since_contact = signal.get("days_since_contact")
            
            # OBSERVATION 1: Client silence detected
            self._emit_observation(
                observation_type=ObservationType.REASONING,
                description=f"Detected client communication gap",
                commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                data={
                    "matter_id": matter_id,
                    "days_since_contact": days_since_contact,
                },
                confidence=1.0,
            )
            
            # OBSERVATION 2: Extract matter history
            self._emit_observation(
                observation_type=ObservationType.TOOL_CALL,
                description="Extracting recent matter activity for context",
                commitment_level=CommitmentLevel.AUTO_SAFE,
                data={"matter_id": matter_id},
                confidence=1.0,
            )
            
            # Query recent billing, deadlines, and status
            matter_context = await self._extract_matter_context(matter_id)
            
            # OBSERVATION 3: Prepare draft
            self._emit_observation(
                observation_type=ObservationType.REASONING,
                description="Preparing source-backed status update",
                commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                data={
                    "facts_extracted": len(matter_context.get("facts", [])),
                },
                confidence=0.9,
                evidence=[f"matter-{matter_id}"],
            )
            
            # Use FactPacket for source-backed draft
            draft = await self._generate_client_comms_draft(matter_context)
            
            self._emit_observation(
                observation_type=ObservationType.RESULT,
                description="Client status update drafted from case history",
                commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                data={
                    "draft_length": len(draft.get("body", "")),
                    "facts_cited": draft.get("fact_ids", []),
                },
                confidence=0.85,
                evidence=[f"matter-{matter_id}"],
            )
            
            brief_item = {
                "status": "review_required",
                "type": "CLIENT_COMMS_DRAFT",
                "matter_id": matter_id,
                "days_since_contact": days_since_contact,
                "draft_subject": draft.get("subject"),
                "draft_body": draft.get("body"),
                "fact_citations": draft.get("fact_ids"),
                "gate": "REVIEW_REQUIRED",
            }
            
            brief_items.append(brief_item)
        
        return {
            "observations": self.observations,
            "brief_items": brief_items,
        }
    
    async def _extract_matter_context(self, matter_id: str) -> dict:
        """Extract recent activity, deadlines, billing for FactPacket"""
        # Existing implementation
        ...
    
    async def _generate_client_comms_draft(self, matter_context: dict) -> dict:
        """Generate draft using FactPacket"""
        # Existing implementation
        ...


# ============================================================================
# ANOMALY AGENT SUB-AGENT INSTRUMENTATION
# ============================================================================

class AnomalyAgent(SubAgentBase):
    """Instrumented anomaly detection with observation emissions"""
    
    def __init__(self, parent_run_id: str = None):
        super().__init__("anomaly_agent", parent_run_id)
    
    async def process_signal(self, signal: dict) -> dict:
        """
        Process an anomaly signal with full instrumentation.
        
        Observations emitted:
        1. Anomaly type identified
        2. Severity scoring
        3. Confidence assessment
        4. Escalation decision
        """
        
        brief_items = []
        anomaly_data = signal.get("anomaly_data")
        
        # OBSERVATION 1: Anomaly detected
        self._emit_observation(
            observation_type=ObservationType.REASONING,
            description=f"Analyzing detected anomaly",
            commitment_level=CommitmentLevel.AUTO_SAFE,
            data={
                "anomaly_type": anomaly_data.get("type"),
                "entity_id": anomaly_data.get("entity_id"),
            },
            confidence=1.0,
        )
        
        # OBSERVATION 2: Score severity & confidence
        severity = await self._compute_severity(anomaly_data)
        confidence = anomaly_data.get("confidence", 0.7)
        
        self._emit_observation(
            observation_type=ObservationType.TOOL_CALL,
            description="Computing anomaly severity and confidence",
            commitment_level=CommitmentLevel.AUTO_SAFE,
            data={
                "severity": severity,
                "confidence": confidence,
                "escalation_score": severity * confidence,
            },
            confidence=1.0,
        )
        
        # OBSERVATION 3: Determine gate
        escalation_score = severity * confidence
        
        if escalation_score >= 3.5:
            gate = CommitmentLevel.ESCALATION
        elif escalation_score >= 2.5:
            gate = CommitmentLevel.REVIEW_REQUIRED
        else:
            gate = CommitmentLevel.AUTO_SAFE
        
        self._emit_observation(
            observation_type=ObservationType.RESULT,
            description=f"Anomaly gate determined: {gate.value}",
            commitment_level=gate,
            data={
                "anomaly_type": anomaly_data.get("type"),
                "severity": severity,
                "confidence": confidence,
                "escalation_score": escalation_score,
            },
            confidence=1.0,
            evidence=[anomaly_data.get("entity_id")],
        )
        
        brief_item = {
            "status": "escalation" if gate == CommitmentLevel.ESCALATION else "review_required" if gate == CommitmentLevel.REVIEW_REQUIRED else "info",
            "type": "ANOMALY",
            "anomaly_type": anomaly_data.get("type"),
            "severity": severity,
            "confidence": confidence,
            "description": anomaly_data.get("description"),
            "gate": gate.value,
        }
        
        brief_items.append(brief_item)
        
        return {
            "observations": self.observations,
            "brief_items": brief_items,
        }
    
    async def _compute_severity(self, anomaly_data: dict) -> int:
        """Compute anomaly severity (1-5)"""
        # Existing implementation
        ...
```

---

## Integration Checklist

### Before Starting Implementation

- [ ] Copy `observability.py` model definitions to `backend/app/models/`
- [ ] Update `audit_log.py` with new fields
- [ ] Ensure all sub-agents are currently working
- [ ] Verify Firestore is configured

### Implementation Order

- [ ] **Step 1:** Implement `observability.py` models
- [ ] **Step 2:** Update `audit_log.py`
- [ ] **Step 3:** Modify `coordinator.py` with instrumentation
- [ ] **Step 4:** Instrument deadline_monitor sub-agent
- [ ] **Step 5:** Instrument billing_agent sub-agent
- [ ] **Step 6:** Instrument comms_agent sub-agent
- [ ] **Step 7:** Instrument anomaly_agent sub-agent
- [ ] **Step 8:** Test with `POST /api/sweep` (API not yet built, next doc)
- [ ] **Step 9:** Verify observations are emitted and collected
- [ ] **Step 10:** Verify audit log entries have observation chains

### Testing

After each phase:

```bash
# Test models compile
python -m pytest backend/tests/test_models_observability.py -v

# Test coordinator sweep emits observations
python -m pytest backend/tests/test_coordinator_instrumentation.py -v

# Test sub-agent observations are collected
python -m pytest backend/tests/test_subagent_observations.py -v
```

---

## Key Implementation Notes

### 0. Do Not Create a Parallel Audit System

The current repo already has `backend/app/tools/audit.py` with `log_audit_event()`. Extend that audit event payload or wrap it in a helper inside the tool layer, but do not import route helpers from tools and do not introduce a second audit writer. The demo must reinforce the product promise that every write goes through one auditable path.

### 1. Observation IDs Must Be Unique

```python
# Good: microsecond + counter
obs_id = f"obs-coordinator-20260529161500123456-001"

# Bad: timestamp only (duplicates in same second)
obs_id = f"obs-coordinator-20260529161500"
```

### 2. Emit Before, Not After

```python
# Good: emit before executing sub-agent
self._emit_observation(...routing decision...)
result = await self._execute_sub_agent(...)

# Bad: emit after (loses execution context)
result = await self._execute_sub_agent(...)
self._emit_observation(...result...)  # No, too late
```

### 3. Confidence Is Only for Inferences

```python
# Good: deterministic (routing, tool calls) → confidence=1.0
self._emit_observation(
    observation_type=ObservationType.ROUTING_DECISION,
    confidence=1.0,  # Deterministic
)

# Good: inference (deadline from email) → confidence=0.95
self._emit_observation(
    observation_type=ObservationType.RESULT,
    confidence=0.95,  # Inferred from email
)

# Bad: missing confidence on inference
self._emit_observation(
    observation_type=ObservationType.RESULT,
    # No confidence field → looks deterministic
)
```

### 4. Evidence Is Always a List

```python
# Good
evidence=[signal.get("email_id"), signal.get("calendar_event_id")]

# Bad
evidence=signal.get("email_id")  # String, not list
```

### 5. Parent Observation Chain

Sub-agents can reference parent observations:

```python
# Sub-agent knows it was routed by coordinator
self.observations[0].parent_observation_id = coordinator_routing_obs_id
```

### 6. Make Gemini Visible Without Making Gemini Responsible

For any LLM-assisted observation, include:

```python
data={
    "llm_role": "draft_client_update",
    "fact_packet_ids": ["fact-matter-activity-001", "fact-budget-001"],
    "validated_against_sources": True,
}
work_kind="llm_assisted"
model_name=GEMINI_MODEL
commitment_level=CommitmentLevel.REVIEW_REQUIRED
attorney_next_action="Review and approve the draft before any client communication is queued."
```

Never describe Gemini as deciding deadline validity, billing approval, escalation gates, routing, or state transitions. Those are deterministic Python decisions.

---

## Next Document

Proceed to **03-AUDIT-LOG-AND-API.md** for API endpoint implementation and Firestore schema.
