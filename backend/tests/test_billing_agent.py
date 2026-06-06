"""
Phase 2 tests — v1.1.1 BillingAgent respec.

V11-P2-08: APPROVED entries detected; WARN emitted; budget_signals dict populated;
           readiness check blocks invoice on BLOCK condition.

All tests are unit-level — no Firestore connection required.
BillingAgent.run() is tested via mocking; route is tested via FastAPI test client.
"""

from __future__ import annotations

import os
from decimal import Decimal
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("LITT_DEMO_MODE", "true")
os.environ.setdefault("LITT_DEMO_DATE", "2026-06-25")
os.environ.setdefault("LITT_DEMO_FIRM_ID", "strand-okafor")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "litt-hackathon")


# ---------------------------------------------------------------------------
# Helpers — mock Firestore and tool layer
# ---------------------------------------------------------------------------

def _entry(
    id="te-x",
    status="PENDING",
    hours=1.0,
    attorney="dana-strand",
    matter="m1",
    entry_date="2026-06-24",
    narrative="Review documents.",
    client_id="c1",
    rate=350.0,
):
    return {
        "id": id,
        "status": status,
        "hours": hours,
        "attorney_id": attorney,
        "matter_id": matter,
        "entry_date": entry_date,
        "narrative": narrative,
        "client_id": client_id,
        "rate": rate,
        "amount": hours * rate,
        "session_minutes_actual": None,
        "ai_assisted": False,
    }


def _client(id="c1", budget_cap=10000.0, budget_billed=0.0, warn_threshold=0.75):
    return {
        "id": id,
        "name": f"Client {id}",
        "budget_cap": budget_cap,
        "budget_billed": budget_billed,
        "billing_guidelines": {
            "budget_notice_threshold": warn_threshold,
            "ai_disclosure_required": False,
            "forbidden_phrases": [],
            "required_task_codes": False,
            "activity_codes_required": False,
            "max_daily_hours_without_review": 8.0,
            "block_billing_allowed": True,
        },
    }


def _make_doc(data: dict):
    doc = MagicMock()
    doc.to_dict.return_value = data
    doc.id = data.get("id", "unknown")
    return doc


def _make_collection_stream(docs: List[dict]):
    """Returns a list of mock Firestore documents."""
    return [_make_doc(d) for d in docs]


# ---------------------------------------------------------------------------
# BillingAgent unit tests — mock Firestore, test logic
# ---------------------------------------------------------------------------

class TestBillingAgentApprovedEntries:
    """V11-P2-01: APPROVED entries now scanned."""

    def _run_agent(self, entries, clients=None):
        if clients is None:
            clients = [_client()]
        from app.agents.billing_agent import BillingAgent
        agent = BillingAgent()

        with patch("app.agents.billing_agent.collection_ref") as mock_col_ref, \
             patch("app.agents.billing_agent.compute_budget_utilization") as mock_budget, \
             patch("app.agents.billing_agent.log_anomaly") as mock_log:

            # Firestore stream returns entries for time_entries, clients for clients
            def _stream_side_effect(firm_id, collection):
                if collection == "time_entries":
                    return _make_collection_stream(entries)
                elif collection == "clients":
                    return _make_collection_stream(clients)
                return []

            mock_col_ref.return_value.stream.side_effect = lambda: []
            mock_col_ref.side_effect = lambda firm_id, coll: _make_mock_coll(
                entries if coll == "time_entries" else clients
            )

            # Budget returns CLEAR (no alerts)
            mock_budget.return_value = MagicMock(
                error_type=None,
                utilization_pct=0.50,
                billed_to_date=Decimal("500"),
                approved_unbilled=Decimal("0"),
                budget_cap=Decimal("10000"),
                total_committed=Decimal("500"),
                alert_status="CLEAR",
                __bool__=lambda self: True,
            )
            mock_budget.return_value.error_type = None  # no ToolError

            # log_anomaly returns a no-op result
            mock_result = MagicMock()
            mock_result.entity_id = "anom-001"
            mock_result.audit_event_id = "audit-001"
            mock_log.return_value = mock_result

            result = agent.run("strand-okafor")

        return result

    def test_approved_entries_included_in_scan(self):
        entries = [
            _entry(id="te-pending", status="PENDING"),
            _entry(id="te-approved", status="APPROVED"),
            _entry(id="te-billed", status="BILLED"),
        ]
        result = self._run_agent(entries)
        # BILLED excluded → 2 scanned
        assert result["entries_scanned"] == 2

    def test_billed_and_closed_entries_excluded(self):
        entries = [
            _entry(id="te-billed", status="BILLED"),
            _entry(id="te-closed", status="CLOSED"),
            _entry(id="te-written-off", status="WRITTEN_OFF"),
        ]
        result = self._run_agent(entries)
        assert result["entries_scanned"] == 0


