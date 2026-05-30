# Litt — Sprint Task List

**Sprint:** May 30 – June 5, 2026  
**Status key:** `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Day 1 — Foundation + Skeleton Deploy
*Goal: Live Cloud Run URL. Firestore seeded. Backend reads it.*

### Infra
- [ ] D1-01 GCP project created, all APIs enabled, billing set up, $500 credit claimed
- [ ] D1-02 GitHub repo `github.com/emtcmca/litt` created, public, initial commit
- [ ] D1-03 Service account created, roles assigned, JSON key in Secret Manager
- [ ] D1-04 `.env` created from `.env.example`, demo mode vars set

### Backend scaffold
- [ ] D1-05 `backend/requirements.txt` with all dependencies
- [ ] D1-06 `backend/app/config.py` — demo clock (`get_effective_date`, `get_effective_datetime`)
- [ ] D1-07 `backend/app/models.py` — all Pydantic models per data-contract.md
- [ ] D1-08 `backend/app/db.py` — Firestore client
- [ ] D1-09 `backend/app/main.py` — FastAPI skeleton, `GET /health`, CORS
- [ ] D1-10 `Dockerfile.backend`

### Firestore
- [ ] D1-11 Firestore security rules deployed (audit_log CREATE-only, deadline_events CREATE-only, time_entries no DELETE)

### Seed data
- [ ] D1-12 `scripts/seed_demo.py` — full Strand & Okafor seed, idempotent
- [ ] D1-13 Run seed script, verify all collections in Firestore console

### Dashboard scaffold
- [ ] D1-14 `dashboard/` — Vite + React + TypeScript + Tailwind
- [ ] D1-15 `Dockerfile.dashboard`
- [ ] D1-16 Placeholder homepage showing firm name from `/health`

### Cloud Run deployment
- [ ] D1-17 Deploy `litt-backend` Cloud Run service — live URL working
- [ ] D1-18 Deploy `litt-dashboard` Cloud Run service — live URL working

### Demo skeleton endpoints
- [ ] D1-19 `GET /api/demo/ready` skeleton — returns JSON structure, all checks false
- [ ] D1-20 `POST /api/demo/reset` skeleton — returns not-yet-implemented

**Day 1 checkpoint: `curl {backend-url}/health` returns ok. Dashboard loads. Firestore seeded.**

---

## Day 2 — Tool Layer + MCP Server
*Goal: State machine tests pass. Scrubber flags te-005. MCP server starts.*

### Audit tool (first)
- [ ] D2-01 `backend/app/tools/audit.py` — `log_audit_event()` writes to Firestore

### Shared validation
- [ ] D2-02 `backend/app/tools/validation.py` — idempotency check, optimistic lock check

### Billing tools
- [ ] D2-03 `backend/app/tools/billing.py` — `advance_entry_status()` with `VALID_TRANSITIONS`
- [ ] D2-04 `backend/app/tools/billing.py` — `write_time_entry()` with 6-min rounding
- [ ] D2-05 `backend/app/tools/billing.py` — `write_down_entry()` reason required
- [ ] D2-06 `backend/app/tools/billing.py` — `write_off_entry()` reason required
- [ ] D2-07 `backend/app/tools/billing.py` — `compute_budget_utilization()` read-only
- [ ] D2-08 `backend/app/tools/billing.py` — `generate_invoice()`

### Deadline tools
- [ ] D2-09 `backend/app/tools/deadlines.py` — `log_deadline_event()` append-only
- [ ] D2-10 `backend/app/tools/deadlines.py` — `verify_deadline()`
- [ ] D2-11 `backend/app/tools/deadlines.py` — `supersede_deadline()`

### Client comms tools
- [ ] D2-12 `backend/app/tools/comms.py` — `approve_client_comm_draft()` (does NOT update last_client_contact)
- [ ] D2-13 `backend/app/tools/comms.py` — `queue_client_comm_for_delivery()`
- [ ] D2-14 `backend/app/tools/comms.py` — `log_client_comm_sent()` (ONLY this updates last_client_contact)

### System tools
- [ ] D2-15 `backend/app/tools/system.py` — `dismiss_alert()` reason required
- [ ] D2-16 `backend/app/tools/system.py` — `log_escalation()`, `log_anomaly()`

### Pre-bill scrubber
- [ ] D2-17 `backend/app/scrubber/prebill.py` — all 8 checks (forbidden phrase, block billing, missing codes, round hours, rate deviation, max daily hours, narrative absent)

### MCP server (Track 1 compliance)
- [ ] D2-18 `backend/app/mcp_server/server.py` — FastMCP SSE server at `/mcp`
- [ ] D2-19 Mount MCP server in `main.py` at `/mcp`

### Tests
- [ ] D2-20 `backend/tests/test_state_machine.py` — all transition tests pass
- [ ] D2-21 `backend/tests/test_scrubber.py` — te-005 flagged, false positives clean
- [ ] D2-22 `backend/tests/test_idempotency.py` — idempotency tests pass

**Day 2 checkpoint: pytest test_state_machine.py + test_scrubber.py all pass. MCP server responds.**

---

## Day 3 — Brief Assembler + Fixtures + ADK Coordinator
*Goal: GET /api/brief returns all 5 sections. POST /api/sweep invokes coordinator.*

### Ingestion fixtures
- [ ] D3-01 `backend/app/ingestion/demo_fixtures.py` — Gmail and Calendar fixture data
- [ ] D3-02 `backend/app/ingestion/gmail_adapter.py` — DemoFixtureGmailSource + stub
- [ ] D3-03 `backend/app/ingestion/calendar_adapter.py` — DemoFixtureCalendarSource + stub

### Brief assembler
- [ ] D3-04 `backend/app/brief/schemas.py` — BriefResponse, all section types
- [ ] D3-05 `backend/app/brief/assembler.py` — all 5 sections from Firestore state

### Brief API route
- [ ] D3-06 `backend/app/routes/brief.py` — `GET /api/brief`

### ADK coordinator
- [ ] D3-07 `backend/app/agents/coordinator.py` — MCPToolset connection, deterministic routing dict, `execute_sweep()`
- [ ] D3-08 `backend/app/agents/billing_agent.py` — thin sub-agent, returns billing section
- [ ] D3-09 `backend/app/agents/deadline_agent.py` — thin sub-agent, date math, escalation cadence, calls `log_deadline_event()` via MCP

### Sweep API route
- [ ] D3-10 `backend/app/routes/brief.py` — `POST /api/sweep`

### TypeScript types and API client
- [ ] D3-11 `dashboard/src/types.ts` — mirrors all Pydantic models
- [ ] D3-12 `dashboard/src/api.ts` — all API calls

### Tests
- [ ] D3-13 `backend/tests/test_brief_assembly.py` — partial (deadlines + billing sections)
- [ ] D3-14 `backend/tests/test_deduplication.py`

**Day 3 checkpoint: GET /api/brief returns all 5 sections with seed data. dl-mercer-001 in deadlines, te-005 with scrubber warning.**

---

## Day 4 — Remaining Agents + Full API Routes + Demo Reset
*Goal: GET /api/demo/ready all passing. All action endpoints work.*

### Agents
- [ ] D4-01 `backend/app/agents/comms_agent.py` — FactPacket → Gemini → citation validation
- [ ] D4-02 `backend/app/agents/anomaly_agent.py` — all detectors, scoring overrides

### Action routes
- [ ] D4-03 `backend/app/routes/actions.py` — all deadline action endpoints
- [ ] D4-04 `backend/app/routes/actions.py` — all billing action endpoints (+ LEDES stub)
- [ ] D4-05 `backend/app/routes/actions.py` — all comms action endpoints
- [ ] D4-06 `backend/app/routes/actions.py` — alert dismiss endpoint

### Demo routes (full)
- [ ] D4-07 `backend/app/routes/demo.py` — `GET /api/demo/ready` full implementation
- [ ] D4-08 `backend/app/routes/demo.py` — `POST /api/demo/reset` full (delete + re-seed)
- [ ] D4-09 `backend/app/routes/demo.py` — `GET /api/demo/state`

### Tests
- [ ] D4-10 `backend/tests/test_brief_assembly.py` — complete all 5 sections
- [ ] D4-11 `backend/tests/test_anomaly_scoring.py` — override rules
- [ ] D4-12 `backend/tests/test_prompt_injection.py`
- [ ] D4-13 `backend/tests/test_demo_readiness.py` — all 5 conditions + reset

**Day 4 checkpoint: GET /api/demo/ready → ok: true. POST /api/demo/reset restores all conditions. All pytest tests pass.**

---

## Day 5 — React Dashboard
*Goal: Full demo path clickable in browser.*

### Foundation
- [ ] D5-01 `App.tsx` — React Router, all 8 routes
- [ ] D5-02 Demo mode banner
- [ ] D5-03 `dashboard/src/api.ts` — complete with all action endpoints

### Main page
- [ ] D5-04 `components/DailyCloseoutBrief.tsx` — all 5 sections, resolved collapse

### Modals
- [ ] D5-05 `components/modals/DeadlineModal.tsx` — Confirm/Extend/Dismiss with reason
- [ ] D5-06 `components/modals/BillingWIPModal.tsx` — Approve/Write-down/Write-off + scrubber warnings
- [ ] D5-07 `components/modals/ClientCommsModal.tsx` — source attribution, full state machine flow
- [ ] D5-08 `components/modals/BudgetModal.tsx` — progress bar, draft alert button
- [ ] D5-09 `components/modals/AnomalyModal.tsx` — severity badge, dismiss

### Shared components
- [ ] D5-10 `components/shared/AuditEventDrawer.tsx` — slides in after successful action
- [ ] D5-11 `components/DemoResetButton.tsx` — visible in demo mode only

### Additional pages
- [ ] D5-12 `/email-preview` route — plain HTML brief in email format

### Deploy
- [ ] D5-13 Build and redeploy dashboard to Cloud Run

**Day 5 checkpoint: Full demo path works in browser on deployed URL. Every action shows audit drawer.**

---

## Day 6 — Hardening + Demo Recording + Submit
*Goal: Video recorded. Submitted by 4:30 PM PT.*

### Morning
- [ ] D6-01 Final Cloud Run deployment — both services, all env vars confirmed
- [ ] D6-02 CORS verified on deployed URL
- [ ] D6-03 `GET /api/demo/ready` passes all 5 on deployed URL
- [ ] D6-04 `POST /api/demo/reset` works on deployed URL
- [ ] D6-05 `docs/architecture.png` — architecture diagram (shows MCP connection)

### Devpost description
- [ ] D6-06 Business case section written
- [ ] D6-07 Technical section written (ADK + MCP + state machine + audit log)
- [ ] D6-08 Findings and learnings written
- [ ] D6-09 Third-party disclosures listed
- [ ] D6-10 Agent Engine migration path noted
- [ ] D6-11 Architecture diagram embedded

### Demo
- [ ] D6-12 Demo rehearsal ×3 against deployed URL — all under 2 minutes
- [ ] D6-13 Fix any demo-breaking bugs only
- [ ] D6-14 `POST /api/demo/reset` + `GET /api/demo/ready` confirms all 5 before recording
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
| 5 | 13 | Full demo path in browser |
| 6 | 19 | Submitted by 4:30 PM PT |
| **Total** | **101** | |
