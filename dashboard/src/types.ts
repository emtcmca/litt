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

export interface BriefSections {
  deadlines: DeadlineSection;
  time_entries: TimeEntrySection;
  budget_risks: BudgetRisksSection;
  client_silence: ClientSilenceSection;
  anomalies: AnomaliesSection;
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
  | "APPROVAL_GATE_APPLIED";

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
// Action requests
// ---------------------------------------------------------------------------

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
