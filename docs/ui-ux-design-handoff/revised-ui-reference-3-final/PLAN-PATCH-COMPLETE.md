# Build Plan Patch — COMPLETE (v1.1.3)

Single source of truth for **every** correction to `console-ui-build-plan-v1.1.3.md`, from the
full plan review + backend verification. Apply each item to the named phase. Supersedes the
narrower `PLAN-PATCH-phase2-phase5.md` (its content is folded in here).

Severity: 🔴 blocking (wrong/empty/crash) · 🟠 should-fix (accuracy) · 🟢 confirmed-correct
(listed so nobody "fixes" it) · ⚙️ decision (needs a human call).

Companion doc: **`BACKEND-TASK-tool-observations.md`** — the approved Path-B backend change
referenced by P5/P0f below.

---

## A. Decisions already made (apply as fact)

- **A1 — Path B approved (backend exception).** The backend will emit `data.tool` on `TOOL_CALL`
  observations so the Agent Console's chips/signatures/boundary work on **live** data. See
  `BACKEND-TASK-tool-observations.md`. This supersedes the earlier "frontend-only `work_kind`
  reframe" fallback everywhere it appears.
- **A2 — Demo date is NOT displayed** (product decision). Remove any demo-date/time string from
  the Overview eyebrow and anywhere else in the UI. Greeting may still be computed internally
  from `brief.generated_at`, but the date itself is never rendered.

---

## B. Patch items by phase

### Phase 0d — shared atoms
- 🟠 **B-0d.1** Source line numbers (`litt-flows.jsx 22–46`, `console-shell.jsx 120–184`, etc.)
  are approximate and will drift. Instruct: **locate atoms by symbol name** (`Mono`, `Icon`,
  `Btn`, `GateChip`, `PageHead`, `Shell`, `ClsChip`, `SubHead`), not by line number.

### Phase 0e/0f — Playwright + fixtures
- 🔴 **B-0f.1** `sweep.json` must use the **real `AgentObservation[]` shape**
  (`agent_name` — **NOT `agent_id`**; the plan's fixture example used `agent_id`, which is wrong
  and would break node activation since `AgentGraph` keys on `AGENT_TO_NODE[obs.agent_name]`),
  plus `observation_type`, `commitment_level`, `work_kind`, `data.tool`, `data.handoff`,
  `model_name`, `confidence`, `description` — not the prototype `SWEEP` shape. Per A1, include
  `data.tool = {name, kind, signature, result}` on `TOOL_CALL` steps so test screenshots show
  chips, **and** the live backend now emits the same (so live matches tests).
- 🟢 **B-0f.2** Port **3000** + backend proxy **8002** are correct (`vite.config.ts`); Playwright
  `port:3000` matches. `animations:'disabled'` belongs in `expect.toHaveScreenshot`. `?frozen=1`
  + `data-dynamic` masking for JS-driven motion. (All already in the plan — keep.)
- 🟢 **B-0f.3** `brief.json` must yield the demo counts (5 decisions / 1 critical, etc.). Real
  `BriefSections` keys apply (see B-2.1).

### Phase 1 — Shell / Rail / Routing
- ⚙️ **B-1.1** `/audit` alias. The plan repoints `/audit` → `AuditLedger`, **dropping the legacy
  `AuditLog` page** currently mounted at `/audit`. Current code has BOTH `/audit`→`AuditLog`
  (legacy) and `/ledger`→`AuditLedger`. **Decide:** drop `AuditLog` (plan as written), or keep
  both routes. If unsure, keep both — it's harmless and preserves the legacy view.
- 🟢 **B-1.2** Rail rebuild to forest/brass + "Litt." wordmark + 4-section (Prove above Tune) is
  the intended target (overrides the as-built teal/mint rail). Correct.

