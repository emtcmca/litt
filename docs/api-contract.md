# Litt — API Contract

**Version:** 1.0  
**Base URL:** `https://litt-backend-[hash].run.app`  
**Auth:** Demo mode — no auth required for `firm_id=strand-okafor`. Production requires bearer token.

All responses are JSON. All write endpoints require `Content-Type: application/json`.

---

## Request Conventions

### Idempotency

Every write endpoint accepts an optional `idempotency_key` (UUID string). If the same key is submitted twice within 24 hours, the second request returns the cached result of the first without re-executing. This prevents double-submit from the UI and retry loops.

### Optimistic Locking

Every state-advancing write endpoint accepts `expected_status`. If the document's current status does not match `expected_status`, the request returns a `409 Conflict` with a structured error.

### Structured Errors

All errors return:

```json
{
  "error": true,
  "error_type": "INVALID_TRANSITION | STALE_STATE | VALIDATION_FAILED | NOT_FOUND | FORBIDDEN | IDEMPOTENCY_HIT",
  "message": "Human-readable description",
  "detail": {}
}
```

Never raise an unhandled exception to the API surface. Tool functions return `ToolResult` (success) or `ToolError` (structured failure). Routes convert `ToolError` to HTTP error responses.

---

## System Endpoints

### `GET /health`
Returns `{"status": "ok", "firm_id": "strand-okafor"}` if the service is alive and Firestore is reachable.

### `POST /api/sweep`
Triggers a coordinator sweep for the firm. Runs all four sub-agents, assembles the brief, writes any new escalations or anomaly records to Firestore.

**Request:**
```json
{
  "firm_id": "strand-okafor"
}
```

**Response:**
```json
{
  "sweep_id": "sweep-uuid",
  "duration_ms": 1240,
  "sections_updated": ["deadlines", "billing", "client_silence", "anomalies"],
  "escalations_created": 1,
  "anomalies_detected": 2
}
```

**Note for v1.0:** Firestore triggers are stubbed. The dashboard calls `POST /api/sweep` manually or Cloud Scheduler triggers it every 4 hours. True event-driven triggers are v1.1.

---

## Brief Endpoints

### `GET /api/brief`
Returns the current Daily Closeout Brief for the firm's attorney.

**Query params:** `firm_id`, `attorney_id`

**Response: `BriefResponse`**
```json
{
  "firm_id": "strand-okafor",
  "firm_name": "Strand & Okafor LLP",
  "attorney_id": "dana-strand",
  "attorney_name": "Dana Strand",
  "generated_at": "2026-05-29T16:30:00Z",
  "demo_mode": true,
  "sections": {
    "deadlines": {
      "items": [BriefDeadlineItem],
      "count": 1,
      "has_critical": true
    },
    "time_entries": {
      "items": [BriefTimeEntryItem],
      "count": 2,
      "total_wip_usd": 770.00
    },
    "budget_risks": {
      "items": [BriefBudgetItem],
      "count": 1
    },
    "client_silence": {
      "items": [BriefClientSilenceItem],
      "count": 1
    },
    "anomalies": {
      "items": [BriefAnomalyItem],
      "count": 2
    }
  },
  "resolved_today": []
}
```

---

## Action Endpoints

All action endpoints follow the same pattern:
- `POST /api/actions/{action_name}`
- Body includes `firm_id`, `attorney_id`, `idempotency_key`, and action-specific fields
- Returns `ToolResult` or `ToolError`
- Every successful action writes to `audit_log`

### Deadline Actions

#### `POST /api/actions/deadline/confirm`
```json
{
  "firm_id": "strand-okafor",
  "attorney_id": "dana-strand",
  "deadline_id": "dl-mercer-001",
  "idempotency_key": "uuid"
}
```

#### `POST /api/actions/deadline/resolve`
```json
{
  "firm_id": "strand-okafor",
  "attorney_id": "dana-strand",
  "deadline_id": "dl-mercer-001",
  "idempotency_key": "uuid"
}
```

