# Litt Agent Visibility Build — Complete Implementation Checklist

**Version:** 1.1 (updated post-build)  
**Scope:** Days 5-7 polish phase  
**Time estimate:** 8 hours total  
**Status:** COMPLETE — all phases shipped as of June 3, 2026  

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

### Phase 1: Data Models & Instrumentation (2 hours) — COMPLETE

**File:** 02-AGENT-OBSERVATION-INSTRUMENTATION.md

**Tasks:**
- [x] Create `backend/app/observability.py` (merged into single module)
  - [x] `ObservationType` enum (7 types)
  - [x] `CommitmentLevel` enum (4 levels)
  - [x] `AgentObservation` model
  - [x] `AgentRunTimeline` model
  - [x] `generate_observation_id()` helper

- [x] Observation tracking embedded in `AgentObservation` (audit_log_id field links to audit event)

- [x] Modify `backend/app/agents/coordinator.py`
  - [x] `_emit_observation()` method
  - [x] Sweep instrumented with signal_received, routing_decision, tool_call, result, escalation, approval_gate observations
  - [x] Sub-agent observations collected and merged into timeline

- [x] Instrument sub-agents
  - [x] `deadline_agent` — observations per deadline, escalation observations for conflict_flagged
  - [x] `billing_agent` — scrubber, anomaly, budget observations
  - [x] `comms_agent` — draft generation, gate observations
  - [x] `anomaly_agent` — pattern scan observations

**Success criteria:**
- [x] Models compile without errors
- [x] Coordinator emits >20 observations per sweep
- [x] All 7 observation types appear
- [x] All 4 commitment levels appear
- [x] Observations include confidence scores
- [x] Evidence references populated

---

### Phase 2: API & Firestore (1.5 hours) — COMPLETE

**File:** 03-AUDIT-LOG-AND-API.md

**Tasks:**
- [x] Routes in `backend/app/routes/brief.py` (merged, not separate file)
  - [x] `POST /api/sweep` — trigger sweep, return `SweepRunResponse {timeline, brief}`
  - [x] `GET /api/sweep/{run_id}` — retrieve stored timeline from `agent_runs` collection
  - [x] `GET /api/audit-log` — filterable audit log (tier, entity_type, actor, limit)
  - [x] `GET /api/source-email/{email_id}` — source email for conflict_flagged deadlines

- [x] Response models: `SweepRunResponse`, `AgentRunTimeline`, `BriefResponse`

- [x] Firestore: `firms/{firm_id}/audit_log` (CREATE-only via security rules)
  - [x] `firms/{firm_id}/agent_runs/{run_id}` schema ready (GET /api/sweep/{run_id})

- [x] Tool layer writes: all tools call `log_audit_event()`; audit_event_id linked in ToolResult

**Success criteria:**
- [x] `POST /api/sweep` returns 200 with observations + brief
- [x] Response includes elapsed_seconds, brief_items_count
- [x] Firestore documents created with correct structure
- [x] `/api/audit-log` returns filterable audit history with before/after state
- [x] Human decisions create new audit events (tool calls write new records, never update)

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

- [x] ProofRail CSS embedded inline via style objects (design-token CSS variables throughout)
  - [x] Collapse animation (rail → 40px strip)
  - [x] Gate badge colors (teal AUTO_SAFE, blue REVIEW_REQUIRED, amber ESCALATION, red BLOCKED)
  - [x] Confidence shown per observation
  - [x] work_kind badge (deterministic / llm_assisted / tool_write / human_gate)

- [x] Integrated into Daily Closeout Brief
  - [x] ProofRail occupies right column of 3-column layout
  - [x] "Run Closeout" button triggers sweep and populates ProofRail
  - [x] Section gate level shown in center column headers

- [x] Additional components:
  - [x] AuditEventDrawer — shown on action completion
  - [x] DeadlineModal source email viewer
  - [x] AuditLog page (`/audit`)

**Success criteria:**
- [x] Component compiles without errors
- [x] Timeline renders 20+ observations
- [x] All gate colors distinct and readable
- [x] ProofRail collapse/expand works
- [x] Source email viewer fetches live from Firestore

---

### Phase 4: Demo Fixtures (1 hour) — COMPLETE

**File:** 05-DEMO-FIXTURES-AND-SCRIPT.md

**Tasks:**
- [x] `backend/app/demo/seeder.py` — full corpus
  - [x] Demo firm: Strand & Okafor LLP (strand-okafor)
  - [x] 5 matters (mercer-v-dunlap, whitmore-employment-2026, acme-commercial, okafor-estate-planning, rivera-opp)
  - [x] Source emails collection (`email-rivera-opp-20260528`)
  - [x] 11 time entries (te-001 through te-011)
  - [x] Seed functions idempotent

- [x] All observation types covered:
  - [x] **SIGNAL_RECEIVED:** Coordinator observes signals
  - [x] **REASONING:** Agents reason about sources
  - [x] **ROUTING_DECISION:** Coordinator routes signals via Python dict
  - [x] **TOOL_CALL:** Agents execute tool writes
  - [x] **RESULT:** Agents return structured results
  - [x] **ESCALATION:** Rivera conflict + reconstruction flag + AI_DISCLOSURE_GAP
  - [x] **APPROVAL_GATE_APPLIED:** Whitmore draft blocked

- [x] All gates covered:
  - [x] **AUTO_SAFE:** Informational observations
  - [x] **REVIEW_REQUIRED:** Billing entries, client silence
  - [x] **ESCALATION:** Rivera, anomalies, budget CRITICAL
  - [x] **BLOCKED:** Whitmore comms draft pending attorney approval

