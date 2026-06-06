"""
Coordinator — Python routing layer that orchestrates sub-agents.

v1.1.1 changes:
  - Parallel Round 1: BillingAgent, DeadlineAgent, AnomalyAgent via ThreadPoolExecutor
  - Round 2: CommsAgent receives budget_signals from BillingAgent
  - 30-second timeout per agent; partial results never crash the brief
  - Correlation pass: groups signals by matter_id; emits CompoundSignal
  - log_escalation(COMPOUND) when ≥2 agents fire on the same matter
  - matter_signals dict returned in timeline for brief assembler ordering

Architecture:
  Coordinator.execute_sweep(firm_id)
    Round 1 (parallel): BillingAgent · DeadlineAgent · AnomalyAgent
    Round 2 (sequential): CommsAgent(budget_signals=billing.budget_signals)
    Correlation pass → CompoundSignal per multi-agent matter
    → AgentRunTimeline

Routing is deterministic Python. Gemini never decides which agent handles a signal.
"""

from __future__ import annotations

import time
import uuid
from concurrent.futures import Future, ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from dataclasses import dataclass, field
from datetime import timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set

from app.agents.anomaly_agent import AnomalyAgent
from app.agents.billing_agent import BillingAgent
from app.agents.comms_agent import CommsAgent
from app.agents.deadline_agent import DeadlineAgent
from app.config import get_effective_datetime
from app.db import collection_ref
from app.models import EscalationType, RiskLevel, ToolResult
from app.observability import (
    AgentObservation,
    AgentRunTimeline,
    CommitmentLevel,
    ObservationType,
    generate_observation_id,
)
from app.tools.alerts import log_escalation

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AGENT_TIMEOUT_SECONDS = 30

# ---------------------------------------------------------------------------
# Signal routing (deterministic Python — no LLM)
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# CompoundSignal
# ---------------------------------------------------------------------------


@dataclass
class CompoundSignal:
    matter_id: str
    contributing_agents: List[str]
    signals: List[str]
    severity: str = "ELEVATED"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _empty_result(agent_name: str) -> Dict[str, Any]:
    """Safe partial result when an agent times out or errors."""
    return {
        "agent": agent_name,
        "partial": True,
        "anomalies_logged": 0,
        "new_anomalies": 0,
        "existing_anomalies": 0,
        "escalations_created": 0,
        "comms_created": 0,
        "budget_signals": {},
        "matters_touched": [],
        "observations": [],
    }


def _safe_result(
    future: Future,
    agent_name: str,
    timeout: int = AGENT_TIMEOUT_SECONDS,
) -> Dict[str, Any]:
    """
    Fetch future result with timeout. Returns partial result on failure.
    Timeout or exception never crashes the sweep.
    """
    try:
        return future.result(timeout=timeout)
    except FutureTimeoutError:
        return {**_empty_result(agent_name), "error": "timeout"}
    except Exception as exc:
        return {**_empty_result(agent_name), "error": str(exc)}


def _correlation_pass(
    results: List[Dict[str, Any]],
) -> List[CompoundSignal]:
    """
    Group matters by how many agents touched them.
    Returns CompoundSignal for every matter touched by ≥2 agents.
    """
    matter_agents: Dict[str, Set[str]] = {}

    for result in results:
        agent_name = result.get("agent", "unknown")
        for matter_id in result.get("matters_touched", []):
            if not matter_id:
                continue
            if matter_id not in matter_agents:
                matter_agents[matter_id] = set()
            matter_agents[matter_id].add(agent_name)

    compounds: List[CompoundSignal] = []
    for matter_id, agents in matter_agents.items():
        if len(agents) >= 2:
            severity = "CRITICAL" if len(agents) >= 3 else "ELEVATED"
            compounds.append(CompoundSignal(
                matter_id=matter_id,
                contributing_agents=sorted(agents),
                signals=[f"{a} flagged {matter_id}" for a in sorted(agents)],
                severity=severity,
            ))

    return compounds


