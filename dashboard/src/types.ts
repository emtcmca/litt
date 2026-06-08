/**
 * TypeScript type definitions — mirrors backend/app/brief/schemas.py and models.py.
 * Keep in sync with Pydantic models.
 */

// ---------------------------------------------------------------------------
// Scrubber
// ---------------------------------------------------------------------------

export interface ScrubberFlag {
  check_name: string;
  severity: "BLOCK" | "WARN";
  message: string;
  matched_text: string | null;
}

// ---------------------------------------------------------------------------
// Brief sections
// ---------------------------------------------------------------------------

export interface BriefDeadlineItem {
  deadline_id: string;
  version: number;
  matter_id: string;
  matter_name: string;
  client_id: string;
  client_name: string;
  description: string;
  due_date: string; // ISO YYYY-MM-DD
  days_out: number;
  classification: "HARD_LEGAL" | "HARD_CONTRACTUAL" | "SOFT_INTERNAL" | "ADMINISTRATIVE";
  status: string;
  verification_status: string;
  last_confirmed_by: string | null;
  last_confirmed_at: string | null;
  is_unconfirmed: boolean;
  escalation_level: "CRITICAL" | "1_DAY" | "3_DAY" | "7_DAY" | "14_DAY" | null;
  source_type: string | null;
  source_document_id: string | null;
  source_excerpt: string | null;
  court: string | null;
  jurisdiction: string | null;
  detected_at: string | null;
  conflict_detail: string | null;
}

export interface DeadlineSection {
  items: BriefDeadlineItem[];
  count: number;
  has_critical: boolean;
}

export interface BriefTimeEntryItem {
  entry_id: string;
  version: number;
  matter_id: string;
  matter_name: string;
  client_id: string;
  client_name: string;
  attorney_id: string;
  entry_date: string;
  hours: number;
  amount: number;
  narrative: string | null;
  status: string;
  scrubber_flags: ScrubberFlag[];
  has_block: boolean;
  has_warn: boolean;
  task_code: string | null;
  activity_code: string | null;
  session_minutes_actual: number | null;
  suggested_narrative?: string | null;
}

export interface TimeEntrySection {
  items: BriefTimeEntryItem[];
  count: number;
  total_wip_usd: number;
}

export interface BriefBudgetItem {
  client_id: string;
  client_name: string;
  budget_cap: number;
  budget_billed: number;
  approved_unbilled: number;
  total_committed: number;
  utilization_pct: number;
  alert_status: "WARN" | "CRITICAL";
  threshold_pct: number;
}

export interface BudgetRisksSection {
  items: BriefBudgetItem[];
  count: number;
}

export interface BriefClientSilenceItem {
  matter_id: string;
  matter_name: string;
  client_id: string;
  client_name: string;
  days_since_contact: number;
  threshold_days: number;
  last_contact_date: string | null;
  comm_draft_id: string | null;
}

export interface ClientSilenceSection {
  items: BriefClientSilenceItem[];
  count: number;
}

export interface BriefAnomalyItem {
  escalation_id: string;
  matter_id: string | null;
  entity_id: string;
  entity_type: string;
  risk_level: "CRITICAL" | "ELEVATED" | "ROUTINE";
  priority: number;
  what_is_happening: string;
  why_it_matters: string;
  what_litt_has_done: string;
  what_attorney_must_decide: string;
  created_at: string;
}

export interface AnomaliesSection {
  items: BriefAnomalyItem[];
  count: number;
}

// ---------------------------------------------------------------------------
// v1.1.1 — Compound escalations section
// ---------------------------------------------------------------------------

export interface BriefCompoundEscalationItem {
  escalation_id: string;
  matter_id: string;
  what_is_happening: string;
  why_it_matters: string;
  what_attorney_must_decide: string;
  risk_level: "ELEVATED" | "CRITICAL";
  priority: number;
  created_at: string;
}

export interface CompoundEscalationsSection {
  items: BriefCompoundEscalationItem[];
  count: number;
}

// ---------------------------------------------------------------------------
// v1.1.1 — Inbox section (inbound messages awaiting triage)
// ---------------------------------------------------------------------------

export type InboundUrgency = "HIGH" | "MEDIUM" | "LOW";

export type InboundStatus =
  | "AWAITING_TRIAGE"
  | "TRIAGED"
  | "REPLY_HELD"
  | "HANDLED"
  | "SNOOZED"
  | "DISMISSED";

export interface BriefInboundItem {
  message_id: string;
  matter_id: string | null;
  from_name: string;
  from_role: string;
  received_at: string;
  wait_days: number;
  urgency: InboundUrgency;
  message_excerpt: string;
  summary: string | null;
  action_items: string[];
  suggested_reply_comm_id: string | null;
  cross_agent: boolean;
  status: InboundStatus;
}

