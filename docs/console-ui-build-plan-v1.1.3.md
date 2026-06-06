# Console UI Build Plan — v1.1.3
**Full UI Overhaul: Pixel-Faithful Prototype Translation**

- **Status:** In progress — Phase 11 complete, Phase 12 next
- **Preceded by:** v1.1.2 (Console UI Phase 1–4, now superseded)
- **Prototype source:** `docs/ui-ux-design-handoff/ui/final-ui-reference/litt-handoff/ui-reference/`
- **Submission deadline:** June 5, 2026 — this build must complete before demo recording

---

## Why v1.1.3

The v1.1.2 build interpreted prose specs and produced a UI that diverged from the actual design. The fix is not iteration — it is a full rebuild from the real prototype source.

The `ui-reference/` package contains:
- **`prototype-source/`** — the exact React (via Babel) files that rendered the design
- **`screens/`** — rendered PNGs at 1440px, the visual acceptance target for every page
- **`design-system.md`** — authoritative token crosswalk and shared atom specs
- **`_pages.md`** — page-by-page build notes
- **`README.md`** — the method

This plan is a faithful translation of those files into the repo's typed React. Every measurement, color, gap, font-size, border-radius, and copy string from the prototype source is non-negotiable. The styling mechanism (inline styles vs. CSS modules) is flexible. The values are not.

> **Before any phase, read these two documents in the reference folder:**
> - `CURRENT-STATE.md` — exact as-built routes, components, tokens, API functions, and types as they exist in the repo today. Build on real files; don't assume.
> - `DIVERGENCES.md` — enumerated gaps between the as-built code and the design target, with reconcile decisions. The palette choice (`forest/brass`, matching the prototype) is documented there as the governing decision for all pixel work.
> - `RUN-THE-PROTOTYPE.md` — how to serve the prototype locally + side-by-side comparison workflow. See **Prototype Inspection** section below.

---

## Pass/Fail Gates

UI rebuild gates are three-part per phase. All three must pass before committing and moving on.

**Gate 1 — Structural (automated):**
```
cd dashboard && npx tsc --noEmit
```
Zero TypeScript errors. No unused variables. No broken imports.

**Gate 2 — Screenshot diff (automated):**
```
cd dashboard && npx playwright test tests/visual/
```
Playwright navigates to the route, intercepts all `/api/*` calls with fixture responses, takes a full-page screenshot at 1440×900, and compares against the stored baseline. Test passes if pixel difference is within the configured threshold (`0.1` = 10%). Diff images are written to `tests/visual/diff/` on failure so you can see exactly what diverged.

**Gate 3 — Human visual review:**
On first run (or after intentional design changes), open the page in the browser and place it side-by-side with the corresponding `screens/XX-screen.png`. Confirm the layout matches. If it does, run `npx playwright test --update-snapshots` to update the stored baseline. If it does not, the screenshot is right and the build is wrong — iterate.

**Baseline management:**
- Baselines live in `dashboard/tests/visual/snapshots/`
- The prototype `screens/` PNGs are the human reference, not the automated baseline (font rendering differs between the prototype browser and the test runner)
- First approved build for each page sets the automated baseline via `--update-snapshots`
- Baseline updates are committed alongside the code changes that caused them

---

## Page Directory (Target State)

| Route | Page | File | Nav Group |
|---|---|---|---|
| `/` | Overview | `pages/Overview.tsx` | *(ungrouped top)* |
| `/brief` | Brief | `pages/Brief.tsx` *(new — port `console-brief.jsx`)* | *(ungrouped top)* |
| `/deadlines` | Deadlines | `pages/Deadlines.tsx` | Watch |
| `/budgets` | Budgets | `pages/Budgets.tsx` | Watch |
| `/relationships` | Clients & comms | `pages/Relationships.tsx` | Watch |
| `/anomalies` | Anomalies | `pages/Anomalies.tsx` | Watch |
| `/collect` | Billing & WIP | `pages/Collect.tsx` | Collect |
| `/agents` | Agent console | `pages/AgentConsole.tsx` | Prove |
| `/ledger` | Audit ledger | `pages/AuditLedger.tsx` | Prove |
| `/policy` | Policy & autonomy | `pages/Policy.tsx` | Tune |
| `/integrations` | Integrations | `pages/Integrations.tsx` | Tune |
| `/audit` | *(legacy `AuditLog` — unchanged)* | `pages/AuditLog.tsx` | backward-compat |
| `/email-preview` | Email preview | `pages/EmailPreview.tsx` | no shell |

**Key distinctions:**
- **Console** = the product shell (rail + content area). Not a page — a wrapper.
- **Overview** (`/`) = the main landing page. What a user sees after login.
- **Brief** (`/brief`) = the Daily Closeout Brief. The platform centerpiece. Reached from Overview via "Open the Brief."
- **Agent console** (`/agents`) = one page within the console. Shows agent architecture + live sweep.

---

## What Stays, What Gets Rebuilt

**Stays (no changes):**
- React 19 + TypeScript + Vite 8 + React Router v7 (React Router dom)
- Backend Python — no backend changes in this plan
- `api.ts` existing functions (additions only — see below)
- `types.ts` existing types (additions only)
- `AgentRunTimeline.tsx` (repurposed as the "Log" tab in Agent console inspector)
- Dev server port **3000** (`vite.config.ts` pins this; backend proxied at **8002**)
- Existing pages that already exist and just need restyling (not full rewrites): `Deadlines.tsx`, `Budgets.tsx`, `Relationships.tsx`, `Collect.tsx`, `Anomalies.tsx`, `AgentConsole.tsx`, `AuditLedger.tsx`, `Policy.tsx`, `Integrations.tsx`

> **Already-wired API functions (real endpoints, use directly — no fixture fallback needed):**
> `getDeadlinesFull`, `getBudgets`, `getRelationships`, `getInbound`, `snoozeInbound`, `dismissInbound`,
> `getAuditLog`, `getBrief`, `runSweep`, `confirmDeadline`, `approveBilling`, `approveComm`, etc.
> See `CURRENT-STATE.md §4` for the full list.

> **No backend yet (UI-only / local state):** `Commitment` lifecycle (no type, no API); `FirmPolicy`/`AttorneyPolicyOverride` (no policy GET/SET API). Do not wire these to nonexistent endpoints.

> **Note on demo-fixtures:** Phase 0f creates JSON fixtures used by Playwright tests for deterministic mocking. The **app itself** uses real API functions where they exist. Fixtures shape for Playwright must match the real API response shapes, not the prototype's internal fixture format.

**Rebuilt from scratch:**
- `index.css` — 8 new brand tokens added
- `ConsoleShell.tsx` + `ConsoleRail.tsx` — rebuilt to match prototype exactly
- All 11 page components (including new `pages/Brief.tsx` — `DailyCloseoutBrief.tsx` layout is replaced)
- All existing console component files under `components/console/`
- New shared atom library in `components/ui/`
- New `demo-fixtures/` data layer (9 JSON files + `index.ts`)

**Removed:**
- `DemoBanner` from `ConsoleShell` — a full-width banner at the top of every page breaks the design. The demo date is surfaced in two purpose-built places instead (see Phase 1 rail system-status block and Phase 2 Overview eyebrow). A2 reversed.
- `DailyCloseoutBrief.tsx` layout (the new `pages/Brief.tsx` ports `console-brief.jsx` directly; existing brief action logic is preserved where it provides real data wiring)

---

## Phase 0 — Design System Foundation

**Build before anything else.** Every subsequent phase imports these atoms and tokens. Getting one value wrong here propagates to every page.

### 0a. Add brand tokens to `dashboard/src/index.css`

The prototype palette (`T.*` in `litt-flows.jsx`) was built to mirror `index.css`. Neutrals and teal are already present. Add the missing brand colors:

```css
:root {
  --color-background-canvas: #FBFAF6;       /* Console content area bg */
  --color-border-soft:       rgba(20,20,18,0.07); /* inner row dividers */
  --color-brand-forest:      #14221F;       /* primary buttons, rail bg */
  --color-brand-brass:       #D6C181;       /* text/icon on forest surfaces */
  --color-brand-gold:        #A98435;       /* warnings, accents, held items */
  --color-brand-danger:      #9B2D23;       /* critical, unconfirmed, slipped */
  --color-audit-surface:     #11140F;       /* dark "engine room" panels */
  --color-audit-muted:       #9DA89A;       /* muted text on dark surfaces */
  --color-audit-accent:      #9EE1C7;       /* mint accent on dark surfaces */
}
```

