"""
Client tool layer tests — create_client, create_matter, get_clients.
classify_update and dismiss_suggestion are in test_maintenance_tools.py.
"""

from unittest.mock import MagicMock, patch, call
import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_req(**overrides):
    from app.models import ClientCreateRequest, MatterCreateRequest
    matter = MatterCreateRequest(
        matter_name="Test Matter",
        matter_type="litigation",
        opposing_counsel=None,
        court=None,
        case_number=None,
        expected_resolution=None,
    )
    defaults = dict(
        firm_id="strand-okafor",
        client_name="Test Client LLC",
        client_type="entity",
        primary_contact_name="Jane Test",
        primary_contact_email="jane@test.com",
        primary_contact_phone="",
        billing_rate=300.0,
        billing_type="hourly",
        billing_cycle="monthly",
        payment_terms="net_30",
        engagement_type="litigation",
        date_engaged="2026-06-01",
        responsible_attorney_id="dana-strand",
        conflict_check_names=[],
        silence_threshold_days=14,
        budget_cap=None,
        notes=None,
        first_matter=matter,
    )
    defaults.update(overrides)
    return ClientCreateRequest(**defaults)


# ---------------------------------------------------------------------------
# create_client — idempotency (CM-P8-01)
# ---------------------------------------------------------------------------

class TestCreateClientIdempotent:
    @patch("app.tools.client_tools.check_idempotency", return_value="test-client-llc")
    def test_second_call_returns_existing_entity_id(self, mock_idem):
        from app.tools.client_tools import create_client
        from app.models import ToolResult

        req = _make_req()
        result = create_client(req, "idem-key-001")

        assert isinstance(result, ToolResult)
        assert result.entity_id == "test-client-llc"
        assert result.data == {"idempotency_hit": True}

    @patch("app.tools.client_tools.register_idempotency")
    @patch("app.tools.client_tools.log_audit_event", return_value="ae-001")
    @patch("app.tools.client_tools.collection_ref")
    @patch("app.tools.client_tools.check_idempotency", return_value=None)
    def test_first_call_writes_and_registers(self, mock_idem, mock_coll, mock_log, mock_reg):
        from app.tools.client_tools import create_client
        from app.models import ToolResult

        req = _make_req(client_name="Zephyr Corp")
        result = create_client(req, "idem-key-new")

        assert isinstance(result, ToolResult)
        assert result.entity_id == "zephyr-corp"
        assert result.entity_type == "client"
        mock_log.assert_called_once()
        mock_reg.assert_called_once_with("strand-okafor", "idem-key-new", "zephyr-corp")


# ---------------------------------------------------------------------------
# create_matter — links to client (CM-P8-01)
# ---------------------------------------------------------------------------

class TestCreateMatterLinksClient:
    @patch("app.tools.client_tools.register_idempotency")
    @patch("app.tools.client_tools.log_audit_event", return_value="ae-m-001")
    @patch("app.tools.client_tools.collection_ref")
    @patch("app.tools.client_tools.check_idempotency", return_value=None)
    def test_matter_doc_includes_client_id(self, mock_idem, mock_coll, mock_log, mock_reg):
        from app.tools.client_tools import create_matter
        from app.models import MatterCreateRequest, ToolResult

        matter_req = MatterCreateRequest(
            matter_name="Widget Dispute",
            matter_type="litigation",
            opposing_counsel=None,
            court=None,
            case_number=None,
            expected_resolution=None,
        )
        result = create_matter(
            firm_id="strand-okafor",
            client_id="zephyr-corp",
            req=matter_req,
            responsible_attorney_id="dana-strand",
            idempotency_key="idem-matter-001",
        )

        assert isinstance(result, ToolResult)
        assert result.entity_type == "matter"
        # Verify the doc written to Firestore contains client_id
        set_args = mock_coll.return_value.document.return_value.create.call_args[0][0]
        assert set_args["client_id"] == "zephyr-corp"

    @patch("app.tools.client_tools.check_idempotency", return_value="zephyr-corp-existing")
    def test_idempotent_call_returns_cached(self, mock_idem):
        from app.tools.client_tools import create_matter
        from app.models import MatterCreateRequest, ToolResult

        matter_req = MatterCreateRequest(
            matter_name="Widget Dispute",
            matter_type="litigation",
        )
        result = create_matter(
            firm_id="strand-okafor",
            client_id="zephyr-corp",
            req=matter_req,
            responsible_attorney_id="dana-strand",
            idempotency_key="idem-seen",
        )
        assert isinstance(result, ToolResult)
        assert result.data == {"idempotency_hit": True}


# ---------------------------------------------------------------------------
# get_clients — sorted list (CM-P8-01)
# ---------------------------------------------------------------------------

class TestGetClientsReturnsSortedList:
    @patch("app.tools.client_tools.collection_ref")
    def test_sorted_pending_desc_then_budget_desc(self, mock_coll):
        from app.tools.client_tools import get_clients

        def _doc(data):
            d = MagicMock()
            d.to_dict.return_value = data
            d.id = data["id"]
            return d

        clients = [
            {"id": "low", "firm_id": "strand-okafor", "name": "Low", "client_type": "entity",
             "client_status": "active", "pending_item_count": 0, "budget_billed": 10.0,
             "budget_cap": 100.0, "last_client_contact": None, "last_reviewed_at": None,
             "held_suggestion_count": 0, "maintenance_cadence": "hourly",
             "client_silence_threshold_days": 14, "arrangement": "hourly"},
            {"id": "high", "firm_id": "strand-okafor", "name": "High", "client_type": "entity",
             "client_status": "active", "pending_item_count": 3, "budget_billed": 80.0,
             "budget_cap": 100.0, "last_client_contact": None, "last_reviewed_at": None,
             "held_suggestion_count": 0, "maintenance_cadence": "hourly",
             "client_silence_threshold_days": 14, "arrangement": "hourly"},
            {"id": "mid", "firm_id": "strand-okafor", "name": "Mid", "client_type": "entity",
             "client_status": "active", "pending_item_count": 1, "budget_billed": 50.0,
             "budget_cap": 100.0, "last_client_contact": None, "last_reviewed_at": None,
             "held_suggestion_count": 0, "maintenance_cadence": "hourly",
             "client_silence_threshold_days": 14, "arrangement": "hourly"},
        ]
        matters = []
        suggestions = []

        call_count = {"n": 0}
        def _coll_side(firm_id, collection):
            m = MagicMock()
            if collection == "clients":
                m.stream.return_value = [_doc(c) for c in clients]
            elif collection == "matters":
                m.stream.return_value = []
            elif collection == "client_suggestions":
                m.stream.return_value = []
            else:
                m.stream.return_value = []
            return m

        mock_coll.side_effect = _coll_side

        result = get_clients("strand-okafor")

        assert len(result) == 3
        assert result[0].client_id == "high"
        assert result[1].client_id == "mid"
        assert result[2].client_id == "low"
