# Litt — Active Build Plan v1.1.1 (Agent Respec & Scope Enhancement)

**Sprint:** Post-hackathon — starts when v1.0 submission complete  
**Full spec:** `docs/agent-respec-build-plan-v1.1.1.md` (authoritative — all gate definitions live there)  
**Total completion gates:** 75 across 7 phases  
**Status:** Planning complete — ready for implementation

---

## What This Sprint Builds

Five agents expanded in scope, Gemini added where it earns it, coordinator parallelized with compound escalation detection, frontend updated with Gemini attribution, WARN notices, inbox triage section, and inline narrative replacement.

Core pattern unchanged: **Detection → Python. Assessment → Gemini. Decision → Attorney.**

---

## Non-Negotiables (Carried Forward from v1.0)

- Agents never write Firestore directly — all writes through tool layer
- Every Firestore write calls `log_audit_event()`
- `audit_log` and `deadline_events` are CREATE-only
- Gemini never used for state transitions, routing decisions, or arithmetic
- Attorney approval gates remain on all billing, deadline, comms, and dismissal actions
- `config.get_effective_date()` everywhere — no `date.today()` or `datetime.now()`

---

## Design Decisions (Locked)

| Decision | Resolution |
|---|---|
| CommsAgent voice | Professional/competent/personable partner attorney tone. v1.2: Gemini analyzes sent-mail folder for attorney voice fine-tuning. |
| Inbox triage | Full scope in v1.1.1, fixture-based. Live Gmail OAuth in v1.2. |
| WARN flags | Brief-visible soft notice. No approval gate. Recommendation only. |
| Compound escalations | One compound escalation per matter when ≥2 agents fire signals. Individual items remain alongside. |
| Multi-trigger drafts | Separate draft per trigger type. Consolidation deferred to v1.2 (requires message-type classification taxonomy first). |
| Gemini attribution | Small Gemini label/logo on every AI-enriched item. Always visible, not tooltip. |
| Narrative replacement | Inline in brief with one-click Apply. Routes through `update_entry_narrative()`. |
| Synthesis placement | Synthesis card alongside individual anomaly items, not instead of them. Synthesis leads the matter section. |

---

## Phase Summary

| Phase | Agent / Layer | Key Changes | Gates |
|---|---|---|---|
| 0 | Data Model & Foundation | New enums, `IncomingEmail` model, attorney style profile, `log_anomaly()` signature extension, new tool functions, seed fixtures | G0-01 → G0-06 |
| 1 | AnomalyAgent | 5 new Python detectors, priority sorting, 5 Gemini integration functions, enriched anomaly logging | G1-01 → G1-14 |
| 2 | BillingAgent | Expand to APPROVED entries, WARN surfacing, budget signal emission, Gemini narrative suggestions, invoice readiness check | G2-01 → G2-08 |
| 3 | DeadlineAgent | Readiness monitoring, extension request drafting, 21/30-day soft watch, conflict_flagged advancement, gap detection, clustering | G3-01 → G3-10 |
| 4 | CommsAgent | Multi-trigger outbound (6 new triggers), attorney style profile, multi-tone drafting, citation stripping, inbound triage pass, email classification, response drafting | G4-01 → G4-15 |
| 5 | Coordinator | Parallel execution, cross-agent correlation, compound escalation production, budget signal passthrough, matter grouping, timeout handling | G5-01 → G5-08 |
| 6 | Frontend | GeminiLabel component, WarnNotice component, inline narrative replacement, CompoundEscalationCard, Inbox brief section, matter synthesis card, TypeScript type sync | G6-01 → G6-14 |

---

## Build Order

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
```

Phases 1–4 may partially overlap once Phase 0 is gate-checked. Phase 5 requires 1–4 complete. Phase 6 requires 5 complete.

**Phase 5 exception:** CommsAgent (Phase 4) depends on BillingAgent's budget signal output. Coordinator execution restructured as two rounds: Round 1 (Billing + Deadline + Anomaly in parallel) → Round 2 (Comms with budget signals from Round 1).

---

## v1.1.1 Reconciliations (vs. original spec — applied 2026-06-06)

After reviewing `docs/ui-ux-design-handoff/`, seven reconciliations applied to the v1.1.1 spec:

1. `IncomingEmail` model → `InboundMessage`; collection `incoming_emails` → `inbound_messages`
2. `IncomingEmailClassification` enum removed — replaced by deterministic `InboundUrgency` scoring rubric
3. `IncomingEmailTriageStatus` → `InboundStatus` (SNOOZED added, REPLY_HELD replaces RESPONSE_DRAFTED)
4. `UNANSWERED_CLIENT_EMAIL` / `CLIENT_QUESTION_DETECTED` removed from CommTrigger; `INBOUND_REPLY` added
5. 4 `comms.py` tool additions → 3 functions in new `tools/inbound.py` [NEW]
6. Added `ObservationType.ROUTE_HANDOFF`, `data.tool` sub-shape on TOOL_CALL, `tools/registry.py`, `GET /api/tools`, `GET /api/deadlines`, `GET /api/inbound`
7. Cross-agent routing section added to Phase 4 (deterministic Python hand-off rules, ROUTE_HANDOFF observations)

Gate count: 75 → 79.

---

## v1.1.2 — Console UI Overhaul

**Full spec:** `docs/console-ui-build-plan-v1.1.2.md`  
**Depends on:** v1.1.1 all gates pass

New Console shell + 10-page surface with Agent console graph. Nothing from v1.0/v1.1.1 is thrown away — reorganized and extended. Key deliverables:
- `ConsoleShell` + `ConsoleRail` (Watch/Collect/Prove/Tune four-section rail)
- Deadlines hero (full book, 45-day timeline, cadence ladder)
- Agent console graph (node graph, tool chips, inspector, hand-off edges, idle heartbeat, boundary stat)
- Relationships page (InboundCard + going-quiet; commitments deferred to v1.2)
- Collect, Budgets, Anomalies, Integrations, Audit Ledger upgrade, Policy stub

---

## v1.2 Deferred Items

Do not build in v1.1.1 or v1.1.2:

- **Commitment capture + lifecycle** — `Commitment` model, `commitment_extractor.py`, `tools/commitments.py`, CommitmentTracker UI (StageRail, Mark kept/Slipped, ledger flash), commitment → SOFT_INTERNAL deadline link
- **FirmPolicy + AttorneyPolicyOverride** — configurable trust dial, tighten-only enforcement, agents read effective posture for `commitment_level`, Policy page real UI
- Gmail OAuth live inbox integration (replaces fixture-based `source_emails`)
- Gemini sent-mail analysis for attorney voice fine-tuning
- Consolidated multi-trigger matter-status email (requires message-type classification taxonomy)
- Multi-firm UI
- Production authentication system
- Auto-send client communications (never)
- Auto-approve billing (never)
- Auto-verify legal deadlines (never)

---

---

# Litt — Locked Build Plan v1.0 ✓ COMPLETE

**Sprint:** May 30 – June 11, 2026  
**Submission deadline:** June 11, 5:00 PM EST  
**Target submit time:** June 11, 4:30 PM EST (30-minute buffer)  
**Track:** Track 1 — Build (Net-New Agents)

---

## Locked Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| MCP integration | Tool layer exposed as MCP server; ADK coordinator connects via MCP | Satisfies Track 1 requirement; clean architectural story |
| Gmail/Calendar | Fixtures only — `DemoFixtureGmailSource`, `DemoFixtureCalendarSource` | No OAuth complexity; adapter pattern demonstrates architecture |
| LEDES export | SHIPS STUBBED — endpoint exists, returns fixture LEDES text | Recovers 4–6 hours; not in 2-minute demo |
| GCP/GitHub | Starting from zero — Day 1 includes all infra setup | |
| Agent Engine | Cloud Run for v1.0; Agent Engine noted as v1.1 migration path in submission | |
| Session capture | Seeded demo data; `session_minutes_actual` populated in seed script | v1.1 is browser extension |

---

## Hackathon Compliance Checklist

| Rule | Status | Implementation |
|------|--------|----------------|
| Intelligence: Gemini API or Vertex AI | ✓ | Gemini 2.5 Pro via Vertex AI for all agent reasoning |
| Orchestration: ADK | ✓ | Google ADK — coordinator + 4 sub-agents |
| Infrastructure: Google Cloud | ✓ | Cloud Run for backend and dashboard |
| MCP integration | ✓ | Tool layer as MCP server; coordinator uses MCPToolset |
| New project (code after Apr 22) | ✓ | First commit today May 30 |
| Public GitHub repo | ✓ | `github.com/emtcmca/litt` |
| Live URL for judges | ✓ | Cloud Run URL, no login required, demo mode |
| 1-2 min video | ✓ | Target 1:55 |
| Architecture diagram | ✓ | `docs/architecture.png` — required for submission |
| Findings and learnings | ✓ | Section in Devpost description |
| Third-party disclosures | ✓ | Gmail API stub, Calendar API stub, Gemini API, Vertex AI |
| Agent Engine mention | ✓ | In submission: Cloud Run v1.0; Agent Engine v1.1 migration |

---

## Architecture Overview

```
INGESTION LAYER
  DemoFixtureGmailSource · DemoFixtureCalendarSource · Manual seed data
              ↓ structured signals