**Critical:** Primary action buttons are `forest` background + `brass` text. The repo's existing `--color-action-primary` (blue `#185FA5`) is NOT used for buttons in the Console design. Blue appears only as the Deadlines book icon color on the Overview cards.

### 0b. Add CSS animation for pulsing deadline dots

```css
@keyframes litt-pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 currentColor; }
  50%       { opacity: 0.7; box-shadow: 0 0 0 5px transparent; }
}
.litt-pulse { animation: litt-pulse 1.8s ease-in-out infinite; }
```

Used on unconfirmed deadline pins in the timeline and the critical callout dot.

### 0c. Create `dashboard/src/tokens.ts`

A single TS file exporting the `T` constant object with all hex values, mirroring `litt-flows.jsx` exactly. Every page imports from here — no repeated hex strings in component files.

```ts
export const T = {
  paper: '#FBFAF6', surface: '#FFFFFF', wash: '#F1EFE8', wash2: '#F8F7F4',
  line: 'rgba(20,20,18,0.12)', soft: 'rgba(20,20,18,0.07)',
  ink: '#2C2C2A', muted: '#6F6D67', faint: '#A9A7A1',
  forest: '#14221F', forestLine: 'rgba(214,193,129,.20)',
  brass: '#D6C181', gold: '#A98435',
  teal: '#1D9E75', tealSoft: 'rgba(29,158,117,.10)',
  danger: '#9B2D23', dangerSoft: '#F6E4DF',
  audit: '#11140F', auditMuted: '#9DA89A', auditAccent: '#9EE1C7',
} as const;
```

### 0d. Create `dashboard/src/components/ui/` shared atoms

Port these verbatim from `prototype-source/litt-flows.jsx` and `prototype-source/console-stubs.jsx`. Exact values from source — no rounding, no "improving."

> **Locate each atom by symbol name** (search/Ctrl+F in the source file), not by line number — line numbers drift as the prototype evolves.

| File | Component | Source file | What it does |
|---|---|---|---|
| `Mono.tsx` | `<Mono>` | `litt-flows.jsx` | `<span>` with `font-mono`, passthrough `style` prop |
| `Icon.tsx` | `<Icon>` | `litt-flows.jsx` | Inline SVG, 19 named icons, exact stroke paths |
| `Btn.tsx` | `<Btn>` | `litt-flows.jsx` | forest / teal / ghost / danger / quiet variants |
| `PageHead.tsx` | `<PageHead>` | `console-stubs.jsx` | `<h1>` + tag chip + sub paragraph |
| `Shell.tsx` | `<Shell>` | `console-stubs.jsx` | Scrollable content wrapper, centered `max-width` |
| `ClsChip.tsx` | `<ClsChip>` | `console-deadlines.jsx` | Deadline class chip (HARD_LEGAL, HARD_CONTRACTUAL, etc.) |
| `GateChip.tsx` | `<GateChip>` | `litt-flows.jsx` | Gate-level chip (ESCALATION / REVIEW / BLOCKED / LOG) |
| `SubHead.tsx` | `<SubHead>` | `console-clients.jsx` | Section divider: icon tile + `<h2>` + count pill + sub |

**Icon names** (all 19, must match exactly — these names are referenced across all pages):
`check · arrow · clock · shield · alert · dollar · mail · chart · chevron · chevronD · x · book · refresh · lock · grid · sliders · plug · users · dot`

**Gate:**
- Structural: `tsc --noEmit` clean
- Visual: render atoms on a dev test route; confirm `Mono` is IBM Plex Mono, `Icon` renders correct strokes at 16px, `Btn` primary is forest/brass (not blue)

### 0e. Playwright Visual Test Infrastructure

Install and configure Playwright. This phase has no screenshot test of its own — it sets up the harness that every subsequent phase uses.

**Install:**
```bash
cd dashboard
npm install --save-dev @playwright/test
npx playwright install chromium
```

**`dashboard/playwright.config.ts`:**
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  use: {
    baseURL: 'http://localhost:3000',   // vite.config.ts pins server.port = 3000
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
  },
  expect: {
    toHaveScreenshot: {
      threshold: 0.1,           // 10% per-pixel tolerance — handles font rendering variance
      maxDiffPixelRatio: 0.02,  // no more than 2% of total pixels may differ
      animations: 'disabled',   // disable CSS transitions/animations globally for determinism
    },
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,                 // matches vite.config.ts server.port = 3000
    reuseExistingServer: true,
  },
  snapshotDir: './tests/visual/snapshots',
});
```

> **Port 3000 is correct.** `vite.config.ts` in this repo pins `server.port = 3000` (not the Vite default 5173). The config above matches. Backend must be running on `8002` — the Vite proxy forwards `/api` and `/health` there.

**`dashboard/tests/visual/fixtures.ts`** — shared API mock helper (updated in Phase 0f to import real data):
```ts
import type { Page } from '@playwright/test';
// These imports are added in Phase 0f once demo-fixtures/ exists:
// import brief from '../../src/demo-fixtures/brief.json';
// import sweep from '../../src/demo-fixtures/sweep.json';
// ... etc. (see Phase 0f for the complete version)

export async function mockAllApis(page: Page) {
  const empty = (r: any) => r.fulfill({ json: [] });
  await page.route('**/api/brief*',         empty);
  await page.route('**/api/deadlines*',     empty);
  await page.route('**/api/budgets*',       empty);
  await page.route('**/api/relationships*', empty);
  await page.route('**/api/inbound*',       empty);
  await page.route('**/api/audit-log*',     empty);
  await page.route('**/api/sweep*',         r => r.fulfill({ json: { timeline: { observations: [] } } }));
  await page.route('**/api/tools*',         empty);
  await page.route('**/api/commitments*',   empty);
}
```

> **Note:** Phase 0e installs the empty-stub version above. Phase 0f replaces this with real fixture data from `demo-fixtures/`. Pages relying on populated data will render blank until Phase 0f completes — that is expected and correct. Screenshot baselines for those pages are not taken until Phase 0f is done.

**Directory layout:**
```
dashboard/
  playwright.config.ts
  tests/
    visual/
      fixtures.ts          ← shared mock helper
      snapshots/           ← stored baselines (committed to git)
      diff/                ← diff images on failure (gitignored)
      00-shell.spec.ts     ← Phase 1
      01-overview.spec.ts  ← Phase 2
      02-deadlines.spec.ts ← Phase 3
      ... (one file per phase)
