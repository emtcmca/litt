"""
D6-VIS-14 — Agent observation instrumentation tests.

Verifies:
- All 4 sub-agents return 'observations' in their result dict
- Coordinator collects sub-agent observations into the timeline
- All 4 CommitmentLevel gate types are reachable
- work_kind values are correct per observation type
- Rivera conflict_flagged path emits ESCALATION (mocked Gemini)
- Comms BLOCKED gate fires when a draft is created
- Phase 4 checkpoint: 20+ observations when all agents are instrumented
"""

import os

os.environ.setdefault("LITT_DEMO_MODE", "true")
os.environ.setdefault("LITT_DEMO_DATE", "2026-05-29")
os.environ.setdefault("LITT_DEMO_FIRM_ID", "strand-okafor")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "litt-hackathon")

from unittest.mock import MagicMock, patch

import pytest

from app.observability import AgentObservation, CommitmentLevel, ObservationType


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _gate_types(obs_list: list) -> set:
    return {o.commitment_level if isinstance(o.commitment_level, str) else o.commitment_level.value
            for o in obs_list}


def _obs_types(obs_list: list) -> list:
    return [o.observation_type if isinstance(o.observation_type, str) else o.observation_type.value
            for o in obs_list]


def _work_kinds(obs_list: list) -> set:
    return {o.work_kind for o in obs_list}


# ---------------------------------------------------------------------------
# BillingAgent observations
# ---------------------------------------------------------------------------

class TestBillingAgentObservations:

    def _make_agent(self):
        from app.agents.billing_agent import BillingAgent
        return BillingAgent()

    def test_returns_observations_key(self):
        agent = self._make_agent()
        mock_entry = {"id": "te-005", "status": "PENDING", "client_id": "c1", "matter_id": "m1"}

        from app.scrubber.prebill import ScrubberFlag, ScrubberResult
        from app.models import ToolError
        block_result = ScrubberResult(
            entry_id="te-005",
            flags=[ScrubberFlag(entry_id="te-005", check_name="forbidden_phrase", severity="BLOCK", message="Found 'review documents'", matched_text="review documents")],
        )

        entry_doc = MagicMock()
        entry_doc.to_dict.return_value = mock_entry

        def side_effect(firm_id, col):
            s = MagicMock()
            s.stream.return_value = [entry_doc] if col == "time_entries" else []
            return s

        with patch("app.agents.billing_agent.collection_ref") as mock_cr, \
             patch("app.agents.billing_agent.run_prebill_checks", return_value=block_result), \
             patch("app.agents.billing_agent.log_anomaly") as mock_log, \
             patch("app.agents.billing_agent.compute_budget_utilization",
                   return_value=ToolError(error_type="NOT_FOUND", message="no budget cap")):
            mock_log.return_value = MagicMock(entity_id="esc-001")
            mock_cr.side_effect = side_effect
            result = agent.run("strand-okafor", run_id="sweep-test-001")

        assert "observations" in result
        obs = result["observations"]
        assert len(obs) >= 2  # at minimum: SIGNAL_RECEIVED + RESULT

    def test_block_hit_emits_review_required(self):
        agent = self._make_agent()

        from app.scrubber.prebill import ScrubberFlag, ScrubberResult
        from app.models import ToolError
        block_result = ScrubberResult(
            entry_id="te-005",
            flags=[ScrubberFlag(entry_id="te-005", check_name="forbidden_phrase", severity="BLOCK", message="Found 'review documents'", matched_text="review documents")],
        )

        entry_doc = MagicMock()
        entry_doc.to_dict.return_value = {
            "id": "te-005", "status": "PENDING", "client_id": "c1", "matter_id": "m1"
        }

        def side_effect(firm_id, col):
            s = MagicMock()
            s.stream.return_value = [entry_doc] if col == "time_entries" else []
            return s

        with patch("app.agents.billing_agent.collection_ref") as mock_cr, \
             patch("app.agents.billing_agent.run_prebill_checks", return_value=block_result), \
             patch("app.agents.billing_agent.log_anomaly") as mock_log, \
             patch("app.agents.billing_agent.compute_budget_utilization",
                   return_value=ToolError(error_type="NOT_FOUND", message="no budget cap")):
            mock_log.return_value = MagicMock(entity_id="esc-001")
            mock_cr.side_effect = side_effect
            result = agent.run("strand-okafor", run_id="sweep-test-001")

        obs = result["observations"]
        gates = _gate_types(obs)
        assert "REVIEW_REQUIRED" in gates

    def test_observations_have_run_id(self):
        agent = self._make_agent()
        with patch("app.agents.billing_agent.collection_ref") as mock_cr:
            def side_effect(firm_id, col):
                s = MagicMock()
                s.stream.return_value = []
                return s
            mock_cr.side_effect = side_effect
            result = agent.run("strand-okafor", run_id="sweep-abc")

        for obs in result["observations"]:
            assert obs.run_id == "sweep-abc"

    def test_no_block_still_returns_observations(self):
        agent = self._make_agent()
        with patch("app.agents.billing_agent.collection_ref") as mock_cr:
            def side_effect(firm_id, col):
                s = MagicMock()
                s.stream.return_value = []
                return s
            mock_cr.side_effect = side_effect
            result = agent.run("strand-okafor")

        assert "observations" in result
        assert len(result["observations"]) >= 1


