"""
Phase 3 tests — v1.1.1 DeadlineAgent respec.

V11-P3-08: readiness monitoring fires; 21/30-day watch produces observation
           with no escalation write; clustering groups matters correctly.
V11-P3-09: conflict_flagged advances to pending_verification at confidence>=0.80;
           does NOT advance at confidence<0.80.
V11-P3-10: extension draft produced on correct trigger; NOT produced when matter
           has recent activity or deadline not at 1_DAY/CRITICAL.

All tests use synthetic data; no Firestore connection required.
"""

from __future__ import annotations

import os
from datetime import date, timedelta
from unittest.mock import MagicMock, patch, call

import pytest

os.environ.setdefault("LITT_DEMO_MODE", "true")
os.environ.setdefault("LITT_DEMO_DATE", "2026-06-25")
os.environ.setdefault("LITT_DEMO_FIRM_ID", "strand-okafor")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "litt-hackathon")

from app.agents.deadline_agent import (
    DeadlineAgent,
    _get_escalation_level,
    _get_escalated_levels,
    _has_matter_activity_in_days,
)

TODAY = date(2026, 6, 25)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _deadline(
    id="dl-1",
    status="ACTIVE",
    verification_status="attorney_verified",
    due_date=None,
    classification="HARD_LEGAL",
    matter_id="m1",
    description="Test deadline",
    days_out=6,
):
    if due_date is None:
        due_date = (TODAY + timedelta(days=days_out)).isoformat()
    return {
        "id": id,
        "status": status,
        "verification_status": verification_status,
        "due_date": due_date,
        "classification": classification,
        "matter_id": matter_id,
        "description": description,
        "version": 1,
        "email_reference": "",
    }


def _doc(data: dict):
    d = MagicMock()
    d.to_dict.return_value = data
    d.id = data.get("id", "unknown")
    d.exists = True
    return d


def _coll(*docs_data):
    """Mock Firestore collection that streams given dicts."""
    coll = MagicMock()
    coll.stream.return_value = [_doc(d) for d in docs_data]
    return coll


def _run_agent_with_deadlines(
    deadlines,
    entries=None,
    comms=None,
    deadline_events=None,
    source_emails=None,
    matters=None,
    clients=None,
    attorneys=None,
    mock_gemini_result=None,
    mock_verify=None,
    mock_escalation=None,
    mock_log_event=None,
    mock_create_comm=None,
):
    """
    Run DeadlineAgent with mocked Firestore and tools.
    Returns agent result dict.
    """
    if entries is None:
        entries = []
    if comms is None:
        comms = []
    if deadline_events is None:
        deadline_events = []
    if source_emails is None:
        source_emails = {}
    if matters is None:
        matters = [{"id": "m1", "name": "Test Matter", "client_id": "c1"}]
    if clients is None:
        clients = [{"id": "c1", "name": "Test Client"}]
    if attorneys is None:
        attorneys = [{"id": "dana-strand", "name": "Dana Strand", "default_rate": 350.0, "writing_style": {}}]

    agent = DeadlineAgent()

    def _col_side_effect(firm_id, collection):
        mapping = {
            "deadlines": _coll(*deadlines),
            "time_entries": _coll(*entries),
            "client_communications": _coll(*comms),
            "deadline_events": _coll(*deadline_events),
            "matters": _coll(*matters),
            "clients": _coll(*clients),
            "attorneys": _coll(*attorneys),
        }
        coll = mapping.get(collection, MagicMock())
        if collection not in mapping:
            coll.stream.return_value = []
        return coll

    mock_esc_result = MagicMock()
    mock_esc_result.entity_id = "esc-001"
    mock_esc_result.audit_event_id = "audit-001"

    mock_evt_result = MagicMock()

    mock_comm_result = MagicMock()
    mock_comm_result.entity_id = "comm-001"

    with patch("app.agents.deadline_agent.collection_ref", side_effect=_col_side_effect), \
         patch("app.agents.deadline_agent.log_escalation", return_value=mock_esc_result) as mock_esc, \
         patch("app.agents.deadline_agent.log_deadline_event", return_value=mock_evt_result) as mock_evt, \
         patch("app.agents.deadline_agent.create_client_comm", return_value=mock_comm_result) as mock_comm, \
         patch("app.agents.deadline_agent.verify_deadline", return_value=mock_esc_result) as mock_ver, \
         patch("app.agents.deadline_agent._call_gemini_deadline_extraction",
               return_value=mock_gemini_result) as mock_gem_ext, \
         patch("app.agents.deadline_agent._call_gemini_extension_draft",
               return_value="Draft extension letter.") as mock_gem_ext_draft:

        result = agent.run("strand-okafor")
        return result, mock_esc, mock_evt, mock_comm, mock_ver


