# 04 — Feature Specs (the remaining Console surfaces)

These are **mostly frontend** over data that already exists, plus a few thin read endpoints.
The agent-core features (inbound, commitments, routing, tool-call layer) have their own deep
specs in `03-agent-core/`. This doc covers everything else. For exact look/spacing/copy, the
prototype `console-*.jsx` file named in each section is the spec.

---

## 04·01 — Deadlines hero  *(prototype: `console-deadlines.jsx`)*

The full **book** of every deadline + a 45-day horizon timeline + the escalation cadence
ladder (14·7·3·1). Today the brief returns only *escalating* deadlines; this needs the whole
list.

**New read:** `GET /api/deadlines?firm_id` → all `ACTIVE` deadlines, each enriched with
`days_out` (from effective date) and `escalation_level` (reuse `deadline_agent._CADENCE` /
`_get_escalation_level`). Include `SOFT_INTERNAL` rows linked to commitments (the "promise"
chips). No new write path — confirm/dismiss/extend already exist in `actions.py`.

**UI:** critical callout (the one `UNCONFIRMED` HARD_LEGAL — `dl-mercer-001`), the horizon
timeline with class-colored pins, the filterable book table (All / Needs confirmation /
Court·legal / Owned by you), and the cadence ladder showing which HARD_LEGAL items sit in each
window. "Confirm" deep-links to the closeout/deadline modal. The deterministic note card
("deadline_agent computes days-remaining… no model decides whether a date matters") is true —
keep it.

**Data mapping:** `BriefDeadlineItem` already has `days_out`, `classification`,
`escalation_level`, `is_unconfirmed`, `verification_status`, `court`. The book read returns the
same shape for *all* deadlines.

---

## 04·02 — Policy & autonomy  *(prototype: `console-policy.jsx`)*

The firm-vs-attorney trust dial. Backed by the new `FirmPolicy` / `AttorneyPolicyOverride`
models (doc 02 §3) with **tighten-only** enforcement.

**Endpoints:**
```
GET  /api/policy?firm_id&attorney_id     -> { rules: PolicyRule[], overrides: {rule_id: value} }
POST /api/actions/policy/set             -> ToolResult   # {rule_id, value}; validates tighten-only; audit policy.updated
```

**Enforcement (server-side, deterministic — not cosmetic):**
- `lockable` rules reject any override (firm-locked → always GATED). UI shows "Always gated".
- Threshold overrides must be stricter than the firm floor; looser → `ToolError`. UI `+`
  stepper disables at the floor.
- Effective posture feeds the agents' `commitment_level` choice. A `GATED` action routes to a
  held status; it cannot auto-execute.

**UI:** the dial (count of firm-permitted actions automated → %), the scope banner (firm-admin
vs attorney), per-domain rule rows with the GATED/AUTO segmented control or the tighten-only
stepper, firm-locked pills. Every change posts and writes `policy.updated`.

**Scope note:** the prototype reads `user.scope === 'firm_admin'`. Map to the existing
`Attorney.permission_scope` (`admin` present → firm-admin view). The demo attorney is
`dana-strand` (attorney); `marcus-okafor` is the managing partner (admin).

---

## 04·03 — Relationships / Clients & comms  *(prototype: `console-clients.jsx`)*

Two jobs under one roof. The **inbound triage** half (`03-agent-core/01`) and the
**commitments** half (`03-agent-core/02`) are specified there. This section covers the
**outbound "Going quiet"** half + the page shell, all of which map to existing code.

- **Going quiet** = the existing `comms_agent` silence detection. `BriefClientSilenceItem`
  already carries `days_since_contact`, `threshold_days`, `last_contact_date`, `comm_draft_id`.
  The Whitmore silence draft is an existing `ClientCommunication` in `DRAFT_GENERATED`.
- **Relationship board** = all matters with computed days-since-contact vs the 14-day
  threshold. Read from matters + `last_client_contact` (reuse the silence scan's data; expose
  via the brief section or a small `GET /api/relationships`).
- **Recent communications** log = `ClientCommunication` records by status
  (held / sent / logged). Already in Firestore.
- The dark "How Litt handles your comms" card (Read → Draft → Hold) is the trust story —
  keep verbatim; it's accurate to the architecture.

Page order in the prototype: header → summary strip (Awaiting / Going quiet / Warm) →
**Awaiting your response** (inbound) → **Commitments you've made** → **Going quiet** →
relationship board → comms log + how-it-works. Preserve this order.

---

## 04·04 — Budgets, Anomalies, Integrations  *(prototype: `console-stubs.jsx`)*

**Budgets** — `compute_budget_utilization()` already returns `BudgetUtilization`
(cap, billed, approved_unbilled, total_committed, utilization_pct, WARN/CRITICAL at 75/90).
Add `GET /api/budgets?firm_id` to list it per matter/client. UI: utilization bars with the
75% threshold marker; WARN/CRITICAL pills; the Acme 78% row is the demo anchor. *(Future:
burn-rate forecast — out of scope here; note as a follow-up.)*

**Anomalies** — `anomaly_agent` already runs detectors (round-hours, duplicate, AI-disclosure,
stale-deadline) with scoring overrides; `BriefAnomalyItem` carries the surfaced ones. UI: the
open ELEVATED item (te-001 MISSING_NARRATIVE), the detector roster (mostly display — show
which fired), and "cleared today" entries. Clearing requires a reason → existing
`POST /api/actions/alert/dismiss` (reason required). The prototype shows 13 detectors; the repo
has ~4 in `anomaly_agent` + the prebill scrubber checks — list the real ones; don't invent.

**Integrations** — presentational. Gmail/Calendar = read-only MCP adapters (`ingestion/`,
`mcp_server/`); LEDES export exists (`/api/billing/ledes-export`). "Connect" buttons are stubs.
Emphasize least-privilege/read-only scopes (true and on-brand).

---

## 04·05 — Audit ledger  *(prototype: `console-record.jsx`)*

The dedicated defensibility page. Backed entirely by the existing `audit_log`.

**Read:** `GET /api/audit-log` already exists (`api.ts getAuditLog`, filters by tier/entity/
actor/limit) → `AuditLogEvent[]` with `before_state`/`after_state`. The prototype's in-file
`LEDGER` array maps 1:1 onto these events.

**UI:** dark stat strip (events today / legal-record count / your-decisions vs Litt), tier +
actor filters, rows that expand to **before → after diffs** + metadata (entity, actor, tier,
idempotency_key), and a JSON export (client-side `Blob` from the fetched events). The
new event types from agent-core appear here automatically: `commitment.captured/kept/slipped`,
`policy.updated`, `INBOUND_TRIAGED`, plus existing `COMM_*`, `ESCALATION_SENT`,
`ANOMALY_DETECTED`, `DEADLINE_*`.

**Digest link:** the email digest's "View the ledger" should deep-link to the ledger route
(prototype uses `#record`; in React Router that's the `/audit` route or a new `/ledger`).
`AuditEventDrawer.tsx` already renders a single event — reuse it for the expanded row.

**Tiers** are real: `engineering` / `operational` / `legal_defensibility` (`AuditTier`). The
"Legal record" filter = `tier == legal_defensibility`.

---

## Cross-cutting: the Overview  *(prototype: `console-brief.jsx`)*

The existing `DailyCloseoutBrief.tsx` + `GET /api/brief` is the Overview. Extend
`BriefSections` with `inbound` and `commitments` counts so the Overview surfaces them, and
add the four-section framing (Watch/Collect/Prove/Tune) around the existing brief content.
Everything the brief already computes (deadlines, time entries, budget risks, client silence,
anomalies) stays.