```

**`dashboard/.gitignore` additions:**
```
tests/visual/diff/
```

**Snapshot update workflow** (run after human visual gate passes):
```bash
cd dashboard && npx playwright test --update-snapshots
```
Commit the updated `tests/visual/snapshots/` alongside the code.

**`package.json` script additions:**
```json
"test:visual":        "playwright test tests/visual/",
"test:visual:update": "playwright test tests/visual/ --update-snapshots"
```

**Gate:** `npm run test:visual` runs without error (no tests yet — harness only). `npx tsc --noEmit` clean.

---

## Phase 0f — Demo Fixtures

**Build after Phase 0e, before Phase 1.** Every populated page and every screenshot gate depends on this. Pages render from static JSON fixtures ported verbatim from the prototype source — not from live API calls. This is the consistent approach for all data pages in v1.1.3; backend endpoint wiring is v1.2.

### 0f.1 Create `dashboard/src/demo-fixtures/`

Port each array **verbatim** (exact values, IDs, copy) from the prototype source:

> **Purpose of fixtures is Playwright-only.** The app uses real `api.ts` functions where endpoints exist; fixtures are for deterministic test mocking only. Fixture shapes must match the real API response shapes — not the prototype's internal data format.

| Fixture file | Source for values | Feeds (tests) | API function in `api.ts` |
|---|---|---|---|
| `brief.json` | `backend/app/demo/fixtures_v11.py` or derive to demo counts | Overview, Brief | `getBrief` *(exists)* |
| `sweep.json` | **must use real `AgentObservation[]` shape** (see below) | Agent console | `runSweep` *(exists)* |
| `tools.json` | `backend/app/tools/registry.py` → `TOOL_REGISTRY` values | Agent console catalog | `GET /api/tools` *(exists — verify)* |
| `deadlines.json` | `console-data.js` → `DEADLINES_BOOK` → convert to `RawDeadline[]` shape | Deadlines | `getDeadlinesFull` *(exists)* |
| `inbound.json` | `console-clients.jsx` → `INBOUND` → convert to `InboundMessage[]` shape | Relationships §1 | `getInbound` *(exists)* |
| `commitments.json` | `console-clients.jsx`/`console-data.js` → `COMMITMENTS` | Relationships §2 | **no API — UI local state** |
| `relationships.json` | `console-clients.jsx` → `CLIENTS`, `COMMS_LOG` → `RelationshipMatter[]` | Relationships §3–4 | `getRelationships` *(exists)* |
| `budgets.json` | `console-stubs.jsx` → `BUDGETS` → `BudgetUtilizationItem[]` | Budgets | `getBudgets` *(exists)* |
| `audit-log.json` | `console-record.jsx` → `LEDGER` → `AuditLogEvent[]` | Audit ledger | `getAuditLog` *(exists)* |

**`sweep.json` shape — use real `AgentObservation[]` (NOT the prototype's SWEEP format):**
```jsonc
{
  "observation_id": "obs-001",
  "timestamp": "2026-06-25T17:00:01Z",
  "agent_name": "billing_agent",            // field is agent_name (NOT agent_id). AgentGraph keys on
                                             //   AGENT_TO_NODE[obs.agent_name] — wrong field = silent no-highlight
  "observation_type": "TOOL_CALL",          // ObservationType (12 values): SIGNAL_RECEIVED | REASONING |
                                             //   ROUTING_DECISION | TOOL_CALL | RESULT | ESCALATION |
                                             //   APPROVAL_GATE_APPLIED | MATTER_SYNTHESIS | COMPOUND_RISK |
                                             //   INBOX_TRIAGE | WARN_NOTICE | ROUTE_HANDOFF
  "commitment_level": "REVIEW_REQUIRED",    // CommitmentLevel: AUTO_SAFE | REVIEW_REQUIRED | ESCALATION | BLOCKED
  "work_kind": "tool_write",                // work_kind (5 values): deterministic | llm_assisted | tool_write |
                                             //   human_gate | route  — DISTINCT from data.tool.kind (ToolKind)
  "model_name": null,                       // present on llm_assisted steps
  "confidence": null,
  "description": "Ran all 9 entries through the 7-rule scrubber — one came back flagged.",
  "evidence": [],
  "run_id": "run-001",
  "parent_observation_id": null,
  "audit_log_id": null,
  "attorney_next_action": null,
  "data": {
    "tool": {                               // REQUIRED on TOOL_CALL steps per A1 (backend now emits this)
      "name": "run_prebill_scrubber",
      "kind": "compute",                    // ToolKind (4 values): read | write | compute | gemini
      "signature": "run_prebill_scrubber(entry) → Flag[]",
      "result": "te-001 · MISSING_NARRATIVE"
    },
    "handoff": null                         // { from, to, entity_id?, reason? } on ROUTE_HANDOFF only
  }
}
```
> Prototype's `SWEEP` uses `{agent, type, commit, work, tool, from, to}`. Live app reads `AgentObservation` shape above. Use real shape for Playwright fixtures — Inspector won't render chips/boundary stat without `data.tool` on `TOOL_CALL` steps. Per **A1 (Path B)**, the backend now emits `data.tool` live; fixture and live data match. Schema source: `src/types.ts → AgentObservation` + `backend/app/observability.py`.

### 0f.2 `brief.json` must yield the demo numbers

The brief fixture must produce: deadlines **12 tracked / 1 unconfirmed HARD_LEGAL** (Mercer, 6d), billing **$1,500 held / 1 scrubber block**, budgets **Acme 78% (1 over 75%)**, comms **1 silent matter + 3 inbound**, anomalies **1 elevated / 2 cleared** — totalling **5 decisions / 1 critical**.

If `backend/tests/fixtures/brief.json` already satisfies this shape, import from there. Otherwise create `demo-fixtures/brief.json` to these values.

### 0f.3 `dashboard/src/demo-fixtures/index.ts` — shared data layer

```ts
// One import per fixture. App code guards on VITE_DEMO; Playwright imports directly.
import brief from './brief.json';
import sweep from './sweep.json';
import tools from './tools.json';
import deadlines from './deadlines.json';
import inbound from './inbound.json';
import commitments from './commitments.json';
import relationships from './relationships.json';
import budgets from './budgets.json';
import auditLog from './audit-log.json';

export { brief, sweep, tools, deadlines, inbound, commitments, relationships, budgets, auditLog };
```

**`api.ts` does NOT need fixture fallbacks** for the already-existing endpoints. The fixtures are only for Playwright mocking (imported in `tests/visual/fixtures.ts`). The only local-state-only surfaces are commitments (no API) and policy (no API). Do not add `VITE_DEMO` guards to functions that have real endpoints.

### 0f.4 Updated `tests/visual/fixtures.ts` — replace the Phase 0e stub

```ts
import type { Page } from '@playwright/test';
import brief from '../../src/demo-fixtures/brief.json';
import sweep from '../../src/demo-fixtures/sweep.json';
import tools from '../../src/demo-fixtures/tools.json';
import deadlines from '../../src/demo-fixtures/deadlines.json';
import inbound from '../../src/demo-fixtures/inbound.json';
import commitments from '../../src/demo-fixtures/commitments.json';
import relationships from '../../src/demo-fixtures/relationships.json';
import budgets from '../../src/demo-fixtures/budgets.json';
import auditLog from '../../src/demo-fixtures/audit-log.json';

export async function mockAllApis(page: Page) {
  const json = (data: unknown) => (r: any) => r.fulfill({ json: data });
  await page.route('**/api/brief*',         json(brief));
  await page.route('**/api/sweep*',         json({ timeline: { observations: sweep }, brief }));
  await page.route('**/api/tools*',         json(tools));
  await page.route('**/api/deadlines*',     json(deadlines));
  await page.route('**/api/inbound*',       json(inbound));
  await page.route('**/api/commitments*',   json(commitments));
  await page.route('**/api/relationships*', json(relationships));
  await page.route('**/api/budgets*',       json(budgets));
  await page.route('**/api/audit-log*',     json(auditLog));
}
```

### 0f.5 Snapshot determinism — freeze JS-driven motion

The Agent Console idle heartbeat is a `setInterval`, not CSS. Freeze it for screenshot tests:

- When `?frozen=1` appears in the URL (or `prefers-reduced-motion: reduce`), start `idleIdx` at `0` and do **not** start the interval or auto-advance the sweep.
- Playwright navigates with `?frozen=1` for all Agent Console tests (see Phase 5).
- Tag any wall-clock text or elapsed readout with `data-dynamic` in the component: Playwright passes `mask: [page.locator('[data-dynamic]')]` to suppress diffs on those nodes.

**Gate (Phase 0f):** `tsc --noEmit` clean; `npm run test:visual` runs without error; every fixture imports without type error; `mockAllApis` returns populated data (not empty arrays).

---

## Phase 1 — Shell, Rail, and Routing

### 1a. Update `App.tsx`

- Move `DailyCloseoutBrief` from `/` to `/brief`
- Add `<Overview />` at `/`
- All other routes unchanged
- Remove `DemoBanner` import and usage
- Keep `/audit` → `<AuditLog />` (legacy, unchanged) AND `/ledger` → `<AuditLedger />` — do NOT repoint `/audit`; keeping both is harmless and preserves the legacy view (B-1.1 decision: keep both)

### 1b. Rebuild `ConsoleShell.tsx`

Outer container: `height: 100vh; display: flex; background: #14221F (forest)`.
Main content area: `flex: 1; minWidth: 0; background: #F1EFE8 (wash); display: grid; gridTemplateRows: 1fr; minHeight: 0`.
No DemoBanner. No top strip. Rail left, content right.

### 1c. Rebuild `ConsoleRail.tsx`

Exact translation of `LeftRail` in `console-shell.jsx`. Every spacing value, color, and behavior from source.

