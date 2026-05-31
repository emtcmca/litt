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
}

export interface DeadlineSection {
  items: BriefDeadlineItem[];
  count: number;
  has_critical: boolean;
}

export interface BriefTimeEntryItem {
  entry_id: string;
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

// ---------------------------------------------------------------------------
// Action requests
// ---------------------------------------------------------------------------

export interface DeadlineConfirmRequest {
  firm_id: string;
  attorney_id: string;
  deadline_id: string;
  idempotency_key: string;
}

export interface DeadlineExtendRequest {
  firm_id: string;
  attorney_id: string;
  deadline_id: string;
  new_due_date: string;
  reason: string;
  idempotency_key: string;
}

export interface DeadlineDismissRequest {
  firm_id: string;
  attorney_id: string;
  deadline_id: string;
  reason: string;
  idempotency_key: string;
}

export interface BillingApproveRequest {
  firm_id: string;
  attorney_id: string;
  entry_id: string;
  expected_status: string;
  idempotency_key: string;
}

export interface BillingWriteDownRequest {
  firm_id: string;
  attorney_id: string;
  entry_id: string;
  new_hours: number;
  new_amount: number;
  reason: string;
  expected_status: string;
  idempotency_key: string;
}

export interface BillingWriteOffRequest {
  firm_id: string;
  attorney_id: string;
  entry_id: string;
  reason: string;
  expected_status: string;
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