COORDINATOR AGENT (Gemini 2.5 Pro / ADK)
  Deterministic routing (Python dict, no LLM) → sub-agents
  Gemini: brief narrative synthesis only
              ↓ MCP tool calls
LITT MCP SERVER (FastMCP / SSE on /mcp)
  Wraps the deterministic tool layer
              ↓ validates + writes
DETERMINISTIC TOOL LAYER (Python)
  tools/audit.py · tools/billing.py · tools/deadlines.py
  tools/comms.py · tools/system.py · scrubber/prebill.py
              ↓
FIRESTORE
  firms/strand-okafor/{attorneys, clients, matters, time_entries,
  deadlines, deadline_events, client_communications, invoices,
  escalations, audit_log, ingestion_signals}
              ↓
ATTORNEY INTERFACE
  React Dashboard (Cloud Run) · Email Digest Preview (/email-preview)
  Daily Closeout Brief · Action Modals · Audit Event Drawer
```

### MCP Integration Design

The ADK coordinator connects to the Litt tool layer via MCP. This enforces the deterministic/probabilistic boundary at the protocol level — the LLM can only call MCP-exposed tool functions; it cannot write to Firestore directly.

```python
# backend/app/agents/coordinator.py
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, SseServerParams

mcp_toolset = MCPToolset(
    connection_params=SseServerParams(
        url=f"{settings.BACKEND_URL}/mcp"
    )
)

coordinator_agent = LlmAgent(
    model="gemini-2.5-pro",
    tools=[mcp_toolset],
    ...
)
```

```python
# backend/app/mcp_server/server.py
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("litt-tools")

@mcp.tool()
def advance_entry_status(entry_id: str, new_status: str, ...) -> dict:
    """Advance a time entry through the billing state machine."""
    return tools.billing.advance_entry_status(...)
    
# Mounted in main.py at /mcp via SSE transport
```

**Judge-facing story:** "Litt's coordinator is an ADK agent that uses MCP to interact with the deterministic tool layer. This separation is architectural, not incidental — the LLM reasons about what should happen; MCP tool calls are the only path to state mutation."

---

## Dependency Graph

```
Day 1: GCP + GitHub + Cloud Run skeleton + models + config + seed
    ↓
Day 2: Tool layer + MCP server + scrubber + tests
    ↓
Day 3: Brief assembler + ingestion fixtures + ADK coordinator + billing/deadline agents
    ↓
Day 4: Comms agent + anomaly agent + full API routes + demo reset/ready
    ↓
Day 5: React dashboard (all modals, deep links, audit drawer)
    ↓
Day 6: Cloud Run final deploy + architecture diagram + demo rehearsal + video + submit
```

No day can start until the previous day's acceptance criteria are met. Do not skip forward.

---

## Day 1 — Foundation + Skeleton Deploy

**Goal:** Live Cloud Run URL exists. Firestore has seed data. Backend reads it.  
**Hours:** 8–10

### Tasks

**Infra setup (must complete first)**
- [ ] Create GCP project `litt-prod`. Enable APIs: Firestore, Cloud Run, Cloud Scheduler, Secret Manager, Vertex AI, Gmail, Calendar, Cloud Logging, Cloud Trace.
- [ ] Claim $500 Google Cloud credit.
- [ ] Create GitHub repo `github.com/emtcmca/litt`. Public. Add `.gitignore` (Python, Node, `.env`). Initial commit.
- [ ] Create service account `litt-backend@litt-prod.iam.gserviceaccount.com` with roles: Firestore Admin, Cloud Run Invoker, Vertex AI User. Download JSON key → Secret Manager as `litt-service-account`.
- [ ] Create `.env` from `.env.example`. Set `LITT_DEMO_MODE=true`, `LITT_DEMO_DATE=2026-05-29`, `LITT_DEMO_FIRM_ID=strand-okafor`.

**Backend scaffold**
- [ ] `backend/requirements.txt` — fastapi, uvicorn, google-cloud-firestore, google-adk, google-cloud-aiplatform, mcp, pydantic, python-dotenv, pytest
- [ ] `backend/app/config.py` — `get_effective_date()` and `get_effective_datetime()`. Demo clock from `LITT_DEMO_DATE`. **No code in any other file may call `date.today()` or `datetime.now()` directly.**
- [ ] `backend/app/models.py` — full Pydantic models: `LittBaseModel` (enforces `firm_id`), all 11 collection schemas per `docs/data-contract.md`. This is the canonical source of truth — do not deviate from the data contract.
- [ ] `backend/app/db.py` — Firestore client initialization.
- [ ] `backend/app/main.py` — FastAPI app. Routes: `GET /health` → `{"status": "ok", "firm_id": "strand-okafor"}`. Mount router stubs. CORS configured.
- [ ] `Dockerfile.backend` — Python 3.11-slim, uvicorn, port 8000.

**Firestore**
- [ ] Deploy Firestore security rules per `docs/data-contract.md` Security Rules Summary: `audit_log` CREATE-only, `deadline_events` CREATE-only, `time_entries` no DELETE, `ingestion_signals` service account only.

**Seed data**
- [ ] `scripts/seed_demo.py` — idempotent. Seeds all Strand & Okafor data per `docs/data-contract.md` demo seed sections: 2 attorneys, 4 clients (with `billing_guidelines` and `engagement_terms`), 4 matters, 8 time entries (te-001 through te-008 with exact states), 2 deadlines (dl-mercer-001, dl-reyes-001), 1 client comms draft (comm-001 for Whitmore), budget positions, contact log. `firm_id=strand-okafor` on every document.
- [ ] Run seed script. Verify in Firestore console.

**Dashboard scaffold**
- [ ] `dashboard/` — Vite + React + TypeScript + Tailwind. `npm run dev` works on localhost:3000.
- [ ] `Dockerfile.dashboard` — Node build + nginx, port 80.
- [ ] Placeholder homepage: shows "Litt — Strand & Okafor LLP" loaded from backend `/health`. Demo mode banner.

**Cloud Run skeleton deployment**
- [ ] Deploy `litt-backend` Cloud Run service from `Dockerfile.backend`. Environment variables from Secret Manager.
- [ ] Deploy `litt-dashboard` Cloud Run service from `Dockerfile.dashboard`.
- [ ] Verify: `curl https://{backend-url}/health` returns `{"status": "ok"}`.
- [ ] Verify: Dashboard loads at Cloud Run URL.

**Demo endpoints (skeleton)**
- [ ] `GET /api/demo/ready` — returns structured JSON with 5 check keys, all `"pass": false` until tool layer exists.
- [ ] `POST /api/demo/reset` skeleton — accepts `{"firm_id": "strand-okafor", "confirm": true}`, returns `{"ok": false, "message": "not yet implemented"}`.

### Day 1 Acceptance Criteria

```
✓ curl https://{backend-url}/health → {"status": "ok", "firm_id": "strand-okafor"}
✓ Dashboard loads at Cloud Run URL, shows firm name
✓ Firestore has strand-okafor seed data (verify each collection manually in console)
✓ seed_demo.py is idempotent — run it twice, no duplicates
✓ GET /api/demo/ready returns JSON (not necessarily passing)
✓ All git commits are after April 22, 2026
```

**Blocker:** Do not start Day 2 without a working Cloud Run URL.

---

## Day 2 — Deterministic Tool Layer + MCP Server

