# Page-by-Page Build Guide

Port in this order. For each surface: the **screenshot(s)** (visual target, in `screens/`),
the **source file + component** (canonical implementation, in `prototype-source/`), the
**target** React file, and **build notes** — the specific things to get right that a glance
won't tell you.

Conventions: every page is a centered column (`max-width ~920–980px`) on the `paper` canvas
inside the shell. All `days/$/counts` come from the API in the real build (the source uses
`window.LITTC` fixtures — replace with `api.ts`). Translate exact spacing/color/copy from
source; verify against the screenshot.

---

## 0 · Shell + Rail  →  `console-shell.jsx` (`ConsoleApp`, `NAV`, `Overview`)
Screens: every screenshot shows the rail.

- Left rail `background: forest`, ~232px, fixed full height. Logo "Litt." + firm name top.
- Four nav groups with `Mono` uppercase labels: **Watch** (Overview/Brief, Deadlines, Budgets,
  Clients & comms, Anomalies), **Collect** (Billing & WIP), **Prove** (Agent console, Audit
  ledger), **Tune** (Policy & autonomy, Integrations). **Prove is above Tune.**
- Active item = brass-tinted rounded pill (see Overview screenshot: "Overview" active). Items
  carry a small right-aligned count badge when they have items needing attention.
- Bottom of rail: "All systems nominal" status dot + last-sweep time + integrations count, then
  a user chip (avatar "DS" + "Dana Strand / Attorney") with a dropdown caret.
- Content area scrolls independently; rail does not.
- Route by hash in prototype → React Router in repo (`../05-ui-inventory.md` has the map).

---

## 1 · Overview  →  `console-shell.jsx` (`Overview`)  ·  also extend `DailyCloseoutBrief.tsx`
Screen: `01-overview.png`

- Eyebrow `Mono`: "May 29, 2026 · 5:00 PM · operations overview". `<h1>` greeting "Morning,
  Dana." Sub line with **bold** item count.
- "Open the Brief" forest button (arrow icon).
- "The Books" section: a 3-col grid of cards, one per Watch/Collect surface, each with: icon +
  title + "N needs you" danger pill (right), a big tracked number, and a one-line status.
- Bottom row: a **dark** "Agents" card ("see them work →"), a "Policy & autonomy" card, an
  "Integrations" card. The dark Agents card is the visual hook into the engine room.
- Numbers map to brief section counts (+ new `inbound`/`commitments` counts, doc 02 §5).

---

## 1b · Brief  →  `console-brief.jsx` (`window.ConsoleBrief`)
Screen: `18-brief.png`

- **This is a redesign — it does NOT match the repo's existing `DailyCloseoutBrief.tsx`.** To
  reproduce the design at `/brief`, port `console-brief.jsx`; do not keep the current component
  unchanged. (See the plan-review note + the drop-in Phase 12 replacement.)
- Header: `<h1>` "Brief" + "THE CENTERPIECE" teal tag + descriptive sub.
- **Dark hero card** (`audit` surface): "BRIEF READY · ASSEMBLED 5:00 PM" eyebrow (mint dot),
  big "5 decisions need you · 1 critical" (the "1 critical" in danger), a sub line ("Next
  scheduled run… · 4 agents · 1 deterministic router"), and two right-aligned buttons —
  "Open today's closeout" (brass) + "Run brief now" (outline, refresh icon).
- **Two-column body:** left = "WHAT THIS BRIEF SURFACED" card, a ranked list (gate-colored dot +
  title + "kind · client" mono + chevron), "ranked by pressure" label. Right = "SCHEDULE" card
  with three toggle rows (Daily closeout 5:00 PM = on; Morning brief 8:00 AM = off; On
  significant events = on) + a footer note about on-demand runs writing to the audit log.
- Data: the brief content is `GET /api/brief` (the same payload Overview uses). The ranked list
  is `sections.*` flattened and ordered by gate/pressure.

---

## 2 · Deadlines  →  `console-deadlines.jsx` (`ConsoleDeadlines`/`window.ConsoleWatch`, `Timeline`, `ClsChip`)
Screens: `02-deadlines-top.png` (callout + 45-day timeline), `03-deadlines-book.png` (book table + cadence ladder)

- Header: `<h1>` "Deadlines" + "core job" gold tag + descriptive sub.
- **Critical callout** card (danger-bordered): the one UNCONFIRMED HARD_LEGAL (Mercer) — big
  "6 days out" number tile, headline, `ClsChip`, "Confirm in closeout" forest button.
- **45-day horizon timeline**: a horizontal axis with week gridlines (+7…+42d), a "TODAY"
  marker, and class-colored pins with little label cards (date / client / Nd · class). Pins
  alternate above/below the line. Unconfirmed pin pulses. See `Timeline` component for the
  exact geometry (positions are `% = daysOut/horizon`).
- **The book** (left, ~1.55fr): filterable table (All / Needs confirmation / Court·legal /
  Owned by you) with columns Matter·what's due / Class / Due / Owner. Unconfirmed rows get a
  danger left-border + tint. Confirmed rows show a teal check.
- **Cadence ladder** (right, ~1fr): the 14·7·3·1 escalation windows, each showing which
  HARD_LEGAL items sit in that window (live ones tinted), + a "beyond 14d · watching" footer.
- **Dark "How it runs" card** below the ladder (deterministic note).
- Promise rows from commitments appear here as `SOFT_INTERNAL` with a "promise" chip
  (doc 03-02).

---

## 3 · Collect / Billing & WIP  →  `console-collect.jsx` (`window.ConsoleCollect`)
Screen: `04-collect.png`

- Billing hero over existing pre-bill/scrubber/WIP data. Header + tag + sub.
- Translate the source's card layout exactly (held entry callout, WIP table, budget/utilization
  context). Reuse existing `BillingWIPModal` data + actions; this is a new *layout*, not new
  data. Held entry (te-001, $1,500, MISSING_NARRATIVE) is the anchor.

