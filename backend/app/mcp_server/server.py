"""
FastMCP SSE server — exposes the Litt tool layer as MCP tools.
Mounted at /mcp in main.py. ADK coordinator connects via MCPToolset.

All tools accept firm_id as a parameter to enforce multi-tenant isolation.
All tools return dicts (JSON-serializable) — never raw Pydantic models.
"""

from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastmcp import FastMCP

from app.models import ToolError, ToolResult
from app.scrubber.prebill import run_prebill_scrubber
from app.tools.alerts import dismiss_alert, log_anomaly, log_escalation
from app.tools.billing import (
    advance_entry_status,
    compute_budget_utilization,
    generate_invoice,
    write_down_entry,
    write_off_entry,
    write_time_entry,
)
from app.tools.comms import (
    approve_client_comm_draft,
    log_client_comm_sent,
    queue_client_comm_for_delivery,
)
from app.tools.deadlines import log_deadline_event, supersede_deadline, verify_deadline

mcp = FastMCP("Litt Tool Server")


def _result(r: Any) -> Dict[str, Any]:
    """Serialize ToolResult or ToolError to dict for MCP response."""
    if isinstance(r, (ToolResult, ToolError)):
        return r.model_dump()
    if hasattr(r, "model_dump"):
        d = r.model_dump()
        # Convert Decimal to float for JSON serialization
        return _clean(d)
    return r


def _clean(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, date):
        return obj.isoformat()
    return obj


# ---------------------------------------------------------------------------
# Billing tools
# ---------------------------------------------------------------------------

@mcp.tool()
def tool_advance_time_entry_status(
    firm_id: str,
    entry_id: str,
    new_status: str,
    actor: str,
    idempotency_key: str,
    expected_version: int,
) -> Dict[str, Any]:
    """Advance a time entry through its status state machine."""
    return _result(advance_entry_status(firm_id, entry_id, new_status, actor, idempotency_key, expected_version))


@mcp.tool()
def tool_write_down_entry(
    firm_id: str,
    entry_id: str,
    new_hours: float,
    reason: str,
    attorney_id: str,
    idempotency_key: str,
    expected_version: int,
) -> Dict[str, Any]:
    """Reduce billed hours on a time entry. reason required. Preserves original in write_down_record."""
    return _result(write_down_entry(firm_id, entry_id, Decimal(str(new_hours)), reason, attorney_id, idempotency_key, expected_version))


@mcp.tool()
def tool_write_off_entry(
    firm_id: str,
    entry_id: str,
    reason: str,
    attorney_id: str,
    idempotency_key: str,
    expected_version: int,
) -> Dict[str, Any]:
    """Write off a time entry entirely (terminal state). reason required."""
    return _result(write_off_entry(firm_id, entry_id, reason, attorney_id, idempotency_key, expected_version))


@mcp.tool()
def tool_compute_budget_utilization(
    firm_id: str,
    client_id: str,
) -> Dict[str, Any]:
    """Compute current budget utilization for a client. Read-only."""
    return _result(compute_budget_utilization(firm_id, client_id))


@mcp.tool()
def tool_generate_invoice(
    firm_id: str,
    client_id: str,
    period_start: str,
    period_end: str,
    actor: str,
    idempotency_key: str,
) -> Dict[str, Any]:
    """Generate a draft invoice from all APPROVED entries in the period."""
    return _result(generate_invoice(
        firm_id, client_id,
        date.fromisoformat(period_start),
        date.fromisoformat(period_end),
        actor, idempotency_key,
    ))


# ---------------------------------------------------------------------------
# Deadline tools
# ---------------------------------------------------------------------------

