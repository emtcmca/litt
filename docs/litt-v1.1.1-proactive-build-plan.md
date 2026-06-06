# Litt v1.1.1 Proactive Operations Build Plan

**Purpose:** Extend Litt from reactive closeout and escalation into proactive operations capture and prevention, while preserving the protective systems that make Litt defensible: deterministic tools, audit logs, attorney approval gates, source-backed drafts, scrubbers, state machines, and the Daily Closeout Brief.

**Version target:** v1.1.1  
**Product direction:** Prevent operational cracks before they occur. Keep the closeout brief as the safety net, not the only control surface.

---

## North Star

Litt v1.0 proves that a small law firm can have an autonomous operational control layer: deadlines, billing issues, budget risks, client silence, anomalies, audit trail, and attorney action gates.

Litt v1.1.1 should preserve that backbone and add a proactive layer:

> Litt captures attorney work as it happens, predicts the next administrative or client-facing action, prepares the structured record or draft, and asks the attorney only for judgment, approval, or correction.

This is not a pivot away from the Daily Closeout Brief. It is a strengthening of it. The brief becomes the exception report for anything the proactive layer did not already capture, resolve, or prepare.

---

## Non-Negotiable Continuity Rules

These v1.0 principles remain mandatory.

1. **Do not remove the Daily Closeout Brief.**
   It remains the final safety net and executive summary.

2. **Do not weaken the audit trail.**
   Proactive suggestions, warnings, attorney approvals, dismissals, and generated drafts should add audit evidence, not bypass it.

3. **Do not let agents write Firestore directly.**
   Agents and HUD flows call backend routes, routes call deterministic tools, tools write Firestore and audit events.

4. **Do not call Gemini for deterministic operations.**
   Billing math, state transitions, deadline cadence, budget thresholds, duplicate checks, scrubber rules, and matter health scoring remain Python.

5. **Do not auto-approve legal or billing decisions.**
   Litt can prepare, suggest, explain, and route. Attorney approval remains required for legal deadlines, billing approval, client sends, write-downs, write-offs, and dismissals.

6. **Do not hide uncertainty.**
   If Litt is inferring matter, deadline, or action type, show source, confidence, and reason.

7. **Do not scrap reactive protections when adding proactive ones.**
   Every proactive feature should reduce the number of closeout exceptions while preserving closeout detection if prevention fails.

---

## Strategic Product Shift

### v1.0 Pattern

```text
Work happens -> gaps emerge -> sweep detects gaps -> brief asks attorney to fix them
```

### v1.1.1 Pattern

```text
Work happens -> Litt captures context -> Litt prepares record/action -> attorney confirms -> closeout checks remaining gaps
```

### What Changes

- Time entries are captured during or shortly after work, not reconstructed at day end.
- Calendar and email activity can become suggested time, follow-up, or communication records.
- Billing scrubber warnings appear before approval, not only in closeout.
- Client update drafts are created when activity suggests a natural touchpoint, not only after silence threshold.
- Deadline readiness is monitored before escalation.
- The closeout brief becomes shorter, more meaningful, and more defensible.

---

## v1.1.1 Feature Bundle

### 1. Work Sessions

**Goal:** Add a parent capture object for attorney work before it becomes a time entry, follow-up, client communication, or audit-only record.

#### Why

The current `time_entries` model is useful but too narrow. Not every captured action is billable time. A call may produce a follow-up. A document review may produce a billing entry and a client update. An email may create a deadline candidate. A nonbillable admin action may still belong in the audit trail.

#### Collection

```text
firms/{firm_id}/work_sessions/{session_id}
```

#### Minimum Model

