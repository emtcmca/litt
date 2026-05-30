"""
Anomaly agent tests — detectors and scoring override rules.
All tests use synthetic data; no Firestore connection required.
"""

from __future__ import annotations

import pytest

from app.agents.anomaly_agent import (
    AnomalySignal,
    _detect_ai_disclosure_gap,
    _detect_duplicate_entries,
    _detect_round_hours_no_session,
    _detect_stale_verified_deadlines,
    apply_scoring_overrides,
)
from datetime import date


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _entry(
    id="te-x", status="PENDING", hours=1.0, session_minutes=60,
    attorney="dana-strand", matter="m1", entry_date="2026-05-27",
    ai_assisted=False, narrative="Review docs.", client_id="c1",
    disclosure_required=False, disclosure_status=None,
):
    return {
        "id": id, "status": status, "hours": hours,
        "session_minutes_actual": session_minutes,
        "attorney_id": attorney, "matter_id": matter,
        "entry_date": entry_date, "client_id": client_id,
        "ai_assisted": ai_assisted,
        "client_ai_disclosure_required": disclosure_required,
        "client_ai_disclosure_status": disclosure_status,
        "narrative": narrative,
        "amount": hours * 350,
        "created_at": "2026-05-27T17:00:00Z",
    }


def _client(id="c1", ai_disclosure_required=False):
    return {
        "id": id,
        "billing_guidelines": {
            "ai_disclosure_required": ai_disclosure_required,
            "forbidden_phrases": [],
            "budget_notice_threshold": 0.75,
            "required_task_codes": False,
            "activity_codes_required": False,
            "max_daily_hours_without_review": 8.0,
            "block_billing_allowed": True,
        },
    }


def _deadline(id, days_out, classification="HARD_LEGAL", status="ACTIVE",
              verification="attorney_verified"):
    from datetime import timedelta
    due = date(2026, 5, 29) + timedelta(days=days_out)
    return {
        "id": id, "status": status, "verification_status": verification,
        "due_date": due.isoformat(), "classification": classification,
        "matter_id": "m1", "description": "Test deadline",
    }


def _event(deadline_id, event_type="ESCALATION_SENT", created_at="2026-05-28T10:00:00Z"):
    return {
        "deadline_id": deadline_id,
        "event_type": event_type,
        "created_at": created_at,
    }


TODAY = date(2026, 5, 29)


# ---------------------------------------------------------------------------
# Round hours detector
# ---------------------------------------------------------------------------

class TestRoundHoursDetector:
    def test_fires_on_pending_round_hours_no_session(self):
        entry = _entry(id="te-1", hours=2.0, session_minutes=None, status="PENDING")
        signals = _detect_round_hours_no_session([entry])
        assert len(signals) == 1
        assert signals[0].anomaly_type == "ROUND_HOURS_NO_SESSION"
        assert signals[0].entity_id == "te-1"

    def test_fires_on_approved_round_hours_no_session(self):
        entry = _entry(id="te-2", hours=1.0, session_minutes=None, status="APPROVED")
        signals = _detect_round_hours_no_session([entry])
        assert len(signals) == 1

    def test_no_fire_when_session_present(self):
        entry = _entry(id="te-3", hours=2.0, session_minutes=120, status="PENDING")
        signals = _detect_round_hours_no_session([entry])
        assert len(signals) == 0

    def test_no_fire_on_non_round_hours(self):
        entry = _entry(id="te-4", hours=1.4, session_minutes=None, status="PENDING")
        signals = _detect_round_hours_no_session([entry])
        assert len(signals) == 0

    def test_no_fire_on_billed_status(self):
        entry = _entry(id="te-5", hours=3.0, session_minutes=None, status="BILLED")
        signals = _detect_round_hours_no_session([entry])
        assert len(signals) == 0

    def test_no_fire_on_zero_hours(self):
        entry = _entry(id="te-6", hours=0.0, session_minutes=None, status="PENDING")
        signals = _detect_round_hours_no_session([entry])
        assert len(signals) == 0


# ---------------------------------------------------------------------------
# Duplicate entry detector
# ---------------------------------------------------------------------------

class TestDuplicateDetector:
    def test_fires_on_identical_attorney_matter_date_hours(self):
        e1 = _entry(id="te-a", hours=1.4, session_minutes=83)
        e2 = _entry(id="te-b", hours=1.4, session_minutes=83)
        e1["created_at"] = "2026-05-27T17:00:00Z"
        e2["created_at"] = "2026-05-27T18:00:00Z"
        signals = _detect_duplicate_entries([e1, e2])
        assert len(signals) == 1
        assert signals[0].entity_id == "te-b"
        assert signals[0].context["original_entry_id"] == "te-a"

    def test_no_fire_on_different_dates(self):
        e1 = _entry(id="te-a", entry_date="2026-05-26")
        e2 = _entry(id="te-b", entry_date="2026-05-27")
        e1["created_at"] = "2026-05-26T10:00:00Z"
        e2["created_at"] = "2026-05-27T10:00:00Z"
        signals = _detect_duplicate_entries([e1, e2])
        assert len(signals) == 0

    def test_no_fire_on_different_hours(self):
        e1 = _entry(id="te-a", hours=1.4)
        e2 = _entry(id="te-b", hours=1.5)
        e1["created_at"] = "2026-05-27T10:00:00Z"
        e2["created_at"] = "2026-05-27T11:00:00Z"
        signals = _detect_duplicate_entries([e1, e2])
        assert len(signals) == 0

    def test_written_off_skipped(self):
        e1 = _entry(id="te-a", status="WRITTEN_OFF")
        e2 = _entry(id="te-b")
        e1["created_at"] = "2026-05-27T10:00:00Z"
        e2["created_at"] = "2026-05-27T11:00:00Z"
        signals = _detect_duplicate_entries([e1, e2])
        assert len(signals) == 0