- [x] Specific demo scenarios — all implemented:
  - [x] Rivera conflict_flagged — opposing counsel email, no court order, Gemini extraction, Verify action
  - [x] Mercer — 20 days silence + HARD_LEGAL deadline + billing anomaly (multi-signal compound)
  - [x] Acme — budget 92% CRITICAL (13,800 / 15,000 committed)
  - [x] AI_DISCLOSURE_GAP — te-010, Gemini-assisted entry without disclosure status
  - [x] DUPLICATE_ENTRY_CANDIDATE — te-011, duplicate of te-001 (same attorney/matter/date/hours)
  - [x] Reconstruction flag — round hours, no session provenance
  - [x] Whitmore silence — 16+ days, draft generated, delivery blocked

**Success criteria:**
- [x] Demo data is deterministic and reproducible
- [x] `POST /api/demo/reset` seeds all data
- [x] `POST /api/sweep` produces timeline with 20+ observations
- [x] Timeline shows deadline conflict clearly
- [x] Timeline shows billing anomalies clearly
- [x] All 7 observation types appear
- [x] All 4 commitment gates appear

---

### Phase 5: Demo Script & Testing (1 hour)

**File:** 05-DEMO-FIXTURES-AND-SCRIPT.md

**Tasks:**
- [x] Demo walkthrough script — `docs/HACKATHON-DEMO-SCRIPT.md`
  - [x] 90-second narration (2-minute hard cap)
  - [x] Rivera source email viewer narration (1:15–1:30 section)
  - [x] Verify action completing with AuditEventDrawer
  - [x] Audit trail explanation
  - [x] Key shots checklist with Rivera email, Verify action, audit trail

- [ ] Recording checklist — run before every take
  - [x] Script written, checklist embedded in demo script
  - [ ] Demo reset + readiness check passing
  - [ ] Video recorded

- [ ] Record demo video — **pending (Day 7)**
  - [ ] First take: full run-through
  - [ ] Second take: final version
  - [ ] Save as MP4, H.264, 1920×1080, 30 FPS

**Success criteria:**
- [x] Script is clear and compelling
- [ ] Recording is under 2 minutes
- [x] Escalation moment is prominent (Rivera ESCALATION + source email + Verify)
- [x] Audit trail is physically inspectable at /audit
- [ ] Video is clean (no console errors, no jank)

---

## Daily Implementation Schedule

### Day 6 Morning (3-4 hours) — COMPLETE

**Goal:** Complete all backend instrumentation and API endpoints

- [x] Observability models (`backend/app/observability.py`)
- [x] Coordinator and all sub-agents instrumented
- [x] `POST /api/sweep` returns `{timeline, brief}`
- [x] `GET /api/audit-log` filterable endpoint
- [x] `GET /api/source-email/{email_id}` endpoint
- [x] 199/199 backend tests passing

**Checkpoint:** ✅ `POST /api/sweep` returns observations

---

### Day 6 Afternoon (2-3 hours) — COMPLETE

**Goal:** Build React timeline component and integrate

- [x] ProofRail component with collapse, gate badges, work_kind
- [x] DeadlineModal — full rewrite with Verify tab + source email viewer
- [x] AuditLog page at `/audit`
- [x] TypeScript: zero errors

**Checkpoint:** ✅ Timeline renders observations; source email viewer live

---

### Day 6 Evening (1-2 hours) — COMPLETE

**Goal:** Finalize demo fixtures and script

- [x] Demo corpus expanded (5 new scenarios)
- [x] `POST /api/demo/reset` + `GET /api/demo/ready` passing
- [x] Demo script finalized (`docs/HACKATHON-DEMO-SCRIPT.md`)
- [x] LEDES export real (not stub)

**Checkpoint:** ✅ Demo data ready, script finalized

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

## Success Criteria (Final) — Status as of June 3, 2026

The build is complete when:

- [x] **Backend:** `POST /api/sweep` returns 200 with 20+ observations in 2-3 seconds
- [x] **Observations:** All 7 types appear (signal_received, reasoning, routing, tool_call, result, escalation, approval_gate)
- [x] **Gates:** All 4 levels visible (auto_safe, review_required, escalation, blocked)
- [x] **Escalation:** Rivera deadline shows ESCALATION; source email viewable in modal; Verify action fires correct state transition
- [x] **UI:** ProofRail renders smoothly with auto-scroll; collapse/expand working
- [x] **Colors:** Gates color-coded (teal AUTO_SAFE, blue REVIEW_REQUIRED, amber ESCALATION, red BLOCKED)
- [x] **Demo:** Deterministic after `POST /api/demo/reset`
- [x] **Script:** 90-second narration documented in `docs/HACKATHON-DEMO-SCRIPT.md`
- [ ] **Video:** Clear audio, no jank, shows escalation moment prominently — **pending Day 7**
- [x] **Audit:** `/api/audit-log` returns filterable audit history; `/audit` page physically shows the trail
- [x] **LEDES:** Real LEDES 1998B export downloadable from topbar
- [x] **Source grounding:** All conflict_flagged deadlines show source excerpt, document ID, court, detected_at; source email body viewable inline
- [x] **Corpus depth:** 11 time entries, 5 matters, 5+ distinct anomaly types (AI_DISCLOSURE_GAP, DUPLICATE_ENTRY_CANDIDATE, reconstruction, scrubber hit, budget CRITICAL)
- [x] **Judge story:** Observable: source inspected, deterministic check, LLM extraction, confidence score, gate applied, evidence reference, attorney next action

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
