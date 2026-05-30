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
from enum import Enum
from typing import Dict, List

from app.agents.anomaly_agent import AnomalyAgent
from app.agents.billing_agent import BillingAgent
from app.agents.comms_agent import CommsAgent
from app.agents.deadline_agent import DeadlineAgent
from app.brief.schemas import SweepResponse


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

    def execute_sweep(self, firm_id: str) -> SweepResponse:
        """Run all four sub-agents for the firm and return a sweep summary."""
        sweep_id = f"sweep-{uuid.uuid4().hex[:12]}"
        start_ms = time.time()

        billing_result = self._billing.run(firm_id)
        deadline_result = self._deadline.run(firm_id)
        comms_result = self._comms.run(firm_id)
        anomaly_result = self._anomaly.run(firm_id)

        duration_ms = int((time.time() - start_ms) * 1000)

        sections_updated: List[str] = []
        if billing_result["anomalies_logged"] > 0:
            sections_updated.append("billing")
        if deadline_result["escalations_created"] > 0:
            sections_updated.append("deadlines")
        if comms_result["comms_created"] > 0:
            sections_updated.append("comms")
        if anomaly_result["anomalies_logged"] > 0:
            sections_updated.append("anomalies")

        total_anomalies = (
            billing_result["anomalies_logged"] + anomaly_result["anomalies_logged"]
        )
        total_escalations = deadline_result["escalations_created"] + total_anomalies

        return SweepResponse(
            sweep_id=sweep_id,
            firm_id=firm_id,
            duration_ms=duration_ms,
            sections_updated=sections_updated,
            escalations_created=total_escalations,
            anomalies_detected=total_anomalies,
        )
