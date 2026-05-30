# OpsCounsel — Platform Specification

**Version:** 0.1 — Pre-Build  
**Author:** Eric Tetzlaff  
**Status:** Working spec — not for distribution  
**Last updated:** May 29, 2026

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [What OpsCounsel Is](#2-what-opscounsel-is)
3. [Who It's For](#3-who-its-for)
4. [Why It Matters](#4-why-it-matters)
5. [Platform Architecture — 1,000-Foot View](#5-platform-architecture--1000-foot-view)
6. [The Coordinator Agent](#6-the-coordinator-agent)
7. [Branch 1 — Deadline Monitor Sub-agent](#7-branch-1--deadline-monitor-sub-agent)
8. [Branch 2 — Billing Reconciliation Sub-agent](#8-branch-2--billing-reconciliation-sub-agent)
9. [Branch 3 — Client Comms Sub-agent](#9-branch-3--client-comms-sub-agent)
10. [Branch 4 — Anomaly Escalation Sub-agent](#10-branch-4--anomaly-escalation-sub-agent)
11. [The Deterministic Tool Layer](#11-the-deterministic-tool-layer)
12. [Data Architecture](#12-data-architecture)
13. [Human-in-the-Loop Design](#13-human-in-the-loop-design)
14. [Trust and Guardrail Architecture](#14-trust-and-guardrail-architecture)
15. [The Observability Layer](#15-the-observability-layer)
16. [Hackathon Submission Strategy](#16-hackathon-submission-strategy)
17. [What OpsCounsel Explicitly Does Not Do](#17-what-opscounsel-explicitly-does-not-do)
18. [Open Questions Before Build](#18-open-questions-before-build)

---

## 1. The Problem

Small law firms — practices with two to fifteen attorneys — run on institutional knowledge, personal relationships, and a remarkable tolerance for operational chaos. The senior partner knows which client is approaching their budget cap. The office administrator remembers which case has a filing deadline on the fourteenth. The associate tracks her time in a spreadsheet she updates at the end of the week, from memory.

This is not a technology failure. It's a staffing model that was designed before AI made it economically viable to instrument every corner of a professional services practice. The problem is that the model has known failure modes — deadline misses, billing reconstruction errors, client communication gaps, budget overruns that don't get caught until the invoice goes out — and those failure modes have specific legal and financial consequences.

**Missed deadlines** — In civil litigation, a missed statute of limitations or a blown response deadline is not a recoverable mistake. It's a malpractice claim. The ABA Standing Committee on Ethics and Professional Responsibility estimates that calendar and deadline management failures account for the single largest category of malpractice claims filed against small firms.

**Billing reconstruction** — Most time entry in small firms is reconstructed, not captured in real time. An attorney finishes a two-hour document review session, switches to a client call, handles an internal matter, then logs time at the end of the day or — more often — at the end of the week. The narrative is approximate. The hours are estimated. The task codes are assigned from memory. The billing reviewer at a corporate legal department who pulls the LEDES file and sees "L200 — reviewed documents, 3.2h" knows exactly what they're looking at: a reconstructed entry.

**Client communication gaps** — Clients want status. Small firms are often too busy to proactively send it. The result is that clients call for updates, attorneys get interrupted, and the relationship degrades — not because the work is bad, but because the communication cadence is missing.

**Budget blindness** — Corporate clients and insurance-assigned counsel work under matter budgets. Small firms frequently don't have a real-time view of where they stand relative to those budgets — which means the first signal the client gets that the budget is at risk is the invoice.

None of these are hard problems to solve with the right instrumentation. They are hard problems to solve with a two-person support staff and a practice management system designed in 2012.

**The gap OpsCounsel closes:** An autonomous operations layer that runs continuously, watches the things attorneys don't have time to watch, and surfaces the right information to the right person at the right moment — before the deadline, before the budget overrun, before the communication gap becomes a relationship problem.

---

## 2. What OpsCounsel Is

OpsCounsel is an autonomous AI operations agent for small law firm practice management. It is not a chatbot. It is not a document analyzer. It is not a practice management system.

It is an **always-on operational intelligence layer** that sits between the firm's existing data — calendar, matter files, billing records, client contacts — and the attorneys who need to act on it. It monitors continuously, reasons about what it observes, and takes autonomous action within a defined, attorney-approved envelope. When it encounters a decision that requires attorney judgment, it escalates with a structured brief — not a raw data dump — and waits for a response before proceeding.

The platform is built on Google's Agent Development Kit (ADK), deployed on Vertex AI, and backed by Firestore for persistent state. It is designed to be multi-attorney from the first day of deployment, with firm-level configuration and per-attorney permission scopes.

**What it does autonomously:**
- Monitors matter calendars for approaching deadlines and escalates before the threshold
- Tracks billing entry completeness and alerts on stale, missing, or reconstructed-looking entries
- Computes budget utilization per client and matter in real time, alerting on threshold crossings
- Detects anomalies in the time register — double-billing patterns, suspiciously round hour entries, narrative-less pending items — and flags them before they reach invoice
- Drafts client status update communications for attorney review when a matter crosses a configured trigger (days since last client contact, milestone completion, budget threshold)
- Generates invoice exhibit drafts and LEDES 1998B files from the approved time register

**What it always routes to an attorney:**
- Any billing entry approval or write-down decision
- Any client communication before it goes out
- Any deadline that is within a configurable critical window
- Any anomaly that meets the escalation threshold
- Any budget conversation with a client

**What it never does:**
- Send a communication to a client without attorney approval
- Write a billing entry to the time register without attorney review at `wip-review`
- Advance a billing entry from `pending` to `approved` without explicit attorney sign-off
- Give legal advice
- Access matter files without a logged, justified read operation

---

## 3. Who It's For

### Primary User: The Small-Firm Attorney

Two to fifteen attorneys. Likely a general civil practice, or a focused practice in one of: commercial litigation, employment, real estate, estate planning, or insurance defense. Billing rates between $200 and $600/hour. Clients that include a mix of individuals, small businesses, and corporate legal departments.

This attorney knows their craft. They are not interested in learning a new software platform. They want the operational noise handled so they can focus on the actual legal work. They are comfortable with email and calendar. They are skeptical of AI in their practice and will only trust a system that is transparent about what it did, why it did it, and what it wants them to approve.

**Key motivation:** Not getting blindsided. By a deadline. By a budget overrun. By a client who feels ignored.

### Secondary User: The Firm Administrator

The person — often the attorney themselves in a solo or two-person shop — who handles billing reconciliation, client invoicing, and calendar maintenance. Their job is to make sure the firm gets paid accurately and on time, that clients are billed correctly, and that the attorneys know what's coming up.

**Key motivation:** Not spending Friday afternoon reconstructing a month of time entries, chasing attorneys for narratives, and manually computing budget utilization across twelve active matters.

### Tertiary User: The Corporate Legal Client

Not a direct user of the platform, but a beneficiary of its outputs. Corporate legal departments increasingly require LEDES 1998B formatted invoices for e-billing system submission, AI billing transparency disclosures, and granular activity audit trails as a condition of invoice acceptance.

**Key motivation:** Confidence that what they're being billed for reflects real work. The activity audit trail in OpsCounsel's billing module directly addresses this.

---

## 4. Why It Matters

### The Legal Malpractice Angle

Deadline monitoring in civil litigation is not a nice-to-have. It is a risk management system. The ABA and virtually every state bar's professional rules require competent calendar management. A firm that can demonstrate that it runs an automated, documented, escalation-tracked deadline monitoring system has a defensible position in a disciplinary proceeding that a firm running on a shared Outlook calendar does not.

OpsCounsel's deadline monitor is not just operationally useful — it's a malpractice defense artifact.

### The AI Billing Transparency Angle

As AI-assisted legal work becomes standard, bar associations are issuing guidance on what attorneys may ethically bill for AI time. The ABA Formal Opinion 512 (2024) and a growing number of state-level opinions ask three specific questions: Was the time genuinely spent? Is the rate reasonable given AI assistance? Were efficiency gains passed through?

OpsCounsel answers all three questions with data. The `ai_cost_usd` field in every billing entry captures the actual model cost of the AI session. The `session_minutes_actual` field captures the genuine time spent. The `activity_log` captures what was done. The invoice exhibit can include a collapsed audit trail that shows billing reviewers exactly what files were touched and when.

This is not a feature that competes with other legal billing software. No other legal billing software does it. It exists because the regulatory environment created a demand for it and nobody built the supply.

### The Reachability Angle

The enterprise legal tech market — Clio, MyCase, PracticePanther, Filevine — is building AI features on top of practice management infrastructure that costs $50–$200/month per user and requires significant onboarding investment. Small firms, especially solo and two-person shops, are underserved by that market because the onboarding cost is too high relative to the value delivered at that scale.

OpsCounsel is designed to deploy alongside whatever the firm already uses. It reads from calendar data, connects to existing matter structures, and writes to a billing register that is itself a flat YAML file — or, at scale, a Firestore collection. There is no practice management system to replace. There is no six-month implementation. There is a `cold-start-interview` and a Google Cloud project.

---

## 5. Platform Architecture — 1,000-Foot View

OpsCounsel is a **multi-agent system** built using Google's Agent Development Kit (ADK). The architecture follows a coordinator-subagent pattern: one orchestrator agent receives all inputs, reasons about what is being requested or observed, and delegates to specialized sub-agents. The sub-agents execute within their defined scope and return results to the coordinator, which synthesizes and routes outputs — either to the attorney interface or to the deterministic tool layer.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ATTORNEY INTERFACE                             │
│            (Web UI · Email digest · Push notification)              │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ escalations · approvals · drafts
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   COORDINATOR AGENT (Gemini)                        │
│   Receives: scheduled triggers, incoming data events, attorney      │
│   inputs. Reasons about routing. Never writes data directly.        │
│   Maintains: agent conversation history, escalation state,          │
│   firm-wide context window.                                         │
└──────┬──────────┬──────────┬──────────┬──────────────────────────┘
       │          │          │          │
  ┌────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌──▼──────────────┐
  │Deadline│ │Billing │ │Client  │ │Anomaly          │
  │Monitor │ │Recon   │ │Comms   │ │Escalation       │
  │Agent   │ │Agent   │ │Agent   │ │Agent            │
  └────┬───┘ └───┬────┘ └───┬────┘ └──┬──────────────┘
       │         │          │          │
       └────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│               DETERMINISTIC TOOL LAYER (Python)                     │
│  All state writes happen here — no LLM writes data directly        │
│                                                                     │
│  write_time_entry()      advance_entry_status()                     │
│  generate_invoice()      export_ledes()                             │
│  log_deadline_event()    log_escalation()                           │
│  send_draft_to_review()  compute_budget_utilization()               │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                   │
│   Firestore collections: matters · time_entries · deadlines ·       │
│   escalations · clients · attorneys · invoices · audit_log          │
└─────────────────────────────────────────────────────────────────────┘
```

### Execution Model

OpsCounsel runs in two modes:

**Scheduled sweep mode** — A Cloud Scheduler job triggers the coordinator agent on a configurable cadence (default: every 4 hours during business hours). The coordinator pulls current state from Firestore, runs sub-agents against it, and either resolves issues autonomously or queues escalations for the next attorney review window.

**Event-driven mode** — Specific data changes trigger immediate coordinator invocation. A new matter being created, a billing entry being submitted, a calendar event being added — each fires a Firestore trigger that wakes the coordinator for a focused evaluation pass.

The coordinator never blocks the attorney interface. Escalations are queued and delivered as a digest unless the escalation is in the critical window, in which case a push notification fires immediately.

---

## 6. The Coordinator Agent

### Role

The coordinator is the single entry point for all data inputs and all routing decisions. It does not do deep domain work — that belongs to the sub-agents. Its job is to understand what is happening, decide which sub-agent is the right tool, frame the task correctly, receive results, and decide whether to act autonomously or escalate to an attorney.

### System Prompt Design

The coordinator's system prompt is a firm-level CLAUDE.md equivalent — the firm's operational profile, attorney roster, active matter list (as metadata, not full content), billing configuration, escalation thresholds, and communication preferences. This document is generated at `cold-start` and updated via the `customize` skill. It is injected into the coordinator's context window on every invocation.

The system prompt covers:
- Firm identity and practice area(s)
- Attorney profiles: slug, name, default rate, seniority, areas of responsibility
- Active matters: slug, client, matter type, status, assigned attorneys, budget cap, budget used
- Escalation thresholds: deadline windows, budget percentages, stale billing thresholds
- Communication preferences: digest cadence, escalation channel (email, UI), draft approval workflow
- Autonomy envelope: what the coordinator may do without asking; what always requires attorney confirmation

### Routing Logic

The coordinator evaluates each incoming signal against a routing decision tree:

```
Signal received
│
├── Is this a deadline-related signal?
│   └── → Deadline Monitor Agent
│
├── Is this a billing or WIP signal?
│   └── → Billing Reconciliation Agent
│
├── Is this a client communication trigger?
│   └── → Client Comms Agent
│
├── Is this an anomaly or pattern detection signal?
│   └── → Anomaly Escalation Agent
│
└── Is this an attorney input (approval, rejection, instruction)?
    └── → Resume the paused workflow that requested it
```

Signals can trigger multiple sub-agents. A matter approaching a deadline that also has pending unbilled time and no recent client contact triggers Deadline Monitor + Anomaly Escalation (stale billing) + Client Comms in parallel, with the coordinator assembling a unified brief for the attorney rather than three separate notifications.

### Escalation Assembly

When the coordinator decides an escalation is required, it does not send raw sub-agent output to the attorney. It synthesizes a **structured brief** with these components:

1. **What's happening** — One sentence. The specific situation.
2. **Why it matters** — Risk level (CRITICAL / ELEVATED / ROUTINE), deadline, financial exposure, or relationship implication.
3. **What OpsCounsel has already done** — Any autonomous actions already taken (e.g., logged a deadline event, drafted a communication, flagged an anomaly).
4. **What the attorney needs to decide** — The specific decision, with the options pre-populated where possible.
5. **Deadline for the decision** — If the escalation has a time constraint, it's stated explicitly.

The attorney responds via the UI or by email reply. The response is parsed, the workflow resumes, and the outcome is logged to the audit trail.

---

## 7. Branch 1 — Deadline Monitor Sub-agent

### Purpose

Track every date-sensitive obligation across all active matters. Surface approaching deadlines before they become crises. Maintain a documented escalation chain so that the firm can demonstrate, after the fact, that the deadline was being monitored and that an attorney was notified.

### Trigger Sources

- Matter calendar events tagged with deadline type (court filing, statute of limitations, response deadline, deposition, contract expiry, regulatory filing)
- Manual deadline entry via the attorney interface
- Future: calendar integration via Google Calendar API or iCal feed

### Deadline Classification

Every deadline in the system carries a classification that determines its escalation behavior:

| Class | Description | Example | Consequence of Miss |
|-------|-------------|---------|---------------------|
| `HARD_LEGAL` | Court-imposed or statute-defined, no discretion | SOL, response deadline, filing deadline | Malpractice, case dismissal |
| `HARD_CONTRACTUAL` | Contract-defined, client-facing | Contract expiry, option exercise window | Client harm, breach claim |
| `SOFT_INTERNAL` | Firm-set milestone, no external consequence | Draft review, internal approval | Workflow disruption |
| `ADMINISTRATIVE` | Regulatory or licensing | Bar dues, trust account reports | Regulatory risk |

Classification is assigned at deadline creation. `HARD_LEGAL` deadlines receive the most aggressive escalation cadence and the most prominent notification treatment.

### Escalation Cadence by Classification

**HARD_LEGAL:**
- 30 days out: routine digest mention
- 14 days out: dedicated escalation brief, confirmation required
- 7 days out: daily digest + push notification, confirmation required
- 3 days out: push notification twice daily, confirmation required each day
- 1 day out: CRITICAL push notification, coordinator pauses all non-critical activity on that matter and surfaces the deadline as the only item

**HARD_CONTRACTUAL:**
- 21 days out: routine digest mention
- 7 days out: dedicated escalation brief
- 3 days out: daily digest + push notification
- 1 day out: push notification

**SOFT_INTERNAL / ADMINISTRATIVE:**
- 7 days out: digest mention
- 3 days out: digest mention
- 1 day out: digest mention

### Confirmation and Snooze Model

Every escalation for a `HARD_LEGAL` or `HARD_CONTRACTUAL` deadline requires an explicit attorney response. The options are:

- **Confirm** — I know about this. Keep monitoring. No action needed.
- **Resolved** — This deadline has been met. Close it.
- **Delegate** — Route this to [attorney name].
- **Extend** — The deadline has been extended. New date: [date]. (Triggers an audit log entry recording the extension and who confirmed it.)
- **Escalate** — I need help. Flag this to [senior attorney or outside counsel].

A deadline in `HARD_LEGAL` classification that has not received an attorney confirmation within 24 hours of the 7-day trigger fires a secondary notification to the firm's configured backup contact (senior partner, office administrator, or second attorney).

There is no snooze on `HARD_LEGAL` deadlines within 3 days.

### Audit Trail

Every escalation event — trigger fired, notification sent, attorney response received, outcome logged — writes a dated record to the `deadline_events` Firestore collection. The record includes the deadline ID, the escalation level, the timestamp, the attorney who responded, and their response. This collection is read-only from the attorney interface. It exists to produce a timeline that can be introduced as evidence of reasonable deadline monitoring practices.

### Outputs

- Structured brief to coordinator (which routes to attorney interface or digest)
- `deadline_event` record to Firestore (via `log_deadline_event()` tool function — deterministic, no LLM involvement)
- Optional: calendar entry (future feature, requires calendar integration)

---

## 8. Branch 2 — Billing Reconciliation Sub-agent

### Purpose

Maintain a clean, complete, attorney-approved time register across all matters. Capture time accurately as close to the work as possible. Surface discrepancies before they reach the invoice. Generate invoice exhibits and LEDES files when the billing period closes. Track what AI-assisted work actually cost and what it was billed at.

This branch is the direct port and evolution of the `billing-legal` plugin. The logic, data model, state machine, and guardrail design all come from that codebase. The execution environment changes — from local PowerShell hooks to cloud-deployed Python ADK tools — but the behavioral contracts are preserved.

### State Machine

Every time entry in the system exists in one of five states:

```
[CAPTURED] → [PENDING] → [APPROVED] → [BILLED] → [CLOSED]
                ↓
           [WRITTEN_OFF]
```

**CAPTURED** — Session has ended; session time has been recorded by the session hook. No attorney interaction yet. The entry exists as a raw duration record with matter association and activity log.

**PENDING** — Attorney has reviewed the session panel, added a narrative and task code, and confirmed the hours. The entry is in the time register and visible in `wip-review`. It has not been approved for invoicing.

**APPROVED** — The attorney has run `wip-review` and explicitly approved this entry. It is eligible to appear on an invoice. No further modification is possible without creating a new entry or a write-down record.

**BILLED** — The entry has been included in a generated invoice exhibit. `invoice_id` is populated. The entry is locked.

**CLOSED** — Invoice has been paid or the matter has been closed. Entry is archived.

**WRITTEN_OFF** — The attorney wrote off this entry during `wip-review`. The original amount is preserved; a `write_off_record` is appended with reason, date, and attorney. The effective billing amount is $0.

### Session Time Capture

In the claude-for-legal plugin, session time was captured via `UserPromptSubmit` and `Stop` hooks in Claude Code — PowerShell scripts that created and read timer files on the local filesystem.

In OpsCounsel, session time capture works differently because the context is a cloud agent, not a local code editor. Two capture modes are supported:

**Manual entry** — The attorney submits time via the attorney interface. The form presents: client/matter selection, date, hours (decimal or minutes), task code, narrative. On submit, `write_time_entry()` is called with `status: PENDING`. This is the primary capture mode in v1.0.

**Assisted capture (v1.1)** — A lightweight browser extension or desktop app records active work time per matter and presents a billing panel at session end, identical in behavior to the claude-for-legal plugin panel. This sends a structured payload to the OpsCounsel API, which calls `write_time_entry()` server-side. The `activity_log` field is populated by the extension.

### Billing Panel (Attorney Interface)

When an attorney completes a work session with an active matter, the interface surfaces a billing panel in their next interaction with OpsCounsel. The panel shows:

```
BILLING PANEL — Acme Corp / acme-msa-2026
─────────────────────────────────────────
Session: 46 min → 0.8h (6-min increment rounding applied)
Alice Jones · $350/hr → $280.00
Budget: $6,400 of $15,000 used (43%)
AI cost this session: $0.14
─────────────────────────────────────────
Documents touched:
· vendor-nda-redline.docx (edited ×2)
· acme-markup-notes.md (created)
· acme-msa-background.pdf (read)
─────────────────────────────────────────
Narrative (required):
> [attorney types here]

Task code: [L200 ▾]   [Log entry]  [Skip]  [Switch matter]
```

The billing panel does not submit anything until the attorney presses **Log entry**. The call to `write_time_entry()` happens only on that action. If the attorney presses **Skip**, the session is recorded as non-billable with a `skipped: true` flag — not silently discarded. Skipped sessions are visible in the billing report for review.

### WIP Review

`wip-review` is the hard gate. No entry moves from `PENDING` to `APPROVED` without passing through it.

The sub-agent presents pending entries grouped by client and matter. For each entry, the attorney can:

- **Approve** — `advance_entry_status(entry_id, APPROVED)`
- **Write down** — Reduce hours or amount. Requires a reason string. Creates a `write_down_record`. The original values are preserved.
- **Write off** — Zero the entry. Requires a reason string. Entry moves to `WRITTEN_OFF`.
- **Edit narrative** — Correct the text without changing hours or amount. Logged as a narrative amendment.
- **Edit task code** — Correct the UTBMS code.

The sub-agent cannot approve entries. It can present them, explain them, flag anomalies within them (via Anomaly Escalation), and record attorney responses. The `advance_entry_status()` call is only made after receiving an explicit attorney instruction.

### Budget Tracking

Budget utilization is computed in real time by `compute_budget_utilization()`. The function reads the client profile (budget cap, budget billed to date), sums all `APPROVED` and `BILLED` entries for the period, and returns a utilization object:

```python
{
  "client": "acme-corp",
  "budget_cap": 15000,
  "billed_to_date": 6820,
  "approved_unbilled": 1240,
  "total_committed": 8060,
  "utilization_pct": 53.7,
  "alert_threshold_1": 75,    # configurable
  "alert_threshold_2": 90,    # configurable
  "alert_status": "CLEAR"     # CLEAR | WARN | CRITICAL
}
```

When `alert_status` crosses a threshold, the sub-agent fires a coordinator event that routes to the attorney with a budget brief and a draft client notification (via Client Comms) for attorney review.

### Invoice Generation

When the billing period closes and `wip-review` has been completed for a client, the attorney runs invoice generation. The sub-agent calls `generate_invoice()` with the client slug and period. The function:

1. Queries Firestore for all `APPROVED` entries for the client in the period
2. Groups entries by matter
3. Computes subtotals, retainer draw-down (if applicable), and grand total
4. Writes a Markdown invoice exhibit to the `invoices` Firestore collection
5. Updates all included entries to `BILLED` with the `invoice_id`
6. Updates the client profile's `budget_billed` field

The resulting document is available in the attorney interface for download or copy.

### LEDES 1998B Export

After invoice generation, `export_ledes()` transforms the invoice data into a pipe-delimited LEDES 1998B file. The function maps:

- `attorney.timekeeper_id` → `TIMEKEEPER_ID`
- `attorney.timekeeper_classification` → `TIMEKEEPER_CLASSIFICATION`
- `entry.task_code` → `ACTIVITY_CODE` (UTBMS)
- `client.ledes_client_id` → `CLIENT_ID`
- `entry.hours` → `NUMBER_OF_UNITS`
- `entry.rate` → `BILLING_TIMEKEEPER_RATE`
- `entry.amount` → `LINE_ITEM_TOTAL`
- `entry.narrative` → `LINE_ITEM_COMMENT`

Write-off entries are excluded. Flat-fee entries are included with tracked hours and the arrangement noted in `LINE_ITEM_COMMENT`.

### AI Cost Tracking

Every time entry captures `ai_cost_usd` — the actual model API cost for the session that generated the work. This field is populated by the session hook (or estimated from token usage data in the API response in the browser extension).

The billing report surfaces AI cost as a line item alongside billable hours, enabling the attorney to answer the ABA's efficiency-gains question with data rather than assertion.

---

## 9. Branch 3 — Client Comms Sub-agent

### Purpose

Ensure no client goes more than a configurable number of days without contact on an active matter. Draft the status update so the attorney doesn't have to start from a blank page. Never send anything without attorney review and explicit approval.

This is a **draft generation and delivery management** agent. It does not communicate with clients directly. It manages the pipeline from trigger to approved outbound communication.

### Trigger Conditions

The sub-agent fires when any of the following conditions are true for an active matter:

| Trigger | Condition | Default Threshold |
|---------|-----------|-------------------|
| `DAYS_SINCE_CONTACT` | No logged client contact for N days | 14 days |
| `MILESTONE_COMPLETE` | A matter milestone has been marked complete | Immediate |
| `BUDGET_THRESHOLD` | Budget utilization crosses 75% or 90% | Immediate |
| `DEADLINE_APPROACHING` | A `HARD_LEGAL` deadline enters the 14-day window | Immediate |
| `INVOICE_ISSUED` | An invoice has been generated and needs transmission | Immediate |
| `ATTORNEY_INITIATED` | Attorney explicitly requests a draft | Immediate |

All thresholds are configurable per firm and per client.

### Draft Generation

When a trigger fires, the sub-agent receives a context packet from the coordinator containing:
- Client profile (name, billing contact, relationship notes)
- Matter summary (status, recent activity, upcoming deadlines, budget position)
- Trigger reason (which condition fired and why)
- Tone guidance from the firm's CLAUDE.md (formal vs. relationship-driven, attorney's communication style)
- Prior communications log (last N communications with this client, summaries only — not full content)

The sub-agent drafts a status update email using this context. The draft is:
- Written in the attorney's configured communication style
- Specific to the matter and the trigger condition
- Free of legal advice (the sub-agent is explicitly prompted to surface facts and status, not analysis or conclusions)
- Formatted for the attorney to review and modify before sending

The draft is surfaced in the attorney interface with:
- The trigger reason displayed prominently
- The draft body editable inline
- An **Approve and send** action (queues for sending via configured email integration)
- A **Edit** action (opens full draft editor)
- A **Discard** action (logged as suppressed with reason)

### Approved Communication Logging

When the attorney approves a draft, `send_draft_to_review()` is called. This function:
1. Logs the communication to the `client_communications` Firestore collection with status `APPROVED`
2. Updates the matter's `last_client_contact` timestamp
3. Routes the email to the configured send mechanism (direct SMTP, Gmail API, or clipboard copy for manual send)
4. Resets the `DAYS_SINCE_CONTACT` counter for that matter

The sub-agent does not manage the actual email send in v1.0. The attorney sends the approved draft from their own email client. The logging and counter reset happen on approval, not on confirmed delivery. (v1.1 adds delivery confirmation via Gmail API.)

### What the Sub-agent Does Not Do

- Draft communications that contain legal strategy, legal advice, or attorney-client privileged analysis
- Send anything to a client without an `APPROVED` record in `client_communications`
- Store client email addresses in plaintext outside the encrypted Firestore collection
- Draft communications for matters with a `litigation_hold` flag active without coordinator review

---

## 10. Branch 4 — Anomaly Escalation Sub-agent

### Purpose

Find the things that the other sub-agents weren't specifically looking for. The deadline monitor looks for deadlines. The billing agent looks at individual entries. The anomaly agent looks at patterns — across entries, across matters, across attorneys — and flags what doesn't look right before it causes a problem.

This is the platform's observability intelligence layer. It is the most experimental of the four branches in v1.0 and the one with the most room to grow in v1.1 and beyond.

### Detection Categories

**Billing anomalies:**

| Pattern | Description | Risk |
|---------|-------------|------|
| `STALE_PENDING` | Entry has been in `PENDING` state for more than N days (default: 5) | Billing cycle miss, narrative degradation |
| `ROUND_HOURS` | Entry has hours that are suspiciously round (2.0, 3.0, 4.0) with no `session_minutes_actual` | Reconstructed entry, billing accuracy risk |
| `NARRATIVE_ABSENT` | Entry has no narrative or a narrative under 10 characters | Invoice rejection risk, billing audit risk |
| `POTENTIAL_DUPLICATE` | Same attorney, same client, same date, overlapping hours | Double-billing risk |
| `RATE_DEVIATION` | Entry rate differs from attorney's default or client override rate by more than 10% without a rate-change record | Billing error |
| `BUDGET_VELOCITY` | At current billing rate, client will exceed budget cap within N days | Requires proactive client communication |
| `INACTIVE_MATTER` | Matter has had no time entries and no deadline events in 30+ days, but status is still `ACTIVE` | Administrative overhead, stale matter |

**Operational anomalies:**

| Pattern | Description | Risk |
|---------|-------------|------|
| `UNCONFIRMED_DEADLINE` | `HARD_LEGAL` deadline within 14 days with no attorney confirmation on record | Malpractice risk |
| `ATTORNEY_UNBILLED_GAP` | Attorney has logged session time but no `PENDING` entries for a matter in the past N days | Time capture failure |
| `MATTER_NO_DEADLINES` | Active litigation matter with no deadlines in the system | Calendar management gap |
| `CLIENT_INVOICE_OVERDUE` | Invoice was generated more than 30 days ago with no `PAID` status | Collections risk |

### Escalation Scoring

Not every anomaly fires a notification. The sub-agent scores each detected anomaly on two dimensions:

**Severity** (1–5): How bad is this if it is not addressed?
- 5 = Malpractice or regulatory risk (UNCONFIRMED_DEADLINE on HARD_LEGAL, POTENTIAL_DUPLICATE)
- 4 = Financial exposure (BUDGET_VELOCITY at >90%, RATE_DEVIATION on a large entry)
- 3 = Invoice integrity risk (NARRATIVE_ABSENT, ROUND_HOURS)
- 2 = Operational gap (INACTIVE_MATTER, ATTORNEY_UNBILLED_GAP)
- 1 = Housekeeping (MATTER_NO_DEADLINES on a transactional matter)

**Confidence** (0.0–1.0): How certain is the detection?
- POTENTIAL_DUPLICATE with identical hours and dates: 0.95
- ROUND_HOURS with no session data: 0.7
- INACTIVE_MATTER (could be intentionally paused): 0.5

Escalation fires when `severity × confidence >= threshold` (default: 3.0). The coordinator receives the scored anomaly and decides whether to include it in the next digest, send an immediate notification, or route to a specific sub-agent for remediation assistance.

### Reporting

The anomaly sub-agent produces a weekly anomaly digest that includes:
- All detected anomalies from the past 7 days
- Resolution status for anomalies flagged in prior weeks
- Trend analysis: is the firm's billing pattern getting cleaner or dirtier over time?
- One priority action: the single highest-severity unresolved anomaly

The weekly digest is the sub-agent's primary output in v1.0. Real-time escalation is reserved for severity-5 anomalies only.

---

## 11. The Deterministic Tool Layer

### Why It Exists

The tool layer is the trust boundary of the entire platform. It is the architectural decision that makes OpsCounsel safe to deploy in a legal practice.

Every action that modifies data — billing records, deadline events, invoice documents, client communications — goes through a Python function, not a language model. The LLM reasons. The tool functions write. This is not an efficiency decision; it is a correctness and auditability requirement.

**The problem this solves:** Language models can hallucinate. They can confuse clients. They can round hours incorrectly. They can generate a LEDES file with a wrong timekeeper classification. If the model is the thing that writes the billing record, then the billing record is only as reliable as the model's output on that specific invocation. That is not a reliability level that a legal practice can accept for financial records.

**The solution:** The model reasons about what should happen and constructs a structured call to a tool function with explicit parameters. The tool function validates those parameters, applies business logic (6-minute rounding, state machine transitions, duplicate detection), writes to Firestore, and returns a structured result. The model cannot produce a valid billing record directly — it can only produce a valid `write_time_entry()` call, and the function enforces the schema.

### Tool Inventory

| Function | Description | Called By |
|----------|-------------|-----------|
| `write_time_entry(entry)` | Creates a new time entry in CAPTURED or PENDING state | Billing agent, session hook |
| `advance_entry_status(entry_id, new_status, reason)` | Moves an entry through the state machine. Validates the transition is legal. | Billing agent (attorney-confirmed only) |
| `write_down_entry(entry_id, new_hours, new_amount, reason)` | Creates a write-down record and updates the entry | Billing agent (attorney-confirmed only) |
| `write_off_entry(entry_id, reason)` | Moves entry to WRITTEN_OFF, preserves original values | Billing agent (attorney-confirmed only) |
| `compute_budget_utilization(client_slug)` | Returns current budget position. Read-only. | Billing agent, anomaly agent |
| `generate_invoice(client_slug, period)` | Creates invoice document, transitions entries to BILLED | Billing agent (attorney-initiated) |
| `export_ledes(invoice_id)` | Generates LEDES 1998B file from approved invoice | Billing agent (attorney-initiated) |
| `log_deadline_event(deadline_id, event_type, attorney, response)` | Writes a deadline event record. Append-only. | Deadline agent |
| `log_escalation(escalation)` | Records an escalation brief and its routing | Coordinator |
| `log_anomaly(anomaly)` | Records a detected anomaly and its score | Anomaly agent |
| `send_draft_to_review(draft_id, attorney_id)` | Marks a communication draft as approved, updates matter contact timestamp | Comms agent (attorney-confirmed only) |
| `log_audit_event(event)` | Writes to the immutable audit log. Called by all other functions. | All functions |

### Validation Rules

Every tool function that writes data applies a validation layer before the write:

- **Schema validation** — Required fields present, types correct, enums valid
- **State machine validation** — The requested transition is legal given current state
- **Business rule validation** — 6-minute rounding applied, rate is on record for attorney/client combination, LEDES required fields populated if export is requested
- **Duplicate detection** — For `write_time_entry()`: check for same attorney, client, matter, date within the same hour block
- **Authorization check** — The requesting attorney has permission to take this action on this matter

If any validation fails, the function returns a structured error that the sub-agent surfaces to the attorney with a specific explanation. It does not silently fail or attempt to auto-correct.

---

## 12. Data Architecture

### Firestore Collections

**`attorneys`**
```
{
  id: "alice-jones",
  name: "Alice Jones",
  email: "alice@firm.com",
  default_rate: 350,
  billing_increment: 0.1,
  timekeeper_id: "aj001",
  timekeeper_classification: "AT",
  rate_overrides: { "acme-corp": 325 },
  permission_scope: ["billing", "deadlines", "comms"],
  created_at: timestamp,
  updated_at: timestamp
}
```

**`clients`**
```
{
  id: "acme-corp",
  name: "Acme Corp",
  billing_contact: "Jane Smith",
  billing_email: "jane@acme.com",
  billing_address: "...",
  arrangement: "hourly",
  budget_cap: 15000,
  budget_billed: 6820,
  retainer_balance: 1680,
  ledes_client_id: "ACME-001",
  last_client_contact: timestamp,
  notes: "...",
  created_at: timestamp
}
```

**`matters`**
```
{
  id: "acme-msa-2026",
  client_id: "acme-corp",
  name: "Acme Corp (Vendor MSA Review)",
  type: "transactional",
  status: "ACTIVE",
  assigned_attorneys: ["alice-jones"],
  opened_at: timestamp,
  last_activity: timestamp
}
```

**`time_entries`**
```
{
  id: "te-2026-0521-001",
  matter_id: "acme-msa-2026",
  client_id: "acme-corp",
  attorney_id: "alice-jones",
  date: "2026-05-21",
  hours: 0.8,
  rate: 350,
  amount: 280.00,
  task_code: "L200",
  narrative: "Reviewed vendor MSA redline...",
  status: "BILLED",
  invoice_id: "INV-2026-007",
  session_minutes_actual: 46,
  ai_cost_usd: 0.14,
  activity_log: [...],
  write_down_record: null,
  write_off_record: null,
  created_at: timestamp,
  updated_at: timestamp
}
```

**`deadlines`**
```
{
  id: "dl-acme-msa-resp-001",
  matter_id: "acme-msa-2026",
  client_id: "acme-corp",
  description: "Response to counterparty markup due",
  due_date: "2026-06-15",
  classification: "HARD_CONTRACTUAL",
  status: "ACTIVE",
  last_confirmed_by: "alice-jones",
  last_confirmed_at: timestamp,
  created_at: timestamp
}
```

**`deadline_events`** (append-only, never updated)
```
{
  id: "dle-...",
  deadline_id: "dl-acme-msa-resp-001",
  event_type: "ESCALATION_SENT | ATTORNEY_CONFIRMED | ATTORNEY_RESOLVED | ...",
  escalation_level: "14_DAY",
  attorney_id: "alice-jones",
  response: "CONFIRM",
  notes: "...",
  created_at: timestamp
}
```

**`escalations`**
```
{
  id: "esc-...",
  type: "DEADLINE | BILLING | COMMS | ANOMALY",
  matter_id: "...",
  brief: { what, why, done, needed, deadline },
  status: "PENDING | ACKNOWLEDGED | RESOLVED | DISMISSED",
  routed_to: "alice-jones",
  created_at: timestamp,
  resolved_at: timestamp
}
```

**`invoices`**
```
{
  id: "INV-2026-007",
  client_id: "acme-corp",
  period_start: "2026-05-01",
  period_end: "2026-05-31",
  total_hours: 1.2,
  total_amount: 420.00,
  retainer_draw: 420.00,
  retainer_balance_after: 2080.00,
  exhibit_md: "...",    // stored inline or as GCS reference
  ledes_file: "...",    // GCS reference
  status: "ISSUED | PAID | DISPUTED",
  issued_at: timestamp
}
```

**`audit_log`** (immutable — append-only, no updates, no deletes)
```
{
  id: "aud-...",
  event_type: "ENTRY_CREATED | STATUS_ADVANCED | INVOICE_GENERATED | ...",
  actor: "alice-jones | system",
  entity_type: "time_entry | deadline | invoice | ...",
  entity_id: "...",
  before_state: { ... },
  after_state: { ... },
  created_at: timestamp
}
```

### Data Retention and Privacy

- Client email addresses stored in Firestore with field-level encryption (Google Cloud KMS)
- Activity logs store filenames only — no file content, no full paths
- Audit log is immutable at the application layer; Firestore security rules prevent any client from deleting audit records
- Matter file content is never ingested or stored by OpsCounsel — only metadata and billing records
- Data residency: US-only Firestore region by default; configurable at firm setup

---

## 13. Human-in-the-Loop Design

Human-in-the-loop is not a hedge in OpsCounsel. It is an intentional architectural constraint, applied deliberately based on the risk profile of each action category.

### The Autonomy Envelope

The platform defines four autonomy levels for agent actions:

**Level 0 — Fully autonomous (no attorney notification):**
- Running a scheduled sweep and finding nothing actionable
- Updating `last_activity` timestamps
- Computing budget utilization
- Detecting an anomaly below the escalation threshold and logging it for the weekly digest

**Level 1 — Autonomous with logged notification:**
- Sending a routine digest that includes non-critical deadline mentions
- Flagging a `SOFT_INTERNAL` deadline in the digest
- Logging a `STALE_PENDING` anomaly of severity ≤ 2

**Level 2 — Requires attorney acknowledgment before proceeding:**
- Any `HARD_LEGAL` or `HARD_CONTRACTUAL` deadline escalation
- Any anomaly with severity × confidence ≥ 3.0
- Any budget threshold crossing
- Any draft communication surfaced for review

**Level 3 — Requires explicit attorney instruction with specific parameters:**
- Any billing entry state transition (`PENDING → APPROVED`, `APPROVED → WRITTEN_OFF`)
- Any invoice generation
- Any communication approval
- Any deadline resolution

The boundary between Level 2 and Level 3 is the difference between *asking the attorney to pay attention* and *asking the attorney to make a specific decision.* Both require attorney action, but Level 3 actions require the attorney to provide the specific instruction that triggers a tool function call. The agent cannot resolve Level 3 situations by inference.

### The Pause-and-Wait Pattern

When OpsCounsel encounters a Level 3 situation mid-workflow, it does not proceed, guess, or time out. It:

1. Logs the workflow state to Firestore with status `PAUSED_AWAITING_INPUT`
2. Surfaces an escalation brief to the attorney interface
3. Waits for an explicit response
4. On receipt of a valid response, resumes the workflow from the saved state
5. Logs the response and the resumed action to the audit trail

If no response is received within a configurable window (default: 48 hours), the escalation is re-sent with a priority bump and routed to the backup contact if configured.

Workflows do not expire. A paused workflow waits indefinitely and is visible in the attorney interface as a pending action until resolved.

---

## 14. Trust and Guardrail Architecture

### The Four Guardrail Tiers

**Tier 1 — Data Write Isolation**
The LLM cannot write to Firestore. Full stop. Every data mutation goes through a tool function that validates, business-rules-checks, and writes. The LLM produces a tool call with structured parameters. The tool function executes it or rejects it.

**Tier 2 — State Machine Enforcement**
The state machine for time entries is enforced in the tool layer, not in the LLM prompt. `advance_entry_status()` has a hardcoded transition graph:
```python
VALID_TRANSITIONS = {
    "CAPTURED": ["PENDING"],
    "PENDING": ["APPROVED", "WRITTEN_OFF"],
    "APPROVED": ["BILLED", "WRITTEN_OFF"],
    "BILLED": ["CLOSED"],
    "WRITTEN_OFF": [],  # terminal state
    "CLOSED": []        # terminal state
}
```
Any attempt to call `advance_entry_status()` with an invalid transition returns an error. The LLM cannot reason its way around this.

**Tier 3 — Attorney-Confirmation Gates**
Tool functions that advance entries from `PENDING` to `APPROVED` or trigger invoice generation require an `attorney_confirmed: true` parameter and a `confirming_attorney_id`. These parameters are only set by the coordinator after an explicit attorney instruction has been received and parsed. The sub-agent cannot set them on its own.

**Tier 4 — Audit Trail Immutability**
Every tool function call — successful or rejected — writes an event to `audit_log`. The Firestore security rules for `audit_log` allow only CREATE operations; UPDATE and DELETE are denied at the rule level, not the application level. The audit trail cannot be edited by any client, including OpsCounsel itself.

### What the LLM Is Trusted to Do

- Reason about which sub-agent should handle a signal
- Draft client communications (for attorney review — not for delivery)
- Detect billing anomalies and score them
- Synthesize escalation briefs from structured data
- Generate invoice exhibit narrative sections
- Interpret attorney responses and map them to tool calls

### What the LLM Is Not Trusted to Do

- Write billing records
- Advance entry states
- Approve anything on behalf of an attorney
- Generate LEDES files directly
- Access matter file content
- Communicate with clients

---

## 15. The Observability Layer

### Why Observability Is a First-Class Concern

The hackathon judges are evaluating technical implementation at 30% of the score. The scoring rubric for technical implementation includes: evaluation pipelines, guardrails, observability, and a deployment story. Of these, observability is the one most hackathon entries skip — and the one that most directly demonstrates that a system is production-ready rather than demo-ready.

OpsCounsel treats observability as non-optional.

### What Is Logged

Every agent invocation logs:
- Invocation ID, timestamp, triggering event
- Which sub-agent was called and with what context packet
- Tool functions called, parameters, return values
- LLM token usage and cost for the invocation
- Escalations queued, with routing and priority
- Total wall-clock time for the invocation

Every tool function call logs (via `log_audit_event()`):
- Function name, caller (which agent), parameters
- Validation result (PASS or FAIL with reason)
- Firestore write result
- Entity before and after state

### Agent Conversation Traces

ADK provides native conversation tracing. Every coordinator invocation produces a trace that shows:
- The coordinator's reasoning chain
- Each sub-agent call and its return
- Tool calls made within each sub-agent
- The final output or escalation routed

These traces are stored in Google Cloud Trace and surfaced in the OpsCounsel admin interface for the firm administrator. They are the debugging surface when something goes wrong.

### Performance Metrics

The billing report surfaces AI efficiency metrics alongside financial metrics:

| Metric | Description |
|--------|-------------|
| `ai_cost_per_hour_billed` | Total `ai_cost_usd` ÷ total hours billed, per matter |
| `ai_efficiency_ratio` | `ai_cost_usd` ÷ `amount` — what percentage of the billing was the AI cost |
| `avg_time_to_approve` | Average days between entry creation and attorney approval |
| `billing_panel_completion_rate` | Sessions where billing panel was completed vs. skipped |
| `anomaly_resolution_rate` | Anomalies flagged vs. resolved within 7 days |

These metrics are the platform's answer to the ABA's efficiency-gains question — and the firm administrator's primary tool for improving billing hygiene over time.

---

## 16. Hackathon Submission Strategy

### Track

**Track 1 — Build a net-new agent from scratch.** This is the cleanest fit. While the billing data model draws from the `billing-legal` plugin, the OpsCounsel platform is architecturally new: multi-agent coordination, cloud deployment, ADK framework, Firestore persistence, and three entirely new sub-agents (Deadline Monitor, Client Comms, Anomaly Escalation) built from scratch.

### Scoring Map

| Criterion | Weight | OpsCounsel's Answer |
|-----------|--------|---------------------|
| Technical Implementation | 30% | Multi-agent ADK architecture, deterministic tool layer, state machine enforcement, immutable audit log, ADK-native tracing, Firestore persistence |
| Business Case | 30% | Malpractice prevention (deadline monitoring as documented escalation chain), AI billing transparency (ai_cost_usd, activity audit trail, ABA opinion compliance), underserved small-firm market, LEDES 1998B for corporate client acceptance |
| Innovation and Creativity | 20% | ai_cost_usd tracking embedded in billing records (no existing legal billing tool does this), activity audit trail at the entry level, scoring-based anomaly detection, pause-and-wait pattern for Level 3 decisions |
| Demo and Presentation | 20% | Three concrete scenarios demonstrable in under 3 minutes: (1) deadline approaching critical window → escalation brief → attorney confirms → audit trail, (2) billing entry flagged as reconstructed → anomaly alert → attorney reviews and corrects, (3) budget threshold crossed → client status draft generated → attorney approves → communication logged |

### Demo Scenario Design

The demo runs three scenarios in sequence, each demonstrating one core architectural principle:

**Scenario 1 — Deadline Monitor (trust architecture)**
- Trigger: `HARD_LEGAL` deadline enters 7-day window with no prior confirmation
- Show: Escalation brief surfaced in attorney interface with risk level, deadline date, and required action
- Show: Attorney confirms → `log_deadline_event()` called → audit trail entry written
- Key talking point: "The model reasoned about the urgency. The tool function wrote the record. The attorney made the decision. Those three things are separate by design."

**Scenario 2 — Anomaly Detection (observability architecture)**
- Trigger: Three pending entries with round hours and no `session_minutes_actual`, same attorney, same week
- Show: Anomaly sub-agent scores the pattern (`ROUND_HOURS`, severity 3, confidence 0.7)
- Show: Weekly digest surfaces the anomaly with specific entries flagged
- Show: Attorney opens WIP review for those entries, adds narratives, approves
- Key talking point: "A system that tells you what's wrong before the invoice goes out is worth more than one that tells you why the invoice was rejected."

**Scenario 3 — Client Comms (autonomy envelope)**
- Trigger: 16 days since last client contact on an active matter approaching a contractual deadline
- Show: Both triggers fire simultaneously → coordinator assembles a unified brief (DAYS_SINCE_CONTACT + DEADLINE_APPROACHING)
- Show: Draft status email surfaced with trigger reason, matter context, and draft body
- Show: Attorney edits one line, approves → `send_draft_to_review()` called → `last_client_contact` updated
- Key talking point: "The agent drafted it. The attorney sent it. That's not a limitation — that's the design."

### What Distinguishes This Entry

Most hackathon entries build a chat interface on top of a model. OpsCounsel is an autonomous operations layer with a human-in-the-loop gate. The distinction is architectural, not cosmetic. The demo makes that visible.

The `ai_cost_usd` field in every billing entry is the single most differentiated feature in the legal billing space. No Clio, no MyCase, no PracticePanther, no Thomson Reuters product captures this. It exists because the regulatory environment created demand for it and the existing market hasn't responded yet. That's the business case in one sentence.

---

## 17. What OpsCounsel Explicitly Does Not Do

This section is as important as the feature list. Scope discipline is what makes a hackathon entry believable — and what makes a production system safe.

**Does not give legal advice.** OpsCounsel surfaces facts, deadlines, billing data, and status. It does not analyze legal strategy, assess claim strength, or recommend legal actions. The client comms sub-agent is explicitly prompted to avoid legal analysis in drafts.

**Does not access matter file content.** OpsCounsel works with matter metadata — client, matter name, status, assigned attorneys, billing records, deadlines. It does not read, index, analyze, or store the actual documents in a matter file. That is Auris Intelligence's domain.

**Does not communicate with clients without attorney approval.** Every draft goes through the attorney interface. `send_draft_to_review()` requires `attorney_confirmed: true`. There is no path from trigger to sent communication that bypasses attorney review.

**Does not make billing decisions.** The WIP review hard gate is not optional. No entry moves from `PENDING` to `APPROVED` without an explicit attorney action. The anomaly agent can flag suspicious entries; it cannot correct them.

**Does not replace practice management software.** OpsCounsel does not manage documents, track court filings, handle trust accounting, or maintain a docket system. It is designed to run alongside whatever the firm already uses, adding an autonomous operational intelligence layer on top of existing infrastructure.

**Does not manage trust accounts.** Trust accounting is regulated at the state bar level with strict rules about commingling, record-keeping, and reconciliation. OpsCounsel does not touch trust funds. Retainer draw-down tracking in billing is informational only — the actual trust account reconciliation is out of scope.

---

## 18. Open Questions Before Build

These are the decisions that need to be made before writing the first line of code. Documenting them now prevents mid-build scope drift.

**Q1: Matter data source in v1.0**
OpsCounsel needs matter metadata (client, matter name, assigned attorneys, status) to function. In the `billing-legal` plugin, this came from other claude-for-legal plugins via the matter workspace convention. In the cloud agent, what populates the `matters` collection?

*Options:* (a) Manual entry via `cold-start-interview`; (b) CSV import from existing practice management system; (c) Google Calendar integration (matters as calendars); (d) Structured matter creation form in the attorney interface.

*Recommendation:* Option (a) for v1.0 demo. Option (b) as the stated v1.1 path in the submission.

**Q2: Calendar integration depth**
The deadline monitor needs deadline data. In v1.0, is deadline entry manual (attorney adds deadlines via the interface), or does OpsCounsel read from Google Calendar?

*Recommendation:* Manual entry for v1.0 demo — it's simpler to implement and the demo doesn't need live calendar integration to show the escalation chain. Google Calendar API integration is stated as v1.1.

**Q3: Email delivery mechanism**
The client comms sub-agent generates approved drafts. Does it send them, or does it export them for the attorney to send?

*Recommendation:* Export to attorney clipboard or Gmail draft (via Gmail API) in v1.0. The demo shows the draft generation and approval flow — the actual send mechanism is secondary to the demo's argument.

**Q4: Attorney interface — web app or digest-only?**
The attorney interface needs to surface escalations, drafts, WIP review, and billing panels. Is this a full web application, or is it an email digest with deep-link actions?

*Recommendation:* Email digest with a minimal web interface for WIP review and billing panel in v1.0. The demo needs something to show — a React front end on Cloud Run is achievable in the build window.

**Q5: Multi-attorney in demo scope?**
Does the demo show a single-attorney firm or a multi-attorney firm?

*Recommendation:* Two attorneys in the demo data — enough to show per-attorney rate cards and the shared billing register, without complicating the demo flow.

**Q6: Synthetic data set**
The demo needs a realistic data set — active matters, pending billing entries, approaching deadlines, a budget near the warning threshold, and a client with no recent contact. This data set needs to be built before the demo script is written.

*Action item:* Design the synthetic firm (Hartley & Associates LLP, from the billing-legal README) with 4 active matters, 8 time entries in various states, 2 approaching deadlines (one HARD_LEGAL at 6 days, one HARD_CONTRACTUAL at 11 days), and 1 client at 78% budget utilization. This is enough to trigger all three demo scenarios cleanly.

---

*End of specification.*

*Next step: Branch 2 (Billing Reconciliation Sub-agent) Python implementation — data layer first, then tool functions, then sub-agent system prompt.*