| Element | Spec |
|---|---|
| Width | 232px, fixed, full height |
| Background | `#14221F` (forest) |
| Right border | `1px solid rgba(214,193,129,.18)` |
| Logo block | "Litt." — 21px / weight 700 / color `#EFEBDB`. Teal dot after period. Firm name: mono 10.5px `#9DA89A`. Bottom border `rgba(214,193,129,.14)` |
| Nav groups | **Ungrouped** (Overview, Brief) → **Watch** → **Collect** → **Prove** → **Tune**. Prove is above Tune. |
| Group label style | Mono 9.5px uppercase `.12em` tracking `#7E8A7C`. Padding `4px 10px 2px`. |
| Nav item — default | `background: transparent; color: #D8D3C3; font-size: 13px; font-weight: 500; border-radius: 8px; padding: 8px 10px` |
| Nav item — active | `background: brass (#D6C181); color: forest (#14221F); font-weight: 600` |
| Nav item — hover | `background: rgba(255,255,255,.05)` |
| Brief item (star) | Brass border ring `rgba(214,193,129,.4)`, brass-soft background `rgba(214,193,129,.08)`, "READY" label in `auditAccent` mono 9px |
| Count badge | Mono 10.5px. Active route: forest color on `rgba(20,34,31,.12)` bg. Inactive: danger color on `rgba(155,45,35,.16)` bg. Border-radius 999. |
| System status block | Pulse dot (`auditAccent`, `box-shadow glow`) + "All systems nominal" + last sweep time (brass) + integrations count (brass). Top border `rgba(214,193,129,.14)`. **Demo mode** (`brief.demo_mode === true`): render a brass `DEMO` pill (mono 9px, `rgba(214,193,129,.18)` bg, `rgba(214,193,129,.45)` border, `2px border-radius: 3px`) + demo date string in brass mono below the sweep time — e.g. `DEMO · Jun 25, 2026`. Source: `brief.generated_at` formatted as "Jun 25, 2026". Visible on every screen since rail is always present — judges are always grounded to the demo date anchor. |
| User chip | Avatar circle (DS initials, 26px). Brass bg for firm_admin, `rgba(214,193,129,.18)` for attorney. Name 12.5px `#EFEBDB`, role mono 9.5px `#9DA89A`. Chevron-D icon. Border `rgba(214,193,129,.18)`. |
| User dropdown | Absolute, above chip. `background: #1C2E2A`. Shows all 3 users (Marcus Okafor / Dana Strand / Priya Nair). |

Active state detection: `useLocation()` from React Router. Match current pathname to route. Brief active when at `/brief`.

**Gate:**
- Structural: `tsc --noEmit` clean
- Screenshot test (`tests/visual/00-shell.spec.ts`):
  ```ts
  test('rail renders correctly on overview', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/');
    await page.waitForSelector('nav');           // rail mounted
    await expect(page).toHaveScreenshot('00-shell-overview.png', { clip: { x: 0, y: 0, width: 232, height: 900 } });
  });
  test('active state updates on navigation', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/deadlines');
    await expect(page).toHaveScreenshot('00-shell-deadlines-active.png', { clip: { x: 0, y: 0, width: 232, height: 900 } });
  });
  ```
- Visual: compare rail vs. every screenshot (rail appears in all 17 screens). Confirm: active brass pill, Brief READY badge, system status footer, user chip render correctly

---

## Phase 2 — Overview Page

**File:** `dashboard/src/pages/Overview.tsx`
**Source:** `Overview` function in `console-shell.jsx` (lines 120–184)
**Screen:** `screens/01-overview.png`

### Layout

```
[Mono eyebrow: June 25, 2026 · 4:32 PM · operations overview]
[h1: Morning, Dana.]
[p: Litt is watching everything. N items across your books need your judgment...]
[Button: Open the Brief →]

[h2: The Books]
[p: What Litt is watching across your matters.]
[3-col grid: 5 book cards]

[3-col auto-fit: Agents (dark) · Policy & autonomy · Integrations]
```

### Data strategy

Load from `GET /api/brief?firm_id=strand-okafor&attorney_id=dana-strand`. Derive BOOKS counts from `sections`. **Real `BriefSections` keys** (from `types.ts`): `deadlines · time_entries · budget_risks · client_silence · anomalies · compound_escalations · inbox_items`. The keys `billing`, `budget`, `comms` **do not exist** — using them crashes the Overview.

| Book card | Count | `needsYou` | Line text |
|---|---|---|---|
| Deadlines | `sections.deadlines.count` | `items.filter(i => i.is_unconfirmed).length` / `.has_critical` | "N unconfirmed HARD_LEGAL · nearest Nd" |
| Billing & WIP | `sections.time_entries.count` | items with `has_block` | "$X held · N scrubber block" (`$X` = `total_wip_usd` or Σ held amounts) |
| Budgets | `sections.budget_risks.count` | items `alert_status ∈ {WARN,CRITICAL}` | "N client over 75% · Acme 78%" (`utilization_pct`) |
| Clients & comms | `sections.client_silence.count` | `sections.inbox_items.count` | "N silent matter · N awaiting reply" |
| Anomalies | `sections.anomalies.count` | items `risk_level ∈ {ELEVATED,CRITICAL}` | "N elevated" *(the "· N cleared" suffix is static copy — brief has no cleared count; keep static or omit)* |

### Eyebrow

`[Mono eyebrow: {date} · {time} · operations overview]` — derive date and time from `brief.generated_at`. Format: `"June 25, 2026 · 4:32 PM"`. In demo mode this naturally shows the demo anchor date (backend returns demo `generated_at`). No special demo-mode branch needed here — the data source is always `brief.generated_at`.

### Greeting

Translate the `greet()` pool from `litt-core.js` (search for `greet` function by symbol name) into TypeScript. Use `brief.generated_at` to extract the hour. Pick greeting from the correct hour bucket. Cache per bucket (same greeting for same session).

### Book card colors (icon tile + hover border)

```ts
const BOOK_COLOR: Record<string, string> = {
  deadlines: '#185FA5',   // blue — only use of blue in Console design
  billing:   '#1D9E75',   // teal
  budgets:   '#A98435',   // gold
  comms:     '#5F6F66',   // muted
  anomalies: '#9B2D23',   // danger
};
```

### Bottom system row

Static content strings (same as prototype). Click handlers: `useNavigate('/agents')`, `useNavigate('/policy')`, `useNavigate('/integrations')`.

**Gate:**
- Structural: `tsc --noEmit` clean
- Screenshot test (`tests/visual/01-overview.spec.ts`):
  ```ts
  test('overview page', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/');
    await page.waitForSelector('h1');            // greeting rendered
    await expect(page).toHaveScreenshot('01-overview.png');
  });
  ```
- Visual: matches `01-overview.png` — greeting present, 5 book cards with correct counts, needs-you pills, system row at bottom

---

## Phase 3 — Deadlines

**File:** `dashboard/src/pages/Deadlines.tsx`
**Source:** `console-deadlines.jsx`
**Screens:** `02-deadlines-top.png`, `03-deadlines-book.png`

### Key sub-components (build inline, extract to `ui/` if reused elsewhere)

**`Timeline`** — horizontal 45-day pin chart:
- Height: 168px. Baseline at vertical center.
- Week gridlines at +7, +14, +21, +28, +35, +42 days (1px, `soft` color)
- "TODAY" marker at x=0 (forest dot)
- Pin x-position: `(daysOut / horizon) * 100%`
- Pins alternate above/below the baseline by index (even=above, odd=below)
- Each pin: stem line + colored dot + label card (date / client / Nd · class)
- Unconfirmed pin: larger dot (13px vs 11px), `.litt-pulse` class, danger color

**Cadence ladder** — 14 / 7 / 3 / 1 day windows:
- 4 rows. Each row: big day-number + label + list of HARD_LEGAL deadlines in that window
- Live (has items in window): tinted background (danger-soft for ≤7d, gold-soft for ≤14d)
- Empty: `wash2` background, faint italic description
- Footer: count of HARD_LEGAL beyond 14d · watching

**`ClsChip`** — already built in Phase 0.

### Data

`GET /api/deadlines` (`getDeadlinesFull`) → `RawDeadline[]`. **`RawDeadline` carries `client_id` / `matter_id` only — no `client_name` / `matter_name`.** Join names client-side: use `brief.sections.deadlines.items` (which carries `client_name`) or call `getRelationships()` and build a lookup map. Do not render raw IDs in the timeline/cadence labels. The "Confirm in closeout" link navigates to `/brief`.

