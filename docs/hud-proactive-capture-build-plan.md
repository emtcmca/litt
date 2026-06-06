# Litt HUD Proactive Capture Build Plan

**Date:** June 4, 2026  
**Submission deadline:** June 11, 2026, 8:00 PM  
**Purpose:** Provide a detailed implementation plan for expanding Litt from a reactive Daily Closeout Brief into a proactive attorney work-capture layer.

---

## Executive Summary

The Daily Closeout Brief is already a strong safety net: it catches missed time entries, unconfirmed deadlines, budget risks, client silence, and billing anomalies after they exist. The HUD should become Litt's proactive front door: the place where attorney work is captured as it happens, converted into structured operational records, and routed into billing, follow-up, document, communication, and audit workflows before anything falls through the cracks.

The goal before June 11 is not to build a full passive browser extension or document management integration. The goal is to ship a credible, demo-ready proactive capture layer:

1. A polished Timer HUD that creates defensible `PENDING` time entries.
2. A Quick Capture mode for calls, emails, document work, and follow-ups.
3. A lightweight `work_sessions` parent record so captured work is not forced to become only billing data.
4. Dashboard visibility showing that Litt is now capturing work proactively, not merely reporting problems at closeout.
5. Clear auditability and deterministic tool-layer writes throughout.

The product story should become:

> Litt no longer waits until the end of the day to discover operational risk. It captures attorney work as it happens, structures it, audits it, and escalates only what still needs judgment.

---

## Current State Observations

The current HUD work is a good foundation.

Existing pieces:

- `dashboard/src/components/TimerHUD.tsx`
  - Fixed bottom-right timer HUD.
  - Matter selection.
  - Local storage persistence.
  - Start, stop, review, confirm, discard states.
  - Gemini narrative normalization.
  - Creates a `PENDING` time entry through the backend.

- `backend/app/routes/actions.py`
  - `POST /api/actions/timer/normalize-narrative`
  - `POST /api/actions/timer/capture`

- `backend/app/tools/billing.py`
  - `write_time_entry()` creates time entries through the tool layer.
  - Writes audit events through `log_audit_event()`.
  - Applies billing increment rounding.

- `docs/data-contract.md`
  - Existing `TimeEntry` model already contains useful AI billing provenance fields.

This means the HUD is not greenfield. The work now is to harden the existing vertical slice and extend it into a broader capture model.

---

## Product Principle

The HUD should not feel like billing software. It should feel like a lightweight memory and action layer:

- "I just finished this work."
- "Please remember it correctly."
- "Make the billing entry clean."
- "Create the follow-up if one is needed."
- "Keep the audit trail."

Attorneys should not have to switch into administrative mode. The HUD should ask for the minimum necessary input, use deterministic rules for everything that must be exact, use Gemini only for language cleanup or summarization, and require attorney confirmation before any consequential state change.

---

## Scope Recommendation

### Build Before June 11

#### 1. Harden the Timer HUD

The timer should be production-quality for the demo:

- Select matter.
- Start and stop timer.
- Persist across route changes and refreshes.
- Require a raw work note before stopping.
- Normalize billing narrative with Gemini.
- Allow attorney edit before confirm.
- Create `PENDING` time entry through the tool layer.
- Preserve raw note and normalized narrative.
- Store AI provenance when Gemini is used.
- Show scrubber warnings after capture or before confirm.
- Clear or seed timer state on demo reset.

#### 2. Add Work Session Parent Records

Add a `work_sessions` collection to represent captured work before, or alongside, billing records.

This matters because not every attorney action is a time entry. A captured event may become:

- A billable time entry.
- A nonbillable record.
- A follow-up task.
- A client communication.
- A deadline candidate.
- A document work record.
- Pure audit evidence.

The `work_session` record gives Litt a durable unit of proactive capture.

#### 3. Add Quick Capture Mode

The HUD should support non-timer capture:

- Log call.
- Log email.
- Log document work.
- Create follow-up.
- Log nonbillable note.

These can be manual in v1.0. Do not attempt full passive capture before June 11.

#### 4. Add Proactive Dashboard Visibility

The Daily Closeout Brief should show that Litt is capturing work live.

Add a compact section or panel:

- Captured today.
- Needs review.
- Suggested follow-ups.
- Unbilled captured work.

This makes the strategic shift visible in the demo.

#### 5. Update Demo Story

The demo should start with proactive capture before running the closeout:

1. Dana finishes a call or document review.
2. HUD is already running or Quick Capture is opened.
3. Litt normalizes the note.
4. Dana confirms.
5. The entry appears as `PENDING`.
6. Closeout brief later shows remaining exceptions, proving the brief is now a safety net instead of the primary workflow.

### Defer Until After June 11

Do not build these before submission:

- Browser extension.
- Passive desktop/session monitoring.
- Real Gmail OAuth.
- Real Calendar OAuth.
- Document management integration.
- Microsoft 365 / Outlook integration.
- Mobile push notifications.
- Full task management product.
- Full document provenance graph.
- Production authentication expansion.
- Real-time Firestore triggers.

These are valuable, but they are integration-heavy and easy to under-deliver in the remaining window.

---

## Immediate Implementation Fixes

### Fix 1: Attorney Rate Lookup

Current issue:

`timer_capture()` in `backend/app/routes/actions.py` reads `hourly_rate`, but the canonical `Attorney` model uses `default_rate`.

Recommendation:

```python
rate = float(attorney_doc.to_dict().get("default_rate", 350.0))
```

Impact:

This prevents silent fallback billing at the wrong rate.

### Fix 2: Preserve Raw Note

The HUD currently sends only the final narrative. For defensibility, preserve both:

- Attorney raw note.
- Litt-normalized narrative.
- Whether Gemini was used.
- Model name.

Short-term storage options:

- Add raw note to audit `after_state`.
- Add raw note to `activity_log`.
- Preferably add `work_session.raw_note` once `work_sessions` exists.

### Fix 3: Audit Event Name Consistency

Current issue:

`billing.py` logs `ENTRY_NARRATIVE_UPDATED`, while `docs/data-contract.md` lists `ENTRY_NARRATIVE_AMENDED`.

Recommendation:

Use one canonical event name. Prefer the contract value:

```text
ENTRY_NARRATIVE_AMENDED
```

### Fix 4: Scrubber Feedback in HUD

After capture, Litt should immediately indicate whether the entry is clean or needs review.

Minimum implementation:

- After successful capture, call `GET /api/billing/scrubber/{entry_id}`.
- Show "Entry created - pending review" plus warning count if warnings exist.

Better implementation:

- Add a lightweight pre-confirm scrubber preview endpoint that accepts narrative, matter, client, attorney, and minutes without writing.

For June 11, the post-capture scrubber call is sufficient.

### Fix 5: Gemini Timeout Fallback

The normalize call should never block the demo.

Recommendation:

- Frontend timeout: 8 seconds.
- If timeout occurs, use raw description.
- Mark `used_gemini=false`.
- Keep confirm available.

---

## Recommended Data Model Additions

### Collection: `work_sessions`

Path:

```text
firms/{firm_id}/work_sessions/{session_id}
```

Every document extends `LittBaseModel`.

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

    billable_candidate: bool = True
    time_entry_id: Optional[str] = None
    follow_up_action_id: Optional[str] = None
    communication_id: Optional[str] = None

    ai_assisted: bool = False
    ai_tool: Optional[str] = None
    model: Optional[str] = None

    source_type: Optional[str] = None
    source_id: Optional[str] = None
    source_excerpt: Optional[str] = None

    version: int = 1
```

### Collection: `follow_up_actions`

This can be deferred if time gets tight, but it is the natural partner to Quick Capture.

Path:

```text
firms/{firm_id}/follow_up_actions/{action_id}
```

```python
class FollowUpStatus(str, Enum):
    SUGGESTED = "SUGGESTED"
    ACCEPTED = "ACCEPTED"
    DONE = "DONE"
    DISMISSED_WITH_REASON = "DISMISSED_WITH_REASON"


class FollowUpAction(LittBaseModel):
    matter_id: Optional[str]
    client_id: Optional[str]
    assigned_to: str
    created_by: str
    source_work_session_id: Optional[str]
    description: str
    due_date: Optional[date]
    status: FollowUpStatus
    dismissal_reason: Optional[str] = None
    version: int = 1
