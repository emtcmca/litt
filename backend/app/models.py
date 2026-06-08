"""
Canonical Pydantic models for Litt. TypeScript types in dashboard/src/types.ts must mirror these.
Every Firestore document extends LittBaseModel — firm_id is mandatory on all records.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

class LittBaseModel(BaseModel):
    id: str
    firm_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(use_enum_values=True)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TimekeeperClass(str, Enum):
    AT = "AT"
    PA = "PA"
    OF = "OF"
    CL = "CL"


class PermissionScope(str, Enum):
    billing = "billing"
    deadlines = "deadlines"
    comms = "comms"
    admin = "admin"


class BillingArrangement(str, Enum):
    hourly = "hourly"
    flat_fee = "flat_fee"
    contingency = "contingency"
    hybrid = "hybrid"


class MatterType(str, Enum):
    transactional = "transactional"
    litigation = "litigation"
    regulatory = "regulatory"
    advisory = "advisory"
    estate = "estate"
    corporate = "corporate"


class ClientType(str, Enum):
    individual = "individual"
    entity = "entity"
    trust = "trust"
    estate = "estate"


class ClientStatus(str, Enum):
    active = "active"
    inactive = "inactive"
    closed = "closed"


class ExtractionConfidence(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"
    not_found = "not_found"


class UpdateClass(str, Enum):
    safe = "safe"
    judgment = "judgment"


class SuggestionStatus(str, Enum):
    held = "held"
    applied = "applied"
    dismissed = "dismissed"


class MaintenanceCadence(str, Enum):
    hourly = "hourly"
    daily = "daily"
    events = "events"


class PendingClientStatus(str, Enum):
    drafted = "drafted"
    confirmed = "confirmed"
    discarded = "discarded"


class MatterStatus(str, Enum):
    PROSPECT = "PROSPECT"
    CONFLICT_CHECK = "CONFLICT_CHECK"
    ENGAGEMENT_PENDING = "ENGAGEMENT_PENDING"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    CLOSING = "CLOSING"
    CLOSED = "CLOSED"


class TimeEntryStatus(str, Enum):
    CAPTURED = "CAPTURED"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    BILLED = "BILLED"
    WRITTEN_OFF = "WRITTEN_OFF"
    CLOSED = "CLOSED"


class AiOutputType(str, Enum):
    draft = "draft"
    research_summary = "research_summary"
    redline = "redline"
    extraction = "extraction"
    analysis = "analysis"


class AiDisclosureStatus(str, Enum):
    included = "included"
    not_required = "not_required"
    withheld = "withheld"


class BillingTreatment(str, Enum):
    billed_as_human_review = "billed_as_human_review"
    written_down = "written_down"
    nonbillable_ai_overhead = "nonbillable_ai_overhead"


class DeadlineClass(str, Enum):
    HARD_LEGAL = "HARD_LEGAL"
    HARD_CONTRACTUAL = "HARD_CONTRACTUAL"
    SOFT_INTERNAL = "SOFT_INTERNAL"
    ADMINISTRATIVE = "ADMINISTRATIVE"


class DeadlineStatus(str, Enum):
    ACTIVE = "ACTIVE"
    RESOLVED = "RESOLVED"
    SUPERSEDED = "SUPERSEDED"
    DISMISSED = "DISMISSED"


class SourceType(str, Enum):
    court_order = "court_order"
    email = "email"
    calendar = "calendar"
    manual = "manual"
    contract = "contract"
    statute = "statute"


class VerificationStatus(str, Enum):
    unverified = "unverified"
    pending_verification = "pending_verification"
    attorney_verified = "attorney_verified"
    superseded = "superseded"


class AnomalyType(str, Enum):
    ROUND_HOURS_NO_SESSION = "ROUND_HOURS_NO_SESSION"
    DUPLICATE_ENTRY_CANDIDATE = "DUPLICATE_ENTRY_CANDIDATE"
    AI_DISCLOSURE_GAP = "AI_DISCLOSURE_GAP"
    STALE_VERIFIED_DEADLINE = "STALE_VERIFIED_DEADLINE"
    LATE_ENTRY_CREATION = "LATE_ENTRY_CREATION"
    ENTRY_CLUSTERING = "ENTRY_CLUSTERING"
    NARRATIVE_INSUFFICIENT = "NARRATIVE_INSUFFICIENT"
    HOURS_NARRATIVE_MISMATCH = "HOURS_NARRATIVE_MISMATCH"
    SEMANTIC_DUPLICATE_CANDIDATE = "SEMANTIC_DUPLICATE_CANDIDATE"
    RATE_ANOMALY = "RATE_ANOMALY"
    INVOICE_STALENESS = "INVOICE_STALENESS"


class InboundUrgency(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class InboundStatus(str, Enum):
    AWAITING_TRIAGE = "AWAITING_TRIAGE"
    TRIAGED = "TRIAGED"
    REPLY_HELD = "REPLY_HELD"
    HANDLED = "HANDLED"
    SNOOZED = "SNOOZED"
    DISMISSED = "DISMISSED"


class DeadlineEventType(str, Enum):
    ESCALATION_SENT = "ESCALATION_SENT"
    ATTORNEY_CONFIRMED = "ATTORNEY_CONFIRMED"
    ATTORNEY_RESOLVED = "ATTORNEY_RESOLVED"
    ATTORNEY_EXTENDED = "ATTORNEY_EXTENDED"
    ATTORNEY_DELEGATED = "ATTORNEY_DELEGATED"
    DISMISSED_WITH_REASON = "DISMISSED_WITH_REASON"
    BACKUP_NOTIFIED = "BACKUP_NOTIFIED"
    VERIFICATION_COMPLETED = "VERIFICATION_COMPLETED"


class CommTrigger(str, Enum):
    DAYS_SINCE_CONTACT = "DAYS_SINCE_CONTACT"
    MILESTONE_COMPLETE = "MILESTONE_COMPLETE"
    BUDGET_THRESHOLD = "BUDGET_THRESHOLD"
    DEADLINE_APPROACHING = "DEADLINE_APPROACHING"
    INVOICE_ISSUED = "INVOICE_ISSUED"
    ATTORNEY_INITIATED = "ATTORNEY_INITIATED"
    # v1.1.1 outbound triggers
    BUDGET_THRESHOLD_CROSSED = "BUDGET_THRESHOLD_CROSSED"
    DEADLINE_CONFIRMED_NO_UPDATE = "DEADLINE_CONFIRMED_NO_UPDATE"
    INVOICE_GENERATED = "INVOICE_GENERATED"
    ACTIVITY_WITHOUT_UPDATE = "ACTIVITY_WITHOUT_UPDATE"
    DEADLINE_EXTENSION_REQUEST = "DEADLINE_EXTENSION_REQUEST"
    INBOUND_REPLY = "INBOUND_REPLY"


class CommStatus(str, Enum):
    DRAFT_GENERATED = "DRAFT_GENERATED"
    DRAFT_APPROVED = "DRAFT_APPROVED"
    QUEUED_FOR_SEND = "QUEUED_FOR_SEND"
    SENT_CONFIRMED = "SENT_CONFIRMED"
    DISMISSED_WITH_REASON = "DISMISSED_WITH_REASON"


class InvoiceStatus(str, Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PAID = "PAID"
    DISPUTED = "DISPUTED"
    VOID = "VOID"


class AuditTier(str, Enum):
    engineering = "engineering"
    operational = "operational"
    legal_defensibility = "legal_defensibility"


class EscalationType(str, Enum):
    DEADLINE = "DEADLINE"
    BILLING = "BILLING"
    COMMS = "COMMS"
    ANOMALY = "ANOMALY"
    COMPOUND = "COMPOUND"


class EscalationStatus(str, Enum):
    PENDING = "PENDING"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class RiskLevel(str, Enum):
    CRITICAL = "CRITICAL"
    ELEVATED = "ELEVATED"
    ROUTINE = "ROUTINE"


class WorkflowStatus(str, Enum):
    PAUSED_AWAITING_INPUT = "PAUSED_AWAITING_INPUT"
    RESUMED = "RESUMED"
    COMPLETED = "COMPLETED"


class AlertStatus(str, Enum):
    CLEAR = "CLEAR"
    WARN = "WARN"
    CRITICAL = "CRITICAL"


# ---------------------------------------------------------------------------
# Nested models (not LittBaseModel subclasses — no firm_id/id needed)
# ---------------------------------------------------------------------------

class BillingGuidelines(BaseModel):
    block_billing_allowed: bool = False
    travel_time_allowed: bool = False
    intraoffice_conference_allowed: str = "yes"  # "yes" | "no" | "limited"
    research_requires_preapproval: bool = False
    max_daily_hours_without_review: float = 8.0
    forbidden_phrases: List[str] = Field(default_factory=list)
    required_task_codes: bool = False
    activity_codes_required: bool = False
    ledes_required: bool = False
    ai_disclosure_required: bool = False
    budget_notice_threshold: float = 0.75
    outside_counsel_guidelines: Optional[str] = None


class EngagementTerms(BaseModel):
    fee_type: str = "hourly"
    scope_summary: str = ""
    excluded_work: List[str] = Field(default_factory=list)
    retainer_required: bool = False
    retainer_amount: Optional[Decimal] = None
    evergreen_retainer: bool = False
    budget_cap: Optional[Decimal] = None
    client_approval_required_above: Optional[Decimal] = None
    outside_counsel_guidelines_attached: bool = False
    engagement_letter_signed: bool = False
    engagement_letter_date: Optional[date] = None


class WriteDownRecord(BaseModel):
    original_hours: Decimal
    original_amount: Decimal
    new_hours: Decimal
    new_amount: Decimal
    reason: str
    attorney_id: str
    written_down_at: datetime


class WriteOffRecord(BaseModel):
    original_hours: Decimal
    original_amount: Decimal
    reason: str
    attorney_id: str
    written_off_at: datetime


class SourceMapEntry(BaseModel):
    fact_id: str
    fact_text: str
    sentence_in_draft: str
    source_type: str
    source_id: str
    source_excerpt: str


class EscalationBrief(BaseModel):
    what_is_happening: str
    why_it_matters: str
    what_litt_has_done: str
    what_attorney_must_decide: str
    decision_deadline: Optional[datetime] = None
    risk_level: RiskLevel = RiskLevel.ROUTINE


class InboundActionItem(BaseModel):
    text: str
    handoff_agent: Optional[str] = None


# ---------------------------------------------------------------------------
# Firestore collection models
# ---------------------------------------------------------------------------

class Attorney(LittBaseModel):
    name: str
    email: str
    default_rate: Decimal
    billing_increment: float = 0.1
    timekeeper_id: str
    timekeeper_classification: TimekeeperClass = TimekeeperClass.AT
    rate_overrides: Dict[str, Decimal] = Field(default_factory=dict)
    permission_scope: List[PermissionScope] = Field(default_factory=list)
    is_backup_contact: bool = False
    writing_style: Dict[str, Any] = Field(default_factory=dict)


class Client(LittBaseModel):
    name: str
    billing_contact: str
    billing_email: str
    billing_address: str = ""
    arrangement: BillingArrangement = BillingArrangement.hourly
    budget_cap: Optional[Decimal] = None
    budget_billed: Decimal = Decimal("0")
    retainer_balance: Optional[Decimal] = None
    retainer_refill_threshold: Optional[Decimal] = None
    ledes_client_id: str
    client_matter_id_prefix: str = ""
    last_client_contact: Optional[datetime] = None
    client_silence_threshold_days: int = 14
    billing_guidelines: BillingGuidelines = Field(default_factory=BillingGuidelines)
    engagement_terms: EngagementTerms = Field(default_factory=EngagementTerms)
    notes: Optional[str] = None
    # Client module additions
    client_type: ClientType = ClientType.entity
    client_status: ClientStatus = ClientStatus.active
    primary_contact_name: str = ""
    primary_contact_phone: str = ""
    originating_attorney_id: str = ""
    responsible_attorney_id: str = ""
    engagement_letter_ref: Optional[str] = None
    conflict_check_names: List[str] = Field(default_factory=list)
    conflict_check_date: Optional[date] = None
    conflict_check_cleared: bool = False
    maintenance_cadence: MaintenanceCadence = MaintenanceCadence.hourly
    last_reviewed_at: Optional[datetime] = None
    watched_signal_count: int = 0


class Matter(LittBaseModel):
    client_id: str
    client_matter_id: str
    law_firm_matter_id: str
    name: str
    type: MatterType
    status: MatterStatus = MatterStatus.ACTIVE
    assigned_attorneys: List[str] = Field(default_factory=list)
    opened_at: datetime
    last_activity: datetime
    last_client_contact: Optional[datetime] = None
    # Client module additions
    opposing_counsel: Optional[str] = None
    court: Optional[str] = None
    jurisdiction: Optional[str] = None
    case_number: Optional[str] = None
    expected_resolution: Optional[date] = None
    matter_budget_cap: Optional[Decimal] = None


class TimeEntry(LittBaseModel):
    matter_id: str
    client_id: str
    attorney_id: str
    entry_date: date
    hours: Decimal
    rate: Decimal
    amount: Decimal
    session_minutes_actual: Optional[int] = None
    billing_increment: float = 0.1
    # LEDES fields — never collapse into one field
    task_code: Optional[str] = None
    activity_code: Optional[str] = None
    expense_code: Optional[str] = None
    narrative: Optional[str] = None
    status: TimeEntryStatus = TimeEntryStatus.PENDING
    invoice_id: Optional[str] = None
    # AI billing provenance (ABA FO 512)
    ai_assisted: bool = False
    ai_tool: Optional[str] = None
    model: Optional[str] = None
    ai_cost_usd: Optional[Decimal] = None
    human_minutes_actual: Optional[int] = None
    ai_minutes_estimated: Optional[int] = None
    output_type: Optional[AiOutputType] = None
    human_review_completed: bool = False
    reviewing_attorney_id: Optional[str] = None
    client_ai_disclosure_required: bool = False
    client_ai_disclosure_status: Optional[AiDisclosureStatus] = None
    billing_treatment: Optional[BillingTreatment] = None
    activity_log: List[str] = Field(default_factory=list)
    write_down_record: Optional[WriteDownRecord] = None
    write_off_record: Optional[WriteOffRecord] = None
    version: int = 1


class Deadline(LittBaseModel):
    matter_id: str
    description: str
    due_date: date
    classification: DeadlineClass
    status: DeadlineStatus = DeadlineStatus.ACTIVE
    source_type: SourceType
    source_document_id: Optional[str] = None
    source_excerpt: Optional[str] = None
    created_by: str
    verified_by: Optional[str] = None
    verification_status: VerificationStatus = VerificationStatus.unverified
    supersedes_deadline_id: Optional[str] = None
    jurisdiction: Optional[str] = None
    court: Optional[str] = None
    last_confirmed_by: Optional[str] = None
    last_confirmed_at: Optional[datetime] = None


class DeadlineEvent(LittBaseModel):
    deadline_id: str
    event_type: DeadlineEventType
    escalation_level: Optional[str] = None
    attorney_id: Optional[str] = None
    response: Optional[str] = None
    dismissal_reason: Optional[str] = None
    notes: Optional[str] = None


class ClientCommunication(LittBaseModel):
    matter_id: str
    client_id: str
    trigger: CommTrigger
    draft_body: str
    source_map: List[SourceMapEntry] = Field(default_factory=list)
    status: CommStatus = CommStatus.DRAFT_GENERATED
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    queued_at: Optional[datetime] = None
    sent_confirmed_at: Optional[datetime] = None
    dismissal_reason: Optional[str] = None


class Invoice(LittBaseModel):
    client_id: str
    period_start: date
    period_end: date
    total_hours: Decimal
    total_amount: Decimal
    retainer_draw: Optional[Decimal] = None
    retainer_balance_after: Optional[Decimal] = None
    exhibit_md: str = ""
    ledes_file_path: Optional[str] = None
    status: InvoiceStatus = InvoiceStatus.DRAFT
    issued_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    days_outstanding: Optional[int] = None


class AuditEvent(LittBaseModel):
    """CREATE-only. Firestore security rules deny UPDATE and DELETE."""
    tier: AuditTier
    event_type: str
    actor: str
    entity_type: str
    entity_id: str
    client_id: Optional[str] = None
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None
    idempotency_key: Optional[str] = None
    notes: Optional[str] = None


class IngestionSignal(LittBaseModel):
    """Idempotency registry for ingestion deduplication."""
    source_system: str
    source_id: str
    source_hash: str
    signal_type: str
    extracted_date: Optional[date] = None
    matter_id: Optional[str] = None
    processed: bool = False
    outcome_id: Optional[str] = None
    first_seen_at: datetime
    last_seen_at: datetime


class Escalation(LittBaseModel):
    type: EscalationType
    matter_id: Optional[str] = None
    entity_id: str
    brief: EscalationBrief
    status: EscalationStatus = EscalationStatus.PENDING
    routed_to: str
    priority: int = 1
    workflow_state: Optional[Dict[str, Any]] = None
    workflow_status: Optional[WorkflowStatus] = None
    resolved_at: Optional[datetime] = None


class InboundMessage(LittBaseModel):
    """Inbound message from client, opposing counsel, or other contact. Collection: inbound_messages."""
    source_email_id: Optional[str] = None
    matter_id: Optional[str] = None
    client_id: Optional[str] = None
    from_name: str
    from_role: str = "client"
    received_at: datetime
    wait_days: int = 0
    urgency: InboundUrgency = InboundUrgency.LOW
    urgency_signals: List[str] = Field(default_factory=list)
    message_excerpt: str = ""
    summary: Optional[str] = None
    action_items: List[InboundActionItem] = Field(default_factory=list)
    suggested_reply_comm_id: Optional[str] = None
    cross_agent: bool = False
    status: InboundStatus = InboundStatus.AWAITING_TRIAGE
    version: int = 1


# ---------------------------------------------------------------------------
# Tool layer return types
# ---------------------------------------------------------------------------

class ToolResult(BaseModel):
    success: bool = True
    entity_id: str
    entity_type: str
    audit_event_id: str
    data: Optional[Dict[str, Any]] = None


class ToolError(BaseModel):
    success: bool = False
    error_type: str  # INVALID_TRANSITION | STALE_STATE | VALIDATION_FAILED | NOT_FOUND | FORBIDDEN | IDEMPOTENCY_HIT
    message: str
    detail: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Budget utilization (computed, not stored)
# ---------------------------------------------------------------------------

class BudgetUtilization(BaseModel):
    client_id: str
    firm_id: str
    budget_cap: Decimal
    billed_to_date: Decimal
    approved_unbilled: Decimal
    total_committed: Decimal
    utilization_pct: float
    alert_threshold_warn: float = 0.75
    alert_threshold_critical: float = 0.90
    alert_status: AlertStatus


# ---------------------------------------------------------------------------
# Client module models
# ---------------------------------------------------------------------------

class ExtractionResult(BaseModel):
    """Stateless — never written to Firestore. POST /api/clients/extract returns this."""
    client_name: Optional[str] = None
    client_type: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[str] = None
    primary_contact_phone: Optional[str] = None
    billing_rate: Optional[float] = None
    billing_type: Optional[str] = None
    billing_cycle: Optional[str] = None
    payment_terms: Optional[str] = None
    engagement_type: Optional[str] = None
    date_engaged: Optional[str] = None
    matter_name: Optional[str] = None
    matter_type: Optional[str] = None
    opposing_counsel: Optional[str] = None
    court: Optional[str] = None
    case_number: Optional[str] = None
    conflict_check_names: List[str] = Field(default_factory=list)
    confidence: Dict[str, str] = Field(default_factory=dict)
    extraction_notes: str = ""
    fields_extracted_count: int = 0
    fields_total: int = 16


class AppliedUpdate(LittBaseModel):
    """Safe update — already written to the ledger. FYI display only."""
    client_id: str
    kind: str  # deadline | contact | budget | matter | conflict
    field_label: str
    change: str
    source: str
    source_ref: str
    work: str  # deterministic | llm_assisted
    confidence: Optional[float] = None
    applied_at: datetime
    audit_event_id: str


class SuggestedUpdate(LittBaseModel):
    """Judgment-tier update — held for attorney approval."""
    client_id: str
    title: str
    detail: str
    source: str
    source_ref: str
    confidence: float
    status: SuggestionStatus = SuggestionStatus.held
    resolution_reason: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None


class ClientMaintenanceState(BaseModel):
    """Computed read model — assembled from Firestore, not stored as-is."""
    client_id: str
    cadence: MaintenanceCadence
    last_reviewed_label: str
    last_reviewed_at: Optional[datetime] = None
    next_sweep_label: str
    reviews_today: int
    watched_signal_count: int
    applied: List[AppliedUpdate] = Field(default_factory=list)
    suggested: List[SuggestedUpdate] = Field(default_factory=list)


class PendingClient(LittBaseModel):
    """Auto-drafted from watched inbox engagement letter. Held for attorney confirm."""
    proposed_name: str
    via: str
    detected_at: datetime
    source_file: str
    extraction: ExtractionResult = Field(default_factory=ExtractionResult)
    status: PendingClientStatus = PendingClientStatus.drafted


class ClientListItem(BaseModel):
    """Roster row — computed from Client + Matter + escalations."""
    client_id: str
    client_name: str
    client_type: str
    client_status: str
    engagement: str
    matter_short: str
    rate: Optional[float] = None
    billing: str = ""
    matter_count: int = 1
    pending_item_count: int = 0
    budget_utilization_pct: Optional[float] = None
    budget_used: Optional[float] = None
    budget_cap_val: Optional[float] = None
    days_since_contact: Optional[int] = None
    last_contact_label: Optional[str] = None
    last_reviewed_label: Optional[str] = None
    held_suggestion_count: int = 0


class MatterCreateRequest(BaseModel):
    matter_name: str
    matter_type: str
    opposing_counsel: Optional[str] = None
    court: Optional[str] = None
    case_number: Optional[str] = None
    expected_resolution: Optional[str] = None


class ClientCreateRequest(BaseModel):
    firm_id: str
    client_name: str
    client_type: str = "entity"
    primary_contact_name: str
    primary_contact_email: str
    primary_contact_phone: str = ""
    billing_rate: float
    billing_type: str = "hourly"
    billing_cycle: str = "monthly"
    payment_terms: str = "net_30"
    engagement_type: str
    date_engaged: str
    engagement_letter_ref: Optional[str] = None
    responsible_attorney_id: str = "dana-strand"
    conflict_check_names: List[str] = Field(default_factory=list)
    silence_threshold_days: int = 14
    budget_warn_threshold_pct: int = 75
    budget_cap: Optional[float] = None
    notes: Optional[str] = None
    first_matter: MatterCreateRequest