def _make_mock_coll(docs):
    """Helper to create a mock Firestore collection with .stream()."""
    coll = MagicMock()
    coll.stream.return_value = _make_collection_stream(docs)
    return coll


class TestBillingAgentWarnFlags:
    """V11-P2-02: WARN flags produce WARN_NOTICE observations, no hard gate."""

    def _run_with_scrubber_flags(self, flags_by_entry):
        """
        flags_by_entry: dict {entry_id: [{"check_name": ..., "severity": ..., "message": ...}]}
        """
        from app.agents.billing_agent import BillingAgent
        from app.observability import ObservationType

        entries = list(flags_by_entry.keys())
        entry_list = [_entry(id=eid, status="PENDING") for eid in entries]

        agent = BillingAgent()

        def _fake_scrubber(entry, client):
            result = MagicMock()
            eid = entry["id"]
            flags_data = flags_by_entry.get(eid, [])
            flags = []
            for f in flags_data:
                flag = MagicMock()
                flag.severity = f["severity"]
                flag.check_name = f["check_name"]
                flag.message = f["message"]
                flag.matched_text = f.get("matched_text", "")
                flags.append(flag)
            result.flags = flags
            result.has_block = any(f.severity == "BLOCK" for f in flags)
            return result

        with patch("app.agents.billing_agent.collection_ref") as mock_col_ref, \
             patch("app.agents.billing_agent.compute_budget_utilization") as mock_budget, \
             patch("app.agents.billing_agent.run_prebill_checks", side_effect=_fake_scrubber), \
             patch("app.agents.billing_agent.log_anomaly") as mock_log:

            mock_col_ref.side_effect = lambda firm_id, coll: _make_mock_coll(
                entry_list if coll == "time_entries" else [_client()]
            )

            mock_budget.return_value = MagicMock(
                utilization_pct=0.50,
                billed_to_date=Decimal("500"),
                approved_unbilled=Decimal("0"),
                budget_cap=Decimal("10000"),
                total_committed=Decimal("500"),
                alert_status="CLEAR",
            )
            mock_budget.return_value.error_type = None

            mock_result = MagicMock()
            mock_result.entity_id = "anom-001"
            mock_result.audit_event_id = "audit-001"
            mock_log.return_value = mock_result

            result = agent.run("strand-okafor")

        return result

    def test_warn_flag_produces_warn_notice_observation(self):
        from app.observability import ObservationType

        result = self._run_with_scrubber_flags({
            "te-1": [{"check_name": "round_hours", "severity": "WARN", "message": "Round hours without session timer"}]
        })

        obs_types = [o.observation_type for o in result["observations"]]
        assert "WARN_NOTICE" in obs_types

    def test_warn_flag_does_not_create_hard_gate(self):
        from app.observability import CommitmentLevel

        result = self._run_with_scrubber_flags({
            "te-1": [{"check_name": "round_hours", "severity": "WARN", "message": "Round hours"}]
        })

        # No REVIEW_REQUIRED from WARN-only — final level should be AUTO_SAFE
        final_obs = result["observations"][-1]
        assert final_obs.commitment_level == CommitmentLevel.AUTO_SAFE

    def test_block_flag_produces_review_required(self):
        from app.observability import CommitmentLevel

        result = self._run_with_scrubber_flags({
            "te-2": [{"check_name": "narrative_absent", "severity": "BLOCK", "message": "No narrative"}]
        })

        final_obs = result["observations"][-1]
        assert final_obs.commitment_level == CommitmentLevel.REVIEW_REQUIRED


