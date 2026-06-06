# Build Plan Patch — v1.1.3 → v1.1.4 deltas

Drop-in replacement text for `console-ui-build-plan-v1.1.3.md`. Three changes, paste-ready:

1. **NEW Phase 0f — Demo Fixtures** (insert after Phase 0e, before Phase 1)
2. **Phase 5 — corrected Agent-console timings/behaviors** (replace the "Behaviors" + test blocks)
3. **Phase 12 — Brief** (replace; the prototype Brief is a redesign, now captured as `18-brief.png`)

Plus two one-line global fixes (Vite port, snapshot determinism) folded into 0f.

> Why: with the v1.1.3 `mockAllApis` returning empty arrays, screens 02–17 render blank and
> can't match their baselines, and several read endpoints (`/api/deadlines`, `/api/budgets`,
> `/api/relationships`, `/api/inbound`, `/api/commitments`, `/api/tools`) don't exist yet. The
> Agent-console timings in v1.1.3 (900ms / 8 nodes / 220ms steps) don't match the source
> (2100ms / 4 agents / 640ms). Both are fixed below.

---

## 1. NEW — Phase 0f — Demo Fixtures (data the pages render from)

**Build after Phase 0e, before Phase 1.** Every populated page and every screenshot gate
depends on this. For v1.1.3 this is a **frontend-only** build: the read endpoints the pages
need don't exist yet, so all data-driven pages render from **static fixtures ported verbatim
from the prototype source**, with `// TODO v1.2:` markers to swap for live endpoints later.
This is the same approach v1.1.3 already used for commitments — now applied **consistently**
to every data page, and shared with the Playwright harness so visual gates can pass.

### 0f.1 Port the prototype data into JSON fixtures

Create `dashboard/src/demo-fixtures/`. Port each array **verbatim** (exact values, IDs, copy)
from the prototype source — these ARE the demo content the screenshots show:

| Fixture file | Source (in `prototype-source/`) | Feeds | App endpoint (v1.2) |
|---|---|---|---|
| `brief.json` | derive to match demo counts (see 0f.2) | Overview, Brief | `GET /api/brief` *(exists)* |
| `sweep.json` | `console-data.js` → `SWEEP` (20 steps) + `PLAIN[]` | Agent console | `POST /api/sweep` *(exists; shape adapter in v1.2)* |
| `tools.json` | `console-data.js` agent/tool defs + `SWEEP` `tool` entries | Agent console catalog | `GET /api/tools` *(new, v1.2)* |
| `deadlines.json` | `console-data.js` → `DEADLINES_BOOK` | Deadlines | `GET /api/deadlines` *(new, v1.2)* |
| `inbound.json` | `console-clients.jsx` → `INBOUND` | Relationships §1 | `GET /api/inbound` *(new, v1.2)* |
| `commitments.json` | `console-clients.jsx`/`console-data.js` → `COMMITMENTS` | Relationships §2 | `GET /api/commitments` *(new, v1.2)* |
| `relationships.json` | `console-clients.jsx` → `CLIENTS`, `COMMS_LOG` | Relationships §3–4 | `GET /api/relationships` *(new, v1.2)* |
| `budgets.json` | `console-stubs.jsx` → `BUDGETS` | Budgets | `GET /api/budgets` *(new, v1.2)* |
| `anomalies.json` | `console-stubs.jsx` → `DETECTORS` + cleared list | Anomalies | from `brief.anomalies` + static roster |
| `audit-log.json` | `console-record.jsx` → `LEDGER` | Audit ledger | `GET /api/audit-log` *(exists)* |

**`sweep.json` shape** — keep the prototype step shape exactly (the ported `AgentConsole`
consumes it directly); each of the 20 steps is:
```jsonc
{
  "agent": "billing_agent",
  "type": "TOOL_CALL",                 // observation type
  "commit": "REVIEW_REQUIRED",         // AUTO_SAFE | REVIEW_REQUIRED | ESCALATION | BLOCKED
  "work": "tool_write",                // deterministic | llm_assisted | tool_write | human_gate
  "tool": { "name": "run_prebill_scrubber", "kind": "compute",
            "sig": "run_prebill_scrubber(entry) → Flag[]", "result": "te-001 · MISSING_NARRATIVE" },
  "model": null, "conf": null,         // model+conf present only on llm_assisted steps
  "from": null, "to": null,            // from/to set only on ROUTE_HANDOFF steps
  "desc": "Ran all 9 entries through the 7-rule scrubber — one came back flagged."
}
```
> The real `POST /api/sweep` returns `AgentRunTimeline.observations` (fields
> `observation_type` / `commitment_level` / `work_kind` / `data.tool`). v1.2 adds a thin adapter
> from that shape to the step shape above; for v1.1.3 the fixture uses the step shape directly.
> Do **not** invent steps — port all 20 (the boundary stat is `total − llm_assisted = 17/20`).

### 0f.2 `brief.json` must reflect the demo numbers