**Goal:** State machine tests pass. Scrubber flags te-005. MCP server starts.  
**Hours:** 10–12

### Tasks

**Audit tool (must be first)**
- [ ] `backend/app/tools/audit.py` — `log_audit_event(firm_id, tier, event_type, actor, entity_type, entity_id, before_state, after_state, idempotency_key=None, notes=None)`. Writes to `firms/{firm_id}/audit_log/`. CREATE only. Returns `AuditEvent`. **This must exist before any other tool function.**

**Shared validation**
- [ ] `backend/app/tools/validation.py` — `check_idempotency(key, firm_id)` → returns cached `ToolResult` or `None`. `check_optimistic_lock(current, expected)` → returns `ToolError` or `None`. These are called at the top of every write function.

**Billing tools**
- [ ] `backend/app/tools/billing.py`:
  - `advance_entry_status(entry_id, new_status, reason, attorney_id, firm_id, idempotency_key=None, expected_status=None)` — enforces `VALID_TRANSITIONS` dict. Returns `ToolResult | ToolError`. Never raises. Calls `log_audit_event()` on both success and failure.
  - `write_time_entry(entry, firm_id, idempotency_key=None)` — 6-minute rounding (`math.ceil(minutes/60/0.1)*0.1`), duplicate detection, writes to Firestore.
  - `write_down_entry(entry_id, new_hours, new_amount, reason, attorney_id, firm_id, idempotency_key=None, expected_status=None)` — reason required, preserves original in `write_down_record`.
  - `write_off_entry(entry_id, reason, attorney_id, firm_id, idempotency_key=None, expected_status=None)` — reason required, terminal state.
  - `compute_budget_utilization(client_id, firm_id)` — read-only, sums APPROVED + BILLED entries, returns utilization object with `alert_status`.
  - `generate_invoice(client_id, period_start, period_end, attorney_id, firm_id, idempotency_key=None)` — queries APPROVED entries, groups by matter, handles retainer, writes invoice doc, transitions entries to BILLED.

**Deadline tools**
- [ ] `backend/app/tools/deadlines.py`:
  - `log_deadline_event(deadline_id, event_type, firm_id, attorney_id=None, escalation_level=None, response=None, notes=None)` — append-only write to `deadline_events`.
  - `verify_deadline(deadline_id, attorney_id, confirmed_date, classification, firm_id, idempotency_key=None)` — sets `verification_status=attorney_verified`.
  - `supersede_deadline(old_deadline_id, new_date, attorney_id, reason, firm_id, idempotency_key=None)` — creates new deadline, marks old as superseded.

**Client comms tools**
- [ ] `backend/app/tools/comms.py`:
  - `approve_client_comm_draft(draft_id, attorney_id, firm_id, idempotency_key=None, expected_status=None)` — sets `DRAFT_APPROVED`. Does NOT update `last_client_contact`.
  - `queue_client_comm_for_delivery(draft_id, channel, firm_id, idempotency_key=None, expected_status=None)` — sets `QUEUED_FOR_SEND`. Routes to `DemoDraftOutbox` in v1.0.
  - `log_client_comm_sent(draft_id, sent_at, firm_id, idempotency_key=None, expected_status=None)` — sets `SENT_CONFIRMED`. **This is the only function that updates `last_client_contact` on the matter.**

**System tools**
- [ ] `backend/app/tools/system.py`:
  - `dismiss_alert(alert_id, alert_type, reason, attorney_id, firm_id, idempotency_key=None)` — reason required (no silent dismissal). Sets appropriate status on entity.
  - `log_escalation(escalation, firm_id)` — writes escalation record.
  - `log_anomaly(anomaly, firm_id)` — writes anomaly record.

**Pre-bill scrubber**
- [ ] `backend/app/scrubber/prebill.py` — `run_scrubber(entry_id, firm_id)` → `List[ScrubberWarning]`. Checks (all deterministic Python, no LLM):
  1. `NARRATIVE_FORBIDDEN_PHRASE` — case-insensitive substring match against `client.billing_guidelines.forbidden_phrases`. Returns ALL matching phrases, not just first.
  2. `BLOCK_BILLING` — multiple matter references in one narrative.
  3. `MISSING_TASK_CODE` — when `billing_guidelines.required_task_codes=True` and `task_code` is null.
  4. `MISSING_ACTIVITY_CODE` — when `activity_codes_required=True` and `activity_code` is null.
  5. `ROUND_HOURS` — hours is whole number AND `session_minutes_actual` is null.
  6. `RATE_DEVIATION` — rate differs from attorney default or client override by >10%.
  7. `MAX_DAILY_HOURS` — sum of same-day entries for attorney+client exceeds `max_daily_hours_without_review`.
  8. `NARRATIVE_ABSENT` — narrative is null or len < 10 chars.

**MCP server**
- [ ] `backend/app/mcp_server/__init__.py`
- [ ] `backend/app/mcp_server/server.py` — FastMCP SSE server mounted at `/mcp`. Exposes the following as MCP tools: `advance_entry_status`, `log_deadline_event`, `verify_deadline`, `approve_client_comm_draft`, `queue_client_comm_for_delivery`, `log_client_comm_sent`, `dismiss_alert`, `compute_budget_utilization`. Each MCP tool wraps the corresponding Python tool function with proper type hints and docstrings.
- [ ] Mount MCP SSE handler in `main.py` at `/mcp` route.

**Tests**
- [ ] `backend/tests/test_state_machine.py` — all tests from `docs/test-fixtures.md` State Machine section.
- [ ] `backend/tests/test_scrubber.py` — all tests from `docs/test-fixtures.md` Pre-Bill Scrubber section, including false positives.
- [ ] `backend/tests/test_idempotency.py` — from `docs/test-fixtures.md` Idempotency section.

### Day 2 Acceptance Criteria

```
✓ pytest tests/test_state_machine.py — all pass
✓ pytest tests/test_scrubber.py — all pass (te-005 "review documents" flagged)
✓ pytest tests/test_idempotency.py — all pass
✓ MCP server starts: curl http://localhost:8000/mcp responds
✓ log_audit_event() creates Firestore document in audit_log collection
✓ advance_entry_status() CAPTURED→APPROVED returns ToolError (invalid transition)
✓ advance_entry_status() CAPTURED→PENDING returns ToolResult (valid)
```

**Blocker:** Do not start Day 3 until state machine tests and scrubber tests pass.

---

## Day 3 — Brief Assembler + Ingestion Fixtures + ADK Coordinator

**Goal:** `GET /api/brief` returns all 5 sections populated. `POST /api/sweep` invokes coordinator.  
**Hours:** 10–12

### Tasks

**Ingestion layer**
- [ ] `backend/app/ingestion/demo_fixtures.py` — Seeded fixture data:
  - `DEMO_GMAIL_FIXTURES` — dict keyed by `firm_id`. Contains `DeadlineCandidate` objects: 2 deadline email extractions for Strand & Okafor (one for dl-mercer-001 context, one for dl-reyes-001 context). Includes `source_type`, `source_excerpt`, `extracted_date`, `matter_id`.
  - `DEMO_CALENDAR_FIXTURES` — calendar event objects corresponding to the 2 deadlines.
- [ ] `backend/app/ingestion/gmail_adapter.py` — `GmailDeadlineSource` Protocol. `DemoFixtureGmailSource.get_deadline_candidates()` returns from `DEMO_GMAIL_FIXTURES`. `RealGmailOAuthSource` — stub only, raises `NotImplementedError("v1.1")`.
- [ ] `backend/app/ingestion/calendar_adapter.py` — same pattern as Gmail adapter.

**Brief assembler**
- [ ] `backend/app/brief/schemas.py` — `BriefResponse`, `BriefSection`, `BriefDeadlineItem`, `BriefTimeEntryItem`, `BriefBudgetItem`, `BriefClientSilenceItem`, `BriefAnomalyItem`. Must mirror `docs/api-contract.md` brief response schema exactly.
- [ ] `backend/app/brief/assembler.py` — `assemble_brief(firm_id, attorney_id) → BriefResponse`. Reads Firestore state directly (no LLM). Builds all 5 sections:
  - `deadlines` — all `ACTIVE` deadlines with `verification_status=attorney_verified`, sorted by `due_date` ascending, `HARD_LEGAL` first. Includes scrubber flag if applicable. Days until due computed via `config.get_effective_date()`.
  - `time_entries` — all `PENDING` entries. Runs `run_scrubber()` on each. Includes `scrubber_warnings` inline.
  - `budget_risks` — all clients where `alert_status` is `WARN` or `CRITICAL`. Calls `compute_budget_utilization()`.
  - `client_silence` — all matters where `days_since_last_contact >= client_silence_threshold_days`. Uses `config.get_effective_date()`.
  - `anomalies` — from `escalations` collection, status=`PENDING`.