# ---------------------------------------------------------------------------
# Coordinator
# ---------------------------------------------------------------------------


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

        Round 1 (parallel): BillingAgent, DeadlineAgent, AnomalyAgent
        Round 2 (sequential): CommsAgent with budget_signals from BillingAgent
        Correlation pass: CompoundSignal per matter touched by ≥2 agents
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

        # --- Pre-run observations ---

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
                description=(
                    "Round 1 (parallel): billing, deadline, anomaly — "
                    "Round 2 (sequential): comms with budget_signals"
                ),
                data={
                    "round_1": ["billing_agent", "deadline_agent", "anomaly_agent"],
                    "round_2": ["comms_agent"],
                    "timeout_seconds": AGENT_TIMEOUT_SECONDS,
                },
            ),
            _obs(
                observation_type=ObservationType.TOOL_CALL,
                commitment_level=CommitmentLevel.AUTO_SAFE,
                description="Dispatching Round 1 sub-agents in parallel",
            ),
        ]

        # --- Round 1: parallel execution ---

        sub_obs: List[AgentObservation] = []

        with ThreadPoolExecutor(max_workers=3) as executor:
            billing_future = executor.submit(self._billing.run, firm_id, run_id)
            deadline_future = executor.submit(self._deadline.run, firm_id, run_id)
            anomaly_future = executor.submit(self._anomaly.run, firm_id, run_id)

            billing_result = _safe_result(billing_future, "billing_agent")
            deadline_result = _safe_result(deadline_future, "deadline_agent")
            anomaly_result = _safe_result(anomaly_future, "anomaly_agent")

        # Emit timeout observations if any agent was partial
        for result, label in [
            (billing_result, "billing_agent"),
            (deadline_result, "deadline_agent"),
            (anomaly_result, "anomaly_agent"),
        ]:
            if result.get("partial"):
                sub_obs.append(_obs(
                    observation_type=ObservationType.WARN_NOTICE,
                    commitment_level=CommitmentLevel.AUTO_SAFE,
                    description=(
                        f"{label} did not complete within {AGENT_TIMEOUT_SECONDS}s — "
                        f"partial result used: {result.get('error', 'unknown error')}"
                    ),
                    data={"agent": label, "partial": True, "error": result.get("error", "")},
                ))

        sub_obs.extend(billing_result.get("observations", []))
        sub_obs.extend(deadline_result.get("observations", []))
        sub_obs.extend(anomaly_result.get("observations", []))

        # --- Round 2: CommsAgent with budget_signals from billing ---

        budget_signals = billing_result.get("budget_signals", {})

        sub_obs.append(_obs(
            observation_type=ObservationType.ROUTING_DECISION,
            commitment_level=CommitmentLevel.AUTO_SAFE,
            description=(
                f"Round 2: comms_agent receiving {len(budget_signals)} budget signal(s) "
                f"from billing_agent"
            ),
            data={"budget_signal_clients": list(budget_signals.keys())},
        ))

        try:
            comms_result = self._comms.run(
                firm_id, run_id=run_id, budget_signals=budget_signals
            )
        except Exception as exc:
            comms_result = {**_empty_result("comms_agent"), "error": str(exc)}
            sub_obs.append(_obs(
                observation_type=ObservationType.WARN_NOTICE,
                commitment_level=CommitmentLevel.AUTO_SAFE,
                description=f"comms_agent failed: {exc}",
                data={"agent": "comms_agent", "error": str(exc)},
            ))

        sub_obs.extend(comms_result.get("observations", []))

        # --- Correlation pass ---

        all_results = [billing_result, deadline_result, anomaly_result, comms_result]
        compound_signals = _correlation_pass(all_results)

        matter_signals: Dict[str, Dict[str, Any]] = {}
        compound_esc_ids: List[str] = []

        for cs in compound_signals:
            matter_signals[cs.matter_id] = {
                "contributing_agents": cs.contributing_agents,
                "signal_count": len(cs.contributing_agents),
                "severity": cs.severity,
            }

            idem = f"compound-{cs.matter_id}-{get_effective_datetime().strftime('%Y%m%d')}"
            esc_result = log_escalation(
                firm_id=firm_id,
                escalation_type=EscalationType.COMPOUND.value,
                entity_id=cs.matter_id,
                routed_to="dana-strand",
                actor="system",
                idempotency_key=idem,
                what_is_happening=(
                    f"Multiple agents flagged {cs.matter_id}: "
                    + ", ".join(cs.contributing_agents)
                ),
                why_it_matters=(
                    "When ≥2 operational domains flag the same matter simultaneously, "
                    "the risk profile is compounded — a billing issue alongside a deadline "
                    "pressure is more urgent than either alone."
                ),
                what_litt_has_done=(
                    f"Detected cross-agent signals from: {', '.join(cs.contributing_agents)}. "
                    "Compound escalation created for coordinated attorney review."
                ),
                what_attorney_must_decide=(
                    f"Review the compound risk on {cs.matter_id} holistically — "
                    "resolve each contributing signal before closing this escalation."
                ),
                risk_level=cs.severity,
                matter_id=cs.matter_id,
                priority=3 if cs.severity == "CRITICAL" else 2,
            )
            if isinstance(esc_result, ToolResult):
                compound_esc_ids.append(esc_result.entity_id)

            sub_obs.append(_obs(
                observation_type=ObservationType.COMPOUND_RISK,
                commitment_level=CommitmentLevel.ESCALATION,
                description=(
                    f"Compound risk: {cs.matter_id} flagged by "
                    f"{len(cs.contributing_agents)} agents "
                    f"({', '.join(cs.contributing_agents)})"
                ),
                data={
                    "matter_id": cs.matter_id,
                    "contributing_agents": cs.contributing_agents,
                    "severity": cs.severity,
                    "compound_escalation_id": esc_result.entity_id if isinstance(esc_result, ToolResult) else None,
                },
                attorney_next_action=(
                    f"Review compound risk on matter {cs.matter_id}: "
                    + ", ".join(cs.contributing_agents)
                    + " all flagged this matter."
                ),
            ))

        if compound_signals:
            sub_obs.append(_obs(
                observation_type=ObservationType.ROUTING_DECISION,
                commitment_level=CommitmentLevel.ESCALATION,
                description=(
                    f"Correlation pass: {len(compound_signals)} matter(s) with "
                    f"cross-agent compound risk"
                ),
                data={
                    "compound_matter_ids": [cs.matter_id for cs in compound_signals],
                    "compound_escalation_ids": compound_esc_ids,
                },
            ))

        # --- Counts ---

        new_anomalies = (
            billing_result.get("new_anomalies", 0)
            + anomaly_result.get("new_anomalies", 0)
        )
        existing_anomalies = (
            billing_result.get("existing_anomalies", 0)
            + anomaly_result.get("existing_anomalies", 0)
        )
        new_escalations = (
            deadline_result.get("escalations_created", 0)
            + new_anomalies
            + len(compound_signals)
        )

        # --- Post-run observations ---

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
                    f"Sweep complete: {new_escalations} new escalation(s), "
                    f"{new_anomalies} new anomal{'ies' if new_anomalies != 1 else 'y'}, "
                    f"{len(compound_signals)} compound risk(s)"
                    + existing_note
                ),
                data={
                    "billing_new_anomalies": billing_result.get("new_anomalies", 0),
                    "deadline_escalations": deadline_result.get("escalations_created", 0),
                    "comms_created": comms_result.get("comms_created", 0),
                    "anomaly_new_anomalies": anomaly_result.get("new_anomalies", 0),
                    "total_new_escalations": new_escalations,
                    "compound_escalations": len(compound_signals),
                    "compound_matter_ids": [cs.matter_id for cs in compound_signals],
                    "existing_anomalies_skipped": existing_anomalies,
                    "matter_signals": matter_signals,
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
                    "compound_escalations_count": len(compound_signals),
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
            pass

        return timeline
