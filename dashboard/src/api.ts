/**
 * API client — all calls to the Litt backend.
 * Base URL: /api (proxied by Vite dev server or served by Cloud Run at the same origin).
 */

import type {
  ActionResult,
  AlertDismissRequest,
  AuditLogResponse,
  BillingApproveRequest,
  BillingUpdateNarrativeRequest,
  BillingWriteDownRequest,
  BillingWriteOffRequest,
  BriefResponse,
  BudgetUtilizationItem,
  CommsApproveRequest,
  CommsDismissRequest,
  CommsQueueRequest,
  DeadlineConfirmRequest,
  DeadlineDismissRequest,
  DeadlineExtendRequest,
  DeadlineVerifyRequest,
  DemoReadyResponse,
  DemoResetResponse,
  InboundDismissRequest,
  InboundMessage,
  InboundSnoozeRequest,
  MatterSummary,
  RawDeadline,
  RelationshipMatter,
  ScrubberFlag,
  SourceEmail,
  SweepRunResponse,
  TimerCaptureRequest,
  TimerNormalizeRequest,
  TimerNormalizeResponse,
} from "./types";

const BASE = "/api";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.detail ?? err.message ?? "Request failed");
  }
  return res.json();
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = params
    ? `${BASE}${path}?${new URLSearchParams(params)}`
    : `${BASE}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.detail ?? err.message ?? "Request failed");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Brief
// ---------------------------------------------------------------------------

export function getBrief(firmId: string, attorneyId = "dana-strand"): Promise<BriefResponse> {
  return get<BriefResponse>("/brief", { firm_id: firmId, attorney_id: attorneyId });
}

export function runSweep(firmId: string): Promise<SweepRunResponse> {
  return post<SweepRunResponse>("/sweep", { firm_id: firmId });
}

// ---------------------------------------------------------------------------
// Deadline actions
// ---------------------------------------------------------------------------

export function confirmDeadline(req: DeadlineConfirmRequest): Promise<ActionResult> {
  return post<ActionResult>("/actions/deadline/confirm", req);
}

export function verifyDeadline(req: DeadlineVerifyRequest): Promise<ActionResult> {
  return post<ActionResult>("/actions/deadline/verify", req);
}

export function getSourceEmail(firmId: string, emailId: string): Promise<SourceEmail> {
  return get<SourceEmail>(`/source-email/${emailId}`, { firm_id: firmId });
}

export function extendDeadline(req: DeadlineExtendRequest): Promise<ActionResult> {
  return post<ActionResult>("/actions/deadline/extend", req);
}

export function dismissDeadline(req: DeadlineDismissRequest): Promise<ActionResult> {
  return post<ActionResult>("/actions/deadline/dismiss", req);
}

// ---------------------------------------------------------------------------
// Billing actions
// ---------------------------------------------------------------------------

export function approveBilling(req: BillingApproveRequest): Promise<ActionResult> {
  return post<ActionResult>("/actions/billing/approve", req);
}

export function writeDownBilling(req: BillingWriteDownRequest): Promise<ActionResult> {
  return post<ActionResult>("/actions/billing/write-down", req);
}

export function writeOffBilling(req: BillingWriteOffRequest): Promise<ActionResult> {
  return post<ActionResult>("/actions/billing/write-off", req);
}

// ---------------------------------------------------------------------------
// Alert actions
// ---------------------------------------------------------------------------

export function dismissAlert(req: AlertDismissRequest): Promise<ActionResult> {
  return post<ActionResult>("/actions/alert/dismiss", req);
}

// ---------------------------------------------------------------------------
// Billing extras
// ---------------------------------------------------------------------------

export function updateNarrative(req: BillingUpdateNarrativeRequest): Promise<ActionResult> {
  return post<ActionResult>("/actions/billing/update-narrative", req);
}

export function getScrubber(firmId: string, entryId: string): Promise<{ flags: ScrubberFlag[]; has_block: boolean; has_warn: boolean; clean: boolean }> {
  return get(`/billing/scrubber/${entryId}`, { firm_id: firmId });
}

// ---------------------------------------------------------------------------
// Comms actions
// ---------------------------------------------------------------------------

export function approveComm(req: CommsApproveRequest): Promise<ActionResult> {
  return post<ActionResult>("/actions/comms/approve", req);
}

export function queueComm(req: CommsQueueRequest): Promise<ActionResult> {
  return post<ActionResult>("/actions/comms/queue", req);
}

export function dismissComm(req: CommsDismissRequest): Promise<ActionResult> {
  return post<ActionResult>("/actions/comms/dismiss", req);
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export function getAuditLog(
  firmId: string,
  opts: { tier?: string; entityType?: string; actor?: string; limit?: number } = {}
): Promise<AuditLogResponse> {
  const params: Record<string, string> = { firm_id: firmId };
  if (opts.tier) params.tier = opts.tier;
  if (opts.entityType) params.entity_type = opts.entityType;
  if (opts.actor) params.actor = opts.actor;
  if (opts.limit != null) params.limit = String(opts.limit);
  return get<AuditLogResponse>("/audit-log", params);
}

// ---------------------------------------------------------------------------
// LEDES export — returns raw text for download
// ---------------------------------------------------------------------------

export async function downloadLedesExport(firmId: string): Promise<void> {
  const res = await fetch(`/api/billing/ledes-export?firm_id=${encodeURIComponent(firmId)}`);
  if (!res.ok) throw new Error(`LEDES export failed: ${res.statusText}`);
  const text = await res.text();
  const blob = new Blob([text], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `strand-okafor-ledes-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Timer HUD
// ---------------------------------------------------------------------------

export function getMatters(firmId: string): Promise<MatterSummary[]> {
  return get<MatterSummary[]>("/matters", { firm_id: firmId });
}

export function normalizeNarrative(req: TimerNormalizeRequest): Promise<TimerNormalizeResponse> {
  return post<TimerNormalizeResponse>("/actions/timer/normalize-narrative", req);
}

export function captureTimerEntry(req: TimerCaptureRequest): Promise<ActionResult> {
  return post<ActionResult>("/actions/timer/capture", req);
}

// ---------------------------------------------------------------------------
// Console UI read endpoints (v1.1.2)
// ---------------------------------------------------------------------------

export function getDeadlinesFull(firmId: string): Promise<RawDeadline[]> {
  return get<RawDeadline[]>("/deadlines", { firm_id: firmId });
}

export function getBudgets(firmId: string): Promise<BudgetUtilizationItem[]> {
  return get<BudgetUtilizationItem[]>("/budgets", { firm_id: firmId });
}

export function getRelationships(firmId: string): Promise<RelationshipMatter[]> {
  return get<RelationshipMatter[]>("/relationships", { firm_id: firmId });
}

export function getInbound(firmId: string): Promise<InboundMessage[]> {
  return get<InboundMessage[]>("/inbound", { firm_id: firmId });
}

export function snoozeInbound(req: InboundSnoozeRequest): Promise<ActionResult> {
  return post<ActionResult>("/actions/inbound/snooze", req);
}

export function dismissInbound(req: InboundDismissRequest): Promise<ActionResult> {
  return post<ActionResult>("/actions/inbound/dismiss", req);
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

export function getDemoReady(): Promise<DemoReadyResponse> {
  return get<DemoReadyResponse>("/demo/ready");
}

export function resetDemo(firmId: string): Promise<DemoResetResponse> {
  return post<DemoResetResponse>("/demo/reset", { firm_id: firmId, confirm: true });
}