#### `POST /api/actions/deadline/extend`
```json
{
  "firm_id": "strand-okafor",
  "attorney_id": "dana-strand",
  "deadline_id": "dl-mercer-001",
  "new_due_date": "2026-06-15",
  "reason": "Court granted extension",
  "idempotency_key": "uuid"
}
```

#### `POST /api/actions/deadline/dismiss`
```json
{
  "firm_id": "strand-okafor",
  "attorney_id": "dana-strand",
  "deadline_id": "dl-mercer-001",
  "reason": "Deadline superseded by settlement",  // REQUIRED — no silent dismissal
  "idempotency_key": "uuid"
}
```

#### `POST /api/actions/deadline/verify`
Activates an unverified deadline candidate.
```json
{
  "firm_id": "strand-okafor",
  "attorney_id": "dana-strand",
  "deadline_id": "dl-candidate-001",
  "confirmed_date": "2026-06-10",
  "classification": "HARD_LEGAL",
  "idempotency_key": "uuid"
}
```

### Billing Actions

#### `POST /api/actions/billing/approve`
```json
{
  "firm_id": "strand-okafor",
  "attorney_id": "dana-strand",
  "entry_id": "te-005",
  "expected_status": "PENDING",  // optimistic lock
  "idempotency_key": "uuid"
}
```

#### `POST /api/actions/billing/update-narrative`
```json
{
  "firm_id": "strand-okafor",
  "attorney_id": "dana-strand",
  "entry_id": "te-005",
  "narrative": "Reviewed and revised vendor MSA redline; analyzed indemnification clauses.",
  "expected_status": "PENDING",
  "idempotency_key": "uuid"
}
```

#### `POST /api/actions/billing/write-down`
```json
{
  "firm_id": "strand-okafor",
  "attorney_id": "dana-strand",
  "entry_id": "te-001",
  "new_hours": 1.0,
  "new_amount": 350.00,
  "reason": "Reducing to reflect actual work time",  // REQUIRED
  "expected_status": "PENDING",
  "idempotency_key": "uuid"
}
```

#### `POST /api/actions/billing/write-off`
```json
{
  "firm_id": "strand-okafor",
  "attorney_id": "dana-strand",
  "entry_id": "te-001",
  "reason": "Administrative error — not billable",  // REQUIRED
  "expected_status": "PENDING",
  "idempotency_key": "uuid"
}
```

#### `GET /api/billing/scrubber/{entry_id}`
Returns pre-bill scrubber results for a single entry.
```json
{
  "entry_id": "te-005",
  "warnings": [
    {
      "type": "NARRATIVE_FORBIDDEN_PHRASE",
      "severity": 4,
      "matched_phrase": "review documents",
      "position_in_narrative": 12,
      "guideline_source": "acme-commercial billing guidelines"
    }
  ],
  "clean": false
}
```

#### `GET /api/billing/budget/{client_id}`
Returns current budget utilization for a client.

#### `POST /api/billing/generate-invoice`
Generates invoice for a client and period. Attorney-initiated only.
```json
{
  "firm_id": "strand-okafor",
  "attorney_id": "dana-strand",
  "client_id": "acme-commercial",
  "period_start": "2026-05-01",
  "period_end": "2026-05-31",
  "idempotency_key": "uuid"
}
```

#### `GET /api/billing/ledes/{invoice_id}`
Returns LEDES 1998B file content as plain text. Attorney-initiated only.

### Client Comms Actions

#### `POST /api/actions/comms/approve`
```json
{
  "firm_id": "strand-okafor",
  "attorney_id": "dana-strand",
  "draft_id": "comm-001",
  "expected_status": "DRAFT_GENERATED",
  "idempotency_key": "uuid"
}
```
**Does not update `last_client_contact`.** Moves to `DRAFT_APPROVED`.

