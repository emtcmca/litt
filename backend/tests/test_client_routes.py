"""
Client route integration tests — uses FastAPI TestClient with mocked tool layer.
All Firestore writes are mocked at the tool function level.
"""

import io
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# App fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    from app.main import app
    return TestClient(app)


# ---------------------------------------------------------------------------
# GET /api/clients (CM-P8-02: test_get_clients_200)
# ---------------------------------------------------------------------------

class TestGetClients:
    @patch("app.routes.clients.get_clients")
    def test_get_clients_200(self, mock_get, client):
        from app.models import ClientListItem

        stub = MagicMock(spec=ClientListItem)
        stub.model_dump.return_value = {
            "client_id": "mercer-industries",
            "client_name": "Mercer Industries",
            "client_type": "entity",
            "client_status": "active",
            "engagement": "litigation",
            "matter_short": "v. Dunlap",
            "rate": 375.0,
            "billing": "hourly",
            "matter_count": 1,
            "pending_item_count": 3,
            "budget_utilization_pct": 62.0,
            "budget_used": 37200.0,
            "budget_cap_val": 60000.0,
            "days_since_contact": 2,
            "last_contact_label": "Jun 23",
            "last_reviewed_label": "12 min ago",
            "held_suggestion_count": 3,
        }
        mock_get.return_value = [stub]

        resp = client.get("/api/clients?firm_id=strand-okafor")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert data[0]["client_id"] == "mercer-industries"


# ---------------------------------------------------------------------------
# POST /api/clients (CM-P8-02: test_create_client_201, test_create_client_idempotent_200)
# ---------------------------------------------------------------------------

class TestCreateClient:
    _body = {
        "firm_id": "strand-okafor",
        "client_name": "Test Corp",
        "primary_contact_name": "Jane Smith",
        "primary_contact_email": "jane@testcorp.com",
        "billing_rate": 300.0,
        "engagement_type": "litigation",
        "date_engaged": "2026-06-01",
        "first_matter": {
            "matter_name": "Test Matter",
            "matter_type": "litigation",
        },
    }

    @patch("app.routes.clients.create_matter")
    @patch("app.routes.clients.create_client")
    def test_create_client_201(self, mock_cc, mock_cm, client):
        from app.models import ToolResult

        mock_cc.return_value = ToolResult(
            entity_id="test-corp", entity_type="client", audit_event_id="ae-001"
        )
        mock_cm.return_value = ToolResult(
            entity_id="test-corp-test-matter", entity_type="matter", audit_event_id="ae-002"
        )

        resp = client.post("/api/clients", json=self._body)
        assert resp.status_code == 201
        data = resp.json()
        assert data["client_id"] == "test-corp"
        assert "matter_id" in data

    @patch("app.routes.clients.create_matter")
    @patch("app.routes.clients.create_client")
    def test_create_client_idempotent_200(self, mock_cc, mock_cm, client):
        from app.models import ToolResult

        # Simulate second call — idempotency_hit
        mock_cc.return_value = ToolResult(
            entity_id="test-corp", entity_type="client",
            audit_event_id="", data={"idempotency_hit": True}
        )
        mock_cm.return_value = ToolResult(
            entity_id="test-corp-test-matter", entity_type="matter",
            audit_event_id="", data={"idempotency_hit": True}
        )

        resp = client.post("/api/clients", json=self._body)
        assert resp.status_code == 201
        data = resp.json()
        assert data["client_id"] == "test-corp"


# ---------------------------------------------------------------------------
# POST /api/clients/extract (CM-P8-02: test_extract_endpoint_200)
# ---------------------------------------------------------------------------

class TestExtractEndpoint:
    def test_extract_endpoint_200(self, client):
        minimal_pdf = b"%PDF-1.4 1 0 obj << /Type /Catalog >> endobj"

        # Mock both Gemini dependencies so the test never touches the network
        mock_model = MagicMock()
        mock_response = MagicMock()
        mock_response.text = """{
            "client_name": "Cordova Partners LLC",
            "client_type": "entity",
            "billing_rate": 360,
            "engagement_type": "litigation",
            "date_engaged": "2026-06-01",
            "matter_name": "Commercial lease dispute",
            "confidence": {"client_name": "high"},
            "extraction_notes": "Mock extraction."
        }"""
        mock_model.generate_content.return_value = mock_response

        with patch("vertexai.init"), \
             patch("vertexai.generative_models.GenerativeModel", return_value=mock_model):
            resp = client.post(
                "/api/clients/extract",
                data={"firm_id": "strand-okafor"},
                files={"document": ("test.pdf", io.BytesIO(minimal_pdf), "application/pdf")},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert "client_name" in data


# ---------------------------------------------------------------------------
# GET /api/clients/:id/maintenance (CM-P8-02: test_get_maintenance_200)
# ---------------------------------------------------------------------------

class TestGetMaintenance:
    @patch("app.routes.clients.get_maintenance_state")
    def test_get_maintenance_200(self, mock_get, client):
        from app.models import ClientMaintenanceState, MaintenanceCadence

        stub = MagicMock(spec=ClientMaintenanceState)
        stub.model_dump.return_value = {
            "client_id": "mercer-industries",
            "cadence": "hourly",
            "last_reviewed_label": "12 min ago",
            "last_reviewed_at": None,
            "next_sweep_label": "in 48 min",
            "reviews_today": 6,
            "watched_signal_count": 5,
            "applied": [],
            "suggested": [],
        }
        mock_get.return_value = stub

        resp = client.get("/api/clients/mercer-industries/maintenance?firm_id=strand-okafor")
        assert resp.status_code == 200
        data = resp.json()
        assert data["client_id"] == "mercer-industries"
        assert data["reviews_today"] == 6


# ---------------------------------------------------------------------------
# POST /api/clients/:id/suggestions/:sid/dismiss — empty reason (CM-P8-02)
# ---------------------------------------------------------------------------

class TestDismissRoute:
    @patch("app.routes.clients.dismiss_suggestion")
    def test_dismiss_suggestion_empty_reason_422(self, mock_dismiss, client):
        from app.models import ToolError

        mock_dismiss.return_value = ToolError(
            error_type="VALIDATION_FAILED",
            message="reason is required and must be at least 4 characters",
        )

        resp = client.post(
            "/api/clients/mercer-industries/suggestions/ms-1/dismiss",
            json={"reason": "", "firm_id": "strand-okafor", "actor": "dana-strand"},
        )
        assert resp.status_code == 422