# ---------------------------------------------------------------------------
# DeadlineAgent observations
# ---------------------------------------------------------------------------

class TestDeadlineAgentObservations:

    def _make_agent(self):
        from app.agents.deadline_agent import DeadlineAgent
        return DeadlineAgent()

    def test_returns_observations_key_no_deadlines(self):
        agent = self._make_agent()
        with patch("app.agents.deadline_agent.collection_ref") as mock_cr:
            def side_effect(firm_id, col):
                s = MagicMock()
                s.stream.return_value = []
                return s
            mock_cr.side_effect = side_effect
            result = agent.run("strand-okafor", run_id="sweep-dl-001")

        assert "observations" in result
        obs = result["observations"]
        assert len(obs) >= 2  # SIGNAL_RECEIVED + RESULT minimum
        assert obs[0].observation_type == "SIGNAL_RECEIVED"

    def test_conflict_flagged_emits_escalation(self):
        """Rivera demo anchor: conflict_flagged deadline → ESCALATION gate."""
        agent = self._make_agent()
        rivera_deadline = {
            "id": "dl-rivera-001",
            "status": "ACTIVE",
            "verification_status": "conflict_flagged",
            "due_date": "2026-05-30",
            "description": "Rivera v. Okafor — opposing counsel response deadline",
            "classification": "HARD_LEGAL",
            "matter_id": "rivera-employment-2026",
            "email_reference": "email-rivera-opp-20260528",
        }

        with patch("app.agents.deadline_agent.collection_ref") as mock_cr, \
             patch("app.agents.deadline_agent._call_gemini_deadline_extraction") as mock_gemini, \
             patch("app.agents.deadline_agent.log_escalation") as mock_esc, \
             patch("app.agents.deadline_agent.verify_deadline") as mock_verify, \
             patch("app.agents.deadline_agent.log_deadline_event") as mock_dl_event, \
             patch("app.agents.deadline_agent.create_client_comm") as mock_comm:
            mock_gemini.return_value = {
                "extracted_date": "2026-05-30",
                "confidence": 0.70,
                "evidence": "Counsel wrote 'we expect your response by tomorrow (Friday)'",
            }
            mock_esc.return_value = MagicMock(entity_id="esc-dl-001")
            mock_verify.return_value = MagicMock(entity_id="dl-rivera-001")
            mock_dl_event.return_value = MagicMock(entity_id="dle-001")
            mock_comm.return_value = MagicMock(entity_id="comm-001")

            def side_effect(firm_id, col):
                s = MagicMock()
                if col == "deadlines":
                    doc = MagicMock()
                    doc.to_dict.return_value = rivera_deadline
                    s.stream.return_value = [doc]
                elif col == "source_emails":
                    email_doc = MagicMock()
                    email_doc.exists = True
                    email_doc.to_dict.return_value = {"body": "Please be advised that we expect your response by tomorrow (Friday)."}
                    s.document.return_value.get.return_value = email_doc
                    s.stream.return_value = []
                else:
                    s.stream.return_value = []
                return s

            mock_cr.side_effect = side_effect
            result = agent.run("strand-okafor", run_id="sweep-dl-002")

        obs = result["observations"]
        gates = _gate_types(obs)
        assert "ESCALATION" in gates

        # The ESCALATION observation should be llm_assisted
        esc_obs = [o for o in obs if o.commitment_level == "ESCALATION"]
        assert len(esc_obs) >= 1
        assert esc_obs[0].work_kind == "llm_assisted"
        assert esc_obs[0].attorney_next_action is not None

    def test_conflict_flagged_escalation_fires_without_gemini(self):
        """ESCALATION gate fires even when Gemini is unavailable."""
        agent = self._make_agent()
        conflict_deadline = {
            "id": "dl-conflict-001",
            "status": "ACTIVE",
            "verification_status": "conflict_flagged",
            "due_date": "2026-05-31",
            "description": "Test conflicted deadline",
            "classification": "HARD_LEGAL",
            "matter_id": "test-matter",
            "email_reference": "",
        }

        with patch("app.agents.deadline_agent.collection_ref") as mock_cr, \
             patch("app.agents.deadline_agent._call_gemini_deadline_extraction", return_value=None), \
             patch("app.agents.deadline_agent.log_escalation") as mock_esc, \
             patch("app.agents.deadline_agent.verify_deadline") as mock_verify, \
             patch("app.agents.deadline_agent.log_deadline_event") as mock_dl_event, \
             patch("app.agents.deadline_agent.create_client_comm") as mock_comm:
            mock_esc.return_value = MagicMock(entity_id="esc-dl-002")
            mock_verify.return_value = MagicMock(entity_id="dl-conflict-001")
            mock_dl_event.return_value = MagicMock(entity_id="dle-002")
            mock_comm.return_value = MagicMock(entity_id="comm-002")

            def side_effect(firm_id, col):
                s = MagicMock()
                if col == "deadlines":
                    doc = MagicMock()
                    doc.to_dict.return_value = conflict_deadline
                    s.stream.return_value = [doc]
                else:
                    s.stream.return_value = []
                return s

            mock_cr.side_effect = side_effect
            result = agent.run("strand-okafor")

        gates = _gate_types(result["observations"])
        assert "ESCALATION" in gates