Overview + Brief derive their counts from the brief. The fixture's sections must yield:
deadlines **12 tracked / 1 unconfirmed HARD_LEGAL** (Mercer, 6d), billing **$1,500 held / 1
scrubber block**, budgets **Acme 78% (1 over 75%)**, comms **1 silent matter + 3 inbound**,
anomalies **1 elevated / 2 cleared** — totalling **5 decisions / 1 critical**. If the existing
`backend/tests/fixtures/brief.json` already matches, reuse it; otherwise create
`demo-fixtures/brief.json` to these values.

### 0f.3 One demo data layer, shared by app + tests

Add `dashboard/src/demo-fixtures/index.ts` mapping endpoint → fixture, and have `api.ts` serve
from it when the live endpoint is absent (guard with `import.meta.env.VITE_DEMO ?? true` for
v1.1.3). Playwright imports the **same** JSON so the gate renders identical content:

```ts
// dashboard/tests/visual/fixtures.ts
import brief from '../../src/demo-fixtures/brief.json';
import sweep from '../../src/demo-fixtures/sweep.json';
import tools from '../../src/demo-fixtures/tools.json';
import deadlines from '../../src/demo-fixtures/deadlines.json';
import inbound from '../../src/demo-fixtures/inbound.json';
import commitments from '../../src/demo-fixtures/commitments.json';
import relationships from '../../src/demo-fixtures/relationships.json';
import budgets from '../../src/demo-fixtures/budgets.json';
import auditLog from '../../src/demo-fixtures/audit-log.json';
import type { Page } from '@playwright/test';

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

### 0f.4 Deterministic snapshots (fixes flaky gates)

Full-page screenshots of animated surfaces are non-deterministic. Add, before this phase's gate
is usable:

- **Disable CSS animations** in the matcher: `toHaveScreenshot(name, { animations: 'disabled' })`
  globally via `expect.toHaveScreenshot` in `playwright.config.ts`.
- **Freeze JS-driven motion** (the Agent-console idle heartbeat is a `setInterval`, not CSS):
  gate it on a test flag — when `?frozen=1` is in the URL (or `prefers-reduced-motion: reduce`),
  start `idleIdx` at `0` and **do not** start the interval or auto-advance a sweep. Playwright
  navigates with `?frozen=1`.
- **Mask dynamic text**: pass `mask: [page.locator('[data-dynamic]')]` for the elapsed readout
  (`+8.3s`) and any wall-clock text. Tag those nodes `data-dynamic` when porting.

### 0f.5 Two infra fixes (from the v1.1.3 review)

- **Vite port:** v1.1.3's `playwright.config.ts` uses `port: 3000` / `baseURL: localhost:3000`,
  but Vite defaults to **5173**. Either set `server.port = 3000` in `vite.config.ts` **or**
  change the Playwright `baseURL`/`webServer.port` to `5173`. They must agree.
- **`brief.json` import:** confirm `backend/tests/fixtures/brief.json` exists and matches
  `BriefResponse`; if not, use `demo-fixtures/brief.json` (0f.2) and import that instead.

**Gate (Phase 0f):** `tsc --noEmit` clean; `npm run test:visual` runs (harness loads fixtures,
no page tests yet); every fixture imports without type error.

---

## 2. Phase 5 — REPLACE the "Behaviors" subsection and its tests

Replace the v1.1.3 Phase 5 **Behaviors** block (the `setInterval 900ms…` bullets) and the
Phase 5 test block with the following. Values verified against
`prototype-source/console-agents.jsx`.

### Behaviors (corrected)

**Idle heartbeat** (no sweep running, nothing selected):
- `setInterval` at **2100ms** (not 900ms), cycling **only the 4 specialist agents**
  `['deadline_agent','billing_agent','comms_agent','anomaly_agent']` — NOT the
  coordinator/tool/audit/brief.
- For the active idle agent, the highlighted set is **that agent + its mapped input sources +
  the coordinator** (and the edges between them), using:
  ```ts
  const AGENT_SOURCES = {
    deadline_agent: ['calendar', 'matters'],
    billing_agent:  ['time'],
    comms_agent:    ['matters', 'gmail'],
    anomaly_agent:  ['time'],
  };
  ```
- Bottom dock reads `● Watching · <Agent display name>`.

**During a sweep** (from `sweep.json` / `POST /api/sweep`):
- Steps auto-advance at **`STEP_MS = 640`** (not 220ms). **20 steps** total.
- The firing node ring-highlights; **source-mapping is driven by the step's tool kind**, not the
  agent alone: a step whose `tool.kind === 'read'` lights that agent's `AGENT_SOURCES` + the
  coordinator + the agent. (Other kinds light the agent ± tool/audit/brief per the prototype's
  `stepGraph()` — port that function as-is.)
- The live tool chip under the node shows `tool.name` + a `tool.kind` badge; the wire on the
  active edge animates.
- Elapsed readout: `+${(step * 0.64).toFixed(1)}s` (tag it `data-dynamic` for snapshot masking).

**ROUTE_HANDOFF step** (steps where `from`/`to` are set — the Mercer hand-off and the Reyes
commitment hand-off): a gold dashed edge bows between the `from` and `to` agent nodes; both
highlight; the inspector shows a "Cross-agent hand-off" card.

**Boundary stat** (inspector idle state): **computed**, not hard-coded —
`deterministic = total − count(work === 'llm_assisted')` → renders `17/20` with `3` Gemini.

**Plain / Technical toggle**, **two-way inbox channel** (teal dashed Gmail↔Client Comms),
**agent-node click → "Tools it can call"**, **Tool layer click → full catalog + boundary
stat**: port verbatim from source.

### Tests (corrected — frozen for determinism)

```ts
test('agent console — idle state (frozen)', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/agents?frozen=1');         // freeze heartbeat at idleIdx=0, no autostart
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

// Sweep playback states are deterministic when you SCRUB to a fixed step (don't rely on timers):
test('agent console — tool-call step (billing scrubber)', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/agents?frozen=1');
  await page.getByTestId('sweep-step').nth(13).click();   // step 14: run_prebill_scrubber
  await expect(page).toHaveScreenshot('15-agents-toolcall.png', {
    animations: 'disabled', mask: [page.locator('[data-dynamic]')],
  });
});