export interface InboxSection {
  items: BriefInboundItem[];
  count: number;
}

// ---------------------------------------------------------------------------
// v1.1.1 — CommTrigger enum (all 12 values including legacy)
// ---------------------------------------------------------------------------

export type CommTrigger =
  | "DAYS_SINCE_CONTACT"
  | "MILESTONE_COMPLETE"
  | "BUDGET_THRESHOLD"
  | "DEADLINE_APPROACHING"
  | "INVOICE_ISSUED"
  | "ATTORNEY_INITIATED"
  | "BUDGET_THRESHOLD_CROSSED"
  | "DEADLINE_CONFIRMED_NO_UPDATE"
  | "INVOICE_GENERATED"
  | "ACTIVITY_WITHOUT_UPDATE"
  | "DEADLINE_EXTENSION_REQUEST"
  | "INBOUND_REPLY";

// ---------------------------------------------------------------------------
// v1.1.1 — AnomalyType enum (11 values)
// ---------------------------------------------------------------------------

export type AnomalyType =
  | "ROUND_HOURS_NO_SESSION"
  | "DUPLICATE_ENTRY_CANDIDATE"
  | "AI_DISCLOSURE_GAP"
  | "STALE_VERIFIED_DEADLINE"
  | "LATE_ENTRY_CREATION"
  | "ENTRY_CLUSTERING"
  | "NARRATIVE_INSUFFICIENT"
  | "HOURS_NARRATIVE_MISMATCH"
  | "SEMANTIC_DUPLICATE_CANDIDATE"
  | "RATE_ANOMALY"
  | "INVOICE_STALENESS";

export interface BriefSections {
  deadlines: DeadlineSection;
  time_entries: TimeEntrySection;
  budget_risks: BudgetRisksSection;
  client_silence: ClientSilenceSection;
  anomalies: AnomaliesSection;
  compound_escalations: CompoundEscalationsSection;
  inbox_items: InboxSection;
}

export interface BriefResponse {
  firm_id: string;
  firm_name: string;
  attorney_id: string;
  attorney_name: string;
  generated_at: string;
  demo_mode: boolean;
  sections: BriefSections;
  resolved_today: unknown[];
}

// ---------------------------------------------------------------------------
// Agent observability
// ---------------------------------------------------------------------------

export type ObservationType =
  | "SIGNAL_RECEIVED"
  | "REASONING"
  | "ROUTING_DECISION"
  | "TOOL_CALL"
  | "RESULT"
  | "ESCALATION"
  | "APPROVAL_GATE_APPLIED"
  | "MATTER_SYNTHESIS"
  | "COMPOUND_RISK"
  | "INBOX_TRIAGE"
  | "WARN_NOTICE"
  | "ROUTE_HANDOFF";

export type CommitmentLevel =
  | "AUTO_SAFE"
  | "REVIEW_REQUIRED"
  | "ESCALATION"
  | "BLOCKED";

export interface AgentObservation {
  observation_id: string;
  timestamp: string; // ISO datetime
  agent_name: string;
  observation_type: ObservationType;
  commitment_level: CommitmentLevel;
  description: string;
  data: Record<string, unknown>;
  confidence: number | null;
  evidence: string[];
  run_id: string | null;
  parent_observation_id: string | null;
  audit_log_id: string | null;
  /** "deterministic" | "llm_assisted" | "tool_write" | "human_gate" */
  work_kind: string;
  model_name: string | null;
  attorney_next_action: string | null;
}

export interface AgentRunTimeline {
  run_id: string;
  firm_id: string;
  triggered_by: string;
  started_at: string; // ISO datetime
  completed_at: string; // ISO datetime
  elapsed_seconds: number;
  observations: AgentObservation[];
  brief_items_count: number;
  escalations_count: number;
}

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

export interface SweepResponse {
  sweep_id: string;
  firm_id: string;
  duration_ms: number;
  sections_updated: string[];
  escalations_created: number;
  anomalies_detected: number;
}

export interface SweepRunResponse {
  timeline: AgentRunTimeline;
  brief: BriefResponse;
}

// ---------------------------------------------------------------------------
// Source email (for conflict_flagged deadline viewer)
// ---------------------------------------------------------------------------

