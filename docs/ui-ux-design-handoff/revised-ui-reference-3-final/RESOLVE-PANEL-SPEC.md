# Resolve Panel — full spec + coverage gap (patch item B-RESOLVE)

The action/resolution modal that opens when an attorney acts on any Brief item. **This replaces
the old generic `components/modals/*` (DeadlineModal, BillingWIPModal, BudgetModal, AnomalyModal,
ClientCommsModal) that were carried into the build by mistake** — there is **one** parameterized
`ResolvePanel`, not five bespoke modals.

- **Canonical source:** `prototype-source/litt-flows.jsx` → `ResolvePanel`, `ProofBlock`,
  `buildAuditEvent` (+ atoms `Btn`, `Icon`, `Mono`, `GateChip`). Decision data shape:
  `prototype-source/litt-core.js` → `DECISIONS`.
- **Visual targets (this folder):** `screens/resolve-01-deadline.png`,
  `resolve-02-billing-narrative.png`, `resolve-03-anomaly.png`, `resolve-04-budget.png`,
  `resolve-05-silence-comms.png` (+ the 3 user mockups). Build identical to these.
- **Live wiring:** each action maps to an existing `api.ts` function and writes one audit event.

---

## 1. Anatomy (one component, parameterized by a `decision`)

Centered modal over a dimmed backdrop (`rgba(28,30,26,.46)` + blur; click-outside / `✕` /
`Cancel` all close). Width `min(580px, 96vw)`, `maxHeight 92vh`, scrolls. Card `T.surface`,
radius 16, border `T.line`. Sections top→bottom:

1. **Header** — kind icon tile (tinted by gate: `GATE_TONE[gate]`) + `Mono` uppercase kind label
   (`KIND_META[kind]`) + client name; `✕` close. Then `<h2>` headline (20/600) + plain-language
   sub (`d.plain`).
2. **Stakes notice** — full-width tinted row with `alert` icon. ESCALATION → danger
   (`T.dangerSoft` + red border); everything else → `T.wash2` + gold icon. Text = `d.stakes`.
3. **Draft preview** *(only when `d.draft` exists — comms/silence)* — left teal border,
   "DRAFTED BY LITT · AWAITING YOU" eyebrow, italic draft body.
4. **Action selector** *(only when `d.alt` exists)* — two radio-buttons side by side:
   `d.action` (primary) + `d.alt`. Selected = forest bg + brass text + filled radio. Switching
   resets the input.
5. **Required input** *(only when the chosen action has `need`)* — label + `· required` (gold for
   `narrative`, danger for `reason`) + textarea (3 rows for narrative, 2 for reason). Helper line:
   narrative → "Goes onto the invoice and the LEDES export."; reason → "Litt never dismisses
   silently — this reason is logged forever." **Validation:** primary button disabled until
   `text.trim().length ≥ 8` (narrative) / `≥ 4` (reason). `need:null` actions need no input.
6. **Proof block** — collapsed row "Show Litt's work — source, routing & confidence" (`book`
   icon, chevron). Expands to `ProofBlock`: Reading / Litt did / Source (tagged quote) / Routing
   (chips: agent · work · llm · confidence · extra). Data = `d.proof`.
7. **Audit-log preview** — dark `T.audit` panel: shield + "WILL BE WRITTEN TO THE AUDIT LOG" +
   the `event` name (brass) + `actor=dana-strand · entity={d.id} · tier={tier}`. Computed live
   from the selected action via `buildAuditEvent` — **updates as the action radio changes.**
8. **Footer** — `Cancel` (ghost) + primary `Btn`. Primary is `danger` kind when the action is
   `writeoff`/`dismiss`/`dismiss_comms`, else `primary` (forest/brass). Label = chosen action's
   label; shows `check` icon when ready.

**Non-negotiables:** no silent action (destructive/dismiss actions REQUIRE a reason); the audit
preview must reflect the *currently selected* action; the primary stays disabled until required
text is valid.

---

## 2. The five SEED variants (designed + captured)

| # | kind / gate | primary · alt | input | audit event · tier | screen |
|---|---|---|---|---|---|
| 1 | deadline · ESCALATION | Confirm deadline · Extend / reassign | none · reason(alt) | `deadline.confirmed` / `deadline.extended` · legal | `resolve-01-deadline.png` |
| 2 | billing · REVIEW | Add narrative & approve · Write off | narrative · reason(alt) | `billing.approved` / `billing.written_off` · legal | `resolve-02-billing-narrative.png` |
| 3 | anomaly · REVIEW | Dismiss with reason | reason | `anomaly.dismissed` · operational | `resolve-03-anomaly.png` |
| 4 | budget · REVIEW | Acknowledge & log review · Request budget increase | none · reason(alt) | `budget.reviewed` / `budget.increase_requested` · operational | `resolve-04-budget.png` |
| 5 | silence · BLOCKED | Review & approve draft · Dismiss | none · reason(alt) | `comms.approved` / `comms.dismissed` · operational | `resolve-05-silence-comms.png` (has draft preview) |

Live action mapping: 1 → `confirmDeadline` / `extendDeadline`; 2 → `approveBilling`(+`updateNarrative`)
/ `writeOffBilling`; 3 → `dismissAlert`; 4 → `dismissAlert`(ack) / open request; 5 →
`approveComm`→`queueComm`→`confirm-sent` / `dismissComm`.

---

## 3. COVERAGE GAP — item types Litt surfaces that the seed corpus does NOT exercise

