# Litt — Build Plan Analysis

This file exports the build-plan analyses provided during review of Litt / OpsCounsel, preserving the plain text, code snippets, JSON, and implementation notes in Markdown format.

---

# Part 1 — Initial Build Plan Review

## Bottom line

This is a **strong build plan**, and the core thesis is right: small firms do not need another chatbot; they need an operational control layer that catches deadline risk, billing leakage, client silence, budget drift, and approval bottlenecks before they become expensive problems. The spec already has the right spine: coordinator/sub-agent architecture, deterministic tool layer, WIP approval gates, audit log, deadline escalation, client comms drafts, anomaly detection, and AI billing transparency.

But the build is **not yet “can’t miss.”** It becomes must-have only when it does three things better than anything else in the firm’s stack:

1. **Captures operational reality automatically**
2. **Turns risk into a one-click decision brief**
3. **Produces defensible records the firm can use for invoices, malpractice defense, client reporting, and internal accountability**

Right now, the spec is architecturally sound but still too dependent on manual data entry in v1.0. That is the biggest gap.

---

## 1. The biggest missing piece: automatic ingestion

The product promise is “always-on operational intelligence,” but the v1.0 plan still relies heavily on manual matter entry, manual deadline entry, manual time entry, and attorney-initiated review. That is dangerous because solo and small-firm attorneys are exactly the people least likely to maintain clean operational data.

The system should ingest from the places attorneys already live:

**Must-have integrations:**

- Gmail / Outlook
- Google Calendar / Microsoft 365 Calendar
- Google Drive / OneDrive / Dropbox
- Clio / MyCase / PracticePanther / Smokeball, even if only through CSV import at first
- QuickBooks Online, eventually
- Court notice inbox or filing-notice email parsing
- PDF / Word attachment metadata extraction
- Browser/desktop activity capture for billing provenance

Without that, OpsCounsel / Litt risks becoming another dashboard that only works when the attorney has already done the administrative work correctly.

The real magic should be:

> “Litt noticed this from your email/calendar/billing activity and prepared the review packet.”

Not:

> “Enter this into Litt so Litt can monitor it.”

That distinction matters.

---

## 2. The competitive positioning needs sharpening

Do not position Litt as simply “AI for deadlines, billing, and client updates.” Practice-management incumbents are already marketing AI features around court-document calendar events, client updates, draft invoices, approvals, risks, and attorney review checkpoints.

That does **not** kill the idea. It clarifies the wedge.

Litt should be positioned as:

> **The operational control plane for small firms: billing provenance, deadline accountability, client-status discipline, and defensible audit trails across the tools the firm already uses.**

The differentiator is not “AI can draft an email.” Everyone will have that.

The differentiator is:

- Per-entry AI cost provenance
- Work-session audit trails
- Billing defensibility
- Deadline escalation history
- Budget-risk evidence
- Approval state machines
- Tool-layer enforcement
- Immutable operational record
- Works alongside existing systems instead of forcing migration

That is the zone where this can win.

---

## 3. The “can’t miss” feature: daily firm closeout

The single best must-have feature is a **Daily Closeout Brief**.

Every day at 4:30 or 5:00 p.m., each attorney gets one brief:

```text
Daily Closeout

Today’s captured work
- 6 work sessions detected
- 4 likely billable
- 2 need matter assignment
- Estimated unlogged value: $1,125

Time entries needing approval
- Acme Corp — 0.8h — narrative drafted
- Smith v. Jones — 1.4h — possible duplicate detected

Deadlines needing confirmation
- Motion response due in 6 days — HARD_LEGAL — no confirmation on record

Client silence risk
- Johnson matter — 18 days since last logged contact
- Draft update prepared

Budget risk
- Acme Corp at 82% of approved budget
- Draft budget warning prepared

One-click actions
- Approve time
- Edit narratives
- Confirm deadline
- Send client update draft
- Defer with reason
```

This is what makes it sticky. Attorneys do not want to “use software.” They want to end the day knowing nothing important slipped.

Build the whole product around that ritual.

---

## 4. Billing module: very strong, but needs billing-guideline intelligence

