/**
 * API client — all calls to the Litt backend.
 * Base URL: /api (proxied by Vite dev server or served by Cloud Run at the same origin).
 */

import type {
  ActionResult,
  AlertDismissRequest,
  BillingApproveRequest,
  BillingUpdateNarrativeRequest,
  BillingWriteDownRequest,
  BillingWriteOffRequest,
  BriefResponse,
  CommsApproveRequest,
  CommsDismissRequest,
  CommsQueueRequest,
  DeadlineConfirmRequest,
  DeadlineDismissRequest,
  DeadlineExtendRequest,
  DemoReadyResponse,
  DemoResetResponse,
  ScrubberFlag,
  SweepRunResponse,
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
// Demo
// ---------------------------------------------------------------------------

export function getDemoReady(): Promise<DemoReadyResponse> {
  return get<DemoReadyResponse>("/demo/ready");
}

export function resetDemo(firmId: string): Promise<DemoResetResponse> {
  return post<DemoResetResponse>("/demo/reset", { firm_id: firmId, confirm: true });
}