**Gate:**
- Structural: `tsc --noEmit` clean
- Screenshot tests (`tests/visual/02-deadlines.spec.ts`):
  ```ts
  test('deadlines top — callout and timeline', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/deadlines');
    await page.waitForSelector('h1');
    await expect(page).toHaveScreenshot('02-deadlines-top.png');
  });
  test('deadlines book — filtered to all', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/deadlines');
    await page.waitForSelector('h1');
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(page).toHaveScreenshot('03-deadlines-book.png');
  });
  ```
- Visual: matches both screens. Timeline pins at correct x-positions. Critical callout (danger border) for unconfirmed items. Cadence ladder correctly highlights occupied windows. Filter tabs work.

---

## Phase 4 — Collect / Billing & WIP

**File:** `dashboard/src/pages/Collect.tsx`
**Source:** `console-collect.jsx`
**Screen:** `04-collect.png`

Translate exactly from source. Key elements expected: billing pipeline stage strip, held entry callout (te-001, $1,500, MISSING_NARRATIVE), scrubber summary table, WIP pipeline data, realization stats. Actions use existing `approveBilling()` and `downloadLedesExport()` from `api.ts`.

**Gate:**
- Structural: `tsc --noEmit` clean
- Screenshot test (`tests/visual/03-collect.spec.ts`):
  ```ts
  test('collect page', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/collect');
    await page.waitForSelector('h1');
    await expect(page).toHaveScreenshot('04-collect.png');
  });
  ```
- Visual: matches `04-collect.png`

---

## Phase 5 — Agent Console

**File:** `dashboard/src/pages/AgentConsole.tsx`
**Source:** `console-agents.jsx`
**Screens:** `14-agents-idle.png`, `15-agents-toolcall.png`, `16-agents-handoff.png`, `17-agents-toollayer.png`

**Highest-risk phase.** Complete architectural change from the current SVG graph to the column-card layout.

### Layout

Full-page: header row (top) + graph card (center, fills remaining height) + scrubber bar (bottom). Right of graph: Inspector panel (~320px, fixed width).

```
[h1: Agent console] [THE ENGINE ROOM tag] [Plain English / Technical toggle] [Run closeout sweep button]
[sub: Watch Litt think...]

┌─────────────────────────────────────────────────────────────────┬──────────────────┐
│  SIGNALS IN      ROUTER        SPECIALIST AGENTS   ON THE RECORD │  Inspector panel │
│  [Gmail]         [Coordinator] [Deadline Monitor]  [Tool layer]  │                  │
│  [Calendar]                    [Billing Recon]     [Audit log]   │                  │
│  [Matter store]                [Client Comms]      [Your Brief]  │                  │
│  [Time & billing]              [Anomaly Escal.]                  │                  │
│                                                                   │                  │
│  [connectors: thin SVG lines between columns]                    │                  │
└─────────────────────────────────────────────────────────────────┴──────────────────┘
[▶ Watching · Billing Reconciliation  ·····  last sweep 4:58 PM                      ]
```

### Node cards

Each node is a white (or dark) card:
- **Input nodes** (Gmail, Calendar, Matter store, Time & billing): icon + label + sub. No badge.
- **Coordinator**: icon + "PYTHON" badge + description (plain/technical per toggle) + metric line
- **Agent nodes**: icon + name + "PYTHON"/"GEMINI" badge + description + "N handled · M to you" footer. `comms_agent` gets "GEMINI" badge (teal).
- **Tool layer**: dark card. Lock icon + "Tool layer" + "the only way to act" sub.
- **Audit log**: dark card. Shield icon + "Audit log" + "append-only record" sub.
- **Your Brief**: dashed-border card. Check icon + "Your Brief" + "gated to you" sub.

### Connector lines

Thin SVG overlay (absolute, same dimensions as the graph area, `pointer-events: none`). Lines connect: all inputs → coordinator, coordinator → all agents, all agents → tool layer, tool layer → audit + brief. Bezier curves. Color: `rgba(20,20,18,.14)`.

Two permanent styled connectors:
- Gmail ↔ Client Comms: teal dashed line (two-way inbox channel)
- Cross-agent hand-off edges: gold dashed, rendered only during a ROUTE_HANDOFF sweep step

### Behaviors

**Idle heartbeat** (no sweep running, nothing selected):
- `setInterval` at **2100ms**, cycling **only the 4 specialist agents**: `['deadline_agent','billing_agent','comms_agent','anomaly_agent']` — NOT coordinator/tool/audit/brief.
- For the active idle agent, highlight: that agent + its mapped input sources + the coordinator (and edges between them), using:
  ```ts
  const AGENT_SOURCES = {
    deadline_agent: ['calendar', 'matter'],   // real code: deadline_agent sources
    billing_agent:  ['billing'],              // real code: billing_agent sources (NOT 'time')
    comms_agent:    ['matter', 'gmail'],      // real code: comms_agent sources
    anomaly_agent:  ['billing', 'matter'],    // real code: anomaly_agent sources (NOT 'time')
  };
  ```
- Bottom dock reads: `● Watching · <Agent display name>`
- When `?frozen=1` in URL: start `idleIdx` at `0`, do NOT start the interval (snapshot determinism).

**During a sweep** (from `sweep.json` / `POST /api/sweep`):
- Steps auto-advance at **`STEP_MS = 640ms`**. Playback length = **`timeline.observations.length`** (variable in live data). The Playwright fixture `sweep.json` is authored with **20 steps** (hand-off at index 5, scrubber call at index 13) — do NOT hardcode 20 in component logic.
- **Two distinct enums — do not conflate:**
  - `obs.work_kind` (5 values): `deterministic | llm_assisted | tool_write | human_gate | route` — the observation's overall work classification. Used for boundary stat and Plain/Technical toggle rendering. *(Doc gap: `observability.py:83` comment and `types.ts:281` JSDoc both list only 4 — they omit `route`, which `comms_agent.py:1058` really emits. Comments only; no runtime impact. Fix independently.)*
  - `obs.data.tool.kind` (`ToolKind`, 4 values): `read | write | compute | gemini` — the tool registry classification. Used for chip badge color and boundary stat (`kind === 'gemini'` count).
- The firing node ring-highlights; source-mapping is driven by `obs.observation_type` (as `AgentGraph.tsx` already does) **not** by `tool.kind`:
  - `obs.observation_type === 'SIGNAL_RECEIVED'` → light all inputs + coordinator
  - `obs.observation_type === 'ROUTING_DECISION'` → light coordinator + all agents
  - `obs.observation_type === 'ROUTE_HANDOFF'` → gold dashed edge between `obs.data.handoff.from` and `.to`; both agents highlight
  - `obs.observation_type === 'TOOL_CALL'` → light firing agent + tool layer
  - All others → light agent node only
  - Source lights (AGENT_SOURCES) on `SIGNAL_RECEIVED` only
- Live tool chip under the node: `obs.data.tool.name` + `obs.data.tool.kind` badge (only on `TOOL_CALL` steps — `data.tool` is present live per A1).
- Elapsed readout: `+${(step * 0.64).toFixed(1)}s` — tag it `data-dynamic` for snapshot masking.

**ROUTE_HANDOFF step** (steps where `from`/`to` are set):
- Gold dashed edge bows between `from` and `to` agent nodes.
- Both highlight simultaneously.
- Inspector shows a "Cross-agent hand-off" card.

**Boundary stat** (inspector idle state):
- Count `TOOL_CALL` observations where `obs.data.tool.kind === 'gemini'` vs total `TOOL_CALL` count. Never hardcode "17/20 · 3 Gemini" — that number comes from whatever the seeded sweep actually emits. Tune via which steps are instrumented + seed data. If the demo sweep doesn't produce the right counts, fix the fixture/backend, don't fake `kind`.
- Inspector formula: `gemini = TOOL_CALL steps where data.tool.kind === 'gemini'`; `deterministic = total_TOOL_CALLs − gemini`. Renders as "N/M deterministic · N Gemini".

**Plain / Technical toggle:**
- Plain mode: human descriptions in node bodies, `PLAIN_GATE` vocabulary in inspector
- Technical mode: function signatures and technical blurbs

