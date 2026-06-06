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
