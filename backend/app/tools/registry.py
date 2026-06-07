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
    signature: str = ""

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "agent": self.agent,
            "kind": self.kind.value,
            "description": self.description,
            "write_collection": self.write_collection,
            "audit_tier": self.audit_tier,
            "tags": self.tags,
            "signature": self.signature,
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
        signature="(firm_id, entry_id, risk_level, what_is_happening, why_it_matters, what_litt_has_done, what_attorney_must_decide, entity_type, priority, idempotency_key) -> ToolResult",
    ),
    "log_escalation": ToolSpec(
        name="log_escalation",
        agent="coordinator",
        kind=ToolKind.WRITE,
        description="Create any type of escalation record (DEADLINE, BILLING, COMMS, ANOMALY).",
        write_collection="escalations",
        audit_tier="operational",
        tags=["escalation"],
        signature="(firm_id, escalation_type, entity_id, entity_type, risk_level, summary, attorney_action_required, idempotency_key) -> ToolResult",
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
        signature="(firm_id, entry_id, target_status, expected_status, attorney_id, idempotency_key) -> ToolResult",
    ),
    "write_time_entry": ToolSpec(
        name="write_time_entry",
        agent="billing_agent",
        kind=ToolKind.WRITE,
        description="Create a new PENDING time entry with 6-min billing rounding.",
        write_collection="time_entries",
        audit_tier="operational",
        tags=["billing", "capture"],
        signature="(firm_id, matter_id, attorney_id, hours, narrative, activity_code, idempotency_key) -> ToolResult",
    ),
    "write_down_entry": ToolSpec(
        name="write_down_entry",
        agent="billing_agent",
        kind=ToolKind.WRITE,
        description="Partially reduce a time entry's hours/amount. Reason required.",
        write_collection="time_entries",
        audit_tier="legal_defensibility",
        tags=["billing", "adjustment"],
        signature="(firm_id, entry_id, new_hours, new_amount, reason, attorney_id, idempotency_key) -> ToolResult",
    ),
    "write_off_entry": ToolSpec(
        name="write_off_entry",
        agent="billing_agent",
        kind=ToolKind.WRITE,
        description="Move entry to terminal WRITTEN_OFF state. Reason required.",
        write_collection="time_entries",
        audit_tier="legal_defensibility",
        tags=["billing", "adjustment"],
        signature="(firm_id, entry_id, reason, attorney_id, idempotency_key) -> ToolResult",
    ),
    "update_entry_narrative": ToolSpec(
        name="update_entry_narrative",
        agent="billing_agent",
        kind=ToolKind.WRITE,
        description="Update narrative on PENDING or APPROVED entry.",
        write_collection="time_entries",
        audit_tier="operational",
        tags=["billing", "narrative"],
        signature="(firm_id, entry_id, narrative, attorney_id, idempotency_key) -> ToolResult",
    ),
    "compute_budget_utilization": ToolSpec(
        name="compute_budget_utilization",
        agent="billing_agent",
        kind=ToolKind.COMPUTE,
        description="Read-only budget utilization calculation. Returns BudgetUtilization.",
        tags=["billing", "budget"],
        signature="(firm_id, matter_id) -> BudgetUtilization",
    ),
    "check_invoice_readiness": ToolSpec(
        name="check_invoice_readiness",
        agent="billing_agent",
        kind=ToolKind.COMPUTE,
        description="Read-only check for PENDING entries that would block invoice generation.",
        tags=["billing", "invoice"],
        signature="(firm_id, matter_id) -> InvoiceReadinessResult",
    ),
    "generate_invoice": ToolSpec(
        name="generate_invoice",
        agent="billing_agent",
        kind=ToolKind.WRITE,
        description="Generate invoice from APPROVED entries and batch-transition them to BILLED.",
        write_collection="invoices",
        audit_tier="legal_defensibility",
        tags=["billing", "invoice"],
        signature="(firm_id, matter_id, attorney_id, idempotency_key) -> ToolResult",
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
        signature="(firm_id, deadline_id, event_type, actor, notes, idempotency_key) -> ToolResult",
    ),
    "verify_deadline": ToolSpec(
        name="verify_deadline",
        agent="deadline_agent",
        kind=ToolKind.WRITE,
        description="Set verification_status to attorney_verified on a deadline.",
        write_collection="deadlines",
        audit_tier="legal_defensibility",
        tags=["deadline"],
        signature="(firm_id, deadline_id, attorney_id, confirmed_date, classification, idempotency_key) -> ToolResult",
    ),
    "confirm_deadline": ToolSpec(
        name="confirm_deadline",
        agent="deadline_agent",
        kind=ToolKind.WRITE,
        description="Attorney confirms deadline is on track. Updates last_confirmed_by/at.",
        write_collection="deadlines",
        audit_tier="legal_defensibility",
        tags=["deadline"],
        signature="(firm_id, deadline_id, attorney_id, idempotency_key) -> ToolResult",
    ),
    "supersede_deadline": ToolSpec(
        name="supersede_deadline",
        agent="deadline_agent",
        kind=ToolKind.WRITE,
        description="Mark old deadline as SUPERSEDED and link to replacement.",
        write_collection="deadlines",
        audit_tier="legal_defensibility",
        tags=["deadline"],
        signature="(firm_id, deadline_id, successor_id, reason, attorney_id, idempotency_key) -> ToolResult",
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
        signature="(firm_id, matter_id, attorney_id, subject, body, trigger_type, idempotency_key) -> ToolResult",
    ),
    "approve_client_comm_draft": ToolSpec(
        name="approve_client_comm_draft",
        agent="comms_agent",
        kind=ToolKind.WRITE,
        description="Advance comm to DRAFT_APPROVED. Does NOT update last_client_contact.",
        write_collection="client_communications",
        audit_tier="operational",
        tags=["comms", "approval"],
        signature="(firm_id, draft_id, attorney_id, idempotency_key) -> ToolResult",
    ),
    "queue_client_comm_for_delivery": ToolSpec(
        name="queue_client_comm_for_delivery",
        agent="comms_agent",
        kind=ToolKind.WRITE,
        description="Advance comm to QUEUED_FOR_SEND.",
        write_collection="client_communications",
        audit_tier="operational",
        tags=["comms"],
        signature="(firm_id, draft_id, attorney_id, idempotency_key) -> ToolResult",
    ),
    "log_client_comm_sent": ToolSpec(
        name="log_client_comm_sent",
        agent="comms_agent",
        kind=ToolKind.WRITE,
        description="Advance comm to SENT_CONFIRMED. ONLY function that updates last_client_contact.",
        write_collection="client_communications",
        audit_tier="legal_defensibility",
        tags=["comms", "sent"],
        signature="(firm_id, draft_id, attorney_id, sent_at, idempotency_key) -> ToolResult",
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
        signature="(firm_id, matter_id, sender, subject, body, received_at, idempotency_key) -> ToolResult",
    ),
    "snooze_inbound": ToolSpec(
        name="snooze_inbound",
        agent="comms_agent",
        kind=ToolKind.WRITE,
        description="Snooze an inbound message out of the active triage queue.",
        write_collection="inbound_messages",
        audit_tier="operational",
        tags=["inbound"],
        signature="(firm_id, message_id, attorney_id, snooze_until, idempotency_key) -> ToolResult",
    ),
    "dismiss_inbound": ToolSpec(
        name="dismiss_inbound",
        agent="comms_agent",
        kind=ToolKind.WRITE,
        description="Permanently dismiss an inbound message.",
        write_collection="inbound_messages",
        audit_tier="operational",
        tags=["inbound"],
        signature="(firm_id, message_id, attorney_id, reason, idempotency_key) -> ToolResult",
    ),
    # --- Gemini pseudo-tools (LLM-assisted, read-only, no Firestore write) ---
    "draft_client_comm": ToolSpec(
        name="draft_client_comm",
        agent="comms_agent",
        kind=ToolKind.GEMINI,
        description="Generate outreach email draft for silence trigger via Gemini.",
        tags=["comms", "draft", "llm"],
        signature="(matter_context, days_since_contact, trigger_type) -> str | None",
    ),
    "summarize_inbound": ToolSpec(
        name="summarize_inbound",
        agent="comms_agent",
        kind=ToolKind.GEMINI,
        description="Summarize inbound message and extract action items via Gemini.",
        tags=["inbound", "llm"],
        signature="(subject, body, matter_context) -> InboundSummary | None",
    ),
    "draft_inbound_reply": ToolSpec(
        name="draft_inbound_reply",
        agent="comms_agent",
        kind=ToolKind.GEMINI,
        description="Draft reply to inbound client message via Gemini.",
        tags=["inbound", "llm"],
        signature="(subject, body, matter_context, tone) -> str | None",
    ),
    "suggest_narrative": ToolSpec(
        name="suggest_narrative",
        agent="billing_agent",
        kind=ToolKind.GEMINI,
        description="Suggest compliant billing narrative for a scrubber-blocked entry via Gemini.",
        tags=["billing", "narrative", "llm"],
        signature="(entry_id, activity_code, hours, flags) -> str | None",
    ),
    "assess_narrative_quality": ToolSpec(
        name="assess_narrative_quality",
        agent="anomaly_agent",
        kind=ToolKind.GEMINI,
        description="Evaluate billing narrative for LEDES compliance and specificity via Gemini.",
        tags=["anomaly", "narrative", "llm"],
        signature="(entry_id, narrative, activity_code) -> NarrativeQualityResult | None",
    ),
    "extract_deadline_date": ToolSpec(
        name="extract_deadline_date",
        agent="deadline_agent",
        kind=ToolKind.GEMINI,
        description="Extract structured deadline date from unstructured email/text via Gemini.",
        tags=["deadline", "extraction", "llm"],
        signature="(text, matter_context) -> ExtractedDeadline | None",
    ),
    # --- Read/compute pseudo-tools (deterministic, no Firestore write) ---
    "get_pending_entries": ToolSpec(
        name="get_pending_entries",
        agent="billing_agent",
        kind=ToolKind.READ,
        description="Fetch all PENDING time entries for a firm from Firestore.",
        tags=["billing", "read"],
        signature="(firm_id) -> list[TimeEntry]",
    ),
    "run_prebill_scrubber": ToolSpec(
        name="run_prebill_scrubber",
        agent="billing_agent",
        kind=ToolKind.COMPUTE,
        description="Run LEDES/PII/privilege scrubber rules against entry batch. Returns flags.",
        tags=["billing", "scrubber"],
        signature="(firm_id, entries: list[TimeEntry]) -> ScrubberResult",
    ),
    "scan_inbox": ToolSpec(
        name="scan_inbox",
        agent="comms_agent",
        kind=ToolKind.READ,
        description="Fetch AWAITING_TRIAGE inbound messages for a firm from Firestore.",
        tags=["inbound", "read"],
        signature="(firm_id) -> list[InboundMessage]",
    ),
    "score_urgency": ToolSpec(
        name="score_urgency",
        agent="comms_agent",
        kind=ToolKind.COMPUTE,
        description="Compute urgency score for inbound message from keywords and deadline proximity.",
        tags=["inbound", "compute"],
        signature="(message: InboundMessage, active_deadlines: list[Deadline]) -> UrgencyScore",
    ),
    "get_active_deadlines": ToolSpec(
        name="get_active_deadlines",
        agent="deadline_agent",
        kind=ToolKind.READ,
        description="Fetch non-terminal deadlines for a firm ordered by due_date ascending.",
        tags=["deadline", "read"],
        signature="(firm_id) -> list[Deadline]",
    ),
    "apply_escalation_tier": ToolSpec(
        name="apply_escalation_tier",
        agent="deadline_agent",
        kind=ToolKind.COMPUTE,
        description="Classify deadline urgency tier (HARD_LEGAL, SOFT_INTERNAL, etc.) from days-out.",
        tags=["deadline", "compute"],
        signature="(deadline: Deadline, effective_date: date) -> EscalationTier",
    ),
    "run_detectors": ToolSpec(
        name="run_detectors",
        agent="anomaly_agent",
        kind=ToolKind.COMPUTE,
        description="Run all anomaly detector functions against entry batch. Returns AnomalySignals.",
        tags=["anomaly", "compute"],
        signature="(firm_id, entries: list[TimeEntry]) -> list[AnomalySignal]",
    ),
}