The billing branch is the strongest part of the plan. The state machine, WIP review gate, write-down/write-off preservation, AI cost tracking, LEDES export, and attorney approval model are all right.

But to become a must-have for small firms serving corporate clients or insurance carriers, you need **client billing guideline enforcement**.

Add a `billing_guidelines` object per client/matter:

```json
{
  "client_id": "acme-corp",
  "billing_increment": 0.1,
  "block_billing_allowed": false,
  "travel_time_allowed": false,
  "intraoffice_conference_allowed": "limited",
  "research_requires_preapproval": true,
  "max_daily_hours_without_review": 8.0,
  "forbidden_phrases": ["attention to file", "review documents", "work on matter"],
  "required_task_codes": true,
  "ledes_required": true,
  "ai_disclosure_required": true,
  "budget_notice_threshold": 0.75
}
```

Then add a **pre-bill scrubber**:

- Detect block billing
- Detect vague narratives
- Detect forbidden phrases
- Detect missing UTBMS codes
- Detect excessive internal conferences
- Detect administrative/non-billable tasks
- Detect rate mismatch
- Detect entries likely to be rejected by e-billing systems
- Detect client-specific rule violations

This is where the money is. A solo or small firm will pay for something that prevents invoice rejection and protects realization.

Also, the LEDES mapping needs care. Do not collapse task code and activity code. The data model should include both:

```json
{
  "task_code": "L200",
  "activity_code": "A103",
  "expense_code": null
}
```

Do not collapse those fields.

---

## 5. AI billing transparency is the best wedge — expand it

The `ai_cost_usd` field is excellent. But standing alone, raw model cost is not enough. The attorney needs an **AI billing defensibility packet**.

Add these fields to each AI-assisted time entry:

```json
{
  "ai_assisted": true,
  "ai_tool": "Claude / Gemini / ChatGPT / internal",
  "model": "specific-model-name",
  "ai_cost_usd": 0.14,
  "human_minutes_actual": 46,
  "ai_minutes_estimated": 3,
  "output_type": "draft / research summary / redline / extraction / analysis",
  "human_review_completed": true,
  "reviewing_attorney_id": "alice-jones",
  "client_ai_disclosure_required": true,
  "client_ai_disclosure_status": "included / not_required / withheld",
  "billing_treatment": "billed_as_human_review / written_down / nonbillable_ai_overhead"
}
```

Litt should help the lawyer answer:

- Was AI used?
- Was the client required to be told?
- Was the output reviewed?
- What human time was actually spent?
- Was the fee reasonable?
- Were efficiency gains handled appropriately?
- Is there an audit trail if the invoice is challenged?

That is a much sharper commercial wedge than generic time tracking.

---

## 6. Deadline monitor: strong concept, but risky without source verification

The deadline monitor is valuable, but also the highest-liability module. The spec treats deadline classification and escalation well, but it needs a **deadline source-of-truth model**.

Every deadline should have:

```json
{
  "deadline_id": "dl-001",
  "source_type": "court_order / email / manual / statute / rule / opposing_counsel / contract",
  "source_document_id": "doc-123",
  "source_excerpt": "Opposition due June 15, 2026",
  "created_by": "system / attorney / paralegal",
  "verified_by": "attorney_id",
  "verification_status": "unverified / attorney_verified / superseded",
  "supersedes_deadline_id": null,
  "jurisdiction": "Ohio",
  "court": "Cuyahoga County Court of Common Pleas",
  "rule_basis": "manual / court order / local rule",
  "calculation_method": "direct_date / computed_date",
  "calendar_synced": true
}
```

The system should **not** present an AI-extracted legal deadline as operationally valid until it is attorney-verified.

The better flow:

1. Litt detects possible deadline.
2. It shows the source excerpt.
3. Attorney confirms date/classification.
4. Only then does it become an active monitored deadline.
5. Any change creates a supersession record.

That makes the system defensible instead of dangerous.

---

## 7. Missing: conflict check and new matter intake

For solo and small firms, the first operational moment is often not billing or deadline monitoring. It is intake.

A must-have version of Litt should include a lightweight **New Matter Intake + Conflict Precheck** workflow.