### Phase 2 — Overview  🔴 (will crash as written)
- 🔴 **B-2.1** Replace the "Data strategy" table. The plan's `sections.billing` / `sections.budget`
  / `sections.comms` **do not exist**. Real `BriefSections` keys (from `types.ts`): `deadlines`,
  `time_entries`, `budget_risks`, `client_silence`, `anomalies`, `compound_escalations`,
  `inbox_items`. Use:

  | Book card | Count | `needsYou` | Line text |
  |---|---|---|---|
  | Deadlines | `sections.deadlines.count` | `items.filter(i => i.is_unconfirmed).length` / `.has_critical` | "N unconfirmed HARD_LEGAL · nearest Nd" |
  | Billing & WIP | `sections.time_entries.count` | items with `has_block` | "$X held · N scrubber block" (`$X` = `total_wip_usd` or Σ held amounts) |
  | Budgets | `sections.budget_risks.count` | items `alert_status ∈ {WARN,CRITICAL}` | "N client over 75% · Acme 78%" (`utilization_pct`) |
  | Clients & comms | `sections.client_silence.count` | `sections.inbox_items.count` | "N silent matter · N awaiting reply" |
  | Anomalies | `sections.anomalies.count` | items `risk_level ∈ {ELEVATED,CRITICAL}` | "N elevated" |

- 🟠 **B-2.2** "· N cleared" on the Anomalies book card is **static copy** — the brief has no
  cleared count. Keep static or drop; don't try to derive it.
- 🔴 **B-2.3** (per A2) Eyebrow line must **omit the demo date/time**. Prototype shows
  "May 29, 2026 · 5:00 PM · operations overview" → render just the contextual label (e.g.
  "operations overview"), no date. Greeting bucket may still derive from `generated_at`
  internally; the date is not shown.

### Phase 3 — Deadlines  🟠
- 🟠 **B-3.1** `GET /api/deadlines` (`getDeadlinesFull` → `RawDeadline[]`) returns
  `client_id`/`matter_id` only — **no `client_name`/`matter_name`**. The timeline/book label
  cards must join names client-side (from `getMatters` / `getRelationships`) or read the brief's
  `BriefDeadlineItem` (which carries `client_name`). Do not render raw IDs.
- 🟢 **B-3.2** `RawDeadline` does carry `days_out`, `classification`, `escalation_level`,
  `verification_status`, `status` — enough for the timeline/cadence ladder logic.

### Phase 5 — Agent Console  🔴 (highest risk)
- 🔴 **B-5.1** Bind to the **real `AgentObservation`** fields (live `runSweep()`), not the
  prototype `SWEEP` shape:
  - `observation_type` ∈ 12: `SIGNAL_RECEIVED, REASONING, ROUTING_DECISION, TOOL_CALL, RESULT,
    ESCALATION, APPROVAL_GATE_APPLIED, MATTER_SYNTHESIS, COMPOUND_RISK, INBOX_TRIAGE, WARN_NOTICE,
    ROUTE_HANDOFF`.
  - `work_kind` ∈ 5: `deterministic, llm_assisted, tool_write, human_gate, route` — **distinct
    from** `ToolKind` ∈ 4 (`read, write, compute, gemini`, registry only). *(Doc gap, fix
    independently: `observability.py:83` and `types.ts:281` JSDoc list only 4 — both omit
    `route`, which `comms_agent.py:1058` really emits. Comments only; no runtime impact.)*
  - `data.handoff = {from, to, entity_id?, reason?}` on `ROUTE_HANDOFF` — **present live** ✓.
  - `data.tool = {name, kind, signature, result}` on `TOOL_CALL` — **now present live per A1**
    (`BACKEND-TASK-tool-observations.md`).
- 🔴 **B-5.2** **Adapt `stepGraph()`; do not "port verbatim."** Drive node activation from
  `obs.agent_name` + `obs.observation_type` (as the current `AgentGraph.tsx` does); hand-off edge
  from `obs.data.handoff`; source lighting on `SIGNAL_RECEIVED` (not `tool.kind==='read'`). Real
  source map: `deadline_agent:['calendar','matter']`, `billing_agent:['billing']`,
  `comms_agent:['matter','gmail']`, `anomaly_agent:['billing','matter']`.