# ---------------------------------------------------------------------------
# AI disclosure detector
# ---------------------------------------------------------------------------

class TestAiDisclosureDetector:
    def test_fires_when_client_requires_disclosure_and_status_not_set(self):
        entry = _entry(id="te-1", ai_assisted=True, disclosure_required=True, disclosure_status=None, status="PENDING")
        client = _client(id="c1", ai_disclosure_required=True)
        entry["client_ai_disclosure_required"] = True
        signals = _detect_ai_disclosure_gap([entry], {"c1": client})
        assert len(signals) == 1
        assert signals[0].anomaly_type == "AI_DISCLOSURE_GAP"

    def test_no_fire_when_disclosure_status_set(self):
        entry = _entry(id="te-1", ai_assisted=True, disclosure_required=True, disclosure_status="included", status="PENDING")
        entry["client_ai_disclosure_required"] = True
        client = _client(id="c1", ai_disclosure_required=True)
        signals = _detect_ai_disclosure_gap([entry], {"c1": client})
        assert len(signals) == 0

    def test_no_fire_when_not_ai_assisted(self):
        entry = _entry(id="te-1", ai_assisted=False, disclosure_required=True, status="PENDING")
        client = _client(id="c1", ai_disclosure_required=True)
        signals = _detect_ai_disclosure_gap([entry], {"c1": client})
        assert len(signals) == 0

    def test_no_fire_when_client_not_require_disclosure(self):
        entry = _entry(id="te-1", ai_assisted=True, status="PENDING")
        entry["client_ai_disclosure_required"] = False
        client = _client(id="c1", ai_disclosure_required=False)
        signals = _detect_ai_disclosure_gap([entry], {"c1": client})
        assert len(signals) == 0


# ---------------------------------------------------------------------------
# Stale deadline detector
# ---------------------------------------------------------------------------

class TestStaleDeadlineDetector:
    def test_fires_when_no_recent_events(self):
        dl = _deadline("dl-1", days_out=6)
        # Event from 10 days ago — outside 7-day window
        evt = _event("dl-1", created_at="2026-05-19T10:00:00Z")
        signals = _detect_stale_verified_deadlines([dl], [evt], TODAY)
        assert len(signals) == 1
        assert signals[0].entity_id == "dl-1"

    def test_no_fire_when_recent_event_exists(self):
        dl = _deadline("dl-1", days_out=6)
        evt = _event("dl-1", created_at="2026-05-28T10:00:00Z")  # yesterday
        signals = _detect_stale_verified_deadlines([dl], [evt], TODAY)
        assert len(signals) == 0

    def test_no_fire_when_deadline_not_verified(self):
        dl = _deadline("dl-1", days_out=6, verification="unverified")
        signals = _detect_stale_verified_deadlines([dl], [], TODAY)
        assert len(signals) == 0

    def test_no_fire_when_too_far_out(self):
        dl = _deadline("dl-1", days_out=20)
        signals = _detect_stale_verified_deadlines([dl], [], TODAY)
        assert len(signals) == 0

    def test_no_fire_on_overdue_deadline(self):
        dl = _deadline("dl-1", days_out=-1)
        signals = _detect_stale_verified_deadlines([dl], [], TODAY)
        assert len(signals) == 0


# ---------------------------------------------------------------------------
# Scoring overrides
# ---------------------------------------------------------------------------

class TestScoringOverrides:
    def test_hard_legal_deadline_context_elevates_priority(self):
        sig = AnomalySignal(
            entity_id="te-1",
            anomaly_type="ROUND_HOURS_NO_SESSION",
            description="test",
            priority=2,
            risk_level="ELEVATED",
            context={"has_hard_legal_deadline": True},
        )
        apply_scoring_overrides(sig)
        assert sig.priority == 3
        assert sig.risk_level == "CRITICAL"

    def test_ai_disclosure_gap_with_required_client_elevates(self):
        sig = AnomalySignal(
            entity_id="te-1",
            anomaly_type="AI_DISCLOSURE_GAP",
            description="test",
            priority=3,
            risk_level="ELEVATED",
            context={"client_ai_disclosure_required": True},
        )
        apply_scoring_overrides(sig)
        assert sig.priority == 4
        assert sig.risk_level == "CRITICAL"

    def test_priority_capped_at_5(self):
        sig = AnomalySignal(
            entity_id="te-1",
            anomaly_type="AI_DISCLOSURE_GAP",
            description="test",
            priority=5,
            risk_level="ELEVATED",
            context={"client_ai_disclosure_required": True, "has_hard_legal_deadline": True},
        )
        apply_scoring_overrides(sig)
        assert sig.priority == 5  # capped

    def test_no_context_no_override(self):
        sig = AnomalySignal(
            entity_id="te-1",
            anomaly_type="ROUND_HOURS_NO_SESSION",
            description="test",
            priority=2,
            risk_level="ELEVATED",
            context={},
        )
        original_priority = sig.priority
        original_risk = sig.risk_level
        apply_scoring_overrides(sig)
        assert sig.priority == original_priority
        assert sig.risk_level == original_risk

    def test_duplicate_with_billed_entries_elevates_priority(self):
        sig = AnomalySignal(
            entity_id="te-1",
            anomaly_type="DUPLICATE_ENTRY_CANDIDATE",
            description="test",
            priority=3,
            risk_level="ELEVATED",
            context={"has_billed_entries": True},
        )
        apply_scoring_overrides(sig)
        assert sig.priority == 4
