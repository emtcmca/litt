# Litt Console UI — Build Plan v1.1.2

**Status:** Stub — ready for elaboration after v1.1.1 gates pass  
**Authored:** 2026-06-06  
**Predecessor:** `docs/agent-respec-build-plan-v1.1.1.md`  
**Design source:** `docs/ui-ux-design-handoff/` (Omelette prototype + all spec docs)  
**Full architecture map:** `docs/ui-ux-design-handoff/01-architecture-map.md`  
**Full build sequence:** `docs/ui-ux-design-handoff/06-build-sequence.md`

---

## Dependency

**v1.1.1 must be gate-complete before v1.1.2 starts.** Specifically:

- `ObservationType.ROUTE_HANDOFF` must exist (G0-03) — Agent graph draws hand-off edges
- `data.tool` sub-shape on `TOOL_CALL` observations (Phase 4/5 work) — Agent graph renders tool chips
- `TOOL_REGISTRY` + `GET /api/tools` (G0-07) — catalog and boundary stat
- `GET /api/inbound` (G0-08) — Relationships "Awaiting your response" section
- `GET /api/deadlines` full book (G0-09) — Deadlines hero full book view
- `InboundMessage` records in Firestore (G0-04) — Relationships page data
- `work_kind="route"` in `AgentRunTimeline.tsx` — graph already handles this before shell lands

---

## What This Sprint Builds

A new **Console shell** wrapping and extending the existing dashboard. The existing brief, audit log, and Timer HUD are reorganized into a four-section left-rail navigation. Net-new features: Agent console graph, Deadlines hero, Collect hero, Relationships page, and stub pages for Budgets / Anomalies / Policy / Integrations.

**Nothing in the existing dashboard is thrown away.** It is reorganized and extended.

---

## What Does NOT Change

All v1.0 + v1.1.1 non-negotiables hold:

- Agents never write Firestore
- Every write calls `log_audit_event()`
- Human gate is real — "Litt never sends" — all reply/draft cards map to existing comms state-machine transitions
- `work_kind` honesty — the boundary stat reads directly from observations; mislabeling breaks the headline UI
- Demo clock only — all "days out / days silent / X ago" values computed server-side from `config.get_effective_date()`

---

## Design Source of Truth

For visual look and behavior: **the Omelette prototype** (`Litt - Console.html` + `console-*.jsx`).  
For architecture: **`CLAUDE.md`** + `docs/`.  
When they conflict: architecture wins.

Reference screenshots: `docs/ui-ux-design-handoff/ui-mock-screenshots/`

---

## Design Token Crosswalk

Do not introduce a third color system. The prototype uses a `T.*` palette. Map it to existing `dashboard/src/index.css` CSS vars.

| Prototype `T.*` | Repo CSS var |
|---|---|
| `T.forest` (deep green) | `--color-text-brand` / dark green ramp; button backgrounds |
| `T.brass` / `T.gold` | `--color-ramp-amber-*` |
| `T.teal` | `--color-ramp-teal-*` |
| `T.danger` | `--color-ramp-red-*` / `--color-text-danger` |
| `T.ink` / `T.muted` / `T.faint` | `--color-text-primary` / `-secondary` / `-tertiary` |
| `T.surface` / `T.wash2` / `T.line` | `--color-background-primary|secondary` / `--color-border-tertiary` |
| `T.audit` + `T.auditAccent` | dark surface token + teal accent (Agent console, ledger) |

Reuse existing gate badge colors from `AgentRunTimeline.tsx` (`GATE_SPEC`) and work_kind chips (`WORK_KIND_SPEC`). Add `route` → brass to `WORK_KIND_SPEC`.

Typography: IBM Plex Sans (UI) + IBM Plex Mono (`--font-mono`). Already in repo.

---

## Phase 0 — Shell + Routing + Token Crosswalk

*Unblocks all frontend surface work. No new data needed.*

**New files:**
- `dashboard/src/components/console/ConsoleShell.tsx` — grid: left rail + scrollable content area
- `dashboard/src/components/console/ConsoleRail.tsx` — four sections (Watch / Collect / Prove / Tune) + items; **Prove above Tune** (reordered from some prototypes); active state; user chip at bottom

**Route restructure** (React Router, already in repo):

```
/                 Overview — existing DailyCloseoutBrief, reframed
/deadlines        Deadlines hero
/collect          Collect / billing hero
/relationships    Clients & comms (inbound + going quiet; commitments added v1.2)
/budgets          Budgets (stub → real in this sprint)
/anomalies        Anomalies (stub → real in this sprint)
/agents           Agent console graph
/ledger           Audit ledger (alias existing /audit)
/policy           Policy & autonomy (stub until v1.2 backend lands)
/integrations     Integrations (presentational stub)
```

Keep `/email-preview` and `TimerHUD` mount. Preserve deep-link routes.

**Gate:** shell renders all surfaces (some empty stubs); existing Brief, AuditLog, TimerHUD still work; `tsc --noEmit` green.

---

## Phase 1 — Surfaces Over Existing Data