- 🟢 **B-5.3** Per A1, the **existing `Inspector` works as-is** — `ToolCallCard` reads
  `data.tool`, `BoundaryStat` counts `TOOL_CALL` where `data.tool.kind==='gemini'`. No rebind
  needed once the backend emits `data.tool`. (The earlier "count `work_kind`" instruction is
  **withdrawn**.)
- 🟠 **B-5.4** Playback length = **`timeline.observations.length`** (live, variable) — **do not
  hardcode 20**. "20 steps" + the scrubber test indices (`nth(13)`, `nth(5)`) apply only to the
  Playwright **fixture** `sweep.json`, authored with the hand-off at index 5 and the scrubber
  call at index 13.
- 🟢 **B-5.5** Idle heartbeat **2100ms / 4 specialist agents** and **640ms/step** are the
  intended target (overrides the as-built 900ms/7-node, 220ms). `?frozen=1` → `idleIdx=0`, no
  interval/auto-advance.
- 🟠 **B-5.6** Honest boundary number: the live "deterministic vs Gemini" count is **whatever the
  seeded sweep emits** (not a hardcoded "17/20 · 3 Gemini"). Tune via which steps are instrumented
  + seed data, never by faking `kind`. (See backend task §5.)

### Phase 7 — Policy  🟢
- 🟢 **B-7.1** No policy API/types exist → build as **local state**; the "changes write to the
  audit ledger" footer is aspirational (true once the v1.2 policy engine lands). Already noted in
  the plan — keep. Do not wire to a nonexistent endpoint.

### Phase 8 — Relationships  🟢 / 🟠
- 🟢 **B-8.1** `getInbound`, `snoozeInbound`, `dismissInbound`, `getRelationships` all **exist and
  are wired** (verified). Inbound triage + going-quiet bind to live data. `InboundMessage` carries
  `urgency_signals`, `action_items[]` (+`handoff_agent`), `suggested_reply_body`, `cross_agent`.
- 🟠 **B-8.2** **Commitments have no backend** (no type, no API). Build §2 of the page UI-only
  from a local fixture, marked `// TODO v1.2: GET /api/commitments`. Do not wire to an endpoint.

### Phase 10 — Anomalies  🟠
- 🟠 **B-10.1** The detector roster is **static/display-only**. The prototype shows **13**
  detectors; the real `AnomalyType` enum has **11**. Don't map the roster 1:1 to the enum or to
  live data — it's a presentational list. Open ELEVATED item + cleared list come from
  `sections.anomalies` (+ static "cleared" copy, see B-2.2).

### Phase 12 — Brief  🔴 / ⚙️
- 🔴 **B-12.1** Replacing `DailyCloseoutBrief.tsx` wholesale with a port of `console-brief.jsx`
  **drops shipped functionality**: the current brief renders `compound_escalations` +
  `inbox_items` sections and uses `CompoundEscalationCard`, `WarnNotice`, `GeminiLabel`. The
  prototype brief (`18-brief.png`) is a simpler hero + ranked-list + schedule.
  ⚙️ **Decide:** port the prototype's **hero/schedule/ranked-list layout** but **retain** the real
  `compound_escalations` + `inbox_items` content (recommended), OR consciously drop them. Don't
  silently lose demo-relevant sections. Whatever is chosen, preserve the existing brief's data
  wiring/action handlers.

---

## C. Confirmed-correct — do NOT second-guess

- Dev server **:3000**, backend proxy **:8002**, React 19 + react-router-dom 7, Tailwind 4.
- All read routes exist: `/tools`, `/deadlines`, `/inbound`, `/budgets`, `/relationships`,
  `/sweep`, `/audit-log`, `/matters` + inbound snooze/dismiss actions.
