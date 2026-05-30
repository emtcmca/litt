# Litt — 7-Day Sprint Plan

**Version:** 1.0  
**Author:** Eric Tetzlaff  
**Sprint window:** May 30 – June 5, 2026  
**Submission deadline:** 5:00 PM PT, June 5, 2026  
**Status:** Active — do not revise without logging a change

---

## Sprint Overview

| Day | Date | Focus | Hours | Sprint % |
|-----|------|-------|-------|----------|
| 1 | Fri May 30 | Foundation — GCP setup, Firestore schema, seed data | 8–10 | 14% |
| 2 | Sat May 31 | Tool layer — all deterministic write functions | 10–12 | 28% |
| 3 | Sun Jun 1 | Billing sub-agent + Deadline Monitor sub-agent | 10–12 | 43% |
| 4 | Mon Jun 2 | Client Comms sub-agent + Anomaly Escalation sub-agent | 8–10 | 57% |
| 5 | Tue Jun 3 | React dashboard — Daily Closeout Brief + supporting views | 10–12 | 71% |
| 6 | Wed Jun 4 | Email digest + Cloud Run deployment + architecture diagram | 10–12 | 86% |
| 7 | Thu Jun 5 | Demo video + Devpost written description + submission | 6–8 | 100% |

**Total estimated hours:** 62–76 hours over 7 days.

**Task categories:**

| Symbol | Category |
|--------|----------|
| `[INFRA]` | Infrastructure |
| `[DATA]` | Data layer |
| `[AGENT]` | Agent / AI |
| `[UI]` | UI / Frontend |
| `[DEPLOY]` | Deployment |
| `[DEMO]` | Demo / Video |
| `[SUBMIT]` | Submission |

**`[CRITICAL]`** — Tasks marked critical are on the build's critical path. Nothing downstream works until these are correct. Do not proceed past them without verification.

---

## Day 1 — Friday, May 30

**Focus:** Foundation  
**Hours:** 8–10  
**Theme:** Everything that gets built this week sits on what you do today. No shortcuts.

### GCP Project Setup

- `[INFRA]` **Create Google Cloud project**  
  Enable APIs: Firestore, Cloud Run, Cloud Scheduler, Secret Manager, Gmail, Calendar. Set up billing. Claim the $500 credit.

- `[INFRA]` **Initialize GitHub repo**  
  Public repo at `github.com/emtcmca/litt`. Commit initial README, `.gitignore`, folder structure. First commit must be today — after April 22 per contest rules.

- `[INFRA]` **Service account + secrets**  
  Create service account with Firestore, Cloud Run, Gmail, Calendar scopes. Store credentials in Secret Manager. Never commit to repo.

- `[INFRA]` **Project folder structure**
  ```
  litt/
  ├── agents/
  ├── tools/
  ├── ingestion/
  ├── dashboard/
  ├── scripts/
  ├── docs/
  └── tests/
  ```

### Firestore Schema Initialization

- `[DATA]` `[CRITICAL]` **Write Firestore security rules**  
  `audit_log`: CREATE only, no UPDATE/DELETE. `time_entries`: no DELETE. All other collections: standard CRUD scoped to authenticated service account.

- `[DATA]` **Create collection schemas**  
  `attorneys`, `clients`, `matters`, `time_entries`, `deadlines`, `deadline_events`, `client_communications`, `invoices`, `escalations`, `audit_log` — all per spec Section 15.

- `[DATA]` **Write seed data script**  
  `scripts/seed_demo.py` — populates Strand & Okafor LLP complete: 2 attorneys, 4 clients, 4 matters, 8 time entries (various states), 2 deadlines, budget positions, contact log. Run once, idempotent.

  Seed data must produce:
  - `dl-mercer-001` — HARD_LEGAL deadline at 6 days out, verified, no attorney confirmation (escalation fires)
  - `dl-reyes-001` — HARD_CONTRACTUAL deadline at 11 days out, verified, no confirmation (digest mention)
  - `te-005` — PENDING entry on acme-contract-review containing "review documents" (pre-bill scrubber hit)
  - `te-001` — PENDING entry on mercer-v-dunlap with no narrative (anomaly)
  - Acme Commercial Partners at 78% budget utilization (`WARN` alert status)
  - Whitmore Group with `last_client_contact` 16 days ago (client silence trigger fires)

- `[DATA]` **Validate seed data**  
  Run seed script. Open Firestore console. Verify every collection populated correctly. Fix schema mismatches now — not on Day 4.

> **Day 1 is done when:** repo exists with a first commit, GCP project is live with all APIs enabled, Firestore has the Strand & Okafor seed data, and you can query the `time_entries` and `deadlines` collections from a Python script.

