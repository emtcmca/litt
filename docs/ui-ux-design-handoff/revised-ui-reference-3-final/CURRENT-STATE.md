# CURRENT STATE — the as-built Console (authoritative)

**Read this before any UI work.** It documents the dashboard **exactly as it exists in the
repo today** (post-overnight backend + scaffolding work), so you build on real files, routes,
tokens, data hooks, and component APIs — not on assumptions. Where the as-built code diverges
from the prototype design (`screens/`), see `DIVERGENCES.md` for the reconcile decisions.

Everything below was read directly from the repo. Line counts/values are current as of this
review; if a file has changed, re-read it — don't trust this over the source.

---

## 0. Stack & how to run it

- **React 19.2** + **react-router-dom 7.16** + **Vite 8** + **Tailwind 4** (`@tailwindcss/vite`).
- TypeScript ~6.0. Tests: Vitest (`npm test`) + Playwright (`npm run test:e2e`).
- **Dev server:** `cd dashboard && npm install && npm run dev` → **http://localhost:3000**
  (`vite.config.ts` pins `server.port = 3000`).
- **API proxy:** `/api` and `/health` proxy to the backend at **http://localhost:8002**. Run the
  backend there or pages that fetch (`/api/brief`, `/api/sweep`, `/api/tools`, …) return errors.
- Build/verify: `npm run build` (`tsc -b && vite build`), `npm run verify` (build + test + e2e).

> The v1.1.3 plan's Playwright `port: 3000` was correct — Vite is configured to 3000, not the
> 5173 default. No port change needed.

---

## 1. Routes (from `src/App.tsx`) — EXACT

Every route except `/email-preview` renders inside `<ConsoleShell>`. There is **no `/brief`
route and no `Overview` page** — `/` renders `DailyCloseoutBrief` directly.

| Path | Element | File |
|---|---|---|
| `/` | `DailyCloseoutBrief` | `components/DailyCloseoutBrief.tsx` |
| `/deadlines` | `Deadlines` | `pages/Deadlines.tsx` |
| `/relationships` | `Relationships` | `pages/Relationships.tsx` |
| `/collect` | `Collect` | `pages/Collect.tsx` |
| `/anomalies` | `Anomalies` | `pages/Anomalies.tsx` |
| `/budgets` | `Budgets` | `pages/Budgets.tsx` |
| `/agents` | `AgentConsole` | `pages/AgentConsole.tsx` |
| `/ledger` | `AuditLedger` | `pages/AuditLedger.tsx` |
| `/policy` | `Policy` | `pages/Policy.tsx` |
| `/integrations` | `Integrations` | `pages/Integrations.tsx` |
| `/audit` | `AuditLog` (legacy, kept for back-compat) | `pages/AuditLog.tsx` |
| `/email-preview` | `EmailPreview` (no shell) | `pages/EmailPreview.tsx` |
| `*` | `NotFound` (inside shell) | `App.tsx` |

`<TimerHUD firmId="strand-okafor" attorneyId="dana-strand" />` is mounted globally outside the
routes. Constants: `FIRM_ID='strand-okafor'`, `ATTORNEY_ID='dana-strand'`.

---

## 2. Shell & Rail (from `components/console/ConsoleShell.tsx`, `ConsoleRail.tsx`) — EXACT