# ---------------------------------------------------------------------------
# V11-P3-08: Readiness monitoring, soft watches, clustering
# ---------------------------------------------------------------------------

class TestReadinessMonitoring:
    def test_readiness_observation_emitted_per_verified_deadline(self):
        dl = _deadline(id="dl-1", verification_status="attorney_verified", days_out=6)
        result, _, _, _, _ = _run_agent_with_deadlines([dl])
        obs = result["observations"]
        readiness_obs = [
            o for o in obs
            if o.observation_type == "REASONING" and "Readiness check" in o.description
        ]
        assert len(readiness_obs) >= 1

    def test_readiness_observation_is_auto_safe(self):
        from app.observability import CommitmentLevel
        dl = _deadline(id="dl-1", verification_status="attorney_verified", days_out=6)
        result, _, _, _, _ = _run_agent_with_deadlines([dl])
        readiness_obs = [
            o for o in result["observations"]
            if o.observation_type == "REASONING" and "Readiness check" in o.description
        ]
        assert all(o.commitment_level == CommitmentLevel.AUTO_SAFE for o in readiness_obs)


class TestSoftWatches:
    def test_21_day_soft_watch_unverified(self):
        dl = _deadline(id="dl-21", verification_status="unverified", days_out=15)
        result, _, mock_evt, _, _ = _run_agent_with_deadlines([dl])
        warn_obs = [
            o for o in result["observations"]
            if o.observation_type == "WARN_NOTICE" and "soft watch" in o.description
        ]
        assert len(warn_obs) >= 1
        # No escalation write for soft watch
        for c in mock_evt.call_args_list:
            # log_deadline_event should not be called for the unverified deadline
            if "dl-21" in str(c):
                pytest.fail("log_deadline_event called for soft watch deadline")

    def test_30_day_soft_watch_pending_verification(self):
        dl = _deadline(id="dl-30", verification_status="pending_verification", days_out=25)
        result, _, mock_evt, _, _ = _run_agent_with_deadlines([dl])
        warn_obs = [
            o for o in result["observations"]
            if o.observation_type == "WARN_NOTICE" and "soft watch" in o.description
        ]
        assert len(warn_obs) >= 1

    def test_no_soft_watch_for_verified_deadline(self):
        dl = _deadline(id="dl-v", verification_status="attorney_verified", days_out=25)
        result, _, _, _, _ = _run_agent_with_deadlines([dl])
        soft_obs = [
            o for o in result["observations"]
            if o.observation_type == "WARN_NOTICE" and "soft watch" in o.description
        ]
        assert len(soft_obs) == 0

    def test_no_soft_watch_for_overdue_deadline(self):
        dl = _deadline(id="dl-past", verification_status="unverified", days_out=-2)
        result, _, _, _, _ = _run_agent_with_deadlines([dl])
        soft_obs = [
            o for o in result["observations"]
            if o.observation_type == "WARN_NOTICE" and "soft watch" in o.description
        ]
        assert len(soft_obs) == 0


