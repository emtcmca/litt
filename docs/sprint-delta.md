# Litt — Sprint Plan Delta

**Version:** 1.0  
**Purpose:** Documents all changes from the original sprint plan based on GPT critiques and independent review. This is the delta — read alongside `Litt-Sprint-Plan-v1.0.md`.  
**Supersedes:** Original sprint plan Day ordering and task descriptions where conflicts exist.

---

## Critical Changes from Original Sprint Plan

### Change 1: Deploy on Day 1, Not Day 6

**Original plan:** Cloud Run deployment on Day 6.  
**Revised plan:** Deploy a skeleton Cloud Run service on Day 1.

**Why:** Deployment issues (CORS, IAM, Secret Manager config, Cloud Run cold start, Firestore connectivity from container) routinely surface only in the deployed environment. Waiting until Day 6 to discover these means a Day 7 emergency fix window that doesn't exist.

**Day 1 deployment target (skeleton, not full system):**
- Cloud Run backend service — FastAPI with `/health` endpoint returning `{"status": "ok"}`
- Cloud Run dashboard service — React shell with firm name loading from Firestore
- Firestore connection verified from deployed backend
- `GET /api/demo/ready` endpoint returning structured response (not all passing yet — that's fine)
- Live URL confirmed working

Every subsequent feature deploys into this already-running environment. Daily redeploy is fast once the infrastructure is proven.

---

### Change 2: Gmail and Calendar Are Fixtures in v1.0, Not OAuth

**Original plan:** Gmail API + Calendar API OAuth integration in v1.0.  
**Revised plan:** `DemoFixtureGmailSource` and `DemoFixtureCalendarSource` in v1.0. Real OAuth adapters are v1.1.

**Why:** 
- `gmail.readonly` is a restricted OAuth scope. Production Gmail access for third-party apps requires Google OAuth verification and security assessment
- Service accounts cannot access user Gmail without Workspace domain-wide delegation (a separate setup that requires Workspace admin access)
- OAuth consent screen configuration, redirect URIs, and token refresh can eat 1–2 days during a sprint
- The demo doesn't need real Gmail to show the ingestion pipeline — it needs the pipeline to produce correct output from realistic input

**What ships instead:**
- `DemoFixtureGmailSource` returns pre-seeded deadline candidates from `demo_fixtures.py`
- `DemoFixtureCalendarSource` returns pre-seeded calendar events
- Both adapters implement the same interface as the real OAuth adapters (which exist as stubs)
- The repo shows the adapter pattern; the submission notes explain the v1.1 path

**What to say in demo:**
> "Gmail parsing uses seeded fixture data in v1.0. The adapter interface supports drop-in OAuth integration for production."

---

### Change 3: Firestore Event Triggers Are Stubbed

**Original plan:** Firestore event triggers (Cloud Functions) for real-time coordinator invocation.  
**Revised plan:** Triggers are stubbed. `POST /api/sweep` is the only coordinator invocation path.

**Why:** Firestore triggers on a multi-collection write system are prone to recursive invocation chains. A time entry write triggers the coordinator, which writes an escalation, which triggers the coordinator again. Debugging this in a 7-day sprint is a time sink. The demo doesn't need real-time triggers — Cloud Scheduler every 4 hours and the manual sweep endpoint are sufficient.

**What ships instead:**
- `POST /api/sweep` triggers the full coordinator sweep manually
- Cloud Scheduler config file exists in the repo (not activated for demo)
- Architecture diagram shows event-driven as a designed capability
- Submission notes state Firestore triggers are v1.1 production hardening

---

### Change 4: Demo Clock Is a Build Day 1 Requirement

**Original plan:** Not explicitly addressed.  
**Revised plan:** `config.get_effective_date()` and `LITT_DEMO_DATE` env var must be implemented before any business logic.

**Why:** Every date calculation in the system depends on knowing "today." If the code uses `date.today()`, the demo breaks after May 29, 2026. This must be in place from Day 1 — retrofitting it after business logic is written requires touching every file that does date math.

**Implementation:** See `docs/architecture-decisions.md` — Decision 8.

**Day 1 task addition:** Implement `config.py` with `get_effective_date()` and `get_effective_datetime()` before implementing any business logic. Set `LITT_DEMO_DATE=2026-05-29` in `.env`.

---

### Change 5: `firm_id` on Every Record — Day 1

**Original plan:** Multi-tenancy implied but not explicit in schema.  
**Revised plan:** Every Firestore document includes `firm_id`. `LittBaseModel` enforces it. Firestore path structure is `firms/{firm_id}/collection/{id}`.

**Why:** Retrofitting tenancy after 3 days of coding requires touching every model, every query, every route, and every seed script. Adding it to the base model on Day 1 costs 30 minutes and prevents a painful mid-sprint restructure.

**Day 1 task addition:** Implement `LittBaseModel` with `firm_id` as mandatory field before implementing any collection schemas.

---

### Change 6: Ingestion Signal Deduplication — Required Before Any Sweep Logic

**Original plan:** Not specified.  
**Revised plan:** `ingestion_signals` collection with hash-based deduplication must be implemented before any Gmail or Calendar parsing logic.

**Why:** Without deduplication, every sweep run against the same fixture data creates duplicate deadline candidates. Duplicates cascade — duplicate candidates create duplicate escalations, duplicate audit events, duplicate brief items. The demo breaks on the second sweep.

**Day 1 task addition:** Implement `ingestion_signals` Firestore schema. Day 3 task update: implement hash check before creating any deadline candidate.

---

### Change 7: Demo Reset and Readiness Check — Day 1

**Original plan:** Demo reset mentioned but not scheduled until later in the sprint.  
**Revised plan:** `POST /api/demo/reset` and `GET /api/demo/ready` are Day 1 infrastructure, not Day 5.

**Why:** Demo reset is used after every practice run. If it doesn't exist until Day 5, every test of any feature in Days 2–4 corrupts the demo state and has to be manually corrected. Building reset first means every feature test starts from a known clean state.

---

### Change 8: Source-Backed Drafts Via Structured FactPacket

**Original plan:** "Every factual sentence in a draft is sourced" — implementation underspecified.  
**Revised plan:** Comms agent receives a structured `FactPacket` containing pre-extracted facts. Model must cite `fact_id` values. Post-processing validates citations.

**Why:** "Source every sentence" is not achievable via prompting alone. The model will generate sentences the prompt doesn't anticipate. The FactPacket approach constrains the model to only facts that exist in the structured packet, then validates that citations were used.

**Implementation:** See `docs/architecture-decisions.md` — Decision 6.

---

### Change 9: Email Digest Links Are Navigation, Not Action

**Original plan:** "Attorney can clear most items from email without opening the dashboard."  
**Revised plan:** Email digest links navigate to Litt panels. Actions are completed inside the authenticated Litt UI.

**Why:** Executing billing approvals or deadline confirmations from an email link requires CSRF protection, replay prevention, expiring signed tokens, and authorization that cannot be validated from an email client. For a legal product, this is not a shortcut worth taking.

**What this means for the UI:** Deep links open the dashboard with the relevant modal pre-loaded. The attorney completes the action inside Litt.

---

### Change 10: LEDES Missing Fields Added

**Original plan:** LEDES mapping was mostly correct after v0.2 correction but missing two fields.  
**Revised plan:** Added `LINE_ITEM_NUMBER` (sequential, generated at export time) and explicit `CLIENT_MATTER_ID` / `LAW_FIRM_MATTER_ID` distinction.

**`LINE_ITEM_NUMBER`:** Not stored on the time entry. Generated sequentially during `export_ledes()`, starting at 1 per invoice. Required by LEDES 1998B spec.

**`CLIENT_MATTER_ID`:** The client's own billing system reference for the matter. Stored as `matter.client_matter_id`. Separate from the Litt internal matter slug (`matter.id`).

---

### Change 11: Anomaly Scoring Override Rules

**Original plan:** `escalation_score = severity × confidence` only.  
**Revised plan:** Override rules for severity-5 anomalies, HARD_LEGAL + ≤7 days, and POTENTIAL_DUPLICATE.

**Why:** Severity-5 × confidence 0.5 = 2.5, which is below the 3.0 threshold. A malpractice-risk UNCONFIRMED_DEADLINE would not surface in the brief — a serious product failure. Override rules make critical situations always surface regardless of confidence.

**Implementation:** See `docs/architecture-decisions.md` — Decision 4.

---

### Change 12: Prompt Injection Hardening Added

**Original plan:** Not specified.  
**Revised plan:** Gmail extraction system prompt hardcoded to reject instructions. Post-extraction validation for `potential_injection_detected`. Fixture test cases include injection attempts.

**Why:** The ingestion layer processes email bodies from opposing counsel and court notices — untrusted third-party text. A malicious or cleverly formatted email could attempt to manipulate the extraction model. The hardcoded system prompt and validation layer prevent this.

**Implementation:** See `docs/architecture-decisions.md` — Decision 12.

---

### Change 13: Build Order Revised

**Original plan:** Foundation → Tool Layer → Billing Agent → Deadline Agent → Comms + Anomaly → Dashboard → Deploy.  
**Revised plan:** Foundation + Deploy Skeleton → Deterministic Core → Brief Assembler + Thin Coordinator → Dashboard Vertical Slice → Polish → Demo Hardening → Submit.

**Key differences:**
- Deploy happens Day 1 (skeleton), not Day 6
- Brief assembler comes before full agent implementation (Day 3) — ensures the demo surface exists before agents are wired
- Dashboard is a single-page modal pattern, not a multi-view SPA
- Full event-driven architecture is stubbed, not built

---

---

### Change 14: Demo Corpus Expanded — 5 Agent Coverage Gaps Added

**Original plan:** Demo corpus covered 5 required readiness conditions: `dl-mercer-001`, `te-005`, `te-001`, `acme-commercial`, `whitmore-employment-2026`.  
**Revised plan:** Five additional scenarios seeded to demonstrate broader agent capability surface.

**Additions:**
- `te-010` (Acme Commercial) — `client_ai_disclosure_status: None` on an AI-assisted entry, triggering `AI_DISCLOSURE_GAP` anomaly detection
- `te-011` — duplicate of `te-001` (same attorney, matter, date, hours), triggering `DUPLICATE_ENTRY_CANDIDATE` detector
- `acme-commercial` budget — `budget_billed` raised from 11,000 to 13,100; with 700 in approved-unbilled, total committed = 13,800 / 15,000 = **92% CRITICAL** (was 78% WARN)
- `mercer-industries` and `mercer-v-dunlap` — `last_client_contact` moved from 7 days ago to 20 days ago, triggering client silence detection on the firm's highest-pressure matter
- Rivera deadline — `verification_status: conflict_flagged`, seeded `source_emails` document `email-rivera-opp-20260528`, full Gemini extraction pipeline surfacing deadline in brief with source grounding

**Why:** Original corpus was minimal — each detector fired once with no compound signals. Expanded corpus demonstrates multi-signal escalation (Mercer), CRITICAL threshold behavior (Acme), and proof-of-work on Gemini-assisted extraction with full source trail (Rivera).

---

### Change 15: Four v1.1 Features Pulled Into v1.0 Demo

**Original plan:** Source email viewer, Verify action, LEDES download, and audit log page were scoped as v1.1.  
**Revised plan:** All four implemented and shipped in v1.0 before submission.

**Items:**

1. **Source email viewer** — `GET /api/source-email/{email_id}` endpoint; DeadlineModal rewritten to include "View source email" toggle for `conflict_flagged` deadlines; shows full email headers, Gemini extraction confidence badge (0.92), and scrollable body. Demonstrates the evidence chain behind AI-assisted deadline detection.

2. **Verify action wired** — `conflict_flagged` deadlines show "Verify" tab (amber) calling `POST /actions/deadline/verify`, which transitions the deadline to `attorney_verified` via the `verify_deadline` tool. Previously the modal showed tabs but the verify path hit `confirm_deadline` instead. Now the correct state transition fires and is reflected in the audit trail.

3. **Real LEDES 1998B export** — `GET /billing/ledes-export` generates a proper pipe-delimited LEDES 1998B file from all APPROVED/BILLED entries, grouped by client with synthetic pre-bill invoice numbers. `downloadLedesExport()` in `api.ts` fetches and triggers a browser download. "LEDES Export" button in topbar. Previously this endpoint returned a stub string.

4. **Full audit log page** — `/audit` route with dedicated `AuditLog.tsx` page. Backend: `GET /api/audit-log` queries `firms/{firm_id}/audit_log`, normalizes Firestore timestamps, filters by `tier` / `entity_type` / `actor`, returns newest-first up to 300 events. Frontend: sticky topbar with three filter dropdowns, tier legend tiles (clickable as filters), per-event expandable `before_state` / `after_state` JSON, idempotency key display, and append-only provenance notice. "Audit Log" link added to main topbar.

**Why:** These four items directly demonstrate the claims judges will scrutinize: (1) the evidence trail behind AI-assisted detection, (2) that actions produce correct state transitions, (3) that billing data is e-billing compatible, and (4) that the "defensible audit trail" claim is physically inspectable — not just asserted.

---

## Revised Daily Goals

### Day 1 (revised)
1. GCP project, all APIs enabled
2. Firestore security rules (audit_log CREATE-only, etc.)
3. `LittBaseModel` with `firm_id`
4. `config.py` with demo clock
5. `ingestion_signals` schema
6. Seed data script (idempotent)
7. Demo reset endpoint
8. Demo readiness endpoint
9. **Deploy skeleton to Cloud Run — live URL must exist end of Day 1**

### Day 2 (unchanged in substance)
Full tool layer. State machine tests. LEDES tests. Idempotency tests.
Blocker: do not proceed to Day 3 until `advance_entry_status()` and `export_ledes()` pass all tests.

### Day 3 (revised)
Brief assembler first, then ADK coordinator skeleton, then billing and deadline sub-agents.
The brief must populate from seed data before agents are wired.
Gmail/Calendar fixtures (not OAuth). Prompt injection hardening.

### Day 4 (unchanged in substance)
Comms sub-agent with FactPacket draft protocol.
Anomaly sub-agent with override scoring rules.
Full coordinator integration. Manual sweep endpoint working end-to-end.

### Day 5 (revised scope)
Single-page dashboard with modal overlays — not multi-view SPA.
All demo actions achievable in 2–3 clicks from homepage.
Email digest preview page (not live delivery).
Architecture diagram.

### Day 6 (revised)
No new features — hardening and demo rehearsal only.
Cloud Run final deployment verified.
CORS, env vars, Firestore rules all confirmed in deployed environment.
Demo reset confirmed working in deployed system.
Record rough demo. Fix only demo-breaking bugs.

### Day 7 (unchanged)
Reset demo. Run readiness check. Record final video. Submit by 4:30 PM PT.