- `data.handoff` is emitted live (hand-off card + gold edge work).
- `AGENT_SOURCES` real values (B-5.2). Forest/brass palette + new brand tokens are the target.
- Commitments + Policy are local-only (no endpoints). Fixtures are Playwright-only; the app uses
  real `api.ts` functions where endpoints exist.
- 4-section rail, Prove above Tune; `animations:'disabled'` + `?frozen=1` determinism.

---

## E. Resolve Panel — action/resolution modals (item B-RESOLVE)

The modal that opens when an attorney acts on any Brief/Console item. **One parameterized
`ResolvePanel`, not bespoke per-type modals.** Retire the old
`components/modals/{Deadline,BillingWIP,Budget,Anomaly,ClientComms}Modal.tsx` from the resolve
flow — they were carried into the build by mistake. Full detail + the 5 seed screenshots live in
`RESOLVE-PANEL-SPEC.md`; this section is the build-ready summary + design params for the variants
that have **no screenshot proof** (must be built to written spec).

Canonical source: `prototype-source/litt-flows.jsx` → `ResolvePanel` / `ProofBlock` /
`buildAuditEvent`; atoms `Btn`/`Icon`/`Mono`/`GateChip`. Tokens: `design-system.md`.

### E.1 Base anatomy (all variants share this shell)
Centered modal, dimmed backdrop `rgba(28,30,26,.46)`+blur, click-out/`✕`/`Cancel` close. Card
`background:T.surface`, radius **16**, border `T.line`, width `min(580px,96vw)`, `maxHeight 92vh`
scroll. Order: **(1) Header** — 30px kind-icon tile tinted by `GATE_TONE[gate]` + `Mono` uppercase
kind label + client; `✕`. **(2)** `<h2>` headline 20/600 + plain sub 14/`T.muted`. **(3) Stakes
notice** — tinted row, `alert` icon; ESCALATION→`T.dangerSoft`+red border, else `T.wash2`+gold.
**(4) Action selector** *(if `alt`)* — two radios; selected = `T.forest` bg + `T.brass` text +
filled dot. **(5) Required input** *(if action.need)* — label + `· required` (gold=narrative,
danger=reason) + textarea; border turns `T.teal` when filled. **(6) Proof block** — collapsible
"Show Litt's work — source, routing & confidence" → `ProofBlock` (Reading/Litt did/Source/Routing
chips). **(7) Audit preview** — dark `T.audit` panel: shield + "WILL BE WRITTEN TO THE AUDIT LOG"
+ `event` (brass) + `actor · entity · tier`, **recomputed live as the action changes**. **(8)
Footer** — `Cancel` (ghost) + primary `Btn` (`danger` kind for writeoff/dismiss, else `primary`),
disabled until required text valid (`≥8` narrative / `≥4` reason).
**Invariants:** no silent action (destructive/dismiss require a reason); audit preview tracks the
selected action; primary disabled until valid.

**Input modes the component must support:** `none` · `textarea(reason|narrative)` ·
`date+select` (E.3a) · `numeric(new_hours,new_amount)+reason` (E.3b). Drive everything from a
normalized **item descriptor** (`{kind, gate, headline, plain, stakes, action, alt?, need?,
proof, draft?}`) so most variants need no new component.