---

## Day 2 — Saturday, May 31

**Focus:** Tool Layer  
**Hours:** 10–12  
**Theme:** The tool layer is the trust boundary of the entire platform. Every agent in the system calls these functions. Get them right before anything else.

### Core Tool Functions — Billing

- `[DATA]` **`write_time_entry(entry)`**  
  Validates schema, 6-min rounding, duplicate detection (same attorney/client/matter/date within 2-hour window). Writes to `time_entries`. Calls `log_audit_event()`.

- `[DATA]` `[CRITICAL]` **`advance_entry_status(entry_id, new_status, reason, attorney_id)`**  
  Hardcoded `VALID_TRANSITIONS` dict. Rejects illegal transitions with structured error (not raised exception). Requires `attorney_confirmed=True` + `confirming_attorney_id` for `PENDING→APPROVED`. Terminal states (`WRITTEN_OFF`, `CLOSED`) reject all transitions.
  ```python
  VALID_TRANSITIONS = {
      "CAPTURED":    ["PENDING"],
      "PENDING":     ["APPROVED", "WRITTEN_OFF"],
      "APPROVED":    ["BILLED", "WRITTEN_OFF"],
      "BILLED":      ["CLOSED"],
      "WRITTEN_OFF": [],
      "CLOSED":      []
  }
  ```

- `[DATA]` **`write_down_entry(entry_id, new_hours, new_amount, reason, attorney_id)`**  
  Requires reason string. Preserves original values in `write_down_record`. Calls `log_audit_event()` with before/after state.

- `[DATA]` **`write_off_entry(entry_id, reason, attorney_id)`**  
  Requires reason string. Moves entry to `WRITTEN_OFF`. Preserves original values. No silent write-offs. Calls `log_audit_event()`.

- `[DATA]` **`compute_budget_utilization(client_id)`**  
  Read-only. Sums APPROVED + BILLED entries for period. Returns utilization object with `alert_status: CLEAR | WARN | CRITICAL`. Called on every sweep and every billing panel load.

- `[DATA]` **`generate_invoice(client_id, period)`**  
  Queries APPROVED entries, groups by matter, computes subtotals and grand total, handles retainer draw-down, writes invoice doc to `invoices` collection, transitions all included entries to `BILLED`, updates client `budget_billed`.

- `[DATA]` `[CRITICAL]` **`export_ledes(invoice_id)`**  
  Maps Litt fields to LEDES 1998B. Field mapping — these are never collapsed into a single field:

  | Litt field | LEDES 1998B field |
  |-----------|-------------------|
  | `task_code` | `LINE_ITEM_TASK_CODE` |
  | `activity_code` | `LINE_ITEM_ACTIVITY_CODE` |
  | `expense_code` | `LINE_ITEM_EXPENSE_CODE` |
  | `attorney.timekeeper_id` | `TIMEKEEPER_ID` |
  | `attorney.timekeeper_classification` | `TIMEKEEPER_CLASSIFICATION` |
  | `hours` | `NUMBER_OF_UNITS` |
  | `rate` | `BILLING_TIMEKEEPER_RATE` |
  | `amount` | `LINE_ITEM_TOTAL` |
  | `narrative` | `LINE_ITEM_COMMENT` |

  Excludes WRITTEN_OFF entries. Flat-fee entries included with tracked hours, arrangement noted in `LINE_ITEM_COMMENT`.

### Core Tool Functions — Deadlines and Comms

- `[DATA]` **`log_deadline_event(deadline_id, event_type, attorney_id, response, notes)`**  
  Append-only write to `deadline_events` collection. `event_type` enum enforced: `ESCALATION_SENT | ATTORNEY_CONFIRMED | ATTORNEY_RESOLVED | ATTORNEY_EXTENDED | ATTORNEY_DELEGATED | DISMISSED_WITH_REASON | BACKUP_NOTIFIED`. Calls `log_audit_event()`.

- `[DATA]` **`verify_deadline(deadline_id, attorney_id, confirmed_date, classification)`**  
  Activates unverified deadline — requires `attorney_id`. Changes `verification_status` from `unverified` to `attorney_verified`. Unverified deadlines cannot fire escalation notifications.

- `[DATA]` **`supersede_deadline(old_id, new_date, attorney_id, reason)`**  
  Creates extension record. Sets `supersedes_deadline_id` on new deadline. Marks old deadline `verification_status: superseded`.

- `[DATA]` **`approve_client_comm_draft(draft_id, attorney_id)`**  
  Records approval. Sets status to `DRAFT_APPROVED`. Does not update `last_client_contact`.

