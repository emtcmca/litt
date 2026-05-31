# Litt Agent Visibility Build — Complete Implementation Checklist

**Version:** 1.0  
**Scope:** Days 5-7 polish phase  
**Time estimate:** 8 hours total  
**Status:** Ready to implement  

---

## May 31 Review Updates

These notes tighten the package for the hackathon demo and should be treated as build requirements, not optional polish:

- Use canonical demo identifiers from the main specs: `firm_id="strand-okafor"`, existing seed IDs such as `dl-mercer-001`, `te-001`, `te-005`, `acme-commercial`, and `whitmore-employment-2026`.
- Keep this work framed as **agent visibility over v1.0 functionality**. Do not add new v1.1 production integrations such as real Gmail OAuth, docket lookup, browser capture, or a full audit export UI.
- Preserve the deterministic/probabilistic boundary. The timeline may show LLM-assisted narrative drafting and deadline text extraction, but routing, state transitions, scrubber checks, budget math, gates, and final write permissions remain deterministic Python.
- `audit_log` remains CREATE-only. Human decisions must create new audit events such as `human_decision_recorded`; do not update existing audit rows in place.
- The dashboard path is `dashboard/`, not `frontend/`; component examples should be implemented as TypeScript/TSX unless the codebase is intentionally migrated.
- The first demo priority is legibility for judges: make the timeline explain what Litt saw, what it checked, what evidence it used, what gate it applied, and what the attorney must decide.

---

## Quick Reference

This build package contains **5 detailed markdown files** with complete, implementation-ready specifications for making Litt's agentic autonomy visible to hackathon judges.

### Files in This Package

| File | Purpose | Audience | Time |
|------|---------|----------|------|
| **01-LITT-AGENT-VISIBILITY-MASTER-PLAN.md** | Overview, scope, architecture decisions | Everyone | 20 min read |
| **02-AGENT-OBSERVATION-INSTRUMENTATION.md** | Data models, coordinator/sub-agent code | Backend dev | 2 hours |
| **03-AUDIT-LOG-AND-API.md** | Firestore schema, API endpoints | Backend dev | 1.5 hours |
| **04-REACT-TIMELINE-COMPONENT.md** | React component, CSS styling, integration | Frontend dev | 1.5 hours |
| **05-DEMO-FIXTURES-AND-SCRIPT.md** | Seed data, demo walkthrough script | Everyone | 1 hour |

**Total implementation time:** 6-8 hours  
**Total documentation time:** 5+ hours of detailed spec writing (already done)

---

## Implementation Phases

### Phase 1: Data Models & Instrumentation (2 hours)

**File:** 02-AGENT-OBSERVATION-INSTRUMENTATION.md

**Tasks:**
- [ ] Create `backend/app/models/observability.py`
  - [ ] `ObservationType` enum (7 types)
  - [ ] `CommitmentLevel` enum (4 levels)
  - [ ] `AgentObservation` model
  - [ ] `AgentRunTimeline` model
  - [ ] `generate_observation_id()` helper

- [ ] Update `backend/app/models/audit_log.py`
  - [ ] Add observation tracking fields
  - [ ] Add confidence + commitment_level fields
  - [ ] Add human decision fields

- [ ] Modify `backend/app/agents/coordinator.py`
  - [ ] Add `_emit_observation()` method
  - [ ] Instrument `run_sweep()` with 7 key observations
  - [ ] Collect observations from all sub-agents

- [ ] Instrument sub-agents
  - [ ] `deadline_monitor` — 5 observations per signal
  - [ ] `billing_agent` — 4 observations per signal
  - [ ] `comms_agent` — 3 observations per signal
  - [ ] `anomaly_agent` — 3 observations per signal

**Success criteria:**
- [ ] Models compile without errors
- [ ] Coordinator emits >20 observations per sweep
- [ ] All 7 observation types appear
- [ ] All 4 commitment levels appear
- [ ] Observations include confidence scores
- [ ] Evidence references are populated

---

### Phase 2: API & Firestore (1.5 hours)

