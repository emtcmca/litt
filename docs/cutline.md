# Litt — v1.0 Cut Line

**Version:** 1.0  
**Purpose:** Defines what ships, what is stubbed, and what does not exist in the hackathon submission. This file prevents scope creep during the sprint. If a feature is in the "do not build" category, do not build it even if it seems quick.

---

## Category Definitions

**SHIPS REAL:** Fully implemented, tested, deployed. Judges can use it. Demo depends on it.

**SHIPS STUBBED:** Interface exists in the codebase (function signature, API route, UI component). Real implementation is a no-op, fixture return, or preview page. Demonstrates the architecture without the full integration cost.

**DOES NOT SHIP:** Not in the codebase at all. Mentioned in v1.1 roadmap in Devpost description. Do not implement even a stub.

---

## Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| GCP project, APIs enabled | SHIPS REAL | Day 1 |
| Firestore with security rules | SHIPS REAL | CREATE-only on audit_log and deadline_events |
| Cloud Run backend | SHIPS REAL | FastAPI, Python |
| Cloud Run dashboard | SHIPS REAL | React, nginx |
| Secret Manager | SHIPS REAL | API keys, service account |
| Cloud Scheduler (4hr sweep) | SHIPS STUBBED | Config exists; `POST /api/sweep` is the manual trigger |
| Firestore event triggers | SHIPS STUBBED | Architecture documented; not wired for v1.0 |
| Cloud Logging + Trace | SHIPS REAL | Engineering observability |
| Cloud KMS field encryption | SHIPS STUBBED | Marked in data model; encryption call is a passthrough in v1.0 |

---

## Data Layer

| Feature | Status | Notes |
|---------|--------|-------|
| All Firestore collections with `firm_id` | SHIPS REAL | firms/{firm_id}/collection/{id} |
| Pydantic models (models.py) | SHIPS REAL | Canonical type definitions |
| TypeScript types (types.ts) | SHIPS REAL | Mirror of Pydantic models |
| Seed data script (seed_demo.py) | SHIPS REAL | Idempotent, strand-okafor — expanded corpus: AI_DISCLOSURE_GAP (te-010), DUPLICATE_ENTRY_CANDIDATE (te-011), Budget CRITICAL (acme 92%), multi-signal Mercer (silence + deadline + billing), Rivera conflict_flagged in brief |
| Demo reset script (reset_demo.py) | SHIPS REAL | Deletes + re-seeds firm data |
| Demo readiness check | SHIPS REAL | GET /api/demo/ready |
| Demo clock (LITT_DEMO_DATE) | SHIPS REAL | Every date call uses config.get_effective_date() |
| Multi-tenancy (firm_id) | SHIPS REAL | Data model enforces it; UI scoped to demo firm |

---

## Tool Layer

| Feature | Status | Notes |
|---------|--------|-------|
| `log_audit_event()` | SHIPS REAL | Called by every other tool |
| `advance_entry_status()` | SHIPS REAL | State machine enforced in Python |
| `write_time_entry()` | SHIPS REAL | 6-min rounding, duplicate detection |
| `write_down_entry()` | SHIPS REAL | Reason required |
| `write_off_entry()` | SHIPS REAL | Reason required |
| `compute_budget_utilization()` | SHIPS REAL | Read-only, deterministic |
| `generate_invoice()` | SHIPS REAL | Creates invoice document |
| `export_ledes()` | SHIPS REAL | Correct field mapping (task_code ≠ activity_code) |
| `log_deadline_event()` | SHIPS REAL | Append-only |
| `verify_deadline()` | SHIPS REAL | Activates unverified candidates |
| `supersede_deadline()` | SHIPS REAL | Creates extension record |
| `approve_client_comm_draft()` | SHIPS REAL | Does NOT update last_client_contact |
| `queue_client_comm_for_delivery()` | SHIPS REAL | Routes to DemoDraftOutbox |
| `log_client_comm_sent()` | SHIPS REAL | ONLY this updates last_client_contact |
| `dismiss_alert()` | SHIPS REAL | Reason required |
| `log_escalation()` | SHIPS REAL | |
| `log_anomaly()` | SHIPS REAL | |
| Idempotency key check | SHIPS REAL | All write functions |
| Optimistic locking | SHIPS REAL | expected_status on state-advancing calls |