---

## 4 · Agent console  →  `console-agents.jsx` (`ConsoleAgents`, `GraphNode`, inspector, scrubber)
Screens: `14-agents-idle.png` (idle heartbeat), `15-agents-toolcall.png` (mid-sweep tool call),
`16-agents-handoff.png` (cross-agent hand-off), `17-agents-toollayer.png` (tool catalog)

**This is the highest-risk page — study all four screenshots + the source closely.**

- Header: `<h1>` "Agent console" + "THE ENGINE ROOM" tag + sub; top-right **Plain English /
  Technical** toggle + **Run/Resume sweep** forest button.
- **The graph** fills the page in 4 columns with `Mono` captions: **Signals in** (Gmail,
  Calendar, Matter store, Time & billing) → **Router** (Coordinator) → **Specialist agents**
  (Deadline Monitor, Billing Reconciliation, Client Comms, Anomaly Escalation) → **On the
  record** (Tool layer, Audit log, Your Brief). Each node is a card with icon, title, a
  PYTHON/GEMINI tag, a plain/technical description, and a "N handled · M to you" footer.
- Edges are thin curved connectors. **Behaviors (all visible in the screenshots):**
  - **Idle heartbeat** (`14`): when no sweep runs, a soft brass highlight cycles through each
    agent (dock reads "Watching · <agent>"); faint ambient flow on the wires; coordinator core
    "breathes."
  - **Live flow** (`15`): during a sweep the firing agent node is ring-highlighted, its input
    sources light up (source-mapping — billing lights "Time & billing" only), a **live tool
    chip** appears under the node (`run_prebill_scrubber() COMPUTE`), and a wire animates.
  - **Cross-agent hand-off** (`16`): a gold dashed edge bows between Client Comms and Deadline
    Monitor on `ROUTE_HANDOFF` steps.
  - **Two-way inbox channel**: a teal dashed Gmail↔Comms line with a "two-way inbox channel"
    legend (top-right of the graph).
- **Right inspector** (appears during/after a step or on node click): a "LIVE · STEP n" header,
  a "Your call / plain-English" explanation, and a **TOOL CALL** card (function name +
  signature + result + kind badge). Clicking an agent node → "Tools it can call" list; clicking
  the **Tool layer** node (`17`) → the full catalog grouped by agent + per-kind counts + the
  **boundary stat** ("17/20 deterministic · 3 Gemini").
- **Bottom scrubber**: play/pause + a segment bar (one segment per sweep step, colored by
  gate), "Step n of 20", elapsed time. Steps are driven by `timeline.observations` from
  `POST /api/sweep` in the real build (source uses the `SWEEP` array).
- Keep the existing `AgentRunTimeline.tsx` drip-list available as a "log" tab.

---

## 5 · Audit ledger  →  `console-record.jsx` (`ConsoleRecord`, `RecRow`, `RecDiff`)
Screen: `05-record-ledger.png`

- Header + "append-only" tag + "Export JSON" forest button.
- **Dark stat strip**: events today / legal-record count / your-decisions vs Litt / last-write
  time + production note (Cloud Audit Logs, restricted IAM).
- **Filter toolbar**: tier pills (All / Legal record / Operational / System) + actor pills
  (Everyone / Litt / You).
- **Rows**: time · tier badge · event_type + summary · actor. Click to expand → metadata grid
  (entity, actor, tier, idempotency_key) + **before → after diff** (two dark JSON panels with
  an arrow between). Reuse `AuditEventDrawer.tsx` for the expanded content.
- Backed entirely by existing `GET /api/audit-log`; new event types (`commitment.*`,
  `policy.updated`, `INBOUND_TRIAGED`) appear automatically.

---

## 6 · Policy & autonomy  →  `console-policy.jsx` (`ConsolePolicy`, `PolicyRule`, `ThresholdControl`)
Screens: `06-policy.png` (dial + scope banner), `07-policy-domains.png` (domain rule rows)