**API routes**
- [ ] `backend/app/routes/brief.py` — `GET /api/brief?firm_id=&attorney_id=` → calls `assemble_brief()`. `POST /api/sweep` — invokes coordinator, returns sweep summary.

**ADK coordinator (skeleton)**
- [ ] `backend/app/agents/coordinator.py` — ADK `LlmAgent` with Gemini 2.5 Pro. Uses `MCPToolset` pointing at `{BACKEND_URL}/mcp`. Deterministic routing via `classify_signal()` Python function (no LLM routing). `SIGNAL_ROUTING` dict maps `SignalType` enum → agent name. `execute_sweep(firm_id)` — reads current Firestore state, classifies signals, runs relevant sub-agents, assembles brief narrative.

**Billing sub-agent**
- [ ] `backend/app/agents/billing_agent.py` — thin ADK sub-agent. Reads pending time entries. Calls `run_scrubber()` on each. Calls `compute_budget_utilization()` for all clients. Returns structured billing section for coordinator to include in brief. Does NOT write to Firestore — only calls read operations and returns structured data to coordinator.

**Deadline sub-agent**
- [ ] `backend/app/agents/deadline_agent.py` — thin ADK sub-agent. Reads `ACTIVE` deadlines. Computes `days_until_due` via `config.get_effective_date()`. Applies escalation cadence (Python date math, no LLM). Returns structured deadline section. Calls `log_deadline_event()` via MCP for `ESCALATION_SENT` events — this is the MCP call that judges will see.

**TypeScript types and API client**
- [ ] `dashboard/src/types.ts` — TypeScript types mirroring all Pydantic models. Must match exactly. Update when models.py changes.
- [ ] `dashboard/src/api.ts` — all API calls. No `fetch()` calls anywhere outside this file.

**Tests**
- [ ] `backend/tests/test_brief_assembly.py` — partial (deadlines section, time entries section with scrubber warnings, budget section).
- [ ] `backend/tests/test_deduplication.py` — from `docs/test-fixtures.md`.

### Day 3 Acceptance Criteria

```
✓ GET /api/brief returns JSON with all 5 sections
✓ dl-mercer-001 (HARD_LEGAL, 6 days) appears in deadlines section
✓ te-005 appears in time_entries with NARRATIVE_FORBIDDEN_PHRASE warning
✓ acme-commercial appears in budget_risks at 78%
✓ whitmore-employment-2026 appears in client_silence at 16 days
✓ POST /api/sweep returns {"sweep_id": ..., "sections_updated": [...]}
✓ pytest tests/test_brief_assembly.py (partial) — pass
```

---

## Day 4 — Remaining Agents + Full API Routes + Demo Reset

**Goal:** `GET /api/demo/ready` passes all 5 checks. Every action endpoint works end-to-end.  
**Hours:** 8–10

### Tasks

**Client comms agent**
- [ ] `backend/app/agents/comms_agent.py` — FactPacket pattern. `build_fact_packet(matter_id, firm_id, trigger)` — assembles structured facts from Firestore (client profile, matter summary, recent activity, trigger reason). Each fact has `fact_id`, `fact_text`, `source_type`, `source_id`, `source_excerpt`. Calls Gemini to generate draft from fact packet only. Post-processes draft: validates `[fact_id]` citations, converts uncited claims to `[ATTORNEY: add detail here]` placeholders. Builds `source_map` for dashboard display.

**Anomaly agent**
- [ ] `backend/app/agents/anomaly_agent.py` — fully deterministic. No Gemini calls. Implements all anomaly detectors per `docs/data-contract.md` anomaly patterns. `compute_escalation_score(anomaly)` with override rules: severity-5 always ≥ 4.5; HARD_LEGAL + ≤7 days = 5.0; POTENTIAL_DUPLICATE always ≥ 4.0. Scores ≥ 3.0 → logs via `log_anomaly()` MCP call.

**Full API routes**
- [ ] `backend/app/routes/actions.py` — all action endpoints from `docs/api-contract.md`:
  - `POST /api/actions/deadline/confirm` — calls `log_deadline_event()` via tool layer
  - `POST /api/actions/deadline/resolve`
  - `POST /api/actions/deadline/extend`
  - `POST /api/actions/deadline/dismiss` — reason required
  - `POST /api/actions/deadline/verify`
  - `POST /api/actions/billing/approve` — calls `advance_entry_status()` via tool layer
  - `POST /api/actions/billing/update-narrative`
  - `POST /api/actions/billing/write-down` — reason required
  - `POST /api/actions/billing/write-off` — reason required
  - `GET /api/billing/scrubber/{entry_id}` — runs scrubber, returns warnings
  - `GET /api/billing/budget/{client_id}`
  - `POST /api/billing/generate-invoice`
  - `GET /api/billing/ledes/{invoice_id}` — **STUBBED**: returns fixture LEDES text
  - `POST /api/actions/comms/approve`
  - `POST /api/actions/comms/queue`
  - `POST /api/actions/comms/confirm-sent`
  - `POST /api/actions/comms/dismiss` — reason required
  - `POST /api/actions/alert/dismiss` — reason required
- [ ] `backend/app/routes/demo.py` — full implementation:
  - `GET /api/demo/ready` — validates all 5 demo conditions per `docs/api-contract.md`
  - `POST /api/demo/reset` — deletes all `firms/strand-okafor/` documents, re-runs seed
  - `GET /api/demo/state` — summary of current demo Firestore state

**Tests**
- [ ] `backend/tests/test_brief_assembly.py` — complete all 5 sections.
- [ ] `backend/tests/test_anomaly_scoring.py` — override rule tests.
- [ ] `backend/tests/test_prompt_injection.py` — Gmail extraction safety tests.
- [ ] `backend/tests/test_demo_readiness.py` — all 5 conditions + reset restores conditions.

### Day 4 Acceptance Criteria

```
✓ GET /api/demo/ready → {"ok": true, all 5 checks passing}
✓ POST /api/actions/billing/approve — audit_log entry created in Firestore
✓ POST /api/actions/deadline/confirm — deadline_event created in Firestore
✓ POST /api/actions/comms/approve — comm status changes, last_client_contact NOT updated
✓ POST /api/actions/comms/confirm-sent — last_client_contact IS updated
✓ POST /api/demo/reset — followed by GET /api/demo/ready → all 5 passing again
✓ pytest (all tests) — pass
```

**Blocker:** Do not start Day 5 until demo/ready passes all 5 checks and demo/reset restores them.

---

## Day 5 — React Dashboard

**Goal:** Full demo path clickable in browser. Every action writes through backend. Deployed.  
**Hours:** 10–12

### Tasks

**Dashboard foundation**
- [ ] `App.tsx` — React Router setup. Routes: `/`, `/deadline/:id`, `/billing/wip/:id`, `/comms/draft/:id`, `/budget/:id`, `/anomaly/:id`, `/audit`, `/email-preview`, `/demo/reset`.
- [ ] Demo mode banner — persistent amber banner at top when `LITT_DEMO_MODE=true`.
- [ ] Loading/error states for all API calls.

**Daily Closeout Brief homepage**
- [ ] `components/DailyCloseoutBrief.tsx` — main homepage. Calls `GET /api/brief` on load and on action completion. Shows: firm name, attorney name, date, last sweep time. Five sections rendered in order: deadlines, time entries, budget risks, client silence, anomalies. Resolved items collapse to "Resolved today" section at bottom.

**Deadline modal**
- [ ] `components/modals/DeadlineModal.tsx` — opens on deadline item click or deep link. Shows: description, due date, days remaining badge (red if HARD_LEGAL), source excerpt, source type, classification, verification status. Actions: Confirm (`POST /api/actions/deadline/confirm`), Extend (date picker + `POST /api/actions/deadline/extend`), Dismiss (text input required + `POST /api/actions/deadline/dismiss`). On success: audit event drawer fires.

