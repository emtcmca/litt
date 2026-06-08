"""
Maintenance tool tests — pure logic, Firestore mocked.
Covers G10-01 through G10-04 and CM-P8-01 classify tests.
"""

import pytest
from unittest.mock import MagicMock, patch, call
from datetime import datetime


# ---------------------------------------------------------------------------
# classify_update (CM-P8-01 — deterministic, no Firestore)
# ---------------------------------------------------------------------------

class TestClassifyUpdate:
    def test_safe_cases(self):
        from app.tools.maintenance_tools import classify_update
        from app.models import UpdateClass

        safe_kinds = [
            "new_deadline_from_auth_source",
            "contact_field_from_signature",
            "deterministic_budget_recompute",
            "inbound_logged_to_timeline",
            "matter_field_set_from_engagement",
            "silence_threshold_crossed",
        ]
        for kind in safe_kinds:
            result = classify_update({"kind": kind})
            assert result == UpdateClass.safe, f"{kind} should be SAFE"

    def test_judgment_cases(self):
        from app.tools.maintenance_tools import classify_update
        from app.models import UpdateClass

        judgment_kinds = [
            "matter_stage_reclassification",
            "threshold_change",
            "conflict_name_addition",
            "status_transition",
            "budget_increase_proposal",
            "contact_priority_change",
        ]
        for kind in judgment_kinds:
            result = classify_update({"kind": kind})
            assert result == UpdateClass.judgment, f"{kind} should be JUDGMENT"

    def test_unknown_kind_defaults_to_judgment(self):
        from app.tools.maintenance_tools import classify_update
        from app.models import UpdateClass

        result = classify_update({"kind": "something_totally_new"})
        assert result == UpdateClass.judgment

    def test_missing_kind_defaults_to_judgment(self):
        from app.tools.maintenance_tools import classify_update
        from app.models import UpdateClass

        result = classify_update({})
        assert result == UpdateClass.judgment


# ---------------------------------------------------------------------------
# dismiss_suggestion — empty reason (CM-P8-01 / G10-03)
# ---------------------------------------------------------------------------

class TestDismissSuggestion:
    @patch("app.tools.maintenance_tools.collection_ref")
    def test_empty_reason_returns_tool_error(self, mock_coll):
        from app.tools.maintenance_tools import dismiss_suggestion
        from app.models import ToolError

        result = dismiss_suggestion(
            firm_id="strand-okafor",
            client_id="mercer-industries",
            suggestion_id="ms-1",
            reason="",
            actor="dana-strand",
        )
        assert isinstance(result, ToolError)
        assert result.error_type == "VALIDATION_FAILED"
        mock_coll.assert_not_called()

    @patch("app.tools.maintenance_tools.collection_ref")
    def test_short_reason_returns_tool_error(self, mock_coll):
        from app.tools.maintenance_tools import dismiss_suggestion
        from app.models import ToolError

        result = dismiss_suggestion(
            firm_id="strand-okafor",
            client_id="mercer-industries",
            suggestion_id="ms-1",
            reason="abc",
            actor="dana-strand",
        )
        assert isinstance(result, ToolError)
        assert result.error_type == "VALIDATION_FAILED"

    @patch("app.tools.maintenance_tools.collection_ref")
    def test_whitespace_only_reason_returns_tool_error(self, mock_coll):
        from app.tools.maintenance_tools import dismiss_suggestion
        from app.models import ToolError

        result = dismiss_suggestion(
            firm_id="strand-okafor",
            client_id="mercer-industries",
            suggestion_id="ms-1",
            reason="    ",
            actor="dana-strand",
        )
        assert isinstance(result, ToolError)
        assert result.error_type == "VALIDATION_FAILED"


# ---------------------------------------------------------------------------
# run_client_review — idempotency (G10-01)
# ---------------------------------------------------------------------------