- `[DATA]` **`queue_client_comm_for_delivery(draft_id, channel)`**  
  Moves status to `QUEUED_FOR_SEND`. Routes to Gmail API draft creation.

- `[DATA]` **`log_client_comm_sent(draft_id, sent_at)`**  
  Sets status to `SENT_CONFIRMED`. This is the only function that updates `last_client_contact` on the matter record.

- `[DATA]` **`log_audit_event(event)`**  
  Called by every other tool function — successful or rejected. Writes `tier` (engineering | operational | legal_defensibility), `before_state`, `after_state`, `actor`, `event_type`. Firestore security rules enforce CREATE only.

- `[DATA]` **`dismiss_alert(alert_id, reason, attorney_id)`**  
  Dismisses any alert. Mandatory `reason` string required — no silent dismissal. Writes to `audit_log`.

### Tool Layer Tests

- `[DATA]` `[CRITICAL]` **Unit tests for state machine**  
  Test every valid transition. Test every invalid transition (must return structured error). Test terminal states reject all transitions. Minimum: 14 transition tests.

- `[DATA]` `[CRITICAL]` **Test LEDES field mapping**  
  Generate test invoice. Run `export_ledes()`. Parse output. Assert `task_code` maps to `LINE_ITEM_TASK_CODE` and `activity_code` maps to `LINE_ITEM_ACTIVITY_CODE` as separate fields with correct values.

> **Blocker:** Do not move to Day 3 until `advance_entry_status()` rejects invalid transitions and `export_ledes()` produces separate `task_code` and `activity_code` fields. These are the two most critical correctness requirements in the entire codebase.

---

## Day 3 — Sunday, June 1

**Focus:** Billing Sub-agent + Deadline Monitor Sub-agent  
**Hours:** 10–12  
**Theme:** The two agents that appear most prominently in the demo. Build them fully today.

### ADK Setup

- `[AGENT]` **Install + configure Google ADK**  
  `pip install google-adk`. Set up Vertex AI credentials. Configure Gemini 2.5 Pro as the reasoning model. Verify a basic agent invocation works end-to-end before writing any domain logic.

- `[AGENT]` **Enable ADK observability**  
  Configure ADK's built-in trace exporter to emit structured execution traces to Cloud Trace. This is a config-level addition on the `AdkApp` or `Runner` initialization — not a separate build task. Enables judges (and developers) to visually inspect agent reasoning chains in the GCP console. Required by Track 1 judging criteria ("Agent Observability").

- `[AGENT]` **Coordinator agent skeleton**  
  `agents/coordinator.py` — ADK agent with system prompt injection from firm context document. Routing logic: deadline / billing / comms / anomaly. Escalation brief assembly. Returns structured output — never writes data directly.

### Billing Reconciliation Sub-agent

- `[AGENT]` **Billing sub-agent core**  
  `agents/billing_agent.py` — ADK sub-agent. Reads pending `time_entries` from Firestore. Calls `compute_budget_utilization()` on each sweep. Detects stale PENDING entries (>5 days). Routes budget threshold crossings to coordinator.

- `[AGENT]` `[CRITICAL]` **Pre-bill scrubber**  
  For each PENDING entry, check against client `billing_guidelines`:
  - Forbidden phrase detection in narrative
  - Block billing detection
  - Missing required task codes
  - Missing activity codes when client requires them
  - Round hours with no `session_minutes_actual` (reconstruction flag)
  - Rate deviation from client agreement > 10%
  - Entries exceeding `max_daily_hours_without_review`

  Returns structured warning list — never blocks entry, always surfaces to attorney. Warning + attorney response logged to `audit_log`.

- `[AGENT]` **WIP review workflow**  
  Agent presents PENDING entries grouped by client/matter. Waits for attorney instruction. Routes to `advance_entry_status()` / `write_down_entry()` / `write_off_entry()` only after `attorney_confirmed=True` received from coordinator.

- `[AGENT]` **Budget alert routing**  
  When `compute_budget_utilization()` returns `WARN` or `CRITICAL`, fires coordinator event. Coordinator routes to Client Comms for draft budget notification and surfaces in Daily Closeout Brief.

### Deadline Monitor Sub-agent

- `[AGENT]` **Deadline sub-agent core**  
  `agents/deadline_agent.py` — ADK sub-agent. Reads `deadlines` collection. Computes `days_until_due`. Applies escalation cadence by classification. Only verified deadlines fire escalation notifications.

  Escalation cadence:

  | Classification | Escalation levels |
  |---------------|-------------------|
  | `HARD_LEGAL` | 30d digest · 14d brief+confirm · 7d daily+confirm · 3d 2x daily+confirm · 1d CRITICAL |
  | `HARD_CONTRACTUAL` | 21d digest · 7d brief+confirm · 3d daily+email · 1d email |
  | `SOFT_INTERNAL` | 7d digest · 3d digest · 1d digest |

