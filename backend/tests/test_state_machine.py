"""
State machine tests — pure logic, no Firestore required.
All valid and invalid transitions tested.
"""

import pytest
from unittest.mock import MagicMock, patch


# Pure function tests — import directly, no mocking needed
from app.tools.billing import VALID_TRANSITIONS, is_valid_transition


class TestValidTransitions:
    def test_captured_to_pending(self):
        assert is_valid_transition("CAPTURED", "PENDING") is True

    def test_pending_to_approved(self):
        assert is_valid_transition("PENDING", "APPROVED") is True

    def test_pending_to_written_off(self):
        assert is_valid_transition("PENDING", "WRITTEN_OFF") is True

    def test_approved_to_billed(self):
        assert is_valid_transition("APPROVED", "BILLED") is True

    def test_approved_to_written_off(self):
        assert is_valid_transition("APPROVED", "WRITTEN_OFF") is True

    def test_billed_to_closed(self):
        assert is_valid_transition("BILLED", "CLOSED") is True


class TestInvalidTransitions:
    def test_captured_to_approved(self):
        assert is_valid_transition("CAPTURED", "APPROVED") is False

    def test_captured_to_billed(self):
        assert is_valid_transition("CAPTURED", "BILLED") is False

    def test_pending_to_billed(self):
        assert is_valid_transition("PENDING", "BILLED") is False

    def test_pending_to_closed(self):
        assert is_valid_transition("PENDING", "CLOSED") is False

    def test_approved_to_pending(self):
        assert is_valid_transition("APPROVED", "PENDING") is False

    def test_approved_to_captured(self):
        assert is_valid_transition("APPROVED", "CAPTURED") is False

    def test_billed_to_approved(self):
        assert is_valid_transition("BILLED", "APPROVED") is False


class TestTerminalStates:
    def test_written_off_is_terminal(self):
        assert VALID_TRANSITIONS["WRITTEN_OFF"] == []

    def test_closed_is_terminal(self):
        assert VALID_TRANSITIONS["CLOSED"] == []

    def test_written_off_to_pending_invalid(self):
        assert is_valid_transition("WRITTEN_OFF", "PENDING") is False

    def test_written_off_to_approved_invalid(self):
        assert is_valid_transition("WRITTEN_OFF", "APPROVED") is False

    def test_closed_to_billed_invalid(self):
        assert is_valid_transition("CLOSED", "BILLED") is False

    def test_unknown_status_invalid(self):
        assert is_valid_transition("NONEXISTENT", "PENDING") is False


class TestAdvanceEntryStatusIntegration:
    """Integration-style tests with mocked Firestore."""

    def _mock_entry(self, status: str, version: int = 1) -> dict:
        return {"id": "te-test", "firm_id": "strand-okafor", "status": status, "version": version}

    @patch("app.tools.billing.check_optimistic_lock")
    @patch("app.tools.billing.collection_ref")
    @patch("app.tools.billing.log_audit_event", return_value="ae-test")
    @patch("app.tools.billing.check_idempotency", return_value=None)
    @patch("app.tools.billing.register_idempotency")
    def test_advance_pending_to_approved(self, mock_reg, mock_idem, mock_audit, mock_coll, mock_lock):
        mock_lock.return_value = (True, self._mock_entry("PENDING", 1))
        mock_coll.return_value.document.return_value.update = MagicMock()

        from app.tools.billing import advance_entry_status
        from app.models import ToolResult
        result = advance_entry_status("strand-okafor", "te-test", "APPROVED", "dana-strand", "idem-1", 1)

        assert isinstance(result, ToolResult)
        assert result.success is True

    @patch("app.tools.billing.check_optimistic_lock")
    @patch("app.tools.billing.check_idempotency", return_value=None)
    def test_invalid_transition_returns_tool_error(self, mock_idem, mock_lock):
        mock_lock.return_value = (True, self._mock_entry("BILLED", 1))

        from app.tools.billing import advance_entry_status
        from app.models import ToolError
        result = advance_entry_status("strand-okafor", "te-test", "PENDING", "dana-strand", "idem-2", 1)

        assert isinstance(result, ToolError)
        assert result.error_type == "INVALID_TRANSITION"

    @patch("app.tools.billing.check_optimistic_lock")
    @patch("app.tools.billing.check_idempotency", return_value=None)
    def test_stale_version_returns_tool_error(self, mock_idem, mock_lock):
        mock_lock.return_value = (False, self._mock_entry("PENDING", 3))  # version mismatch

        from app.tools.billing import advance_entry_status
        from app.models import ToolError
        result = advance_entry_status("strand-okafor", "te-test", "APPROVED", "dana-strand", "idem-3", 1)

        assert isinstance(result, ToolError)
        assert result.error_type == "STALE_STATE"

    @patch("app.tools.billing.check_idempotency", return_value="ae-already-done")
    def test_idempotent_call_returns_cached_result(self, mock_idem):
        from app.tools.billing import advance_entry_status
        from app.models import ToolResult
        result = advance_entry_status("strand-okafor", "te-test", "APPROVED", "dana-strand", "idem-dup", 1)

        assert isinstance(result, ToolResult)
        assert result.audit_event_id == "ae-already-done"
