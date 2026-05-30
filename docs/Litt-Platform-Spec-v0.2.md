# Litt — Platform Specification

**Version:** 0.2 — Build-Ready  
**Author:** Eric Tetzlaff  
**Status:** Locked for build — do not revise without logging a change  
**Last updated:** May 29, 2026  
**Replaces:** OpsCounsel Platform Spec v0.1

---

## Change Log from v0.1

| # | Change | Source |
|---|--------|--------|
| 1 | Platform renamed from OpsCounsel to **Litt** | Eric |
| 2 | LEDES field correction: `task_code` and `activity_code` are separate fields, not collapsed | GPT review / Mitratech LEDES 1998B spec |
| 3 | Client comms approval split into three states: `DRAFT_APPROVED → QUEUED_FOR_SEND → SENT_CONFIRMED` | GPT review |
| 4 | `DISMISSED_WITH_REASON` required on all dismissable alerts | GPT review |
| 5 | `billing_guidelines` object added per client — pre-bill scrubber added to billing sub-agent | GPT review |
| 6 | Deadline source model added: `source_type`, `source_excerpt`, `verification_status` | GPT review |
| 7 | AI billing provenance fields expanded on time entry schema | GPT review / ABA Formal Opinion 512 |
| 8 | Google Calendar API integration moved to v1.0 scope | Eric (Section 18 Q2) |
| 9 | Gmail API draft export added to v1.0 scope | Eric (Section 18 Q3) |
| 10 | React dashboard + email digest both in v1.0 scope | Eric (Section 18 Q4) |
| 11 | Demo synthetic firm changed from Hartley & Associates to **Strand & Okafor LLP** | Eric (Section 18 Q6) |
| 12 | Demo video constraint: 2-minute hard cap per contest rules | Rules PDF |
| 13 | Mandatory technology stack locked: Gemini API, ADK, Cloud Run / Agent Engine | Rules PDF |
| 14 | Matter entry: manual cold-start for v1.0; CSV import stated as v1.1 path | Eric (Section 18 Q1) |
| 15 | New Projects Only constraint noted: all Litt code authored after April 22, 2026 | Rules PDF |
| 16 | Engagement terms object added per client/matter | GPT review |
| 17 | A/R watchdog added to v1.0 scope | GPT review |
| 18 | Observability tier separation formalized: engineering / operational / legal-defensibility | GPT review |
| 19 | `approve_client_comm_draft()` / `queue_client_comm_for_delivery()` / `log_client_comm_sent()` replace `send_draft_to_review()` | GPT review |
| 20 | Multi-attorney data model retained; demo scoped to one attorney | Eric (Section 18 Q5) |

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [What Litt Is](#2-what-litt-is)
3. [Who It's For](#3-whos-its-for)
4. [Why It Matters](#4-why-it-matters)
5. [Technology Stack — Mandatory and Supporting](#5-technology-stack--mandatory-and-supporting)
6. [Platform Architecture — 1,000-Foot View](#6-platform-architecture--1000-foot-view)
7. [The Coordinator Agent](#7-the-coordinator-agent)
8. [The Daily Closeout Brief](#8-the-daily-closeout-brief)
9. [Branch 1 — Deadline Monitor Sub-agent](#9-branch-1--deadline-monitor-sub-agent)
10. [Branch 2 — Billing Reconciliation Sub-agent](#10-branch-2--billing-reconciliation-sub-agent)
11. [Branch 3 — Client Comms Sub-agent](#11-branch-3--client-comms-sub-agent)
12. [Branch 4 — Anomaly Escalation Sub-agent](#12-branch-4--anomaly-escalation-sub-agent)
13. [The Ingestion Layer](#13-the-ingestion-layer)
14. [The Deterministic Tool Layer](#14-the-deterministic-tool-layer)
15. [Data Architecture](#15-data-architecture)
16. [Human-in-the-Loop Design](#16-human-in-the-loop-design)
17. [Trust and Guardrail Architecture](#17-trust-and-guardrail-architecture)
18. [The Observability Layer](#18-the-observability-layer)
19. [The Attorney Interface](#19-the-attorney-interface)
20. [Synthetic Demo Firm — Strand & Okafor LLP](#20-synthetic-demo-firm--strand--okafor-llp)
21. [Hackathon Submission Strategy](#21-hackathon-submission-strategy)
22. [What Litt Explicitly Does Not Do](#22-what-litt-explicitly-does-not-do)
23. [v1.1 Roadmap — Stated in Submission](#23-v11-roadmap--stated-in-submission)

---

## 1. The Problem

Small law firms — practices with two to fifteen attorneys — run on institutional knowledge, personal relationships, and a tolerance for operational chaos that would be unacceptable in any other professional services context. The senior partner knows which client is approaching their budget cap. The office administrator remembers which case has a filing deadline on the fourteenth. The associate tracks her time in a spreadsheet she updates at the end of the week, from memory.

This is not a technology failure. It's a staffing model that predates AI-assisted instrumentation. The problem is that the model has known, documented failure modes — deadline misses, billing reconstruction errors, client communication gaps, budget overruns that don't surface until the invoice goes out — and those failure modes have specific legal and financial consequences.

**Missed deadlines.** In civil litigation, a missed statute of limitations or blown response deadline is not a recoverable mistake. It's a malpractice claim. The ABA Standing Committee on Ethics and Professional Responsibility identifies calendar and deadline management failures as the single largest category of malpractice claims against small firms. The defense against that claim is a documented escalation chain — proof that the deadline was being monitored, that an attorney was notified, that a response was logged. Most small firms cannot produce that record because it was never created.

**Billing reconstruction.** Most time entry in small firms is reconstructed, not captured in real time. An attorney finishes a two-hour document review session, handles a client call, works on an internal matter, then logs time at the end of the day — or more often, at the end of the week. The narrative is approximate. The hours are estimated. The task codes are assigned from memory. The billing reviewer at a corporate legal department who pulls the LEDES file and sees "L200 — reviewed documents, 3.2h" knows exactly what they're looking at.

**AI billing exposure.** As AI-assisted legal work becomes standard, bar associations are issuing guidance on what attorneys may ethically bill for AI time. ABA Formal Opinion 512 (2024) asks three specific questions: Was the time genuinely spent? Is the rate reasonable given AI assistance? Were efficiency gains passed through? Most small firms have no mechanism to answer those questions with data.

**Client communication gaps.** Clients want status. Small firms are too busy to proactively send it. The result is that clients call for updates, attorneys get interrupted, and relationships degrade — not because the work is poor, but because the communication cadence is absent.

**Budget blindness.** Corporate clients and insurance-assigned counsel work under matter budgets. Small firms frequently don't track real-time budget utilization per matter — which means the first signal the client gets that the budget is at risk is the invoice.

None of these are hard problems with the right instrumentation. They are hard problems with a two-person support staff and a practice management system designed in 2012.

**The gap Litt closes:** An autonomous operations layer that runs continuously, watches the things attorneys don't have time to watch, and surfaces the right information to the right person at the right moment — before the deadline, before the budget overrun, before the communication gap becomes a relationship problem — and leaves a defensible record behind every decision it touches.

---

## 2. What Litt Is

Litt is an autonomous AI operations agent for small law firm practice management. It is not a chatbot. It is not a document analyzer. It is not a practice management system replacement.

It is an **always-on operational control layer** that sits between the firm's existing data — calendar, email, billing records, client contacts — and the attorneys who need to act on it. It monitors continuously, reasons about what it observes, and takes autonomous action within a defined, attorney-approved envelope. When it encounters a decision that requires attorney judgment, it escalates with a structured brief and waits for a response before proceeding.

The product ritual is the **Daily Closeout Brief** — delivered to each attorney at a configured time (default 4:30 PM), summarizing every operational item that needs attention and enabling one-click resolution of the routine ones. Every other capability in the platform feeds that brief.

**What Litt does autonomously:**
- Reads Google Calendar for deadline events and matter activity
- Parses Gmail for deadline signals in opposing counsel and court emails
- Monitors billing entry completeness across all active matters
- Tracks budget utilization per client in real time, alerting on threshold crossings
- Detects anomalies in the time register — duplicate patterns, vague narratives, round hours, rate deviations
- Drafts client status communications when a matter crosses a configured trigger
- Assembles the Daily Closeout Brief from all active signals

**What Litt always routes to an attorney:**
- Any `HARD_LEGAL` or `HARD_CONTRACTUAL` deadline escalation
- Any billing entry state advancement
- Any client communication before delivery
- Any anomaly above the escalation threshold
- Any budget threshold crossing

**What Litt never does:**
- Send a communication to a client without `SENT_CONFIRMED` status on attorney-approved draft
- Write a billing entry to the time register without attorney-initiated action
- Advance a billing entry from `PENDING` to `APPROVED` without explicit attorney sign-off
- Give legal advice
- Access matter file content

---

## 3. Who It's For

### Primary — The Small-Firm Attorney

Two to fifteen attorneys. General civil practice or focused practice in commercial litigation, employment, real estate, estate planning, or insurance defense. Billing rates between $200 and $600/hour. A mix of individual, small business, and corporate legal department clients.

This attorney knows their craft. They are not interested in learning a new platform. They want the operational noise handled so they can focus on legal work. They are skeptical of AI in their practice and will only trust a system that is transparent about what it did, why it did it, and what it wants them to approve.

**Key motivation:** Not getting blindsided. By a deadline. By a budget overrun. By a client who feels ignored. By an invoice that gets rejected.

### Secondary — The Firm Administrator

The person — often the attorney themselves in a solo or two-person shop — who handles billing reconciliation, client invoicing, and calendar maintenance.

**Key motivation:** Not spending Friday afternoon reconstructing a month of time entries, chasing attorneys for narratives, and manually computing budget utilization across twelve active matters.

### Tertiary — The Corporate Legal Client

Not a direct user, but a beneficiary of Litt's outputs. Corporate legal departments increasingly require LEDES 1998B formatted invoices, AI billing transparency disclosures, and granular activity audit trails as conditions of invoice acceptance. Litt produces all three automatically.

---

## 4. Why It Matters

### Malpractice Defense

Litt's deadline monitor is not an operational nicety. It is a risk management artifact. A firm that can demonstrate an automated, documented, escalation-tracked deadline monitoring system — with attorney confirmations on record — has a defensible position in a disciplinary proceeding that a firm running on a shared Outlook calendar does not. The `deadline_events` collection is the record. It is append-only and immutable at the Firestore rule level.

### AI Billing Transparency

ABA Formal Opinion 512 (2024) specifically addresses attorney duties around competence, confidentiality, communication, and reasonable fees when using generative AI. It states that lawyers may bill for time spent inputting information and reviewing AI output, but generally may not bill clients for learning how to use the tool.

Litt answers the three questions regulators ask — with data, not assertion:
- Was AI used? (`ai_assisted` field on every entry)
- Was the output reviewed? (`human_review_completed`, `reviewing_attorney_id`)
- Were efficiency gains handled appropriately? (`ai_cost_usd` vs. `amount`, `billing_treatment`)

No existing legal billing product captures this. It exists in Litt because the regulatory environment created the demand and the market hasn't responded yet.

### Invoice Acceptance

For firms serving corporate clients or insurance carriers, LEDES 1998B compliance and billing guideline enforcement are not differentiators — they are table stakes. A pre-bill scrubber that catches forbidden phrases, block billing, missing task codes, and vague narratives before the invoice goes out protects realization. Invoice rejection costs firms money twice: the write-down and the relationship damage.

### Reachability

Enterprise legal tech — Clio, MyCase, PracticePanther — builds AI features on practice management infrastructure that costs $50–200/month per user and requires significant onboarding. Small firms, especially solo and two-person shops, are underserved because the onboarding cost is too high relative to the value at that scale. Litt deploys alongside whatever the firm already uses. It reads from Google Calendar and Gmail. It does not replace anything.

---

## 5. Technology Stack — Mandatory and Supporting

### Mandatory (Contest Rules)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Intelligence | Gemini 2.5 Pro via Vertex AI | All agent reasoning. No other LLM in the agent layer. |
| Orchestration | Google Agent Development Kit (ADK) | Multi-agent coordinator/sub-agent pattern |
| Infrastructure | Cloud Run | Agent backend + React dashboard |
| Persistence | Firestore | All application data |

### Supporting

| Layer | Technology | Notes |
|-------|-----------|-------|
| Ingestion — Calendar | Google Calendar API | Read-only. Deadline and matter event detection. |
| Ingestion — Email | Gmail API | Read-only. Deadline signal parsing. Draft export. |
| Frontend | React | Attorney dashboard. Deployed on Cloud Run or Firebase Hosting. |
| Email digest | Sendgrid or Gmail API | Daily Closeout Brief email with deep links |
| Scheduling | Cloud Scheduler | Triggers coordinator on sweep cadence |
| Event triggers | Firestore triggers (Cloud Functions) | Event-driven coordinator invocation on data changes |
| Secrets | Google Secret Manager | API keys, service account credentials |
| Logging | Google Cloud Logging + Cloud Trace | Engineering observability |

### Not Used in v1.0

- LangChain, CrewAI (ADK is sufficient and cleaner for the submission story)
- Agent Engine Runtime (Cloud Run is the deployment target; Agent Engine stated as v1.1 migration path)
- GKE (unnecessary complexity for demo scale)
- Any Anthropic API in the agent layer (Claude used for build tooling only, not in the submitted product)

---

## 6. Platform Architecture — 1,000-Foot View

Litt is a **multi-agent system** built on Google ADK. One coordinator agent receives all inputs, reasons about routing, and delegates to four specialized sub-agents. Sub-agents execute within their defined scope and return results to the coordinator, which synthesizes outputs — either resolving autonomously or assembling the Daily Closeout Brief for attorney action.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     INGESTION LAYER                                 │
│         Google Calendar API · Gmail API · Manual Entry              │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ structured signals
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   COORDINATOR AGENT (Gemini 2.5 Pro / ADK)          │
│   Receives: scheduled sweeps, event triggers, attorney inputs        │
│   Reasons: routing decisions, escalation assembly, brief synthesis   │
│   Never: writes data directly                                        │
└──────┬──────────┬──────────┬──────────┬──────────────────────────┘
       │          │          │          │
  ┌────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌──▼──────────────┐
  │Deadline│ │Billing │ │Client  │ │Anomaly          │
  │Monitor │ │Recon   │ │Comms   │ │Escalation       │
  └────┬───┘ └───┬────┘ └───┬────┘ └──┬──────────────┘
       └─────────┴──────────┴──────────┘
                            │ tool calls (structured params only)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│               DETERMINISTIC TOOL LAYER (Python)                     │
│   All state writes. Validates before writing. Never inferred.        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        FIRESTORE                                    │
│   attorneys · clients · matters · time_entries · deadlines          │
│   deadline_events · escalations · invoices · audit_log              │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   ATTORNEY INTERFACE                                │
│   React Dashboard (Cloud Run) · Email Digest (deep links)           │
│   Daily Closeout Brief · WIP Review · Deadline Confirmation         │
└─────────────────────────────────────────────────────────────────────┘
```

### Execution Model

**Scheduled sweep mode:** Cloud Scheduler triggers the coordinator every 4 hours during business hours (8 AM–7 PM local time). The coordinator pulls current state from Firestore, runs sub-agents, and either resolves items autonomously or queues them for the next Daily Closeout Brief.

**Event-driven mode:** Firestore document changes trigger immediate coordinator invocation via Cloud Functions. A new Gmail-parsed deadline signal, a new manual time entry, a budget threshold crossing — each fires a targeted evaluation pass.

**Brief delivery mode:** At the configured closeout time (default 4:30 PM), the coordinator assembles and delivers the Daily Closeout Brief — both as a React dashboard update and as an email digest with deep links to individual action items.

---

## 7. The Coordinator Agent

### Role

Single entry point for all signals and all routing decisions. Does not do deep domain work — that belongs to sub-agents. Understands what is happening, decides which sub-agent handles it, frames the task, receives results, and decides whether to resolve autonomously or escalate.

### System Prompt (Firm Context Document)

The coordinator's system prompt is the firm's operational profile — generated at `cold-start-interview` and updated via `/litt:customize`. Injected into the coordinator's context on every invocation. Contains:

- Firm name, practice area(s), jurisdiction(s)
- Attorney roster: slug, name, rate, seniority, permission scope
- Active matters: slug, client, type, status, assigned attorneys, budget cap, budget used, `last_client_contact`
- Escalation thresholds: deadline windows, budget percentages, stale billing days, anomaly score floor
- Communication preferences: digest time, escalation channel, draft approval workflow
- Autonomy envelope: what the coordinator may resolve without asking; what always requires attorney input
- Billing guidelines per client (summary — full object in Firestore)

### Routing Logic

```
Signal received
│
├── Deadline-related? ────────────────────→ Deadline Monitor
├── Billing / WIP / time entry? ──────────→ Billing Reconciliation
├── Client comms trigger? ────────────────→ Client Comms
├── Pattern / anomaly signal? ───────────→ Anomaly Escalation
├── Multiple triggers on same matter? ───→ All relevant sub-agents
│                                          (parallel) → unified brief
└── Attorney response to prior escalation? → Resume paused workflow
```

### Escalation Brief Structure

When the coordinator escalates, it produces a structured brief — not raw sub-agent output:

1. **What's happening** — One sentence. Specific situation.
2. **Why it matters** — Risk level (`CRITICAL / ELEVATED / ROUTINE`), financial exposure, or relationship implication.
3. **What Litt has already done** — Any autonomous actions already taken.
4. **What the attorney needs to decide** — Specific decision, options pre-populated where possible.
5. **Decision deadline** — If the escalation is time-constrained, stated explicitly.

---

## 8. The Daily Closeout Brief

The Daily Closeout Brief is not a feature. It is the product's reason for existing in an attorney's daily workflow. Everything else in Litt feeds it.

### Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  LITT DAILY CLOSEOUT  ·  Strand & Okafor LLP  ·  Thu May 29, 4:30PM│
├─────────────────────────────────────────────────────────────────────┤
│  DEADLINES NEEDING CONFIRMATION                                     │
│  ● Mercer v. Dunlap — Motion response — 6 days — HARD_LEGAL  [!]   │
│    Source: Cuyahoga Co. Court Order dated May 8                     │
│    [Confirm]  [Extend]  [Delegate]  [Dismiss with reason]           │
│                                                                     │
│  ● Reyes Acquisition — LOI expiry — 11 days — HARD_CONTRACTUAL     │
│    Source: Email from opposing counsel, May 20                      │
│    [Confirm]  [Extend]  [Delegate]  [Dismiss with reason]           │
├─────────────────────────────────────────────────────────────────────┤
│  TIME ENTRIES NEEDING REVIEW                                        │
│  ● Acme Commercial — 0.8h — $280 — narrative ready       [Approve] │
│    ⚠ Pre-bill scrubber: narrative contains "review documents"       │
│  ● Mercer v. Dunlap — 1.4h — $490 — no narrative          [Review] │
│  ● Reyes Acquisition — 0.5h — $175 — approved            ✓ Done    │
│                                                    Total WIP: $770  │
├─────────────────────────────────────────────────────────────────────┤
│  BUDGET RISKS                                                       │
│  ● Acme Commercial — 78% of $15,000 budget — $11,700 committed     │
│    Draft budget alert ready                    [Review draft]       │
├─────────────────────────────────────────────────────────────────────┤
│  CLIENT SILENCE RISKS                                               │
│  ● Mercer v. Dunlap — 16 days since last contact                   │
│    Draft status update ready                   [Review draft]       │
├─────────────────────────────────────────────────────────────────────┤
│  ANOMALIES                                                          │
│  ● 2 entries this week: round hours, no session data               │
│    Possible reconstruction — review narratives  [Open WIP review]   │
└─────────────────────────────────────────────────────────────────────┘
```

### Delivery

- **React dashboard:** Brief rendered as the homepage. Updates in real time as attorneys take action. Completed items collapse and move to a "Resolved today" section.
- **Email digest:** Sent at the configured closeout time. Each action item is a deep link directly to the relevant UI panel. Attorney can approve a time entry, confirm a deadline, or review a draft from email without opening the dashboard.
- **Push notification (v1.1):** For `CRITICAL` escalations only — `HARD_LEGAL` deadlines inside 3 days, severity-5 anomalies.

### The Habit Loop

The Daily Closeout Brief is designed to create a daily attorney habit: open Litt at end of day, clear the brief, know nothing slipped. The goal is a sub-3-minute closeout for a normal day. The brief surfaces only items requiring attorney attention — not every monitoring event.

---

## 9. Branch 1 — Deadline Monitor Sub-agent

### Purpose

Track every date-sensitive obligation across all active matters. Surface approaching deadlines before they become crises. Maintain a documented escalation chain that constitutes a malpractice defense record.

### Ingestion Sources (v1.0)

- **Google Calendar API** — Read-only. Calendar events tagged with deadline type and matter slug are pulled on each sweep. Events without matter association are flagged for attorney assignment.
- **Gmail API** — Read-only. Incoming emails from identified opposing counsel and court addresses are scanned for deadline language ("due by," "response required by," "opposition deadline," "30 days from"). Detected candidates are surfaced as **unverified deadlines** requiring attorney confirmation before becoming active monitored deadlines.
- **Manual entry** — Attorney enters deadline via `/litt:deadline-add` in the dashboard. Manual entries bypass the verification queue and go directly to active monitoring.

### Deadline Source Model

Every deadline carries a complete source record:

```python
{
  "deadline_id": "dl-mercer-resp-001",
  "matter_id": "mercer-v-dunlap",
  "description": "Opposition to motion for summary judgment due",
  "due_date": "2026-06-04",
  "classification": "HARD_LEGAL",
  "source_type": "court_order",       # court_order | email | manual | contract | statute
  "source_document_id": "email-abc123",
  "source_excerpt": "Opposition due June 4, 2026",
  "created_by": "system",             # system | attorney | paralegal
  "verified_by": None,
  "verification_status": "unverified", # unverified | attorney_verified | superseded
  "supersedes_deadline_id": None,
  "jurisdiction": "Ohio",
  "court": "Cuyahoga County Court of Common Pleas",
  "status": "ACTIVE",
  "last_confirmed_by": None,
  "last_confirmed_at": None
}
```

**Critical rule:** System-detected deadlines from Gmail or Calendar parsing are **never activated without attorney verification**. The flow is:

```
System detects → surfaces as UNVERIFIED → attorney reviews source excerpt
→ attorney confirms date and classification → status = attorney_verified
→ deadline enters active monitoring
```

Unverified deadlines appear in the Daily Closeout Brief under "Needs your attention" — separate from confirmed active deadlines. They cannot fire escalation notifications until verified.

### Deadline Classification

| Class | Description | Example | Miss Consequence |
|-------|-------------|---------|-----------------|
| `HARD_LEGAL` | Court-imposed or statute-defined | SOL, response deadline, filing deadline | Malpractice, dismissal |
| `HARD_CONTRACTUAL` | Contract-defined, client-facing | LOI expiry, option window, notice deadline | Client harm, breach |
| `SOFT_INTERNAL` | Firm-set milestone | Draft review, internal approval | Workflow disruption |
| `ADMINISTRATIVE` | Regulatory or licensing | Bar dues, trust account reports | Regulatory risk |

### Escalation Cadence

**HARD_LEGAL:**
- 30 days: digest mention
- 14 days: dedicated brief, confirmation required
- 7 days: daily brief + email, confirmation required
- 3 days: email twice daily, confirmation required each day
- 1 day: CRITICAL alert, confirmation required

**HARD_CONTRACTUAL:**
- 21 days: digest mention
- 7 days: dedicated brief, confirmation required
- 3 days: daily brief + email
- 1 day: email alert

**SOFT_INTERNAL / ADMINISTRATIVE:**
- 7 days: digest mention
- 3 days: digest mention
- 1 day: digest mention

### Confirmation Options

Every `HARD_LEGAL` and `HARD_CONTRACTUAL` escalation requires attorney response:

- **Confirm** — I know about this, keep monitoring
- **Resolved** — Deadline met, close it
- **Extend** — New date: [date] — creates supersession record
- **Delegate** — Route to [attorney]
- **Dismiss with reason** — [required reason string] — writes to `audit_log`

No silent dismissal on `HARD_LEGAL` or `HARD_CONTRACTUAL`. A deadline that has not received confirmation within 24 hours of the 7-day trigger re-fires to the backup contact.

### Outputs

- Structured brief to coordinator → Daily Closeout Brief
- `deadline_event` records (append-only) via `log_deadline_event()` — every escalation, every attorney response
- Never modifies deadline data directly — only `log_deadline_event()` writes

---

## 10. Branch 2 — Billing Reconciliation Sub-agent

### Purpose

Maintain a clean, complete, attorney-approved time register across all matters. Capture time accurately. Surface billing issues before they reach the invoice. Enforce billing guidelines per client. Generate LEDES-compliant invoice exhibits. Track AI billing provenance to satisfy ABA ethical requirements.

### State Machine

```
[CAPTURED] → [PENDING] → [APPROVED] → [BILLED] → [CLOSED]
                ↓
           [WRITTEN_OFF]
```

| State | Meaning | Who advances it |
|-------|---------|-----------------|
| `CAPTURED` | Session time recorded, no attorney review yet | System (session hook) |
| `PENDING` | Attorney added narrative and confirmed hours | Attorney (billing panel) |
| `APPROVED` | Attorney explicitly approved in WIP review | Attorney (wip-review gate) |
| `BILLED` | Included in generated invoice, `invoice_id` populated | System (invoice-generate tool) |
| `CLOSED` | Matter closed or invoice paid | Attorney |
| `WRITTEN_OFF` | Zeroed; original values preserved; reason required | Attorney (wip-review gate) |

State transitions are enforced in the tool layer, not by the LLM. Invalid transitions return a structured error.

### Time Entry Schema (v1.0)

```python
{
  # Identity
  "id": "te-2026-0529-001",
  "matter_id": "mercer-v-dunlap",
  "client_id": "acme-commercial",
  "attorney_id": "dana-strand",

  # Time and billing
  "date": "2026-05-29",
  "hours": 0.8,
  "rate": 350,
  "amount": 280.00,
  "session_minutes_actual": 46,
  "billing_increment": 0.1,           # 0.1 = 6-min minimum

  # LEDES fields — SEPARATE, never collapsed
  "task_code": "L200",                # LINE_ITEM_TASK_CODE (UTBMS task)
  "activity_code": "A103",            # LINE_ITEM_ACTIVITY_CODE (ABA activity, optional)
  "expense_code": None,               # LINE_ITEM_EXPENSE_CODE (disbursements only)

  # Narrative and status
  "narrative": "Reviewed opposing counsel...",
  "status": "PENDING",
  "invoice_id": None,

  # AI billing provenance (ABA FO 512 compliance)
  "ai_assisted": True,
  "ai_tool": "Gemini",
  "model": "gemini-2.5-pro",
  "ai_cost_usd": 0.14,
  "human_minutes_actual": 46,
  "ai_minutes_estimated": 3,
  "output_type": "draft",             # draft | research_summary | redline | extraction | analysis
  "human_review_completed": True,
  "reviewing_attorney_id": "dana-strand",
  "client_ai_disclosure_required": True,
  "client_ai_disclosure_status": "included", # included | not_required | withheld
  "billing_treatment": "billed_as_human_review", # billed_as_human_review | written_down | nonbillable_ai_overhead

  # Activity audit trail
  "activity_log": [
    "2026-05-29T14:23Z|Edit|mercer-motion-opp.docx",
    "2026-05-29T14:31Z|Write|mercer-research-notes.md",
    "2026-05-29T14:45Z|Read|dunlap-depo-transcript.pdf"
  ],

  # Write-down / write-off records
  "write_down_record": None,
  "write_off_record": None,

  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### LEDES 1998B Field Mapping (Corrected)

The LEDES 1998B spec defines three distinct code fields for fee line items. These are **not interchangeable** and must be mapped separately. E-billing systems (Serengeti, Legal Tracker, TyMetrix) will reject invoices that collapse them.

| Litt field | LEDES 1998B field | Notes |
|-----------|-------------------|-------|
| `task_code` | `LINE_ITEM_TASK_CODE` | UTBMS L-series (litigation) or A-series (transactional). Required for all fee entries. |
| `activity_code` | `LINE_ITEM_ACTIVITY_CODE` | ABA activity codes (A101–A111). Optional unless client guidelines require it. |
| `expense_code` | `LINE_ITEM_EXPENSE_CODE` | For disbursements only. Null on all time entries. |
| `attorney.timekeeper_id` | `TIMEKEEPER_ID` | Firm-assigned ID or bar number |
| `attorney.timekeeper_classification` | `TIMEKEEPER_CLASSIFICATION` | AT / PA / OF / CL |
| `client.ledes_client_id` | `CLIENT_ID` | Client's e-billing system ID |
| `hours` | `NUMBER_OF_UNITS` | |
| `rate` | `BILLING_TIMEKEEPER_RATE` | |
| `amount` | `LINE_ITEM_TOTAL` | |
| `narrative` | `LINE_ITEM_COMMENT` | |
| `invoice.id` | `INVOICE_NUMBER` | |
| `invoice.issued_at` | `INVOICE_DATE` | Format: YYYYMMDD |

**Write-off entries excluded from LEDES exports.** Flat-fee entries included with tracked hours, arrangement noted in `LINE_ITEM_COMMENT`.

### Billing Panel

Presented to the attorney in the Daily Closeout Brief and as a dedicated view. Shows pending time capture requiring narrative and confirmation:

```
BILLING PANEL — Acme Commercial / acme-contract-review-2026
──────────────────────────────────────────────────────────
Session: 46 min → 0.8h (6-min increment applied)
Dana Strand · $350/hr → $280.00
Budget: $11,700 of $15,000 (78% used)  ⚠ Budget warning threshold
AI cost this session: $0.14  |  AI efficiency: 0.05% of billing
──────────────────────────────────────────────────────────
Documents touched this session:
· acme-contract-redline.docx  (edited ×2)
· acme-research-notes.md      (created)
· acme-agreement-background.pdf (read)
──────────────────────────────────────────────────────────
Narrative (required):
> [attorney types here]

Task code: [L200 ▾]   Activity code: [A103 ▾]  (optional)
AI disclosure: [Include in invoice ▾]

[Log entry]   [Skip]   [Switch matter]
```

### WIP Review Gate

Nothing moves from `PENDING` to `APPROVED` without attorney action in WIP review. The sub-agent presents; the attorney decides. Options per entry:

- **Approve** → `advance_entry_status(entry_id, "APPROVED")`
- **Write down** → `write_down_entry(entry_id, new_hours, new_amount, reason)`
- **Write off** → `write_off_entry(entry_id, reason)` — reason required, no silent write-offs
- **Edit narrative** — correction logged as amendment
- **Edit task/activity code** — correction logged

### Billing Guidelines and Pre-Bill Scrubber

Each client carries a `billing_guidelines` object:

```python
{
  "client_id": "acme-commercial",
  "block_billing_allowed": False,
  "travel_time_allowed": False,
  "intraoffice_conference_allowed": "limited",
  "research_requires_preapproval": False,
  "max_daily_hours_without_review": 8.0,
  "forbidden_phrases": [
    "attention to file",
    "review documents",
    "work on matter",
    "various matters"
  ],
  "required_task_codes": True,
  "activity_codes_required": False,
  "ledes_required": True,
  "ai_disclosure_required": True,
  "budget_notice_threshold": 0.75,
  "outside_counsel_guidelines": "Acme OCG v2.1"
}
```

The pre-bill scrubber runs on every entry before WIP review surfaces it, checking:
- Forbidden phrase detection in narrative
- Block billing detection (multiple matters in one narrative entry)
- Missing required task codes
- Missing activity codes when client requires them
- Round hours with no `session_minutes_actual` (reconstruction flag)
- Rate deviation from client agreement > 10%
- Entries that exceed `max_daily_hours_without_review`

Scrubber findings appear inline in the billing panel and WIP review, as warnings — not blocks. The attorney sees the issue and decides. The warning and attorney's response are logged to `audit_log`.

### Budget Tracking

`compute_budget_utilization()` runs on every sweep and every billing panel load:

```python
{
  "client": "acme-commercial",
  "budget_cap": 15000,
  "billed_to_date": 9800,
  "approved_unbilled": 1900,
  "total_committed": 11700,
  "utilization_pct": 78.0,
  "alert_threshold_1": 75,    # configurable
  "alert_threshold_2": 90,
  "alert_status": "WARN"      # CLEAR | WARN | CRITICAL
}
```

Threshold crossings fire to the coordinator, which routes to Client Comms for a draft budget notification and surfaces it in the Daily Closeout Brief.

### Invoice Generation

After WIP review completion for a client, `generate_invoice()`:
1. Queries all `APPROVED` entries for the client and period
2. Groups by matter, computes subtotals and grand total
3. Handles retainer draw-down if configured
4. Writes Markdown invoice exhibit to `invoices` collection
5. Transitions all included entries to `BILLED`
6. Updates client `budget_billed`

### A/R Watchdog

The billing sub-agent monitors invoice aging and retainer status on every sweep:

```python
{
  "invoice_id": "INV-2026-007",
  "issued_at": "2026-05-01",
  "days_outstanding": 28,
  "amount": 4200,
  "status": "ISSUED",
  "client_payment_pattern": "typically_30_days",
  "retainer_balance": 800,
  "retainer_refill_threshold": 1000,
  "wip_since_last_invoice_usd": 1085
}
```

When `days_outstanding` exceeds the client's configured payment window, or when `retainer_balance` drops below `retainer_refill_threshold`, the sub-agent routes a collections or retainer alert to the Daily Closeout Brief with a draft follow-up.

---

## 11. Branch 3 — Client Comms Sub-agent

### Purpose

Ensure no client goes more than a configurable number of days without contact on an active matter. Draft the status update so the attorney doesn't start from blank. Never deliver anything without attorney review and confirmed delivery.

### Communication State Machine

```
TRIGGER_FIRED → DRAFT_GENERATED → DRAFT_APPROVED → QUEUED_FOR_SEND → SENT_CONFIRMED
                                       ↓
                                  DISMISSED_WITH_REASON
```

`last_client_contact` on the matter record updates **only on `SENT_CONFIRMED`**, not on `DRAFT_APPROVED`. This prevents false operational confidence when the draft was approved but never sent.

### Tool Functions

Three separate functions replace the original single `send_draft_to_review()`:

- `approve_client_comm_draft(draft_id, attorney_id)` — marks draft as attorney-approved, records approver
- `queue_client_comm_for_delivery(draft_id, channel)` — moves to send queue via Gmail API draft or clipboard
- `log_client_comm_sent(draft_id, sent_at)` — confirms delivery; this is the only call that updates `last_client_contact`

### Trigger Conditions

| Trigger | Condition | Default Threshold |
|---------|-----------|-------------------|
| `DAYS_SINCE_CONTACT` | No confirmed contact for N days | 14 days |
| `MILESTONE_COMPLETE` | Matter milestone marked complete | Immediate |
| `BUDGET_THRESHOLD` | Budget crosses 75% or 90% | Immediate |
| `DEADLINE_APPROACHING` | `HARD_LEGAL` enters 14-day window | Immediate |
| `INVOICE_ISSUED` | Invoice generated, needs transmission | Immediate |
| `ATTORNEY_INITIATED` | Attorney explicitly requests draft | Immediate |

### Draft Generation

Context packet assembled by coordinator and passed to sub-agent:
- Client profile (name, billing contact, relationship notes)
- Matter summary (status, recent activity, upcoming deadlines, budget position)
- Trigger reason (which condition fired)
- Firm communication style from system prompt
- Prior communications log (summaries of last N contacts — not full content)

Draft is constrained: factual status only, no legal analysis, no strategy, no privileged content. Sub-agent is explicitly prompted to surface facts and status — not conclusions.

### Source-Backed Drafts

Every factual sentence in a draft is sourced. The attorney review panel shows the source for each claim:

```
Draft sentence:
"We received opposing counsel's revised markup on May 21."

Source:
Gmail — From: jsmith@opposingfirm.com, May 21, 2026
Subject: Revised Agreement — Acme Commercial Matter
```

No source → no factual sentence in the draft. The sub-agent flags unsourced claims and leaves them as [ATTORNEY: add detail here] placeholders.

### Gmail API Integration

Approved drafts are written to Gmail as drafts via Gmail API, addressed to the configured billing contact. The attorney reviews in Gmail, edits if needed, and sends manually. `log_client_comm_sent()` is triggered either manually by attorney confirmation in Litt or automatically via Gmail sent-event webhook (v1.1).

---

## 12. Branch 4 — Anomaly Escalation Sub-agent

### Purpose

Find what the other sub-agents weren't specifically looking for. Pattern detection across entries, matters, and attorneys. Flags what doesn't look right before it becomes an invoice rejection, malpractice claim, or billing dispute.

### Billing Anomaly Detectors

| Pattern | Description | Severity | Confidence |
|---------|-------------|----------|------------|
| `STALE_PENDING` | Entry in PENDING > 5 days | 2 | 0.95 |
| `ROUND_HOURS` | Hours are round number, no `session_minutes_actual` | 3 | 0.7 |
| `NARRATIVE_ABSENT` | No narrative or < 10 chars | 3 | 0.95 |
| `NARRATIVE_FORBIDDEN_PHRASE` | Matches client billing guidelines | 4 | 0.9 |
| `POTENTIAL_DUPLICATE` | Same attorney, client, date, overlapping hours | 5 | 0.85 |
| `RATE_DEVIATION` | Rate differs > 10% from agreed rate, no rate-change record | 4 | 0.9 |
| `BUDGET_VELOCITY` | At current rate, budget exceeded within 14 days | 4 | 0.8 |
| `INACTIVE_MATTER` | Active matter, no entries or events in 30+ days | 2 | 0.6 |

### Operational Anomaly Detectors

| Pattern | Description | Severity |
|---------|-------------|----------|
| `UNCONFIRMED_DEADLINE` | HARD_LEGAL within 14 days, no attorney confirmation | 5 |
| `ATTORNEY_UNBILLED_GAP` | Attorney has session data but no PENDING entries in 5+ days | 3 |
| `MATTER_NO_DEADLINES` | Active litigation matter with zero deadlines in system | 3 |
| `INVOICE_OVERDUE` | Invoice issued 30+ days ago, no PAID status | 3 |
| `RETAINER_BELOW_THRESHOLD` | Retainer balance below configured refill trigger | 4 |

### Escalation Scoring

```
escalation_score = severity × confidence
fire_escalation if escalation_score >= 3.0
```

The coordinator receives scored anomalies and routes them:
- Score ≥ 4.5 → immediate notification in next Daily Closeout Brief with ELEVATED flag
- Score ≥ 4.0 (severity 5 only) → CRITICAL flag, immediate brief, backup contact if unacknowledged in 24h
- Score < 4.5 → weekly anomaly digest

### Weekly Anomaly Digest

Every Monday morning (or configurable day), the sub-agent produces a weekly digest:
- All detected anomalies from past 7 days
- Resolution status of prior-week anomalies
- One priority action: highest-severity unresolved anomaly
- Trend: billing pattern improving or degrading over the period

---

## 13. The Ingestion Layer

The ingestion layer is what separates Litt from a better-designed form. It closes the manual entry gap that kills adoption in small firms.

### Google Calendar API (v1.0)

**Access:** Read-only. OAuth 2.0 with `calendar.readonly` scope.

**What Litt reads:**
- Events tagged with `litt:matter:{matter_slug}` in the description or extended properties
- Events in calendars named after matters or clients
- Events with deadline keywords in the title: "deadline," "due," "response," "filing," "hearing," "deposition"

**Processing:**
- Tagged events → automatic matter association → deadline candidate surfaced for attorney verification
- Untagged keyword events → surfaced as unclassified deadline candidates → attorney assigns matter and classification
- Calendar data is **never stored** beyond the structured deadline record created after attorney verification

**Sweep cadence:** On each coordinator sweep and on Calendar webhook notification (push channel, configured at startup).

### Gmail API (v1.0)

**Access:** Read-only for parsing; write access limited to draft creation. OAuth 2.0 with `gmail.readonly` + `gmail.compose` scopes.

**What Litt reads:**
- Emails from opposing counsel (identified by matter contact records)
- Emails from court addresses (Ohio courts domain list configured at setup)
- Subject line and body scanning for deadline language patterns

**Deadline language patterns detected:**
- "due by [date]"
- "deadline of [date]"
- "opposition due [date]"
- "response required by [date]"
- "30 days from [date]"
- "you have [N] days to"

**Processing:** Detected candidate → structured unverified deadline record with `source_excerpt` populated → surfaced for attorney verification. No deadline is activated from email parsing alone.

**Draft export:** Approved client comms drafts written to Gmail as drafts via `gmail.compose`. Attorney addresses and sends from their own Gmail client.

**Privacy:** Litt reads email metadata and body for deadline parsing during sweeps. Email content is **not stored** in Firestore — only the extracted `source_excerpt` (the specific sentence containing the deadline) is retained, attached to the deadline record.

### Manual Entry (v1.0)

Available as fallback for all ingested data types:
- `/litt:deadline-add` — attorney enters deadline directly, bypasses verification queue
- `/litt:time-entry` — manual time entry for work outside a Litt-monitored session
- `/litt:client-add` and `/litt:matter-add` — cold-start and ongoing matter management

### v1.1 Ingestion Roadmap (stated in submission)

- CSV import from Clio, MyCase, PracticePanther, Smokeball
- Outlook / Microsoft 365 Calendar and Mail integration
- Court docket notification email parsing (PACER, state court notice services)
- Browser extension for session time capture with activity log
- Webhook integrations for supported practice management systems

---

## 14. The Deterministic Tool Layer

### Why It Exists

Every action that modifies data goes through a Python function, not a language model. The LLM reasons and constructs tool calls with explicit parameters. The tool function validates those parameters, applies business logic, writes to Firestore, and returns a structured result.

A language model that could directly write billing records is only as reliable as its output on any given invocation. A legal practice cannot accept that reliability level for financial records that may be introduced in fee dispute proceedings, disciplinary hearings, or malpractice defense.

### Tool Inventory

**Billing tools:**
| Function | Description | Requires Attorney Confirmation |
|----------|-------------|-------------------------------|
| `write_time_entry(entry)` | Creates entry in CAPTURED or PENDING | No (captures); Yes (logs) |
| `advance_entry_status(entry_id, new_status, reason, attorney_id)` | State machine transition, validates legality | Yes — PENDING→APPROVED, APPROVED→BILLED |
| `write_down_entry(entry_id, new_hours, new_amount, reason, attorney_id)` | Write-down with preserved original | Yes |
| `write_off_entry(entry_id, reason, attorney_id)` | Write-off, reason required | Yes |
| `compute_budget_utilization(client_id)` | Read-only budget position | No |
| `generate_invoice(client_id, period)` | Creates invoice, transitions entries to BILLED | Yes |
| `export_ledes(invoice_id)` | Generates LEDES 1998B file | Yes |

**Deadline tools:**
| Function | Description | Requires Attorney Confirmation |
|----------|-------------|-------------------------------|
| `log_deadline_event(deadline_id, event_type, attorney_id, response, notes)` | Appends event record | No (system events); Yes (attorney responses) |
| `verify_deadline(deadline_id, attorney_id, confirmed_date, classification)` | Activates unverified deadline | Yes |
| `supersede_deadline(old_id, new_date, attorney_id, reason)` | Creates extension record | Yes |

**Client comms tools:**
| Function | Description | Requires Attorney Confirmation |
|----------|-------------|-------------------------------|
| `approve_client_comm_draft(draft_id, attorney_id)` | Records approval | Yes |
| `queue_client_comm_for_delivery(draft_id, channel)` | Moves to send queue | No (follows approval) |
| `log_client_comm_sent(draft_id, sent_at)` | Confirms delivery, updates `last_client_contact` | No (system call on confirmed send) |

**System tools:**
| Function | Description |
|----------|-------------|
| `log_escalation(escalation)` | Records escalation brief |
| `log_anomaly(anomaly)` | Records detected anomaly with score |
| `log_audit_event(event)` | Writes to immutable audit log — called by all other functions |
| `dismiss_alert(alert_id, reason, attorney_id)` | Dismisses any alert with mandatory reason |

### Validation Rules (Applied by Every Write Function)

1. Schema validation — required fields present, types correct, enums valid
2. State machine validation — requested transition is legal
3. Business rule validation — 6-minute rounding, rate on file for attorney/client, LEDES fields populated if export requested
4. Duplicate detection — for `write_time_entry()`: same attorney, client, matter, date, within same 2-hour window
5. Authorization check — requesting attorney has permission scope for this action on this matter
6. Billing guideline check — entry does not violate client `billing_guidelines`

Validation failure → structured error returned to sub-agent → surfaced to attorney with specific explanation. No silent failures. No auto-correction.

---

## 15. Data Architecture

### Firestore Collection Schema

**`attorneys`**
```python
{
  "id": "dana-strand",
  "name": "Dana Strand",
  "email": "dana@strand-okafor.com",
  "default_rate": 350,
  "billing_increment": 0.1,
  "timekeeper_id": "ds001",
  "timekeeper_classification": "AT",  # AT | PA | OF | CL
  "rate_overrides": {"acme-commercial": 325},
  "permission_scope": ["billing", "deadlines", "comms", "admin"],
  "is_backup_contact": True,
  "created_at": "timestamp"
}
```

**`clients`**
```python
{
  "id": "acme-commercial",
  "name": "Acme Commercial Partners LLC",
  "billing_contact": "James Whitfield",
  "billing_email": "jwhitfield@acme-commercial.com",
  "billing_address": "...",
  "arrangement": "hourly",            # hourly | flat_fee | contingency | hybrid
  "budget_cap": 15000,
  "budget_billed": 9800,
  "retainer_balance": 800,
  "retainer_refill_threshold": 1000,
  "ledes_client_id": "ACME-COM-001",
  "last_client_contact": "timestamp",
  "client_silence_threshold_days": 14,
  "billing_guidelines": { ... },      # full object as described in Branch 2
  "engagement_terms": {
    "fee_type": "hourly",
    "scope_summary": "Review and negotiate commercial vendor agreements",
    "excluded_work": [],
    "retainer_required": True,
    "retainer_amount": 5000,
    "evergreen_retainer": True,
    "budget_cap": 15000,
    "client_approval_required_above": 15000,
    "outside_counsel_guidelines_attached": True,
    "engagement_letter_signed": True,
    "engagement_letter_date": "2026-01-15"
  },
  "notes": "Prefers monthly invoices. Budget warning at 75%.",
  "created_at": "timestamp"
}
```

**`matters`**
```python
{
  "id": "acme-contract-review-2026",
  "client_id": "acme-commercial",
  "name": "Acme Commercial — Vendor MSA Review",
  "type": "transactional",           # transactional | litigation | regulatory | advisory
  "status": "ACTIVE",                # PROSPECT | CONFLICT_CHECK | ENGAGEMENT_PENDING | ACTIVE | PAUSED | CLOSING | CLOSED
  "assigned_attorneys": ["dana-strand"],
  "opened_at": "timestamp",
  "last_activity": "timestamp",
  "last_client_contact": "timestamp"
}
```

**`time_entries`** — Full schema in Branch 2 above.

**`deadlines`** — Full schema in Branch 1 above.

**`deadline_events`** (append-only)
```python
{
  "id": "dle-001",
  "deadline_id": "dl-mercer-resp-001",
  "event_type": "ESCALATION_SENT | ATTORNEY_CONFIRMED | ATTORNEY_RESOLVED | ATTORNEY_EXTENDED | ATTORNEY_DELEGATED | DISMISSED_WITH_REASON | BACKUP_NOTIFIED",
  "escalation_level": "14_DAY",
  "attorney_id": "dana-strand",
  "response": "CONFIRM",
  "notes": "...",
  "created_at": "timestamp"
}
```

**`client_communications`**
```python
{
  "id": "comm-001",
  "matter_id": "acme-contract-review-2026",
  "client_id": "acme-commercial",
  "trigger": "DAYS_SINCE_CONTACT",
  "draft_body": "...",
  "source_map": [                    # source-backed drafts
    {
      "sentence": "We received opposing counsel's revised markup on May 21.",
      "source_type": "email",
      "source_id": "email-abc123",
      "source_excerpt": "Revised Agreement attached — May 21, 2026"
    }
  ],
  "status": "DRAFT_APPROVED",        # DRAFT_GENERATED | DRAFT_APPROVED | QUEUED_FOR_SEND | SENT_CONFIRMED | DISMISSED_WITH_REASON
  "approved_by": "dana-strand",
  "approved_at": "timestamp",
  "sent_confirmed_at": None,
  "dismissal_reason": None
}
```

**`invoices`**
```python
{
  "id": "INV-2026-007",
  "client_id": "acme-commercial",
  "period_start": "2026-05-01",
  "period_end": "2026-05-31",
  "total_hours": 4.2,
  "total_amount": 1470.00,
  "retainer_draw": 1470.00,
  "retainer_balance_after": 530.00,
  "exhibit_md": "...",
  "ledes_file_path": "gs://litt-invoices/INV-2026-007.ledes",
  "status": "ISSUED",                # DRAFT | ISSUED | PAID | DISPUTED | VOID
  "issued_at": "timestamp",
  "paid_at": None,
  "days_outstanding": 28
}
```

**`audit_log`** (immutable — CREATE only at Firestore rule level)
```python
{
  "id": "aud-001",
  "tier": "operational",             # engineering | operational | legal_defensibility
  "event_type": "ENTRY_STATUS_ADVANCED | DEADLINE_CONFIRMED | INVOICE_GENERATED | COMM_SENT | ANOMALY_DISMISSED | ...",
  "actor": "dana-strand",            # attorney_id or "system"
  "entity_type": "time_entry | deadline | invoice | communication | anomaly",
  "entity_id": "...",
  "before_state": { ... },
  "after_state": { ... },
  "notes": "...",
  "created_at": "timestamp"
}
```

### Data Principles

- All financial records are append-only. No deletes on `time_entries`, `deadline_events`, or `audit_log` at the Firestore rule level.
- `audit_log` is CREATE-only. No client application can UPDATE or DELETE an audit record.
- Email content is never stored — only extracted `source_excerpt` strings attached to deadline records.
- Gmail and Calendar OAuth tokens stored in Secret Manager, not Firestore.
- Client email addresses stored with field-level encryption (Cloud KMS).

---

## 16. Human-in-the-Loop Design

### The Four Autonomy Levels

**Level 0 — Fully autonomous, no notification:**
- Sweep finds nothing actionable
- `last_activity` timestamp updates
- Budget utilization computation
- Anomaly detected below escalation threshold, logged for weekly digest

**Level 1 — Autonomous with logged notification (digest only):**
- `SOFT_INTERNAL` or `ADMINISTRATIVE` deadline in digest window
- Anomaly score < 3.0 — weekly digest inclusion
- Client contact counter approaching threshold (not yet crossed)

**Level 2 — Requires attorney acknowledgment:**
- Any `HARD_LEGAL` or `HARD_CONTRACTUAL` deadline escalation
- Any anomaly with score ≥ 3.0
- Any budget threshold crossing
- Any draft communication surfaced for review

**Level 3 — Requires explicit attorney instruction with specific parameters:**
- Any billing entry state transition
- Any invoice generation
- Any communication approval and delivery
- Any deadline resolution or extension
- Any alert dismissal (requires reason string)

### The Pause-and-Wait Pattern

When Litt encounters a Level 3 situation mid-workflow, it does not proceed, guess, or time out. It:

1. Saves workflow state to Firestore with status `PAUSED_AWAITING_INPUT`
2. Surfaces escalation brief to attorney interface
3. Waits for explicit response
4. On valid response, resumes from saved state
5. Logs response and resumed action to `audit_log`

Paused workflows never expire. They persist in the attorney interface as pending actions until resolved. If unacknowledged for 48 hours (configurable), the escalation re-fires with a priority increment to the backup contact.

---

## 17. Trust and Guardrail Architecture

### The Four Tiers

**Tier 1 — Data Write Isolation**
The LLM cannot write to Firestore. Period. Every data mutation goes through a tool function. The LLM produces a structured tool call; the function validates and writes — or rejects with a structured error.

**Tier 2 — State Machine Enforcement**

```python
VALID_TRANSITIONS = {
    "CAPTURED":    ["PENDING"],
    "PENDING":     ["APPROVED", "WRITTEN_OFF"],
    "APPROVED":    ["BILLED", "WRITTEN_OFF"],
    "BILLED":      ["CLOSED"],
    "WRITTEN_OFF": [],    # terminal
    "CLOSED":      []     # terminal
}
```

Hardcoded in `advance_entry_status()`. The LLM cannot reason around it.

**Tier 3 — Attorney-Confirmation Gates**
Tool functions that advance entries, generate invoices, or confirm delivery require `attorney_confirmed: True` and `confirming_attorney_id`. These parameters are only set by the coordinator after parsing an explicit attorney instruction. Sub-agents cannot set them autonomously.

**Tier 4 — Audit Log Immutability**
Every tool function call — successful or rejected — writes to `audit_log`. Firestore security rules for `audit_log` permit CREATE only. No UPDATE, no DELETE — not by the application, not by any client with valid credentials.

---

## 18. The Observability Layer

Three distinct tiers with different audiences and access controls.

### Tier 1 — Engineering Observability (Internal)

Audience: Developer / system admin. Not visible to firm users by default.

- ADK agent invocation traces → Cloud Trace
- Tool function call logs with parameters and return values → Cloud Logging
- LLM token usage and cost per invocation
- Latency per sub-agent call
- Firestore read/write operation counts
- Error rates and retry attempts
- Gmail / Calendar API call counts and quota usage

### Tier 2 — Operational Audit (Attorney-visible)

Audience: Attorneys and firm administrator. Clean, human-readable. Visible in the Litt dashboard.

- Deadline confirmed / extended / resolved (who, when, what)
- Invoice generated (by whom, for which client, total amount)
- Time entry approved / written down / written off (who approved, reason)
- Draft communication approved / sent / dismissed
- Anomaly escalated / dismissed with reason
- Budget threshold crossed

### Tier 3 — Legal Defensibility Record (Exportable)

Audience: Malpractice defense, bar grievance response, client fee disputes, partner oversight.

A structured export from the `audit_log` collection, scoped to a specific matter or time period. Includes:

- Deadline history with full source record and escalation chain
- Attorney confirmation timestamps
- Billing approval trail (each entry: who approved, when, any write-downs)
- Client communication log (drafts, approvals, confirmed sends)
- Budget warnings sent and attorney responses
- Anomaly detections and resolutions
- System actions and their triggers

This export is what an attorney shows an insurance carrier at malpractice renewal. It is what a managing partner reviews after a matter closes badly. It is what Litt's malpractice defense positioning rests on.

### Performance Metrics (Attorney Dashboard)

| Metric | Description |
|--------|-------------|
| `ai_cost_per_hour_billed` | Total `ai_cost_usd` ÷ hours billed, per matter |
| `ai_efficiency_ratio` | `ai_cost_usd` ÷ billing amount — AI cost as % of revenue |
| `avg_time_to_approve` | Days between entry creation and WIP approval |
| `billing_panel_completion_rate` | Sessions completed vs. skipped |
| `anomaly_resolution_rate` | Anomalies flagged vs. resolved within 7 days |
| `client_contact_cadence` | Days between confirmed client contacts per matter |
| `invoice_realization_rate` | Billed vs. collected, per client |

---

## 19. The Attorney Interface

### React Dashboard (Cloud Run)

**Homepage: The Daily Closeout Brief**
As designed in Section 8. This is what an attorney sees when they open Litt. Every item is actionable inline. Completed items collapse and archive.

**Matter view**
- Active matters with budget utilization bars
- Deadline timeline per matter
- Recent time entries and WIP totals
- Client contact history

**Billing**
- WIP review panel (all pending entries)
- Invoice exhibit generation
- LEDES export
- A/R dashboard (outstanding invoices, retainer balances)
- AI billing provenance report per matter

**Deadlines**
- Unverified deadline queue
- Active deadline timeline
- Deadline event history (the malpractice defense record)

**Audit**
- Operational audit log (Tier 2)
- Legal defensibility export (Tier 3) — date-scoped, matter-scoped

### Email Digest

Sent at configured closeout time. Plain HTML, mobile-readable. Each section of the Daily Closeout Brief is replicated with deep links:

- `litt.run.app/deadline/confirm/[id]` — one-click deadline confirmation
- `litt.run.app/billing/wip/[entry_id]` — opens specific WIP entry for review
- `litt.run.app/comms/draft/[draft_id]` — opens client comms draft
- `litt.run.app/budget/[client_id]` — opens budget alert panel

The email digest is not a summary of the dashboard — it is the same brief, rendered for email, with working action links. An attorney who lives in email should be able to clear most of a routine Daily Closeout Brief without opening the dashboard.

### Multi-Attorney Support

The data model is multi-attorney from day one:
- Each attorney has their own rate card and permission scope
- The coordinator routes escalations to the responsible attorney per matter
- Backup contacts are configured per firm
- The WIP review aggregates entries by attorney but allows firm-level admin view

The v1.0 demo is scoped to one attorney (Dana Strand at Strand & Okafor LLP) for the two-minute video constraint. The multi-attorney capability is demonstrated in the written submission through the data model and permission scope documentation, and is live in the deployed system with two attorneys configured in the Strand & Okafor seed data.

---

## 20. Synthetic Demo Firm — Strand & Okafor LLP

### Firm Profile

**Firm:** Strand & Okafor LLP  
**Location:** Cleveland, OH  
**Practice:** General civil — commercial litigation, transactional, employment  
**Attorneys (2):**
- **Dana Strand** — Partner, $350/hr, 15 years. Primary demo attorney. Full permission scope.
- **Kofi Okafor** — Partner, $375/hr, 12 years. Secondary attorney. Full permission scope. Backup contact.

**Demo focus:** Dana Strand's Daily Closeout Brief on May 29, 2026.

### Active Matters (4)

| Matter ID | Client | Type | Status | Budget | Notes |
|-----------|--------|------|--------|--------|-------|
| `mercer-v-dunlap` | Mercer Industries | Litigation | ACTIVE | $25,000 | **HARD_LEGAL deadline at 6 days** |
| `reyes-acquisition` | Reyes Family Holdings | Transactional | ACTIVE | $18,000 | **HARD_CONTRACTUAL deadline at 11 days** |
| `acme-contract-review` | Acme Commercial Partners | Transactional | ACTIVE | $15,000 | **78% budget utilization** |
| `whitmore-employment` | Whitmore Group | Employment | ACTIVE | $12,000 | 16 days since client contact |

### Time Entries (8, Various States)

| ID | Matter | Attorney | Hours | Amount | Status | Note |
|----|--------|----------|-------|--------|--------|------|
| te-001 | mercer-v-dunlap | dana-strand | 1.4h | $490 | PENDING | **No narrative** — anomaly |
| te-002 | mercer-v-dunlap | dana-strand | 0.5h | $175 | APPROVED | Clean |
| te-003 | reyes-acquisition | dana-strand | 0.8h | $280 | PENDING | Clean, narrative ready |
| te-004 | reyes-acquisition | kofi-okafor | 1.2h | $450 | PENDING | **Round hours, no session data** — anomaly |
| te-005 | acme-contract-review | dana-strand | 0.8h | $280 | PENDING | **Contains "review documents"** — pre-bill scrubber hit |
| te-006 | acme-contract-review | dana-strand | 2.0h | $700 | APPROVED | **Round hours, no session data** — anomaly (logged) |
| te-007 | whitmore-employment | dana-strand | 0.6h | $210 | BILLED | Closed on INV-2026-006 |
| te-008 | whitmore-employment | kofi-okafor | 1.1h | $412.50 | APPROVED | Clean |

**Total WIP value triggering review: $1,225 (PENDING entries for Dana)**

### Deadlines (2 Active)

| ID | Matter | Description | Due Date | Days Out | Class | Verified | Confirmed |
|----|--------|-------------|----------|----------|-------|----------|-----------|
| dl-mercer-001 | mercer-v-dunlap | Opposition to MSJ due | Jun 4, 2026 | **6 days** | `HARD_LEGAL` | Yes | **No — escalation fires** |
| dl-reyes-001 | reyes-acquisition | LOI acceptance window closes | Jun 9, 2026 | **11 days** | `HARD_CONTRACTUAL` | Yes | No — digest mention |

### Budget Position

| Client | Cap | Committed | Utilization | Alert Status |
|--------|-----|-----------|-------------|--------------|
| Acme Commercial Partners | $15,000 | $11,700 | **78%** | ⚠ WARN |
| Mercer Industries | $25,000 | $8,400 | 34% | CLEAR |
| Reyes Family Holdings | $18,000 | $6,200 | 34% | CLEAR |
| Whitmore Group | $12,000 | $4,850 | 40% | CLEAR |

### Client Contact Log

| Client | Last Confirmed Contact | Days Since |
|--------|----------------------|-----------|
| Mercer Industries | May 22, 2026 | 7 |
| Reyes Family Holdings | May 25, 2026 | 4 |
| Acme Commercial Partners | May 21, 2026 | 8 |
| Whitmore Group | **May 13, 2026** | **16** — trigger fires |

---

## 21. Hackathon Submission Strategy

### Track

**Track 1 — Build (Net-New Agents).** All Litt code authored after April 22, 2026. Architecture, data model, and design decisions are original; they draw on domain expertise from prior legal operations work, not on any prior codebase.

### Mandatory Technology Compliance

| Requirement | Litt's Implementation |
|-------------|----------------------|
| Intelligence: Gemini API or Vertex AI LLM | Gemini 2.5 Pro via Vertex AI — all agent reasoning |
| Orchestration: ADK or supported framework | Google ADK — coordinator + four sub-agents |
| Infrastructure: Cloud Run, Agent Engine, or GKE | Cloud Run — agent backend and React dashboard |

### Two-Minute Demo Script

**Total runtime: 1:55**

```
0:00–0:10  [VOICEOVER over blank dashboard]
           "A solo attorney at a small civil firm ends every day
            not knowing what slipped. Litt fixes that."

0:10–0:25  [Daily Closeout Brief appears — live system, Strand & Okafor LLP]
           Camera lingers on the brief structure:
           - HARD_LEGAL deadline at 6 days (red badge)
           - $1,225 in unapproved time
           - Acme Commercial at 78% budget
           - Whitmore Group: 16 days since client contact

0:25–0:50  [Deadline confirmation — ONE click]
           Attorney clicks Confirm on the HARD_LEGAL deadline
           Show: `log_deadline_event()` writes to Firestore (brief flash of audit record)
           Voiceover: "Every confirmation is logged. Every escalation is documented.
                       If there's ever a malpractice claim, this is the record."

0:50–1:15  [WIP Review — TWO entries]
           Attorney opens billing panel for te-005 (Acme)
           Pre-bill scrubber warning inline: "review documents" flagged
           Attorney edits narrative, approves
           te-001 (Mercer): no narrative — attorney adds, approves
           Voiceover: "Litt flagged the billing guideline violation before
                       the invoice went out."

1:15–1:38  [Client comms draft — ONE click approval]
           Whitmore Group draft surfaces — 16 days since contact
           Source-backed: each sentence shows its source
           Attorney approves, draft goes to Gmail
           `last_client_contact` updates on SENT_CONFIRMED (explained in voiceover)
           Voiceover: "The draft is Litt's. The send is the attorney's. Always."

1:38–1:55  [Architecture diagram — static]
           Coordinator → Sub-agents → Tool Layer → Firestore
           One clean graphic, labels visible
           Closer: "Litt. The operational control layer for small law firms."
```

### Scoring Map

| Criterion | Weight | Litt's Answer |
|-----------|--------|---------------|
| Technical Implementation | 30% | ADK multi-agent, Gemini 2.5 Pro, deterministic tool layer, state machine enforcement, immutable audit log, Google Calendar + Gmail ingestion, Cloud Run deployment |
| Business Case | 30% | Malpractice defense artifact, ABA FO 512 AI billing compliance, LEDES 1998B with correct field mapping, pre-bill scrubber protecting realization, underserved small-firm market |
| Innovation & Creativity | 20% | `ai_cost_usd` per entry (no existing legal billing tool does this), source-backed client drafts, scoring-based anomaly detection, Daily Closeout Brief as ritual product design |
| Demo & Presentation | 20% | Two-minute demo covering all four branches in one flow, live deployed system, architecture diagram, clean written description |

### Submission Package

| Artifact | Description |
|----------|-------------|
| `github.com/emtcmca/litt` | Public repo. Python ADK agents, React dashboard, Firestore schema, seed data script, `/docs/architecture.png`. |
| `litt.run.app` (or `litt-[hash].run.app`) | Live Cloud Run deployment. Strand & Okafor LLP seed data pre-loaded. No login required for judges. |
| Demo video | 1:55. Recorded against live system. Voiceover. Architecture diagram at end. |
| Devpost description | Business case + tech summary + architecture diagram + findings + third-party disclosures (Gmail API, Google Calendar API, Gemini API). |

---

## 22. What Litt Explicitly Does Not Do

- Give legal advice
- Access matter file content
- Send client communications without attorney confirmation and `SENT_CONFIRMED` status
- Write billing entries without attorney-initiated action
- Approve billing entries on behalf of an attorney
- Store email content (only extracted deadline excerpts)
- Manage trust accounts (retainer tracking is informational only)
- Replace practice management software
- Perform conflict checks (v1.1 scope)
- Handle new matter intake workflow (v1.1 scope)

---

## 23. v1.1 Roadmap — Stated in Submission

The following capabilities are architecturally designed for in v1.0 but not implemented:

| Feature | Why v1.1 |
|---------|----------|
| New matter intake + conflict precheck workflow | Adds a third workflow to the demo; cuts scope for clarity |
| CSV import from Clio, MyCase, PracticePanther | Integration work; stated as the primary adoption path |
| Outlook / Microsoft 365 Calendar and Mail | Mirror of Google integrations; high commercial value |
| Agent Engine Runtime migration | Cloud Run is simpler for v1.0; Agent Engine is the production path |
| Browser/desktop session time capture | Requires extension build; highest-value capture improvement |
| Gmail sent-event webhook for SENT_CONFIRMED | Delivery confirmation automation; v1.0 uses manual confirmation |
| Push notifications | Mobile app or PWA; v1.0 is web + email |
| Client portal — attorney-approved monthly status reports | Client-facing product layer; builds on existing data |
| QuickBooks / accounting integration | A/R reconciliation automation |
| Court docket integration (PACER, state systems) | High-value for litigation firms |
| A2A protocol implementation | Required for Track 3 / Cloud Marketplace; explicit upgrade path |

---

*End of specification.*

*Next step: Build sprint planning and task breakdown, then Branch 2 Python implementation — Firestore schema initialization, tool layer, billing sub-agent.*