Not full legal conflict analysis. Just operational conflict hygiene:

- New prospective client
- Adverse party
- Related parties
- Existing client overlap
- Prior consultation
- Matter type
- Jurisdiction
- Urgency/deadline
- Source of referral
- Engagement status
- Conflict check status
- Engagement letter status
- Retainer status
- First deadline captured?

This should create a matter only after status is clear:

```text
PROSPECT → CONFLICT_CHECK → ENGAGEMENT_PENDING → ACTIVE → CLOSED
```

Right now, the spec starts after the matter already exists. That misses a huge operational pain point.

---

## 8. Missing: engagement letter / scope / budget alignment

Budget tracking is useful, but it needs to tie back to the engagement terms.

Add an `engagement_terms` object:

```json
{
  "fee_type": "hourly / flat / contingency / hybrid",
  "scope_summary": "Review and negotiate vendor MSA",
  "excluded_work": ["litigation", "tax advice"],
  "retainer_required": true,
  "retainer_amount": 5000,
  "evergreen_retainer": true,
  "budget_cap": 15000,
  "client_approval_required_above": 15000,
  "billing_contact": "Jane Smith",
  "outside_counsel_guidelines_attached": true
}
```

Then your anomaly agent can detect:

- Work being logged outside scope
- Budget exceeded without approval
- Retainer below refill threshold
- Matter active without signed engagement letter
- Client contact occurring before engagement approval
- Deadline entered before engagement status is active

That is practical small-firm risk control.

---

## 9. Missing: receivables and collections intelligence

The spec includes invoice status, but this should become a full **A/R watchdog**.

Small firms care about getting paid.

Add:

- Invoice sent date
- Payment due date
- Days outstanding
- Client payment pattern
- Retainer balance
- Evergreen retainer threshold
- Follow-up cadence
- Draft collection reminder
- “Do not continue work until replenished” warning
- Work-in-progress vs receivables exposure

The daily/weekly brief should say:

> “Client has $4,200 unpaid at 47 days, retainer is below threshold, and 3.1h of new WIP has accumulated since last invoice.”

That is a must-have operational insight.

---

## 10. Missing: malpractice/risk insurance artifact export

You already frame deadline monitoring as a malpractice defense artifact. Push that further.

Add a **Risk File Export**:

For any matter, generate:

- Deadline history
- Confirmation history
- Escalation history
- Client communication log
- Budget warnings sent
- Billing approval trail
- Missed/ignored escalation log
- Attorney decisions
- System actions
- Source documents/excerpts

This becomes useful for:

- Malpractice insurance renewal
- Internal postmortems
- Fee disputes
- Client complaints
- Bar grievance defense
- Partner/admin oversight

That is a feature lawyers understand quickly: “Show me the record proving we handled this responsibly.”

---

## 11. Missing: permission model detail

At minimum:

| Role | Access |
|---|---|
| Owner/Admin | Firm config, all matters, billing, users |
| Responsible Attorney | Full matter access, approvals |
| Assigned Attorney | Matter-level access, time entry, drafts |
| Paralegal/Staff | Drafts, deadlines, intake, no billing approval |
| Billing Admin | Billing/WIP/invoices, no privileged matter notes unless permitted |
| Read-only Auditor | Audit logs/export only |
| External Counsel | Specific matter only, limited actions |

Also add matter-level ethical walls:

```json
{
  "ethical_wall": true,
  "allowed_users": ["alice-jones", "paralegal-2"],
  "blocked_users": ["bob-smith"],
  "reason": "conflict screen"
}
```

If you sell to law firms, permissioning cannot be vague.

---

## 12. Missing: client portal or client-facing digest

Not for v1.0 hackathon, but for must-have commercial value, add a client-facing layer.

A small firm would love to send a clean, attorney-approved monthly status report:

- Current matter status
- Recent work completed
- Upcoming dates
- Budget used
- Next expected event
- Open client requests
- Invoice summary

This can be generated from the same operational data already in Litt.

That becomes a retention feature. It makes the lawyer look organized.

---

## 13. Missing: “source-backed draft” requirement for client comms

Client comms drafts are risky if they are generated from summaries alone.