**`ConsoleShell`**: column flex, full-viewport. Renders a **`<DemoBanner>`** at top
(`DEMO_DATE = '2026-06-25'`, firm "Strand & Okafor LLP"), then `<ConsoleRail>` + `<main>`.
`main` is `overflowY:auto; background: var(--color-background-tertiary)` (#F1EFE8). Accepts an
optional `badges?: Record<string, number>` prop passed to the rail.

**`ConsoleRail`** (width **220px**, `background: #111C19`):
- Logo block: lowercase **"litt"** in `#9FE1CB` (mint), 14px/700; sub "Strand & Okafor" mono
  10px mint-45%. (No "Litt." brass wordmark, no dot.)
- Four nav sections, each with a mono uppercase 9px label in teal-45%:

| Section | Items (label → path, icon glyph) |
|---|---|
| **Watch** | Brief → `/` `◈` · Deadlines → `/deadlines` `⊙` · Relationships → `/relationships` `↔` |
| **Collect** | Billing → `/collect` `▤` · Anomalies → `/anomalies` `◎` · Budgets → `/budgets` `▦` |
| **Prove** | Agents → `/agents` `⬡` · Audit Ledger → `/ledger` `⊞` |
| **Tune** | Policy → `/policy` `⊛` · Integrations → `/integrations` `⊕` |

- **Icons are Unicode glyphs**, not an SVG icon set.
- **Active item** = left-border `#5DCAA5` + background `rgba(93,202,165,.10)` + color `#9FE1CB`,
  weight 600. (Mint/teal — **not** a brass pill.) Rest color `rgba(255,255,255,.55)`.
- Badge: optional per item from `badges` prop (mint pill, `#5DCAA5` bg / `#04342C` text). Keys
  used: `deadlines`, `relationships`, `anomalies`.
- Bottom: a single user chip — "DS" mint avatar + "Dana Strand" / "attorney". **No dropdown, no
  multi-user switch, no system-status block.**

---

## 3. Design tokens (from `src/index.css`) — EXACT, and what's NOT there

The token set is the **original repo ramp** — IBM Plex Sans/Mono, background/text/border roles,
and blue/teal/amber/red/gray ramps. **No `forest`/`brass`/`gold`/`canvas` brand tokens were
added.** The built Console expresses "Litt dark" with:
- Rail bg `#111C19`, Agent-graph bg `#14221F` (hard-coded in components, not tokens).
- Accents: teal/mint — `--color-ramp-teal-400 #1D9E75`, `-teal-200 #5DCAA5`, `-teal-100 #9FE1CB`,
  `--color-audit-surface #11110F`, `--color-audit-success #5DCAA5`.
- Gold `#A98435` appears **only** as the hard-coded hand-off edge/handoff-card color in the
  Agent console (not a token).
- `--color-action-primary` is **blue `#185FA5`** (unused by the Console surfaces so far).

Spacing tokens `--spacing-*`, radii `--border-radius-md/lg/xl` (8/12/16), and these animations
exist: `litt-flash-in`, `litt-obs-drip`, `litt-rail-pulse`, `spin`. Responsive breakpoints at
1180px and 860px target the `DailyCloseoutBrief` layout classes (`litt-body-grid`, etc.).

> **Consequence:** the prototype's forest/brass aesthetic is **not** what's implemented. If the
> design target is forest/brass, that's a palette migration (see `DIVERGENCES.md` §1). If the
> team intends to keep teal/mint, the prototype screenshots are stale as a *color* reference
> (layout still applies). **This needs a product decision before pixel work.**

---

## 4. Data layer (from `src/api.ts` + `src/types.ts`) — EXACT

All fetches go through `src/api.ts` (`BASE = "/api"`). Functions that exist:

**Brief/sweep:** `getBrief(firmId, attorneyId)` → `BriefResponse`; `runSweep(firmId)` →
`SweepRunResponse` (`{ timeline: AgentRunTimeline, brief: BriefResponse }`).
**Deadlines:** `confirmDeadline`, `verifyDeadline`, `extendDeadline`, `dismissDeadline`,
`getDeadlinesFull(firmId)` → `RawDeadline[]` (the full-book read), `getSourceEmail`.
**Billing:** `approveBilling`, `writeDownBilling`, `writeOffBilling`, `updateNarrative`,
`getScrubber`, `downloadLedesExport`.
**Comms:** `approveComm`, `queueComm`, `dismissComm`.
**Budgets/Relationships/Inbound:** `getBudgets` → `BudgetUtilizationItem[]`;
`getRelationships` → `RelationshipMatter[]`; `getInbound` → `InboundMessage[]`;
`snoozeInbound`, `dismissInbound`.
**Alerts/Timer/Demo:** `dismissAlert`; `getMatters`, `normalizeNarrative`, `captureTimerEntry`;
`getDemoReady`, `resetDemo`. **Audit:** `getAuditLog(firmId, {tier,entityType,actor,limit})`.

**Types that EXIST** (`types.ts`): `BriefResponse` + sections (`deadlines`, `time_entries`,
`budget_risks`, `client_silence`, `anomalies`, **`compound_escalations`**, **`inbox_items`**);
`BriefInboundItem` (brief inbox) **and** the richer standalone `InboundMessage`
(`urgency_signals[]`, `action_items: InboundActionItem[]` with `handoff_agent`,
`suggested_reply_body`, `cross_agent`); `RawDeadline`, `BudgetUtilizationItem`,
`RelationshipMatter`; `AgentObservation` / `AgentRunTimeline`; `ObservationType` (**12** values
incl. `ROUTE_HANDOFF`, `INBOX_TRIAGE`, `MATTER_SYNTHESIS`, `COMPOUND_RISK`, `WARN_NOTICE`);
`CommitmentLevel` (4); `AuditLogEvent`; request types for every action.

**Types that DO NOT exist yet** (so the matching UI has no data contract):
- **No `Commitment` type, no `getCommitments`/`markCommitment` API.** The prototype's
  "Commitments you've made" lifecycle tracker has **no backend** — do not assume it renders.
- **No `FirmPolicy`/`AttorneyPolicyOverride` type, no policy GET/SET API.** `Policy.tsx` is
  UI/local-state only.
- No `GET /api/deadlines` full-book is `RawDeadline` (note: **not** the brief's `BriefDeadlineItem`
  shape — fewer fields: `id`, `status`, `verification_status`, `due_date`, `description`,
  `classification`, `matter_id`, `client_id?`, `days_out`, `escalation_level`, `email_reference?`).

---

## 5. Per-page map (route → file → data hook → design target)

Page **bodies** are as-built; verify their current fidelity live (`RUN-THE-PROTOTYPE.md`) against
the target screenshot. Data hooks below are from `api.ts`/imports.

| Route | File | Primary data | Design target (screens/) |
|---|---|---|---|
| `/` | `DailyCloseoutBrief.tsx` | `getBrief` | `18-brief.png` *(redesign; see DIVERGENCES §6)* |
| `/deadlines` | `pages/Deadlines.tsx` | `getDeadlinesFull` → `RawDeadline[]` | `02`,`03` |
| `/relationships` | `pages/Relationships.tsx` | `getRelationships`, `getInbound` (+ `InboundCard`) | `08`,`09`,`10` |
| `/collect` | `pages/Collect.tsx` | `getBrief` billing + `getScrubber` + billing actions | `04` |
| `/anomalies` | `pages/Anomalies.tsx` | `getBrief` anomalies + `dismissAlert` | `12` |
| `/budgets` | `pages/Budgets.tsx` | `getBudgets` → `BudgetUtilizationItem[]` | `11` |
| `/agents` | `pages/AgentConsole.tsx` (+ console/*) | `runSweep`, `GET /api/tools` | `14`–`17` |
| `/ledger` | `pages/AuditLedger.tsx` | `getAuditLog` | `05` |
| `/policy` | `pages/Policy.tsx` | local state (no API) | `06`,`07` |
| `/integrations` | `pages/Integrations.tsx` | static/local | `13` |

Supporting components that already exist: `components/InboundCard.tsx`,
`components/CompoundEscalationCard.tsx`, `components/shared/{GeminiLabel,WarnNotice}.tsx`,
`components/shared/AuditEventDrawer.tsx`, modals under `components/modals/`.

---

## 6. Agent Console internals (the highest-divergence surface) — EXACT

Files: `pages/AgentConsole.tsx`, `components/console/{AgentGraph,Inspector,SweepControls,ToolChip}.tsx`.

- **Data:** `runSweep()` → `timeline.observations: AgentObservation[]`. Tool catalog from
  `GET /api/tools` → `ToolEntry[]`. It consumes the **real observation shape**
  (`observation_type`, `commitment_level`, `work_kind`, `data`, …) — **not** the prototype
  `SWEEP` `{agent,type,commit,work,tool}` shape. Any fixture must use the real shape.
- **Per-observation tool payload:** `obs.data.tool = { name, kind, signature?, result? }` (read
  by `Inspector`'s `ToolCallCard`). **Distinct** from the registry catalog entry (`ToolEntry`:
  `name, agent, kind, description, write_collection, audit_tier, tags`).
- **Hand-off:** `obs.data.handoff = { from, to, entity_id?, reason? }` on `ROUTE_HANDOFF`.
- **`AgentGraph`** is a fixed **760×480** absolute layout with an SVG edge overlay:
  - Signal nodes: `gmail(80,50)`, `calendar(230,50)`, `matter(390,50)`, `billing(560,50)`.
  - `coordinator(320,170)`. Agents: `deadline_agent(60,295)` sources `[calendar,matter]`,
    `billing_agent(225,295)` `[billing]`, `comms_agent(420,295)` `[matter,gmail]`,
    `anomaly_agent(595,295)` `[billing,matter]`. Outputs: `audit(200,420)`, `brief(460,420)`.
  - Nodes are small mono-label chips (not rich cards; **no PYTHON/GEMINI badge, no description,
    no "N handled" footer, no Plain/Technical toggle**).
  - Colors: active `#5DCAA5`, selected `#1D9E75`, rest `#253832`; text mint. Hand-off edge gold
    `#A98435` dashed; Gmail↔Comms teal dashed; bottom-right legend "handoff · inbox channel".
  - **Idle heartbeat: 900ms**, cycling **7 nodes** `[coordinator, 4 agents, audit, brief]`
    (only when `observations.length === 0`). Source nodes light only on `SIGNAL_RECEIVED`.
  - **Playback: `PLAYBACK_STEP_MS = 220`** (in `AgentConsole.tsx`), auto-advances after a run.
- **Header:** eyebrow "Agents" + h1 **"Agent Console"** (20px/700) + `<SweepControls>` (Run /
  Replay / scrub / elapsed). After a run, a **stats strip**: Observations / Escalations / Brief
  items / Triggered by. (Not the prototype's "17/20 deterministic" headline.)
- **`Inspector`** (320px right column): tabs **Log** / **Tools**. Log shows a `BoundaryStat`
  (deterministic vs **Gemini** counts, computed from `obs.data.tool.kind === 'gemini'` over
  `TOOL_CALL`s) + selected-step detail (`ToolCallCard` / `HandoffCard`) + reverse-chron
  observation list. Tools shows the registry grouped by agent (or filtered to the selected
  agent node).

---

## 7. Tool registry (from `backend/app/tools/registry.py`) — EXACT

`GET /api/tools` returns `TOOL_REGISTRY` values as dicts. `ToolKind` = **`read` | `write` |
`compute` | `gemini`** (4 — note **no `route`/`gate` kinds**, unlike my earlier handoff doc).
Each `ToolSpec`: `name, agent, kind, description, write_collection, audit_tier, tags`.
Registered tools by agent: `anomaly_agent` (log_anomaly), `coordinator` (log_escalation),
`billing_agent` (advance_entry_status, write_time_entry, write_down_entry, write_off_entry,
update_entry_narrative, compute_budget_utilization, check_invoice_readiness, generate_invoice),
`deadline_agent` (log_deadline_event, verify_deadline, confirm_deadline, supersede_deadline),
`comms_agent` (create_client_comm, approve_client_comm_draft, queue_client_comm_for_delivery,
log_client_comm_sent, **create_inbound_message, snooze_inbound, dismiss_inbound**).

> The **catalog** (`ToolEntry`) and the **per-step tool payload** (`obs.data.tool` with
> `signature`/`result`) are two different shapes. The catalog has no `signature`; the live
> observation provides it. Don't conflate them.

---

## 8. Backend surface that exists (relevant to UI)

`backend/app/tools/`: `inbound.py`, `registry.py` (both new), plus billing/comms/deadlines/
alerts/audit/validation. `backend/app/demo/` (new): `fixtures_v11.py`, `seeder.py`. Demo
endpoints `GET /api/demo/ready`, `POST /api/demo/reset`, `GET /api/demo/state`. The brief
assembler returns the 7 sections in `BriefSections` (incl. `compound_escalations`, `inbox_items`).
**Confirm the exact demo numbers in `backend/app/demo/fixtures_v11.py`** before asserting any
count in the UI (the demo date is `2026-06-25` per `ConsoleShell`).

---

## 9. What this means for the build

- Build **on these files** — import the existing pages/components, use the listed `api.ts`
  functions and `types.ts` shapes, run on `:3000` with the backend on `:8002`.
- Treat `screens/` + `prototype-source/` as the **design target**; treat this doc as the
  **current state**. `DIVERGENCES.md` is the gap list between them, with the decisions to make.
- Two things have **no backend** (commitments, policy persistence) — UI for them is local-only
  until the contracts exist. Don't wire them to nonexistent endpoints.
