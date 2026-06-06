"""
Phase 1 tests — v1.1.1 AnomalyAgent new detectors and Gemini gate.

V11-P1-13: five new Python detector tests
V11-P1-14: Gemini gate logic tests (mocked — no live Vertex AI)

All tests use synthetic data; no Firestore connection required.
"""

from __future__ import annotations

import os
from datetime import date, datetime
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("LITT_DEMO_MODE", "true")
os.environ.setdefault("LITT_DEMO_DATE", "2026-06-25")
os.environ.setdefault("LITT_DEMO_FIRM_ID", "strand-okafor")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "litt-hackathon")

from app.agents.anomaly_agent import (
    AnomalySignal,
    _call_gemini_anomaly_enrichment,
    _detect_entry_clustering,
    _detect_invoice_staleness,
    _detect_late_entry_creation,
    _detect_rate_anomaly,
    _detect_semantic_duplicate_candidates,
    _semantic_similar,
)
from app.models import AnomalyType

TODAY = date(2026, 6, 25)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _entry(
    id="te-x",
    status="PENDING",
    hours=1.0,
    attorney="dana-strand",
    matter="m1",
    entry_date="2026-06-24",
    created_at="2026-06-24T17:00:00Z",
    narrative="Review documents.",
    rate=350.0,
    client_id="c1",
):
    return {
        "id": id,
        "status": status,
        "hours": hours,
        "attorney_id": attorney,
        "matter_id": matter,
        "entry_date": entry_date,
        "created_at": created_at,
        "narrative": narrative,
        "rate": rate,
        "client_id": client_id,
        "session_minutes_actual": None,
        "amount": hours * rate,
    }


def _attorney(id="dana-strand", default_rate=350.0):
    return {"id": id, "default_rate": default_rate}


# ---------------------------------------------------------------------------
# V11-P1-01: LATE_ENTRY_CREATION detector
# ---------------------------------------------------------------------------

class TestLateEntryCreation:
    def test_fires_when_created_4_days_after_entry_date(self):
        entry = _entry(
            id="te-late-1",
            entry_date="2026-06-20",
            created_at="2026-06-24T10:00:00Z",
            status="PENDING",
        )
        signals = _detect_late_entry_creation([entry])
        assert len(signals) == 1
        assert signals[0].entity_id == "te-late-1"
        assert signals[0].anomaly_type == AnomalyType.LATE_ENTRY_CREATION
        assert signals[0].context["days_late"] == 4

    def test_no_fire_on_same_day_entry(self):
        entry = _entry(
            entry_date="2026-06-24",
            created_at="2026-06-24T17:00:00Z",
            status="PENDING",
        )
        signals = _detect_late_entry_creation([entry])
        assert len(signals) == 0

    def test_no_fire_when_3_days_or_less(self):
        entry = _entry(
            entry_date="2026-06-21",
            created_at="2026-06-24T10:00:00Z",
            status="PENDING",
        )
        signals = _detect_late_entry_creation([entry])
        assert len(signals) == 0

    def test_no_fire_on_billed_status(self):
        entry = _entry(
            id="te-late-billed",
            entry_date="2026-06-01",
            created_at="2026-06-24T10:00:00Z",
            status="BILLED",
        )
        signals = _detect_late_entry_creation([entry])
        assert len(signals) == 0

    def test_no_fire_on_written_off(self):
        entry = _entry(
            entry_date="2026-06-01",
            created_at="2026-06-24T10:00:00Z",
            status="WRITTEN_OFF",
        )
        signals = _detect_late_entry_creation([entry])
        assert len(signals) == 0

    def test_fires_on_approved_status(self):
        entry = _entry(
            id="te-late-approved",
            entry_date="2026-06-10",
            created_at="2026-06-24T10:00:00Z",
            status="APPROVED",
        )
        signals = _detect_late_entry_creation([entry])
        assert len(signals) == 1
        assert signals[0].context["days_late"] == 14

    def test_skips_entry_missing_dates(self):
        entry = _entry(status="PENDING")
        entry["entry_date"] = None
        entry["created_at"] = None
        signals = _detect_late_entry_creation([entry])
        assert len(signals) == 0


# ---------------------------------------------------------------------------
# V11-P1-02: ENTRY_CLUSTERING detector
# ---------------------------------------------------------------------------