**File:** 03-AUDIT-LOG-AND-API.md

**Tasks:**
- [ ] Create `backend/app/routes/timeline.py`
  - [ ] `POST /api/sweep` — trigger sweep, return timeline
  - [ ] `GET /api/sweep/{run_id}` — retrieve past timeline
  - [ ] `GET /api/audit/{entity_id}` — get audit history
  - [ ] `POST /api/audit/{entry_id}/decide` — append a human decision audit event; never update the original event

- [ ] Define response models
  - [ ] `SweepResponse` with observations
  - [ ] `TimelineItemResponse` with all fields
  - [ ] `AuditEntryResponse` with decision tracking

- [ ] Update Firestore schema
  - [ ] `firms/{firm_id}/agent_runs/{run_id}` collection
  - [ ] `firms/{firm_id}/audit_log/{entry_id}` collection
  - [ ] Add CREATE-only security rules

- [ ] Integrate with tools layer
  - [ ] Tools continue to call `log_audit_event()` after success
  - [ ] Audit entries linked to observations

**Success criteria:**
- [ ] `POST /api/sweep` returns 200 with observations
- [ ] Response includes elapsed_seconds, brief_items_count
- [ ] Firestore documents created with correct structure
- [ ] `/api/audit/{entity_id}` returns audit history
- [ ] Human decisions are recorded and persisted

---

### Phase 3: React Component (1.5 hours)

**File:** 04-REACT-TIMELINE-COMPONENT.md

**Tasks:**
- [ ] Create `dashboard/src/components/AgentRunTimeline.tsx`
  - [ ] Main `AgentRunTimeline` component with streaming
  - [ ] `TimelineItem` sub-component
  - [ ] `ObservationIcon` helper
  - [ ] `GateBadge` helper (4 colors)
  - [ ] `ConfidenceBar` helper
  - [ ] `DetailsList` helper

- [ ] Create `dashboard/src/components/AgentRunTimeline.css`
  - [ ] Timeline layout (grid-based)
  - [ ] Auto-scrolling animation
  - [ ] Gate badge colors (semantic)
  - [ ] Confidence bar styles
  - [ ] Dark mode support
  - [ ] Responsive design

- [ ] Integrate into Daily Closeout Brief
  - [ ] Add timeline panel above brief items
  - [ ] Add "Run Closeout" button
  - [ ] Wire up `POST /api/sweep` call
  - [ ] Display timeline while sweep is running

- [ ] Add tests
  - [ ] Component renders without errors
  - [ ] Observations appear in timeline
  - [ ] Gates are color-coded correctly
  - [ ] onComplete callback fires

**Success criteria:**
- [ ] Component compiles without errors
- [ ] Timeline renders 20+ observations smoothly
- [ ] Auto-scrolling to bottom works
- [ ] All gate colors distinct and readable
- [ ] Dark mode works automatically
- [ ] Mobile responsive (if needed)

---

### Phase 4: Demo Fixtures (1 hour)

**File:** 05-DEMO-FIXTURES-AND-SCRIPT.md

**Tasks:**
- [ ] Extend `backend/app/ingestion/demo_fixtures.py` and `backend/app/demo/seeder.py`
  - [ ] Demo firm: Strand & Okafor LLP
  - [ ] 4 active matters
  - [ ] 3 Gmail fixtures (deadline candidates)
  - [ ] 4 calendar events
  - [ ] 3 pending time entries
  - [ ] Seed functions (deterministic)

- [ ] Design scenarios to trigger all observation types
  - [ ] **SIGNAL_RECEIVED:** Coordinator observes signals ✓
  - [ ] **REASONING:** Agents think about sources ✓
  - [ ] **ROUTING_DECISION:** Coordinator routes signals ✓
  - [ ] **TOOL_CALL:** Agents execute queries ✓
  - [ ] **RESULT:** Agents find/suggest items ✓
  - [ ] **ESCALATION:** Conflicting deadline + billing flag ✓
  - [ ] **APPROVAL_GATE:** Actions queued for approval ✓