class TestDeadlineClustering:
    def test_clustering_fires_for_3_deadlines_in_5_day_window(self):
        deadlines = [
            _deadline(id=f"dl-c{i}", verification_status="attorney_verified",
                      days_out=3 + i)
            for i in range(3)
        ]
        result, _, _, _, _ = _run_agent_with_deadlines(deadlines)
        cluster_obs = [
            o for o in result["observations"]
            if o.observation_type == "WARN_NOTICE" and "cluster" in o.description.lower()
        ]
        assert len(cluster_obs) >= 1

    def test_no_clustering_for_2_deadlines(self):
        deadlines = [
            _deadline(id=f"dl-c{i}", verification_status="attorney_verified", days_out=1 + i)
            for i in range(2)
        ]
        result, _, _, _, _ = _run_agent_with_deadlines(deadlines)
        cluster_obs = [
            o for o in result["observations"]
            if o.observation_type == "WARN_NOTICE" and "cluster" in o.description.lower()
        ]
        assert len(cluster_obs) == 0

    def test_no_clustering_for_deadlines_spread_beyond_5_days(self):
        deadlines = [
            _deadline(id="dl-a", days_out=1),
            _deadline(id="dl-b", days_out=8),
            _deadline(id="dl-c", days_out=20),
        ]
        result, _, _, _, _ = _run_agent_with_deadlines(deadlines)
        cluster_obs = [
            o for o in result["observations"]
            if o.observation_type == "WARN_NOTICE" and "cluster" in o.description.lower()
        ]
        assert len(cluster_obs) == 0


# ---------------------------------------------------------------------------
# V11-P3-09: conflict_flagged → pending_verification
# ---------------------------------------------------------------------------

class TestPendingVerificationAdvancement:
    def test_advances_to_pending_verification_at_high_confidence(self):
        dl = _deadline(id="dl-conflict", verification_status="conflict_flagged", days_out=8)
        dl["email_reference"] = "email-001"

        with patch("app.agents.deadline_agent.collection_ref") as mock_col_ref, \
             patch("app.agents.deadline_agent.log_escalation") as mock_esc, \
             patch("app.agents.deadline_agent.log_deadline_event"), \
             patch("app.agents.deadline_agent.create_client_comm"), \
             patch("app.agents.deadline_agent._call_gemini_deadline_extraction",
                   return_value={"extracted_date": "2026-07-03", "confidence": 0.85, "evidence": "July 3rd"}), \
             patch("app.agents.deadline_agent._call_gemini_extension_draft"), \
             patch("app.agents.deadline_agent.verify_deadline") as mock_verify:

            def _col(firm_id, coll):
                if coll == "deadlines":
                    return _coll(dl)
                if coll == "source_emails":
                    src_coll = MagicMock()
                    email_doc = MagicMock()
                    email_doc.exists = True
                    email_doc.to_dict.return_value = {"body": "The deadline is July 3rd."}
                    src_coll.document.return_value.get.return_value = email_doc
                    return src_coll
                return _coll(*[
                    {"id": "m1", "name": "Test Matter", "client_id": "c1"},
                ] if coll == "matters" else
                    [{"id": "c1", "name": "Test Client"}] if coll == "clients" else
                    [{"id": "dana-strand", "writing_style": {}}] if coll == "attorneys" else
                    []
                )

            mock_col_ref.side_effect = _col
            mock_esc.return_value = MagicMock(entity_id="esc-001")
            mock_verify.return_value = MagicMock(entity_id="dl-conflict")

            agent = DeadlineAgent()
            result = agent.run("strand-okafor")

            mock_verify.assert_called_once()
            call_kwargs = mock_verify.call_args[1] if mock_verify.call_args[1] else {}
            call_args = mock_verify.call_args[0] if mock_verify.call_args[0] else ()
            # Check that pending_verification status was passed
            all_args = str(mock_verify.call_args)
            assert "pending_verification" in all_args

    def test_does_not_advance_at_low_confidence(self):
        dl = _deadline(id="dl-conflict-low", verification_status="conflict_flagged", days_out=8)
        dl["email_reference"] = "email-002"

        with patch("app.agents.deadline_agent.collection_ref") as mock_col_ref, \
             patch("app.agents.deadline_agent.log_escalation") as mock_esc, \
             patch("app.agents.deadline_agent.log_deadline_event"), \
             patch("app.agents.deadline_agent.create_client_comm"), \
             patch("app.agents.deadline_agent._call_gemini_deadline_extraction",
                   return_value={"extracted_date": "2026-07-03", "confidence": 0.65, "evidence": "~July"}), \
             patch("app.agents.deadline_agent._call_gemini_extension_draft"), \
             patch("app.agents.deadline_agent.verify_deadline") as mock_verify:

            def _col(firm_id, coll):
                if coll == "deadlines":
                    return _coll(dl)
                if coll == "source_emails":
                    src_coll = MagicMock()
                    email_doc = MagicMock()
                    email_doc.exists = True
                    email_doc.to_dict.return_value = {"body": "Approximately July 3rd."}
                    src_coll.document.return_value.get.return_value = email_doc
                    return src_coll
                return _coll(*[
                    {"id": "m1", "name": "Test Matter", "client_id": "c1"},
                ] if coll == "matters" else
                    [{"id": "c1", "name": "Test Client"}] if coll == "clients" else
                    [{"id": "dana-strand", "writing_style": {}}] if coll == "attorneys" else
                    []
                )

            mock_col_ref.side_effect = _col
            mock_esc.return_value = MagicMock(entity_id="esc-001")

            agent = DeadlineAgent()
            result = agent.run("strand-okafor")

            # verify_deadline should NOT be called
            mock_verify.assert_not_called()