class TestEntryClustering:
    def _make_cluster(self, count=3, hours_each=1.0, attorney="dana-strand", matter="m1"):
        return [
            _entry(
                id=f"te-cluster-{i}",
                attorney=attorney,
                matter=matter,
                entry_date="2026-06-24",
                hours=hours_each,
                status="PENDING",
            )
            for i in range(count)
        ]

    def test_fires_when_6_entries_same_attorney_matter_date(self):
        entries = self._make_cluster(count=6, hours_each=1.0)
        signals = _detect_entry_clustering(entries)
        assert len(signals) == 1
        assert signals[0].anomaly_type == AnomalyType.ENTRY_CLUSTERING
        assert signals[0].context["entry_count"] == 6

    def test_fires_when_total_hours_exceed_8(self):
        entries = self._make_cluster(count=3, hours_each=3.0)
        signals = _detect_entry_clustering(entries)
        assert len(signals) == 1
        assert signals[0].context["total_hours"] == pytest.approx(9.0)

    def test_no_fire_when_5_entries_under_8h(self):
        entries = self._make_cluster(count=5, hours_each=1.0)
        signals = _detect_entry_clustering(entries)
        assert len(signals) == 0

    def test_no_fire_single_entry(self):
        entries = self._make_cluster(count=1, hours_each=10.0)
        signals = _detect_entry_clustering(entries)
        assert len(signals) == 0

    def test_different_dates_not_clustered(self):
        e1 = _entry(id="te-1", entry_date="2026-06-23", hours=5.0)
        e2 = _entry(id="te-2", entry_date="2026-06-24", hours=5.0)
        signals = _detect_entry_clustering([e1, e2])
        assert len(signals) == 0

    def test_different_matters_not_clustered(self):
        entries = [
            _entry(id="te-1", matter="m1", entry_date="2026-06-24", hours=5.0),
            _entry(id="te-2", matter="m2", entry_date="2026-06-24", hours=5.0),
        ]
        signals = _detect_entry_clustering(entries)
        assert len(signals) == 0

    def test_skips_written_off_entries(self):
        entries = self._make_cluster(count=6, hours_each=2.0)
        for e in entries:
            e["status"] = "WRITTEN_OFF"
        signals = _detect_entry_clustering(entries)
        assert len(signals) == 0

    def test_priority_is_3(self):
        entries = self._make_cluster(count=6)
        signals = _detect_entry_clustering(entries)
        assert signals[0].priority == 3


# ---------------------------------------------------------------------------
# V11-P1-03: Semantic duplicate pre-filter (_semantic_similar)
# ---------------------------------------------------------------------------

class TestSemanticSimilar:
    def test_identical_strings_are_similar(self):
        assert _semantic_similar("Review documents for hearing.", "Review documents for hearing.") is True

    def test_high_overlap_narratives_are_similar(self):
        a = "Reviewed the deposition transcript and summarized key points."
        b = "Reviewed deposition transcript and summarized key points for file."
        assert _semantic_similar(a, b) is True

    def test_different_narratives_not_similar(self):
        a = "Drafted motion to compel discovery responses."
        b = "Reviewed deposition transcript and summarized key points."
        assert _semantic_similar(a, b) is False

    def test_empty_strings_not_similar(self):
        assert _semantic_similar("", "Review documents.") is False
        assert _semantic_similar("Review documents.", "") is False
        assert _semantic_similar("", "") is False

    def test_short_paraphrase_flagged(self):
        a = "Phone call with client re: case status."
        b = "Telephone call with client regarding case status."
        # Shared tokens: client, case, status → 3/5 = 60% → True
        assert _semantic_similar(a, b) is True


class TestSemanticDuplicateCandidates:
    def test_flags_similar_entries_on_same_matter(self):
        e1 = _entry(id="te-1", matter="m1", narrative="Reviewed the deposition transcript for key points.")
        e2 = _entry(id="te-2", matter="m1", narrative="Reviewed deposition transcript for key points in file.")
        signals = _detect_semantic_duplicate_candidates([e1, e2])
        assert len(signals) == 2
        flagged = {s.entity_id for s in signals}
        assert "te-1" in flagged
        assert "te-2" in flagged

    def test_no_fire_on_different_matters(self):
        e1 = _entry(id="te-1", matter="m1", narrative="Reviewed deposition transcript for key points.")
        e2 = _entry(id="te-2", matter="m2", narrative="Reviewed deposition transcript for key points.")
        signals = _detect_semantic_duplicate_candidates([e1, e2])
        assert len(signals) == 0

    def test_no_fire_on_distinct_narratives(self):
        e1 = _entry(id="te-1", matter="m1", narrative="Drafted motion to compel.")
        e2 = _entry(id="te-2", matter="m1", narrative="Reviewed deposition transcript.")
        signals = _detect_semantic_duplicate_candidates([e1, e2])
        assert len(signals) == 0

    def test_skips_billed_entries(self):
        e1 = _entry(id="te-1", matter="m1", status="BILLED", narrative="Reviewed deposition.")
        e2 = _entry(id="te-2", matter="m1", status="BILLED", narrative="Reviewed deposition.")
        signals = _detect_semantic_duplicate_candidates([e1, e2])
        assert len(signals) == 0

    def test_anomaly_type_correct(self):
        e1 = _entry(id="te-1", matter="m1", narrative="Reviewed deposition transcript for key points.")
        e2 = _entry(id="te-2", matter="m1", narrative="Reviewed deposition transcript for key points in file.")
        signals = _detect_semantic_duplicate_candidates([e1, e2])
        for sig in signals:
            assert sig.anomaly_type == AnomalyType.SEMANTIC_DUPLICATE_CANDIDATE