Every client draft should have a source panel:

```text
Draft sentence:
“We received opposing counsel’s revised agreement on May 21.”

Source:
Email from jsmith@opposingfirm.com, May 21, 2026, subject: Revised Agreement
```

The attorney should be able to click each factual claim and see the source.

No source, no factual sentence.

That is exactly the kind of trustworthy AI pattern that would separate Litt from generic drafting tools.

---

## 14. Observability: separate internal logs from customer-visible audit

Split logs into three categories:

**Engineering observability**

- Token usage
- Latency
- Agent traces
- Tool call errors
- Retry attempts

**Operational audit**

- Deadline confirmed
- Invoice generated
- Time entry approved
- Draft communication approved
- Anomaly dismissed

**Legal/client defensibility record**

- What was sent
- Who approved it
- When
- Based on what source
- What changed after review

Do not expose raw agent reasoning traces to firm users by default. They may create confusion, privilege issues, or discoverability concerns. Give admins a clean audit view, not a raw model-trace firehose.

---

## 15. Specific corrections to the current spec

### 1. Rename `send_draft_to_review()`

The current name is confusing. It marks a draft as approved and routes it to a send mechanism. Better:

```python
approve_client_comm_draft()
queue_client_comm_for_delivery()
log_client_comm_sent()
```

Approval, queueing, and delivery confirmation should be separate states.

### 2. Do not reset `last_client_contact` on approval

Your spec resets the contact timestamp when the attorney approves the draft, even if v1.0 does not confirm delivery. That creates false operational confidence.

Use:

```text
DRAFT_APPROVED → QUEUED_FOR_SEND → SENT_CONFIRMED
```

Only `SENT_CONFIRMED` should reset `last_client_contact`.

### 3. Add `DISMISSED_WITH_REASON` everywhere

For deadlines, anomalies, budget alerts, client comms drafts, and billing warnings, attorneys need to be able to dismiss with a reason. That reason is part of the audit trail.

### 4. Add “backup escalation failed” handling

If the backup contact also ignores a `HARD_LEGAL` deadline, what happens? The system needs an escalation ladder:

- Responsible attorney
- Backup attorney/admin
- Managing partner
- Emergency channel
- Persistent red banner in UI
- Optional SMS/push

### 5. Add matter status gates

Certain actions should be blocked depending on matter status:

| Matter status | Allowed |
|---|---|
| Prospect | Intake, conflict check only |
| Engagement pending | Draft engagement, no client legal comms |
| Active | Full workflows |
| Paused | No new work without override |
| Closing | Final invoice, closing letter |
| Closed | Read-only except post-close tasks |

### 6. Add data deletion/export policy

Law firms will ask:

- Can I export everything?
- Can I delete a client?
- What happens when a matter closes?
- What is retained?
- What is immutable?
- What can be purged?
- How does this interact with litigation holds?

You need an answer before commercialization.

---

## 16. What would make it must-have

If I were turning this into a small-firm product, I would build toward this feature set:

### The Small Firm Control Center

A single dashboard showing:

- Deadlines requiring confirmation
- Time needing review
- Unbilled work value
- Budget warnings
- Client silence warnings
- Draft updates awaiting approval
- Invoices overdue
- Retainers below threshold
- Matters with no recent activity
- New emails that may contain deadlines
- New matters missing conflict/engagement steps

This should be the homepage.

### The Daily Closeout Brief

This is the habit-forming feature.

### The Pre-Bill Scrubber

This is the revenue feature.

### The Deadline Verification Trail

This is the malpractice/risk feature.

### The AI Billing Provenance Report

This is the differentiated legal AI feature.

### The Client Status Generator

This is the client-retention feature.

### The Intake-to-Active Matter Gate

This is the operational hygiene feature.

### The A/R and Retainer Watchdog

This is the cash-flow feature.

Together, that becomes must-have.

---

## 17. Recommended MVP adjustment

For the hackathon, I would not try to build all four branches equally.

I would focus v1.0 around one killer workflow:

### “End-of-Day Law Firm Control Brief”

Demo data flows into one attorney dashboard:

1. Litt detects a `HARD_LEGAL` deadline inside 7 days.
2. It detects 3 unapproved time entries worth $1,400.
3. It flags one vague/block-billed narrative.
4. It shows the client is at 82% budget.
5. It notes 16 days since client contact.
6. It drafts a status update.
7. Attorney approves time, edits one narrative, confirms deadline, approves client update.
8. Litt writes the audit trail and updates the matter.

That demo will land harder than four separate agents.

The message:

> “This is the control layer that lets a small firm end every day knowing what needs attention, what got approved, what remains exposed, and what record exists if anyone asks later.”

That is the product.

---

## 18. Final verdict from initial build review

This build is **very close conceptually**, but what it is missing is the connective tissue that makes it unavoidable in daily practice:

- Automatic ingestion
- Daily closeout ritual
- Billing guideline enforcement
- Source-backed client drafts
- Deadline verification records
- Conflict/intake gates
- Engagement/budget alignment
- A/R and retainer monitoring
- Clean exportable risk file
- Stronger permission/ethical wall model
- More precise LEDES mapping
- Clear separation between approval, sending, and delivery confirmation

The strongest commercial wedge is not “AI operations agent for small law firms.” That is too broad.

The sharper version is:

> **Litt is the small-firm control layer that captures work, protects deadlines, cleans billing, prevents client silence, and leaves a defensible audit trail behind every operational decision.**

That is the version a solo or small firm could actually see as a must-have.

---

# Part 2 — Revised v0.2 Build Spec Review

## Verdict

v0.2 is a **large jump forward**. The product is now much clearer: Litt is not “legal AI.” It is a **small-firm operational control layer** centered around the Daily Closeout Brief. That is the right framing.

But I would **not call this fully build-ready yet**. It is build-ready conceptually, but there are still several implementation contradictions that will cost you time if you start coding without resolving them.

The strongest parts are:

- Daily Closeout Brief as the product ritual.
- Deterministic tool layer.
- Billing state machine.
- AI billing provenance.
- Deadline verification before activation.
- Source-backed client drafts.
- Audit / legal-defensibility framing.
- Pre-bill scrubber tied to client billing guidelines.
- Clear “what Litt does not do” boundaries.

The biggest remaining problem is that v1.0 is still carrying **too much implied infrastructure** for a hackathon/demo build: Gmail, Calendar, Firestore, ADK agents, React dashboard, email digest, billing state machine, LEDES export, A/R watchdog, audit log, source-backed drafts, anomaly detection, OAuth, seed data, and Cloud Run deployment.

That is not impossible, but it is a lot. The risk is not that the concept is weak. The risk is that you build a shallow version of every branch instead of a strong version of the one flow judges and users will remember.

---

## 1. The core positioning is now strong

This line is the product:

> “Litt. The operational control layer for small law firms.”

That is much better than “AI law firm assistant,” “billing automation,” or “practice management AI.” Keep hammering that.

Litt’s differentiation cannot be “we draft updates and find deadlines.” The differentiation needs to be:

> **Litt creates a defensible operational record around deadlines, billing, client contact, budget risk, and AI-assisted work.**

That is the unique wedge.

---

## 2. Biggest critique: v1.0 still has a time-capture contradiction

This is the most important implementation issue.

Your billing branch depends on fields like:

- `session_minutes_actual`
- `activity_log`
- documents touched
- captured work sessions
- AI session cost
- reconstructed billing detection

But browser/desktop session capture is in v1.1.

That creates a v1.0 contradiction. How does Litt know:

```python
"session_minutes_actual": 46
"activity_log": [
  "2026-05-29T14:23Z|Edit|mercer-motion-opp.docx",
  "2026-05-29T14:31Z|Write|mercer-research-notes.md"
]
```

if v1.0 does not have a browser extension, desktop agent, document integration, Clio import, or practice-management import?

You need one of these fixes before build:

### Option A — v1.0 uses seeded/synthetic session records

Totally fine for the hackathon. Say explicitly:

> v1.0 demonstrates the billing workflow using seeded captured-session records. Actual passive session capture is v1.1.

### Option B — v1.0 includes a manual Litt timer