```python
class WorkSessionStatus(str, Enum):
    OPEN = "OPEN"
    REVIEW_READY = "REVIEW_READY"
    CONFIRMED = "CONFIRMED"
    DISCARDED = "DISCARDED"
    SPLIT_REQUIRED = "SPLIT_REQUIRED"


class WorkCaptureType(str, Enum):
    timer = "timer"
    call = "call"
    email = "email"
    document = "document"
    follow_up = "follow_up"
    manual = "manual"
    nonbillable = "nonbillable"


class WorkSession(LittBaseModel):
    attorney_id: str
    matter_id: Optional[str]
    client_id: Optional[str]
    capture_type: WorkCaptureType
    status: WorkSessionStatus
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    session_minutes_actual: Optional[int]
    raw_note: str
    normalized_summary: Optional[str]
    billable_candidate: bool
    time_entry_id: Optional[str]
    follow_up_action_id: Optional[str]
    communication_id: Optional[str]
    ai_assisted: bool
    ai_tool: Optional[str]
    model: Optional[str]
    source_type: Optional[str]
    source_id: Optional[str]
    source_excerpt: Optional[str]
    version: int
```

#### Tool Functions

Add `backend/app/tools/work_sessions.py`:

- `create_work_session()`
- `confirm_work_session()`
- `discard_work_session()`
- `link_time_entry_to_work_session()`
- `split_work_session()` if time allows

#### Audit Events

Add:

- `WORK_SESSION_CREATED`
- `WORK_SESSION_CONFIRMED`
- `WORK_SESSION_DISCARDED`
- `WORK_SESSION_LINKED_TO_TIME_ENTRY`
- `WORK_SESSION_SPLIT`

#### Protective Continuity

The closeout brief should flag:

- `OPEN` sessions older than a configured threshold.
- `REVIEW_READY` sessions not confirmed.
- Timer sessions with no linked time entry.
- Billable candidates dismissed without reason.

---

### 2. HUD Quick Capture

**Goal:** Expand the Timer HUD into a lightweight proactive capture HUD.

#### Modes

```text
Timer | Quick Capture
```

#### Quick Capture Types

- Call
- Email
- Document work
- Follow-up
- Nonbillable note

#### Flow

```text
Open HUD -> choose type -> select/infer matter -> rough note -> optional minutes -> Litt normalizes -> attorney confirms
```

#### Outputs

Depending on selections:

- Work session only.
- Work session plus `PENDING` time entry.
- Work session plus suggested follow-up.
- Work session plus draft client communication.

#### Protective Continuity

Quick Capture must not auto-approve time, send emails, verify deadlines, or dismiss alerts. It prepares records and asks for confirmation.

---

### 3. Calendar-to-Time Reconciliation

**Goal:** Prevent missing time by comparing calendar events against time entries and work sessions.

#### Signals

- Client or matter calendar event occurred.
- No matching time entry exists.
- No matching work session exists.
- Calendar duration differs materially from captured duration.
- Calendar matter and time-entry matter conflict.

#### Example Nudges

- "You had a 42-minute Mercer client call with no captured time."
- "This calendar event mentions Rivera, but time was logged to Acme."
- "Meeting ended 2 hours ago. Capture it now?"

#### Implementation

Start with fixture adapter data in v1.1.1 if OAuth is not ready.

Add deterministic matching:

- Match by matter/client names in event title/body.
- Match by attorney.
- Match by date and time window.
- Match by duration tolerance.

#### Outputs

- Suggested `work_session`.
- Suggested `PENDING` time entry.
- Closeout exception if ignored.

#### Protective Continuity

If the attorney dismisses a suggested capture, require reason:

- Nonbillable.
- Duplicate.
- Wrong matter.
- Personal/non-client.
- Already captured elsewhere.

---

### 4. Email-to-Follow-Up Capture

**Goal:** Detect obligations and unanswered client needs before they become client silence or deadline escalations.

#### Signals

- Client asks a direct question.
- Attorney promises future action.
- Opposing counsel requests revisions or response.
- Email references a date, hearing, filing, delivery, or deadline.
- Thread has no attorney response after configured interval.
- Client update requested or implied.

#### Gemini Use

Gemini may extract candidate obligations from email body because this is natural language interpretation.

Do not let Gemini decide final action state.

#### Deterministic Validation