# ---------------------------------------------------------------------------
# CommsAgent observations
# ---------------------------------------------------------------------------

class TestCommsAgentObservations:

    def _make_agent(self):
        from app.agents.comms_agent import CommsAgent
        return CommsAgent()

    def test_returns_observations_no_triggers(self):
        agent = self._make_agent()
        with patch("app.agents.comms_agent.collection_ref") as mock_cr:
            def side_effect(firm_id, col):
                s = MagicMock()
                s.stream.return_value = []
                return s
            mock_cr.side_effect = side_effect
            result = agent.run("strand-okafor", run_id="sweep-comms-001")

        assert "observations" in result
        obs = result["observations"]
        assert len(obs) >= 1
        assert obs[0].observation_type == "SIGNAL_RECEIVED"

    def test_blocked_gate_fires_on_draft_created(self):
        """Whitmore demo anchor: silence trigger → BLOCKED human gate."""
        agent = self._make_agent()

        matter_doc = MagicMock()
        matter_doc.id = "whitmore-employment-2026"
        matter_doc.to_dict.return_value = {
            "id": "whitmore-employment-2026",
            "name": "Whitmore Employment Matter",
            "status": "ACTIVE",
            "client_id": "whitmore",
            "last_client_contact": "2026-05-13T00:00:00",
        }
        client_doc = MagicMock()
        client_doc.id = "whitmore"
        client_doc.to_dict.return_value = {
            "id": "whitmore", "name": "Whitmore Corp", "client_silence_threshold_days": 14
        }

        with patch("app.agents.comms_agent.collection_ref") as mock_cr, \
             patch("app.agents.comms_agent._call_gemini", return_value="Dear Whitmore Corp,\n\nUpdate on your matter. [f1]\n\nBest,\nDana Strand"), \
             patch("app.agents.comms_agent._has_pending_comm", return_value=False), \
             patch("app.agents.comms_agent.create_client_comm") as mock_create:

            mock_create.return_value = MagicMock(entity_id="comm-001", success=True)

            def side_effect(firm_id, col):
                s = MagicMock()
                if col == "matters":
                    s.stream.return_value = [matter_doc]
                elif col == "clients":
                    s.stream.return_value = [client_doc]
                else:
                    s.stream.return_value = []
                return s

            mock_cr.side_effect = side_effect
            result = agent.run("strand-okafor", run_id="sweep-comms-002")

        obs = result["observations"]
        gates = _gate_types(obs)
        assert "BLOCKED" in gates

        # BLOCKED obs should have human_gate work_kind
        blocked_obs = [o for o in obs if o.commitment_level == "BLOCKED"]
        assert len(blocked_obs) >= 1
        assert blocked_obs[0].work_kind == "human_gate"
        assert blocked_obs[0].attorney_next_action is not None


# ---------------------------------------------------------------------------
# AnomalyAgent observations
# ---------------------------------------------------------------------------

class TestAnomalyAgentObservations:

    def _make_agent(self):
        from app.agents.anomaly_agent import AnomalyAgent
        return AnomalyAgent()

    def test_returns_observations_key(self):
        agent = self._make_agent()
        with patch("app.agents.anomaly_agent.collection_ref") as mock_cr:
            def side_effect(firm_id, col):
                s = MagicMock()
                s.stream.return_value = []
                return s
            mock_cr.side_effect = side_effect
            result = agent.run("strand-okafor", run_id="sweep-anomaly-001")

        assert "observations" in result
        obs = result["observations"]
        # Minimum: SIGNAL_RECEIVED + RESULT (no signals detected)
        assert len(obs) >= 2

    def test_signal_detected_emits_reasoning(self):
        """te-001 demo anchor: entry with round hours + no session timer → REASONING obs."""
        agent = self._make_agent()
        te_001 = {
            "id": "te-001",
            "status": "PENDING",
            "attorney_id": "dana-strand",
            "matter_id": "acme-commercial",
            "entry_date": "2026-05-28",
            "hours": 2.0,  # round hours
            "session_minutes_actual": None,  # no session data → triggers detection
            "narrative": None,
            "client_id": "acme",
        }
        entry_doc = MagicMock()
        entry_doc.to_dict.return_value = te_001

        with patch("app.agents.anomaly_agent.collection_ref") as mock_cr, \
             patch("app.agents.anomaly_agent.log_anomaly") as mock_log:
            mock_log.return_value = MagicMock(entity_id="anom-001")

            def side_effect(firm_id, col):
                s = MagicMock()
                if col == "time_entries":
                    s.stream.return_value = [entry_doc]
                else:
                    s.stream.return_value = []
                return s

            mock_cr.side_effect = side_effect
            result = agent.run("strand-okafor", run_id="sweep-anomaly-002")

        obs = result["observations"]
        obs_type_list = _obs_types(obs)
        assert "REASONING" in obs_type_list

        reasoning_obs = [o for o in obs if o.observation_type == "REASONING"]
        assert reasoning_obs[0].commitment_level == "REVIEW_REQUIRED"
        assert reasoning_obs[0].work_kind == "deterministic"


# ---------------------------------------------------------------------------
# Phase 4 checkpoint: all 4 gate types + 20+ observations via coordinator
# ---------------------------------------------------------------------------