**Billing WIP modal**
- [ ] `components/modals/BillingWIPModal.tsx` — opens on time entry click or deep link. Shows: entry details, hours, amount, narrative (editable), scrubber warnings inline with amber alert styling. Actions: Approve (`POST /api/actions/billing/approve`), Write Down (hours + amount + required reason + `POST /api/actions/billing/write-down`), Write Off (required reason + `POST /api/actions/billing/write-off`), Update Narrative (`POST /api/actions/billing/update-narrative`). Write-down and write-off require non-empty reason — disable button until filled.

**Client comms modal**
- [ ] `components/modals/ClientCommsModal.tsx` — opens on client silence item click or deep link. Shows: draft body (editable), source map (each sentence with source attribution visible on hover/expand), trigger reason. State machine displayed: DRAFT_GENERATED → DRAFT_APPROVED → QUEUED_FOR_SEND → SENT_CONFIRMED. Actions: Approve (`POST /api/actions/comms/approve`), Queue for Delivery (`POST /api/actions/comms/queue`), Mark Sent (`POST /api/actions/comms/confirm-sent`), Dismiss (required reason). Shows `last_client_contact` does NOT update on approval — only on SENT_CONFIRMED.

**Budget modal**
- [ ] `components/modals/BudgetModal.tsx` — opens on budget item click. Shows: utilization progress bar (amber at WARN, red at CRITICAL), $X of $Y, days at current rate until threshold. Draft budget alert button opens client comms modal.

**Anomaly modal**
- [ ] `components/modals/AnomalyModal.tsx` — opens on anomaly item click. Shows: anomaly type badge, severity score, confidence, escalation score, what triggered it. Dismiss button (required reason + `POST /api/actions/alert/dismiss`).

**Audit event drawer**
- [ ] `components/shared/AuditEventDrawer.tsx` — slides in from right after any successful action. Shows: event type, actor, entity, before/after state summary, timestamp. Auto-dismisses after 5 seconds or on manual close.

**Demo reset UI**
- [ ] `components/DemoResetButton.tsx` — visible only in demo mode. Calls `POST /api/demo/reset`. Confirmation dialog: "This will delete all demo state and re-seed. Continue?" On complete: brief refreshes.

**Email digest preview**
- [ ] `/email-preview` route — plain HTML rendering of the current brief in email format. Deep links shown for each item. This is the "email digest" stub — no real email sent.

**Redeploy**
- [ ] Build and redeploy `litt-dashboard` to Cloud Run.

### Day 5 Acceptance Criteria

```
✓ Dashboard loads at Cloud Run URL, brief populates from live Firestore
✓ Click Confirm on dl-mercer-001 → deadline_event in Firestore → audit drawer appears
✓ Click Approve on te-005 (with scrubber warning visible) → APPROVED state → audit drawer
✓ Click Approve on te-001 (no narrative) → narrative input visible → add narrative → approve
✓ Client comms modal for Whitmore shows source attribution → approve → queue → confirm sent → last_client_contact updates
✓ Demo reset button → brief resets to seed state
✓ Deep link /deadline/dl-mercer-001 opens correct modal
✓ All actions write to Firestore (verify in console for at least 3 actions)
```

**Blocker:** Every demo action must be completable in 3 clicks from the homepage. If any requires more than 3 clicks, fix it before Day 6.

---

## Day 6 — Hardening + Architecture Diagram + Demo Recording + Submit

**Goal:** Video recorded. Devpost submitted by 4:30 PM PT.  
**Hours:** 6–8 (hard stop at 5 PM)

**Hard rule: No new features after noon Day 6. Fix demo-breaking bugs only.**

### Morning (8 AM – 12 PM)

**Deployment verification**
- [ ] Cloud Run final deployment: both services, all env vars, CORS origins correct.
- [ ] Verify `GET /api/demo/ready` passes all 5 checks on deployed URL (not localhost).
- [ ] Verify `POST /api/demo/reset` restores all 5 checks on deployed URL.
- [ ] Verify all 5 modals open and actions complete on deployed URL.

**Architecture diagram**
- [ ] `docs/architecture.png` — required for submission. Must clearly show:
  - Ingestion layer: Gmail fixture adapter, Calendar fixture adapter
  - Coordinator agent (Gemini 2.5 Pro / ADK)
  - MCP connection between coordinator and tool layer ← judges need to see this
  - Four sub-agents: Deadline Monitor, Billing Reconciliation, Client Comms, Anomaly Escalation
  - Litt MCP Server (tool layer)
  - Firestore collections
  - React dashboard + email digest preview
  - All technology names visible and labeled

**Demo rehearsal**
- [ ] Run `POST /api/demo/reset`. Run `GET /api/demo/ready` — all 5 must pass.
- [ ] Rehearse 2-minute demo script 3× against live deployed system. Time each run.
- [ ] Fix any demo-breaking bugs. No feature additions.

**Devpost written description (draft)**
- [ ] Business case section (problem, market, wedge — per `docs/Litt-Sprint-Plan-v1.0.md` Day 7 guidance).
- [ ] Technical section: ADK multi-agent, MCP tool layer, coordinator routing (deterministic Python), state machine, audit log, ingestion fixtures with adapter pattern.
- [ ] Findings and learnings (required field).
- [ ] Third-party disclosures: Gmail API (stub/fixture), Google Calendar API (stub/fixture), Gemini API via Vertex AI.
- [ ] Agent Engine mention: "v1.0 deploys on Cloud Run; Agent Engine is the production migration path for multi-tenant scale."
- [ ] Architecture diagram embedded.

### Afternoon (12 PM – 4:30 PM)

**Record demo video**
- [ ] `POST /api/demo/reset`. Confirm `GET /api/demo/ready` all passing.
- [ ] Record 2-minute demo per script in `docs/Litt-Sprint-Plan-v1.0.md` Section 21. Record against live deployed URL — not localhost.
- [ ] Export as MP4. Verify audio is clear.
- [ ] Upload to YouTube (unlisted) or Vimeo. Copy URL.

**Final submission**
- [ ] Final Devpost submission: GitHub repo URL, video URL, written description with architecture diagram, Cloud Run URL (no login required), Track 1.
- [ ] Screenshot submission confirmation page.
- [ ] **Submit by 4:30 PM PT.**

### Day 6 Acceptance Criteria

```
✓ Deployed URL responds to all 5 modal interactions
✓ GET /api/demo/ready passes all 5 on deployed URL
✓ Architecture diagram exists at docs/architecture.png, shows MCP
✓ Video recorded at live deployed URL (not localhost)
✓ Video is between 1:00 and 2:00 minutes
✓ Devpost submission confirmed before 4:30 PM PT
✓ GitHub repo is public
```

---

## Pre-Build Questions — Answers Locked

**Q: Are we tasking the coordinator with too much? Should we add an air traffic controller agent?**  
A: No. Routing is already deterministic Python (`classify_signal()` → `SIGNAL_ROUTING` dict). Gemini only synthesizes the brief narrative. Adding another agent layer adds complexity without value in a 6-day sprint.

**Q: Persisted memory/data storage — legal-grade approach?**  
A: Firestore is the persistence layer. All state is written through the tool layer. The `audit_log` collection is the operational memory. ADK conversation history persists within a sweep invocation. No cross-invocation LLM memory — structured Firestore state is the firm's memory.

**Q: Data segregation per matter/client/attorney?**  
A: `firm_id` on every Firestore document. Firestore path structure `firms/{firm_id}/collection/{id}`. Firestore security rules enforce tenant isolation. `LittBaseModel` validates `firm_id` presence on every record. No cross-firm queries anywhere in the tool layer.

**Q: Do we need oracle agents reviewing coordinator output?**  
A: No. The deterministic tool layer is the oracle. State machine enforcement, required reason strings, attorney confirmation gates, and idempotency checks are the correctness guardrails. Adding an oracle agent adds latency, a new failure mode, and complexity for no additional correctness guarantee.

---

## Cut Decisions