# ---------------------------------------------------------------------------
# V11-P3-10: Extension request draft
# ---------------------------------------------------------------------------

class TestExtensionDraft:
    def _run_with_extension_check(
        self,
        days_out,
        has_recent_activity=False,
        comm_exists=False,
        already_escalated=True,
    ):
        dl = _deadline(
            id="dl-ext",
            verification_status="attorney_verified",
            days_out=days_out,
            matter_id="m-ext",
        )
        entry = {
            "id": "te-1",
            "matter_id": "m-ext",
            "status": "PENDING",
            "entry_date": (TODAY - timedelta(days=2 if has_recent_activity else 10)).isoformat(),
        }
        comm = {
            "id": "comm-1",
            "matter_id": "m-ext",
            "trigger": "DEADLINE_EXTENSION_REQUEST",
            "status": "DRAFT_GENERATED",
        } if comm_exists else None

        all_entries = [entry]
        all_comms = [comm] if comm else []

        with patch("app.agents.deadline_agent.collection_ref") as mock_col_ref, \
             patch("app.agents.deadline_agent.log_escalation") as mock_esc, \
             patch("app.agents.deadline_agent.log_deadline_event") as mock_evt, \
             patch("app.agents.deadline_agent.create_client_comm") as mock_comm, \
             patch("app.agents.deadline_agent.verify_deadline"), \
             patch("app.agents.deadline_agent._call_gemini_deadline_extraction", return_value=None), \
             patch("app.agents.deadline_agent._call_gemini_extension_draft",
                   return_value="Draft extension letter.") as mock_draft:

            # Simulate already escalated at current level
            escalation_level = "1_DAY" if days_out == 1 else ("CRITICAL" if days_out <= 0 else "7_DAY")
            events = [{
                "deadline_id": "dl-ext",
                "event_type": "ESCALATION_SENT",
                "escalation_level": escalation_level,
            }] if already_escalated else []

            def _col(firm_id, coll):
                if coll == "deadlines":
                    return _coll(dl)
                if coll == "time_entries":
                    return _coll(*all_entries)
                if coll == "client_communications":
                    return _coll(*all_comms)
                if coll == "deadline_events":
                    return _coll(*events)
                if coll == "matters":
                    return _coll({"id": "m-ext", "name": "Ext Matter", "client_id": "c1"})
                if coll == "clients":
                    return _coll({"id": "c1", "name": "Client"})
                if coll == "attorneys":
                    return _coll({"id": "dana-strand", "writing_style": {}})
                return _coll()

            mock_col_ref.side_effect = _col
            mock_esc.return_value = MagicMock(entity_id="esc-001")

            agent = DeadlineAgent()
            result = agent.run("strand-okafor")
            return result, mock_comm, mock_draft

    def test_extension_draft_created_when_1_day_no_activity(self):
        result, mock_comm, mock_draft = self._run_with_extension_check(
            days_out=1,
            has_recent_activity=False,
            comm_exists=False,
            already_escalated=True,
        )
        mock_draft.assert_called_once()
        mock_comm.assert_called_once()

    def test_no_extension_draft_when_matter_has_recent_activity(self):
        result, mock_comm, mock_draft = self._run_with_extension_check(
            days_out=1,
            has_recent_activity=True,
            comm_exists=False,
            already_escalated=True,
        )
        mock_comm.assert_not_called()

    def test_no_extension_draft_when_comm_already_exists(self):
        result, mock_comm, mock_draft = self._run_with_extension_check(
            days_out=1,
            has_recent_activity=False,
            comm_exists=True,
            already_escalated=True,
        )
        mock_comm.assert_not_called()

    def test_no_extension_draft_outside_1_day_critical(self):
        # 7-day deadline: 7_DAY cadence — no extension trigger
        result, mock_comm, mock_draft = self._run_with_extension_check(
            days_out=7,
            has_recent_activity=False,
            comm_exists=False,
            already_escalated=True,
        )
        mock_comm.assert_not_called()

    def test_extension_draft_observation_emitted(self):
        from app.observability import CommitmentLevel, ObservationType

        result, mock_comm, _ = self._run_with_extension_check(
            days_out=1,
            has_recent_activity=False,
            comm_exists=False,
            already_escalated=True,
        )
        if mock_comm.called:
            ext_obs = [
                o for o in result["observations"]
                if o.observation_type == "APPROVAL_GATE_APPLIED" and "Extension" in o.description
            ]
            assert len(ext_obs) >= 1