class TestPhase4Checkpoint:

    def test_all_four_gate_types_via_coordinator(self):
        """
        Wires coordinator with mocked sub-agents that return the full
        observation sets. Verifies all 4 CommitmentLevel values appear.
        """
        from app.agents.coordinator import Coordinator
        from app.observability import generate_observation_id
        from datetime import datetime

        now = datetime(2026, 5, 29, 9, 0, 0)

        def _make_obs(agent_name, gate, obs_type, work_kind="deterministic", idx=0):
            return AgentObservation(
                observation_id=generate_observation_id(agent_name, idx),
                timestamp=now,
                agent_name=agent_name,
                observation_type=obs_type,
                commitment_level=gate,
                description=f"Test observation from {agent_name}",
                work_kind=work_kind,
            )

        billing_obs = [
            _make_obs("billing_agent", CommitmentLevel.AUTO_SAFE, ObservationType.SIGNAL_RECEIVED, idx=1),
            _make_obs("billing_agent", CommitmentLevel.REVIEW_REQUIRED, ObservationType.RESULT, idx=2),
            _make_obs("billing_agent", CommitmentLevel.REVIEW_REQUIRED, ObservationType.APPROVAL_GATE_APPLIED, idx=3),
            _make_obs("billing_agent", CommitmentLevel.REVIEW_REQUIRED, ObservationType.RESULT, idx=4),
            _make_obs("billing_agent", CommitmentLevel.REVIEW_REQUIRED, ObservationType.RESULT, idx=5),
        ]
        deadline_obs = [
            _make_obs("deadline_agent", CommitmentLevel.AUTO_SAFE, ObservationType.SIGNAL_RECEIVED, idx=1),
            _make_obs("deadline_agent", CommitmentLevel.AUTO_SAFE, ObservationType.REASONING, idx=2),
            _make_obs("deadline_agent", CommitmentLevel.REVIEW_REQUIRED, ObservationType.REASONING, "llm_assisted", idx=3),
            _make_obs("deadline_agent", CommitmentLevel.ESCALATION, ObservationType.ESCALATION, "llm_assisted", idx=4),
            _make_obs("deadline_agent", CommitmentLevel.ESCALATION, ObservationType.RESULT, idx=5),
        ]
        comms_obs = [
            _make_obs("comms_agent", CommitmentLevel.AUTO_SAFE, ObservationType.SIGNAL_RECEIVED, idx=1),
            _make_obs("comms_agent", CommitmentLevel.REVIEW_REQUIRED, ObservationType.REASONING, "llm_assisted", idx=2),
            _make_obs("comms_agent", CommitmentLevel.REVIEW_REQUIRED, ObservationType.TOOL_CALL, "llm_assisted", idx=3),
            _make_obs("comms_agent", CommitmentLevel.BLOCKED, ObservationType.APPROVAL_GATE_APPLIED, "human_gate", idx=4),
        ]
        anomaly_obs = [
            _make_obs("anomaly_agent", CommitmentLevel.AUTO_SAFE, ObservationType.SIGNAL_RECEIVED, idx=1),
            _make_obs("anomaly_agent", CommitmentLevel.REVIEW_REQUIRED, ObservationType.REASONING, idx=2),
            _make_obs("anomaly_agent", CommitmentLevel.REVIEW_REQUIRED, ObservationType.RESULT, idx=3),
        ]

        with patch("app.agents.coordinator.BillingAgent") as MB, \
             patch("app.agents.coordinator.DeadlineAgent") as MD, \
             patch("app.agents.coordinator.CommsAgent") as MC, \
             patch("app.agents.coordinator.AnomalyAgent") as MA, \
             patch("app.agents.coordinator.collection_ref") as mock_cr:
            mock_cr.return_value.document.return_value.set.return_value = None

            MB.return_value.run.return_value = {
                "agent": "billing_agent", "entries_scanned": 5,
                "anomalies_logged": 1, "escalation_ids": ["esc-b1"],
                "observations": billing_obs,
            }
            MD.return_value.run.return_value = {
                "agent": "deadline_agent", "deadlines_scanned": 3,
                "escalations_created": 1, "escalation_ids": ["esc-d1"],
                "observations": deadline_obs,
            }
            MC.return_value.run.return_value = {
                "agent": "comms_agent", "triggers_found": 1,
                "comms_created": 1, "comm_ids": ["comm-1"],
                "observations": comms_obs,
            }
            MA.return_value.run.return_value = {
                "agent": "anomaly_agent", "signals_detected": 1,
                "anomalies_logged": 0, "escalation_ids": [],
                "observations": anomaly_obs,
            }

            c = Coordinator()
            timeline = c.execute_sweep("strand-okafor")

        # 5 coordinator + 5 billing + 5 deadline + 4 comms + 3 anomaly = 22
        assert len(timeline.observations) >= 20, (
            f"Expected ≥20 observations, got {len(timeline.observations)}"
        )

        all_gates = _gate_types(timeline.observations)
        assert "AUTO_SAFE" in all_gates, "Missing AUTO_SAFE gate"
        assert "REVIEW_REQUIRED" in all_gates, "Missing REVIEW_REQUIRED gate"
        assert "ESCALATION" in all_gates, "Missing ESCALATION gate"
        assert "BLOCKED" in all_gates, "Missing BLOCKED gate"

    def test_work_kinds_present(self):
        """deterministic, llm_assisted, human_gate all appear in a full timeline."""
        from app.agents.coordinator import Coordinator
        from datetime import datetime

        now = datetime(2026, 5, 29, 9, 0, 0)

        def _obs(agent, gate, obs_type, work_kind, idx=0):
            from app.observability import generate_observation_id
            return AgentObservation(
                observation_id=generate_observation_id(agent, idx),
                timestamp=now,
                agent_name=agent,
                observation_type=obs_type,
                commitment_level=gate,
                description="test",
                work_kind=work_kind,
            )

        with patch("app.agents.coordinator.BillingAgent") as MB, \
             patch("app.agents.coordinator.DeadlineAgent") as MD, \
             patch("app.agents.coordinator.CommsAgent") as MC, \
             patch("app.agents.coordinator.AnomalyAgent") as MA, \
             patch("app.agents.coordinator.collection_ref") as mock_cr:
            mock_cr.return_value.document.return_value.set.return_value = None
            MB.return_value.run.return_value = {"agent": "billing_agent", "entries_scanned": 0, "anomalies_logged": 0, "escalation_ids": [], "observations": []}
            MD.return_value.run.return_value = {
                "agent": "deadline_agent", "deadlines_scanned": 0, "escalations_created": 0, "escalation_ids": [],
                "observations": [
                    _obs("deadline_agent", CommitmentLevel.ESCALATION, ObservationType.ESCALATION, "llm_assisted", idx=1),
                ],
            }
            MC.return_value.run.return_value = {
                "agent": "comms_agent", "triggers_found": 1, "comms_created": 1, "comm_ids": ["c1"],
                "observations": [
                    _obs("comms_agent", CommitmentLevel.BLOCKED, ObservationType.APPROVAL_GATE_APPLIED, "human_gate", idx=1),
                ],
            }
            MA.return_value.run.return_value = {"agent": "anomaly_agent", "signals_detected": 0, "anomalies_logged": 0, "escalation_ids": [], "observations": []}

            c = Coordinator()
            timeline = c.execute_sweep("strand-okafor")

        work_kinds = _work_kinds(timeline.observations)
        assert "deterministic" in work_kinds
        assert "llm_assisted" in work_kinds
        assert "human_gate" in work_kinds