- `[AGENT]` **Gmail parsing for deadline detection**  
  `ingestion/gmail_parser.py` — OAuth 2.0 `gmail.readonly` scope. Scans emails from opposing counsel + court domains. Gemini extraction for deadline language patterns:
  - "due by [date]"
  - "deadline of [date]"
  - "opposition due [date]"
  - "response required by [date]"
  - "30 days from [date]"
  - "you have [N] days to"

  Returns unverified deadline candidates with `source_type`, `source_excerpt`. Email content not stored — only the extracted excerpt.

- `[AGENT]` **Google Calendar ingestion**  
  `ingestion/calendar_reader.py` — OAuth 2.0 `calendar.readonly` scope. Reads events with deadline keywords ("deadline," "due," "response," "filing," "hearing," "deposition") or `litt:matter:` tags. Configures webhook push channel for real-time updates.

- `[AGENT]` **Deadline confirmation workflow**  
  Escalation surfaces with source excerpt shown. Attorney response options: Confirm / Resolved / Extend (new date) / Delegate (to attorney) / Dismiss with reason. Each response calls `log_deadline_event()` with correct `event_type`. No silent dismissal on `HARD_LEGAL` or `HARD_CONTRACTUAL`.

> **Day 3 is done when:** (1) running the billing agent against seed data shows the pre-bill scrubber flagging `te-005`'s "review documents" narrative, and (2) running the deadline agent shows the HARD_LEGAL escalation for `dl-mercer-001` at 6 days with no prior confirmation.

---

## Day 4 — Monday, June 2

**Focus:** Client Comms Sub-agent + Anomaly Escalation Sub-agent  
**Hours:** 8–10  
**Theme:** Complete the four-agent system. By tonight every branch of the coordinator routing tree has a functioning sub-agent behind it.

### Client Comms Sub-agent

- `[AGENT]` **Comms sub-agent core**  
  `agents/comms_agent.py` — monitors `last_client_contact` per matter. Fires triggers:

  | Trigger | Condition | Default threshold |
  |---------|-----------|-------------------|
  | `DAYS_SINCE_CONTACT` | No confirmed contact for N days | 14 days |
  | `MILESTONE_COMPLETE` | Matter milestone marked complete | Immediate |
  | `BUDGET_THRESHOLD` | Budget crosses 75% or 90% | Immediate |
  | `DEADLINE_APPROACHING` | HARD_LEGAL enters 14-day window | Immediate |
  | `INVOICE_ISSUED` | Invoice generated | Immediate |
  | `ATTORNEY_INITIATED` | Attorney requests draft | Immediate |

- `[AGENT]` `[CRITICAL]` **Source-backed draft generation**  
  Assembles context packet: client profile, matter summary, trigger reason, prior comms log. Prompts Gemini to draft status update with factual claims only — no legal analysis, no strategy, no privileged content. Each factual sentence tagged with source (email / calendar / Firestore record). Unsourced claims become `[ATTORNEY: add detail here]` placeholders. No source → no factual sentence.

- `[AGENT]` **Gmail draft export**  
  On `approve_client_comm_draft()`: calls `queue_client_comm_for_delivery()` which writes draft to Gmail via `gmail.compose` OAuth scope. Attorney reviews in Gmail and sends manually. `log_client_comm_sent()` called on attorney's manual confirmation in Litt.

### Anomaly Escalation Sub-agent

- `[AGENT]` **Billing anomaly detectors**  
  `agents/anomaly_agent.py` — implements all billing pattern detectors:

  | Pattern | Description | Severity | Confidence |
  |---------|-------------|----------|------------|
  | `STALE_PENDING` | Entry in PENDING > 5 days | 2 | 0.95 |
  | `ROUND_HOURS` | Round hours, no `session_minutes_actual` | 3 | 0.70 |
  | `NARRATIVE_ABSENT` | No narrative or < 10 chars | 3 | 0.95 |
  | `NARRATIVE_FORBIDDEN_PHRASE` | Matches client billing guidelines | 4 | 0.90 |
  | `POTENTIAL_DUPLICATE` | Same attorney, client, date, overlapping hours | 5 | 0.85 |
  | `RATE_DEVIATION` | Rate differs > 10% from agreed rate | 4 | 0.90 |
  | `BUDGET_VELOCITY` | Budget exceeded within 14 days at current rate | 4 | 0.80 |
  | `INACTIVE_MATTER` | Active matter, no entries or events in 30+ days | 2 | 0.60 |