# ---------------------------------------------------------------------------
# V11-P1-04: RATE_ANOMALY detector
# ---------------------------------------------------------------------------

class TestRateAnomaly:
    def test_fires_when_rate_over_15pct_above_default(self):
        entry = _entry(id="te-rate-1", attorney="dana-strand", rate=420.0, status="PENDING")
        attorneys = {"dana-strand": _attorney(default_rate=350.0)}
        signals = _detect_rate_anomaly([entry], attorneys)
        assert len(signals) == 1
        assert signals[0].anomaly_type == AnomalyType.RATE_ANOMALY
        assert signals[0].context["deviation_pct"] == pytest.approx(20.0, rel=0.01)

    def test_fires_when_rate_over_15pct_below_default(self):
        entry = _entry(id="te-rate-2", attorney="dana-strand", rate=280.0, status="PENDING")
        attorneys = {"dana-strand": _attorney(default_rate=350.0)}
        signals = _detect_rate_anomaly([entry], attorneys)
        assert len(signals) == 1
        assert signals[0].context["deviation_pct"] == pytest.approx(20.0, rel=0.01)

    def test_no_fire_within_15pct(self):
        entry = _entry(attorney="dana-strand", rate=360.0, status="PENDING")
        attorneys = {"dana-strand": _attorney(default_rate=350.0)}
        signals = _detect_rate_anomaly([entry], attorneys)
        assert len(signals) == 0

    def test_no_fire_when_attorney_missing(self):
        entry = _entry(attorney="unknown-attorney", rate=500.0, status="PENDING")
        signals = _detect_rate_anomaly([entry], {})
        assert len(signals) == 0

    def test_no_fire_when_entry_rate_zero(self):
        entry = _entry(attorney="dana-strand", rate=0.0, status="PENDING")
        attorneys = {"dana-strand": _attorney(default_rate=350.0)}
        signals = _detect_rate_anomaly([entry], attorneys)
        assert len(signals) == 0

    def test_skips_written_off(self):
        entry = _entry(attorney="dana-strand", rate=600.0, status="WRITTEN_OFF")
        attorneys = {"dana-strand": _attorney(default_rate=350.0)}
        signals = _detect_rate_anomaly([entry], attorneys)
        assert len(signals) == 0

    def test_priority_is_2(self):
        entry = _entry(attorney="dana-strand", rate=500.0, status="PENDING")
        attorneys = {"dana-strand": _attorney(default_rate=350.0)}
        signals = _detect_rate_anomaly([entry], attorneys)
        assert signals[0].priority == 2


# ---------------------------------------------------------------------------
# V11-P1-05: INVOICE_STALENESS detector
# ---------------------------------------------------------------------------

class TestInvoiceStaleness:
    def test_fires_when_approved_entry_31_days_old(self):
        entry = _entry(
            id="te-stale-1",
            status="APPROVED",
            entry_date="2026-05-25",  # 31 days before 2026-06-25
        )
        signals = _detect_invoice_staleness([entry], TODAY)
        assert len(signals) == 1
        assert signals[0].anomaly_type == AnomalyType.INVOICE_STALENESS
        assert signals[0].context["days_stale"] == 31

    def test_no_fire_when_only_29_days_old(self):
        entry = _entry(
            status="APPROVED",
            entry_date="2026-05-27",  # 29 days before 2026-06-25
        )
        signals = _detect_invoice_staleness([entry], TODAY)
        assert len(signals) == 0

    def test_no_fire_on_pending_entry(self):
        entry = _entry(status="PENDING", entry_date="2026-05-01")
        signals = _detect_invoice_staleness([entry], TODAY)
        assert len(signals) == 0

    def test_no_fire_on_billed_entry(self):
        entry = _entry(status="BILLED", entry_date="2026-05-01")
        signals = _detect_invoice_staleness([entry], TODAY)
        assert len(signals) == 0

    def test_skips_entry_without_date(self):
        entry = _entry(status="APPROVED")
        entry["entry_date"] = None
        signals = _detect_invoice_staleness([entry], TODAY)
        assert len(signals) == 0

    def test_priority_is_2(self):
        entry = _entry(status="APPROVED", entry_date="2026-05-01")
        signals = _detect_invoice_staleness([entry], TODAY)
        assert signals[0].priority == 2


