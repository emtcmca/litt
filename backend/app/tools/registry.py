"""
Tool registry — describes every tool function exposed in the Litt platform.
Used by GET /api/tools to give the Console UI a machine-readable tool catalog.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List


class ToolKind(str, Enum):
    READ = "read"
    WRITE = "write"
    COMPUTE = "compute"
    GEMINI = "gemini"


@dataclass
class ToolSpec:
    name: str
    agent: str
    kind: ToolKind
    description: str
    write_collection: str = ""
    audit_tier: str = ""
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "agent": self.agent,
            "kind": self.kind.value,
            "description": self.description,
            "write_collection": self.write_collection,
            "audit_tier": self.audit_tier,
            "tags": self.tags,
        }


TOOL_REGISTRY: dict[str, ToolSpec] = {
    # --- AnomalyAgent ---
    "log_anomaly": ToolSpec(
        name="log_anomaly",
        agent="anomaly_agent",
        kind=ToolKind.WRITE,
        description="Create ANOMALY escalation record for a billing entry. Calls log_audit_event.",
        write_collection="escalations",
        audit_tier="operational",
        tags=["anomaly", "escalation"],
    ),
    "log_escalation": ToolSpec(
        name="log_escalation",
        agent="coordinator",
        kind=ToolKind.WRITE,
        description="Create any type of escalation record (DEADLINE, BILLING, COMMS, ANOMALY).",
        write_collection="escalations",
        audit_tier="operational",
        tags=["escalation"],
    ),
    # --- BillingAgent ---
    "advance_entry_status": ToolSpec(
        name="advance_entry_status",
        agent="billing_agent",
        kind=ToolKind.WRITE,
        description="Advance a time entry through VALID_TRANSITIONS state machine.",
        write_collection="time_entries",
        audit_tier="operational",
        tags=["billing", "state_machine"],
    ),
    "write_time_entry": ToolSpec(
        name="write_time_entry",
        agent="billing_agent",
        kind=ToolKind.WRITE,
        description="Create a new PENDING time entry with 6-min billing rounding.",
        write_collection="time_entries",
        audit_tier="operational",
        tags=["billing", "capture"],
    ),
    "write_down_entry": ToolSpec(
        name="write_down_entry",
        agent="billing_agent",
        kind=ToolKind.WRITE,
        description="Partially reduce a time entry's hours/amount. Reason required.",
        write_collection="time_entries",
        audit_tier="legal_defensibility",
        tags=["billing", "adjustment"],
    ),
    "write_off_entry": ToolSpec(
        name="write_off_entry",
        agent="billing_agent",
        kind=ToolKind.WRITE,
        description="Move entry to terminal WRITTEN_OFF state. Reason required.",
        write_collection="time_entries",
        audit_tier="legal_defensibility",
        tags=["billing", "adjustment"],
    ),
    "update_entry_narrative": ToolSpec(
        name="update_entry_narrative",
        agent="billing_agent",
        kind=ToolKind.WRITE,
        description="Update narrative on PENDING or APPROVED entry.",
        write_collection="time_entries",
        audit_tier="operational",
        tags=["billing", "narrative"],
    ),
    "compute_budget_utilization": ToolSpec(
        name="compute_budget_utilization",
        agent="billing_agent",
        kind=ToolKind.COMPUTE,
        description="Read-only budget utilization calculation. Returns BudgetUtilization.",
        tags=["billing", "budget"],
    ),
    "check_invoice_readiness": ToolSpec(
        name="check_invoice_readiness",
        agent="billing_agent",
        kind=ToolKind.COMPUTE,
        description="Read-only check for PENDING entries that would block invoice generation.",
        tags=["billing", "invoice"],
    ),
    "generate_invoice": ToolSpec(
        name="generate_invoice",
        agent="billing_agent",
        kind=ToolKind.WRITE,
        description="Generate invoice from APPROVED entries and batch-transition them to BILLED.",
        write_collection="invoices",
        audit_tier="legal_defensibility",
        tags=["billing", "invoice"],
    ),
    # --- DeadlineAgent ---
    "log_deadline_event": ToolSpec(
        name="log_deadline_event",
        agent="deadline_agent",
        kind=ToolKind.WRITE,
        description="Append a deadline event. CREATE-only — never updates existing events.",
        write_collection="deadline_events",
        audit_tier="legal_defensibility",
        tags=["deadline", "audit"],
    ),
    "verify_deadline": ToolSpec(
        name="verify_deadline",
        agent="deadline_agent",
        kind=ToolKind.WRITE,
        description="Set verification_status to attorney_verified on a deadline.",
        write_collection="deadlines",
        audit_tier="legal_defensibility",
        tags=["deadline"],
    ),
    "confirm_deadline": ToolSpec(
        name="confirm_deadline",
        agent="deadline_agent",
        kind=ToolKind.WRITE,
        description="Attorney confirms deadline is on track. Updates last_confirmed_by/at.",
        write_collection="deadlines",
        audit_tier="legal_defensibility",
        tags=["deadline"],
    ),
    "supersede_deadline": ToolSpec(
        name="supersede_deadline",
        agent="deadline_agent",
        kind=ToolKind.WRITE,
        description="Mark old deadline as SUPERSEDED and link to replacement.",
        write_collection="deadlines",
        audit_tier="legal_defensibility",
        tags=["deadline"],
    ),
    # --- CommsAgent ---
    "create_client_comm": ToolSpec(
        name="create_client_comm",
        agent="comms_agent",
        kind=ToolKind.WRITE,
        description="Create a new DRAFT_GENERATED client communication record.",
        write_collection="client_communications",
        audit_tier="operational",
        tags=["comms", "draft"],
    ),
    "approve_client_comm_draft": ToolSpec(
        name="approve_client_comm_draft",
        agent="comms_agent",
        kind=ToolKind.WRITE,
        description="Advance comm to DRAFT_APPROVED. Does NOT update last_client_contact.",
        write_collection="client_communications",
        audit_tier="operational",
        tags=["comms", "approval"],
    ),
    "queue_client_comm_for_delivery": ToolSpec(
        name="queue_client_comm_for_delivery",
        agent="comms_agent",
        kind=ToolKind.WRITE,
        description="Advance comm to QUEUED_FOR_SEND.",
        write_collection="client_communications",
        audit_tier="operational",
        tags=["comms"],
    ),
    "log_client_comm_sent": ToolSpec(
        name="log_client_comm_sent",
        agent="comms_agent",
        kind=ToolKind.WRITE,
        description="Advance comm to SENT_CONFIRMED. ONLY function that updates last_client_contact.",
        write_collection="client_communications",
        audit_tier="legal_defensibility",
        tags=["comms", "sent"],
    ),
    # --- Inbound ---
    "create_inbound_message": ToolSpec(
        name="create_inbound_message",
        agent="comms_agent",
        kind=ToolKind.WRITE,
        description="Create a new AWAITING_TRIAGE inbound message record.",
        write_collection="inbound_messages",
        audit_tier="operational",
        tags=["inbound", "triage"],
    ),
    "snooze_inbound": ToolSpec(
        name="snooze_inbound",
        agent="comms_agent",
        kind=ToolKind.WRITE,
        description="Snooze an inbound message out of the active triage queue.",
        write_collection="inbound_messages",
        audit_tier="operational",
        tags=["inbound"],
    ),
    "dismiss_inbound": ToolSpec(
        name="dismiss_inbound",
        agent="comms_agent",
        kind=ToolKind.WRITE,
        description="Permanently dismiss an inbound message.",
        write_collection="inbound_messages",
        audit_tier="operational",
        tags=["inbound"],
    ),
}