---

## Pre-Bill Scrubber

| Feature | Status | Notes |
|---------|--------|-------|
| Forbidden phrase detection | SHIPS REAL | Case-insensitive substring, returns matched phrase |
| Block billing detection | SHIPS REAL | Multiple matter references in one narrative |
| Missing task code | SHIPS REAL | When client requires |
| Missing activity code | SHIPS REAL | When client requires |
| Round hours without session data | SHIPS REAL | hours is whole number AND session_minutes_actual is null |
| Rate deviation > 10% | SHIPS REAL | Compared to attorney rate override or default |
| Max daily hours exceeded | SHIPS REAL | Sum of same-day entries per attorney per client |
| Scrubber runs on sweep AND on-demand | SHIPS REAL | GET /api/billing/scrubber/{entry_id} |

---

## Agents

| Feature | Status | Notes |
|---------|--------|-------|
| Coordinator routing (deterministic Python) | SHIPS REAL | Not LLM routing |
| Coordinator brief synthesis (Gemini) | SHIPS REAL | Narrative synthesis only |
| Billing sub-agent | SHIPS REAL | Thin ADK wrapper around deterministic tools |
| Deadline sub-agent | SHIPS REAL | Thin ADK wrapper |
| Comms sub-agent (draft generation) | SHIPS REAL | FactPacket → Gemini → validated draft |
| Conflict-flagged deadline extraction | SHIPS REAL | deadline_agent calls Gemini to extract date from source email; conflict_flagged deadlines surface in brief with source email viewer |
| Anomaly sub-agent | SHIPS REAL | Fully deterministic detectors |
| Pause-and-wait pattern | SHIPS REAL | PAUSED_AWAITING_INPUT workflow state |
| Multi-agent parallel execution | SHIPS REAL | For compound signals on same matter |
| ADK conversation history | SHIPS REAL | |

---

## Ingestion

| Feature | Status | Notes |
|---------|--------|-------|
| Gmail fixture adapter | SHIPS REAL | DemoFixtureGmailSource |
| Calendar fixture adapter | SHIPS REAL | DemoFixtureCalendarSource |
| Ingestion signal deduplication | SHIPS REAL | ingestion_signals collection + hash check |
| Prompt injection hardening | SHIPS REAL | Hardcoded extraction system prompt |
| Gmail OAuth (real) | SHIPS STUBBED | RealGmailOAuthSource interface exists; impl is v1.1 |
| Calendar OAuth (real) | SHIPS STUBBED | Same pattern |
| Calendar push webhook | DOES NOT SHIP | v1.1 |
| Manual timer (start/stop) | SHIPS REAL | Simple wall-clock capture for v1.0 |
| Browser extension | DOES NOT SHIP | v1.1 |

---

## Brief Assembler

| Feature | Status | Notes |
|---------|--------|-------|
| Brief JSON (all 5 sections) | SHIPS REAL | GET /api/brief |
| Brief renders from live Firestore | SHIPS REAL | Not hardcoded |
| Deadlines section | SHIPS REAL | Ordered by severity |
| Time entries section | SHIPS REAL | With scrubber warnings inline |
| Budget risks section | SHIPS REAL | With utilization percentage |
| Client silence section | SHIPS REAL | With days count |
| Anomalies section | SHIPS REAL | With severity badges |
| Resolved today collapse | SHIPS REAL | Items move when attorney takes action |
| Weekly anomaly digest | SHIPS STUBBED | Data model ready; delivery is v1.1 |

---

## Dashboard (React)

