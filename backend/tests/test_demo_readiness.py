"""
Demo readiness tests — all 5 conditions verified against mock Firestore data.

Tests the check functions in routes/demo.py directly (not via HTTP),
using the same mock pattern as test_brief_assembly.py.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _dt(y, m, d, h=0, mn=0):
    return datetime(y, m, d, h, mn, 0, tzinfo=timezone.utc)


DEMO_DT = datetime(2026, 5, 29, 16, 30, 0, tzinfo=timezone.utc)


def _make_doc(data: dict) -> MagicMock:
    doc = MagicMock()
    doc.exists = True
    doc.to_dict.return_value = data
    doc.id = data.get("id", "unknown")
    return doc


def _missing_doc() -> MagicMock:
    doc = MagicMock()
    doc.exists = False
    return doc


def _mock_get(data_or_none):
    if data_or_none is None:
        return _missing_doc()
    return _make_doc(data_or_none)


# ---------------------------------------------------------------------------
# Condition 1: deadline_mercer_escalates
# ---------------------------------------------------------------------------

class TestDeadlineMercerCheck:
    def _run(self, deadline_data):
        with patch("app.routes.demo.collection_ref") as mock_col:
            mock_col.return_value.document.return_value.get.return_value = _mock_get(deadline_data)
            from app.routes.demo import _check_deadline_mercer
            return _check_deadline_mercer("strand-okafor")

    def test_passes_with_correct_seed_data(self):
        result = self._run({
            "id": "dl-mercer-001", "status": "ACTIVE",
            "verification_status": "attorney_verified",
            "due_date": "2026-07-01",  # 6 days out from demo anchor 2026-06-25
            "last_confirmed_by": None, "classification": "HARD_LEGAL",
            "version": 1,
        })
        assert result["pass"] is True
        assert "6 days out" in result["detail"]

    def test_fails_when_not_found(self):
        result = self._run(None)
        assert result["pass"] is False
        assert "not found" in result["detail"]

    def test_fails_when_status_resolved(self):
        result = self._run({
            "id": "dl-mercer-001", "status": "RESOLVED",
            "verification_status": "attorney_verified",
            "due_date": "2026-07-01", "last_confirmed_by": None, "version": 1,
        })
        assert result["pass"] is False

    def test_fails_when_already_confirmed(self):
        result = self._run({
            "id": "dl-mercer-001", "status": "ACTIVE",
            "verification_status": "attorney_verified",
            "due_date": "2026-07-01",  # 6 days out from demo anchor 2026-06-25
            "last_confirmed_by": "dana-strand", "version": 1,
        })
        assert result["pass"] is False
        assert "confirmed" in result["detail"]

    def test_fails_when_unverified(self):
        result = self._run({
            "id": "dl-mercer-001", "status": "ACTIVE",
            "verification_status": "unverified",
            "due_date": "2026-07-01", "last_confirmed_by": None, "version": 1,
        })
        assert result["pass"] is False


# ---------------------------------------------------------------------------
# Condition 2: te_005_scrubber_hit
# ---------------------------------------------------------------------------

ACME_CLIENT = {
    "id": "acme-commercial", "billing_guidelines": {
        "forbidden_phrases": ["attention to file", "review documents", "work on matter"],
        "required_task_codes": True, "activity_codes_required": False,
        "ai_disclosure_required": True, "budget_notice_threshold": 0.75,
        "block_billing_allowed": False, "max_daily_hours_without_review": 8.0,
    }
}

TE_005 = {
    "id": "te-005", "status": "PENDING",
    "narrative": "review documents relating to vendor MSA indemnification provisions.",
    "client_id": "acme-commercial", "matter_id": "acme-contract-review-2026",
    "hours": 0.8, "amount": 280.0, "version": 1,
}


class TestTe005ScrubberCheck:
    def _run(self, entry_data, client_data=ACME_CLIENT):
        def mock_col(firm_id, col_name):
            m = MagicMock()
            if "time_entries" in col_name:
                m.document.return_value.get.return_value = _mock_get(entry_data)
            elif "clients" in col_name:
                m.document.return_value.get.return_value = _mock_get(client_data)
            return m

        with patch("app.routes.demo.collection_ref", side_effect=mock_col):
            from app.routes.demo import _check_te_005_scrubber
            return _check_te_005_scrubber("strand-okafor")

    def test_passes_with_forbidden_phrase(self):
        result = self._run(TE_005)
        assert result["pass"] is True
        assert "forbidden_phrase" in result["detail"]

    def test_fails_when_not_found(self):
        with patch("app.routes.demo.collection_ref") as mock_col:
            mock_col.return_value.document.return_value.get.return_value = _missing_doc()
            from app.routes.demo import _check_te_005_scrubber
            result = _check_te_005_scrubber("strand-okafor")
        assert result["pass"] is False

    def test_fails_when_narrative_clean(self):
        clean_entry = {**TE_005, "narrative": "Analyzed indemnification clauses in detail."}
        result = self._run(clean_entry)
        assert result["pass"] is False


# ---------------------------------------------------------------------------
# Condition 3: te_001_missing_narrative
# ---------------------------------------------------------------------------

class TestTe001MissingNarrativeCheck:
    def _run(self, entry_data):
        with patch("app.routes.demo.collection_ref") as mock_col:
            mock_col.return_value.document.return_value.get.return_value = _mock_get(entry_data)
            from app.routes.demo import _check_te_001_missing_narrative
            return _check_te_001_missing_narrative("strand-okafor")

    def test_passes_when_narrative_is_none(self):
        result = self._run({
            "id": "te-001", "status": "PENDING", "narrative": None, "version": 1
        })
        assert result["pass"] is True

    def test_fails_when_narrative_present(self):
        result = self._run({
            "id": "te-001", "status": "PENDING",
            "narrative": "Drafted motion for summary judgment response.",
            "version": 1,
        })
        assert result["pass"] is False

    def test_fails_when_not_pending(self):
        result = self._run({
            "id": "te-001", "status": "APPROVED", "narrative": None, "version": 1
        })
        assert result["pass"] is False

    def test_fails_when_not_found(self):
        with patch("app.routes.demo.collection_ref") as mock_col:
            mock_col.return_value.document.return_value.get.return_value = _missing_doc()
            from app.routes.demo import _check_te_001_missing_narrative
            result = _check_te_001_missing_narrative("strand-okafor")
        assert result["pass"] is False


# ---------------------------------------------------------------------------
# Condition 4: acme_budget_warn
# ---------------------------------------------------------------------------

ACME_CLIENT_BUDGET = {
    "id": "acme-commercial", "budget_cap": 15000, "budget_billed": 11000,
    "billing_guidelines": {"budget_notice_threshold": 0.75},
}

TE_006_APPROVED = {
    "id": "te-006", "client_id": "acme-commercial", "status": "APPROVED", "amount": 700.0
}


class TestAcmeBudgetCheck:
    def _run(self, client_data, entries):
        def mock_col(firm_id, col_name):
            m = MagicMock()
            if "clients" in col_name:
                m.document.return_value.get.return_value = _mock_get(client_data)
            elif "time_entries" in col_name:
                docs = [_make_doc(e) for e in entries]
                m.stream.return_value = docs
            return m

        with patch("app.routes.demo.collection_ref", side_effect=mock_col):
            from app.routes.demo import _check_acme_budget_warn
            return _check_acme_budget_warn("strand-okafor")

    def test_passes_at_78_percent(self):
        result = self._run(ACME_CLIENT_BUDGET, [TE_006_APPROVED])
        assert result["pass"] is True
        assert "78" in result["detail"] or "WARN" in result["detail"]

    def test_fails_below_threshold(self):
        result = self._run(ACME_CLIENT_BUDGET, [])
        # $11,000 / $15,000 = 73.3% < 75%
        assert result["pass"] is False

    def test_fails_when_no_budget_cap(self):
        client_no_cap = {**ACME_CLIENT_BUDGET, "budget_cap": None}
        result = self._run(client_no_cap, [TE_006_APPROVED])
        assert result["pass"] is False

    def test_passes_at_critical_threshold(self):
        # $13,500 + $500 = $14,000 / $15,000 = 93%
        big_client = {**ACME_CLIENT_BUDGET, "budget_billed": 13500}
        result = self._run(big_client, [{"id": "te-x", "client_id": "acme-commercial",
                                          "status": "APPROVED", "amount": 500.0}])
        assert result["pass"] is True
        assert "CRITICAL" in result["detail"]


# ---------------------------------------------------------------------------
# Condition 5: whitmore_client_silence
# ---------------------------------------------------------------------------

WHITMORE_MATTER = {
    "id": "whitmore-employment-2026", "status": "ACTIVE",
    "last_client_contact": _dt(2026, 6, 9),  # 16 days before demo anchor 2026-06-25
    "client_id": "whitmore-group",
}

WHITMORE_CLIENT = {
    "id": "whitmore-group", "client_silence_threshold_days": 14
}


class TestWhitmoreSilenceCheck:
    def _run(self, matter_data, client_data=WHITMORE_CLIENT):
        def mock_col(firm_id, col_name):
            m = MagicMock()
            if "matters" in col_name:
                m.document.return_value.get.return_value = _mock_get(matter_data)
            elif "clients" in col_name:
                m.document.return_value.get.return_value = _mock_get(client_data)
            return m

        with patch("app.routes.demo.collection_ref", side_effect=mock_col):
            from app.routes.demo import _check_whitmore_silence
            return _check_whitmore_silence("strand-okafor")

    def test_passes_with_16_day_silence(self):
        result = self._run(WHITMORE_MATTER)
        assert result["pass"] is True
        assert "16 days" in result["detail"]

    def test_fails_with_recent_contact(self):
        # 5 days before demo anchor — within 14-day threshold, so silence check should fail
        recent_matter = {**WHITMORE_MATTER, "last_client_contact": _dt(2026, 6, 20)}
        result = self._run(recent_matter)
        assert result["pass"] is False

    def test_fails_when_matter_not_found(self):
        with patch("app.routes.demo.collection_ref") as mock_col:
            mock_col.return_value.document.return_value.get.return_value = _missing_doc()
            from app.routes.demo import _check_whitmore_silence
            result = _check_whitmore_silence("strand-okafor")
        assert result["pass"] is False

    def test_fails_when_matter_not_active(self):
        closed_matter = {**WHITMORE_MATTER, "status": "CLOSED"}
        result = self._run(closed_matter)
        assert result["pass"] is False

    def test_iso_string_date_parsed_correctly(self):
        str_matter = {**WHITMORE_MATTER, "last_client_contact": "2026-05-13T00:00:00Z"}
        result = self._run(str_matter)
        assert result["pass"] is True


# ---------------------------------------------------------------------------
# demo_ready endpoint — all 5 checks
# ---------------------------------------------------------------------------

class TestDemoReadyEndpoint:
    def _all_pass_mocks(self):
        """Patch all 5 check functions to return pass=True."""
        return {
            "app.routes.demo._check_deadline_mercer": {"pass": True, "detail": "ok"},
            "app.routes.demo._check_te_005_scrubber": {"pass": True, "detail": "ok"},
            "app.routes.demo._check_te_001_missing_narrative": {"pass": True, "detail": "ok"},
            "app.routes.demo._check_acme_budget_warn": {"pass": True, "detail": "ok"},
            "app.routes.demo._check_whitmore_silence": {"pass": True, "detail": "ok"},
        }

    def test_ok_true_when_all_pass(self):
        patches = self._all_pass_mocks()
        with (
            patch("app.routes.demo._check_deadline_mercer", return_value={"pass": True, "detail": "ok"}),
            patch("app.routes.demo._check_te_005_scrubber", return_value={"pass": True, "detail": "ok"}),
            patch("app.routes.demo._check_te_001_missing_narrative", return_value={"pass": True, "detail": "ok"}),
            patch("app.routes.demo._check_acme_budget_warn", return_value={"pass": True, "detail": "ok"}),
            patch("app.routes.demo._check_whitmore_silence", return_value={"pass": True, "detail": "ok"}),
        ):
            from app.routes.demo import demo_ready
            result = demo_ready()
        assert result["ok"] is True
        assert len(result["checks"]) == 5

    def test_ok_false_when_one_fails(self):
        with (
            patch("app.routes.demo._check_deadline_mercer", return_value={"pass": False, "detail": "missing"}),
            patch("app.routes.demo._check_te_005_scrubber", return_value={"pass": True, "detail": "ok"}),
            patch("app.routes.demo._check_te_001_missing_narrative", return_value={"pass": True, "detail": "ok"}),
            patch("app.routes.demo._check_acme_budget_warn", return_value={"pass": True, "detail": "ok"}),
            patch("app.routes.demo._check_whitmore_silence", return_value={"pass": True, "detail": "ok"}),
        ):
            from app.routes.demo import demo_ready
            result = demo_ready()
        assert result["ok"] is False
        assert result["checks"]["deadline_mercer_escalates"]["pass"] is False

    def test_response_has_required_keys(self):
        with (
            patch("app.routes.demo._check_deadline_mercer", return_value={"pass": True, "detail": "ok"}),
            patch("app.routes.demo._check_te_005_scrubber", return_value={"pass": True, "detail": "ok"}),
            patch("app.routes.demo._check_te_001_missing_narrative", return_value={"pass": True, "detail": "ok"}),
            patch("app.routes.demo._check_acme_budget_warn", return_value={"pass": True, "detail": "ok"}),
            patch("app.routes.demo._check_whitmore_silence", return_value={"pass": True, "detail": "ok"}),
        ):
            from app.routes.demo import demo_ready
            result = demo_ready()
        assert "ok" in result
        assert "demo_date" in result
        assert "firm_id" in result
        assert "checks" in result


# ---------------------------------------------------------------------------
# demo_reset endpoint
# ---------------------------------------------------------------------------

class TestDemoReset:
    def test_returns_ok_false_without_confirm(self):
        from app.routes.demo import demo_reset, ResetRequest
        req = ResetRequest(firm_id="strand-okafor", confirm=False)
        result = demo_reset(req)
        assert result["ok"] is False

    def test_returns_ok_false_for_wrong_firm(self):
        from app.routes.demo import demo_reset, ResetRequest
        req = ResetRequest(firm_id="other-firm", confirm=True)
        result = demo_reset(req)
        assert result["ok"] is False

    def test_calls_run_reset_with_confirm(self):
        # The demo_reset endpoint does `from app.demo.seeder import run_reset` lazily,
        # so we patch the module-level function in the seeder.
        with patch("app.demo.seeder.run_reset", return_value={"ok": True, "firm_id": "strand-okafor", "docs_deleted": 42}):
            from app.routes.demo import demo_reset, ResetRequest
            req = ResetRequest(firm_id="strand-okafor", confirm=True)
            result = demo_reset(req)
        assert result["ok"] is True