For every extracted obligation:

- Source email ID.
- Source excerpt.
- Matter/client if known.
- Candidate due date if present.
- Confidence.
- Requires attorney verification before becoming an active deadline or task.

#### Outputs

- Suggested follow-up.
- Deadline candidate requiring verification.
- Client response draft.
- Time-entry suggestion for substantive email work.

#### Protective Continuity

Unverified email-derived obligations should appear in a verification queue and closeout brief. They must not fire legal deadline escalations until attorney-verified.

---

### 5. Inline Pre-Bill Guardrails

**Goal:** Move scrubber checks from end-of-day detection to live prevention.

#### Current v1.0

Scrubber runs against pending entries and surfaces warnings in the closeout brief.

#### v1.1.1 Enhancement

Run scrubber checks:

- During HUD confirmation.
- During narrative edit.
- Before billing approval.
- Before invoice generation.

#### Inline Checks

- Forbidden phrase.
- Block billing.
- Missing narrative.
- Missing task code.
- Missing activity code.
- Round hours without session data.
- Rate deviation.
- Max daily hours threshold.
- AI disclosure gap.

#### UX

Show warnings without making the HUD heavy:

```text
Created as PENDING with 2 warnings
```

or

```text
Resolve before approval:
- Acme guidelines forbid "review documents"
- Task code required
```

#### Protective Continuity

Do not remove closeout scrubber warnings. Inline guardrails reduce future warnings; closeout still catches anything missed.

---

### 6. Budget-Aware Capture and Approval

**Goal:** Prevent budget threshold surprises.

#### Signals

- New captured time crosses client budget notice threshold.
- New approval crosses critical threshold.
- Pending WIP plus billed amount exceeds cap.
- Client requires approval above specified amount.

#### Features

- HUD warning: "This entry brings Acme to 91% of budget."
- Approval warning: "Approving this crosses the 75% notice threshold."
- Draft budget update email.
- Require acknowledgment before approval when threshold is crossed.

#### Protective Continuity

Budget math remains deterministic. Gemini can draft the budget notice but cannot decide whether threshold was crossed.

---

### 7. Activity-Without-Client-Update Detection

**Goal:** Prevent client silence before the configured silence threshold is reached.

#### Current v1.0

Client silence triggers after a threshold, such as 14 days.

#### v1.1.1 Enhancement

Detect when meaningful activity happens but no client update follows.

Examples:

- Deadline confirmed but no client update.
- Significant document work captured but no update.
- Budget crosses threshold but no client notice.
- Matter has internal activity for 7 days but no external communication.

#### Outputs

- Source-backed draft client update.
- Suggested follow-up action.
- Closeout item if no response.

#### Protective Continuity

The existing silence threshold remains. This feature adds earlier preventive triggers.

---

### 8. Deadline Readiness Monitoring

**Goal:** Move from deadline escalation to deadline preparedness.

#### Current v1.0

Escalates unconfirmed upcoming deadlines.

#### v1.1.1 Enhancement

Monitor whether the firm appears operationally ready for a deadline.

Signals:

- Deadline within 7 days.
- No recent work session on matter.
- No assigned follow-up.
- No draft/prep artifact captured.
- Deadline unconfirmed.
- Conflicting source excerpts.

Example:

```text
Mercer response deadline is 6 days out. No work session has been logged on this matter in 3 days.
```

#### Outputs

- Prep checklist.
- Suggested work session.
- Internal follow-up.
- Attorney confirmation prompt.

#### Protective Continuity

Do not auto-resolve or auto-confirm deadlines. Readiness monitoring is advisory until attorney action.

---

### 9. Matter Health Panel

**Goal:** Provide a proactive matter-level operating snapshot.

#### Avoid

Do not build a mysterious black-box AI score.

#### Build

A deterministic matter health panel with explainable signals:

- Upcoming deadlines.
- Deadline readiness.
- Last client contact.
- Open follow-ups.
- Captured but unconfirmed work sessions.
- Pending WIP.
- Budget utilization.
- Scrubber flags.
- Unverified email-derived obligations.