| Feature | Decision | Reason |
|---------|----------|--------|
| Gmail OAuth | STUBBED — `RealGmailOAuthSource` interface, `NotImplementedError` impl | OAuth complexity would consume 2 days |
| Calendar OAuth | STUBBED — same pattern | Same |
| LEDES full export | STUBBED — endpoint returns fixture LEDES text | Not in 2-min demo; recovers 4–6 hours |
| Email delivery (SendGrid) | STUBBED — `/email-preview` page | No real send needed for demo |
| Firestore event triggers | STUBBED — `POST /api/sweep` is manual trigger | Recursive trigger chains are a sprint killer |
| Cloud Scheduler | Config file exists, not activated | Demo uses manual sweep |
| Cloud KMS field encryption | Marked in data model, passthrough in v1.0 | KMS setup is infra overhead |
| Weekly anomaly digest | Data model ready, delivery stubbed | Not in 2-min demo |
| Matter detail pages | Not built — modals only | Homepage + modals covers demo |
| Full audit log page | Shows recent events only | Full export UI is v1.1 |
| Agent Engine | Cloud Run v1.0; noted as v1.1 migration | Simpler for sprint |
| A2A protocol | Not built | Track 3 only; not required for Track 1 |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cloud Run CORS / IAM misconfiguration | HIGH | CRITICAL | Deploy skeleton Day 1 — catch early |
| ADK + MCP integration unknown behavior | MEDIUM | HIGH | Test MCP connection Day 2; have direct tool calls as fallback |
| Firestore cold start latency | LOW | MEDIUM | Cloud Run min instances = 1 |
| Demo state mutation before recording | HIGH | HIGH | `POST /api/demo/reset` + `GET /api/demo/ready` before every take |
| Day 5 dashboard takes longer than expected | MEDIUM | HIGH | Single page + modals only; no multi-view SPA |
| Video recording issues Day 6 | LOW | CRITICAL | Record rough take Day 5; polish Day 6 |

---

## Demo Script (2 minutes, against live deployed system)

```
0:00–0:10  [blank dashboard]
           "A solo attorney at a small civil firm ends every day not knowing
            what slipped. Litt fixes that."

0:10–0:25  [Daily Closeout Brief appears — Strand & Okafor LLP]
           [pause on 4 visible items: red HARD_LEGAL badge, WIP total,
            amber budget bar, 16-day client silence]

0:25–0:50  [click Confirm on dl-mercer-001]
           [flash of audit_log entry in Firestore console — 2 sec]
           "Every confirmation is logged. Every escalation is documented.
            If there's ever a malpractice claim, this is the record."

0:50–1:15  [open te-005 — scrubber warning visible: 'review documents']
           [edit narrative, approve]
           [open te-001 — no narrative, add narrative, approve]
           "Litt flagged the billing guideline violation before
            the invoice went out."

1:15–1:38  [Whitmore client silence — 16 days — click 'Review draft']
           [client comms modal — source attribution visible per sentence]
           [attorney approves, queues, marks sent]
           "The draft is Litt's. The send is the attorney's. Always."

1:38–1:55  [architecture diagram slide]
           [show: coordinator → MCP → tool layer → Firestore]
           "Litt. The operational control layer for small law firms."
```

---

## File Structure Reference

```
litt/
├── CLAUDE.md
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py              ← canonical source of truth
│   │   ├── config.py              ← demo clock (never use date.today() elsewhere)
│   │   ├── db.py
│   │   ├── tools/
│   │   │   ├── __init__.py
│   │   │   ├── audit.py           ← must exist before any other tool
│   │   │   ├── billing.py
│   │   │   ├── deadlines.py
│   │   │   ├── comms.py
│   │   │   ├── system.py
│   │   │   └── validation.py
│   │   ├── mcp_server/            ← NEW — MCP integration
│   │   │   ├── __init__.py
│   │   │   └── server.py
│   │   ├── scrubber/
│   │   │   └── prebill.py
│   │   ├── brief/
│   │   │   ├── assembler.py
│   │   │   └── schemas.py
│   │   ├── agents/
│   │   │   ├── coordinator.py
│   │   │   ├── billing_agent.py
│   │   │   ├── deadline_agent.py
│   │   │   ├── comms_agent.py
│   │   │   └── anomaly_agent.py
│   │   ├── ingestion/
│   │   │   ├── demo_fixtures.py
│   │   │   ├── gmail_adapter.py
│   │   │   └── calendar_adapter.py
│   │   └── routes/
│   │       ├── brief.py
│   │       ├── actions.py
│   │       └── demo.py
│   ├── tests/
│   │   ├── fixtures/
│   │   ├── test_state_machine.py
│   │   ├── test_scrubber.py
│   │   ├── test_ledes.py          ← minimal (LEDES is stubbed)
│   │   ├── test_idempotency.py
│   │   ├── test_deduplication.py
│   │   ├── test_brief_assembly.py
│   │   ├── test_anomaly_scoring.py
│   │   ├── test_prompt_injection.py
│   │   └── test_demo_readiness.py
│   └── requirements.txt
├── dashboard/
│   ├── src/
│   │   ├── types.ts
│   │   ├── api.ts
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── DailyCloseoutBrief.tsx
│   │       ├── DemoResetButton.tsx
│   │       ├── modals/
│   │       │   ├── DeadlineModal.tsx
│   │       │   ├── BillingWIPModal.tsx
│   │       │   ├── ClientCommsModal.tsx
│   │       │   ├── BudgetModal.tsx
│   │       │   └── AnomalyModal.tsx
│   │       └── shared/
│   │           └── AuditEventDrawer.tsx
│   └── package.json
├── scripts/
│   ├── seed_demo.py
│   ├── reset_demo.py
│   └── verify_demo.py
├── docs/
│   ├── architecture.png           ← required for submission
│   └── [existing docs]
├── tasks/
│   ├── plan.md                    ← this file
│   └── todo.md
├── Dockerfile.backend
├── Dockerfile.dashboard
└── .env.example
```

---

---

# Timer HUD — Feature Plan

**Added:** June 4, 2026 (deadline extension to June 11 unlocks this)  
**Status:** Pre-build — plan approved, no code written  
**Scope:** New floating time-capture widget wired into existing billing pipeline  
**Demo slot:** 15–20 seconds inserted before the main brief walkthrough  

---

## What We're Building and Why

Litt currently only *reviews* time entries — the billing pipeline starts at `PENDING`, already written by someone else. That leaves a gap: where do the entries come from? For the hackathon demo, they come from seed data. For real attorneys, they come from the timer in their billing software.

The Timer HUD closes that loop. A floating widget, always visible, lets Dana click Start → work → Stop → confirm a Gemini-normalized narrative → entry lands in `PENDING` and flows into the next sweep. Judges see the full capture-to-audit trail in one 15-second sequence.

This is a dashboard-native React component — not a browser extension (explicitly cut from scope in cutline.md). Timer state persists in `localStorage` so a page navigation or refresh does not kill an in-progress entry.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Widget placement | Rendered in `App.tsx` **outside** `<Routes>` | Persists across `/`, `/audit`, `/email-preview` without re-mounting |
| Matter list source | New `GET /api/matters` endpoint in `brief.py` | Minimal backend addition; matters collection is already seeded and consistent |
| Rate lookup | Backend fetches from `attorneys` collection during capture | Never expose billing rate in the UI; backend owns the calculation |
| Gemini narrative normalization | New `POST /api/actions/timer/normalize-narrative` in `actions.py` | Uses same `_call_gemini()` pattern as `comms_agent.py`; isolated endpoint = easy to mock in tests |
| Gemini failure handling | Fallback to raw description if call fails | Demo must not block on a network error; attorney still sees their raw text |
| Entry write | `POST /api/actions/timer/capture` → `write_time_entry()` | Reuses existing tool function unchanged; same idempotency + audit trail |
| `entry_date` | `config.get_effective_date()` on backend, never from browser clock | Enforces demo clock rule; matches all other entries in the system |
| Demo pre-seeding | Document localStorage seed as a manual pre-demo step; optionally clear in `DemoResetButton.tsx` | Simplest path; no new API needed |
| `ai_assisted` flag | `True` when Gemini normalization was used | Enables `AI_DISCLOSURE_GAP` anomaly detector to fire on timer entries just like on other entries |

---

## State Machine

```
                        ┌──────────────────────────────────┐
                        ▼                                  │ Edit (back to stopped)
 [idle] ──Start──► [running] ──Stop──► [stopped] ──normalizing──► [confirming]
   ▲                   │                   │                          │
   │                   │                   │                          │ Confirm
   │                Discard             Discard                       ▼
   └────────────────────────────────────────────────────── [done] ──3s──► [idle]
```

