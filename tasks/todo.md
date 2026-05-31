# Litt — Sprint Task List

**Sprint:** May 30 – June 5, 2026  
**Status key:** `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Day 1 — Foundation + Skeleton Deploy ✓ COMPLETE
*Goal: Live Cloud Run URL. Firestore seeded. Backend reads it.*

### Infra
- [x] D1-01 GCP project created, all APIs enabled, billing set up, $500 credit claimed
- [x] D1-02 GitHub repo `github.com/emtcmca/litt` created, public, initial commit
- [x] D1-03 Service account created, roles assigned, JSON key in Secret Manager
- [x] D1-04 `.env` created from `.env.example`, demo mode vars set

### Backend scaffold
- [x] D1-05 `backend/requirements.txt` with all dependencies
- [x] D1-06 `backend/app/config.py` — demo clock (`get_effective_date`, `get_effective_datetime`)
- [x] D1-07 `backend/app/models.py` — all Pydantic models per data-contract.md
- [x] D1-08 `backend/app/db.py` — Firestore client
- [x] D1-09 `backend/app/main.py` — FastAPI skeleton, `GET /health`, CORS
- [x] D1-10 `Dockerfile.backend`

### Firestore
- [x] D1-11 Firestore security rules deployed (audit_log CREATE-only, deadline_events CREATE-only, time_entries no DELETE)

### Seed data
- [x] D1-12 `scripts/seed_demo.py` — full Strand & Okafor seed, idempotent
- [x] D1-13 Run seed script, verify all collections in Firestore console

### Dashboard scaffold
- [x] D1-14 `dashboard/` — Vite + React + TypeScript + Tailwind
- [x] D1-15 `Dockerfile.dashboard`
- [x] D1-16 Placeholder homepage showing firm name from `/health`

### Cloud Run deployment
- [x] D1-17 Deploy `litt-backend` Cloud Run service — https://litt-backend-1073532050878.us-central1.run.app
- [x] D1-18 Deploy `litt-dashboard` Cloud Run service — https://litt-dashboard-1073532050878.us-central1.run.app
- [x] D1-19-FIX `allUsers` org policy override applied, IAM bindings set — both services publicly accessible

### Demo skeleton endpoints
- [x] D1-19 `GET /api/demo/ready` skeleton — returns JSON structure, all checks false
- [x] D1-20 `POST /api/demo/reset` skeleton — returns not-yet-implemented

**Day 1 checkpoint: `curl {backend-url}/health` returns ok. Dashboard loads. Firestore seeded. ✓**

---

## Day 2 — Tool Layer + MCP Server ✓ COMPLETE
*Goal: State machine tests pass. Scrubber flags te-005. MCP server starts.*

### Audit tool (first)
- [x] D2-01 `backend/app/tools/audit.py` — `log_audit_event()` writes to Firestore

### Shared validation
- [x] D2-02 `backend/app/tools/validation.py` — idempotency check, optimistic lock check

### Billing tools
- [x] D2-03 `backend/app/tools/billing.py` — `advance_entry_status()` with `VALID_TRANSITIONS`
- [x] D2-04 `backend/app/tools/billing.py` — `write_time_entry()` with 6-min rounding
- [x] D2-05 `backend/app/tools/billing.py` — `write_down_entry()` reason required
- [x] D2-06 `backend/app/tools/billing.py` — `write_off_entry()` reason required
- [x] D2-07 `backend/app/tools/billing.py` — `compute_budget_utilization()` read-only
- [x] D2-08 `backend/app/tools/billing.py` — `generate_invoice()`

### Deadline tools
- [x] D2-09 `backend/app/tools/deadlines.py` — `log_deadline_event()` append-only
- [x] D2-10 `backend/app/tools/deadlines.py` — `verify_deadline()`
- [x] D2-11 `backend/app/tools/deadlines.py` — `supersede_deadline()`

### Client comms tools
- [x] D2-12 `backend/app/tools/comms.py` — `approve_client_comm_draft()` (does NOT update last_client_contact)
- [x] D2-13 `backend/app/tools/comms.py` — `queue_client_comm_for_delivery()`
- [x] D2-14 `backend/app/tools/comms.py` — `log_client_comm_sent()` (ONLY this updates last_client_contact)

### Alert and escalation tools
- [x] D2-15 `backend/app/tools/alerts.py` — `dismiss_alert()` reason required
- [x] D2-16 `backend/app/tools/alerts.py` — `log_escalation()`, `log_anomaly()`

### Pre-bill scrubber
- [x] D2-17 `backend/app/scrubber/prebill.py` — all 8 checks (forbidden phrase, block billing, missing codes, round hours, excessive hours, narrative absent, AI disclosure)

### MCP server (Track 1 compliance)
- [x] D2-18 `backend/app/mcp_server/server.py` — FastMCP SSE server at `/mcp`, 16 tools registered
- [x] D2-19 Mount MCP server in `main.py` at `/mcp`

### Tests
- [x] D2-20 `backend/tests/test_state_machine.py` — 23 tests pass
- [x] D2-21 `backend/tests/test_scrubber.py` — 28 tests pass (te-005 + te-001 demo conditions verified)
- [x] D2-22 `backend/tests/test_idempotency.py` — 13 tests pass

**Day 2 checkpoint: 64/64 tests pass. MCP server mounted. ✓**

---

## Day 3 — Brief Assembler + Fixtures + ADK Coordinator ✓ COMPLETE
*Goal: GET /api/brief returns all 5 sections. POST /api/sweep invokes coordinator.*

### Ingestion fixtures
- [x] D3-01 `backend/app/ingestion/demo_fixtures.py` — Gmail and Calendar fixture data
- [x] D3-02 `backend/app/ingestion/gmail_adapter.py` — DemoFixtureGmailSource + stub
- [x] D3-03 `backend/app/ingestion/calendar_adapter.py` — DemoFixtureCalendarSource + stub

### Brief assembler
- [x] D3-04 `backend/app/brief/schemas.py` — BriefResponse, all section types
- [x] D3-05 `backend/app/brief/assembler.py` — all 5 sections from Firestore state

### Brief API route
- [x] D3-06 `backend/app/routes/brief.py` — `GET /api/brief`

### ADK coordinator
- [x] D3-07 `backend/app/agents/coordinator.py` — SIGNAL_ROUTING dict, classify_signal(), execute_sweep()
- [x] D3-08 `backend/app/agents/billing_agent.py` — scans PENDING entries, logs anomalies via log_anomaly()
- [x] D3-09 `backend/app/agents/deadline_agent.py` — escalation cadence, log_deadline_event() + log_escalation()

### Sweep API route
- [x] D3-10 `backend/app/routes/brief.py` — `POST /api/sweep`

### TypeScript types and API client
- [x] D3-11 `dashboard/src/types.ts` — mirrors all Pydantic models
- [x] D3-12 `dashboard/src/api.ts` — all API calls

### Tests
- [x] D3-13 `backend/tests/test_brief_assembly.py` — 25 tests (all 5 sections + 5 demo conditions)
- [x] D3-14 `backend/tests/test_deduplication.py` — 14 tests (hash, fixtures, adapters)

**Day 3 checkpoint: GET /api/brief returns all 5 sections with seed data. dl-mercer-001 in deadlines, te-005 with scrubber warning. ✓**

---

## Day 4 — Remaining Agents + Full API Routes + Demo Reset ✓ COMPLETE
*Goal: GET /api/demo/ready all passing. All action endpoints work.*

### Agents
- [x] D4-01 `backend/app/agents/comms_agent.py` — FactPacket → Gemini → citation validation
- [x] D4-02 `backend/app/agents/anomaly_agent.py` — all detectors, scoring overrides

### Action routes
- [x] D4-03 `backend/app/routes/actions.py` — all deadline action endpoints
- [x] D4-04 `backend/app/routes/actions.py` — all billing action endpoints (+ LEDES stub)
- [x] D4-05 `backend/app/routes/actions.py` — all comms action endpoints
- [x] D4-06 `backend/app/routes/actions.py` — alert dismiss endpoint

### Demo routes (full)
- [x] D4-07 `backend/app/routes/demo.py` — `GET /api/demo/ready` full implementation
- [x] D4-08 `backend/app/routes/demo.py` — `POST /api/demo/reset` full (delete + re-seed via app/demo/seeder.py)
- [x] D4-09 `backend/app/routes/demo.py` — `GET /api/demo/state`

### Tests
- [x] D4-10 `backend/tests/test_brief_assembly.py` — complete all 5 sections (25 tests, passing from Day 3)
- [x] D4-11 `backend/tests/test_anomaly_scoring.py` — override rules (29 tests)
- [x] D4-12 `backend/tests/test_prompt_injection.py` (18 tests)
- [x] D4-13 `backend/tests/test_demo_readiness.py` — all 5 conditions + reset (26 tests)

### Tool layer additions (required by Day 4 routes)
- [x] `backend/app/tools/deadlines.py` — confirm_deadline(), resolve_deadline(), dismiss_deadline()
- [x] `backend/app/tools/billing.py` — update_entry_narrative()
- [x] `backend/app/tools/comms.py` — create_client_comm(), dismiss_comm()
- [x] `backend/app/demo/seeder.py` — inline seed data for reset endpoint (container-safe)

**Day 4 checkpoint: 173/173 tests pass. GET /api/demo/ready wired to all 5 live checks. POST /api/demo/reset deletes + re-seeds. ✓**

---

## Day 5 — React Dashboard ✓ COMPLETE
*Goal: Full demo path clickable in browser.*

### Foundation
- [x] D5-01 `App.tsx` — React Router, 2 routes (/ and /email-preview)
- [x] D5-02 `components/DemoBanner.tsx` — sticky amber banner, demo mode only
- [x] D5-03 `dashboard/src/api.ts` — all action endpoints (comms, narrative, billing, deadline)

### Main page
- [x] D5-04 `components/DailyCloseoutBrief.tsx` — all 5 section cards, resolved collapse tray

### Modals
- [x] D5-05 `components/modals/DeadlineModal.tsx` — Confirm/Extend/Dismiss with reason
- [x] D5-06 `components/modals/BillingWIPModal.tsx` — Approve/Write-down/Write-off + scrubber warnings
- [x] D5-07 `components/modals/ClientCommsModal.tsx` — approve/queue/dismiss, state machine flow
- [x] D5-08 `components/modals/BudgetModal.tsx` — progress bar, utilization breakdown
- [x] D5-09 `components/modals/AnomalyModal.tsx` — severity badge, 4-field narrative, dismiss

### Shared components
- [x] D5-10 `components/shared/AuditEventDrawer.tsx` — slides in after successful action, 6s auto-dismiss
- [x] D5-11 `components/DemoResetButton.tsx` — visible in demo mode, confirm dialog
- [x] `dashboard/src/types.ts` — BillingUpdateNarrativeRequest, CommsApproveRequest, CommsDismissRequest added

### Additional pages
- [x] D5-12 `/email-preview` route — plain monospace brief in email format

### Deploy
- [ ] D5-13 Build and redeploy dashboard to Cloud Run (holding — after agent visibility build)

### Design system (completed Day 5 polish, committed)
- [x] D5-DS-01 `dashboard/src/index.css` — full Litt design token system (CSS vars, color ramps, dark mode)
- [x] D5-DS-02 All 10 dashboard components rewritten — inline CSS vars, badge ramp system, 0.5px borders, no shadows
- [x] D5-DS-03 `backend/app/db.py` lazy import fix — defers `google.cloud.firestore` until first call
- [x] D5-DS-04 `backend/app/brief/schemas.py` + `assembler.py` — `version` field on deadline and time entry items

### Notes
- Ghost socket on port 8000 (Windows kernel leak from earlier session); backend temporarily on 8001
  Vite proxy updated to match. Clears on reboot. Cloud Run unaffected.
- Design system rewrite committed as `ff51e5f`

**Day 5 checkpoint: Brief loads with 2 deadlines, 4 WIP entries, 1 silence trigger. All modals open and submit. Audit drawer fires on success. Design system applied. ✓**

---

## Day 6 — Agent Visibility Build + Deploy + Record + Submit
*Goal: Timeline visible. Video recorded. Submitted by 4:30 PM PT.*

### Phase 1 — Observability models (30 min)
- [ ] D6-VIS-01 `backend/app/observability.py` — `ObservationType`, `CommitmentLevel`, `AgentObservation`, `AgentRunTimeline`
  - `AgentObservation`: observation_id, timestamp, agent_name, observation_type, commitment_level,
    description, data, confidence, evidence, run_id, work_kind, model_name, attorney_next_action
  - `AgentRunTimeline`: run_id, firm_id, triggered_by, started_at, completed_at,
    elapsed_seconds (float field), observations, brief_items_count, escalations_count
  - `generate_observation_id(agent_name, counter)` using `get_effective_datetime()`
- [ ] D6-VIS-02 `backend/app/brief/schemas.py` — add `SweepRunResponse` = `{timeline: AgentRunTimeline, brief: BriefResponse}`
- [ ] D6-VIS-03 `backend/tests/test_observability_models.py` — models instantiate, enums correct, ID generator works

**Checkpoint: `python -m pytest backend/tests/test_observability_models.py -v` passes**

### Phase 2 — Route update (30 min)
- [ ] D6-VIS-04 `backend/app/routes/brief.py` — `POST /api/sweep` returns `SweepRunResponse`
  - Calls `coordinator.execute_sweep()` which now returns `SweepRunResponse`
  - Frontend gets timeline + brief in one call
- [ ] D6-VIS-05 `backend/app/routes/timeline.py` — `GET /api/sweep/{run_id}` retrieves past timeline from Firestore
- [ ] D6-VIS-06 `dashboard/src/types.ts` — add `AgentObservation`, `AgentRunTimeline`, `SweepRunResponse`
- [ ] D6-VIS-07 `dashboard/src/api.ts` — update `runSweep()` return type to `SweepRunResponse`

**Checkpoint: `POST /api/sweep` returns 200 with `observations` array (may be empty at this stage)**

### Phase 3 — Coordinator instrumentation (1 hour)
- [ ] D6-VIS-08 `backend/app/agents/coordinator.py` — `Coordinator` collects observations from all sub-agents
  - `execute_sweep()` now returns `SweepRunResponse` (not `SweepResponse`)
  - Coordinator emits 5 top-level observations: signal_received, routing_decision ×4, brief assembly summary
  - Sub-agents return `{"result": ..., "observations": List[AgentObservation]}` (not written to Firestore)
  - Coordinator writes completed `agent_run` doc to Firestore after all sub-agents finish
    (deliberate exception: telemetry, not a business entity — document with comment)
- [ ] D6-VIS-09 `backend/app/tools/audit.py` — extend `log_audit_event()` to accept optional
  `observation_id`, `commitment_level`, `evidence`, `work_kind` fields on `AuditLogEntry`

**Checkpoint: Coordinator returns >5 observations on sweep**

### Phase 4 — Sub-agent instrumentation (1 hour)
- [ ] D6-VIS-10 `backend/app/agents/deadline_agent.py` — emit 5 observations per run
  - `signal_received`: signals inspected
  - `reasoning`: deterministic date check on Mercer deadline (dl-mercer-001)
  - `escalation`: HARD_LEGAL unconfirmed → gate ESCALATION
  - `reasoning`: Gemini-assisted extraction on Rivera email (confidence 0.7, work_kind=llm_assisted)
  - `escalation`: conflicting source → gate ESCALATION, attorney_next_action set
- [ ] D6-VIS-11 `backend/app/agents/billing_agent.py` — emit 5 observations per run
  - `signal_received`: pending entries + calendar events
  - `tool_call`: scrubber check on te-005 (forbidden phrase, deterministic)
  - `result`: REVIEW_REQUIRED, attorney_next_action = "Edit narrative before approval"
  - `reasoning`: calendar reconciliation → Okafor 42-min call, no entry (work_kind=deterministic)
  - `result`: billing gap → suggested entry, gate REVIEW_REQUIRED
- [ ] D6-VIS-12 `backend/app/agents/comms_agent.py` — emit 4 observations per run
  - `signal_received`: silence check
  - `reasoning`: Whitmore 16 days since contact (deterministic threshold check)
  - `result`: draft generated, work_kind=llm_assisted, gate REVIEW_REQUIRED
  - `approval_gate_applied`: gate BLOCKED — cannot send without attorney approval
- [ ] D6-VIS-13 `backend/app/agents/anomaly_agent.py` — emit 3 observations per run
  - `tool_call`: anomaly scoring on te-001 (missing narrative, reconstruction risk)
  - `escalation`: ESCALATION gate, attorney_next_action set
  - `result`: Acme budget 78% → gate REVIEW_REQUIRED (deterministic)
- [ ] D6-VIS-14 `backend/tests/test_agent_observations.py` — each sub-agent returns expected observation types

**Checkpoint: `POST /api/sweep` returns 20+ observations with all 4 gate types**

### Phase 5 — Fixture extension (45 min)
- [ ] D6-VIS-15 `backend/app/ingestion/demo_fixtures.py` — add Rivera and Okafor supplemental fixtures
  - `email-rivera-001`: opposing counsel "tomorrow (Friday)" deadline, conflict_flag=True, confidence=0.7
  - `cal-okafor-call`: 42-min client call with no corresponding time entry
  - Rivera matter: `rivera-v-northline` (supplemental, not a v1.0 readiness anchor)
  - Okafor matter: `okafor-contract-review` (supplemental)
  - All use `dana-strand` or omit attorney_id — do not introduce `attorney_001`
- [ ] D6-VIS-16 `backend/app/demo/seeder.py` — seed new supplemental matters on reset
  - Preserve existing v1.0 anchors: `dl-mercer-001`, `te-005`, `te-001`, `acme-commercial`, `whitmore-employment-2026`
  - `GET /api/demo/ready` must still pass all 5 checks after reset

**Checkpoint: `POST /api/demo/reset` + `POST /api/sweep` produces deterministic timeline with Rivera escalation and Okafor billing gap**

### Phase 6 — React timeline component (1.5 hours)
- [ ] D6-VIS-17 `dashboard/src/components/AgentRunTimeline.tsx` — full TypeScript component
  - Props: `observations: AgentObservation[]`, `elapsedSeconds: number`, `isComplete: boolean`
  - Progressive playback: 250ms between observations (not streaming — drip-feeds pre-loaded array)
  - Gate badge colors: teal (AUTO_SAFE), blue (REVIEW_REQUIRED), amber (ESCALATION), red (BLOCKED)
  - `work_kind` chips: "det" (deterministic), "gemini", "tool write", "human gate"
  - `attorney_next_action` line for ESCALATION and BLOCKED observations
  - Empty state: "Run Closeout to begin" placeholder
  - Completion state: "Completed in Xs — N observations, M escalations"
- [ ] D6-VIS-18 `dashboard/src/components/AgentRunTimeline.css` — animation-only CSS
  - Fade-in keyframe for each timeline row
  - Stagger via `animation-delay`
  - No color values — all colors via CSS vars from `index.css`
- [ ] D6-VIS-19 `dashboard/src/components/DailyCloseoutBrief.tsx` — integrate timeline
  - Add "Run Closeout" button in page header
  - Show `AgentRunTimeline` above section cards after sweep fires
  - `runSweep()` call populates both timeline observations and refreshes brief

**Checkpoint: Timeline renders and auto-scrolls in browser after clicking "Run Closeout"**

### Phase 7 — Demo script + final wiring (30 min)
- [ ] D6-VIS-20 `docs/HACKATHON-DEMO-SCRIPT.md` — 90-second narration with timing marks
  - 0:00–0:08 intro, 0:08–0:12 click, 0:12–0:48 timeline auto-scroll, 0:48–1:05 brief,
    1:05–1:35 safety model, 1:35–1:55 attorney outcome, 1:55–2:00 final frame
- [ ] D6-VIS-21 `docs/architecture.png` — architecture diagram (shows coordinator, 4 sub-agents, MCP toolset, Firestore, Gemini)
- [ ] D6-VIS-22 `dashboard/src/pages/EmailPreview.tsx` — verify still renders correctly after timeline integration

---

### Deploy + Hardening (after visibility build)
- [ ] D6-01 Final Cloud Run deployment — both services, all env vars confirmed
  - Backend: `GEMINI_MODEL=gemini-2.5-pro`, `VERTEX_AI_LOCATION=us-central1`, `LITT_DEMO_MODE=true`
  - Dashboard: env vars set, Vite build with correct proxy
- [ ] D6-02 CORS: change `CORS_ORIGINS` from `*` to deployed Cloud Run dashboard URL
- [ ] D6-03 `GET /api/demo/ready` passes all 5 on deployed URL
- [ ] D6-04 `POST /api/demo/reset` works on deployed URL
- [ ] D6-05 `POST /api/sweep` returns 20+ observations on deployed URL

### Devpost description
- [ ] D6-06 Business case section written
- [ ] D6-07 Technical section (ADK coordinator + 4 sub-agents + MCP toolset + state machine + audit log + observation timeline)
- [ ] D6-08 Findings and learnings (deterministic/probabilistic boundary, gate design, audit trail)
- [ ] D6-09 Third-party disclosures (Gemini 2.5 Pro via Vertex AI, Google ADK, Firestore, Cloud Run)
- [ ] D6-10 Agent Engine migration path noted
- [ ] D6-11 Architecture diagram embedded

### Demo recording
- [ ] D6-12 `POST /api/demo/reset` + `GET /api/demo/ready` confirms all 5 before each take
- [ ] D6-13 Demo rehearsal ×3 against deployed URL — all under 2 minutes
- [ ] D6-14 Fix demo-breaking bugs only (no new features after this point)
- [ ] D6-15 Record final 2-minute demo video against live deployed URL
- [ ] D6-16 Export MP4, verify audio, upload to YouTube unlisted or Vimeo

### Submit
- [ ] D6-17 Devpost submission: repo URL, video URL, description, Cloud Run URL, Track 1
- [ ] D6-18 Screenshot submission confirmation
- [ ] **D6-19 SUBMITTED BY 4:30 PM PT**

---

## Summary Counts

| Day | Tasks | Critical path |
|-----|-------|---------------|
| 1 | 20 | Cloud Run URL live |
| 2 | 22 | State machine tests pass |
| 3 | 14 | Brief assembles from live Firestore |
| 4 | 13 | demo/ready all passing |
| 5 | 17 | Full demo path in browser + design system |
| 6 | 41 | Agent visibility + deploy + video + submitted |
| **Total** | **127** | |