#### Statuses

```text
CLEAR | WATCH | NEEDS_ATTENTION | CRITICAL
```

#### Placement

In v1.1.1, this can be a compact dashboard panel or a modal launched from the brief.

#### Protective Continuity

Every health status should show the underlying reasons. No hidden scoring.

---

### 10. Preventive Audit Events

**Goal:** Expand audit trail to show not only what Litt fixed, but what Litt prevented or surfaced early.

#### New Audit Concepts

- Preventive warning displayed.
- Suggested action created.
- Suggested action accepted.
- Suggested action dismissed with reason.
- AI draft generated.
- Attorney reviewed AI draft.
- Inline scrubber warning acknowledged.
- Budget threshold warning acknowledged.

#### Example Event Names

- `PREVENTIVE_WARNING_DISPLAYED`
- `SUGGESTED_ACTION_CREATED`
- `SUGGESTED_ACTION_ACCEPTED`
- `SUGGESTED_ACTION_DISMISSED`
- `BUDGET_WARNING_ACKNOWLEDGED`
- `SCRUBBER_WARNING_ACKNOWLEDGED`
- `AI_DRAFT_REVIEWED`

#### Protective Continuity

This strengthens legal defensibility. It shows that Litt did not merely report problems later; it surfaced risk at the point of decision.

---

## Existing v1.0 Features to Re-Spec Proactively

### Daily Closeout Brief

Current:

- End-of-day action digest.

Proactive v1.1.1:

- Exception report plus prevention summary.

Add sections:

- Captured Today.
- Prevented Today.
- Needs Judgment.
- Still At Risk.

### Pre-Bill Scrubber

Current:

- Flags pending entries.

Proactive v1.1.1:

- Runs inline during capture, narrative edit, approval, and invoice generation.

### Client Silence

Current:

- Alerts after silence threshold.

Proactive v1.1.1:

- Detects matter activity without client update.
- Drafts update before silence becomes a risk.

### Budget Risk

Current:

- Warns when utilization crosses threshold.

Proactive v1.1.1:

- Warns at time capture and approval.
- Drafts budget notice.
- Requires acknowledgment when approval crosses threshold.

### Comms Agent

Current:

- Creates source-backed draft after silence trigger.

Proactive v1.1.1:

- Creates update drafts after major matter activity, budget threshold, deadline confirmation, or client question.

### Deadline Agent

Current:

- Detects and escalates deadline risk.

Proactive v1.1.1:

- Monitors deadline readiness and recent activity.
- Creates prep suggestions.

### Anomaly Agent

Current:

- Detects anomalies after records exist.

Proactive v1.1.1:

- Warns during creation if entry appears duplicate, suspiciously rounded, missing narrative, or inconsistent with calendar.

### Audit Log

Current:

- Records writes and state transitions.

Proactive v1.1.1:

- Records warnings, suggestions, acknowledgments, dismissals, and attorney review gates.

### Agent Timeline

Current:

- Shows how agents produced closeout.

Proactive v1.1.1:

- Becomes "Why Litt is asking" evidence for preventive nudges.

---

## Suggested Build Phases

### Phase 1: Foundation

Goal:

Introduce proactive capture records without disrupting current closeout behavior.

Tasks:

- Add `work_sessions` model and contract.
- Add `work_sessions` tool layer.
- Add audit event names.
- Modify Timer HUD capture to create/link work sessions.
- Add `GET /api/work-sessions/today`.
- Add tests.

Acceptance:

- Current timer still creates `PENDING` time entries.
- Every timer capture also creates a linked work session.
- Closeout still works unchanged.

### Phase 2: HUD Quick Capture

Goal:

Make proactive capture useful beyond timers.

Tasks:

- Add HUD mode switch.
- Add Quick Capture form.
- Add capture types.
- Add route for quick capture.
- Optionally create time entry from quick capture.
- Show confirmation and audit results.

