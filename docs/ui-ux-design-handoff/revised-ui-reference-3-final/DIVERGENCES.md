# DIVERGENCES — as-built code vs. design target

The current code (`CURRENT-STATE.md`) and the prototype design (`screens/` + `prototype-source/`)
disagree in specific, enumerable ways. This is the reconcile list. Each item: **what the design
shows**, **what the code does**, and the **decision** needed. Nothing here is a bug — the team
built solid groundwork; these are the deltas to close (or consciously accept) to reach the
design.

> **One decision gates most of the others — read §1 first.** Until the palette direction is
> settled, pixel work will thrash.

---

## 1. 🔴 Palette: forest/brass vs teal/mint  — DECISION REQUIRED

- **Design (prototype):** brand is **forest green `#14221F` + brass `#D6C181` + gold `#A98435`**.
  Rail and primary buttons are forest with brass text; warm off-white content.
- **Code (built):** brand is **near-black `#111C19` + teal/mint `#5DCAA5`/`#9FE1CB`/`#1D9E75`**.
  No `forest`/`brass`/`gold` tokens were added; the rail active state is a mint left-border, not
  a brass pill. Gold appears only on the Agent-console hand-off edge.

**Decision:** pick the target palette.
- If **forest/brass** (match the screenshots): add the brand tokens (see
  `design-system.md` §1) and migrate the rail, active states, buttons, and dark panels. This is
  a cross-cutting change but mostly token-level.