State transitions:
- `idle → running`: user clicks Start, matter is selected (required before timer starts)
- `running → stopped`: user clicks Stop; description is required if not already filled
- `stopped → confirming`: POST normalize-narrative called; spinner shows during Gemini call
- `confirming → idle`: user clicks Confirm; POST capture fires; entry_id returned; done flash
- `confirming → stopped`: user clicks "Edit" — back to stopped with editable description
- `any → idle`: user clicks Discard/Cancel (with confirmation dialog if timer > 0)

---

## localStorage Schema

Key: `litt_timer_state`

```json
{
  "status": "idle | running | stopped | confirming",
  "matter_id": "string | null",
  "matter_name": "string | null",
  "client_id": "string | null",
  "description": "string",
  "started_at_epoch_ms": "number | null",
  "elapsed_ms_accumulated": "number",
  "normalized_narrative": "string | null"
}
```

Computing current elapsed when status is `running`:
```
current_elapsed = elapsed_ms_accumulated + (Date.now() - started_at_epoch_ms)
```

`elapsed_ms_accumulated` holds prior elapsed time (supports pause-resume in future; for v1.0 it is always 0 at start).

On confirm success: clear localStorage to `{ status: "idle", ... nulls, elapsed: 0 }`.  
On corrupt/unparseable localStorage: reset to idle silently.

---

## UI Layout — State by State

All states: `position: fixed`, bottom-right, 24px margin, z-index 9999. IBM Plex Sans throughout. Uses existing CSS variables from the dashboard design system (`--color-background-primary`, `--color-text-primary`, etc.).

### Idle State
```
┌──────────────────────┐
│  ▶  Start Timer      │
└──────────────────────┘
```
- Pill button, ~170px wide, 40px tall
- Background: `#14221F` (forest), text: white
- Hover: slight opacity lift
- Click → opens expanded running state (matter must be selected first if not pre-set)

### Running State
```
┌──────────────────────────────────┐
│  ● RECORDING          [Discard] │
│  Rivera v. Holbrook              │
│  ─────────────────────────────  │
│  00:07:23                        │
│  ─────────────────────────────  │
│  Reviewed Rivera depo outline..  │
│  (click to edit)                 │
│                        [Stop ■] │
└──────────────────────────────────┘
```
- 300px wide, fixed height ~160px
- Pulsing red dot + "RECORDING" label (CSS animation)
- Matter name in `#D6C181` (brass)
- Timer display: `font-family: monospace`, 28px, bold
- Description: single-line input, editable inline, gray placeholder if empty
- Stop button: red background, white text

### Confirming State (review before submit)
```
┌──────────────────────────────────┐
│  REVIEW ENTRY           [Edit]  │
│  Rivera v. Holbrook · 0.2 hrs   │
│  ─────────────────────────────  │
│  Raw:  "Reviewed Rivera depo    │
│         outline with Omar"       │
│  ─────────────────────────────  │
│  ✦ Litt: "Reviewed Rivera v.    │
│    Holbrook deposition outline   │
│    and discovery strategy with   │
│    O. Okafor" (editable)         │
│  ─────────────────────────────  │
│       [Discard]    [Confirm ✓]  │
└──────────────────────────────────┘
```
- Litt-normalized narrative shown with `✦` badge (brass color)
- Narrative is editable before confirm — attorney override allowed
- Hours displayed (rounded to 6-min increment, computed client-side for preview: `Math.ceil(elapsed_ms / 60000 / 6) * 6 / 60`)
- Confirm button: forest green. Discard: gray text link.

### Done State (auto-dismisses after 3 seconds)
```
┌──────────────────────────────────┐
│  ✓  Entry created                │
│  te-a3f7c2d1 · PENDING           │
│  Appears in next sweep           │
└──────────────────────────────────┘
```
- Green background (`#1D9E75`), white text
- Entry ID displayed for reference
- 3-second countdown, then fades to idle

---

## Dependency Graph

```
GET /api/matters (new backend endpoint)
    │
    └── Matter dropdown in TimerHUD

POST /api/actions/timer/normalize-narrative (new backend endpoint)
    │
    └── Stopped → Confirming transition in TimerHUD

POST /api/actions/timer/capture (new backend endpoint)
    │   └── write_time_entry() [existing — unchanged]
    │       └── log_audit_event() [existing — unchanged]
    │
    └── Confirm action in TimerHUD → done state → AuditEventDrawer

TimerHUD.tsx (new component)
    │
    └── App.tsx (mount outside <Routes>)
```

Implementation order follows the graph bottom-up: backend endpoints first, then types, then API client, then widget shell, then wire to backend.

---

## File Change Summary

| File | Change | Size |
|------|--------|------|
| `backend/app/routes/brief.py` | Add `GET /api/matters` | XS |
| `backend/app/routes/actions.py` | Add `POST /api/actions/timer/normalize-narrative` and `POST /api/actions/timer/capture` | S |
| `dashboard/src/types.ts` | Add `MatterSummary`, `TimerCaptureRequest`, `TimerCaptureResponse`, `TimerNormalizeRequest`, `TimerNormalizeResponse` | XS |
| `dashboard/src/api.ts` | Add `getMatters()`, `normalizeNarrative()`, `captureTimerEntry()` | XS |
| `dashboard/src/components/TimerHUD.tsx` | **New file** — full widget, all states | M |
| `dashboard/src/App.tsx` | Mount `<TimerHUD>` outside `<Routes>`, pass `firmId` + `attorneyId` | XS |
| `dashboard/src/components/DemoResetButton.tsx` | Clear `litt_timer_state` from localStorage on reset | XS |

Total: 7 file changes, 1 new file. No changes to existing tools, models, tests, or the brief assembler.

---

## Backend Endpoint Specs

### GET /api/matters

Location: `backend/app/routes/brief.py`

Request: `?firm_id=strand-okafor`

Response:
```json
[
  {
    "id": "mercer-industries",
    "name": "Mercer Industries — General Counsel",
    "client_id": "mercer-industries",
    "client_name": "Mercer Industries"
  },
  {
    "id": "rivera-v-holbrook",
    "name": "Rivera v. Holbrook",
    "client_id": "rivera-personal",
    "client_name": "Marcus Rivera"
  }
]
```

Implementation: Read `firms/{firm_id}/matters` collection. For each matter, read `client_id`, look up `client_name` from `firms/{firm_id}/clients/{client_id}`. Return sorted by `name`. No rate exposed in response (backend handles rate at capture time).

### POST /api/actions/timer/normalize-narrative

Location: `backend/app/routes/actions.py`

Request:
```json
{
  "firm_id": "strand-okafor",
  "attorney_id": "dana-strand",
  "matter_id": "rivera-v-holbrook",
  "matter_name": "Rivera v. Holbrook",
  "raw_description": "Reviewed Rivera depo outline with Omar",
  "session_minutes": 7
}
```

Response:
```json
{
  "normalized_narrative": "Reviewed Rivera v. Holbrook deposition outline and discovery strategy with O. Okafor",
  "used_gemini": true,
  "model_used": "gemini-2.5-pro"
}
```

Implementation: Calls `_call_gemini_normalize()` (local helper, same pattern as `comms_agent._call_gemini()`). If Gemini returns None, returns `{"normalized_narrative": raw_description, "used_gemini": false, "model_used": null}` — graceful fallback, never errors.

System prompt (hardcoded, not configurable):
```
You are a legal billing assistant. Convert the attorney's raw session note into a
professional billing narrative suitable for a legal invoice. Maximum 200 characters.
Return only the narrative — no preamble, no explanation. Do not invent facts not
present in the input. If the note is already professional, return it unchanged.
```

User prompt: `Matter: {matter_name}\nSession: {session_minutes} min\nNote: {raw_description}`

This endpoint does NOT write to Firestore. It is read-only from a data perspective. No audit event.

### POST /api/actions/timer/capture

Location: `backend/app/routes/actions.py`

Request:
```json
{
  "firm_id": "strand-okafor",
  "matter_id": "rivera-v-holbrook",
  "attorney_id": "dana-strand",
  "session_minutes": 7,
  "narrative": "Reviewed Rivera v. Holbrook deposition outline and discovery strategy with O. Okafor",
  "used_gemini": true,
  "idempotency_key": "timer-abc123"
}
```