class TestBudgetSignals:
    """V11-P2-03 + V11-P2-04: Budget threshold detection and budget_signals dict."""

    def _run_with_budget(self, utilization_pct: float, client_id: str = "c1"):
        from app.agents.billing_agent import BillingAgent
        from app.models import BudgetUtilization, AlertStatus

        entries = [_entry(id="te-1", client_id=client_id, status="PENDING")]
        agent = BillingAgent()

        budget_cap = Decimal("10000")
        committed = Decimal(str(round(utilization_pct * 10000, 2)))
        billed = Decimal("7000")
        approved_unbilled = committed - billed if committed >= billed else Decimal("0")

        def _fake_budget(firm_id, cid):
            if cid != client_id:
                from app.models import ToolError
                return ToolError(error_type="NOT_FOUND", message="not found")
            return BudgetUtilization(
                client_id=cid,
                firm_id=firm_id,
                budget_cap=budget_cap,
                billed_to_date=billed,
                approved_unbilled=approved_unbilled,
                total_committed=committed,
                utilization_pct=utilization_pct,
                alert_threshold_warn=0.75,
                alert_threshold_critical=0.90,
                alert_status=(
                    AlertStatus.CRITICAL if utilization_pct >= 0.90
                    else (AlertStatus.WARN if utilization_pct >= 0.70 else AlertStatus.CLEAR)
                ),
            )

        with patch("app.agents.billing_agent.collection_ref") as mock_col_ref, \
             patch("app.agents.billing_agent.compute_budget_utilization", side_effect=_fake_budget), \
             patch("app.agents.billing_agent.run_prebill_checks") as mock_scrubber, \
             patch("app.agents.billing_agent.log_anomaly"):

            mock_col_ref.side_effect = lambda firm_id, coll: _make_mock_coll(
                entries if coll == "time_entries" else [_client(id=client_id)]
            )
            mock_scrubber.return_value = MagicMock(flags=[], has_block=False)

            result = agent.run("strand-okafor")

        return result

    def test_budget_signals_dict_populated(self):
        result = self._run_with_budget(0.80)
        assert "budget_signals" in result
        assert "c1" in result["budget_signals"]
        assert result["budget_signals"]["c1"]["utilization_pct"] == pytest.approx(0.80)

    def test_budget_signals_dict_has_required_keys(self):
        result = self._run_with_budget(0.50)
        sig = result["budget_signals"]["c1"]
        assert "client_id" in sig
        assert "utilization_pct" in sig
        assert "budget_cap" in sig
        assert "alert_status" in sig

    def test_90pct_emits_warn_notice_with_review_required(self):
        from app.observability import CommitmentLevel, ObservationType

        result = self._run_with_budget(0.92)
        warn_obs = [o for o in result["observations"] if o.observation_type == "WARN_NOTICE"]
        assert len(warn_obs) >= 1
        # 90%+ threshold → REVIEW_REQUIRED on the budget WARN_NOTICE
        critical_obs = [o for o in warn_obs if o.commitment_level == CommitmentLevel.REVIEW_REQUIRED]
        assert len(critical_obs) >= 1

    def test_70pct_emits_warn_notice_auto_safe(self):
        from app.observability import CommitmentLevel, ObservationType

        result = self._run_with_budget(0.75)
        warn_obs = [
            o for o in result["observations"]
            if o.observation_type == "WARN_NOTICE" and o.commitment_level == CommitmentLevel.AUTO_SAFE
        ]
        assert len(warn_obs) >= 1

    def test_50pct_does_not_emit_warn_notice(self):
        from app.observability import ObservationType

        result = self._run_with_budget(0.50)
        warn_obs = [o for o in result["observations"] if o.observation_type == "WARN_NOTICE"]
        assert len(warn_obs) == 0


# ---------------------------------------------------------------------------
# Invoice readiness check — route-level (V11-P2-06/07)
# ---------------------------------------------------------------------------

class TestInvoiceReadinessRoute:
    """V11-P2-06 + V11-P2-07: /api/actions/billing/generate-invoice enforces readiness."""

    def _client_for_route(self):
        from fastapi.testclient import TestClient
        from app.main import app
        return TestClient(app)

    def test_invoice_blocked_when_pending_entries(self):
        with patch("app.routes.actions.check_invoice_readiness") as mock_readiness, \
             patch("app.routes.actions.generate_invoice") as mock_gen:

            mock_readiness.return_value = {
                "ready": False,
                "blocking_entries": ["te-pending-1", "te-pending-2"],
                "warn_entries": [],
            }

            client = self._client_for_route()
            resp = client.post("/api/billing/generate-invoice", json={
                "firm_id": "strand-okafor",
                "client_id": "c1",
                "attorney_id": "dana-strand",
                "period_start": "2026-06-01",
                "period_end": "2026-06-30",
            })

            assert resp.status_code == 400
            body = resp.json()
            assert body["detail"]["error"] == "INVOICE_NOT_READY"
            assert "blocking_entries" in body["detail"]
            mock_gen.assert_not_called()

    def test_invoice_proceeds_when_ready(self):
        with patch("app.routes.actions.check_invoice_readiness") as mock_readiness, \
             patch("app.routes.actions.generate_invoice") as mock_gen:

            mock_readiness.return_value = {
                "ready": True,
                "blocking_entries": [],
                "warn_entries": [],
            }

            mock_result = MagicMock()
            mock_result.success = True
            mock_result.entity_id = "inv-001"
            mock_result.model_dump.return_value = {"success": True, "entity_id": "inv-001"}
            mock_gen.return_value = mock_result

            client = self._client_for_route()
            resp = client.post("/api/billing/generate-invoice", json={
                "firm_id": "strand-okafor",
                "client_id": "c1",
                "attorney_id": "dana-strand",
                "period_start": "2026-06-01",
                "period_end": "2026-06-30",
            })

            # Should not 400 — generate_invoice called
            assert resp.status_code != 400
            mock_gen.assert_called_once()