*Thin read endpoints + prototype UI. Writes already exist. No new entities.*

**New read endpoints** (if not already added in v1.1.1):
- `GET /api/budgets?firm_id` — per-matter/client utilization list (reuse `compute_budget_utilization()`)
- `GET /api/relationships?firm_id` — matters with `days_since_contact` and `last_client_contact` (extend brief or new endpoint)

**New pages:**

| Route | Prototype file | Target | Existing data source |
|---|---|---|---|
| `/deadlines` | `console-deadlines.jsx` | `pages/Deadlines.tsx` | `GET /api/deadlines` (v1.1.1 G0-09) |
| `/collect` | `console-collect.jsx` | `pages/Collect.tsx` | existing billing/scrubber data |
| `/budgets` | `console-stubs.jsx` | `pages/Budgets.tsx` | `GET /api/budgets` |
| `/anomalies` | `console-stubs.jsx` | `pages/Anomalies.tsx` | existing `BriefAnomalyItem` |
| `/integrations` | `console-stubs.jsx` | `pages/Integrations.tsx` | presentational only |
| `/ledger` | `console-record.jsx` | `pages/AuditLedger.tsx` | existing `GET /api/audit-log` |
| `/` | `console-brief.jsx` | extend `DailyCloseoutBrief.tsx` | existing + inbound/commitment counts |

**Deadlines hero components:**
- `DeadlineTimeline` — 45-day horizon, class-colored pins, SOFT_INTERNAL rows (v1.2 commitments)
- `CadenceLadder` — 14·7·3·1 ladder showing HARD_LEGAL items per window
- `DeadlineBook` — filterable table (All / Needs confirmation / Court·legal / Owned by you)

**Collect hero:** new layout over existing `BillingWIPModal` bits, LEDES export, scrubber data.

**Audit Ledger upgrade:**
- `LedgerStatStrip` — events today / legal-record count / your-decisions vs Litt
- `LedgerFilters` — tier + actor filters
- `LedgerRow` — expand → before/after diffs (reuse `AuditEventDrawer.tsx`)
- JSON export — client-side `Blob` from fetched events

**Gate:** every surface shows real demo firm data; no stubs for Deadlines / Collect / Budgets / Anomalies / Ledger; `tsc --noEmit` green; screenshot verification.

---

## Phase 2 — Agent Console Graph

*Biggest net-new frontend piece. Depends on enriched TOOL_CALL observations (v1.1.1) and ROUTE_HANDOFF.*

**New files:**
- `pages/AgentConsole.tsx`
- `components/console/AgentGraph.tsx`
- `components/console/ToolChip.tsx`
- `components/console/Inspector.tsx`
- `components/console/SweepControls.tsx`

**AgentGraph** — node layout matching prototype:

```
Signals in (Gmail, Calendar, Matter store, Time & billing)
    ↓
Coordinator (central node)
    ↓ (edges to each sub-agent)
Deadline Monitor · Billing Reconciliation · Client Comms · Anomaly Escalation
    ↓
On the record (Audit log node, Your Brief node)
```

Visual behaviors:
- **Live flow animation** — edge pulses during sweep playback
- **Idle heartbeat** — soft highlight cycles through each agent when no sweep running (always-watching ambience)
- **Source-mapping** — on an agent's read step, light only its input source nodes (deadline_agent lights Calendar + Matter store; billing_agent lights Time & billing; comms_agent lights Matter store + Gmail)
- **Hand-off edges** — gold dashed lines for `ROUTE_HANDOFF` observations (comms → deadline, comms → billing)
- **Two-way inbox channel** — teal dashed Gmail ↔ Comms edge with legend
- **Gate/work_kind styling** — reuse existing `GATE_SPEC` / `WORK_KIND_SPEC` color mappings

**ToolChip** — live chip renders under a firing node naming the tool call from `data.tool.name`. Kind badge from `data.tool.kind`.

**Inspector** (right panel, context-sensitive):
- Default: `AgentRunTimeline` (existing vertical log, promoted to "log" tab)
- On node select: "Tools it can call" list (filter `TOOL_REGISTRY` by `spec.agent`)
- On step select: TOOL CALL card (`name`, `kind`, `signature`, `result`) or Cross-agent hand-off card (`from`, `to`, `entity_id`, `reason`)
- On Tool layer node: full catalog grouped by agent with per-kind counts; **boundary stat** ("N deterministic · K Gemini") computed from `data.tool.kind !== "gemini"` across the run

**SweepControls** — Run / Replay / step scrubber (drives playback index into `timeline.observations`).

**Gate:** boundary stat matches run; hand-off edges draw; inspector renders TOOL CALL + cross-agent hand-off cards; idle heartbeat runs when no sweep; `tsc --noEmit` green; screenshot.

---

## Phase 3 — Relationships Page (Inbound + Going Quiet)

*Depends on `GET /api/inbound` (v1.1.1 G0-08) and `InboundMessage` seed data (v1.1.1 G0-04).*

**New page:** `pages/Relationships.tsx`