# ---------------------------------------------------------------------------
# Phase 7D: TOOL_CALL data.tool enrichment assertions
# ---------------------------------------------------------------------------

def _tool_calls(obs_list: list) -> list:
    """Return TOOL_CALL observations."""
    return [
        o for o in obs_list
        if (o.observation_type if isinstance(o.observation_type, str) else o.observation_type.value) == "TOOL_CALL"
    ]


def _assert_tool_shape(obs) -> None:
    """Every TOOL_CALL must have data.tool with name, kind, signature, result."""
    assert "tool" in obs.data, f"TOOL_CALL missing data.tool: {obs.description}"
    t = obs.data["tool"]
    assert "name" in t, f"data.tool missing 'name': {obs.description}"
    assert "kind" in t, f"data.tool missing 'kind': {obs.description}"
    assert "signature" in t, f"data.tool missing 'signature': {obs.description}"
    assert "result" in t, f"data.tool missing 'result': {obs.description}"


class TestToolCallEnrichment:
    """Phase 7D: TOOL_CALL observations have data.tool.{name,kind,signature,result}."""

    # --- make_tool_call helper ---

    def test_make_tool_call_shape(self):
        """make_tool_call returns AgentObservation with correct data.tool shape."""
        from app.observability import make_tool_call, CommitmentLevel, ObservationType

        obs = make_tool_call(
            agent_name="billing_agent",
            tool_name="run_prebill_scrubber",
            result={"entry_count": 3},
            commitment_level=CommitmentLevel.AUTO_SAFE,
            confidence=None,
        )
        assert obs.observation_type == "TOOL_CALL"
        _assert_tool_shape(obs)
        assert obs.data["tool"]["name"] == "run_prebill_scrubber"
        assert obs.data["tool"]["kind"] == "compute"
        assert obs.data["tool"]["signature"] != ""
        assert obs.work_kind == "deterministic"

    def test_make_tool_call_gemini_kind(self):
        """make_tool_call with gemini tool sets work_kind=llm_assisted and model_name."""
        from app.observability import make_tool_call, CommitmentLevel

        obs = make_tool_call(
            agent_name="billing_agent",
            tool_name="suggest_narrative",
            result={"suggested_length": 120},
            commitment_level=CommitmentLevel.REVIEW_REQUIRED,
            confidence=0.82,
        )
        assert obs.data["tool"]["kind"] == "gemini"
        assert obs.work_kind == "llm_assisted"
        assert obs.model_name == "gemini-2.5-pro"

    def test_make_tool_call_unknown_tool_safe(self):
        """make_tool_call with unregistered tool name does not raise."""
        from app.observability import make_tool_call, CommitmentLevel

        obs = make_tool_call(
            agent_name="test_agent",
            tool_name="nonexistent_tool_xyz",
            result={},
            commitment_level=CommitmentLevel.AUTO_SAFE,
        )
        assert obs.data["tool"]["name"] == "nonexistent_tool_xyz"
        assert obs.data["tool"]["kind"] == "compute"  # default fallback
        assert obs.data["tool"]["signature"] == ""

    # --- BillingAgent TOOL_CALL enrichment ---

    def test_billing_run_prebill_scrubber_has_tool_shape(self):
        """BillingAgent run_prebill_scrubber TOOL_CALL has data.tool fields."""
        from app.agents.billing_agent import BillingAgent
        from app.models import ToolError

        agent = BillingAgent()
        with patch("app.agents.billing_agent.collection_ref") as mock_cr, \
             patch("app.agents.billing_agent.compute_budget_utilization",
                   return_value=ToolError(error_type="NOT_FOUND", message="no cap")):
            def side_effect(firm_id, col):
                s = MagicMock()
                s.stream.return_value = []
                return s
            mock_cr.side_effect = side_effect
            result = agent.run("strand-okafor")

        tc = _tool_calls(result["observations"])
        assert len(tc) >= 1, "Expected at least 1 TOOL_CALL"
        scrubber_calls = [o for o in tc if o.data.get("tool", {}).get("name") == "run_prebill_scrubber"]
        assert len(scrubber_calls) == 1
        _assert_tool_shape(scrubber_calls[0])
        assert scrubber_calls[0].data["tool"]["kind"] == "compute"

    def test_billing_gemini_tool_call_only_when_suggestion_returned(self):
        """suggest_narrative TOOL_CALL fires only when Gemini returns non-None."""
        from app.agents.billing_agent import BillingAgent
        from app.scrubber.prebill import ScrubberFlag, ScrubberResult
        from app.models import ToolError

        agent = BillingAgent()
        entry = {"id": "te-blank", "status": "PENDING", "client_id": "c1", "matter_id": "m1",
                 "narrative": None, "hours": 1.0, "entry_date": "2026-05-29"}
        block_result = ScrubberResult(
            entry_id="te-blank",
            flags=[ScrubberFlag(entry_id="te-blank", check_name="narrative_absent",
                               severity="BLOCK", message="empty", matched_text="")],
        )
        entry_doc = MagicMock()
        entry_doc.to_dict.return_value = entry

        # Case 1: Gemini returns None → no suggest_narrative TOOL_CALL
        with patch("app.agents.billing_agent.collection_ref") as mock_cr, \
             patch("app.agents.billing_agent.run_prebill_checks", return_value=block_result), \
             patch("app.agents.billing_agent.log_anomaly",
                   return_value=MagicMock(entity_id="anom-1")), \
             patch("app.agents.billing_agent._call_gemini_narrative_suggestion", return_value=None), \
             patch("app.agents.billing_agent.compute_budget_utilization",
                   return_value=ToolError(error_type="NOT_FOUND", message="no cap")):
            def side_effect(firm_id, col):
                s = MagicMock()
                s.stream.return_value = [entry_doc] if col == "time_entries" else []
                return s
            mock_cr.side_effect = side_effect
            result_no_gemini = agent.run("strand-okafor")

        tc_no_gemini = [
            o for o in _tool_calls(result_no_gemini["observations"])
            if o.data.get("tool", {}).get("name") == "suggest_narrative"
        ]
        assert len(tc_no_gemini) == 0, "suggest_narrative TOOL_CALL should not fire when Gemini returns None"

        # Case 2: Gemini returns a suggestion → suggest_narrative TOOL_CALL fires
        with patch("app.agents.billing_agent.collection_ref") as mock_cr, \
             patch("app.agents.billing_agent.run_prebill_checks", return_value=block_result), \
             patch("app.agents.billing_agent.log_anomaly",
                   return_value=MagicMock(entity_id="anom-2")), \
             patch("app.agents.billing_agent._call_gemini_narrative_suggestion",
                   return_value="Reviewed client file and prepared initial case assessment."), \
             patch("app.agents.billing_agent.compute_budget_utilization",
                   return_value=ToolError(error_type="NOT_FOUND", message="no cap")):
            def side_effect2(firm_id, col):
                s = MagicMock()
                s.stream.return_value = [entry_doc] if col == "time_entries" else []
                return s
            mock_cr.side_effect = side_effect2
            result_with_gemini = agent.run("strand-okafor")

        tc_with_gemini = [
            o for o in _tool_calls(result_with_gemini["observations"])
            if o.data.get("tool", {}).get("name") == "suggest_narrative"
        ]
        assert len(tc_with_gemini) == 1
        _assert_tool_shape(tc_with_gemini[0])
        assert tc_with_gemini[0].data["tool"]["kind"] == "gemini"
        assert tc_with_gemini[0].work_kind == "llm_assisted"

    def test_billing_write_count_unchanged(self):
        """log_anomaly call count is identical before/after Phase 7 instrumentation."""
        from app.agents.billing_agent import BillingAgent
        from app.scrubber.prebill import ScrubberFlag, ScrubberResult
        from app.models import ToolError

        agent = BillingAgent()
        entry = {"id": "te-w01", "status": "PENDING", "client_id": "c1", "matter_id": "m1",
                 "narrative": None, "hours": 1.0, "entry_date": "2026-05-29"}
        block_result = ScrubberResult(
            entry_id="te-w01",
            flags=[ScrubberFlag(entry_id="te-w01", check_name="narrative_absent",
                               severity="BLOCK", message="empty", matched_text="")],
        )
        entry_doc = MagicMock()
        entry_doc.to_dict.return_value = entry

        with patch("app.agents.billing_agent.collection_ref") as mock_cr, \
             patch("app.agents.billing_agent.run_prebill_checks", return_value=block_result), \
             patch("app.agents.billing_agent.log_anomaly",
                   return_value=MagicMock(entity_id="anom-w01")) as mock_log, \
             patch("app.agents.billing_agent._call_gemini_narrative_suggestion", return_value="suggestion"), \
             patch("app.agents.billing_agent.compute_budget_utilization",
                   return_value=ToolError(error_type="NOT_FOUND", message="no cap")):
            def side_effect(firm_id, col):
                s = MagicMock()
                s.stream.return_value = [entry_doc] if col == "time_entries" else []
                return s
            mock_cr.side_effect = side_effect
            agent.run("strand-okafor")
            write_count = mock_log.call_count

        # 1 BLOCK flag → 1 log_anomaly call. Must not change due to observation additions.
        assert write_count == 1, f"Expected 1 log_anomaly call, got {write_count}"

    # --- DeadlineAgent TOOL_CALL enrichment ---

    def test_deadline_get_active_deadlines_tool_call(self):
        """DeadlineAgent emits get_active_deadlines TOOL_CALL with kind=read."""
        from app.agents.deadline_agent import DeadlineAgent

        agent = DeadlineAgent()
        with patch("app.agents.deadline_agent.collection_ref") as mock_cr:
            def side_effect(firm_id, col):
                s = MagicMock()
                s.stream.return_value = []
                return s
            mock_cr.side_effect = side_effect
            result = agent.run("strand-okafor")

        tc = _tool_calls(result["observations"])
        dl_calls = [o for o in tc if o.data.get("tool", {}).get("name") == "get_active_deadlines"]
        assert len(dl_calls) == 1
        _assert_tool_shape(dl_calls[0])
        assert dl_calls[0].data["tool"]["kind"] == "read"

    def test_deadline_gemini_tool_call_only_when_extraction_returned(self):
        """extract_deadline_date TOOL_CALL fires only when Gemini extraction returns non-None."""
        from app.agents.deadline_agent import DeadlineAgent

        agent = DeadlineAgent()
        conflict_dl = {
            "id": "dl-cf-01", "status": "ACTIVE",
            "verification_status": "conflict_flagged",
            "due_date": "2026-06-05", "description": "Test",
            "classification": "HARD_LEGAL", "matter_id": "m1",
            "email_reference": "email-ref-01",
        }

        # Case 1: Gemini returns None → no extract_deadline_date TOOL_CALL
        with patch("app.agents.deadline_agent.collection_ref") as mock_cr, \
             patch("app.agents.deadline_agent._call_gemini_deadline_extraction", return_value=None), \
             patch("app.agents.deadline_agent.log_escalation",
                   return_value=MagicMock(entity_id="esc-dl-01")):
            def side_effect(firm_id, col):
                s = MagicMock()
                if col == "deadlines":
                    doc = MagicMock()
                    doc.to_dict.return_value = conflict_dl
                    s.stream.return_value = [doc]
                else:
                    s.stream.return_value = []
                return s
            mock_cr.side_effect = side_effect
            result_none = agent.run("strand-okafor")

        tc_none = [o for o in _tool_calls(result_none["observations"])
                   if o.data.get("tool", {}).get("name") == "extract_deadline_date"]
        assert len(tc_none) == 0

        # Case 2: Gemini returns extraction → TOOL_CALL fires
        extraction = {"extracted_date": "2026-06-05", "confidence": 0.75, "evidence": "quote"}
        with patch("app.agents.deadline_agent.collection_ref") as mock_cr, \
             patch("app.agents.deadline_agent._call_gemini_deadline_extraction",
                   return_value=extraction), \
             patch("app.agents.deadline_agent.log_escalation",
                   return_value=MagicMock(entity_id="esc-dl-02")):
            def side_effect2(firm_id, col):
                s = MagicMock()
                if col == "deadlines":
                    doc = MagicMock()
                    doc.to_dict.return_value = conflict_dl
                    s.stream.return_value = [doc]
                elif col == "source_emails":
                    email_doc = MagicMock()
                    email_doc.exists = True
                    email_doc.to_dict.return_value = {"body": "response due by Friday"}
                    s.document.return_value.get.return_value = email_doc
                    s.stream.return_value = []
                else:
                    s.stream.return_value = []
                return s
            mock_cr.side_effect = side_effect2
            result_extracted = agent.run("strand-okafor")

        tc_extracted = [o for o in _tool_calls(result_extracted["observations"])
                        if o.data.get("tool", {}).get("name") == "extract_deadline_date"]
        assert len(tc_extracted) == 1
        _assert_tool_shape(tc_extracted[0])
        assert tc_extracted[0].data["tool"]["kind"] == "gemini"

    # --- AnomalyAgent TOOL_CALL enrichment ---

    def test_anomaly_run_detectors_tool_call(self):
        """AnomalyAgent emits run_detectors TOOL_CALL with kind=compute."""
        from app.agents.anomaly_agent import AnomalyAgent

        agent = AnomalyAgent()
        with patch("app.agents.anomaly_agent.collection_ref") as mock_cr:
            def side_effect(firm_id, col):
                s = MagicMock()
                s.stream.return_value = []
                return s
            mock_cr.side_effect = side_effect
            result = agent.run("strand-okafor")

        tc = _tool_calls(result["observations"])
        det_calls = [o for o in tc if o.data.get("tool", {}).get("name") == "run_detectors"]
        assert len(det_calls) == 1
        _assert_tool_shape(det_calls[0])
        assert det_calls[0].data["tool"]["kind"] == "compute"

    def test_anomaly_gemini_enrichment_only_when_returned(self):
        """assess_narrative_quality TOOL_CALL fires only when enrichment returns non-None."""
        from app.agents.anomaly_agent import AnomalyAgent

        agent = AnomalyAgent()
        entry = {"id": "te-round", "status": "PENDING", "attorney_id": "a1", "matter_id": "m1",
                 "entry_date": "2026-05-29", "hours": 4.0, "session_minutes_actual": None,
                 "narrative": "worked on case", "client_id": "c1", "created_at": "2026-05-29T10:00:00"}
        entry_doc = MagicMock()
        entry_doc.to_dict.return_value = entry

        with patch("app.agents.anomaly_agent.collection_ref") as mock_cr, \
             patch("app.agents.anomaly_agent.log_anomaly",
                   return_value=MagicMock(entity_id="anom-round-01")), \
             patch("app.agents.anomaly_agent._call_gemini_anomaly_enrichment", return_value=None), \
             patch("app.agents.anomaly_agent._call_gemini_narrative_quality", return_value=(None, None, None)), \
             patch("app.agents.anomaly_agent._call_gemini_hours_plausibility", return_value=(None, None)), \
             patch("app.agents.anomaly_agent._call_gemini_semantic_duplicate", return_value=None), \
             patch("app.agents.anomaly_agent._call_gemini_matter_synthesis", return_value=None):
            def side_effect(firm_id, col):
                s = MagicMock()
                s.stream.return_value = [entry_doc] if col == "time_entries" else []
                return s
            mock_cr.side_effect = side_effect
            result_none = agent.run("strand-okafor")

        tc_none = [o for o in _tool_calls(result_none["observations"])
                   if o.data.get("tool", {}).get("name") == "assess_narrative_quality"]
        assert len(tc_none) == 0

        with patch("app.agents.anomaly_agent.collection_ref") as mock_cr, \
             patch("app.agents.anomaly_agent.log_anomaly",
                   return_value=MagicMock(entity_id="anom-round-02")), \
             patch("app.agents.anomaly_agent._call_gemini_anomaly_enrichment",
                   return_value="This anomaly represents elevated malpractice risk."), \
             patch("app.agents.anomaly_agent._call_gemini_narrative_quality", return_value=(None, None, None)), \
             patch("app.agents.anomaly_agent._call_gemini_hours_plausibility", return_value=(None, None)), \
             patch("app.agents.anomaly_agent._call_gemini_semantic_duplicate", return_value=None), \
             patch("app.agents.anomaly_agent._call_gemini_matter_synthesis", return_value=None):
            def side_effect2(firm_id, col):
                s = MagicMock()
                s.stream.return_value = [entry_doc] if col == "time_entries" else []
                return s
            mock_cr.side_effect = side_effect2
            result_enriched = agent.run("strand-okafor")

        tc_enriched = [o for o in _tool_calls(result_enriched["observations"])
                       if o.data.get("tool", {}).get("name") == "assess_narrative_quality"]
        assert len(tc_enriched) == 1
        _assert_tool_shape(tc_enriched[0])
        assert tc_enriched[0].data["tool"]["kind"] == "gemini"

    def test_anomaly_write_count_unchanged(self):
        """log_anomaly call count is unchanged by Phase 7 instrumentation."""
        from app.agents.anomaly_agent import AnomalyAgent

        agent = AnomalyAgent()
        entry = {"id": "te-wc", "status": "PENDING", "attorney_id": "a1", "matter_id": "m1",
                 "entry_date": "2026-05-29", "hours": 4.0, "session_minutes_actual": None,
                 "narrative": "worked on case", "client_id": "c1", "created_at": "2026-05-29T10:00:00"}
        entry_doc = MagicMock()
        entry_doc.to_dict.return_value = entry

        with patch("app.agents.anomaly_agent.collection_ref") as mock_cr, \
             patch("app.agents.anomaly_agent.log_anomaly",
                   return_value=MagicMock(entity_id="anom-wc-01")) as mock_log, \
             patch("app.agents.anomaly_agent._call_gemini_anomaly_enrichment",
                   return_value="Risk assessment text."), \
             patch("app.agents.anomaly_agent._call_gemini_narrative_quality", return_value=(None, None, None)), \
             patch("app.agents.anomaly_agent._call_gemini_hours_plausibility", return_value=(None, None)), \
             patch("app.agents.anomaly_agent._call_gemini_semantic_duplicate", return_value=None), \
             patch("app.agents.anomaly_agent._call_gemini_matter_synthesis", return_value=None):
            def side_effect(firm_id, col):
                s = MagicMock()
                s.stream.return_value = [entry_doc] if col == "time_entries" else []
                return s
            mock_cr.side_effect = side_effect
            agent.run("strand-okafor")
            write_count = mock_log.call_count

        assert write_count == 1, f"Expected 1 log_anomaly call, got {write_count}"