Simplest real implementation:

- Attorney clicks “Start work session.”
- Selects matter.
- Stops timer.
- Adds narrative.
- Litt converts to pending time entry.
- No document-level activity log unless manually added.

### Option C — v1.0 imports a CSV time/activity file

Also fine, but less compelling in demo.

My recommendation: **add a simple Litt timer to v1.0 or explicitly mark session capture as seeded demo data.** Do not let the spec imply passive capture if the system does not actually capture it.

---

## 3. Gmail API scope is a real commercialization issue

Your Gmail plan is technically plausible, but commercially non-trivial.

For the hackathon, you can use test users / demo accounts. For commercial launch, plan for:

- OAuth consent verification
- Restricted-scope review
- Security assessment if applicable
- Clear data-retention policy
- Privacy policy
- Limited-use disclosure
- Customer admin trust concerns

You should add a section called:

### OAuth / Workspace Verification Risk

And state:

> v1.0 uses demo Google Workspace accounts for contest purposes. Commercial Gmail rollout requires Google restricted-scope verification and security review planning.

This is important because a judge or technical reviewer may catch it.

---

## 4. Calendar scope is okay, but tighten it

Calendar is cleaner than Gmail. Consider using the narrower event-read scope if it satisfies the implementation.

Suggested language:

> Litt requests the narrowest Google Calendar scope sufficient for event ingestion, preferably `calendar.events.readonly`; broader `calendar.readonly` is used only if calendar discovery requires it.

That sounds more security-aware.

---

## 5. “Email digest can clear most actions” is dangerous

This line is a trap:

> “An attorney who lives in email should be able to clear most of a routine Daily Closeout Brief without opening the dashboard.”

Be careful.

Approving billing entries, confirming legal deadlines, dismissing alerts, and approving client communications from email requires:

- Authentication
- CSRF protection
- Replay protection
- Expiring signed action tokens
- Authorization checks
- Confirmation screen for high-risk actions
- Audit attribution

For v1.0, do **not** build one-click approvals directly inside email.

Do this instead:

> Email digest contains deep links to authenticated Litt action panels. High-risk actions are completed inside Litt, not directly inside email.

That is safer, simpler, and more defensible.

---

## 6. “No login required for judges” conflicts with real actions

You say the live deployment will have no login required for judges. That is fine for a read-only public demo, but it conflicts with live write actions like approving WIP, confirming deadlines, or creating Gmail drafts.

For the contest deployment, use one of these:

### Demo Mode

No login. All actions mutate only demo seed data. Add a visible banner:

> Demo workspace. No real email/calendar data. Actions reset every hour.

### Judge Login

Provide a judge demo credential. Safer, but more friction.

### Read-only public + recorded live demo

No login for public page. Recorded video shows full action flow.

My recommendation: **Demo Mode with resettable seed data.** That lets judges click without security risk.

---

## 7. Firestore immutability language is too strong

This sentence is overstated:

> “No UPDATE, no DELETE — not by the application, not by any client with valid credentials.”

Firestore security rules can prevent client-side updates and deletes. But privileged backend service accounts, Google Cloud admins, or direct administrative access can still mutate data unless you add additional controls.

Better language:

> `audit_log` is append-only at the application and Firestore security-rule level. Production hardening will add Cloud Audit Logs, restricted IAM, backup/export retention, and optional WORM-style archive storage for defensibility exports.

This is more accurate and more credible.

---

## 8. You need tenancy now, even for a demo

The data model needs `firm_id` everywhere.

Right now you have collections like:

- `attorneys`
- `clients`
- `matters`
- `time_entries`
- `deadlines`
- `audit_log`

But there is no explicit tenant boundary.

Even if v1.0 only seeds Strand & Okafor, add:

```python
"firm_id": "strand-okafor"
```

to every record, and structure Firestore either as:

```text
firms/{firm_id}/attorneys/{attorney_id}
firms/{firm_id}/clients/{client_id}
firms/{firm_id}/matters/{matter_id}
firms/{firm_id}/time_entries/{entry_id}
firms/{firm_id}/audit_log/{audit_id}
```

or add `firm_id` as a mandatory indexed field.