@mcp.tool()
def tool_log_deadline_event(
    firm_id: str,
    deadline_id: str,
    event_type: str,
    actor: str,
    idempotency_key: str,
    escalation_level: Optional[str] = None,
    attorney_id: Optional[str] = None,
    response: Optional[str] = None,
    dismissal_reason: Optional[str] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Append a deadline event (CREATE-only — never updates)."""
    return _result(log_deadline_event(
        firm_id, deadline_id, event_type, actor, idempotency_key,
        escalation_level, attorney_id, response, dismissal_reason, notes,
    ))


@mcp.tool()
def tool_verify_deadline(
    firm_id: str,
    deadline_id: str,
    attorney_id: str,
    idempotency_key: str,
    expected_version: int,
) -> Dict[str, Any]:
    """Mark a deadline as attorney_verified. Required before escalation cadence fires."""
    return _result(verify_deadline(firm_id, deadline_id, attorney_id, idempotency_key, expected_version))


@mcp.tool()
def tool_supersede_deadline(
    firm_id: str,
    old_deadline_id: str,
    new_deadline_id: str,
    actor: str,
    idempotency_key: str,
    expected_version: int,
) -> Dict[str, Any]:
    """Mark old deadline as SUPERSEDED by a replacement deadline."""
    return _result(supersede_deadline(firm_id, old_deadline_id, new_deadline_id, actor, idempotency_key, expected_version))


# ---------------------------------------------------------------------------
# Comms tools
# ---------------------------------------------------------------------------

@mcp.tool()
def tool_approve_client_comm_draft(
    firm_id: str,
    comm_id: str,
    attorney_id: str,
    idempotency_key: str,
    expected_version: int,
) -> Dict[str, Any]:
    """Approve a generated communication draft. Does NOT update last_client_contact."""
    return _result(approve_client_comm_draft(firm_id, comm_id, attorney_id, idempotency_key, expected_version))


@mcp.tool()
def tool_queue_client_comm_for_delivery(
    firm_id: str,
    comm_id: str,
    attorney_id: str,
    idempotency_key: str,
    expected_version: int,
) -> Dict[str, Any]:
    """Queue an approved communication for delivery. Does NOT update last_client_contact."""
    return _result(queue_client_comm_for_delivery(firm_id, comm_id, attorney_id, idempotency_key, expected_version))


@mcp.tool()
def tool_log_client_comm_sent(
    firm_id: str,
    comm_id: str,
    actor: str,
    idempotency_key: str,
    expected_version: int,
) -> Dict[str, Any]:
    """Confirm communication sent. ONLY this function updates last_client_contact."""
    return _result(log_client_comm_sent(firm_id, comm_id, actor, idempotency_key, expected_version))


# ---------------------------------------------------------------------------
# Alert and escalation tools
# ---------------------------------------------------------------------------

@mcp.tool()
def tool_dismiss_alert(
    firm_id: str,
    escalation_id: str,
    actor: str,
    reason: str,
    idempotency_key: str,
) -> Dict[str, Any]:
    """Dismiss an escalation. reason required — no silent dismissals."""
    return _result(dismiss_alert(firm_id, escalation_id, actor, reason, idempotency_key))


@mcp.tool()
def tool_log_escalation(
    firm_id: str,
    escalation_type: str,
    entity_id: str,
    routed_to: str,
    actor: str,
    idempotency_key: str,
    what_is_happening: str,
    why_it_matters: str,
    what_litt_has_done: str,
    what_attorney_must_decide: str,
    risk_level: str = "ROUTINE",
    matter_id: Optional[str] = None,
    priority: int = 1,
    decision_deadline: Optional[str] = None,
) -> Dict[str, Any]:
    """Create an escalation record with a structured brief."""
    return _result(log_escalation(
        firm_id, escalation_type, entity_id, routed_to, actor, idempotency_key,
        what_is_happening, why_it_matters, what_litt_has_done, what_attorney_must_decide,
        risk_level, matter_id, priority, decision_deadline,
    ))


@mcp.tool()
def tool_log_anomaly(
    firm_id: str,
    entry_id: str,
    anomaly_type: str,
    description: str,
    routed_to: str,
    actor: str,
    idempotency_key: str,
    matter_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Log a billing anomaly as an ANOMALY escalation."""
    return _result(log_anomaly(firm_id, entry_id, anomaly_type, description, routed_to, actor, idempotency_key, matter_id))


# ---------------------------------------------------------------------------
# Scrubber tool
# ---------------------------------------------------------------------------

@mcp.tool()
def tool_run_prebill_scrubber(
    firm_id: str,
    entry_ids: List[str],
) -> List[Dict[str, Any]]:
    """Run all 8 prebill checks against a list of time entry IDs. Returns flags per entry."""
    results = run_prebill_scrubber(firm_id, entry_ids)
    return [
        {
            "entry_id": r.entry_id,
            "has_block": r.has_block,
            "has_warn": r.has_warn,
            "clean": r.clean,
            "flags": [
                {
                    "check_name": f.check_name,
                    "severity": f.severity,
                    "message": f.message,
                    "matched_text": f.matched_text,
                }
                for f in r.flags
            ],
        }
        for r in results
    ]
