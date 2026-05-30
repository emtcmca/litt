"""
Scrubber tests — pure function tests, no Firestore.
run_prebill_checks() takes dicts and returns ScrubberResult.
"""

import pytest
from app.scrubber.prebill import (
    ScrubberFlag,
    ScrubberResult,
    run_prebill_checks,
    _check_missing_narrative,
    _check_forbidden_phrases,
    _check_round_hour_anomaly,
    _check_excessive_hours,
    _check_block_billing,
    _check_missing_task_code,
    _check_missing_activity_code,
    _check_ai_disclosure,
)


def _entry(**kwargs) -> dict:
    base = {
        "id": "te-test",
        "hours": 1.5,
        "narrative": "Reviewed contract provisions and drafted summary memo.",
        "session_minutes_actual": 90,
        "task_code": "L110",
        "activity_code": "A103",
        "ai_assisted": False,
        "client_ai_disclosure_required": False,
        "client_ai_disclosure_status": None,
    }
    base.update(kwargs)
    return base


def _client(**kwargs) -> dict:
    base = {
        "id": "client-test",
        "billing_guidelines": {
            "block_billing_allowed": True,
            "max_daily_hours_without_review": 8.0,
            "forbidden_phrases": [],
            "required_task_codes": False,
            "activity_codes_required": False,
            "budget_notice_threshold": 0.75,
        }
    }
    if "billing_guidelines" in kwargs:
        base["billing_guidelines"].update(kwargs.pop("billing_guidelines"))
    base.update(kwargs)
    return base


class TestMissingNarrative:
    def test_none_narrative_is_block(self):
        flag = _check_missing_narrative(_entry(narrative=None))
        assert flag is not None
        assert flag.severity == "BLOCK"
        assert flag.check_name == "missing_narrative"

    def test_empty_string_is_block(self):
        flag = _check_missing_narrative(_entry(narrative=""))
        assert flag is not None

    def test_whitespace_only_is_block(self):
        flag = _check_missing_narrative(_entry(narrative="   "))
        assert flag is not None

    def test_valid_narrative_passes(self):
        flag = _check_missing_narrative(_entry(narrative="Drafted motion to dismiss."))
        assert flag is None


class TestForbiddenPhrases:
    def test_exact_match_is_block(self):
        client = _client(billing_guidelines={"forbidden_phrases": ["review documents"]})
        flags = _check_forbidden_phrases(_entry(narrative="I review documents for the client."), client)
        assert len(flags) == 1
        assert flags[0].severity == "BLOCK"
        assert flags[0].matched_text == "review documents"

    def test_case_insensitive_match(self):
        # "Review Documents" phrase lowercased = "review documents"
        # narrative lowercased contains "review documents" exactly
        client = _client(billing_guidelines={"forbidden_phrases": ["Review Documents"]})
        flags = _check_forbidden_phrases(_entry(narrative="I REVIEW DOCUMENTS per client request."), client)
        assert len(flags) == 1

    def test_substring_match(self):
        # "review documents" IS a substring of this narrative
        client = _client(billing_guidelines={"forbidden_phrases": ["review documents"]})
        flags = _check_forbidden_phrases(_entry(narrative="Review documents for this matter."), client)
        assert len(flags) == 1

    def test_no_match_passes(self):
        client = _client(billing_guidelines={"forbidden_phrases": ["review documents"]})
        flags = _check_forbidden_phrases(_entry(narrative="Drafted motion to dismiss and filed with court."), client)
        assert len(flags) == 0

    def test_multiple_phrases_all_flagged(self):
        client = _client(billing_guidelines={"forbidden_phrases": ["review documents", "various"]})
        flags = _check_forbidden_phrases(_entry(narrative="Review documents for various purposes."), client)
        assert len(flags) == 2

    def test_empty_forbidden_list_passes(self):
        client = _client(billing_guidelines={"forbidden_phrases": []})
        flags = _check_forbidden_phrases(_entry(narrative="Anything here."), client)
        assert len(flags) == 0


class TestRoundHourAnomaly:
    def test_round_hours_no_session_is_warn(self):
        flag = _check_round_hour_anomaly(_entry(hours=2.0, session_minutes_actual=None))
        assert flag is not None
        assert flag.severity == "WARN"
        assert flag.check_name == "round_hour_anomaly"

    def test_round_hours_with_session_passes(self):
        flag = _check_round_hour_anomaly(_entry(hours=2.0, session_minutes_actual=120))
        assert flag is None

    def test_non_round_hours_no_session_passes(self):
        flag = _check_round_hour_anomaly(_entry(hours=1.4, session_minutes_actual=None))
        assert flag is None

    def test_zero_hours_no_session_passes(self):
        flag = _check_round_hour_anomaly(_entry(hours=0.0, session_minutes_actual=None))
        assert flag is None


class TestExcessiveHours:
    def test_hours_over_max_is_warn(self):
        client = _client(billing_guidelines={"max_daily_hours_without_review": 8.0})
        flag = _check_excessive_hours(_entry(hours=9.5), client)
        assert flag is not None
        assert flag.severity == "WARN"

    def test_hours_at_max_passes(self):
        client = _client(billing_guidelines={"max_daily_hours_without_review": 8.0})
        flag = _check_excessive_hours(_entry(hours=8.0), client)
        assert flag is None

    def test_hours_under_max_passes(self):
        client = _client(billing_guidelines={"max_daily_hours_without_review": 8.0})
        flag = _check_excessive_hours(_entry(hours=3.0), client)
        assert flag is None