### E.2 Seed variants (designed + captured — build identical to PNGs)
| kind/gate | primary · alt | input | event · tier | screen | api |
|---|---|---|---|---|---|
| deadline · ESCALATION | Confirm · Extend/reassign | none · reason | `deadline.confirmed`/`.extended` · legal | `resolve-01-deadline.png` | `confirmDeadline`/`extendDeadline` |
| billing · REVIEW | Add narrative & approve · Write off | narrative · reason | `billing.approved`/`.written_off` · legal | `resolve-02-billing-narrative.png` | `approveBilling`+`updateNarrative`/`writeOffBilling` |
| anomaly · REVIEW | Dismiss with reason | reason | `anomaly.dismissed` · operational | `resolve-03-anomaly.png` | `dismissAlert` |
| budget · REVIEW | Acknowledge & log review · Request increase | none · reason | `budget.reviewed`/`.increase_requested` · operational | `resolve-04-budget.png` | `dismissAlert`(ack)/open request |
| silence · BLOCKED | Review & approve draft · Dismiss | none · reason | `comms.approved`/`.dismissed` · operational | `resolve-05-silence-comms.png` (draft preview block) | `approveComm`→`queueComm`→`confirm-sent`/`dismissComm` |

### E.3 NEW variants — NO screenshot; build to these design params
These cover prod item types absent from the demo seed. Reuse the E.1 shell unless noted.

**E.3a — Deadline VERIFY (extracted candidate)** 🔴 *new input mode*
Trigger: `verification_status=pending_verification` / `conflict_flagged` (Gemini-extracted).
Header kind `deadline`, gate **ESCALATION** (red tile). Headline "Verify this deadline before
it's calendared". Plain: "Litt extracted this date from an email — confirm it's real before it
goes on the book." Stakes (red): "An unverified date is not yet protecting you — verify the date
and class, or mark it not a deadline." **Inputs (replace the textarea):** a **date field**
(label "Confirmed due date", default = extracted date) **+ a classification `select`**
(`HARD_LEGAL · HARD_CONTRACTUAL · SOFT_INTERNAL · ADMINISTRATIVE`, default = extracted class).
Both required. Action selector: **Verify deadline** (primary) · **Not a deadline** (alt, `reason`,
danger). Proof shows source email quote + `confidence` chip. Audit: `deadline.verified` · legal
(verify) / `deadline.dismissed` · operational (alt). API: `verifyDeadline({confirmed_date,
classification})` / `dismissAlert`. Layout: date+select sit in the input slot as a 2-col row
(date left, select right), each `flex:1`, same 9px-radius `T.line` inputs as the textarea.

**E.3b — Billing WRITE-DOWN (partial reduction)** 🟠 *new input mode, extends billing variant*
Add a **third** action radio to the billing card: **Write down**. When selected, reveal **two
numeric fields** — "New hours" and "New amount ($)" (small, side by side, `flex:1`, numeric,
prefilled with current values) — **plus** a `reason` textarea (required). Primary label "Write
down & approve" (`primary` kind — it's an approval, not a destructive purge). Audit
`billing.written_down` · legal. API `writeDownBilling({new_hours,new_amount,reason})`. Validation:
both numbers > 0 and < current, reason `≥4`.

**E.3c — Billing scrubber BLOCK (vs WARN)** 🟠 *severity variant of billing*
Trigger: a scrubber **BLOCK** flag (e.g. `NARRATIVE_FORBIDDEN_PHRASE`/guideline violation), not
the seed's WARN. Same billing shell but: gate **ESCALATION** (red stakes), and a **flagged-phrase
callout** above the input — a `T.dangerSoft` row showing the offending phrase in `T.danger` mono
with the guideline source (`scrubber_flags[].matched_text` + `.message`). Primary "Revise
narrative & approve" requires editing the narrative so it no longer contains the phrase
(re-run `getScrubber` on submit; keep disabled while `has_block`). Alt "Write off" (reason).
Audit `billing.approved` (post-revision) · legal. API `updateNarrative`→`approveBilling`;
`getScrubber` to re-validate.

