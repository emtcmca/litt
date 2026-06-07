"""
Agent observability models — ObservationType, CommitmentLevel, AgentObservation,
AgentRunTimeline, and generate_observation_id().

These are the sole source of truth for observation shape across backend and frontend.
TypeScript counterparts live in dashboard/src/types.ts.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.config import get_effective_datetime


_KIND_TO_WORK: Dict[str, str] = {
    "read": "deterministic",
    "compute": "deterministic",
    "write": "tool_write",
    "gemini": "llm_assisted",
}


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class ObservationType(str, Enum):
    SIGNAL_RECEIVED = "SIGNAL_RECEIVED"
    REASONING = "REASONING"
    ROUTING_DECISION = "ROUTING_DECISION"
    TOOL_CALL = "TOOL_CALL"
    RESULT = "RESULT"
    ESCALATION = "ESCALATION"
    APPROVAL_GATE_APPLIED = "APPROVAL_GATE_APPLIED"
    # v1.1.1
    MATTER_SYNTHESIS = "MATTER_SYNTHESIS"
    COMPOUND_RISK = "COMPOUND_RISK"
    INBOX_TRIAGE = "INBOX_TRIAGE"
    WARN_NOTICE = "WARN_NOTICE"
    ROUTE_HANDOFF = "ROUTE_HANDOFF"


class CommitmentLevel(str, Enum):
    """
    Four-gate safety model. Every observation declares what kind of action was taken
    or blocked.

    AUTO_SAFE       — deterministic check, no attorney input needed
    REVIEW_REQUIRED — LLM output needs attorney review before action
    ESCALATION      — conflict or risk detected, attorney must decide
    BLOCKED         — action refused, human gate triggered
    """
    AUTO_SAFE = "AUTO_SAFE"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    ESCALATION = "ESCALATION"
    BLOCKED = "BLOCKED"


# ---------------------------------------------------------------------------
# Core observation model
# ---------------------------------------------------------------------------


class AgentObservation(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    observation_id: str
    timestamp: datetime
    agent_name: str

    observation_type: ObservationType
    commitment_level: CommitmentLevel

    description: str
    data: Dict[str, Any] = Field(default_factory=dict)

    confidence: Optional[float] = None
    evidence: List[str] = Field(default_factory=list)

    run_id: Optional[str] = None
    parent_observation_id: Optional[str] = None
    audit_log_id: Optional[str] = None

    # Shows judges exactly where Gemini operates vs. deterministic Python.
    # Values: deterministic | llm_assisted | tool_write | human_gate
    work_kind: str = "deterministic"
    model_name: Optional[str] = None

    # Plain-language next action for ESCALATION and BLOCKED observations.
    # Required for those two levels; optional for others.
    attorney_next_action: Optional[str] = None


# ---------------------------------------------------------------------------
# Timeline — one per sweep run
# ---------------------------------------------------------------------------


class AgentRunTimeline(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    run_id: str
    firm_id: str
    triggered_by: str

    started_at: datetime
    completed_at: datetime
    elapsed_seconds: float  # plain Field — NOT @property; Pydantic won't serialize @property

    observations: List[AgentObservation] = Field(default_factory=list)

    brief_items_count: int = 0
    escalations_count: int = 0


# ---------------------------------------------------------------------------
# ID generator
# ---------------------------------------------------------------------------


def generate_observation_id(agent_name: str, counter: int = 0) -> str:
    """
    Deterministic-ish ID: timestamp prefix + agent slug + counter.
    Uses config.get_effective_datetime() so demo clock is respected.
    """
    ts = get_effective_datetime().strftime("%Y%m%d%H%M%S%f")
    slug = agent_name.lower().replace(" ", "-").replace("_", "-")
    return f"obs-{ts}-{slug}-{counter:03d}"


def make_tool_call(
    agent_name: str,
    tool_name: str,
    result: Any,
    commitment_level: CommitmentLevel,
    confidence: Optional[float] = None,
    counter: int = 0,
) -> "AgentObservation":
    """
    Build a TOOL_CALL observation with data.tool enrichment for Agent Console.
    Looks up kind and signature from TOOL_REGISTRY; safe if tool not registered.
    """
    from app.tools.registry import TOOL_REGISTRY  # local import avoids circular dep

    spec = TOOL_REGISTRY.get(tool_name)
    kind = spec.kind.value if spec else "compute"
    signature = spec.signature if spec else ""
    work = _KIND_TO_WORK.get(kind, "deterministic")
    return AgentObservation(
        observation_id=generate_observation_id(agent_name, counter),
        timestamp=get_effective_datetime(),
        agent_name=agent_name,
        observation_type=ObservationType.TOOL_CALL,
        commitment_level=commitment_level,
        description=f"{tool_name}",
        work_kind=work,
        model_name="gemini-2.5-pro" if kind == "gemini" else None,
        confidence=confidence,
        data={
            "tool": {
                "name": tool_name,
                "kind": kind,
                "signature": signature,
                "result": result,
            }
        },
    )