class TestRunClientReviewIdempotency:
    @patch("app.tools.maintenance_tools.get_maintenance_state")
    @patch("app.tools.maintenance_tools.collection_ref")
    def test_second_call_same_sweep_id_is_noop(self, mock_coll, mock_get_state):
        """Second call with same sweep_id skips all writes and returns current state."""
        from app.tools.maintenance_tools import run_client_review
        from app.models import ClientMaintenanceState, MaintenanceCadence

        # Idempotency doc already exists
        idem_doc = MagicMock()
        idem_doc.exists = True

        mock_coll.return_value.document.return_value.get.return_value = idem_doc

        stub_state = MagicMock(spec=ClientMaintenanceState)
        mock_get_state.return_value = stub_state

        result = run_client_review("strand-okafor", "mercer-industries", "sweep-already-seen")

        # Should have returned immediately via get_maintenance_state
        mock_get_state.assert_called_once_with("strand-okafor", "mercer-industries")
        assert result is stub_state

    @patch("app.tools.maintenance_tools.log_audit_event", return_value="ae-test-001")
    @patch("app.tools.maintenance_tools.get_maintenance_state")
    @patch("app.tools.maintenance_tools.collection_ref")
    def test_first_call_writes_audit_and_updates_client(
        self, mock_coll, mock_get_state, mock_log
    ):
        """First call with new sweep_id logs the sweep and updates last_reviewed_at."""
        from app.tools.maintenance_tools import run_client_review

        # Idempotency doc does NOT exist (new sweep)
        idem_doc = MagicMock()
        idem_doc.exists = False

        # Client doc exists with reviews_today = 3
        client_doc = MagicMock()
        client_doc.exists = True
        client_doc.to_dict.return_value = {"reviews_today": 3}

        # Route different collection_ref calls by returning different mocks
        idem_ref = MagicMock()
        idem_ref.get.return_value = idem_doc

        client_ref = MagicMock()
        client_ref.get.return_value = client_doc

        call_count = {"n": 0}
        def side_effect(firm_id, collection):
            call_count["n"] += 1
            if collection == "idempotency_keys":
                return MagicMock(document=MagicMock(return_value=idem_ref))
            if collection == "clients":
                return MagicMock(document=MagicMock(return_value=client_ref))
            return MagicMock()

        mock_coll.side_effect = side_effect
        mock_get_state.return_value = MagicMock()

        run_client_review("strand-okafor", "mercer-industries", "sweep-new-001")

        # Audit event should have been logged
        mock_log.assert_called_once()
        log_kwargs = mock_log.call_args.kwargs
        assert log_kwargs["event_type"] == "client.reviewed"
        assert log_kwargs["client_id"] == "mercer-industries"

        # Client doc should have been updated (reviews_today incremented)
        client_ref.update.assert_called_once()
        update_data = client_ref.update.call_args[0][0]
        assert update_data["reviews_today"] == 4


# ---------------------------------------------------------------------------
# detect_engagement_letter (G10-04 / CM-P10-03)
# ---------------------------------------------------------------------------

class TestDetectEngagementLetter:
    def test_true_on_engagement_keywords_in_subject(self):
        from app.tools.maintenance_tools import detect_engagement_letter

        msg = {"subject": "Engagement Letter — Cordova Partners LLC", "body": ""}
        assert detect_engagement_letter(msg) is True

    def test_true_on_retainer_agreement_in_body(self):
        from app.tools.maintenance_tools import detect_engagement_letter

        msg = {
            "subject": "Re: Representation",
            "body": "Please find attached the retainer agreement for your review and signature.",
        }
        assert detect_engagement_letter(msg) is True

    def test_true_on_pdf_attachment_with_engagement_in_name(self):
        from app.tools.maintenance_tools import detect_engagement_letter

        msg = {
            "subject": "Docs attached",
            "body": "See attached.",
            "attachments": [{"filename": "engagement-letter-cordova-2026.pdf"}],
        }
        assert detect_engagement_letter(msg) is True

    def test_false_on_ordinary_email(self):
        from app.tools.maintenance_tools import detect_engagement_letter

        msg = {
            "subject": "Status update on the Mercer matter",
            "body": "Following up on last week's conference call. Let me know if you have questions.",
        }
        assert detect_engagement_letter(msg) is False

    def test_false_on_empty_message(self):
        from app.tools.maintenance_tools import detect_engagement_letter

        assert detect_engagement_letter({}) is False
