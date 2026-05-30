"""
Brief assembler tests — verify all 5 sections populate correctly from seed-like data.
Mocks Firestore so tests run without a live DB connection.

Critical demo conditions verified:
  - dl-mercer-001: appears in deadlines section, days_out=6, has_critical=True
  - te-005: appears in time_entries section with forbidden_phrase BLOCK flag
  - te-001: appears in time_entries section with missing_narrative BLOCK flag
  - acme-commercial: appears in budget_risks at 78% utilization
  - whitmore-employment-2026: appears in client_silence (16 days)
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Seed-matching fixtures
# ---------------------------------------------------------------------------

DEMO_DATE = date(2026, 5, 29)
DEMO_DT = datetime(2026, 5, 29, 16, 30, 0, tzinfo=timezone.utc)


def _dt(y, m, d, h=0, mn=0):
    return datetime(y, m, d, h, mn, 0, tzinfo=timezone.utc)


ATTORNEYS = {
    "dana-strand": {
        "id": "dana-strand", "firm_id": "strand-okafor",
        "name": "Dana Strand", "email": "dana@strand-okafor.com",
        "default_rate": 350, "billing_increment": 0.1,
        "timekeeper_id": "ds001", "timekeeper_classification": "AT",
        "rate_overrides": {}, "permission_scope": ["billing", "deadlines", "comms", "admin"],
        "is_backup_contact": True,
        "created_at": _dt(2026, 1, 15), "updated_at": _dt(2026, 1, 15),
    }
}

ACME_GUIDELINES = {
    "block_billing_allowed": False, "travel_time_allowed": False,
    "intraoffice_conference_allowed": "limited", "research_requires_preapproval": False,
    "max_daily_hours_without_review": 8.0,
    "forbidden_phrases": ["attention to file", "review documents", "work on matter", "various matters"],
    "required_task_codes": True, "activity_codes_required": False,
    "ledes_required": True, "ai_disclosure_required": True,
    "budget_notice_threshold": 0.75, "outside_counsel_guidelines": "Acme OCG v2.1",
}

DEFAULT_GUIDELINES = {
    "block_billing_allowed": True, "travel_time_allowed": True,
    "intraoffice_conference_allowed": "yes", "research_requires_preapproval": False,
    "max_daily_hours_without_review": 10.0, "forbidden_phrases": [],
    "required_task_codes": False, "activity_codes_required": False,
    "ledes_required": False, "ai_disclosure_required": False,
    "budget_notice_threshold": 0.75, "outside_counsel_guidelines": None,
}

CLIENTS = {
    "acme-commercial": {
        "id": "acme-commercial", "firm_id": "strand-okafor",
        "name": "Acme Commercial Partners LLC",
        "budget_cap": 15000, "budget_billed": 11000,
        "client_silence_threshold_days": 14,
        "billing_guidelines": ACME_GUIDELINES,
        "last_client_contact": _dt(2026, 5, 21),
    },
    "mercer-industries": {
        "id": "mercer-industries", "firm_id": "strand-okafor",
        "name": "Mercer Industries",
        "budget_cap": 25000, "budget_billed": 8000,
        "client_silence_threshold_days": 14,
        "billing_guidelines": DEFAULT_GUIDELINES,
        "last_client_contact": _dt(2026, 5, 22),
    },
    "reyes-family-holdings": {
        "id": "reyes-family-holdings", "firm_id": "strand-okafor",
        "name": "Reyes Family Holdings LLC",
        "budget_cap": 18000, "budget_billed": 5500,
        "client_silence_threshold_days": 14,
        "billing_guidelines": DEFAULT_GUIDELINES,
        "last_client_contact": _dt(2026, 5, 25),
    },
    "whitmore-group": {
        "id": "whitmore-group", "firm_id": "strand-okafor",
        "name": "Whitmore Group",
        "budget_cap": 12000, "budget_billed": 4388,
        "client_silence_threshold_days": 14,
        "billing_guidelines": DEFAULT_GUIDELINES,
        "last_client_contact": _dt(2026, 5, 13),
    },
}

MATTERS = {
    "mercer-v-dunlap": {
        "id": "mercer-v-dunlap", "firm_id": "strand-okafor",
        "client_id": "mercer-industries",
        "name": "Mercer Industries v. Dunlap Construction",
        "type": "litigation", "status": "ACTIVE",
        "last_client_contact": _dt(2026, 5, 22),
    },
    "reyes-acquisition": {
        "id": "reyes-acquisition", "firm_id": "strand-okafor",
        "client_id": "reyes-family-holdings",
        "name": "Reyes Family Holdings — LOI Acquisition",
        "type": "transactional", "status": "ACTIVE",
        "last_client_contact": _dt(2026, 5, 25),
    },
    "acme-contract-review-2026": {
        "id": "acme-contract-review-2026", "firm_id": "strand-okafor",
        "client_id": "acme-commercial",
        "name": "Acme Commercial — Vendor MSA Review",
        "type": "transactional", "status": "ACTIVE",
        "last_client_contact": _dt(2026, 5, 21),
    },
    "whitmore-employment-2026": {
        "id": "whitmore-employment-2026", "firm_id": "strand-okafor",
        "client_id": "whitmore-group",
        "name": "Whitmore Group — Employment Advisory",
        "type": "advisory", "status": "ACTIVE",
        "last_client_contact": _dt(2026, 5, 13),
    },
}

TIME_ENTRIES = [
    {
        "id": "te-001", "firm_id": "strand-okafor",
        "matter_id": "mercer-v-dunlap", "client_id": "mercer-industries",
        "attorney_id": "dana-strand", "entry_date": "2026-05-27",
        "hours": 1.4, "rate": 350, "amount": 490.0,
        "session_minutes_actual": 83, "task_code": "L200",
        "activity_code": None, "narrative": None,
        "status": "PENDING", "ai_assisted": False,
        "client_ai_disclosure_required": False, "client_ai_disclosure_status": None,
        "billing_guidelines": DEFAULT_GUIDELINES,
    },
    {
        "id": "te-002", "firm_id": "strand-okafor",
        "matter_id": "mercer-v-dunlap", "client_id": "mercer-industries",
        "attorney_id": "dana-strand", "entry_date": "2026-05-26",
        "hours": 0.5, "rate": 350, "amount": 175.0,
        "session_minutes_actual": 29, "task_code": "L300", "activity_code": "A106",
        "narrative": "Reviewed deposition transcript.",
        "status": "APPROVED", "ai_assisted": False,
        "client_ai_disclosure_required": False, "client_ai_disclosure_status": None,
    },
    {
        "id": "te-003", "firm_id": "strand-okafor",
        "matter_id": "reyes-acquisition", "client_id": "reyes-family-holdings",
        "attorney_id": "dana-strand", "entry_date": "2026-05-28",
        "hours": 0.8, "rate": 350, "amount": 280.0,
        "session_minutes_actual": 47, "task_code": "A100", "activity_code": "A104",
        "narrative": "Reviewed and marked up LOI draft; circulated redline.",
        "status": "PENDING", "ai_assisted": True,
        "client_ai_disclosure_required": False, "client_ai_disclosure_status": "not_required",
    },
    {
        "id": "te-005", "firm_id": "strand-okafor",
        "matter_id": "acme-contract-review-2026", "client_id": "acme-commercial",
        "attorney_id": "dana-strand", "entry_date": "2026-05-28",
        "hours": 0.8, "rate": 350, "amount": 280.0,
        "session_minutes_actual": 46, "task_code": "A100", "activity_code": None,
        "narrative": "review documents relating to vendor MSA indemnification provisions.",
        "status": "PENDING", "ai_assisted": False,
        "client_ai_disclosure_required": False, "client_ai_disclosure_status": None,
    },
    {
        "id": "te-006", "firm_id": "strand-okafor",
        "matter_id": "acme-contract-review-2026", "client_id": "acme-commercial",
        "attorney_id": "dana-strand", "entry_date": "2026-05-22",
        "hours": 2.0, "rate": 350, "amount": 700.0,
        "session_minutes_actual": None, "task_code": "A100", "activity_code": None,
        "narrative": "Analyzed indemnification clauses.",
        "status": "APPROVED", "ai_assisted": True,
        "client_ai_disclosure_required": True, "client_ai_disclosure_status": "included",
    },
    {
        "id": "te-008", "firm_id": "strand-okafor",
        "matter_id": "whitmore-employment-2026", "client_id": "whitmore-group",
        "attorney_id": "kofi-okafor", "entry_date": "2026-05-20",
        "hours": 1.1, "rate": 375, "amount": 412.5,
        "session_minutes_actual": 65, "task_code": "A200", "activity_code": "A107",
        "narrative": "Reviewed employment handbook.",
        "status": "APPROVED", "ai_assisted": False,
        "client_ai_disclosure_required": False, "client_ai_disclosure_status": None,
    },
]

DEADLINES = [
    {
        "id": "dl-mercer-001", "firm_id": "strand-okafor",
        "matter_id": "mercer-v-dunlap",
        "description": "Opposition to defendant's motion for summary judgment due",
        "due_date": "2026-06-04",
        "classification": "HARD_LEGAL",
        "status": "ACTIVE",
        "source_type": "court_order",
        "verification_status": "attorney_verified",
        "last_confirmed_by": None, "last_confirmed_at": None,
    },
    {
        "id": "dl-reyes-001", "firm_id": "strand-okafor",
        "matter_id": "reyes-acquisition",
        "description": "LOI acceptance window closes",
        "due_date": "2026-06-09",
        "classification": "HARD_CONTRACTUAL",
        "status": "ACTIVE",
        "source_type": "contract",
        "verification_status": "attorney_verified",
        "last_confirmed_by": None, "last_confirmed_at": None,
    },
]


def _make_stream(docs: list):
    """Build a mock Firestore stream from a list of dicts."""
    mock_docs = []
    for d in docs:
        m = MagicMock()
        m.id = d.get("id", "unknown")
        m.to_dict.return_value = d
        mock_docs.append(m)
    stream = MagicMock()
    stream.__iter__ = MagicMock(return_value=iter(mock_docs))
    return stream


def _mock_collection_ref(firm_id, collection_name):
    col = MagicMock()
    if collection_name == "attorneys":
        col.stream.return_value = _make_stream(list(ATTORNEYS.values()))
    elif collection_name == "clients":
        col.stream.return_value = _make_stream(list(CLIENTS.values()))
    elif collection_name == "matters":
        col.stream.return_value = _make_stream(list(MATTERS.values()))
    elif collection_name == "time_entries":
        col.stream.return_value = _make_stream(TIME_ENTRIES)
    elif collection_name == "deadlines":
        col.stream.return_value = _make_stream(DEADLINES)
    elif collection_name == "escalations":
        col.stream.return_value = _make_stream([])
    else:
        col.stream.return_value = _make_stream([])
    return col


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestDeadlinesSection:
    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_dl_mercer_001_present(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        ids = [i.deadline_id for i in brief.sections.deadlines.items]
        assert "dl-mercer-001" in ids

    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_has_critical_true(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        assert brief.sections.deadlines.has_critical is True

    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_mercer_days_out_is_6(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        mercer = next(i for i in brief.sections.deadlines.items if i.deadline_id == "dl-mercer-001")
        assert mercer.days_out == 6

    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_mercer_escalation_level_7_day(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        mercer = next(i for i in brief.sections.deadlines.items if i.deadline_id == "dl-mercer-001")
        assert mercer.escalation_level == "7_DAY"

    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_mercer_is_unconfirmed(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        mercer = next(i for i in brief.sections.deadlines.items if i.deadline_id == "dl-mercer-001")
        assert mercer.is_unconfirmed is True

    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_deadlines_sorted_by_days_out(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        days = [i.days_out for i in brief.sections.deadlines.items]
        assert days == sorted(days)


class TestTimeEntriesSection:
    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_te005_scrubber_block_flag(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        ids = [i.entry_id for i in brief.sections.time_entries.items]
        assert "te-005" in ids
        te005 = next(i for i in brief.sections.time_entries.items if i.entry_id == "te-005")
        assert te005.has_block is True
        names = [f.check_name for f in te005.scrubber_flags]
        assert "forbidden_phrase" in names

    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_te001_missing_narrative_flag(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        te001 = next(i for i in brief.sections.time_entries.items if i.entry_id == "te-001")
        assert te001.has_block is True
        names = [f.check_name for f in te001.scrubber_flags]
        assert "missing_narrative" in names

    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_only_pending_entries_appear(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        # te-002 is APPROVED, te-006 is APPROVED, te-008 is APPROVED — should not appear
        approved_ids = {"te-002", "te-006", "te-008"}
        entry_ids = {i.entry_id for i in brief.sections.time_entries.items}
        assert approved_ids.isdisjoint(entry_ids)

    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_block_entries_sorted_first(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        items = brief.sections.time_entries.items
        # First entry must have has_block True if any entry has it
        if any(i.has_block for i in items):
            assert items[0].has_block is True

    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_total_wip_is_pending_sum(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        # PENDING entries: te-001($490) + te-003($280) + te-005($280) = $1050
        assert brief.sections.time_entries.total_wip_usd == pytest.approx(1050.0)


class TestBudgetSection:
    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_acme_budget_warn_present(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        ids = [i.client_id for i in brief.sections.budget_risks.items]
        assert "acme-commercial" in ids

    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_acme_utilization_78_pct(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        acme = next(i for i in brief.sections.budget_risks.items if i.client_id == "acme-commercial")
        # $11,000 billed + $700 approved = $11,700 / $15,000 = 78%
        assert acme.utilization_pct == pytest.approx(78.0, abs=0.2)

    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_other_clients_not_flagged(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        ids = {i.client_id for i in brief.sections.budget_risks.items}
        assert "mercer-industries" not in ids
        assert "reyes-family-holdings" not in ids
        assert "whitmore-group" not in ids


class TestClientSilenceSection:
    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_whitmore_silence_present(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        ids = [i.matter_id for i in brief.sections.client_silence.items]
        assert "whitmore-employment-2026" in ids

    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_whitmore_days_since_is_16(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        whitmore = next(
            i for i in brief.sections.client_silence.items
            if i.matter_id == "whitmore-employment-2026"
        )
        assert whitmore.days_since_contact == 16

    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_other_matters_not_flagged(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        ids = {i.matter_id for i in brief.sections.client_silence.items}
        assert "mercer-v-dunlap" not in ids
        assert "reyes-acquisition" not in ids
        assert "acme-contract-review-2026" not in ids


class TestAnomaliesSection:
    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_empty_anomalies_before_sweep(self, mock_dt, mock_date, mock_coll):
        """Before any sweep runs, escalations collection is empty."""
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        assert brief.sections.anomalies.count == 0

    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_anomaly_appears_after_escalation_seeded(self, mock_dt, mock_date, mock_coll):
        """Once an ANOMALY escalation is in the collection, it shows in the brief."""
        from datetime import timezone as tz
        seeded_esc = {
            "id": "esc-test-001", "firm_id": "strand-okafor",
            "type": "ANOMALY", "status": "PENDING",
            "entity_id": "te-001", "matter_id": "mercer-v-dunlap",
            "priority": 2,
            "brief": {
                "what_is_happening": "Missing narrative on te-001.",
                "why_it_matters": "Billing anomaly.",
                "what_litt_has_done": "Flagged MISSING_NARRATIVE.",
                "what_attorney_must_decide": "Review and correct or write off.",
                "risk_level": "ELEVATED",
            },
            "created_at": datetime(2026, 5, 29, 16, 30, 0, tzinfo=tz.utc),
            "updated_at": datetime(2026, 5, 29, 16, 30, 0, tzinfo=tz.utc),
        }

        def mock_with_escalation(firm_id, collection_name):
            if collection_name == "escalations":
                col = MagicMock()
                col.stream.return_value = _make_stream([seeded_esc])
                return col
            return _mock_collection_ref(firm_id, collection_name)

        with patch("app.brief.assembler.collection_ref", side_effect=mock_with_escalation):
            from app.brief.assembler import assemble_brief
            brief = assemble_brief("strand-okafor")
            assert brief.sections.anomalies.count == 1
            assert brief.sections.anomalies.items[0].entity_id == "te-001"


class TestBriefResponseShape:
    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_all_5_sections_present(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        assert brief.sections.deadlines is not None
        assert brief.sections.time_entries is not None
        assert brief.sections.budget_risks is not None
        assert brief.sections.client_silence is not None
        assert brief.sections.anomalies is not None

    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_firm_metadata_populated(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        assert brief.firm_id == "strand-okafor"
        assert brief.firm_name == "Strand & Okafor LLP"
        assert brief.attorney_id == "dana-strand"
        assert brief.attorney_name == "Dana Strand"

    @patch("app.brief.assembler.collection_ref", side_effect=_mock_collection_ref)
    @patch("app.brief.assembler.config.get_effective_date", return_value=DEMO_DATE)
    @patch("app.brief.assembler.config.get_effective_datetime", return_value=DEMO_DT)
    @patch("app.brief.assembler.config.DEMO_MODE", True)
    def test_demo_mode_flag_set(self, mock_dt, mock_date, mock_coll):
        from app.brief.assembler import assemble_brief
        brief = assemble_brief("strand-okafor")
        assert brief.demo_mode is True
