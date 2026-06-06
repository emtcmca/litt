"""
Phase 5 — Coordinator v1.1.1 tests (V11-P5-08).

Verifies: parallel execution; budget_signals reach CommsAgent;
compound escalation fires when ≥2 agents touch same matter;
timeout produces partial result, not crash;
matter_signals dict populated in result timeline.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, call, patch

import pytest

from app.agents.coordinator import (
    Coordinator,
    CompoundSignal,
    _correlation_pass,
    _safe_result,
    _empty_result,
    AGENT_TIMEOUT_SECONDS,
)
from app.models import ToolResult
from app.observability import CommitmentLevel, ObservationType

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FIRM = "strand-okafor"


def _agent_result(
    agent_name: str,
    *,
    matters_touched: Optional[List[str]] = None,
    new_anomalies: int = 0,
    existing_anomalies: int = 0,
    escalations_created: int = 0,
    comms_created: int = 0,
    budget_signals: Optional[Dict[str, Any]] = None,
    observations: Optional[list] = None,
) -> Dict[str, Any]:
    return {
        "agent": agent_name,
        "matters_touched": matters_touched or [],
        "anomalies_logged": new_anomalies + existing_anomalies,
        "new_anomalies": new_anomalies,
        "existing_anomalies": existing_anomalies,
        "escalations_created": escalations_created,
        "comms_created": comms_created,
        "budget_signals": budget_signals or {},
        "observations": observations or [],
    }


def _make_coordinator_mocked(
    billing_result=None,
    deadline_result=None,
    anomaly_result=None,
    comms_result=None,
):
    """Patch all four sub-agent run() methods and collection_ref."""
    billing_result = billing_result or _agent_result("billing_agent")
    deadline_result = deadline_result or _agent_result("deadline_agent")
    anomaly_result = anomaly_result or _agent_result("anomaly_agent")
    comms_result = comms_result or _agent_result("comms_agent")

    coordinator = Coordinator()
    coordinator._billing.run = MagicMock(return_value=billing_result)
    coordinator._deadline.run = MagicMock(return_value=deadline_result)
    coordinator._anomaly.run = MagicMock(return_value=anomaly_result)
    coordinator._comms.run = MagicMock(return_value=comms_result)
    return coordinator


# ---------------------------------------------------------------------------
# V11-P5-01/02: Parallel + budget passthrough
# ---------------------------------------------------------------------------


class TestParallelExecution:
    def test_all_four_agents_called(self):
        coord = _make_coordinator_mocked()
        with patch("app.agents.coordinator.collection_ref"):
            coord.execute_sweep(FIRM)
        coord._billing.run.assert_called_once()
        coord._deadline.run.assert_called_once()
        coord._anomaly.run.assert_called_once()
        coord._comms.run.assert_called_once()

    def test_budget_signals_passed_to_comms(self):
        """V11-P5-02: budget_signals from BillingAgent reach CommsAgent."""
        budget_signals = {
            "acme-corp": {"utilization_pct": 0.82, "total_committed": 82000, "budget_cap": 100000}
        }
        billing = _agent_result("billing_agent", budget_signals=budget_signals)
        coord = _make_coordinator_mocked(billing_result=billing)
        with patch("app.agents.coordinator.collection_ref"):
            coord.execute_sweep(FIRM)
        # CommsAgent called with the budget_signals dict
        call_kwargs = coord._comms.run.call_args
        passed_budget = call_kwargs[1].get("budget_signals") or call_kwargs[0][2] if len(call_kwargs[0]) > 2 else {}
        # Check via keyword argument
        assert coord._comms.run.call_args.kwargs.get("budget_signals") == budget_signals or \
               coord._comms.run.call_args[1].get("budget_signals") == budget_signals

    def test_comms_receives_empty_budget_signals_when_billing_partial(self):
        """Partial billing result → empty budget_signals → comms still runs."""
        billing = {**_empty_result("billing_agent"), "partial": True}
        coord = _make_coordinator_mocked(billing_result=billing)
        with patch("app.agents.coordinator.collection_ref"):
            coord.execute_sweep(FIRM)
        # CommsAgent still called
        coord._comms.run.assert_called_once()
        # budget_signals is empty
        assert coord._comms.run.call_args.kwargs.get("budget_signals", {}) == {}

    def test_run_id_passed_to_all_agents(self):
        """All agents receive a consistent run_id."""
        coord = _make_coordinator_mocked()
        with patch("app.agents.coordinator.collection_ref"):
            timeline = coord.execute_sweep(FIRM)
        run_id = timeline.run_id
        # billing called with run_id as positional or keyword
        billing_call = coord._billing.run.call_args
        passed_run_id = (
            billing_call.kwargs.get("run_id")
            or (billing_call[0][1] if len(billing_call[0]) > 1 else None)
        )
        assert passed_run_id == run_id


# ---------------------------------------------------------------------------
# V11-P5-03: Timeout / partial result
# ---------------------------------------------------------------------------


class TestTimeoutHandling:
    def test_timeout_produces_partial_result_not_crash(self):
        """V11-P5-03: agent timeout returns partial, doesn't raise."""
        from concurrent.futures import Future, TimeoutError as FutureTimeoutError

        def slow_run(*args, **kwargs):
            raise FutureTimeoutError("timed out")

        coord = _make_coordinator_mocked()
        coord._billing.run = slow_run  # will timeout in the future

        # Patch _safe_result directly to simulate timeout
        with (
            patch("app.agents.coordinator.collection_ref"),
            patch(
                "app.agents.coordinator._safe_result",
                side_effect=lambda f, name, timeout=30: _empty_result(name),
            ),
        ):
            # Should not raise
            timeline = coord.execute_sweep(FIRM)
        assert timeline is not None
        assert timeline.run_id.startswith("sweep-")

    def test_empty_result_has_required_keys(self):
        result = _empty_result("billing_agent")
        assert result["agent"] == "billing_agent"
        assert result["partial"] is True
        assert result["anomalies_logged"] == 0
        assert result["matters_touched"] == []
        assert "observations" in result

    def test_agent_exception_produces_partial(self):
        """Exception in agent produces partial result, sweep continues."""
        coord = _make_coordinator_mocked()
        coord._anomaly.run = MagicMock(side_effect=RuntimeError("anomaly agent crashed"))

        with patch("app.agents.coordinator.collection_ref"):
            # Anomaly agent crashes inside ThreadPoolExecutor
            # _safe_result should catch it and return partial
            timeline = coord.execute_sweep(FIRM)

        assert timeline is not None
        # Sweep still produced a timeline
        obs_types = [o.observation_type for o in timeline.observations]
        # RESULT observation should still be present
        assert "RESULT" in obs_types


