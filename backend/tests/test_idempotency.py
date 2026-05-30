"""
Idempotency tests — verifies that repeated calls with the same key
return the cached entity_id and do not duplicate writes.
"""

import pytest
from unittest.mock import MagicMock, patch, call


class TestCheckIdempotency:
    @patch("app.tools.validation.collection_ref")
    def test_new_key_returns_none(self, mock_coll):
        doc_mock = MagicMock()
        doc_mock.exists = False
        mock_coll.return_value.document.return_value.get.return_value = doc_mock

        from app.tools.validation import check_idempotency
        result = check_idempotency("strand-okafor", "new-key-abc")
        assert result is None

    @patch("app.tools.validation.collection_ref")
    def test_existing_key_returns_entity_id(self, mock_coll):
        doc_mock = MagicMock()
        doc_mock.exists = True
        doc_mock.to_dict.return_value = {"entity_id": "te-existing-001"}
        mock_coll.return_value.document.return_value.get.return_value = doc_mock

        from app.tools.validation import check_idempotency
        result = check_idempotency("strand-okafor", "seen-key-xyz")
        assert result == "te-existing-001"

    @patch("app.tools.validation.collection_ref")
    def test_correct_collection_and_key_used(self, mock_coll):
        doc_mock = MagicMock()
        doc_mock.exists = False
        mock_coll.return_value.document.return_value.get.return_value = doc_mock

        from app.tools.validation import check_idempotency
        check_idempotency("strand-okafor", "test-key")

        mock_coll.assert_called_once_with("strand-okafor", "idempotency_keys")
        mock_coll.return_value.document.assert_called_once_with("test-key")


class TestRegisterIdempotency:
    @patch("app.tools.validation.collection_ref")
    def test_register_calls_set(self, mock_coll):
        from app.tools.validation import register_idempotency
        register_idempotency("strand-okafor", "new-key", "te-001")

        mock_coll.assert_called_once_with("strand-okafor", "idempotency_keys")
        mock_coll.return_value.document.assert_called_once_with("new-key")
        mock_coll.return_value.document.return_value.set.assert_called_once()

        call_kwargs = mock_coll.return_value.document.return_value.set.call_args[0][0]
        assert call_kwargs["entity_id"] == "te-001"


class TestCheckOptimisticLock:
    @patch("app.tools.validation.collection_ref")
    def test_matching_version_returns_true(self, mock_coll):
        doc_mock = MagicMock()
        doc_mock.exists = True
        doc_mock.to_dict.return_value = {"id": "te-001", "version": 2, "status": "PENDING"}
        mock_coll.return_value.document.return_value.get.return_value = doc_mock

        from app.tools.validation import check_optimistic_lock
        ok, data = check_optimistic_lock("strand-okafor", "time_entries", "te-001", 2)
        assert ok is True
        assert data["version"] == 2

    @patch("app.tools.validation.collection_ref")
    def test_mismatched_version_returns_false(self, mock_coll):
        doc_mock = MagicMock()
        doc_mock.exists = True
        doc_mock.to_dict.return_value = {"id": "te-001", "version": 3, "status": "PENDING"}
        mock_coll.return_value.document.return_value.get.return_value = doc_mock

        from app.tools.validation import check_optimistic_lock
        ok, data = check_optimistic_lock("strand-okafor", "time_entries", "te-001", 1)
        assert ok is False
        assert data["version"] == 3

    @patch("app.tools.validation.collection_ref")
    def test_missing_doc_returns_false_none(self, mock_coll):
        doc_mock = MagicMock()
        doc_mock.exists = False
        mock_coll.return_value.document.return_value.get.return_value = doc_mock

        from app.tools.validation import check_optimistic_lock
        ok, data = check_optimistic_lock("strand-okafor", "time_entries", "te-missing", 1)
        assert ok is False
        assert data is None


class TestEndToEndIdempotency:
    """Verify write_off_entry short-circuits on duplicate idempotency key."""

    @patch("app.tools.billing.check_idempotency", return_value="ae-already-exists")
    def test_second_write_off_returns_cached_result(self, mock_idem):
        from app.tools.billing import write_off_entry
        from app.models import ToolResult

        result = write_off_entry(
            firm_id="strand-okafor",
            entry_id="te-001",
            reason="Client dispute",
            attorney_id="dana-strand",
            idempotency_key="idem-dup-key",
            expected_version=1,
        )

        assert isinstance(result, ToolResult)
        assert result.success is True
        # No Firestore read attempted — returned immediately
        mock_idem.assert_called_once_with("strand-okafor", "idem-dup-key")