# ---------------------------------------------------------------------------
# Cadence gap detection
# ---------------------------------------------------------------------------

class TestCadenceGap:
    def test_gap_detected_when_14_day_to_critical(self):
        dl = _deadline(id="dl-gap", verification_status="attorney_verified", days_out=0)
        # Only 14_DAY escalation recorded — skipped 7_DAY, 3_DAY, 1_DAY
        events = [{
            "deadline_id": "dl-gap",
            "event_type": "ESCALATION_SENT",
            "escalation_level": "14_DAY",
        }]

        result, _, _, _, _ = _run_agent_with_deadlines([dl], deadline_events=events)
        gap_obs = [
            o for o in result["observations"]
            if o.observation_type == "WARN_NOTICE" and "Cadence gap" in o.description
        ]
        assert len(gap_obs) >= 1

    def test_no_gap_when_consecutive_levels(self):
        # Has 14_DAY, now at 7_DAY — consecutive, no gap
        dl = _deadline(id="dl-ok", verification_status="attorney_verified", days_out=6)
        events = [{
            "deadline_id": "dl-ok",
            "event_type": "ESCALATION_SENT",
            "escalation_level": "14_DAY",
        }]
        result, _, _, _, _ = _run_agent_with_deadlines([dl], deadline_events=events)
        gap_obs = [
            o for o in result["observations"]
            if o.observation_type == "WARN_NOTICE" and "Cadence gap" in o.description
        ]
        assert len(gap_obs) == 0