#### `POST /api/actions/comms/queue`
```json
{
  "firm_id": "strand-okafor",
  "attorney_id": "dana-strand",
  "draft_id": "comm-001",
  "channel": "demo_outbox",  // "demo_outbox" | "gmail_draft"
  "expected_status": "DRAFT_APPROVED",
  "idempotency_key": "uuid"
}
```
Moves to `QUEUED_FOR_SEND`. Writes to `DemoDraftOutbox` in v1.0.

#### `POST /api/actions/comms/confirm-sent`
```json
{
  "firm_id": "strand-okafor",
  "attorney_id": "dana-strand",
  "draft_id": "comm-001",
  "sent_at": "2026-05-29T17:05:00Z",
  "expected_status": "QUEUED_FOR_SEND",
  "idempotency_key": "uuid"
}
```
**This is the only action that updates `last_client_contact` on the matter.** Moves to `SENT_CONFIRMED`.

#### `POST /api/actions/comms/dismiss`
```json
{
  "firm_id": "strand-okafor",
  "attorney_id": "dana-strand",
  "draft_id": "comm-001",
  "reason": "Client contacted directly by phone",  // REQUIRED
  "idempotency_key": "uuid"
}
```

### Alert Actions

#### `POST /api/actions/alert/dismiss`
Universal alert dismissal. Works for anomalies, budget alerts, unverified deadlines in the soft queue.
```json
{
  "firm_id": "strand-okafor",
  "attorney_id": "dana-strand",
  "alert_id": "alert-uuid",
  "alert_type": "anomaly",
  "reason": "Reviewed — not a duplicate",  // REQUIRED
  "idempotency_key": "uuid"
}
```

---

## Demo Endpoints

### `GET /api/demo/ready`
Validates that all five demo conditions are present. Run before every recording attempt.

```json
{
  "ok": true,
  "demo_date": "2026-05-29",
  "firm_id": "strand-okafor",
  "checks": {
    "deadline_mercer_escalates": {
      "pass": true,
      "detail": "dl-mercer-001 is HARD_LEGAL, 6 days out, unconfirmed"
    },
    "te_005_scrubber_hit": {
      "pass": true,
      "detail": "te-005 narrative contains 'review documents'"
    },
    "te_001_missing_narrative": {
      "pass": true,
      "detail": "te-001 has no narrative"
    },
    "acme_budget_warn": {
      "pass": true,
      "detail": "acme-commercial at 78% ($11,700 of $15,000)"
    },
    "whitmore_client_silence": {
      "pass": true,
      "detail": "whitmore-employment-2026 last contact 16 days ago"
    }
  }
}
```

### `POST /api/demo/reset`
Deletes all documents under `firms/strand-okafor/` and re-runs the seed script. Returns when Firestore has been fully restored.

```json
{
  "firm_id": "strand-okafor",
  "confirm": true  // safety flag — must be true
}
```

Response:
```json
{
  "ok": true,
  "records_deleted": 47,
  "records_created": 47,
  "duration_ms": 2100
}
```

### `GET /api/demo/state`
Returns a summary of current demo Firestore state for debugging. Shows counts per collection and key field values.

---

## Deep Link Routes (Dashboard)

These are React Router routes, not API endpoints. Email digest links navigate to these paths. Actions are completed inside the authenticated Litt UI, not directly from the email link.

```
/                               → Daily Closeout Brief homepage
/deadline/{id}                  → Opens deadline action modal for {id}
/billing/wip/{entry_id}         → Opens WIP review modal for {entry_id}
/comms/draft/{draft_id}         → Opens client comms draft review modal
/budget/{client_id}             → Opens budget alert panel for {client_id}
/anomaly/{anomaly_id}           → Opens anomaly detail modal
/audit                          → Operational audit log (Tier 2)
/demo/reset                     → Demo reset UI (demo mode only)
```

**Email digest links are deep links to these routes, not action endpoints.** A link like `/deadline/dl-mercer-001` opens the dashboard to the deadline confirmation modal. The attorney clicks Confirm inside Litt. The action is authenticated and audited. No action is executed directly from the email.