| Feature | Status | Notes |
|---------|--------|-------|
| Daily Closeout Brief homepage | SHIPS REAL | Primary demo surface |
| Deadline action modal | SHIPS REAL | Confirm / Verify / Extend / Dismiss; Verify action for conflict_flagged deadlines calls verify_deadline tool |
| WIP review modal | SHIPS REAL | Approve / Write down / Write off |
| Client comms draft review modal | SHIPS REAL | Source attribution per sentence |
| Budget alert panel | SHIPS REAL | |
| Anomaly detail modal | SHIPS REAL | |
| Audit event drawer | SHIPS REAL | Shows on action completion |
| Demo mode banner | SHIPS REAL | Always visible when LITT_DEMO_MODE=true |
| Deep link routing | SHIPS REAL | All 6 route patterns |
| Full matter view page | DOES NOT SHIP | v1.1 |
| Full billing view page | DOES NOT SHIP | v1.1 |
| Full deadline timeline page | DOES NOT SHIP | v1.1 |
| Full audit log page | SHIPS REAL | /audit — filterable by tier, entity_type, actor; expandable before/after state; append-only note visible |
| Legal defensibility export UI | DOES NOT SHIP | v1.1 |
| LEDES export UI | SHIPS STUBBED | Endpoint exists; download button in demo |
| Source email viewer | SHIPS REAL | DeadlineModal shows full source email body for conflict_flagged deadlines |
| A/R dashboard | SHIPS STUBBED | Data computed; UI is single card in brief |

---

## Email Digest

| Feature | Status | Notes |
|---------|--------|-------|
| Email digest HTML template | SHIPS REAL | |
| Deep links in digest | SHIPS REAL | Navigate to Litt panels, not action executors |
| Digest preview page (/email-preview) | SHIPS REAL | Shows what would be sent |
| Real email delivery (SendGrid/Gmail) | SHIPS STUBBED | Config exists; demo uses preview page |
| Cloud Scheduler digest trigger | SHIPS STUBBED | Same as sweep scheduler |

---

## Auth and Access

| Feature | Status | Notes |
|---------|--------|-------|
| Demo mode (no login, strand-okafor) | SHIPS REAL | For judges |
| Demo mode banner | SHIPS REAL | |
| Service account auth (backend→Firestore) | SHIPS REAL | |
| Attorney auth (production) | DOES NOT SHIP | v1.1 |
| Multi-attorney routing UI | SHIPS STUBBED | Data model supports it; UI shows one attorney |
| Ethical wall / matter access control | DOES NOT SHIP | v1.1 |

---

## Do Not Build During Sprint

These features are mentioned in context or seem like quick additions. Do not build them:

- CSV import (Clio, MyCase, PracticePanther)
- Outlook / Microsoft 365 integration
- Court docket integration (PACER)
- Browser / desktop session capture extension
- Client portal
- QuickBooks / accounting integration
- A2A protocol
- Agent Engine Runtime migration
- Conflict check workflow
- New matter intake workflow
- Push notifications (mobile)
- Full LEDES UI wizard
- Full legal defensibility export (beyond the stub)
- Real-time Firestore triggers (beyond stub)
- Multi-firm UI
- Production authentication system

---

## Submission Claims

What the Devpost written description will say about these items:

**Gmail and Calendar integration:**
> "v1.0 ingestion demonstrates the deadline detection pipeline using seeded fixture data. The Gmail and Calendar adapter interfaces are implemented in the codebase. Real OAuth integration — which requires Google restricted-scope verification for production Gmail access — is the v1.1 deployment path."

**Email digest:**
> "The email digest template and deep-link routing are fully implemented. v1.0 includes a digest preview page at /email-preview. Live delivery via SendGrid is configured and is the v1.1 activation step."

**Session capture:**
> "v1.0 includes a manual session timer and demonstrates the full billing provenance model using seeded session records. Passive session capture with document-level activity logging — showing every file touched during a work session — is the highest-value v1.1 feature."

**Audit log immutability:**
> "The audit log is append-only at the application and Firestore security-rule layer. Production hardening adds Cloud Audit Logs, restricted IAM, and periodic export to archival storage for full chain-of-custody defensibility."