- `[AGENT]` **Operational anomaly detectors**

  | Pattern | Description | Severity |
  |---------|-------------|----------|
  | `UNCONFIRMED_DEADLINE` | HARD_LEGAL within 14 days, no attorney confirmation | 5 |
  | `ATTORNEY_UNBILLED_GAP` | Session data exists, no PENDING entries in 5+ days | 3 |
  | `MATTER_NO_DEADLINES` | Active litigation matter, zero deadlines in system | 3 |
  | `INVOICE_OVERDUE` | Invoice issued 30+ days ago, no PAID status | 3 |
  | `RETAINER_BELOW_THRESHOLD` | Retainer balance below configured refill trigger | 4 |

- `[AGENT]` **Escalation scoring + routing**  
  `escalation_score = severity × confidence`. Routing:
  - Score ≥ 4.5 → ELEVATED flag in next Daily Closeout Brief
  - Score ≥ 4.0 (severity 5 only) → CRITICAL flag, immediate brief, backup contact if unacknowledged in 24h
  - Score < 3.0 → weekly anomaly digest only

### Coordinator Integration

- `[AGENT]` **Wire all four sub-agents to coordinator**  
  Coordinator routes signals to correct sub-agents. Parallel execution when multiple triggers on same matter. Unified brief assembled from multiple sub-agent outputs. Pause-and-wait pattern for Level 3 decisions: saves workflow state with `PAUSED_AWAITING_INPUT`, waits for attorney, resumes from saved state on response.

- `[AGENT]` **Scheduled sweep + event-driven triggers**  
  Cloud Scheduler config for 4-hour sweeps during business hours (8 AM–7 PM). Firestore trigger (Cloud Function) for immediate coordinator invocation on document changes — new time entries, budget threshold crossings, new Gmail-parsed deadline candidates.

> **Day 4 integration test:** Run coordinator against seed data. Verify Daily Closeout Brief output contains: HARD_LEGAL deadline escalation for mercer-v-dunlap, `te-005` pre-bill scrubber hit, Whitmore Group 16-day client silence trigger, Acme Commercial 78% budget WARN, and anomaly flag for `te-001` (no narrative, severity 3).

---

## Day 5 — Tuesday, June 3

**Focus:** React Dashboard  
**Hours:** 10–12  
**Theme:** The attorney never sees the agents. They see the dashboard. Build it well — it's 20% of the submission score.

### Dashboard Foundation

- `[UI]` **React app scaffold**  
  `dashboard/` — Create React App or Vite. Configure for Cloud Run deployment. Firestore SDK for real-time listeners. Tailwind CSS. Environment vars for GCP project config.

- `[UI]` **Auth layer**  
  For judging: no-login required — load Strand & Okafor LLP firm context directly. Service account credentials injected server-side via Cloud Run environment variables. Judges access live system without signup or account creation.

### Daily Closeout Brief (Homepage)

- `[UI]` **Brief header + firm display**  
  Firm name, attorney name, date, time of last sweep. Real-time update indicator.

- `[UI]` `[CRITICAL]` **Deadlines section**  
  HARD_LEGAL deadlines first with red badge and days remaining. Source excerpt shown beneath each. Inline actions: Confirm / Extend / Delegate / Dismiss with reason. Dismiss requires text input for reason string — no silent dismissal.

- `[UI]` **Time entries section**  
  Grouped by matter. Pre-bill scrubber warnings inline (flag + specific violation text). Approve button calls `advance_entry_status()` via API. Edit narrative inline. Total WIP value displayed at bottom.

- `[UI]` **Budget risks section**  
  Progress bar per client showing utilization percentage. WARN state (amber) at 75%, CRITICAL (red) at 90%. Draft budget alert button routes to comms review panel.

- `[UI]` **Client silence section**  
  Matters ordered by days since last confirmed contact. Days count displayed. Draft status update button opens comms review panel with source-backed draft.

- `[UI]` **Anomalies section**  
  Scored anomalies displayed with severity badge. ELEVATED and CRITICAL flags highlighted. Link to WIP review for billing anomalies.

- `[UI]` **Completed items collapse**  
  Approved entries, confirmed deadlines, and sent comms collapse to "Resolved today" section at bottom. Count displayed. Real-time update as attorney takes action.

### Supporting Views

- `[UI]` **WIP review panel**  
  Full-page view. All PENDING entries for firm grouped by client/matter. Per entry: Approve / Write down / Write off. Write down and write off both require reason text input. Scrubber findings shown inline.

- `[UI]` **Deadline detail + event history**  
  Per-deadline view: source excerpt, source type, verification status, classification, days remaining. Escalation event timeline — the malpractice defense record.