# ---------------------------------------------------------------------------
# V11-P1-06: Priority sort (signals sorted descending)
# ---------------------------------------------------------------------------

class TestPrioritySort:
    def test_signals_sorted_descending_by_priority(self):
        sigs = [
            AnomalySignal(entity_id="a", anomaly_type="X", description="", priority=2),
            AnomalySignal(entity_id="b", anomaly_type="Y", description="", priority=5),
            AnomalySignal(entity_id="c", anomaly_type="Z", description="", priority=3),
        ]
        sigs.sort(key=lambda s: s.priority, reverse=True)
        priorities = [s.priority for s in sigs]
        assert priorities == [5, 3, 2]


# ---------------------------------------------------------------------------
# V11-P1-14: Gemini gate — _call_gemini_anomaly_enrichment
# ---------------------------------------------------------------------------

class TestGeminiGate:
    """
    Gate conditions tested without live Vertex AI.
    When gate passes and _call_gemini returns text, enrichment is returned.
    When gate fails, None returned without calling Gemini.
    """

    def _low_priority_signal(self) -> AnomalySignal:
        return AnomalySignal(
            entity_id="te-1",
            anomaly_type=AnomalyType.LATE_ENTRY_CREATION,
            description="Late entry.",
            priority=2,
            context={"has_hard_legal_deadline": False, "budget_pct": 0.0},
        )

    def _high_priority_signal(self) -> AnomalySignal:
        return AnomalySignal(
            entity_id="te-2",
            anomaly_type=AnomalyType.ENTRY_CLUSTERING,
            description="Clustered entries.",
            priority=3,
            context={"has_hard_legal_deadline": False, "budget_pct": 0.0},
        )

    def test_low_priority_signal_skips_gemini(self):
        sig = self._low_priority_signal()
        # With no Gemini mocking, gate should return None before calling Gemini
        with patch("app.agents.anomaly_agent._call_gemini") as mock_gemini:
            result = _call_gemini_anomaly_enrichment(sig)
            mock_gemini.assert_not_called()
            assert result is None

    def test_high_priority_signal_calls_gemini(self):
        sig = self._high_priority_signal()
        with patch("app.agents.anomaly_agent._call_gemini", return_value="Risk: clustered billing on single day.") as mock_gemini:
            result = _call_gemini_anomaly_enrichment(sig)
            mock_gemini.assert_called_once()
            assert result == "Risk: clustered billing on single day."

    def test_hard_legal_context_calls_gemini_regardless_of_priority(self):
        sig = self._low_priority_signal()
        sig.context["has_hard_legal_deadline"] = True
        with patch("app.agents.anomaly_agent._call_gemini", return_value="Hard legal deadline context.") as mock_gemini:
            result = _call_gemini_anomaly_enrichment(sig)
            mock_gemini.assert_called_once()
            assert result is not None

    def test_high_budget_pct_calls_gemini(self):
        sig = self._low_priority_signal()
        sig.context["budget_pct"] = 0.85
        with patch("app.agents.anomaly_agent._call_gemini", return_value="Budget overrun context.") as mock_gemini:
            result = _call_gemini_anomaly_enrichment(sig)
            mock_gemini.assert_called_once()
            assert result is not None

    def test_ai_disclosure_gap_always_calls_gemini(self):
        sig = AnomalySignal(
            entity_id="te-3",
            anomaly_type=AnomalyType.AI_DISCLOSURE_GAP,
            description="Disclosure missing.",
            priority=1,
            context={},
        )
        with patch("app.agents.anomaly_agent._call_gemini", return_value="Disclosure risk.") as mock_gemini:
            result = _call_gemini_anomaly_enrichment(sig)
            mock_gemini.assert_called_once()
            assert result is not None

    def test_gemini_returns_none_propagated(self):
        sig = self._high_priority_signal()
        with patch("app.agents.anomaly_agent._call_gemini", return_value=None):
            result = _call_gemini_anomaly_enrichment(sig)
            assert result is None

    def test_gemini_exception_returns_none(self):
        # Exception inside _call_gemini (e.g. Vertex unreachable) is caught;
        # returns None without raising. Mock at the vertexai layer so the real
        # try/except in _call_gemini can fire.
        sig = self._high_priority_signal()
        with patch("vertexai.init", side_effect=Exception("Vertex down")):
            result = _call_gemini_anomaly_enrichment(sig)
            assert result is None