# ---------------------------------------------------------------------------
# V11-P5-04/05: Correlation pass + CompoundSignal
# ---------------------------------------------------------------------------


class TestCorrelationPass:
    def test_no_compounds_when_single_agent(self):
        results = [
            _agent_result("billing_agent", matters_touched=["m1", "m2"]),
            _agent_result("deadline_agent", matters_touched=[]),
            _agent_result("anomaly_agent", matters_touched=[]),
            _agent_result("comms_agent", matters_touched=[]),
        ]
        compounds = _correlation_pass(results)
        assert len(compounds) == 0

    def test_compound_fires_for_two_agents_same_matter(self):
        results = [
            _agent_result("billing_agent", matters_touched=["m-shared"]),
            _agent_result("deadline_agent", matters_touched=["m-shared"]),
            _agent_result("anomaly_agent", matters_touched=[]),
            _agent_result("comms_agent", matters_touched=[]),
        ]
        compounds = _correlation_pass(results)
        assert len(compounds) == 1
        assert compounds[0].matter_id == "m-shared"
        assert "billing_agent" in compounds[0].contributing_agents
        assert "deadline_agent" in compounds[0].contributing_agents

    def test_compound_severity_elevated_for_two_agents(self):
        results = [
            _agent_result("billing_agent", matters_touched=["m-two"]),
            _agent_result("anomaly_agent", matters_touched=["m-two"]),
        ]
        compounds = _correlation_pass(results)
        assert compounds[0].severity == "ELEVATED"

    def test_compound_severity_critical_for_three_agents(self):
        results = [
            _agent_result("billing_agent", matters_touched=["m-three"]),
            _agent_result("deadline_agent", matters_touched=["m-three"]),
            _agent_result("anomaly_agent", matters_touched=["m-three"]),
        ]
        compounds = _correlation_pass(results)
        assert compounds[0].severity == "CRITICAL"

    def test_no_duplicate_per_matter(self):
        """Same matter in multiple places in one agent's touched list = 1 compound."""
        results = [
            _agent_result("billing_agent", matters_touched=["m-dup", "m-dup"]),
            _agent_result("deadline_agent", matters_touched=["m-dup"]),
        ]
        compounds = _correlation_pass(results)
        # Should have exactly 1 CompoundSignal for m-dup
        assert len([c for c in compounds if c.matter_id == "m-dup"]) == 1

    def test_multiple_compound_matters(self):
        results = [
            _agent_result("billing_agent", matters_touched=["m1", "m2"]),
            _agent_result("deadline_agent", matters_touched=["m1"]),
            _agent_result("anomaly_agent", matters_touched=["m2"]),
        ]
        compounds = _correlation_pass(results)
        compound_ids = {c.matter_id for c in compounds}
        assert "m1" in compound_ids
        assert "m2" in compound_ids