- `[UI]` **Client comms draft review panel**  
  Draft email with source attribution per sentence (sentence → source document + excerpt). Inline edit. Approve → `approve_client_comm_draft()` → `queue_client_comm_for_delivery()` → Gmail draft. Dismiss with mandatory reason.

- `[UI]` **Deep link routing**  
  Dashboard routes handle incoming deep link params from email digest. `/deadline/confirm/[id]` opens and highlights the specific deadline. `/billing/wip/[entry_id]` opens WIP review scrolled to that entry. `/comms/draft/[draft_id]` opens comms review panel.

> **Day 5 is done when:** Every action in the 2-minute demo script is achievable in 2–3 clicks from the Daily Closeout Brief homepage without navigating away. Run the full demo script against the live dashboard tonight. Fix anything that requires more than 3 clicks.

---

## Day 6 — Wednesday, June 4

**Focus:** Email Digest + Cloud Run Deployment + Architecture Diagram  
**Hours:** 10–12  
**Theme:** Make it real. A deployed system with a live URL is worth more than a perfect local demo.

### Email Digest

- `[UI]` **Email digest template**  
  Plain HTML email, mobile-readable. Replicates Daily Closeout Brief structure in email format. Each section includes deep links: `litt-[hash].run.app/deadline/confirm/[id]`, `/billing/wip/[entry_id]`, `/comms/draft/[draft_id]`, `/budget/[client_id]`.

- `[UI]` **Digest delivery**  
  SendGrid or Gmail API. Triggered by Cloud Scheduler at configured closeout time (default 4:30 PM). Renders current Closeout Brief state at send time. Attorney can clear routine items from email without opening dashboard.

- `[UI]` **Deep link verification**  
  Send test digest. Click each link. Verify dashboard opens to the correct panel with the correct item highlighted.

### Cloud Run Deployment

- `[DEPLOY]` **Containerize agent backend**  
  `Dockerfile` for Python ADK agent backend. Cloud Run service. Environment variables pulled from Secret Manager. Health check endpoint at `/health`. Verify agent can reach Firestore and Gemini API from Cloud Run environment.

- `[DEPLOY]` **Containerize React dashboard**  
  `Dockerfile` for React build, served via nginx. Cloud Run service. Configure CORS for API calls to agent backend service. Verify dashboard loads at Cloud Run URL.

- `[DEPLOY]` **Cloud Scheduler setup**  
  Configure 4-hour sweep job targeting coordinator agent Cloud Run endpoint. Configure daily 4:30 PM digest trigger. Test both fire and return 200.

- `[DEPLOY]` `[CRITICAL]` **Live URL verification**  
  Open deployed URL. Load Strand & Okafor LLP Daily Closeout Brief. Verify all four sections populate from live Firestore. Click Approve on one time entry — verify `advance_entry_status()` writes through tool layer to Firestore. Open Firestore console and confirm `audit_log` entry appears with correct before/after state. This is the end-to-end verification that the entire stack works.

### Architecture Diagram + Pre-submission

- `[SUBMIT]` **Create architecture diagram**  
  `docs/architecture.png` — required by submission rules. Must clearly show:
  - Ingestion layer: Gmail API + Google Calendar API (labeled as MCP-compatible adapter interfaces)
  - MCP connector layer between ADK agents and external adapters — show MCP as the protocol boundary even though v1.0 uses fixture adapters; this is the production-intent design the judges are evaluating
  - Coordinator agent (Gemini 2.5 Pro / ADK)
  - Four sub-agents: Deadline Monitor, Billing Reconciliation, Client Comms, Anomaly Escalation
  - ADK observability → Cloud Trace export path
  - Deterministic tool layer (Python)
  - Firestore collections
  - Attorney interface: React dashboard + email digest
  - All labeled, technology names visible

- `[SUBMIT]` **Verify mandatory technology compliance**  
  - Intelligence: Gemini API via Vertex AI ✓
  - Orchestration: Google ADK ✓
  - Infrastructure: Cloud Run ✓
  - All three required, all three must be demonstrable in the submission

- `[SUBMIT]` **Verify new-project rule compliance**  
  `git log --since='2026-04-22'` — all commits must be after April 22. No code imported from `billing-legal` repo. Litt is net-new per contest rules.

> **Blocker:** Day 6 is deployment day. If Cloud Run is not working by end of Day 6, you have one morning to fix it before submission. Do not leave deployment to Day 7 under any circumstances.

---

## Day 7 — Thursday, June 5

**Focus:** Demo Video + Written Description + Submission  
**Hours:** 6–8  
**Submission hard deadline:** 5:00 PM PT  
**Theme:** Everything you do today serves the 5 PM deadline. Target submission by 4:30 PM.