export interface SourceEmail {
  id: string;
  from_address: string | null;
  from_name: string | null;
  to_address: string | null;
  subject: string | null;
  received_at: string | null;
  body: string | null;
  source_system: string | null;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export type AuditTier = "engineering" | "operational" | "legal_defensibility";

export interface AuditLogEvent {
  id: string;
  firm_id: string;
  created_at: string;
  updated_at: string;
  tier: AuditTier;
  event_type: string;
  actor: string;
  entity_type: string;
  entity_id: string;
  client_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  idempotency_key: string | null;
  notes: string | null;
}

export interface AuditLogResponse {
  events: AuditLogEvent[];
  count: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Action requests
// ---------------------------------------------------------------------------

export interface DeadlineVerifyRequest {
  firm_id: string;
  attorney_id: string;
  deadline_id: string;
  expected_version?: number;
  idempotency_key: string;
}

export interface DeadlineConfirmRequest {
  firm_id: string;
  attorney_id: string;
  deadline_id: string;
  expected_version?: number;
  idempotency_key: string;
}

export interface DeadlineExtendRequest {
  firm_id: string;
  attorney_id: string;
  deadline_id: string;
  new_due_date: string;
  reason: string;
  expected_version?: number;
  idempotency_key: string;
}

export interface DeadlineDismissRequest {
  firm_id: string;
  attorney_id: string;
  deadline_id: string;
  reason: string;
  expected_version?: number;
  idempotency_key: string;
}

export interface BillingApproveRequest {
  firm_id: string;
  attorney_id: string;
  entry_id: string;
  expected_version: number;
  idempotency_key: string;
}

export interface BillingWriteDownRequest {
  firm_id: string;
  attorney_id: string;
  entry_id: string;
  new_hours: number;
  new_amount: number;
  reason: string;
  expected_version: number;
  idempotency_key: string;
}

export interface BillingWriteOffRequest {
  firm_id: string;
  attorney_id: string;
  entry_id: string;
  reason: string;
  expected_version: number;
  idempotency_key: string;
}

export interface AlertDismissRequest {
  firm_id: string;
  attorney_id: string;
  alert_id: string;
  alert_type: string;
  reason: string;
  idempotency_key: string;
}

export interface BillingUpdateNarrativeRequest {
  firm_id: string;
  attorney_id: string;
  entry_id: string;
  narrative: string;
  expected_version?: number;
  idempotency_key?: string;
}

export interface CommsApproveRequest {
  firm_id: string;
  attorney_id: string;
  draft_id: string;
  expected_version?: number;
  idempotency_key?: string;
}

export interface CommsQueueRequest {
  firm_id: string;
  attorney_id: string;
  draft_id: string;
  channel?: string;
  expected_version?: number;
  idempotency_key?: string;
}

export interface CommsDismissRequest {
  firm_id: string;
  attorney_id: string;
  draft_id: string;
  reason: string;
  expected_version?: number;
  idempotency_key?: string;
}

// ---------------------------------------------------------------------------
// Tool response types
// ---------------------------------------------------------------------------

export interface ToolResult {
  success: true;
  entity_id: string;
  entity_type: string;
  audit_event_id: string;
  data: Record<string, unknown> | null;
}

export interface ToolError {
  success: false;
  error_type: string;
  message: string;
  detail: Record<string, unknown>;
}

export type ActionResult = ToolResult | ToolError;

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Timer HUD
// ---------------------------------------------------------------------------

export interface MatterSummary {
  id: string;
  name: string;
  client_id: string;
  client_name: string;
}

export interface TimerCaptureRequest {
  firm_id: string;
  matter_id: string;
  attorney_id: string;
  session_minutes: number;
  narrative: string;
  raw_note?: string;
  used_gemini: boolean;
  idempotency_key?: string;
}

export interface TimerNormalizeRequest {
  firm_id: string;
  attorney_id: string;
  matter_id: string;
  matter_name: string;
  raw_description: string;
  session_minutes: number;
}

export interface TimerNormalizeResponse {
  normalized_narrative: string;
  used_gemini: boolean;
  model_used: string | null;
}

export interface DemoCheck {
  pass: boolean;
  detail: string;
}

export interface DemoReadyResponse {
  ok: boolean;
  demo_date: string;
  firm_id: string;
  checks: Record<string, DemoCheck>;
}

export interface DemoResetResponse {
  ok: boolean;
  records_deleted: number;
  records_created: number;
  duration_ms: number;
}

// ---------------------------------------------------------------------------
// Console UI — new read endpoints (v1.1.2)
// ---------------------------------------------------------------------------

export interface RawDeadline {
  id: string;
  status: string;
  verification_status: string;
  due_date: string;
  description: string;
  classification: "HARD_LEGAL" | "HARD_CONTRACTUAL" | "SOFT_INTERNAL" | "ADMINISTRATIVE";
  matter_id: string;
  client_id?: string;
  days_out: number | null;
  escalation_level: string | null;
  email_reference?: string | null;
  last_confirmed_at?: string | null;
  last_confirmed_by?: string | null;
}

export interface BudgetUtilizationItem {
  client_id: string;
  client_name: string;
  utilization_pct: number;
  billed_to_date: number;
  approved_unbilled: number;
  total_committed: number;
  budget_cap: number;
  alert_status: string;
}

export interface RelationshipMatter {
  matter_id: string;
  matter_name: string;
  client_id: string;
  client_name: string;
  last_client_contact: string | null;
  days_since_contact: number | null;
  silence_threshold_days: number;
  going_quiet: boolean;
  status: string;
}

// ---------------------------------------------------------------------------
// Inbound messages (v1.1.2 Phase 3)
// ---------------------------------------------------------------------------

export interface InboundActionItem {
  text: string;
  handoff_agent?: string | null;
}

export interface InboundMessage {
  id: string;
  firm_id: string;
  source_email_id: string | null;
  matter_id: string | null;
  client_id: string | null;
  from_name: string;
  from_role: string;
  received_at: string;
  wait_days: number;
  urgency: "HIGH" | "MEDIUM" | "LOW";
  urgency_signals: string[];
  message_excerpt: string;
  summary: string | null;
  action_items: InboundActionItem[];
  suggested_reply_comm_id: string | null;
  suggested_reply_body?: string | null;
  cross_agent: boolean;
  status: string;
  version: number;
}

export interface InboundSnoozeRequest {
  firm_id: string;
  attorney_id: string;
  message_id: string;
  expected_version: number;
  idempotency_key?: string;
}

export interface InboundDismissRequest {
  firm_id: string;
  attorney_id: string;
  message_id: string;
  expected_version: number;
  idempotency_key?: string;
}

// ---------------------------------------------------------------------------
// Client module (v1.2.0)
// ---------------------------------------------------------------------------

export type ExtractionConfidence = "high" | "medium" | "low" | "not_found";
export type SuggestionStatus = "held" | "applied" | "dismissed";
export type MaintenanceCadence = "hourly" | "daily" | "events";
export type PendingClientStatus = "drafted" | "confirmed" | "discarded";

export interface ClientListItem {
  client_id: string;
  client_name: string;
  client_type: string;
  client_status: string;
  engagement: string;
  matter_short: string;
  rate: number | null;
  billing: string;
  matter_count: number;
  pending_item_count: number;
  budget_utilization_pct: number | null;
  budget_used: number | null;
  budget_cap_val: number | null;
  days_since_contact: number | null;
  last_contact_label: string | null;
  last_reviewed_label: string | null;
  held_suggestion_count: number;
}

export interface ExtractionResult {
  client_name: string | null;
  client_type: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  billing_rate: number | null;
  billing_type: string | null;
  billing_cycle: string | null;
  payment_terms: string | null;
  engagement_type: string | null;
  date_engaged: string | null;
  matter_name: string | null;
  matter_type: string | null;
  opposing_counsel: string | null;
  court: string | null;
  case_number: string | null;
  conflict_check_names: string[];
  confidence: Record<string, ExtractionConfidence>;
  extraction_notes: string;
  fields_extracted_count: number;
  fields_total: number;
}

export interface AppliedUpdate {
  id: string;
  firm_id: string;
  client_id: string;
  kind: string;
  field_label: string;
  change: string;
  source: string;
  source_ref: string;
  work: "deterministic" | "llm_assisted";
  confidence: number | null;
  applied_at: string;
  audit_event_id: string;
  created_at: string;
  updated_at: string;
}

export interface SuggestedUpdate {
  id: string;
  firm_id: string;
  client_id: string;
  title: string;
  detail: string;
  source: string;
  source_ref: string;
  confidence: number;
  status: SuggestionStatus;
  resolution_reason: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientMaintenanceState {
  client_id: string;
  cadence: MaintenanceCadence;
  last_reviewed_label: string;
  last_reviewed_at: string | null;
  next_sweep_label: string;
  reviews_today: number;
  watched_signal_count: number;
  applied: AppliedUpdate[];
  suggested: SuggestedUpdate[];
}

export interface PendingClient {
  id: string;
  firm_id: string;
  proposed_name: string;
  via: string;
  detected_at: string;
  source_file: string;
  extraction: ExtractionResult;
  status: PendingClientStatus;
  created_at: string;
  updated_at: string;
}

export interface MatterCreateRequest {
  matter_name: string;
  matter_type: string;
  opposing_counsel?: string | null;
  court?: string | null;
  case_number?: string | null;
  expected_resolution?: string | null;
}

export interface ClientCreateRequest {
  firm_id: string;
  client_name: string;
  client_type?: string;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone?: string;
  billing_rate: number;
  billing_type?: string;
  billing_cycle?: string;
  payment_terms?: string;
  engagement_type: string;
  date_engaged: string;
  engagement_letter_ref?: string | null;
  responsible_attorney_id?: string;
  conflict_check_names?: string[];
  silence_threshold_days?: number;
  budget_cap?: number | null;
  notes?: string | null;
  first_matter: MatterCreateRequest;
}

export interface ClientCreateResponse {
  client_id: string;
  matter_id: string;
  status: string;
}