Do this now. Retrofitting tenancy later is painful and error-prone.

---

## 9. The “does not access matter file content” boundary conflicts with source-backed drafts

You say Litt never accesses matter file content. Good boundary.

But then the spec says:

- source-backed drafts use prior communications
- billing panel shows documents touched
- activity log lists PDFs and DOCX files
- draft generation uses recent activity and matter summaries

That is not necessarily matter-file access, but the boundary needs to be clearer.

Suggested distinction:

> Litt v1.0 does not ingest or analyze full matter file contents such as pleadings, contracts, discovery, or legal work product. It may process limited operational metadata and selected email/calendar excerpts necessary for deadlines, billing, and client-status workflows.

That gives you room to use email/calendar facts without implying full document analysis.

---

## 10. AI billing provenance is a killer feature, but the uniqueness claim is risky

The idea is excellent. But the statement:

> “No existing legal billing product captures this.”

I would soften that unless you have done a formal competitive review.

Better:

> “Litt treats AI billing provenance as a first-class billing record, rather than an after-the-fact note or policy disclosure.”

That is stronger and safer.

---

## 11. LEDES section is much better

This correction is right and important.

Two additions I would make:

### Add `line_item_number`

LEDES requires unique line item numbers. Add:

```python
"line_item_number": "te-2026-0529-001"
```

or derive it from the time entry ID.

### Add client matter ID

You include `client.ledes_client_id`, but matter-level e-billing often needs:

```python
"client_matter_id": "ACME-2026-0042"
"law_firm_matter_id": "acme-contract-review-2026"
```

Do not assume your internal matter slug is the client’s matter ID.

---

## 12. The anomaly scoring formula is too crude

This formula is simple:

```text
severity × confidence
```

That is fine for v1.0, but the escalation rules contradict it slightly.

Example:

- severity 5 × confidence 0.7 = 3.5
- severity 4 × confidence 0.9 = 3.6

The second scores higher, but the first may be more urgent.

For v1.0, keep the formula, but add override rules:

```python
if severity == 5:
    always_surface_in_daily_closeout = True

if classification == "HARD_LEGAL" and days_out <= 7:
    escalation_level = "CRITICAL"

if anomaly_type in ["POTENTIAL_DUPLICATE", "RATE_DEVIATION"]:
    require_billing_review = True
```

Do not rely only on a numeric score for legal/billing risk.

---

## 13. Idempotency is missing

This is a real engineering gap.

You have scheduled sweeps, Firestore triggers, Gmail parsing, Calendar parsing, and coordinator invocations. Without idempotency, Litt can create duplicate deadline candidates, duplicate alerts, duplicate comm drafts, or duplicate anomaly records.

Add an idempotency model:

```python
{
  "source_system": "gmail",
  "source_id": "email-abc123",
  "source_hash": "sha256-of-excerpt-date-matter",
  "signal_type": "deadline_candidate",
  "first_seen_at": "timestamp",
  "last_seen_at": "timestamp"
}
```

Every ingestion function should check:

```text
Have we already processed this source_id + signal_type + extracted_date?
```

before creating a new record.

This should be a build-blocker. Add it before coding.

---

## 14. You need acceptance criteria

The spec is strong on concept, but light on “done means done.”

For each branch, add acceptance criteria.

### Deadline Monitor acceptance criteria

- Given a seeded Gmail email containing “Opposition due June 4, 2026,” Litt creates exactly one unverified deadline candidate.
- The candidate includes source type, source excerpt, source ID, matter association, and extracted date.
- The candidate does not trigger active deadline escalation until attorney verification.
- On attorney verification, Litt writes one `DEADLINE_VERIFIED` audit event.
- Re-running the sweep does not duplicate the candidate.

### Billing acceptance criteria

- Given a pending time entry with forbidden phrase “review documents,” pre-bill scrubber flags it.
- Attorney can edit the narrative.
- Attorney approval advances `PENDING → APPROVED`.
- Invalid transition `CAPTURED → APPROVED` is rejected.
- Write-off requires a reason.
- LEDES export separates task code and activity code.

This will make the build much easier for Hermes/Claude/Codex to execute.