**E.3d — Inbound reply triage (`INBOX_TRIAGE`)** 🔴 *new shape (not the 2-radio pattern)*
Reuse the expanded `InboundCard` body inside the modal shell. Sections: header (sender avatar +
name/role + client/matter + urgency pill `High/Med/Low · awaiting Nd`); **read-only message**
(italic, left-border, "from Gmail · read-only"); a 2-col triage grid — **"What they need"**
(summary) + **"Why it surfaced"** signal chips | **"Action items"** (each with optional cross-agent
`→ Deadline Monitor`/`→ Billing` chip) and a "Handed to {agent}" box when `cross_agent`;
**Suggested reply** card (held, "Gemini" badge, **editable** textarea prefilled with
`suggested_reply_body`, grounding rows). Footer actions: **Approve & send** (primary forest) ·
**Edit** (focus the reply) · **Snooze** · **Hand off**. Audit `comms.approved`→`comms.sent` · ops.
API: `approveComm`→`queueComm`→`confirm-sent`; `snoozeInbound`; `dismissInbound`. Width may grow to
`min(680px,96vw)` to fit the 2-col grid. Data exists: `InboundMessage` + `suggested_reply_body`.

**E.3e — Compound escalation (`COMPOUND_RISK`)** 🟠 *new shape*
Cross-signal risk on one matter (the `CompoundEscalationCard` content, in a modal). Header kind
`shield`/gate per severity (`ELEVATED`=gold, `CRITICAL`=red); headline = the matter risk (e.g.
"Three signals are compounding on Mercer"). Body: **contributing-signals list** — each row an icon
+ one-liner ("Court deadline · 6d · unconfirmed", "Budget · 78%", "Silent · 16d") linking to that
item; then a **"why this compounds"** synthesis paragraph (`what_is_happening`/`why_it_matters`).
Actions: **Acknowledge & triage** (primary, `none`) · **Open matter** (navigate) · **Dismiss**
(alt, `reason`, danger). Proof shows the coordinator route + the member escalation IDs. Audit
`compound.acknowledged`/`compound.dismissed` · operational. API `dismissAlert` (alert_type
`compound`) + client-side navigation.

**E.3f — Universal fallback** 🟢
The other 11 `AnomalyType`s and other `CommTrigger`s reuse the **anomaly (E.2)** and **comms
(E.2)** variants respectively — **data-driven** from the escalation/draft record (headline,
stakes, proof, draft). No new component; ensure copy/proof come from the record, not hardcoded.

### E.4 Build + acceptance
Build one `components/console/ResolvePanel.tsx` (+ `ProofBlock`, `buildAuditEvent`-equiv) from
`litt-flows.jsx`; data-drive from the item descriptor; implement the 4 input modes + the 2 new
shapes (E.3d, E.3e). Wire each action to its `api.ts` fn; one audit event per confirm; honor
`expected_version`/`expected_status` + `idempotency_key`. **Acceptance:** every item type opens
the correct variant (never an old modal); dismiss/destructive blocked until reason entered; audit
preview matches the selected action and the event written; E.3a date+select & E.3b numeric inputs
validate; inbound (E.3d) + compound (E.3e) render their dedicated shapes. Capture screenshots for
E.3a–E.3e (harness `_resolve-capture.html`) once descriptors exist, then gate them.

---

## D. Apply-order checklist

1. ☐ A1/A2 recorded; **schedule `BACKEND-TASK-tool-observations.md`** (it unblocks Phase 5 live).
2. ☐ B-2.1 / B-2.3 (Overview crashes without the key fix + date removal).
3. ☐ B-12.1 decision (Brief content retention) before Phase 1 moves/replaces the brief.
4. ☐ B-1.1 decision (`/audit` alias).
5. ☐ B-5.1/.2/.4 (Agent Console bindings) — backed by the Phase-5 backend task.
6. ☐ B-3.1 (deadline name join), B-8.2 (commitments local), B-10.1 (detector roster static).
7. ☐ B-0f.1 (sweep.json real shape + `data.tool`), B-0d.1 (symbol-not-line).
8. ☐ **B-RESOLVE** (§E): one `ResolvePanel`, retire old modals; build 5 seed variants (gated vs
   PNGs) + the new E.3a–E.3e variants to written params; data-drive E.3f.
9. ☐ Confirm §C items are untouched.