- [ ] Design scenarios to show all gates
  - [ ] **AUTO_SAFE:** Status summary, confirmed deadline ✓
  - [ ] **REVIEW_REQUIRED:** Suggested entry, client draft ✓
  - [ ] **ESCALATION:** Conflicting deadline, reconstruction flag ✓
  - [ ] **BLOCKED:** Attempted client-send action before attorney approval; Litt drafts but refuses to send ✓

- [ ] Specific demo scenarios
  - [ ] **Deadline conflict:** Rivera email says "tomorrow" but no court order (70% confidence, ESCALATION)
  - [ ] **Billing gap:** Okafor call on calendar, no time entry (suggest entry, REVIEW_REQUIRED)
  - [ ] **Incomplete entry:** Mercer 1.4h, no narrative (flag for review, REVIEW_REQUIRED)
  - [ ] **Client silence:** 16 days since contact (draft update, REVIEW_REQUIRED)
  - [ ] **Blocked client send:** draft exists, but delivery is blocked until attorney approves (BLOCKED)
  - [ ] **Reconstruction flag:** Round hours + minimal context (anomaly escalation, ESCALATION)

**Success criteria:**
- [ ] Demo data is deterministic and reproducible
- [ ] `POST /api/demo/reset` seeds all data
- [ ] `POST /api/sweep` produces timeline with 20+ observations
- [ ] Timeline shows deadline conflict clearly
- [ ] Timeline shows billing gap clearly
- [ ] All 7 observation types appear
- [ ] All 4 commitment gates appear

---

### Phase 5: Demo Script & Testing (1 hour)

**File:** 05-DEMO-FIXTURES-AND-SCRIPT.md

**Tasks:**
- [ ] Write demo walkthrough script
  - [ ] 90-second narration (fits 2-minute video)
  - [ ] Key talking points at each step
  - [ ] Explanation of safety gates
  - [ ] Audit trail explanation

- [ ] Create recording checklist
  - [ ] Reset demo data before each take
  - [ ] Verify all observations appear
  - [ ] Verify escalation is clear
  - [ ] Verify audit log shows decision trail

- [ ] Record demo video
  - [ ] First take: full run-through
  - [ ] Review for impact and pacing
  - [ ] Second take: final version
  - [ ] Save as MP4, H.264, 1920x1080, 30 FPS

**Success criteria:**
- [ ] Script is clear and compelling
- [ ] Recording is under 2 minutes
- [ ] Escalation moment is prominent
- [ ] Audit trail is visible
- [ ] Video is clean (no console errors, no jank)

---

## Daily Implementation Schedule

### Day 6 Morning (3-4 hours)

**Goal:** Complete all backend instrumentation and API endpoints

**Tasks:**
- [ ] (30 min) Review 02-... and 03-... files, ask questions
- [ ] (1 hour) Implement observability models
- [ ] (1 hour) Instrument coordinator and sub-agents
- [ ] (1 hour) Create timeline API endpoints
- [ ] (30 min) Test `/api/sweep` locally
- [ ] (30 min) Verify Firestore documents created

**Checkpoint:** `POST /api/sweep` returns observations

---

### Day 6 Afternoon (2-3 hours)

**Goal:** Build React timeline component and integrate

**Tasks:**
- [ ] (30 min) Review 04-... file, set up component files
- [ ] (1.5 hours) Implement AgentRunTimeline component + CSS
- [ ] (30 min) Integrate into Daily Closeout Brief view
- [ ] (1 hour) Test rendering, scrolling, dark mode

**Checkpoint:** Timeline renders observations smoothly

---

### Day 6 Evening (1-2 hours)

**Goal:** Finalize demo fixtures and script

**Tasks:**
- [ ] (1 hour) Extend demo fixtures/seeder with visibility scenarios
- [ ] (30 min) Test `POST /api/demo/reset` and `POST /api/sweep`
- [ ] (30 min) Write final demo script with timing
- [ ] (30 min) Create recording checklist