### Demo Video — Record by Noon

- `[DEMO]` **Run demo dry-run × 3**  
  Practice the 2-minute script until the timing is natural. Know exactly which clicks happen when. Have seed data fully loaded and all sections of the Daily Closeout Brief populated before recording.

- `[DEMO]` `[CRITICAL]` **Record demo video — 2-minute hard cap**  
  Screen + voiceover. Record against live deployed system — not localhost. Follow the script:

  | Timestamp | Action | Voiceover |
  |-----------|--------|-----------|
  | 0:00–0:10 | Blank dashboard | "A solo attorney at a small civil firm ends every day not knowing what slipped. Litt fixes that." |
  | 0:10–0:25 | Daily Closeout Brief appears — Strand & Okafor LLP | "Litt ran autonomously — scanned deadlines, scored billing anomalies, drafted client updates, and assembled this brief. The attorney's job is to review and confirm, not to find what needs doing." [Pause on brief structure — deadline badge, WIP total, budget bar, client silence] |
  | 0:25–0:50 | Click Confirm on HARD_LEGAL deadline. Brief flash of audit_log write in Firestore console. | "Every confirmation is logged. Every escalation is documented. If there's ever a malpractice claim, this is the record." |
  | 0:50–1:15 | Open billing panel for te-005. Pre-bill scrubber warning inline. Edit narrative, approve. Open te-001 (no narrative), add narrative, approve. | "Litt flagged the billing guideline violation before the invoice went out." |
  | 1:15–1:38 | Whitmore Group draft surfaces — 16 days since contact. Source attribution per sentence visible. Attorney approves, draft goes to Gmail. | "The draft is Litt's. The send is the attorney's. Always." |
  | 1:38–1:55 | Architecture diagram — static slide | "Litt. The operational control layer for small law firms." |

  Only the first 2 minutes will be evaluated per contest rules. Stop at 1:55.

- `[DEMO]` **Edit + export video**  
  Export as MP4. Verify audio is clear throughout. Upload to YouTube (unlisted) or Vimeo. Note the URL for Devpost submission.

### Devpost Written Description

- `[SUBMIT]` **Business case section**  
  The problem: malpractice risk from deadline misses, billing reconstruction inaccuracy, AI billing transparency gap (ABA FO 512), client communication lapses, budget blindness. The market: 100,000+ small firms, underserved by enterprise legal tech. The wedge: operational control layer with defensible audit trail — not another chatbot.

  **Autonomous action framing (required — judges score on this):** Explicitly distinguish what Litt does autonomously from what requires attorney confirmation. Autonomous (no human trigger): deadline escalation cadence execution, anomaly detection and scoring, brief assembly, FactPacket construction, source-backed draft generation, budget threshold monitoring, client silence detection. Attorney-confirmed: status state transitions, communication sends, alert dismissals. Frame this as a product strength, not a limitation: *"Litt acts autonomously where the decision is operational. It gates on the attorney where the decision is legal."*

- `[SUBMIT]` **Technical implementation section**  
  ADK multi-agent architecture. Coordinator routing logic and escalation brief assembly. Four sub-agents and their defined scope. Deterministic tool layer rationale — why the LLM cannot write data directly. State machine enforcement in `advance_entry_status()`. Immutable `audit_log` at Firestore security rule level. Gmail + Calendar ingestion with unverified-to-verified deadline flow. Gemini 2.5 Pro via Vertex AI throughout.

  **Three content additions required in this section:**

  1. **MCP paragraph:** "Gmail and Calendar ingestion adapters implement a Model Context Protocol-compatible interface. v1.0 uses seeded fixture adapters for demo reliability; the MCP server endpoints are the v1.1 production path, allowing attorneys to connect their existing Workspace accounts without re-authentication. The adapter boundary is visible in `backend/app/ingestion/`."

  2. **Firestore vs. ADK Memory Bank paragraph:** "Litt uses Firestore for all session and operational state rather than ADK Memory Bank. Legal billing records, deadline confirmations, and audit events require durable, schema-enforced, append-only storage with Firestore security rule enforcement — properties ADK Memory Bank does not provide. The `audit_log` collection is CREATE-only at the Firestore security rule layer, making it tamper-resistant by design."

  3. **ADK Observability paragraph:** "Litt enables ADK's built-in trace exporter to emit structured agent execution traces to Cloud Trace. Every coordinator sweep produces a full execution graph showing which sub-agents were invoked, what Gemini returned, and which tool functions were called — providing a real-time lens into agent reasoning for debugging and audit."

