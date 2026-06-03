"""
Coordinator — Python routing layer that orchestrates sub-agents.

Routing is deterministic Python (SIGNAL_ROUTING dict + classify_signal()).
Gemini is never asked "which agent should handle this signal?"

Architecture:
  Coordinator.execute_sweep(firm_id)
    → BillingAgent.run(firm_id)     [scans time entries, logs anomalies]
    → DeadlineAgent.run(firm_id)    [scans deadlines, logs escalations]
    → [CommsAgent, AnomalyAgent — Day 4]
    → return SweepResult

MCP toolset connection:
  In production (v1.1), this coordinator runs as a separate Cloud Run service
  and connects to the tool layer via MCPToolset(SseServerParams(url=MCP_URL)).
  In v1.0, coordinator and tools share the same FastAPI process, so tool
  functions are called directly as Python imports.
"""

from __future__ import annotations

import time
import uuid
from datetime import timedelta
from enum import Enum
from typing import Dict, List

from app.agents.anomaly_agent import AnomalyAgent
from app.agents.billing_agent import BillingAgent
from app.agents.comms_agent import CommsAgent
from app.agents.deadline_agent import DeadlineAgent
from app.config import get_effective_datetime
from app.db import collection_ref
from app.observability import (
    AgentObservation,
    AgentRunTimeline,
    CommitmentLevel,
    ObservationType,
    generate_observation_id,
)


class SignalType(str, Enum):
    DEADLINE_CANDIDATE = "DEADLINE_CANDIDATE"
    DEADLINE_APPROACHING = "DEADLINE_APPROACHING"
    TIME_ENTRY_PENDING = "TIME_ENTRY_PENDING"
    BUDGET_THRESHOLD = "BUDGET_THRESHOLD"
    CLIENT_SILENCE = "CLIENT_SILENCE"
    INVOICE_GENERATED = "INVOICE_GENERATED"
    BILLING_ANOMALY = "BILLING_ANOMALY"
    OPERATIONAL_ANOMALY = "OPERATIONAL_ANOMALY"


SIGNAL_ROUTING: Dict[SignalType, str] = {
    SignalType.DEADLINE_CANDIDATE: "deadline_agent",
    SignalType.DEADLINE_APPROACHING: "deadline_agent",
    SignalType.TIME_ENTRY_PENDING: "billing_agent",
    SignalType.BUDGET_THRESHOLD: "billing_agent",
    SignalType.CLIENT_SILENCE: "comms_agent",
    SignalType.INVOICE_GENERATED: "comms_agent",
    SignalType.BILLING_ANOMALY: "anomaly_agent",
    SignalType.OPERATIONAL_ANOMALY: "anomaly_agent",
}


def classify_signal(signal_type_str: str) -> SignalType:
    """
    Deterministic classification. Returns SignalType enum.
    Never calls Gemini. Unknown types default to OPERATIONAL_ANOMALY.
    """
    try:
        return SignalType(signal_type_str)
    except ValueError:
        return SignalType.OPERATIONAL_ANOMALY


def route_signal(signal_type_str: str) -> List[str]:
    """Returns list of agent names to invoke for this signal type."""
    signal_type = classify_signal(signal_type_str)
    agent_name = SIGNAL_ROUTING.get(signal_type, "anomaly_agent")
    return [agent_name]


