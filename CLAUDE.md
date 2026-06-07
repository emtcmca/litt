
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Project:** Litt — Autonomous AI Operations Agent for Small Law Firms  
**Stack:** Python (FastAPI) · Google ADK · Gemini 2.5 Pro · Firestore · React · Cloud Run  
**Demo firm:** Strand & Okafor LLP (synthetic seed data only)  
**Submission deadline:** June 11, 2026, 5:00 PM EST  
**Current state:** Day 1, May 30 — docs complete, code not yet written. Build order matters.

---

## Commands

### Backend (Python / FastAPI)

```bash
# Install dependencies
pip install -r backend/requirements.txt

# Run locally (from repo root)
uvicorn backend.app.main:app --reload --port 8002

# Run all tests
cd backend && pytest

# Run a single test file
cd backend && pytest tests/test_state_machine.py -v

# Run a single test by name
cd backend && pytest tests/test_state_machine.py::test_invalid_transition -v

# Seed demo data (idempotent — safe to re-run)
python scripts/seed_demo.py

# Verify demo state before recording
python scripts/verify_demo.py

# Reset demo state
python scripts/reset_demo.py
```

### Dashboard (React)

```bash
# Install dependencies
cd dashboard && npm install

# Run dev server (http://localhost:3000)
cd dashboard && npm run dev

# Production build
cd dashboard && npm run build

# Run tests
cd dashboard && npm test
```

### Environment

Copy `.env.example` to `.env` and set values. Required vars:
- `GOOGLE_CLOUD_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS`
- `LITT_DEMO_MODE=true`, `LITT_DEMO_DATE=2026-06-25`, `LITT_DEMO_FIRM_ID=strand-okafor`
- `GEMINI_MODEL=gemini-2.5-pro`, `VERTEX_AI_LOCATION=us-central1`

Never use `date.today()` or `datetime.now()` directly — always use `config.get_effective_date()` / `config.get_effective_datetime()` from `backend/app/config.py`.

---

## What Litt Is

Autonomous operational control layer for small law firms. Not a chatbot. Watches the gaps between the firm's tools and surfaces what needs attorney attention before deadlines are missed, invoices rejected, or clients ignored.

Core product ritual: the **Daily Closeout Brief** — structured daily digest of every item needing attorney action. Core value proposition: a **defensible audit trail** behind every operational decision.

---

## Build Order (Critical Path)

Do not skip steps. Each step blocks everything downstream.

1. `backend/app/config.py` — demo clock (`get_effective_date()`) before any business logic
2. `backend/app/models.py` — Pydantic models with `LittBaseModel` (enforces `firm_id`)
3. `backend/app/tools/audit.py` — `log_audit_event()` before any other tool
4. Remaining tool layer in `backend/app/tools/` — state machine tests must pass before agents
5. `backend/app/brief/assembler.py` — brief must populate from seed data before agents are wired
6. `backend/app/agents/` — thin ADK wrappers around deterministic tools
7. `dashboard/` — React frontend
8. Cloud Run deployment — skeleton must exist by end of Day 1; final verification Day 6

Run `pytest tests/test_state_machine.py` and `pytest tests/test_ledes.py` before any agent code.

---

## Architecture

### The Deterministic/Probabilistic Boundary

This is the most important architectural decision. When in doubt:

- **Python (deterministic):** routing, state machine transitions, budget math, scrubber checks, anomaly scoring, date math, LEDES field mapping, deduplication
- **Gemini (probabilistic):** draft generation, escalation brief narrative, deadline extraction from email body, invoice exhibit narrative

If the output must be the same every time given the same input, it is Python. If a human will read and possibly edit the output, it is Gemini.

### Data Flow

```
Ingestion (fixtures/OAuth adapters)
    ↓
Coordinator (Python routing, not LLM routing)
    ↓
Sub-agents: billing_agent · deadline_agent · comms_agent · anomaly_agent
    ↓                ↓                  ↓                  ↓
  tool layer — only write path to Firestore
    ↓
log_audit_event() — called by every tool on every write
    ↓
Brief assembler → GET /api/brief → React dashboard
```

### Agent Architecture

The coordinator is a **router and synthesizer**, not a reasoner. Routing is a Python dict (`SIGNAL_ROUTING` in `coordinator.py`). Gemini synthesizes the final brief narrative. The coordinator never asks Gemini "which sub-agent should handle this?"

Sub-agents follow this pattern:
1. Read Firestore state (deterministic)
2. Run domain detection logic (deterministic Python)
3. Call Gemini only if natural language output is needed
4. Return structured results to coordinator — never write Firestore directly

### Tool Layer

`backend/app/tools/` is the **only write path** to Firestore. Every tool function:
- Checks idempotency key
- Validates `expected_status` (optimistic lock)
- Enforces business rules
- Writes to Firestore
- Calls `log_audit_event()` — no exceptions

Tool functions return `ToolResult` (success) or `ToolError` (structured failure). They never raise exceptions to the caller.

### Firestore Tenancy

Every document in every collection is under `firms/{firm_id}/collection/{id}`. `LittBaseModel` enforces `firm_id` on every record. Never create a collection schema that doesn't extend `LittBaseModel`.

---

## Non-Negotiable Rules

1. **Never write to Firestore from agent code.** Agents → tools → Firestore.
2. **Never call Gemini for deterministic operations.** State machines, budget math, scrubber checks are Python.
3. **Every Firestore write calls `log_audit_event()`.** No exceptions.
4. **`advance_entry_status()` enforces `VALID_TRANSITIONS`.** Invalid transitions return `ToolError`, never raise.
5. **Never call `date.today()` or `datetime.now()`.** Always use `config.get_effective_date()`.
6. **`audit_log` and `deadline_events` are CREATE-only.** Never add update or delete operations.
7. **Every write endpoint accepts `idempotency_key` and `expected_status`.**
8. **Routing is deterministic Python** — `classify_signal()` inspects signal type and returns a `SignalType` enum.
9. **System prompts are context, not logic.** No branching logic, state machine rules, or routing decisions in prompts.
10. **Do not implement v1.1 features.** See `docs/cutline.md`.

---

## Key Files to Read Before Writing Code

| File | Read before... |
|------|----------------|
| `docs/data-contract.md` | Any Firestore/model code |
| `docs/api-contract.md` | Any route or API code |
| `docs/architecture-decisions.md` | Changing any architectural pattern |
| `docs/cutline.md` | Adding any feature |
| `docs/sprint-delta.md` | Planning build order |

---

## Demo Mode

Demo firm: `strand-okafor`. Demo date anchor: `2026-06-25` (frozen — all relative date math uses this).

Five demo conditions must pass `GET /api/demo/ready` before any recording:
- `dl-mercer-001`: HARD_LEGAL deadline 6 days out, unconfirmed
- `te-005`: PENDING entry with "review documents" in narrative (scrubber hit)
- `te-001`: PENDING entry with no narrative (anomaly)
- `acme-commercial`: 78% budget utilization (WARN)
- `whitmore-employment-2026`: 16 days since last client contact (silence trigger)

`POST /api/demo/reset` + `GET /api/demo/ready` before every practice run.

---

## Submission

- GitHub repo: `github.com/emtcmca/litt` (must be public)
- All commits must be after April 22, 2026 (contest rule)
- All agent reasoning uses Gemini 2.5 Pro via Vertex AI (contest rule — not Claude)
- Required submission elements: live Cloud Run URL, demo video (2-min max), architecture diagram (`docs/architecture.png`)