**Two-way inbox channel:** teal dashed Gmail ↔ Comms edge with "two-way inbox channel" legend (top-right of graph). Static — always rendered.

**Agent node click → "Tools it can call" list. Tool layer node click → full catalog grouped by agent + per-kind counts + boundary stat.**

### Inspector panel

- **Idle**: boundary stat strip (Python N / Gemini N / total N) + explainer cards ("Deterministic / Drafts only / One door to act") + "Press Run closeout sweep to watch it work" note
- **During/after step**: "LIVE · STEP N" header + plain-English step narration + TOOL CALL card (function name, signature, result, kind badge)
- **Agent node click**: "Tools it can call" — list of that agent's tools from the registry
- **Tool layer node click**: full catalog grouped by agent, per-kind counts, boundary stat

### Scrubber bar

Bottom strip: `▶` play button + dot sweep status text + "last sweep HH:MM" right-aligned. During playback: segment bar (one segment per step, colored by gate commitment level) + "Step N of N" + elapsed seconds.

### Log tab

Keep `AgentRunTimeline.tsx` accessible as a "Log" tab in the inspector (tab switcher: "Inspector" | "Log").

**Gate:**
- Structural: `tsc --noEmit` clean
- Screenshot tests (`tests/visual/04-agents.spec.ts`) — all use `?frozen=1` for determinism:
  ```ts
  test('agent console — idle state (frozen)', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/agents?frozen=1');
    await page.waitForSelector('h1');
    await expect(page).toHaveScreenshot('14-agents-idle.png', {
      animations: 'disabled',
      mask: [page.locator('[data-dynamic]')],
    });
  });

  test('agent console — plain/technical toggle', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/agents?frozen=1');
    await page.getByRole('button', { name: 'Technical' }).click();
    await expect(page).toHaveScreenshot('14-agents-technical.png', { animations: 'disabled' });
  });

  // Sweep states are deterministic when scrubbed to a fixed step (no timer dependency):
  test('agent console — tool-call step (billing scrubber)', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/agents?frozen=1');
    await page.getByTestId('sweep-step').nth(13).click(); // step 14: run_prebill_scrubber
    await expect(page).toHaveScreenshot('15-agents-toolcall.png', {
      animations: 'disabled', mask: [page.locator('[data-dynamic]')],
    });
  });

  test('agent console — cross-agent hand-off', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/agents?frozen=1');
    await page.getByTestId('sweep-step').nth(5).click(); // step 6: comms → deadline hand-off
    await expect(page).toHaveScreenshot('16-agents-handoff.png', { animations: 'disabled' });
  });

  test('agent console — tool catalog', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/agents?frozen=1');
    await page.getByText('Tool layer', { exact: false }).click();
    await expect(page).toHaveScreenshot('17-agents-toollayer.png', { animations: 'disabled' });
  });
  ```
  > Requires `data-testid="sweep-step"` on each scrubber segment. With `?frozen=1` honored by the page, all four agent screens are reproducible in CI.
- Visual: matches all 4 agent screens (`14–17`). Idle heartbeat cycles only 4 agents at 2100ms. Sweep plays 20 steps at 640ms. Inspector updates per step. Plain/Technical toggle changes node copy. Tool catalog + boundary stat renders on Tool layer click.

---

## Phase 6 — Audit Ledger

**File:** `dashboard/src/pages/AuditLedger.tsx`
**Source:** `console-record.jsx`
**Screen:** `05-record-ledger.png`

Current implementation is close. Rebuild to exactly match:

- **Dark stat strip** (`audit` surface bg): 4 stats — events today / legal-record count / your-decisions vs Litt count / last-write time. Production note (Cloud Audit Logs, restricted IAM) in mint mono.
- **Filter toolbar**: tier pills (All / Legal record / Operational / System) + actor pills (Everyone / Litt / You). Pill style: forest bg when active.
- **Row format**: time · tier badge · `event_type` + summary · actor
- **Row expand**: metadata grid (entity / actor / tier / idempotency_key) + before → after diff (two dark `audit`-surface JSON panels with `→` arrow between). Reuse `AuditEventDrawer.tsx` if it already does this.
- **Export JSON** button (forest): creates Blob download of all loaded events.
- Data: `GET /api/audit-log`. New event types (`commitment.*`, `policy.updated`, `INBOUND_TRIAGED`) appear automatically as backend adds them.

**Gate:**
- Structural: `tsc --noEmit` clean
- Screenshot tests (`tests/visual/05-ledger.spec.ts`):
  ```ts
  test('audit ledger — default view', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/ledger');
    await page.waitForSelector('h1');
    await expect(page).toHaveScreenshot('05-record-ledger.png');
  });
  test('audit ledger — row expanded', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/ledger');
    await page.waitForSelector('h1');
    // click first row to expand
    await page.locator('[data-testid="ledger-row"]').first().click();
    await expect(page).toHaveScreenshot('05-record-ledger-expanded.png');
  });
  ```
- Visual: matches `05-record-ledger.png`. Expand shows diff panels. Tier/actor filters work. Export downloads a file.

---

## Phase 7 — Policy & Autonomy

**File:** `dashboard/src/pages/Policy.tsx`
**Source:** `console-policy.jsx`
**Screens:** `06-policy.png`, `07-policy-domains.png`

**Scope note:** Policy enforcement is a v1.2 backend feature. This phase builds the full UI as a control surface. Domain toggles and steppers hold local React state only — writes do not persist to the backend in this version. Every rule row's "changes write to audit ledger" footer note is architecturally accurate (it will, once the backend policy engine is wired in v1.2).

Key elements:
- **Posture dial** (dark panel): "Current posture" label + big state word (Fully gated) + "% of safe autonomy used" + gradient track (gold→mint) + 3 axis labels
- **Scope banner**: firm-admin vs. attorney view (icon + copy + role tag). Dana Strand = attorney view.
- **Domain sections** (Billing / Deadlines / Comms / Anomalies): each a card with rule rows
- **Rule row controls**: GATED/AUTO segmented toggle (Ask me / Auto + log) OR tighten-only stepper (`−`/`+`, `+` disabled at firm floor). Firm-locked rows show non-interactive "Always gated" pill.

**Gate:**
- Structural: `tsc --noEmit` clean
- Screenshot tests (`tests/visual/06-policy.spec.ts`):
  ```ts
  test('policy — dial and scope banner', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/policy');
    await page.waitForSelector('h1');
    await expect(page).toHaveScreenshot('06-policy.png');
  });
  test('policy — domain rules', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/policy');
    await page.waitForSelector('h1');
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(page).toHaveScreenshot('07-policy-domains.png');
  });
  ```
- Visual: matches both screens. Dial renders. Toggles and steppers interactive (local state). Firm-locked rows non-interactive.

---

## Phase 8 — Relationships / Clients & Comms

**File:** `dashboard/src/pages/Relationships.tsx`
**Source:** `console-clients.jsx`
**Screens:** `08-relationships-inbound.png`, `09-relationships-commitments.png`, `10-relationships-quiet.png`

### Four sections in order

**Section 1: Awaiting your response** (danger tone `SubHead`)

`InboundCard` per message. First card (Mercer) is expanded by default:
- Avatar + name/role + urgency pill ("High · awaiting 2d")
- Read-only original message (italic, left-border tint)
- 2-col triage grid: "What they need" + "Why it surfaced" signal chips | "Action items" with cross-agent links + "Handed to [Agent]" box
- Suggested reply card (held, Gemini badge, grounding rows)
- Actions: Approve & send (forest) / Edit / Snooze / Hand off

Two collapsed cards below (Lindqvist; Acme with `→ Billing` cross-link).

Data: `getInbound()` from `api.ts` — this function exists and is wired. Snooze and dismiss call `snoozeInbound()` / `dismissInbound()` respectively — both exist in `api.ts`. Hand-off is local UI state only (no API). Commitments are the only section with no backend (local fixture + `// TODO v1.2: GET /api/commitments`).

**Section 2: Commitments you've made** (teal tone `SubHead`)

`CommitmentTracker`: stat strip (Active / Due soon / Kept / Slipped) + explainer.

`CommitmentCard` per commitment:
- Verbatim quote from your sent message
- Status pill (pending / tracked / due-soon / kept / slipped)
- 3-stage `StageRail` (Captured → Tracked → Outcome) with current stage highlighted
- Footer: due date + on-deadline-book / → Deadline Monitor link
- Mark kept / Slipped buttons (absent for `PENDING` status)
- Ledger-write flash animation on action