class Coordinator:
    """
    Orchestrates sub-agents for a firm sweep.
    Routing is deterministic Python — not LLM.
    """

    def __init__(self):
        self._billing = BillingAgent()
        self._deadline = DeadlineAgent()
        self._comms = CommsAgent()
        self._anomaly = AnomalyAgent()

    def execute_sweep(self, firm_id: str) -> AgentRunTimeline:
        """
        Run all four sub-agents, emit coordinator-level observations, return AgentRunTimeline.

        Observation order (for frontend playback):
          pre-run:   SIGNAL_RECEIVED, ROUTING_DECISION, TOOL_CALL (coordinator)
          mid-run:   sub-agent observations (Phase 4 adds via result["observations"])
          post-run:  RESULT, APPROVAL_GATE_APPLIED (coordinator)
        """
        run_id = f"sweep-{uuid.uuid4().hex[:12]}"
        start_wall = time.time()
        started_at = get_effective_datetime()
        counter = 0

        def _obs(**kwargs) -> AgentObservation:
            nonlocal counter
            counter += 1
            return AgentObservation(
                observation_id=generate_observation_id("coordinator", counter),
                timestamp=get_effective_datetime(),
                agent_name="coordinator",
                run_id=run_id,
                work_kind=kwargs.pop("work_kind", "deterministic"),
                **kwargs,
            )

        # --- Pre-run: 3 coordinator observations ---

        pre_obs: List[AgentObservation] = [
            _obs(
                observation_type=ObservationType.SIGNAL_RECEIVED,
                commitment_level=CommitmentLevel.AUTO_SAFE,
                description=f"Daily sweep initiated for {firm_id}",
                data={"firm_id": firm_id, "triggered_by": "api"},
            ),
            _obs(
                observation_type=ObservationType.ROUTING_DECISION,
                commitment_level=CommitmentLevel.AUTO_SAFE,
                description="Deterministic routing: all 4 sub-agents scheduled",
                data={"agents": ["billing_agent", "deadline_agent", "comms_agent", "anomaly_agent"]},
            ),
            _obs(
                observation_type=ObservationType.TOOL_CALL,
                commitment_level=CommitmentLevel.AUTO_SAFE,
                description="Dispatching sub-agents — billing, deadline, comms, anomaly",
            ),
        ]

        # --- Sub-agent runs ---
        # Each result dict may include "observations" (Phase 4 adds them).
        # Collected here so coordinator is unchanged when sub-agents are instrumented.

        sub_obs: List[AgentObservation] = []

        billing_result = self._billing.run(firm_id, run_id=run_id)
        sub_obs.extend(billing_result.get("observations", []))

        deadline_result = self._deadline.run(firm_id, run_id=run_id)
        sub_obs.extend(deadline_result.get("observations", []))

        comms_result = self._comms.run(firm_id, run_id=run_id)
        sub_obs.extend(comms_result.get("observations", []))

        anomaly_result = self._anomaly.run(firm_id, run_id=run_id)
        sub_obs.extend(anomaly_result.get("observations", []))

        # --- Counts (new vs. existing-idempotency-hit) ---

        new_anomalies = (
            billing_result.get("new_anomalies", billing_result["anomalies_logged"])
            + anomaly_result.get("new_anomalies", anomaly_result["anomalies_logged"])
        )
        existing_anomalies = (
            billing_result.get("existing_anomalies", 0)
            + anomaly_result.get("existing_anomalies", 0)
        )
        new_escalations = deadline_result["escalations_created"] + new_anomalies

        # --- Post-run: 2 coordinator observations ---

        gate_level = CommitmentLevel.ESCALATION if new_escalations > 0 else CommitmentLevel.AUTO_SAFE
        attorney_action = (
            f"Review {new_escalations} new escalation(s) in Daily Closeout Brief before approving any actions."
            if new_escalations > 0
            else None
        )

        existing_note = (
            f" · {existing_anomalies} existing already under review (idempotency skip)"
            if existing_anomalies > 0 else ""
        )

        post_obs: List[AgentObservation] = [
            _obs(
                observation_type=ObservationType.RESULT,
                commitment_level=gate_level,
                description=(
                    f"Sub-agents complete: {new_escalations} new escalation(s), "
                    f"{new_anomalies} new anomal{'ies' if new_anomalies != 1 else 'y'}"
                    + existing_note
                ),
                data={
                    "billing_new_anomalies": billing_result.get("new_anomalies", 0),
                    "deadline_escalations": deadline_result["escalations_created"],
                    "comms_created": comms_result["comms_created"],
                    "anomaly_new_anomalies": anomaly_result.get("new_anomalies", 0),
                    "total_new_escalations": new_escalations,
                    "existing_anomalies_skipped": existing_anomalies,
                },
            ),
            _obs(
                observation_type=ObservationType.APPROVAL_GATE_APPLIED,
                commitment_level=gate_level,
                description=(
                    f"Gate: {gate_level.value} — "
                    + (
                        f"{new_escalations} new item(s) require attorney review"
                        if new_escalations > 0
                        else "no new items — all existing or resolved"
                        + (f" ({existing_anomalies} already under review)" if existing_anomalies else "")
                    )
                ),
                data={
                    "gate": gate_level.value,
                    "new_escalations_count": new_escalations,
                    "existing_anomalies_skipped": existing_anomalies,
                },
                attorney_next_action=attorney_action,
            ),
        ]

        all_observations = pre_obs + sub_obs + post_obs

        elapsed_s = time.time() - start_wall
        completed_at = started_at + timedelta(seconds=elapsed_s)

        timeline = AgentRunTimeline(
            run_id=run_id,
            firm_id=firm_id,
            triggered_by="api",
            started_at=started_at,
            completed_at=completed_at,
            elapsed_seconds=elapsed_s,
            observations=all_observations,
            brief_items_count=0,  # updated by route after brief assembly
            escalations_count=new_escalations,
        )

        # TELEMETRY EXCEPTION: coordinator writes agent_runs directly.
        # All business-entity writes go through the tool layer (app/tools/).
        # agent_runs is append-only observability telemetry — never drives business logic.
        try:
            collection_ref(firm_id, "agent_runs").document(run_id).set(
                timeline.model_dump(mode="json")
            )
        except Exception:
            pass  # telemetry write failure never aborts a sweep

        return timeline