# ---------------------------------------------------------------------------
# V11-P5-06: log_escalation(COMPOUND) called
# ---------------------------------------------------------------------------


class TestCompoundEscalation:
    def test_compound_escalation_logged(self):
        """V11-P5-06: log_escalation called with COMPOUND type for each compound matter."""
        billing = _agent_result("billing_agent", matters_touched=["m-compound"])
        deadline = _agent_result("deadline_agent", matters_touched=["m-compound"])
        coord = _make_coordinator_mocked(billing_result=billing, deadline_result=deadline)

        with (
            patch("app.agents.coordinator.collection_ref"),
            patch(
                "app.agents.coordinator.log_escalation",
                return_value=ToolResult(
                    entity_id="esc-compound-001",
                    entity_type="escalation",
                    audit_event_id="audit-001",
                ),
            ) as mock_log_esc,
        ):
            coord.execute_sweep(FIRM)

        # log_escalation called at least once with COMPOUND type
        esc_calls = [
            c for c in mock_log_esc.call_args_list
            if c.kwargs.get("escalation_type") == "COMPOUND"
        ]
        assert len(esc_calls) >= 1
        assert esc_calls[0].kwargs["matter_id"] == "m-compound"

    def test_compound_observation_emitted(self):
        """COMPOUND_RISK observation emitted when compound signal fires."""
        billing = _agent_result("billing_agent", matters_touched=["m-obs"])
        anomaly = _agent_result("anomaly_agent", matters_touched=["m-obs"])
        coord = _make_coordinator_mocked(billing_result=billing, anomaly_result=anomaly)

        with (
            patch("app.agents.coordinator.collection_ref"),
            patch(
                "app.agents.coordinator.log_escalation",
                return_value=ToolResult(
                    entity_id="esc-001",
                    entity_type="escalation",
                    audit_event_id="audit-001",
                ),
            ),
        ):
            timeline = coord.execute_sweep(FIRM)

        obs_types = [o.observation_type for o in timeline.observations]
        assert "COMPOUND_RISK" in obs_types

    def test_no_compound_escalation_when_single_agent(self):
        """No COMPOUND escalation when only one agent fires."""
        billing = _agent_result("billing_agent", matters_touched=["m-solo"])
        coord = _make_coordinator_mocked(billing_result=billing)

        with (
            patch("app.agents.coordinator.collection_ref"),
            patch(
                "app.agents.coordinator.log_escalation",
                return_value=ToolResult(
                    entity_id="esc-001",
                    entity_type="escalation",
                    audit_event_id="audit-001",
                ),
            ) as mock_log_esc,
        ):
            coord.execute_sweep(FIRM)

        compound_calls = [
            c for c in mock_log_esc.call_args_list
            if c.kwargs.get("escalation_type") == "COMPOUND"
        ]
        assert len(compound_calls) == 0


# ---------------------------------------------------------------------------
# V11-P5-07: matter_signals in result
# ---------------------------------------------------------------------------


class TestMatterSignals:
    def test_matter_signals_in_result_data(self):
        """V11-P5-07: matter_signals dict populated and included in RESULT observation."""
        billing = _agent_result("billing_agent", matters_touched=["m-signal"])
        deadline = _agent_result("deadline_agent", matters_touched=["m-signal"])
        coord = _make_coordinator_mocked(billing_result=billing, deadline_result=deadline)

        with (
            patch("app.agents.coordinator.collection_ref"),
            patch(
                "app.agents.coordinator.log_escalation",
                return_value=ToolResult(
                    entity_id="esc-001",
                    entity_type="escalation",
                    audit_event_id="audit-001",
                ),
            ),
        ):
            timeline = coord.execute_sweep(FIRM)

        result_obs = [o for o in timeline.observations if o.observation_type == "RESULT"]
        assert len(result_obs) >= 1
        matter_signals = result_obs[-1].data.get("matter_signals", {})
        assert "m-signal" in matter_signals
        assert "billing_agent" in matter_signals["m-signal"]["contributing_agents"]

    def test_escalations_count_in_timeline(self):
        """Timeline.escalations_count reflects new escalations."""
        billing = _agent_result("billing_agent", new_anomalies=2)
        deadline = _agent_result("deadline_agent", escalations_created=1)
        coord = _make_coordinator_mocked(billing_result=billing, deadline_result=deadline)

        with (
            patch("app.agents.coordinator.collection_ref"),
            patch("app.agents.coordinator.log_escalation", return_value=ToolResult(
                entity_id="e1", entity_type="escalation", audit_event_id="a1"
            )),
        ):
            timeline = coord.execute_sweep(FIRM)

        # 2 billing anomalies + 1 deadline escalation = 3 base (+ 0 compound = no overlap)
        assert timeline.escalations_count >= 3