**Checkpoint:** Demo data is ready, script is finalized

---

### Day 7 Morning (1-2 hours)

**Goal:** Record final demo video

**Tasks:**
- [ ] (30 min) Reset demo, verify all observations
- [ ] (30 min) Record first take
- [ ] (30 min) Review, adjust if needed
- [ ] (30 min) Record final take
- [ ] (15 min) Export as MP4

**Checkpoint:** Demo video recorded and ready

---

## Implementation Dependencies

```
Phase 1 (Models) → Phase 2 (API) → Phase 3 (UI) → Phase 4 (Fixtures) → Phase 5 (Demo)
```

**You cannot skip ahead.** API depends on models. UI depends on API. Fixtures depend on everything.

---

## Testing at Each Phase

### After Phase 1 (Models)

```bash
python -m pytest backend/tests/test_models_observability.py -v

# Should pass:
# - Models instantiate without errors
# - Enums have correct values
# - generate_observation_id() produces unique IDs
```

### After Phase 2 (API)

```bash
# Start server
python -m uvicorn backend.app.main:app --reload

# Test endpoint
curl -X POST http://localhost:8000/api/sweep \
  -H "Content-Type: application/json" \
  -d '{"firm_id": "strand-okafor", "triggered_by": "manual_run"}'

# Should return:
# - run_id
# - observations array with 20+ items
# - elapsed_seconds
# - brief_items_count
```

### After Phase 3 (UI)

```bash
# Start frontend
npm run dev

# Navigate to Daily Closeout Brief view
# Click "Run Closeout" button
# Verify:
# - Timeline appears
# - Observations scroll smoothly
# - Colors are semantic
# - Dark mode works
```

### After Phase 4 (Fixtures)

```bash
curl -X POST http://localhost:8000/api/demo/reset?firm_id=strand-okafor

curl -X POST http://localhost:8000/api/sweep \
  -H "Content-Type: application/json" \
  -d '{"firm_id": "strand-okafor", "triggered_by": "manual_run"}'

# Verify:
# - Exactly 20+ observations (deterministic)
# - Includes deadline conflict (ESCALATION gate)
# - Includes billing gap (REVIEW_REQUIRED gate)
# - Includes reconstruction flag (ESCALATION gate)
```

### After Phase 5 (Demo)

```bash
# Watch video
# Verify:
# - Narrator explains autonomy
# - Timeline is visible and clear
# - Escalation moment is prominent
# - Audit trail is shown
# - Total duration < 2 minutes
```

---

## Common Pitfalls & Solutions

### Pitfall 1: Timeline rendering jank

**Symptom:** Observations appear slowly, scroll is choppy

**Solution:**
- Add `animation-delay` staggering (already in CSS)
- Use CSS `contain: layout` on timeline items
- Limit to 30 observations on screen (virtualize if needed)
- Verify React dev mode is off for production build

### Pitfall 2: Observations not appearing in timeline

**Symptom:** API returns observations, but React doesn't render them

**Solution:**
- Verify `observations` array is passed as prop
- Check browser console for errors
- Verify observation_id is unique for each item
- Test with mock data first, then live API

### Pitfall 3: Demo fixtures aren't deterministic

**Symptom:** Timeline observations different on second run

**Solution:**
- Use `DEMO_DATE = get_effective_date()` for all date math
- Ensure ingestion sources return same data each time
- Use demo clock environment variable: `LITT_DEMO_DATE=2026-05-29`
- Call `POST /api/demo/reset` before each sweep

### Pitfall 4: Deadline conflict doesn't escalate

**Symptom:** Rivera email returns REVIEW_REQUIRED instead of ESCALATION

**Solution:**
- Verify confidence is 0.7 (not 0.95)
- Verify `conflict_flag: True` is set on fixture
- Check deadline_monitor code: should emit ESCALATION for confidence < 0.85
- Test with mock observations if agent code is unclear

### Pitfall 5: CSS variables not loading in dark mode

**Symptom:** Colors look wrong in dark mode