Closed period group holds kept + slipped cards.

**Backend note:** Commitments backend not yet built. Use static fixture from `console-data.js COMMITMENTS` array. Document in code as `// TODO v1.2: replace with GET /api/commitments`.

**Section 3: Going quiet** (gold tone `SubHead`)

- Whitmore silence hero: days-silent tile + held Gemini draft + grounding rows + Review/Dismiss actions
- Relationship board: every matter, recency bar vs. 14-day threshold marker, warm/quiet/silent pill + Nd label

Data: existing `GET /api/relationships` or `brief.client_silence`.

**Section 4: Comms log + dark explainer card**

Comms log (existing data). Dark "How Litt handles your comms" card: Read → Draft → Hold flow, static content.

**Gate:**
- Structural: `tsc --noEmit` clean
- Screenshot tests (`tests/visual/07-relationships.spec.ts`):
  ```ts
  test('relationships — inbound triage', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/relationships');
    await page.waitForSelector('h1');
    await expect(page).toHaveScreenshot('08-relationships-inbound.png');
  });
  test('relationships — commitments section', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/relationships');
    await page.waitForSelector('h1');
    await page.evaluate(() => window.scrollTo(0, 700));
    await expect(page).toHaveScreenshot('09-relationships-commitments.png');
  });
  test('relationships — going quiet section', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/relationships');
    await page.waitForSelector('h1');
    await page.evaluate(() => window.scrollTo(0, 1400));
    await expect(page).toHaveScreenshot('10-relationships-quiet.png');
  });
  ```
- Visual: matches all 3 screens. InboundCard expand/collapse works. Commitment StageRail renders with correct active stage. Silence hero shows days-silent tile. Relationship board renders.

---

## Phase 9 — Budgets

**File:** `dashboard/src/pages/Budgets.tsx`
**Source:** `console-stubs.jsx ConsoleBudgets`
**Screen:** `11-budgets.png`

Stat strip (3 cells) + utilization list. Each row:
- Left border (3px, color = WARN/CRIT/none)
- Client name + matter (mono)
- WARN/CRITICAL pill + `$committed / $cap` + big `%` number (right-aligned)
- 7px height bar with 75% threshold marker line (1px absolute, `T.line` color) and colored fill

Data: `GET /api/budgets`.

**Gate:**
- Structural: `tsc --noEmit` clean
- Screenshot test (`tests/visual/08-budgets.spec.ts`):
  ```ts
  test('budgets page', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/budgets');
    await page.waitForSelector('h1');
    await expect(page).toHaveScreenshot('11-budgets.png');
  });
  ```
- Visual: matches `11-budgets.png`. Threshold marker visible at 75% position. Left borders on WARN+ rows. Colors: teal (under threshold) / gold (WARN) / danger (CRIT).

---

## Phase 10 — Anomalies

**File:** `dashboard/src/pages/Anomalies.tsx`
**Source:** `console-stubs.jsx ConsoleAnomalies`
**Screen:** `12-anomalies.png`

- Open ELEVATED callout: danger left-border card, icon tile, "1 elevated · reason required to clear", entry detail, "Resolve in closeout" forest button
- 2-col grid below: detector roster (left) + cleared today (right)
- **Detector roster is static/display-only** — render the 13 detectors from `DETECTORS` array in `console-stubs.jsx` source verbatim. The real `AnomalyType` enum has **11** values (`backend/app/models.py`); do NOT map the roster 1:1 to the enum or live data. It's a presentational list, not a live feed. Each row: 14px circle (teal check or danger alert icon) + name + count if firing.
- Cleared today: checkmark list with what / when / by fields. Static copy — the brief has no cleared count. (B-2.2: keep static or omit the count.)

Data: open ELEVATED callout and cleared list from `GET /api/brief` → `sections.anomalies`. Detector roster is always rendered from the static `DETECTORS` source array — not API-driven.

**Gate:**
- Structural: `tsc --noEmit` clean
- Screenshot test (`tests/visual/09-anomalies.spec.ts`):
  ```ts
  test('anomalies page', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/anomalies');
    await page.waitForSelector('h1');
    await expect(page).toHaveScreenshot('12-anomalies.png');
  });
  ```
- Visual: matches `12-anomalies.png`. 13 detectors shown in 2-col grid (static, from source array — not mapped to the 11-value `AnomalyType` enum). Callout has danger left-border.

---

## Phase 11 — Integrations

**File:** `dashboard/src/pages/Integrations.tsx`
**Source:** `console-stubs.jsx ConsoleIntegrations`
**Screen:** `13-integrations.png`

4 integration cards in `auto-fill minmax(280px,1fr)` grid:

| ID | Name | Status | Detail |
|---|---|---|---|
| gmail | Gmail | connected | Read-only · deadline & contact extraction |
| calendar | Google Calendar | connected | Deadline & hearing ingestion |
| ledes | LEDES 1998B export | ready | Approved entries → compliant invoice file |
| clio | Clio | available | Matter & contact sync |

Each card: icon tile (teal bg if on, wash2 if off) + name + `via` mono + status pill + detail text + footer (sync time + connect/least-privilege note). "Connect" button for Clio updates local state only.

**Gate:**
- Structural: `tsc --noEmit` clean
- Screenshot test (`tests/visual/10-integrations.spec.ts`):
  ```ts
  test('integrations page', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/integrations');
    await page.waitForSelector('h1');
    await expect(page).toHaveScreenshot('13-integrations.png');
  });
  ```
- Visual: matches `13-integrations.png`. Status pills correct colors. Connect stub works locally.

---

## Phase 12 — Brief

**File:** `dashboard/src/pages/Brief.tsx` *(new)*
**Source:** `console-brief.jsx` (`window.ConsoleBrief`)
**Route:** `/brief`
**Screen:** `18-brief.png`

**This is a layout port, not a wholesale replacement.** Port the prototype's hero/schedule/ranked-list layout from `console-brief.jsx`, but **retain** the existing `compound_escalations` + `inbox_items` section rendering and their real data wiring (`CompoundEscalationCard`, `WarnNotice`, `GeminiLabel`, action handlers). The current `DailyCloseoutBrief.tsx` renders those sections with real data — dropping them silently loses demo-relevant content. Decision (B-12.1): hybrid — new visual shell from prototype, existing content sections preserved.

Specifically:
- **Replace:** layout shell, hero card, "WHAT THIS BRIEF SURFACED" ranked list, "SCHEDULE" panel — all per `18-brief.png`
- **Preserve:** `compound_escalations` items, `inbox_items`, existing action handlers, brief fetch logic (`getBrief()`)

### Layout

```
[h1: Brief]  [THE CENTERPIECE teal tag]
[sub: Litt assembles everything…]

┌─────────────────────────────────────────────────────────────────────┐
│  dark hero (audit bg)                                               │
│  ● BRIEF READY · ASSEMBLED 5:00 PM                                  │
│  "5 decisions need you · 1 critical"  (1 critical in danger color)  │
│  Next scheduled run: tomorrow 5:00 PM · 4 agents · 1 deterministic  │
│                        [Open today's closeout (brass)] [Run now]    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┬─────────────────────────────────┐
│  WHAT THIS BRIEF SURFACED       │  SCHEDULE                       │
│  (ranked by pressure)           │  Daily closeout 5:00 PM  [on]   │
│  ● A court deadline needs…      │  Morning brief 8:00 AM   [off]  │
│  ● A time entry can't be…       │  On significant events   [on]   │
│  ● Litt flagged an anomaly…     │                                 │
│  ● Acme is approaching…         │  Run on demand anytime…         │
│  ● A client has gone quiet…     │                                 │
└─────────────────────────────────┴─────────────────────────────────┘
```

### Key elements

- **Dark hero** (`audit` surface, `border-radius: 16px`):
  - Mint pulse dot + `Mono` "BRIEF READY · ASSEMBLED 5:00 PM" eyebrow
  - 27px `#EFEBDB` headline: "{N} decisions need you · {crit} critical" — "critical" in `#F0A8A0` (danger-on-dark)
  - `Mono` sub: "Next scheduled run: tomorrow 5:00 PM · 4 agents · 1 deterministic router"
  - Two buttons stacked right: "Open today's closeout" — `brass` background, `forest` text (note: reversed from usual); "Run brief now" — transparent, `brass` text, `rgba(214,193,129,.35)` border