- Header + "tune" tag + sub.
- **The dial** (dark panel): "Current posture" label + big state word (Fully gated / Assisted /
  Max safe autonomy) + "% of safe autonomy used" + a gradient track (gold→mint) + 3 axis labels.
- **Scope banner**: firm-admin vs attorney view (icon + copy + role tag).
- **Domain sections** (Billing / Deadlines / Comms / Anomalies): each a card with rule rows.
  Each row: label (+ "firm-locked" danger pill where applicable), note, "Firm floor: …", and a
  control on the right — either a **GATED/AUTO segmented toggle** (Ask me / Auto + log) or a
  **tighten-only stepper** (`−`/`+`, `+` disabled at the firm floor, "tightened" tag when below
  floor). Firm-locked rows show a non-interactive "Always gated" pill.
- Footer note: every change writes `policy.updated` to the ledger; gate enforced at tool layer.
- Enforcement is real server-side (doc 02 §3 / 04-02) — the UI is the control surface.

---

## 7 · Relationships / Clients & comms  →  `console-clients.jsx`
Screens: `08-relationships-inbound.png`, `09-relationships-commitments.png`, `10-relationships-quiet.png`
Components: `ConsoleClients`, `InboundCard`, `CommitmentTracker`/`CommitmentCard`/`StageRail`, `SubHead`, `warmth()`

Page order (preserve exactly):
1. Header ("relationships" teal tag) + summary strip (Awaiting your reply / Going quiet / Warm)
   + a read-only-inbox note.
2. **`SubHead` "Awaiting your response"** (danger tone) → inbound triage cards. **First card
   (Mercer) is expanded** (`08`): avatar + name/role, urgency pill ("High · awaiting 2d"),
   read-only original message (italic, left-border), a 2-col triage grid ("What they need" +
   "Why it surfaced" signal chips | "Action items" with a `→ Deadline Monitor` cross-link +
   "Handed to Deadline Monitor" box), a **suggested reply** card (held, Gemini badge, grounding
   rows), and actions (Approve & send forest / Edit / Snooze / Hand off). Two collapsed cards
   below (Lindqvist; Acme with a `→ Billing` cross-link).
3. **`SubHead` "Commitments you've made"** (teal) → **`CommitmentTracker`** (`09`): stat strip
   (Active / Due soon / Kept / Slipped) + explainer; then **`CommitmentCard`s** each with the
   verbatim quote, a status pill, a 3-stage **`StageRail`** (Captured → Tracked → Outcome), a
   footer with due date + on-deadline-book/→Deadline-Monitor link + **Mark kept / Slipped**
   buttons (absent on `PENDING`), and a ledger-write flash on action. A "Closed this period"
   group holds the Kept + Slipped cards.
4. **`SubHead` "Going quiet"** (gold) (`10`): the Whitmore silence hero (days-silent tile +
   held Gemini draft + grounding + Review/Dismiss), then the **relationship board** (every
   matter, a recency bar vs the 14-day threshold marker, warm/quiet/silent pill + Nd).
5. **Comms log** + the dark **"How Litt handles your comms"** (Read → Draft → Hold) card.

Inbound + commitments are net-new backend (docs 03-01, 03-02); "going quiet" maps to existing
`comms_agent` silence detection.

---

## 8 · Budgets  →  `console-stubs.jsx` (`ConsoleBudgets`)
Screen: `11-budgets.png`

- `PageHead` "Budgets" (watch tag). Stat strip (budgeted matters / over-75% / thresholds).
- Utilization list: per matter, a bar with a **75% threshold marker**, WARN/CRITICAL pill,
  `$committed / $cap`, and a big % (teal/gold/danger by band). Acme 78% = the WARN anchor; rows
  past threshold get a left-border + a "Review budget" link. Over `compute_budget_utilization`.

## 9 · Anomalies  →  `console-stubs.jsx` (`ConsoleAnomalies`)
Screen: `12-anomalies.png`

- `PageHead` "Anomalies". Open ELEVATED item callout (te-001 MISSING_NARRATIVE, "reason
  required to clear", "Resolve in closeout"). Then a 2-col: **detector roster** (grid of
  detectors, fired ones flagged) + **cleared today** list. Clearing requires a reason (existing
  dismiss action). List the *real* detectors from `anomaly_agent` + scrubber — don't invent 13.

## 10 · Integrations  →  `console-stubs.jsx` (`ConsoleIntegrations`)
Screen: `13-integrations.png`

- `PageHead` "Integrations" (tune tag). Card grid: Gmail / Calendar (connected, read-only) /
  LEDES (export ready) / Clio (available, "Connect" stub). Each: icon tile, name, via-MCP
  caption, status pill, detail line, footer with sync time + connect/least-privilege note.
  Presentational; emphasize read-only / least-privilege scopes.

---

## Coverage checklist (every Console route has a target)

`/` Overview · `/deadlines` · `/collect` · `/agents` · `/ledger` · `/policy` ·
`/relationships` · `/budgets` · `/anomalies` · `/integrations`  — all mapped above.