**Solution:**
- Verify CSS uses `var(--color-*)`, not hex values
- Check that design tokens CSS is imported first
- Test in both light and dark mode via browser dev tools
- Verify `@media (prefers-color-scheme: dark)` is working

---

## Success Criteria (Final)

The build is complete when:

- [ ] **Backend:** `POST /api/sweep` returns 200 with 20+ observations in 2-3 seconds
- [ ] **Observations:** All 7 types appear (signal_received, reasoning, routing, tool_call, result, escalation, approval_gate)
- [ ] **Gates:** All 4 levels visible (auto_safe, review_required, escalation, blocked)
- [ ] **Escalation:** Rivera deadline shows ESCALATION with 70% confidence
- [ ] **UI:** Timeline renders smoothly, auto-scrolls to bottom
- [ ] **Colors:** Gates are color-coded (teal, blue, amber, red)
- [ ] **Dark mode:** Works automatically via CSS variables
- [ ] **Demo:** Deterministic (same observations every time after reset)
- [ ] **Script:** 90-second narration, under 2 minutes total
- [ ] **Video:** Clear audio, no jank, shows escalation moment prominently
- [ ] **Audit:** Human decisions are logged and retrievable via `/api/audit/{entity_id}`
- [ ] **Judge story:** At least one visible observation names each of these: source inspected, deterministic check performed, LLM/narrative step, confidence, gate, evidence, and attorney next action

---

## What Judges Will See

**Before:** "Litt generated a brief with rules and AI summaries."

**After:** "Litt observed the firm's communications and calendar, planned comprehensive checks, found a deadline with conflicting evidence and intelligently escalated it, detected billing gaps, drafted client communications, flagged anomalies, and logged every decision — all in 2 seconds, all with full audit trail."

That's the delta you're building.

---

## File Organization

```
backend/
  app/
    models/
      observability.py          [NEW] Observation models
    routes/
      timeline.py               [NEW] Timeline API endpoints
    agents/
      coordinator.py            [MODIFY] Add instrumentation
      [deadline/billing/comms/anomaly agents]  [MODIFY] Add observations
    ingestion/
      demo_fixtures.py          [MODIFY] Demo ingestion fixtures
    demo/
      seeder.py                 [MODIFY] Demo seed/reset data

dashboard/
  src/
    components/
      AgentRunTimeline.tsx      [NEW] Timeline component
      AgentRunTimeline.css      [NEW] Timeline styling
    components/
      DailyCloseoutBrief.tsx    [MODIFY] Integrate timeline

docs/
  HACKATHON-DEMO-SCRIPT.md      [NEW] Demo walkthrough

tests/
  test_observability_models.py  [NEW] Model tests
  test_timeline_api.py          [NEW] API tests
  test_agent_observations.py    [NEW] Instrumentation tests
```

---

## Questions Before Starting?

Review these points:

1. **Determinism:** All observations are deterministic. Gates are deterministic. Only confidence scores are probabilistic.
2. **Safety:** No new autonomous powers. Only visibility into existing autonomy.
3. **Demo:** One specific scenario (Strand & Okafor, May 29, 4:30 PM). Deterministic seed data.
4. **Time:** 8 hours total, achievable in Day 6-7 afternoon/evening.
5. **Impact:** Makes the difference between "rules + summaries" and "autonomous agent with safety gates."

---

## Next Steps

1. **Read 01-...-MASTER-PLAN.md** — 20 minutes, gets you oriented
2. **Read 02-...-INSTRUMENTATION.md** — Start coding backend
3. **Read 03-...-API.md** — Understand API contract
4. **Read 04-...-TIMELINE.md** — Start frontend component
5. **Read 05-...-FIXTURES.md** — Set up demo
6. **Implement in order** — Phase 1 → 2 → 3 → 4 → 5
7. **Test at each checkpoint** — Don't skip
8. **Record demo on Day 7** — Final 1-2 hours

**You've got this.** The spec is comprehensive. The code examples are detailed. Just follow the checklist.

---

**Good luck with the build. See you on submission day.** 🚀