- `[SUBMIT]` **Architecture diagram embed**  
  Embed `docs/architecture.png` in the written description. This is explicitly required by the submission rules.

- `[SUBMIT]` **Findings and learnings section**  
  Required field. Cover: what worked well (ADK routing, state machine enforcement, source-backed draft design, LEDES field separation), what was harder than expected (Gmail OAuth scope configuration, Cloud Run Firestore connectivity, 2-minute demo constraint forcing prioritization), and what v1.1 adds (Gmail sent-event webhook for `SENT_CONFIRMED`, browser extension for session capture, conflict check workflow, Clio/MyCase CSV import).

- `[SUBMIT]` **Third-party disclosures**  
  Required per rules. List: Gmail API, Google Calendar API, Gemini API (via Vertex AI), SendGrid (if used for email digest).

### Final Submission

- `[SUBMIT]` `[CRITICAL]` **Submit on Devpost by 4:30 PM PT**  
  Buffer of 30 minutes before the 5 PM PT hard deadline. Submit:
  - GitHub repo URL (`github.com/emtcmca/litt`) — must be public
  - Demo video URL (YouTube unlisted or Vimeo)
  - Written description with architecture diagram embedded
  - Testing access URL (live Cloud Run URL, no login required for judges)
  - Track selection: Track 1 — Build (Net-New Agents)
  - Region: AMERS

- `[SUBMIT]` **Verify submission confirmation**  
  Confirm Devpost shows submission received. Screenshot the confirmation page. Done.

> **Final rule:** If anything is still broken at 9 AM on Day 7, make a hard call — cut the feature, not the submission. A deployed system with three working branches beats a perfect local system that never got submitted.

---

## Critical Path Summary

The following tasks must be completed in order. Each one blocks everything that comes after it.

1. **Day 1:** Firestore security rules locked (audit_log CREATE-only). Seed data script validated against live Firestore.
2. **Day 2:** `advance_entry_status()` rejects invalid transitions with structured error. `export_ledes()` produces separate `LINE_ITEM_TASK_CODE` and `LINE_ITEM_ACTIVITY_CODE` fields.
3. **Day 3:** Billing sub-agent pre-bill scrubber flags `te-005`. Deadline sub-agent fires escalation on `dl-mercer-001`.
4. **Day 4:** Coordinator integration test passes — all four sections of the Daily Closeout Brief populate from seed data.
5. **Day 5:** Full demo script runnable in under 2 minutes from dashboard homepage.
6. **Day 6:** Live URL working. `advance_entry_status()` call from dashboard writes through tool layer to Firestore and `audit_log`.
7. **Day 7:** Video recorded and exported by noon. Submitted on Devpost by 4:30 PM PT.

---

## Technology Stack Reference

| Layer | Technology | Mandatory |
|-------|-----------|-----------|
| Intelligence | Gemini 2.5 Pro via Vertex AI | Yes — contest rule |
| Orchestration | Google Agent Development Kit (ADK) | Yes — contest rule |
| Infrastructure | Cloud Run | Yes — contest rule |
| Persistence | Firestore | No — but specified in arch |
| Calendar ingestion | Google Calendar API (read-only) | No — v1.0 feature |
| Email ingestion + draft | Gmail API (readonly + compose) | No — v1.0 feature |
| Frontend | React | No — specified in arch |
| Email digest | SendGrid or Gmail API | No — v1.0 feature |
| Scheduling | Cloud Scheduler | No — v1.0 feature |
| Secrets | Google Secret Manager | No — security best practice |
| Logging | Cloud Logging + Cloud Trace | No — observability |

**Note:** Claude (Anthropic API) is used for build tooling, spec work, and sprint planning only. It does not appear in the submitted product. All agent reasoning in Litt runs on Gemini 2.5 Pro via Vertex AI per contest requirements.

---

## v1.1 Roadmap (Stated in Submission)

Features excluded from v1.0 for scope, explicitly called out in the Devpost written description as the v1.1 path:

- New matter intake + conflict precheck workflow
- CSV import from Clio, MyCase, PracticePanther, Smokeball
- Outlook / Microsoft 365 Calendar and Mail integration
- Gmail sent-event webhook for automated `SENT_CONFIRMED` on delivery
- Browser/desktop session time capture with activity log
- Client portal — attorney-approved monthly status reports
- Push notifications for CRITICAL escalations
- QuickBooks / accounting integration for A/R reconciliation
- Court docket integration (PACER, state court systems)
- Agent Engine Runtime migration (from Cloud Run)
- A2A protocol implementation for Track 3 / Cloud Marketplace readiness

---

*End of sprint plan.*

*Next step: Day 1 — GCP project setup and Firestore schema initialization.*