Response: Standard `ToolResult` (same shape as all other action endpoints):
```json
{
  "success": true,
  "entity_id": "te-a3f7c2d1",
  "entity_type": "time_entry",
  "audit_event_id": "audit-xyz"
}
```

Implementation:
1. Look up matter → get `client_id`
2. Look up `firms/{firm_id}/attorneys/{attorney_id}` → get `hourly_rate` (fallback: 350.0)
3. Call `write_time_entry(firm_id, matter_id, client_id, attorney_id, entry_date=config.get_effective_date(), session_minutes=session_minutes, rate=Decimal(str(rate)), actor=attorney_id, idempotency_key=idempotency_key, narrative=narrative, ai_assisted=used_gemini, ai_tool="litt-narrative-normalizer" if used_gemini else None, model=config.GEMINI_MODEL if used_gemini else None)`
4. Return result as-is

The entry is created with `status="PENDING"`. It will appear in the brief's `time_entries` section on the next `GET /api/brief` or sweep.

---

## Frontend Component Spec — TimerHUD.tsx

Location: `dashboard/src/components/TimerHUD.tsx`

Props:
```typescript
interface TimerHUDProps {
  firmId: string;
  attorneyId: string;
}
```

Internal state (also mirrored to localStorage):
```typescript
type TimerStatus = 'idle' | 'running' | 'stopped' | 'confirming' | 'done';

interface TimerState {
  status: TimerStatus;
  matterId: string | null;
  matterName: string | null;
  clientId: string | null;
  description: string;
  startedAtEpochMs: number | null;
  elapsedMsAccumulated: number;
  normalizedNarrative: string | null;
}
```

Hooks used:
- `useState` for `TimerState`
- `useEffect` for the tick interval (1-second `setInterval` when `status === 'running'`)
- `useEffect` for localStorage sync (write on every state change)
- `useEffect` on mount for localStorage restore

Key behaviors:
- `setInterval` starts on `running`, clears on stop — display updates every second
- Display format: `elapsed_ms < 3600000` → `MM:SS`, else `H:MM:SS`
- Matter dropdown populated from `GET /api/matters` on first open (cached in state)
- Normalize called automatically on `running → stopped` transition; spinner blocks UI during call
- `captureTimerEntry` called on Confirm; `AuditEventDrawer` hook NOT used (widget shows its own done state)
- Idempotency key generated client-side: `timer-${Date.now()}-${Math.random().toString(36).slice(2,8)}`

---

## Demo Scene — 15–20 Seconds

**Insert this scene BEFORE "0:00–0:10 Hook" in the existing demo script, or as a standalone pre-brief opener.**

Recommended position: After clicking "Run Closeout" but before the timeline finishes — or more cleanly, as a separate scene before the main demo sequence:

```
[Pre-brief scene, ~15 seconds]

NARRATOR:
"Before Dana checks the brief, she just finished a call.
The timer's been running in the corner."

ACTION: Timer HUD visible — running, "Rivera v. Holbrook", showing 00:07:23

ACTION: Dana clicks Stop.
  → Description box shows "Reviewed Rivera depo outline with Omar"
  → Spinner appears briefly (Gemini normalization)
  → Confirming state appears:
    Raw: "Reviewed Rivera depo outline with Omar"
    ✦ Litt: "Reviewed Rivera v. Holbrook deposition outline and discovery strategy with O. Okafor"

NARRATOR:
"Litt normalizes the billing narrative. Dana clicks Confirm."

ACTION: Confirm clicked → done state: "✓ Entry created · te-a3f7c2 · PENDING"

NARRATOR:
"That entry is now PENDING. It'll surface in the next sweep."
```

**Pre-demo setup for timer scene:**
Set this in browser localStorage before each take (or automate in DemoResetButton):
```javascript
localStorage.setItem('litt_timer_state', JSON.stringify({
  status: 'running',
  matterId: 'rivera-v-holbrook',
  matterName: 'Rivera v. Holbrook',
  clientId: 'rivera-personal',
  description: 'Reviewed Rivera depo outline with Omar',
  startedAtEpochMs: Date.now() - (7 * 60 * 1000 + 23 * 1000),
  elapsedMsAccumulated: 0,
  normalizedNarrative: null
}));
```
This seeds the timer to show 7:23 elapsed. Run this in browser DevTools console after demo reset.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gemini normalize-narrative call is slow (>3s) | High — stalls demo | Show spinner; if >5s timeout, fall back to raw description automatically |
| Gemini returns hallucinated content | Medium | System prompt explicitly forbids inventing facts; fallback to raw description |
| `write_time_entry` requires attorney rate from Firestore | High — entry fails if attorney doc missing | Backend falls back to `350.0`; attorney doc is always seeded |
| Timer localStorage corrupted after failed capture | Medium | On mount, wrap parse in try/catch; reset to idle on error |
| Timer widget overlaps modal content | Medium | `z-index: 9999` on widget; modals use `z-index: 10000` to appear above it |
| Demo timer pre-seed forgotten before recording | High | Add localStorage seed to DemoResetButton so demo reset also resets the timer state |

---

## Build Order (Task Dependencies)

```
T1: GET /api/matters         ──────────────┐
T2: POST /timer/capture       ─────────────┤
T3: POST /timer/normalize     ─────────────┤
                                           ▼
T4: TypeScript types (types.ts)           T8: Wire matter dropdown
T5: API client functions (api.ts) ────────►
                                           T9: Wire Stop → normalize → confirming
T6: TimerHUD.tsx shell (idle+running)     T10: Wire Confirm → capture → done
T7: Mount in App.tsx          ────────────►
                                           T11: Demo reset clears timer localStorage
[Checkpoint A: visual timer works]         T12: Error handling (Gemini fallback)
                                           T13: Demo scene pre-configuration

                                           [Checkpoint B: full E2E works]
                                           [Checkpoint C: demo scene dry run]
```

Tasks T1–T7 have no inter-dependencies within their phase and can proceed sequentially. T8–T10 each depend on their predecessor in the wire-up phase. T11–T13 are independent polish tasks.

---

## Updated File Structure (additions only)

```
dashboard/src/components/
├── TimerHUD.tsx              ← NEW
├── DemoResetButton.tsx       ← add localStorage clear
...

backend/app/routes/
├── brief.py                  ← add GET /api/matters
├── actions.py                ← add POST /api/actions/timer/{normalize-narrative,capture}
```

---

# Test Feature Plan: System Status Section in Dashboard README

**Added:** June 5, 2026
**Scope:** XS — single file edit

## Overview

Add a placeholder "System Status" section to `dashboard/README.md`. The current file is the default Vite/React template README. This section will document how to check backend health, demo readiness, and Cloud Run service status — useful for developers and judges running the dashboard locally or evaluating the live deployment.

## Architecture Decisions

- No code changes. README only.
- Section placed after the existing "React Compiler" section — logically first custom content in an otherwise template file.
- Links to existing endpoints (`/health`, `/api/demo/ready`) rather than duplicating their docs.

## Task List

### Phase 1: README Addition
- [ ] README-01: Add "System Status" section to `dashboard/README.md`

### Checkpoint: Complete
- [ ] Section renders correctly as markdown (validate in VS Code preview or GitHub)
- [ ] No existing README content removed or modified

## Task Detail

## Task 1: Add "System Status" section to dashboard README

**Description:** Insert a placeholder section that documents the key status-check endpoints available when running the Litt dashboard. This gives developers a quick reference for validating local and deployed environments.

**Acceptance criteria:**
- [ ] Section heading `## System Status` exists in `dashboard/README.md`
- [ ] Section documents `GET /health` (backend liveness) and `GET /api/demo/ready` (demo readiness)
- [ ] Section notes the Cloud Run deployed URL pattern
- [ ] Section is marked `<!-- placeholder -->` to indicate it is a stub

**Verification:**
- [ ] Manual check: open `dashboard/README.md` in VS Code — section appears after "React Compiler" heading
- [ ] No build or type-check failures (README change has no code impact)

**Dependencies:** None

**Files touched:**
- `dashboard/README.md`

**Estimated scope:** XS (1 file, 10–15 lines)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| README is still the Vite template — section may be replaced in a future README rewrite | Low | Mark as placeholder; easy to update |
