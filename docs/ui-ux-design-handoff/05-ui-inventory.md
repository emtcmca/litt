# 05 — UI Inventory (Console shell, tokens, prototype→file map)

The Console is a new React shell that wraps and extends the existing dashboard. This doc maps
every prototype file to its target, gives the design-token crosswalk (so you reuse the repo's
CSS vars instead of the prototype's hard-coded palette), and lists the components to build.

---

## Prototype files → target frontend

The prototype is plain React via Babel with a global `T` palette and `window.LITTC` fixtures.
Port each to a typed component under `dashboard/src/`, swapping fixtures for `api.ts` calls and
`T.*` for CSS vars.

| Prototype file | Role | Target |
|---|---|---|
| `Litt - Console.html` | shell host, script load order, keyframes | `App.tsx` routes + `ConsoleShell.tsx` + `index.css` keyframes |
| `console-shell.jsx` | left rail (Watch/Collect/Prove/Tune), hash routing, user | `components/console/ConsoleShell.tsx`, `ConsoleRail.tsx` |
| `console-brief.jsx` | Overview/Brief | extend existing `DailyCloseoutBrief.tsx` |
| `console-deadlines.jsx` | Deadlines hero (timeline, ladder, book) | `pages/Deadlines.tsx` (+ `DeadlineTimeline`, `CadenceLadder`) |
| `console-collect.jsx` | Collect/billing hero | `pages/Collect.tsx` (reuse `BillingWIPModal` bits) |
| `console-agents.jsx` | **Agent console graph** | `pages/AgentConsole.tsx` (+ `AgentGraph`, `ToolChip`, `Inspector`, `Catalog`) |
| `console-record.jsx` | Audit ledger | `pages/AuditLedger.tsx` (reuse `AuditEventDrawer.tsx`) |
| `console-policy.jsx` | Policy & autonomy | `pages/Policy.tsx` (+ `PolicyRule`, `ThresholdControl`) |
| `console-clients.jsx` | Relationships (inbound + commitments + going quiet) | `pages/Relationships.tsx` (+ `InboundCard`, `CommitmentTracker`, `RelationshipBoard`) |
| `console-stubs.jsx` | Budgets / Anomalies / Integrations | `pages/Budgets.tsx`, `Anomalies.tsx`, `Integrations.tsx` |
| `console-data.js` | fixtures (`window.LITTC`) | **delete** — replaced by `api.ts` + real endpoints |

> The existing `AgentRunTimeline.tsx` is a vertical drip-list of observations. **Keep it** as a
> "log" tab/panel inside the Agent console, but the primary view is the new node-graph
> (`AgentGraph`). Both read the same `AgentRunTimeline` payload.

---

## Design-token crosswalk (use repo CSS vars, not the `T` palette)

`dashboard/src/index.css` already defines the system. Map the prototype's `T.*` to it. Do not
introduce a third palette. Approximate intent (confirm exact hex against `index.css`; adjust the
ramp step to match the prototype's depth):

| Prototype `T.*` | Meaning | Repo CSS var (intent) |
|---|---|---|
| `T.forest` (deep green) | primary action, brand ink | `--color-text-brand` / a dark green ramp; buttons use it as bg with `T.brass` text |
| `T.brass` / `T.gold` | accent, warnings, "held" | `--color-ramp-amber-*` (gold), brand brass for on-forest text |
| `T.teal` | success, "warm", Gemini-assisted | `--color-ramp-teal-*` |
| `T.danger` | critical, unconfirmed, slipped | `--color-ramp-red-*` / `--color-text-danger` |
| `T.ink` / `T.muted` / `T.faint` | text hierarchy | `--color-text-primary` / `-secondary` / `-tertiary` |
| `T.surface` / `T.wash2` / `T.soft` / `T.line` | card bg / subtle bg / hairlines | `--color-background-primary|secondary` / `--color-border-tertiary` |
| `T.audit` (near-black) + `T.auditAccent` (mint) | dark "engine room" panels | a dark surface token + teal accent (used on Agent console, ledger strip, "how it works" cards) |

The four-gate badge colors already exist in `AgentRunTimeline.tsx` (`GATE_SPEC`) and the
`work_kind` chip colors (`WORK_KIND_SPEC`) — **reuse those exact mappings** in the graph so the
log and graph agree:
`AUTO_SAFE`=teal, `REVIEW_REQUIRED`=blue, `ESCALATION`=amber, `BLOCKED`=red;
`deterministic`=tertiary, `llm_assisted`=blue ("gemini"), `tool_write`=teal, `human_gate`=amber.
Add `route`=brass for the new hand-off `work_kind`.

**Typography:** IBM Plex Sans (UI) + IBM Plex Mono (`--font-mono`, used for labels/values/ids).
The prototype's uppercase mono micro-labels = the repo's existing mono label convention.

---

## Components to build (net-new), grouped

**Shell**
- `ConsoleShell` — grid: rail + scrollable content; owns hash route → active surface.
- `ConsoleRail` — the four sections + items; Prove **above** Tune (we reordered this); active
  state; user chip at the bottom.

**Agent console** (the biggest net-new piece — see `03-agent-core/04`)
- `AgentGraph` — node layout (Signals in → Coordinator → Specialist agents → On the record),
  edges, live flow animation, **idle heartbeat** (cycles a soft highlight through each agent
  when no sweep is running), **source-mapping** (on an agent's read step, light only its input
  sources), **hand-off edges** (gold dashed, `ROUTE_HANDOFF`), **two-way inbox channel** (teal
  dashed Gmail↔Comms with legend).
- `ToolChip` — live chip under a firing node naming the tool call.
- `Inspector` — right panel: TOOL CALL card / Cross-agent hand-off card / per-agent "Tools it
  can call" list / Tool layer catalog. Boundary stat ("N/M deterministic · K Gemini").
- `SweepControls` — run / replay / step scrubber (drives playback over `timeline.observations`).
- Keep `AgentRunTimeline` as the "log" tab.

**Relationships**
- `InboundCard` (collapsed + expanded), `CommitmentTracker` / `CommitmentCard` / `StageRail`,
  `RelationshipBoard`, `CommsLog`.

**Deadlines**: `DeadlineTimeline`, `CadenceLadder`, `DeadlineBook`.
**Policy**: `PolicyDial`, `PolicyRuleRow`, `ThresholdStepper`.
**Ledger**: `LedgerRow` (expand → before/after diffs; reuse `AuditEventDrawer`), `LedgerFilters`,
`LedgerStatStrip`, JSON export.
**Budgets/Anomalies/Integrations**: `BudgetBar`, `DetectorRoster`, `IntegrationCard`.

**Shared**: `Icon` (port the prototype's inline icon set or swap for the repo's icon lib),
`Mono` (mono label), `SubHead`, `StatStrip`, `GateBadge`/`WorkKindChip` (reuse existing).

---

## Routing

Replace the prototype's hash routing with React Router (the repo already uses it). Suggested:

```
/                 Overview (DailyCloseoutBrief, reframed)
/deadlines        Deadlines hero
/collect          Collect/billing hero
/relationships    Clients & comms (inbound + commitments + going quiet)
/budgets /anomalies              Watch stubs
/agents           Agent console        (digest deep-links here)
/ledger           Audit ledger         (digest "view the ledger" → here; alias existing /audit)
/policy /integrations            Tune
```

Keep `/email-preview` and the `TimerHUD` mount. Preserve deep-link routes from the API contract
(`/deadline/{id}`, `/comms/draft/{id}`, etc.) by opening the relevant surface with the entity
focused.

---

## Behaviors to preserve from the prototype (don't lose these)

- **Idle heartbeat** on the Agent console (always-watching ambience).
- **Source-mapping**: a deadline read lights Calendar + Matter store only; billing lights Time;
  comms lights Matter store + Gmail.
- **Two-way inbox channel** (Gmail↔Comms) with the legend.
- **Cross-agent hand-off edges** + inspector cards.
- **Commitment ledger flash** ("commitment.kept written to the audit ledger" → view link).
- **Mark kept/Slipped** only on tracked/active commitments (never on `PENDING`).
- **Tool chips + catalog + boundary stat** computed from the run, not hard-coded.
- All **"days out / days silent / X ago"** values server-computed from the effective date.