```

For June 11, `follow_up_actions` can be either:

- Fully added as a simple collection and shown in the dashboard, or
- Represented in `work_sessions` as `capture_type="follow_up"` with no separate collection yet.

Choose the second option if time is constrained.

---

## Tool Layer Recommendations

All writes must remain in `backend/app/tools/`.

Add:

```text
backend/app/tools/work_sessions.py
```

Recommended functions:

```python
create_work_session(...)
confirm_work_session(...)
discard_work_session(...)
link_time_entry_to_work_session(...)
```

### `create_work_session()`

Creates a work session record for timer or quick capture input.

Rules:

- Requires `firm_id`.
- Requires `attorney_id`.
- Requires `raw_note`.
- Accepts optional matter/client.
- Checks idempotency.
- Writes audit event `WORK_SESSION_CREATED`.
- Returns `ToolResult`.

### `confirm_work_session()`

Moves a session from `REVIEW_READY` to `CONFIRMED`.

Rules:

- Requires optimistic lock.
- Writes audit event `WORK_SESSION_CONFIRMED`.
- Does not automatically create a time entry unless explicitly requested.

### `discard_work_session()`

Moves a session to `DISCARDED`.

Rules:

- Requires reason if session has more than a trivial duration.
- Writes audit event `WORK_SESSION_DISCARDED`.

### `link_time_entry_to_work_session()`

Links a created `time_entry` to a `work_session`.

Rules:

- Requires both records to exist under same `firm_id`.
- Writes audit event `WORK_SESSION_LINKED_TO_TIME_ENTRY`.

---

## API Recommendations

### Existing Timer Endpoints

Keep:

```text
POST /api/actions/timer/normalize-narrative
POST /api/actions/timer/capture
GET /api/matters
```

Modify `timer/capture` to:

- Use attorney `default_rate`.
- Accept `raw_note`.
- Create `work_session` if `work_sessions` has been added.
- Link resulting time entry to the work session.

Suggested request:

```json
{
  "firm_id": "strand-okafor",
  "matter_id": "rivera-v-holbrook",
  "attorney_id": "dana-strand",
  "session_minutes": 7,
  "raw_note": "Reviewed Rivera depo outline with Omar",
  "narrative": "Reviewed deposition outline and discovery strategy.",
  "used_gemini": true,
  "idempotency_key": "timer-abc123"
}
```

### New Quick Capture Endpoint

```text
POST /api/actions/work-session/capture
```

Request:

```json
{
  "firm_id": "strand-okafor",
  "attorney_id": "dana-strand",
  "matter_id": "rivera-v-holbrook",
  "capture_type": "call",
  "raw_note": "Call with Omar about Rivera depo prep, send follow up re exhibits",
  "session_minutes": 18,
  "billable_candidate": true,
  "create_time_entry": true,
  "create_follow_up": true,
  "idempotency_key": "quick-abc123"
}
```

Response:

```json
{
  "success": true,
  "entity_id": "ws-abc123",
  "entity_type": "work_session",
  "audit_event_id": "audit-xyz",
  "data": {
    "time_entry_id": "te-abc123",
    "follow_up_action_id": "fu-abc123"
  }
}
```

For the first implementation, `create_follow_up` can be ignored or stubbed if `follow_up_actions` is deferred.

### Proactive Dashboard Endpoint

```text
GET /api/work-sessions/today?firm_id=strand-okafor&attorney_id=dana-strand
```

Returns:

```json
{
  "items": [
    {
      "session_id": "ws-001",
      "capture_type": "timer",
      "matter_name": "Rivera v. Holbrook",
      "client_name": "Marcus Rivera",
      "session_minutes_actual": 18,
      "raw_note": "Reviewed Rivera depo outline with Omar",
      "normalized_summary": "Reviewed deposition outline and discovery strategy.",
      "status": "CONFIRMED",
      "time_entry_id": "te-001"
    }
  ],
  "count": 1
}
```

---

## Frontend Recommendations

### HUD Modes

The HUD should have two modes:

```text
Timer | Quick
```

#### Timer Mode

Current workflow:

```text
Idle -> Select matter -> Running -> Stop -> Review -> Confirm -> Done
```

Keep this workflow. Harden it.

#### Quick Mode

Workflow:

```text
Open HUD -> Select capture type -> Matter -> Note -> Optional minutes -> Review -> Confirm
```

Capture types:

- Call
- Email
- Document
- Follow-up
- Nonbillable

Keep the UI tight. Avoid building a full form-heavy page.

### Proactive Dashboard Panel

Add a panel near the top of the Daily Closeout Brief:

```text
Captured Today
```

Recommended fields:

- Total captured sessions.
- Total captured minutes.
- Number linked to time entries.
- Number still needing review.
- Latest 3 captured items.

This panel is important for storytelling. It visually proves the shift from reactive to proactive.

---

## Demo Narrative

### Recommended Demo Sequence

#### Scene 1: Proactive Capture

Narration:

> "Before Dana runs closeout, she finishes a client call. Instead of reconstructing it later, Litt captures it now."

Action:

- HUD visible with timer running.
- Dana clicks Stop.
- Raw note is visible.
- Litt normalizes the narrative.
- Dana confirms.
- Done state shows `PENDING` time entry.

#### Scene 2: Quick Capture

Narration:

> "For work that does not need a timer, Dana can capture the action directly."

Action:

- Open Quick mode.
- Select "Document work" or "Follow-up."
- Enter rough note.
- Confirm.

#### Scene 3: Run Closeout

Narration:

> "The closeout brief is no longer the main data-entry workflow. It is the exception report."

Action:

- Click Run Closeout.
- Agent timeline runs.
- Brief shows remaining deadline, billing, budget, comms, and anomaly items.
- Captured Today panel shows proactive captures.

#### Scene 4: Audit Trail

Narration:

> "Every confirmed action writes through deterministic tools and leaves an audit trail."

Action:

- Open audit drawer or audit log page.
- Show `ENTRY_CREATED` and/or `WORK_SESSION_CREATED`.

---

## June 4 to June 11 Build Timeline

This plan assumes the current codebase already has the initial Timer HUD and closeout dashboard.

### June 4 Evening: Planning and Stabilization

Goals:

- Lock scope.
- Fix obvious HUD correctness issues.
- Prepare implementation tasks for agents.

Tasks:

- Create this build plan.
- Fix attorney rate lookup from `hourly_rate` to `default_rate`.
- Align narrative audit event name with contract.
- Add `raw_note` to timer capture request and route.
- Decide whether `work_sessions` ships before or after HUD hardening.
- Review current test health.

Acceptance:

- Timer capture uses correct attorney rate.
- No known contract mismatch for narrative event names.
- Agents have this document as the shared implementation plan.

### June 5: Harden Timer HUD

Goals:

- Make timer reliable enough to be a product pillar in the demo.

Tasks:

- Preserve raw note and normalized narrative.
- Add Gemini timeout fallback.
- Add post-capture scrubber feedback.
- Ensure same idempotency key is reused on confirm retry.
- Ensure demo reset clears or seeds timer state.
- Add frontend tests for localStorage and state transitions if practical.
- Add backend tests for timer capture idempotency and rate lookup.

Acceptance:

- Full timer flow works locally.
- Entry created with correct `entry_date` from demo clock.
- Entry created with correct attorney `default_rate`.
- Duplicate confirm does not create duplicate entries.
- Raw note is preserved somewhere defensible.

### June 6: Add `work_sessions` Foundation

Goals:

- Add the parent capture record that supports the proactive strategy.

Tasks:

- Update `backend/app/models.py` with `WorkSession`, `WorkSessionStatus`, `WorkCaptureType`.
- Update `docs/data-contract.md` with `work_sessions`.
- Add `backend/app/tools/work_sessions.py`.
- Add audit event names:
  - `WORK_SESSION_CREATED`
  - `WORK_SESSION_CONFIRMED`
  - `WORK_SESSION_DISCARDED`
  - `WORK_SESSION_LINKED_TO_TIME_ENTRY`
- Add route for today's work sessions.
- Modify timer capture to create/link a work session, or create a work session first and then create/link the time entry.
- Add tests for create/link/discard.

Acceptance:

- Timer capture creates a `work_session`.
- Timer capture creates a `time_entry`.
- The two records are linked.
- Both writes are audited.

### June 7: Quick Capture Mode

Goals:

- Add non-timer proactive capture.

Tasks:

- Add Quick mode UI in `TimerHUD.tsx` or split HUD into smaller components.
- Capture types: call, email, document, follow-up, nonbillable.
- Add `POST /api/actions/work-session/capture`.
- Use Gemini to normalize summary when useful.
- If `create_time_entry=true`, call `write_time_entry()` through tool layer.
- Keep follow-up creation simple. If separate follow-up model is too much, store follow-up captures as `work_session.capture_type="follow_up"`.

Acceptance:

- User can create a non-timer work session.
- User can optionally create a time entry from quick capture.
- Quick captures appear in the proactive dashboard endpoint.

### June 8: Proactive Dashboard Panel

Goals:

- Make the product shift visible.

Tasks:

- Add `Captured Today` panel to `DailyCloseoutBrief.tsx`.
- Fetch `GET /api/work-sessions/today`.
- Show captured count, total minutes, linked time entries, and needs-review count.
- Show latest captured items.
- Add empty state: "No work captured yet today."
- Ensure panel does not clutter existing closeout flow.

Acceptance:

- Captured timer and quick capture items appear in dashboard.
- Brief still loads all existing sections.
- UI remains streamlined and demo-friendly.

### June 9: Demo Flow and Polish

Goals:

- Make the full proactive story crisp and repeatable.

Tasks:

- Update `docs/HACKATHON-DEMO-SCRIPT.md` with proactive HUD scenes.
- Add demo reset seeding for timer if desired.
- Ensure `GET /api/demo/ready` still passes.
- Ensure timer-created entries do not break readiness anchors.
- Verify audit drawer/log displays HUD-related audit events.
- Polish copy and labels.
- Tighten HUD layout on mobile and desktop.

Acceptance:

- Proactive capture scene takes under 20 seconds.
- Quick capture scene takes under 15 seconds.
- Full demo remains under the required video length.

### June 10: Hardening, Tests, Deployment

Goals:

- Stop building new features. Stabilize.

Tasks:

- Run backend tests.
- Run dashboard build.
- Run dashboard responsive checks.
- Test demo reset.
- Test full timer flow.
- Test quick capture flow.
- Test closeout sweep.
- Deploy backend and dashboard.
- Verify deployed Cloud Run URLs.
- Update architecture diagram to include HUD/work sessions.
- Update Devpost description to mention proactive capture.

Acceptance:

- Deployed demo works end to end.
- No new feature work remains.
- Only demo-breaking bugs are allowed after this point.

### June 11: Final Verification and Submission

Goals:

- Submit calmly before 8:00 PM.

Tasks:

- Reset demo.
- Run readiness check.
- Perform one full local dry run.
- Perform one full deployed dry run.
- Record final video.
- Confirm public GitHub repo.
- Confirm architecture diagram.
- Confirm Devpost description.
- Submit before 8:00 PM.

Acceptance:

- Submission complete.
- Live URL works.
- Demo video matches shipped app.

---

## Suggested Agent Task Breakdown

### Agent A: Backend Tooling

Owns:

- `models.py` additions.
- `tools/work_sessions.py`.
- Timer capture route modifications.
- Quick capture route.
- Backend tests.

Priority:

1. Rate fix.
2. Raw note preservation.
3. `work_sessions`.
4. Quick capture endpoint.

### Agent B: Frontend HUD

Owns:

- Timer HUD hardening.
- Quick Capture mode.
- Scrubber feedback.
- Demo reset HUD state.
- Responsive polish.

Priority:

1. Stabilize existing timer.
2. Add Quick mode.
3. Improve done/warning states.

### Agent C: Dashboard and Demo

Owns:

- Captured Today panel.
- API client/types.
- Demo script.
- Architecture diagram update.
- Devpost wording.

Priority:

1. Dashboard visibility.
2. Demo script.
3. Submission materials.

---

## Risk Register

### Risk: Scope Creep Into Passive Capture

Impact:

High. Passive capture needs browser/desktop/document integrations and is not realistic before June 11.

Mitigation:

Keep v1.0 capture manual but structured. Present passive integrations as roadmap.

### Risk: Work Sessions Add Too Much Backend Churn

Impact:

Medium. Adding a collection touches models, docs, tools, routes, tests, and UI.

Mitigation:

Keep the model small. Do not add a full follow-up collection unless time allows.

### Risk: Gemini Latency Hurts Demo

Impact:

Medium.

Mitigation:

Timeout and fallback to raw note. The attorney can still confirm.

### Risk: HUD Creates Demo Data That Breaks Readiness Checks

Impact:

Medium.

Mitigation:

Readiness checks should verify required anchors exist, not require exact counts. Run reset before every demo.

### Risk: UI Becomes Too Busy

Impact:

Medium.

Mitigation:

Keep HUD compact. Quick Capture should be a mode, not a full dashboard page. Captured Today panel should be concise.

---

## Success Criteria

By June 11, Litt should be able to demonstrate:

- An attorney captures live work through the HUD.
- Litt turns rough notes into clean billing language.
- The attorney remains in control before anything consequential is written.
- Captured work writes through deterministic tools.
- Captured work leaves an audit trail.
- Captured work appears in the dashboard.
- The Daily Closeout Brief becomes an exception report, not the primary data-entry surface.

The strongest version of the submission is not "we added a timer." It is:

> Litt now has a live attorney operations HUD. The system captures work at the moment it happens, turns it into structured billing and follow-up records, and preserves a defensible audit trail. The closeout brief remains as the safety net for anything that still needs judgment.