- **"WHAT THIS BRIEF SURFACED" card** (left, `1.3fr`):
  - Section header bar: "WHAT THIS BRIEF SURFACED" + "ranked by pressure" right-aligned faint
  - One row per decision: `3px left border` in danger for ESCALATION items, `transparent` for others; gate-colored dot + headline + `{KIND_META[kind]} · {client}` mono + chevron icon
  - Data from `GET /api/brief` (`sections.*` flattened, gate/pressure order)
- **"SCHEDULE" card** (right, `1fr`):
  - Clock icon + "SCHEDULE" header
  - Three toggle rows (button elements): Daily closeout / Morning brief / On significant events. `on` state: teal soft bg + teal border; `off`: wash2. Toggle pill 34×20px animated.
  - Footer: "Run on demand anytime with **Run brief now**. Every brief and every decision is appended to the audit log."
- **"Run brief now"** button: `setRunning(true)` → navigates to `/agents` after 900ms (demo redirect to show sweep).

### Data

`GET /api/brief` (same `BriefResponse` payload Overview uses). In demo mode this comes from `brief.json` fixture. "Open today's closeout" links to `/brief` (self, since this IS the brief) or navigates to the actual closeout flow when that exists.

**Gate:**
- Structural: `tsc --noEmit` clean
- Screenshot tests (`tests/visual/11-brief.spec.ts`):
  ```ts
  test('brief page loads at /brief', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/brief?frozen=1');
    await page.waitForSelector('h1');
    await expect(page).toHaveScreenshot('18-brief.png', { animations: 'disabled' });
  });
  test('overview Open the Brief navigates to /brief', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/');
    await page.getByRole('button', { name: /open the brief/i }).click();
    await expect(page).toHaveURL('/brief');
  });
  ```
- Visual: matches `18-brief.png`. Hero renders on dark `audit` bg. Decision list populates from brief fixture. Schedule toggles work (local state). "Run brief now" triggers loading state.

---

## Out of Scope for v1.1.3

These are v1.2 items and must not be built in this plan:

- Backend policy enforcement (FirmPolicy / AttorneyPolicyOverride models)
- Commitment capture and lifecycle backend (`GET /api/commitments`, `POST /api/commitments`)
- Cloud Run deployment changes
- Any new Gemini calls or agent modifications
- Multi-tenant auth (login/session)

---

## Commit Strategy

- One commit per phase, after both gates pass
- Each commit must include updated `tasks/todo.md`
- Run `tsc --noEmit` and verify it is clean before every commit
- Phase 5 (Agent Console) may require two sub-commits: graph layout + sweep/inspector wiring
- No phase skipping — if a gate fails, fix it before moving on

---

## Prototype Inspection

After each build phase, run the prototype side-by-side with your dev server to catch layout, spacing, color, type, and interaction divergences that Playwright screenshots can't catch alone.

### Serve the prototype (Part B)

The prototype uses in-browser Babel to load `.jsx` files — it must be served over HTTP (not `file://`):

```bash
# From repo root
cd "docs/ui-ux-design-handoff/ui/final-ui-reference/litt-handoff/ui-reference/prototype-source"
python3 -m http.server 8080
# or: npx serve -l 8080
```

Then open (note URL-encoded spaces):
```
http://localhost:8080/Litt%20-%20Console.html
```

**Caveats:** Needs internet (React, Babel, IBM Plex fonts load from CDN). First paint is 1–3s (Babel compiles in browser). Use a 1440px-wide browser window (DevTools → Responsive → 1440).

### Hash routing table

| Prototype hash | App route | Screenshot(s) | Plan phase |
|---|---|---|---|
| *(none)* / `#overview` | `/` | `01-overview.png` | Phase 2 |
| `#brief` | `/brief` | `18-brief.png` | Phase 12 |
| `#deadlines` | `/deadlines` | `02`, `03` | Phase 3 |
| `#collect` | `/collect` | `04-collect.png` | Phase 4 |
| `#agents` | `/agents` | `14`, `15`, `16`, `17` | Phase 5 |
| `#record` | `/ledger` | `05-record-ledger.png` | Phase 6 |
| `#policy` | `/policy` | `06`, `07` | Phase 7 |
| `#clients` | `/relationships` | `08`, `09`, `10` | Phase 8 |
| `#budgets` | `/budgets` | `11-budgets.png` | Phase 9 |
| `#anomalies` | `/anomalies` | `12-anomalies.png` | Phase 10 |
| `#integrations` | `/integrations` | `13-integrations.png` | Phase 11 |

### Side-by-side method (after each phase)

1. Two browser windows at **1440px**: left = your app route, right = prototype hash above.
2. Scroll both to the same section. Compare **layout, spacing, color, type scale, copy, chip/badge styling, hover borders.** The prototype is correct; divergence means the build is wrong.
3. For animated/stateful surfaces (Agent Console especially), drive the same state in both (run sweep, scrub to same step, click same node) and compare.
4. Only after the live side-by-side matches do you set/update the Playwright baseline (`--update-snapshots`).

### Interactive states to exercise (Agent Console)

- **Idle heartbeat:** 4 specialist agents cycling at ~2.1s each. Dock reads "Watching · `<agent>`." (`14-agents-idle.png`)
- **Run sweep:** click "Run closeout sweep." Steps auto-advance at ~640ms, 20 total. (`15-agents-toolcall.png`)
- **Scrub to step 6 or 11:** cross-agent hand-off — gold dashed edge + "Cross-agent hand-off" inspector card. (`16`)
- **Tool layer node click:** inspector shows full catalog + "17/20 deterministic · 3 Gemini" boundary stat. (`17-agents-toollayer.png`)
- **Plain/Technical toggle** (top-right) changes node copy and inspector vocabulary.

### Exact timings quick reference

| | Prototype (design target) | Live app (as-built) |
|---|---|---|
| Heartbeat interval | **2100ms** · 4 specialist agents only | **900ms** · 7 nodes |
| Sweep step cadence | **640ms** (`STEP_MS`) · 20 steps | **220ms** (`PLAYBACK_STEP_MS`) |
| Boundary stat | "17/20 deterministic · 3 Gemini" | Inspector (Log tab), counted live |

Reconcile per `DIVERGENCES.md §3` when Agent Console fidelity target is set.

---

## Reference Files

All paths relative to `docs/ui-ux-design-handoff/ui/final-ui-reference/litt-handoff/ui-reference/`.

| Need | File |
|---|---|
| As-built routes, components, API functions, types | `CURRENT-STATE.md` — **read before any phase** |
| Design vs code gaps and reconcile decisions | `DIVERGENCES.md` — **read before any phase** |
| Prototype serve instructions + side-by-side workflow | `RUN-THE-PROTOTYPE.md` — see Prototype Inspection section above |
| Shell + Overview + Rail | `prototype-source/console-shell.jsx` |
| Brief page | `prototype-source/console-brief.jsx` |
| Deadlines page | `prototype-source/console-deadlines.jsx` |
| Collect / Billing & WIP | `prototype-source/console-collect.jsx` |
| Agent Console | `prototype-source/console-agents.jsx` |
| Audit Ledger | `prototype-source/console-record.jsx` |
| Policy & Autonomy | `prototype-source/console-policy.jsx` |
| Relationships / Clients & Comms | `prototype-source/console-clients.jsx` |
| Budgets / Anomalies / Integrations | `prototype-source/console-stubs.jsx` |
| Shared atoms (Mono, Icon, Btn, GateChip) | `prototype-source/litt-flows.jsx` |
| Demo fixture data (SWEEP, DEADLINES_BOOK, COMMITMENTS, etc.) | `prototype-source/console-data.js` |
| Core decision queue + DECISIONS fixture | `prototype-source/litt-core.js` |
| Visual acceptance target (screens 01–18) | `screens/01-overview.png` … `18-brief.png` |
| Token crosswalk | `design-system.md` |
| Page build notes and port order | `_pages.md` |
| Method overview | `README.md` |
| Route → file mapping | `docs/ui-ux-design-handoff/ui/05-ui-inventory.md` |
| Backend data contracts | `docs/data-contract.md`, `docs/api-contract.md` |