**Page order (match prototype):**
1. Summary strip (Awaiting your response / Going quiet / Warm counts)
2. "Awaiting your response" — `InboundCard` list
3. "Going quiet" — existing silence detection (`BriefClientSilenceItem`)
4. Relationship board — all matters with `days_since_contact` vs threshold
5. Recent communications log (existing `ClientCommunication` records by status)
6. "How Litt handles your comms" dark card (Read → Draft → Hold)

**InboundCard (collapsed + expanded):**
- Collapsed: `from_name`, urgency badge, `urgency_signals` chips, truncated `summary`, action count
- Expanded: full `summary`, `action_items` list (each with `→ Deadline Monitor` cross-link if `handoff_agent` set), source-grounded suggested reply (shows `draft_body_clean`), Approve & send / Edit / Snooze / Dismiss actions
- "Approve & send" routes to existing `POST /api/actions/comms/approve` → `queue` → `confirm-sent` chain
- Snooze → `POST /api/actions/inbound/snooze`; Dismiss → `POST /api/actions/inbound/dismiss` (reason required)

*Note: CommitmentTracker (StageRail, CommitmentCard, "Commitments you've made" section) is v1.2 — requires `Commitment` backend.*

**Gate:** Relationships page renders demo inbound cards + going-quiet section; Mercer card matches prototype (collapsed and expanded); approving reply walks comms state machine + audit events; `tsc --noEmit` green; screenshot.

---

## Phase 4 — Polish + Demo Hardening

- Wire email digest deep-links to Console routes (`/ledger`, `/deadlines`, `/relationships`)
- Extend `GET /api/demo/ready` with Console conditions: ≥3 inbound messages, policy doc present (stub)
- Update `seed_demo.py` + `reset_demo.py` so `POST /api/demo/reset` restores full Console state
- `tsc --noEmit` + `pytest` green
- Screenshot every surface
- Verify boundary stat, hand-off edges, and all date math against frozen demo date

---

## What Is NOT Built in v1.1.2

All of v1.2 (see `docs/agent-respec-build-plan-v1.1.1.md` → v1.2 Scope Items):

- `Commitment` capture + lifecycle (CommitmentStatus model, commitment_extractor.py, tools/commitments.py, CommitmentTracker UI, StageRail, Mark kept/Slipped)
- `FirmPolicy` + `AttorneyPolicyOverride` backend + enforcement — Policy page remains a stub until this lands
- Gmail OAuth live inbox
- Gemini sent-mail attorney voice analysis

---

## Component List (net-new)

**Shell:**
`ConsoleShell`, `ConsoleRail`

**Agent console:**
`AgentGraph`, `ToolChip`, `Inspector`, `SweepControls`

**Relationships:**
`InboundCard` (collapsed + expanded), `RelationshipBoard`, `CommsLog`

**Deadlines:**
`DeadlineTimeline`, `CadenceLadder`, `DeadlineBook`

**Ledger:**
`LedgerRow`, `LedgerFilters`, `LedgerStatStrip`

**Budgets / Anomalies / Integrations:**
`BudgetBar`, `DetectorRoster`, `IntegrationCard`

**Shared:**
`Mono` (mono label), `SubHead`, `StatStrip`

Reuse existing: `GateBadge`, `WorkKindChip`, `AuditEventDrawer`, `AgentRunTimeline` (as log tab), `TimerHUD`, `DemoBanner`.

---

## Prototype → Target File Map

| Prototype file | Target |
|---|---|
| `Litt - Console.html` | `App.tsx` routes + `ConsoleShell.tsx` + `index.css` keyframes |
| `console-shell.jsx` | `ConsoleShell.tsx`, `ConsoleRail.tsx` |
| `console-brief.jsx` | extend `DailyCloseoutBrief.tsx` |
| `console-deadlines.jsx` | `pages/Deadlines.tsx` |
| `console-collect.jsx` | `pages/Collect.tsx` |
| `console-agents.jsx` | `pages/AgentConsole.tsx` + graph components |
| `console-record.jsx` | `pages/AuditLedger.tsx` |
| `console-policy.jsx` | `pages/Policy.tsx` (stub until v1.2 backend) |
| `console-clients.jsx` | `pages/Relationships.tsx` (inbound + going quiet; commitments v1.2) |
| `console-stubs.jsx` | `pages/Budgets.tsx`, `Anomalies.tsx`, `Integrations.tsx` |
| `console-data.js` | **delete** — replaced by `api.ts` + real endpoints |

---

## Risk Notes

- **Demo clock everywhere.** Every new `days_out` / `wait_days` / `days_silent` must use `config.get_effective_date()`. Most likely bug class.
- **Don't fork models.** Extend `models.py` + mirror `types.ts`. The repo enforces parity.
- **`work_kind` honesty.** Boundary stat is load-bearing. Only Gemini summarize/draft/extract are `llm_assisted`.
- **Reuse the comms state machine** for inbound replies — no second send path in the inbound layer.
- **Keep `pytest` green at every phase.** The existing suites guard invariants the Console relies on.
- **`tsc --noEmit` after every phase.** TypeScript errors compound across a large component tree.