class TestBlockBilling:
    def test_semicolon_narrative_when_disallowed_is_warn(self):
        client = _client(billing_guidelines={"block_billing_allowed": False})
        flag = _check_block_billing(_entry(narrative="Reviewed contract; drafted memo; conferred with client."), client)
        assert flag is not None
        assert flag.severity == "WARN"
        assert flag.check_name == "block_billing"

    def test_semicolon_narrative_when_allowed_passes(self):
        client = _client(billing_guidelines={"block_billing_allowed": True})
        flag = _check_block_billing(_entry(narrative="Reviewed contract; drafted memo."), client)
        assert flag is None

    def test_no_semicolon_when_disallowed_passes(self):
        client = _client(billing_guidelines={"block_billing_allowed": False})
        flag = _check_block_billing(_entry(narrative="Reviewed contract provisions and drafted summary."), client)
        assert flag is None


class TestMissingTaskCode:
    def test_missing_when_required_is_block(self):
        client = _client(billing_guidelines={"required_task_codes": True})
        flag = _check_missing_task_code(_entry(task_code=None), client)
        assert flag is not None
        assert flag.severity == "BLOCK"

    def test_present_when_required_passes(self):
        client = _client(billing_guidelines={"required_task_codes": True})
        flag = _check_missing_task_code(_entry(task_code="L110"), client)
        assert flag is None

    def test_missing_when_not_required_passes(self):
        client = _client(billing_guidelines={"required_task_codes": False})
        flag = _check_missing_task_code(_entry(task_code=None), client)
        assert flag is None


class TestMissingActivityCode:
    def test_missing_when_required_is_block(self):
        client = _client(billing_guidelines={"activity_codes_required": True})
        flag = _check_missing_activity_code(_entry(activity_code=None), client)
        assert flag is not None
        assert flag.severity == "BLOCK"

    def test_present_when_required_passes(self):
        client = _client(billing_guidelines={"activity_codes_required": True})
        flag = _check_missing_activity_code(_entry(activity_code="A103"), client)
        assert flag is None


class TestAiDisclosure:
    def test_ai_assisted_disclosure_required_and_missing_is_block(self):
        flag = _check_ai_disclosure(_entry(
            ai_assisted=True,
            client_ai_disclosure_required=True,
            client_ai_disclosure_status=None,
        ))
        assert flag is not None
        assert flag.severity == "BLOCK"
        assert flag.check_name == "ai_disclosure_missing"

    def test_ai_assisted_disclosure_required_and_set_passes(self):
        flag = _check_ai_disclosure(_entry(
            ai_assisted=True,
            client_ai_disclosure_required=True,
            client_ai_disclosure_status="included",
        ))
        assert flag is None

    def test_not_ai_assisted_passes(self):
        flag = _check_ai_disclosure(_entry(
            ai_assisted=False,
            client_ai_disclosure_required=True,
            client_ai_disclosure_status=None,
        ))
        assert flag is None

    def test_disclosure_not_required_passes(self):
        flag = _check_ai_disclosure(_entry(
            ai_assisted=True,
            client_ai_disclosure_required=False,
            client_ai_disclosure_status=None,
        ))
        assert flag is None


class TestRunPrebillChecks:
    def test_clean_entry_returns_no_flags(self):
        entry = _entry(
            hours=1.4,
            session_minutes_actual=84,
            narrative="Drafted motion to dismiss and reviewed supporting exhibits.",
        )
        result = run_prebill_checks(entry, _client())
        assert result.clean is True
        assert result.has_block is False
        assert result.has_warn is False

    def test_te005_demo_condition(self):
        """te-005 has 'review documents' in narrative — should flag forbidden phrase."""
        entry = _entry(
            id="te-005",
            hours=0.8,
            session_minutes_actual=None,
            narrative="Review documents per client request.",
        )
        client = _client(billing_guidelines={"forbidden_phrases": ["review documents"]})
        result = run_prebill_checks(entry, client)
        assert result.has_block is True
        block_names = [f.check_name for f in result.flags if f.severity == "BLOCK"]
        assert "forbidden_phrase" in block_names

    def test_te001_demo_condition(self):
        """te-001 has no narrative — should flag missing_narrative."""
        entry = _entry(id="te-001", hours=1.4, narrative=None, session_minutes_actual=None)
        result = run_prebill_checks(entry, _client())
        assert result.has_block is True
        assert any(f.check_name == "missing_narrative" for f in result.flags)

    def test_multiple_flags_accumulated(self):
        """Entry with no narrative AND round hours AND forbidden phrase gets all flags."""
        entry = _entry(
            hours=2.0,
            narrative=None,
            session_minutes_actual=None,
        )
        client = _client(billing_guidelines={"forbidden_phrases": ["review documents"]})
        result = run_prebill_checks(entry, client)
        # missing_narrative is a block, round_hour_anomaly is a warn
        names = [f.check_name for f in result.flags]
        assert "missing_narrative" in names
        assert "round_hour_anomaly" in names