Acceptance:

- Attorney can log call/email/document/follow-up/nonbillable work.
- Captures appear in dashboard.
- No direct Firestore writes from frontend.

### Phase 3: Inline Prevention

Goal:

Move existing protective checks earlier.

Tasks:

- Add scrubber preview or post-capture scrubber feedback.
- Add budget impact preview.
- Add duplicate-entry warning.
- Add missing code/narrative warning.

Acceptance:

- Attorney sees risk before approval or at capture.
- Closeout still surfaces unresolved warnings.

### Phase 4: Reconciliation and Suggestions

Goal:

Use calendar/email signals to suggest missing records and follow-ups.

Tasks:

- Build calendar-to-time reconciliation from fixture adapter first.
- Add email obligation extraction from fixture adapter first.
- Add suggested work sessions.
- Add suggested follow-ups.
- Require attorney accept/dismiss.

Acceptance:

- Litt can say, "You had this event/email; capture or dismiss?"
- Dismissals require reason.
- Accepted suggestions become work sessions/time entries/follow-ups through tools.

### Phase 5: Proactive Dashboard

Goal:

Make the product shift visible and useful.

Tasks:

- Add Captured Today panel.
- Add Matter Health panel.
- Add Prevented Today summary.
- Add Needs Judgment list.

Acceptance:

- Dashboard shows both proactive capture and remaining exceptions.
- Closeout brief remains intact.

### Phase 6: Hardening

Goal:

Prepare for production and demo confidence.

Tasks:

- Add tests for all state transitions.
- Add idempotency tests for new tools.
- Add stale-state tests.
- Add audit log tests.
- Add prompt injection tests for email obligation extraction.
- Verify demo reset and seed data.

Acceptance:

- Existing v1.0 tests still pass.
- New proactive tests pass.
- Demo flow is repeatable.

---

## Recommended v1.1.1 Acceptance Criteria

### Product

- Attorney can capture live work through timer.
- Attorney can capture non-timer work through Quick Capture.
- Captured work appears in dashboard.
- Captured work can create `PENDING` time entries.
- Captured work can create or suggest follow-ups.
- Litt warns before common billing problems reach closeout.
- Closeout still catches missed or unresolved issues.

### Architecture

- All writes go through tool layer.
- All writes audit.
- All write endpoints accept idempotency keys.
- State-changing actions use optimistic locking where applicable.
- Gemini is used only for language extraction, normalization, or drafting.
- Deterministic checks remain Python.

### Defensibility

- Raw note and normalized summary are preserved.
- AI assistance is recorded.
- Attorney confirmation is recorded.
- Dismissals require reasons.
- Preventive warnings can be audited.
- Source-backed suggestions show source excerpts.

---

## What Not to Build in v1.1.1

Defer:

- Full passive browser extension.
- Full desktop monitoring.
- Real document management integration.
- Full production Gmail OAuth if verification is not ready.
- Full production Calendar OAuth if it slows core delivery.
- Auto-send client communications.
- Auto-approve billing.
- Auto-verify legal deadlines.
- Auto-change matter status.
- Black-box risk scores.

These can follow once the proactive capture and prevention model is stable.

---

## Product Positioning

Litt v1.1.1 should be described carefully:

> Litt's v1.0 closeout brief catches what fell through the cracks. v1.1.1 adds a proactive HUD and preventive operating controls so fewer things fall through in the first place. The same audit trail, attorney gates, source-backed drafts, and deterministic state machines remain in place.

This message preserves the existing backbone while making the next evolution clear.

---

## Final Recommendation

The highest-value v1.1.1 bundle is:

1. Work sessions.
2. HUD Quick Capture.
3. Inline scrubber and budget guardrails.
4. Calendar-to-time reconciliation.
5. Activity-without-client-update detection.
6. Deadline readiness monitoring.
7. Matter Health panel.
8. Preventive audit events.

This gives Litt a coherent proactive operating layer without sacrificing the protective controls that make it credible for legal work.