The demo seed only has these 5. The backend can surface more (verified against
`models.py`/agents/`types.ts`). Each below needs a Resolve Panel variant **so the UI doesn't
fall back to a generic/old modal when these appear.** I've designed them to extend the same
component; build them now.

### 3A. Deadline — VERIFY an extracted candidate  🔴 (distinct inputs)
When `deadline_agent` extracts a date from an email (`verification_status = pending_verification`,
`conflict_flagged`), the attorney must **verify**, not confirm. Needs inputs the seed card lacks:
a **date field** (`confirmed_date`) + a **classification select** (`HARD_LEGAL / HARD_CONTRACTUAL
/ SOFT_INTERNAL / ADMINISTRATIVE`). Primary "Verify deadline" → `verifyDeadline`; alt "Not a
deadline" (reason) → `dismissAlert`. Stakes: "Litt extracted this from an email at N% confidence —
confirm the date and class before it's calendared." Proof shows the source email + Gemini
confidence. **Add a structured-input mode** to the panel (date + select), not just textarea.

### 3B. Billing — WRITE-DOWN (partial reduction)  🟠
The seed billing card offers approve / write-off only. `writeDownBilling` (reduce hours/amount)
is a real third path with **numeric inputs** (`new_hours`, `new_amount`) + reason. Add as a third
action radio on the billing variant ("Write down"), revealing two small number fields + reason.
Event `billing.written_down` · legal.

### 3C. Billing — scrubber BLOCK (not WARN)  🟠
The seed shows a WARN (missing narrative). A **BLOCK** severity (forbidden phrase / guideline
violation, e.g. `NARRATIVE_FORBIDDEN_PHRASE`) is higher-stakes: gate reads ESCALATION-red, the
**offending phrase is highlighted** in the entry, primary = "Revise narrative & approve" (must
edit out the phrase; re-runs `getScrubber`), alt = write-off. Same component, danger styling +
a flagged-phrase callout. Don't let a BLOCK render as the soft WARN card.

### 3D. Inbound reply triage (`INBOX_TRIAGE`)  🔴 (new shape)
Inbound client messages surface their own action set — **not** the 2-radio pattern. When resolved
from the Brief, open a triage modal: read-only message + "what they need" summary + **action items
(with cross-agent `→` chips)** + an **editable suggested reply** + actions **Approve & send /
Edit / Snooze / Hand off**. Reuse the `InboundCard` expanded body inside the modal shell. Wiring:
Approve & send → `approveComm`→`queueComm`→`confirm-sent`; Snooze → `snoozeInbound`; dismiss →
`dismissInbound`. (Data already exists: `InboundMessage` + `suggested_reply_body`.)

### 3E. Compound escalation (`COMPOUND_RISK`)  🟠 (new shape)
The coordinator can surface a **cross-signal risk on one matter** (`CompoundEscalationCard`
exists). Its resolve modal lists the **contributing signals** (e.g. "deadline 6d + budget 78% +
silence 16d on Mercer") with a "why this compounds" synthesis, then actions: **Acknowledge &
triage** (logs review) · **Open matter** (navigate) · **Dismiss** (reason). Event
`compound.acknowledged` · operational. Single-signal cards can't represent this.

### 3F. Universal fallback — generic alert dismiss  🟢
The 11 `AnomalyType` variants (round-hours, duplicate, AI-disclosure-gap, stale-verified-deadline,
rate-anomaly, semantic-duplicate, hours/narrative-mismatch, …) all resolve via the **anomaly card
pattern (3)** — dismiss-with-reason or fix-underlying — differing only in copy/proof. No new
shape; ensure the anomaly variant is **data-driven from the escalation record** (headline,
stakes, proof) so any `AnomalyType` renders correctly. Same for the other `CommTrigger` values
(budget_threshold, deadline_approaching, invoice_issued, milestone_complete, activity_without_update)
— all use the comms/draft variant (5), data-driven.

---

## 4. Build instructions (patch item B-RESOLVE — add to the plan)

1. **Delete/retire** the old `components/modals/{Deadline,BillingWIP,Budget,Anomaly,ClientComms}Modal.tsx`
   from the resolve flow. Build **one** `ResolvePanel` (e.g. `components/console/ResolvePanel.tsx`)
   + `ProofBlock` + a `buildAuditEvent`-equivalent, ported from `litt-flows.jsx`.
2. Drive it from a normalized **decision/item descriptor** assembled from the brief item +
   escalation record (kind, gate, headline, plain, stakes, action/alt, need, proof, draft?).
   Keep it **data-driven** so 3F variants need no new component.
3. Implement the **input modes:** `none` · `textarea(reason|narrative)` · `date+select` (3A) ·
   `numeric(new_hours,new_amount)+reason` (3B).
4. Add the two **new shapes:** inbound triage (3D) and compound escalation (3E).
5. Wire each action to its `api.ts` function; every confirm writes one audit event; honor
   optimistic-lock (`expected_version`/`expected_status`) and `idempotency_key`.
6. Gate (screenshot): the 5 seed variants vs `screens/resolve-0*.png`; plus new captures for
   3A/3B/3C/3D/3E once built.

**Acceptance:** every Brief item type opens the correct Resolve Panel variant (never an old
modal); destructive/dismiss actions block until a reason is entered; the audit preview matches
the selected action and the event actually written; inbound + compound render their dedicated
shapes.

> Capture harness used to produce the seed screens: `_resolve-capture.html` (project root) —
> renders any `DECISIONS[i]` variant via `#index`. Reusable for the new variants once their
> descriptors exist.