- If **teal/mint** (keep what's built): the screenshots are stale as a **color** reference;
  **layout, spacing, type, and structure still apply.** Update `design-system.md`'s crosswalk to
  teal/mint and treat color in the screenshots as "ignore."

Everything below assumes you'll reconcile color per this decision; the rest are layout/behavior.

---

## 2. 🟠 Navigation: grouping, labels, and the missing Overview

| | Design (prototype `console-shell.jsx`) | Code (`ConsoleRail.tsx`) |
|---|---|---|
| Top of rail | **Overview** (`/`) + **Brief** (`#brief`), ungrouped | no Overview; **Brief = `/`** under "Watch" |
| Watch | Deadlines, Budgets, Clients & comms, Anomalies | Brief, Deadlines, Relationships |
| Collect | Billing & WIP | Billing, **Anomalies**, **Budgets** |
| Prove | Agent console, Audit ledger | Agents, Audit Ledger ✓ |
| Tune | Policy & autonomy, Integrations | Policy, Integrations ✓ |
| Icons | custom SVG `Icon` set | Unicode glyphs (◈ ⊙ ↔ …) |
| Logo | "Litt." brass wordmark + teal dot | lowercase "litt" mint |
| User area | 3-user dropdown + system-status block | single DS chip |

**Decisions:**
- **Overview page:** the design has a distinct Overview landing ("Morning, Dana." + Books grid,
  `01-overview.png`) separate from the Brief. The code has **no Overview** — `/` is the Brief.
  Either (a) build `Overview` at `/` and move the Brief to `/brief` (matches design), or (b)
  accept Brief-as-home and drop the Overview screen. **Pick one.**
- **Anomalies/Budgets placement:** design puts them under **Watch**; code puts them under
  **Collect**. Align to the design or accept the code's grouping.
- Icons/logo/user-area: low-stakes; align when convenient.

---

## 3. 🟠 Agent Console: layout & behavior

| Aspect | Design (`14`–`17`, `console-agents.jsx`) | Code (`AgentGraph`/`AgentConsole`) |
|---|---|---|
| Node style | rich 4-column **cards** w/ icon, PYTHON/GEMINI badge, description, "N handled · M to you" | small **mono-label chips**, no badges/desc |
| Columns | labeled Signals in · Router · Specialist agents · On the record | Signals-in row + coordinator + agents row + outputs; only "Signals in"/"On the record" labels |
| Plain/Technical toggle | yes | **none** |
| Idle heartbeat | 2100ms, **4 specialist agents** (+ sources + coordinator) | **900ms, 7 nodes** (coord+4 agents+audit+brief) |
| Playback cadence | 640ms/step (prototype) | **220ms/step** (`PLAYBACK_STEP_MS`) |
| Headline metric | "17/20 deterministic · 3 Gemini" boundary stat up top | post-run **stats strip** (Observations/Escalations/Brief items/Triggered by); boundary stat lives in Inspector |
| Source-mapping | per **tool kind** of the step (read → sources) | only on `SIGNAL_RECEIVED` |
| Graph size | fluid, fills page | fixed **760×480** |

**Decision:** how close to the prototype must the Agent console get? It's the highest-effort
surface. Options: (a) restyle the existing chip graph to the card design + add the toggle +
retune timings (substantial), or (b) keep the built graph and accept the simpler visual. If (a),
note the data already supports it (`AgentObservation.data.tool`, `work_kind`, `model_name`,
`data.handoff` are all present) — it's a rendering upgrade, not a data change.

> The **boundary stat counts `obs.data.tool.kind === 'gemini'`** over `TOOL_CALL`s. For the
> demo numbers to read "17/20 · 3 Gemini," the sweep's observations must carry `data.tool.kind`
> on every tool call and exactly 3 must be `gemini`. Verify the live sweep produces this
> (`backend` sweep emission), or the headline will be wrong.

---

## 4. 🟡 Commitments — design feature with NO backend

The prototype's Relationships page §2 is a **"Commitments you've made" lifecycle tracker**
(`09-relationships-commitments.png`): capture → tracked → kept/slipped, Mark-kept/slipped,
ledger flash. The code has **no `Commitment` type, no API, no data**. 

**Decision:** either descope commitments from `/relationships` for now (recommended until the
backend exists — see the earlier `03-agent-core/02-commitment-capture.md` spec), or build it
UI-only against a local fixture clearly marked `// TODO: GET /api/commitments`. Do **not** wire
it to a nonexistent endpoint.

---

## 5. 🟡 Policy — UI only, no persistence

`Policy.tsx` has no API (`getPolicy`/`setPolicy` don't exist; no `FirmPolicy` type). The design's
dial + tighten-only steppers + firm-locked rules should be built as **local state** with the
"changes write to the audit ledger" footer noted as **aspirational** (true once the policy
engine lands — see `02-data-contracts.md` §3). Don't claim persistence the backend can't honor.

---

## 6. 🟡 Brief — redesign vs the existing component

`/` renders the **existing `DailyCloseoutBrief.tsx`**. The prototype's Brief
(`18-brief.png`, `console-brief.jsx`) is a **redesign** (dark "5 decisions need you · 1 critical"
hero + "What this brief surfaced" ranked list + Schedule panel). **Decision:** port the redesign
or keep the existing brief. If keeping the existing one, drop `18-brief.png` from the gated set
so it isn't held to a target you're not building.

---

## 7. 🟢 Things the code got right (align, don't change)

- Four-section rail (Watch/Collect/Prove/Tune) and the Prove-above-Tune order.
- Routes `/ledger` (new AuditLedger) + `/audit` (legacy) coexist.
- Real read endpoints exist and are wired (`getDeadlinesFull`, `getBudgets`, `getRelationships`,
  `getInbound`) — the data layer the earlier handoff said to add is **built**.
- Inbound triage data contract (`InboundMessage` with `urgency_signals`, `action_items` +
  `handoff_agent`, `suggested_reply_body`, `cross_agent`) matches the design's `InboundCard`.
- Agent observability (`AgentObservation` w/ `data.tool`, `data.handoff`, `work_kind`,
  `model_name`) fully supports the prototype's Agent-console depth — it's a rendering gap, not a
  data gap.
- DemoBanner + demo date `2026-06-25` + `getDemoReady`/`resetDemo` are wired.

---

## Suggested reconcile order

1. **Settle §1 (palette)** — unblocks all pixel work.
2. Decide §2 Overview/nav and §6 Brief (information architecture).
3. Restyle pages to the screenshots (layout/spacing/type) per the chosen palette.
4. Decide §3 Agent-console fidelity level (biggest effort).
5. Descope/local-only §4 commitments and §5 policy persistence until backends exist.