---

## 15. Add an eval/test harness immediately

For an AI agent product, the missing “must-have” build asset is not another feature. It is a test harness.

Create `/tests/fixtures/` with:

- 10 sample Gmail deadline emails
- 5 false positives
- 5 calendar events
- 10 time entries with billing guideline violations
- 5 clean time entries
- 3 client comms triggers
- 3 budget threshold events
- expected JSON outputs

Then require:

```text
pytest tests/
```

before deployment.

This matters because your whole product promise is trust. You need to show the system behaves deterministically around the dangerous parts.

---

## 16. Source-backed drafts are excellent but too ambitious as written

“Every factual sentence is sourced” is the right standard, but expensive to implement perfectly.

For v1.0, narrow it:

> v1.0 source-backed drafts are generated from structured source facts only. Each inserted fact carries a source reference. The model may not introduce unsupported factual claims.

In practice, give the model a fact packet:

```python
[
  {
    "fact_id": "f1",
    "text": "Whitmore Group has not received a confirmed client update since May 13, 2026.",
    "source": "client_contact_log"
  },
  {
    "fact_id": "f2",
    "text": "The matter has one upcoming internal review milestone on June 3, 2026.",
    "source": "calendar_event_123"
  }
]
```

Then require the draft output to cite `fact_id`s.

That is much easier than trying to source arbitrary generated sentences after the fact.

---

## 17. Build order should change slightly

Your stated next step was:

> Build sprint planning and task breakdown, then Branch 2 Python implementation — Firestore schema initialization, tool layer, billing sub-agent.

I would adjust that.

Do **not** start with the billing sub-agent itself. Start with the deterministic foundation.

### Correct build order

1. Firestore schema + seed data
2. Tenant model / `firm_id`
3. Audit log write function
4. Tool-layer validation framework
5. Billing state machine tools
6. Deadline verification tools
7. Alert dismissal with required reason
8. React Daily Closeout Brief using seed data
9. Billing panel interactions
10. Deadline confirmation interaction
11. Client comms draft approval flow
12. ADK coordinator/sub-agent layer
13. Gmail/Calendar ingestion
14. Email digest
15. LEDES export
16. Demo polish

Reason: if the UI and deterministic tools work, the agent layer can be thin and still impressive. If the agents work but the state/audit layer is brittle, the product feels fake.

---

## 18. For the two-minute demo, reduce the live surface area

The demo script is good, but it is trying to prove too much.

I would show only three live actions:

1. Confirm the `HARD_LEGAL` deadline.
2. Fix and approve one problematic billing entry.
3. Approve one source-backed client update draft.

Everything else should be visible but not interacted with.

Do not show Firestore raw logs for more than one second. Judges will not care about raw records unless the visual is clean. Better: show a small “Audit record created” drawer in the UI.

---

## 19. What I would add to v0.2 before freezing

I would add these sections and then actually freeze it:

### Section 24 — Build Acceptance Criteria

Branch-by-branch checklist.

### Section 25 — Idempotency and Duplicate Prevention

Required for sweeps/triggers.

### Section 26 — Auth, Demo Mode, and Judge Access

Clarifies public demo safety.

### Section 27 — OAuth Verification / Commercialization Risk

Especially Gmail restricted scopes.

### Section 28 — Tenant Model

`firm_id` everywhere.

### Section 29 — Test Fixtures and Eval Harness

Golden test cases for ingestion, tool transitions, and draft generation.

These are not scope creep. They are build stabilizers.

---

## 20. Strongest recommendation

Do **not** add new product features now.

You have enough.

The only things I would add are architectural safeguards:

- `firm_id` tenancy
- idempotency keys
- acceptance criteria
- auth/demo-mode rules
- Gmail OAuth risk note
- v1.0 clarification for session capture
- source-backed draft simplification
- eval/test fixtures

Once those are added, this is genuinely ready for sprint planning.

The product thesis is now strong:

> Litt does not replace the lawyer, the billing system, the calendar, or the practice management platform. It watches the operational gaps between them and turns end-of-day uncertainty into a short, defensible action brief.

That is the angle. Keep it tight.