test('agent console — cross-agent hand-off', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/agents?frozen=1');
  await page.getByTestId('sweep-step').nth(5).click();    // step 6: comms → deadline hand-off
  await expect(page).toHaveScreenshot('16-agents-handoff.png', { animations: 'disabled' });
});

test('agent console — tool catalog', async ({ page }) => {
  await mockAllApis(page);
  await page.goto('/agents?frozen=1');
  await page.getByText('Tool layer', { exact: false }).click();
  await expect(page).toHaveScreenshot('17-agents-toollayer.png', { animations: 'disabled' });
});
```
> Requires `data-testid="sweep-step"` on each scrubber segment and `?frozen=1` honored by the
> page. With these, all four agent screens are reproducible in CI — not "verify manually."

---

## 3. Phase 12 — REPLACE (Brief is a redesign, now captured)

Replace the v1.1.3 Phase 12 ("validate existing `DailyCloseoutBrief` at `/brief`") with:

**File:** `dashboard/src/pages/Brief.tsx` (new) **Source:** `console-brief.jsx`
(`window.ConsoleBrief`) **Screen:** `screens/18-brief.png`

The prototype's Brief is a **redesign and does not match the existing
`DailyCloseoutBrief.tsx`.** To faithfully reproduce the design, **port `console-brief.jsx`** as
the `/brief` page. Keep the existing `DailyCloseoutBrief` logic only where it provides real
data wiring (brief fetch, action handlers); the **layout/visual** must match `18-brief.png`:

- Header: `<h1>` "Brief" + "THE CENTERPIECE" teal tag + sub.
- **Dark hero** (`audit` surface): "BRIEF READY · ASSEMBLED 5:00 PM" (mint dot) + big "5
  decisions need you · 1 critical" ("1 critical" in danger) + sub ("Next scheduled run… · 4
  agents · 1 deterministic router") + "Open today's closeout" (brass) and "Run brief now"
  (outline) buttons.
- **Two columns:** left "WHAT THIS BRIEF SURFACED" ranked list (gate-dot + title + kind·client +
  chevron, "ranked by pressure"); right "SCHEDULE" card (Daily closeout 5:00 PM on / Morning
  brief 8:00 AM off / On significant events on) + on-demand footer note.
- Data: `GET /api/brief` (same payload as Overview); list = `sections.*` flattened, ordered by
  gate/pressure. "Open today's closeout" / "Run brief now" wire to existing brief/sweep actions.

**Gate:** `tsc --noEmit` clean; screenshot test vs `18-brief.png`
(`tests/visual/11-brief.spec.ts`, `goto('/brief?frozen=1')`, `animations:'disabled'`); Overview
"Open the Brief" navigates to `/brief`.

> If you deliberately choose to **keep** the existing `DailyCloseoutBrief` instead (descope the
> Brief redesign), then say so explicitly and **remove `18-brief.png` from the gated set** — do
> not leave Brief half-matched. The design intent is the prototype; `18-brief.png` is the target.

---

## Summary of edits to apply

- [ ] Insert **Phase 0f** after 0e; renumber nothing else (it's additive).
- [ ] Replace Phase 5 **Behaviors** + tests with §2 above.
- [ ] Replace **Phase 12** with §3 above; add `18-brief.png` to the screens set.
- [ ] Fold the **Vite port** + **snapshot determinism** fixes (0f.4–0f.5) into Phase 0e/0f.
- [ ] In Phase 8, change inbound data source from "`GET /api/inbound` + `snoozeInbound()`" to
      the `inbound.json` fixture + local-only snooze/dismiss (those api.ts helpers don't exist
      yet) — consistent with the commitments treatment.
- [ ] Update the "What Stays" note: v1.1.3 is **frontend-only**, all data pages render from
      `demo-fixtures/` with `// TODO v1.2` endpoint swaps (no backend changes — now true).
