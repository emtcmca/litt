# Resolve Panel Build Plan — v1.1.3 Modal Redesign

**Spec source:** `docs/ui-ux-design-handoff/revised-ui-reference-3-final/RESOLVE-PANEL-SPEC.md`  
**Patch source:** `docs/ui-ux-design-handoff/revised-ui-reference-3-final/PLAN-PATCH-COMPLETE.md` §E  
**Backend source:** `docs/ui-ux-design-handoff/revised-ui-reference-3-final/BACKEND-TASK-tool-observations.md`  
**Target location:** `dashboard/src/components/console/ResolvePanel.tsx`  
**Retire:** `dashboard/src/components/modals/{Deadline,BillingWIP,Budget,Anomaly,ClientComms}Modal.tsx`

**Revision:** Post-review corrections applied (10 issues — see §Corrections below).

---

## Design system reference

All styling uses `T` tokens from `dashboard/src/tokens.ts`. No CSS variables from the old system.

| Token | Value | Usage |
|---|---|---|
| `T.surface` | `#FFFFFF` | Modal card background |
| `T.line` | `rgba(20,20,18,0.12)` | Modal card border, input borders (unfocused) |
| `T.forest` | `#14221F` | Primary button bg, selected radio bg |
| `T.brass` | `#D6C181` | Primary button text, audit event name, selected radio text |
| `T.gold` | `#A98435` | Stakes icon (non-escalation), narrative `required` label |
| `T.teal` | `#1D9E75` | Input border when filled/focused |
| `T.tealSoft` | `rgba(29,158,117,.10)` | Draft preview left border |
| `T.danger` | `#9B2D23` | Danger button text, reason `required` label |
| `T.dangerSoft` | `#F6E4DF` | ESCALATION stakes background |
| `T.wash2` | `#F8F7F4` | Non-escalation stakes background |
| `T.soft` | `rgba(20,20,18,0.07)` | Chip backgrounds |
| `T.audit` | `#11140F` | Audit preview panel background |
| `T.auditAccent` | `#9EE1C7` | Audit preview shield icon color |
| `T.auditMuted` | `#9DA89A` | Audit preview secondary text |
| `T.ink` | `#2C2C2A` | Primary text |
| `T.muted` | `#6F6D67` | Secondary text |
| `T.faint` | `#A9A7A1` | Tertiary/placeholder text |

Font families: `var(--font-mono)` for chips/labels/code, `var(--font-sans)` for body.

---

## Gate → tone map (GATE_TONE)

**Correction #3:** GATE_TONE is `{fg, bg, bd}` per gate, not a single color. BLOCKED = slate, not gold.

```ts
interface GateTone { fg: string; bg: string; bd: string; }

const GATE_TONE: Record<string, GateTone> = {
  ESCALATION: { fg: T.danger,  bg: T.dangerSoft,          bd: T.danger },
  REVIEW:     { fg: T.gold,    bg: 'rgba(20,34,31,.07)',   bd: T.gold },
  BLOCKED:    { fg: '#3A4A44', bg: 'rgba(20,34,31,.07)',   bd: 'rgba(58,74,68,.35)' },
};
```

Icon tile usage: `background: tone.bg; border: 1px solid tone.bd; color: tone.fg`.
Stakes row: ESCALATION → `background: T.dangerSoft; border: 1px solid rgba(155,45,35,.35); borderRadius: 10`.
All other gates → `background: T.wash2; border: 1px solid rgba(169,132,53,.25); borderRadius: 10`.
Stakes icon color: `tone.fg`.

---

## Available icon names (from `Icon.tsx`)

**Correction #2:** Dashboard `Icon` component has exactly 19 names — no lucide icons. Use only these:
`check · arrow · clock · shield · alert · dollar · mail · chart · chevron · chevronD · x · book · refresh · lock · grid · sliders · plug · users · dot`

### KIND_META correct mapping

```ts
const KIND_META: Record<string, { label: string; icon: IconName }> = {
  deadline:         { label: 'DEADLINE',        icon: 'shield'  },  // shield, not calendar
  billing:          { label: 'BILLING & WIP',   icon: 'dollar'  },  // dollar, not dollar-sign
  budget:           { label: 'BUDGET RISK',     icon: 'chart'   },  // chart, not bar-chart-2
  anomaly:          { label: 'ANOMALY',         icon: 'alert'   },  // alert, not alert-triangle
  silence:          { label: 'CLIENT COMMS',    icon: 'mail'    },  // mail, not message-circle
  'client silence': { label: 'CLIENT COMMS',    icon: 'mail'    },
  inbound:          { label: 'INBOUND TRIAGE',  icon: 'mail'    },  // mail, not inbox
  compound:         { label: 'COMPOUND RISK',   icon: 'shield'  },
};
```

---

## Item descriptor type

**Correction #1 (ProofData):** nested shape, not flat. ProofBlock ports verbatim from prototype by reading `proof.what`, `proof.did`, `proof.source.*`, `proof.route.*`.

**Correction #10 (third action):** `actions: ActionDef[]` array replaces `action`/`alt` pair. Index 0 = primary (pre-selected), index 1 = alt, index 2 = tertiary (write-down). Component renders all as radios.

```ts
interface InputMode {
  type: 'none' | 'textarea' | 'date_select' | 'numeric_reason';
  field?: 'reason' | 'narrative';   // textarea only
  minLen?: number;                   // 4=reason, 8=narrative
}

interface ActionDef {
  label: string;
  event: string;              // e.g. "deadline.confirmed"
  tier: 'legal' | 'operational';
  need: InputMode;
  destructive?: boolean;      // drives danger styling on button
}

// Correction #1: nested ProofData matching prototype's ProofBlock reads
interface ProofData {
  what: string;               // "What Litt read"
  did: string;                // "What Litt did"
  source: {
    tag: string;              // e.g. "GMAIL · EMAIL"
    ref: string;              // document/source reference
    line: string;             // quoted excerpt or detail line
  };
  route: {
    agent: string;            // e.g. "deadline_agent"
    work: string;             // work_kind: deterministic|llm_assisted|tool_write
    llm: string;              // model name or "n/a"
    extra: string;            // e.g. "confidence: 0.92"
  };
  confidence?: number;
}

export interface ItemDescriptor {
  id: string;
  kind: string;               // 'deadline'|'billing'|'budget'|'anomaly'|'silence'|'inbound'|'compound'
  gate: string;               // 'ESCALATION'|'REVIEW'|'BLOCKED'
  client_name: string;
  headline: string;
  plain: string;
  stakes: string;
  actions: ActionDef[];       // [primary, alt?, tertiary?] — always at least 1
  proof: ProofData;
  draft?: string;             // comms/silence only — pre-drafted body
  // Extended shapes
  scrubber_flags?: Array<{ matched_text: string; message: string }>;  // E.3c
  extracted_date?: string;    // E.3a — prefill for date field
  extracted_class?: string;   // E.3a — prefill for classification
  current_hours?: number;     // E.3b
  current_amount?: number;    // E.3b
  inbound_message_id?: string; // E.3d — message_id to fetch full InboundMessage on open
  compound_signals?: Array<{ icon: IconName; label: string; escalation_id: string }>;
  compound_synthesis?: string;
}
```

Helper for active action: `activeActionIndex` state (0 default). `actions[activeActionIndex]` = current.
Show action selector only when `actions.length > 1`.

---

## Phase 1 — Foundation types + descriptor factory

**Files to create:**
- `dashboard/src/components/console/resolveTypes.ts` — types only
- `dashboard/src/components/console/buildDescriptor.ts` — 7 factory functions

### 1A. Descriptor factories

**`buildDeadlineDescriptor(item: BriefDeadlineItem, gate: string): ItemDescriptor`**
- `actions[0]`: `{ label: 'Confirm deadline', event: 'deadline.confirmed', tier: 'legal', need: { type: 'none' } }`
- `actions[1]`: `{ label: 'Extend / reassign', event: 'deadline.extended', tier: 'legal', need: { type: 'textarea', field: 'reason', minLen: 4 } }`
- proof: `{ what: 'Escalation schedule + matter record', did: \`Escalation level ${item.escalation_level} — ${item.days_out}d out\`, source: { tag: item.source_type ?? 'RECORD', ref: item.source_document_id ?? item.deadline_id, line: item.source_excerpt ?? '' }, route: { agent: 'deadline_agent', work: 'deterministic', llm: 'n/a', extra: '' } }`

**`buildDeadlineVerifyDescriptor(item: BriefDeadlineItem): ItemDescriptor`** (E.3a)
- **Correction #9:** trigger on `verification_status === 'conflict_flagged'` (brief assembler only passes `attorney_verified` and `conflict_flagged`; `pending_verification` never appears in brief)
- gate: `'ESCALATION'`
- `actions[0]`: `{ label: 'Verify deadline', event: 'deadline.verified', tier: 'legal', need: { type: 'date_select' } }`
- `actions[1]`: `{ label: 'Not a deadline', event: 'deadline.dismissed', tier: 'operational', need: { type: 'textarea', field: 'reason', minLen: 4 }, destructive: true }`
- `extracted_date`: `item.due_date`; `extracted_class`: `item.classification`
- headline: `'Verify this deadline before it\'s calendared'`
- stakes: `'Litt extracted this date from an email — confirm before it\'s calendared. An unverified date is not yet protecting you.'`

**`buildBillingDescriptor(item: BriefTimeEntryItem): ItemDescriptor`**
- gate: `item.has_block ? 'ESCALATION' : 'REVIEW'`
- `actions[0]`: `{ label: 'Add narrative & approve', event: 'billing.approved', tier: 'legal', need: { type: 'textarea', field: 'narrative', minLen: 8 } }`
- `actions[1]`: `{ label: 'Write off', event: 'billing.written_off', tier: 'legal', need: { type: 'textarea', field: 'reason', minLen: 4 }, destructive: true }`
- `actions[2]`: `{ label: 'Write down', event: 'billing.written_down', tier: 'legal', need: { type: 'numeric_reason' } }` (E.3b)
- `scrubber_flags`: `item.scrubber_flags`; `current_hours`: `item.hours`; `current_amount`: `item.amount`

**`buildBudgetDescriptor(item: BriefBudgetItem): ItemDescriptor`**
- gate: `'REVIEW'`
- `actions[0]`: `{ label: 'Acknowledge & log review', event: 'budget.reviewed', tier: 'operational', need: { type: 'none' } }`
- `actions[1]`: `{ label: 'Request budget increase', event: 'budget.increase_requested', tier: 'operational', need: { type: 'textarea', field: 'reason', minLen: 4 } }`

**`buildSilenceDescriptor(item: BriefClientSilenceItem): ItemDescriptor`**
- gate: `'BLOCKED'`
- `actions[0]`: `{ label: 'Review & approve draft', event: 'comms.approved', tier: 'operational', need: { type: 'none' } }`
- `actions[1]`: `{ label: 'Dismiss', event: 'comms.dismissed', tier: 'operational', need: { type: 'textarea', field: 'reason', minLen: 4 }, destructive: true }`
- `draft`: pass `null` — no direct comm-body endpoint in api.ts; silence draft body not yet fetchable client-side without a new `GET /api/comms/:id` route (mark `// TODO v1.2: fetch draft body`). Panel renders draft section only when `descriptor.draft` is non-null.

**`buildAnomalyDescriptor(item: BriefAnomalyItem): ItemDescriptor`**
- gate: `item.risk_level === 'CRITICAL' ? 'ESCALATION' : 'REVIEW'`
- `actions[0]`: `{ label: 'Dismiss with reason', event: 'anomaly.dismissed', tier: 'operational', need: { type: 'textarea', field: 'reason', minLen: 4 } }`
- headline: `item.what_is_happening`; plain: `item.what_attorney_must_decide`; stakes: `item.why_it_matters`
- proof.what: `item.what_litt_has_done`

**`buildInboundDescriptor(item: InboundMessage): ItemDescriptor`** (E.3d)
- kind: `'inbound'`; gate: `item.urgency === 'HIGH' ? 'ESCALATION' : 'REVIEW'`
- `inbound_message_id`: `item.id` (full `InboundMessage.id` field — NOT `message_id`; the brief item has `message_id` but full InboundMessage uses `id`)
- `actions`: empty (inbound shape renders its own footer actions — no shared radios)
- Rich InboundMessage is fetched inside ResolvePanel on open (see Phase 5A)

**`buildCompoundDescriptor(item: BriefCompoundEscalationItem): ItemDescriptor`** (E.3e)
- gate: `item.risk_level === 'CRITICAL' ? 'ESCALATION' : 'REVIEW'`
- `actions[0]`: `{ label: 'Acknowledge & triage', event: 'compound.acknowledged', tier: 'operational', need: { type: 'none' } }`
- `actions[1]`: `{ label: 'Dismiss', event: 'compound.dismissed', tier: 'operational', need: { type: 'textarea', field: 'reason', minLen: 4 }, destructive: true }`
- `compound_synthesis`: `item.why_it_matters`

### 1B. buildAuditEvent helper

```ts
function buildAuditEvent(
  descriptor: ItemDescriptor,
  action: ActionDef,
  attorneyId: string
): { event: string; actor: string; entity: string; tier: string } {
  return { event: action.event, actor: attorneyId, entity: descriptor.id, tier: action.tier };
}
```

**Gate:** `tsc --noEmit` green before Phase 2.

---

## Phase 2 — ProofBlock subcomponent

**File:** `dashboard/src/components/console/ProofBlock.tsx`

**Correction #1:** reads nested `ProofData` — `proof.what`, `proof.did`, `proof.source.{tag,ref,line}`, `proof.route.{agent,work,llm,extra}`, `proof.confidence`.

Collapsed: `book` icon + "Show Litt's work — source, routing & confidence" + `chevronD` icon. Expanded: 4-row grid.

```
Row 1  READING    proof.what
Row 2  LITT DID   proof.did
Row 3  SOURCE     proof.source.tag (chip) · proof.source.ref | proof.source.line (quoted, teal left-border)
Row 4  ROUTING    [agent chip] [work chip] [llm chip] [confidence chip]
```

Styling:
- Container: `background: T.wash2; borderRadius: 10; border: 1px solid T.line; padding: 12 14`
- Row label: `10px var(--font-mono) uppercase T.faint; width: 72px; flexShrink: 0`
- Source quote: left border `2px solid T.tealSoft; paddingLeft: 8; fontStyle: italic; color: T.muted`
- Chips: `background: T.soft; borderRadius: 4; padding: 1px 7px; fontSize: 11; var(--font-mono); color: T.muted`
- Confidence chip: color `T.teal` when `confidence >= 0.8`, else `T.faint`

Props: `{ proof: ProofData; defaultOpen?: boolean }`

Guard all fields — render "-" for any null/empty value; never crash on missing data.

---

## Phase 3 — ResolvePanel base shell (seed variants 1–5)

**File:** `dashboard/src/components/console/ResolvePanel.tsx`

Props:
```ts
interface ResolvePanelProps {
  descriptor: ItemDescriptor;
  firmId: string;
  attorneyId: string;
  onClose: () => void;
  onSuccess: (result: ActionResult, id: string) => void;
}
```

State: `activeActionIndex: number` (default 0), `text: string` (textarea input), `confirmedDate: string`, `classification: string` (date_select), `newHours: number | ''`, `newAmount: number | ''` (numeric), `loading: boolean`, `error: string | null`.

### 3A. Backdrop + card frame

```tsx
// Backdrop — position:fixed, inset:0
background: 'rgba(28,30,26,.46)'; backdropFilter: 'blur(3px)';
zIndex: 1000; display: flex; alignItems: center; justifyContent: center; padding: 20;

// Card
background: T.surface; borderRadius: 16; border: `1px solid ${T.line}`;
width: 'min(580px, 96vw)'; maxHeight: '92vh'; overflow: hidden;
display: flex; flexDirection: column;
```

Click backdrop → onClose. `stopPropagation` on card click. `Escape` key → onClose.

### 3B. Header (non-scrollable)

```tsx
const tone = GATE_TONE[descriptor.gate] ?? GATE_TONE.REVIEW;
const meta = KIND_META[descriptor.kind] ?? { label: descriptor.kind.toUpperCase(), icon: 'shield' };

// Icon tile
width: 30; height: 30; borderRadius: 8;
background: tone.bg; border: `1px solid ${tone.bd}`;
display: grid; placeItems: center;
// Icon: <Icon name={meta.icon} size={15} color={tone.fg} />

// Kind label (right of tile)
fontFamily: 'var(--font-mono)'; fontSize: 11; textTransform: 'uppercase';
letterSpacing: '0.08em'; color: T.faint;

// Client name (right-aligned, grows)
fontSize: 13; color: T.muted;

// ✕ close button
<Icon name="x" size={16} color={T.faint} /> onClick=onClose
```

Below tile row:
- `<h2>` headline: `fontSize: 20; fontWeight: 600; color: T.ink; margin: '16px 0 4px'`
- `<p>` plain: `fontSize: 14; color: T.muted; margin: 0`

### 3C. Scroll body (flex: 1, overflowY: auto, padding: 20)

**Stakes notice** — Correction #7: full 1px border + radius 10, NOT borderLeft:

```tsx
const isEscalation = descriptor.gate === 'ESCALATION';
// Stakes row
background: isEscalation ? T.dangerSoft : T.wash2;
border: `1px solid ${isEscalation ? 'rgba(155,45,35,.35)' : 'rgba(169,132,53,.25)'}`;
borderRadius: 10; padding: '10px 12px'; marginBottom: 16;
display: flex; gap: 10; alignItems: flex-start;
// <Icon name="alert" size={14} color={tone.fg} />
```

**Draft preview** (only when `descriptor.draft`) — Correction #8: left border only, no background:

```tsx
borderLeft: `2px solid ${T.tealSoft}`;
paddingLeft: 12; marginBottom: 16;
// no background

// Eyebrow
fontSize: 10; fontFamily: 'var(--font-mono)'; textTransform: 'uppercase';
letterSpacing: '0.08em'; color: T.teal; marginBottom: 6;
// "DRAFTED BY LITT · AWAITING YOU"

// Body
fontSize: 13; fontStyle: 'italic'; color: T.muted; lineHeight: 1.6;
```

**Action selector** (only when `descriptor.actions.length > 1`):

```tsx
display: flex; gap: 8; marginBottom: 16;

// Each option div (onClick → setActiveActionIndex(i))
flex: 1; padding: '10px 14px'; borderRadius: 10; cursor: pointer;
border: `1px solid ${active ? T.brass : T.line}`;
background: active ? T.forest : T.surface;
display: flex; alignItems: center; gap: 10;

// Radio dot
width: 16; height: 16; borderRadius: 8;
border: `2px solid ${active ? T.brass : T.line}`;
background: active ? T.brass : 'transparent';

// Label
fontSize: 14; fontWeight: active ? 600 : 400;
color: active ? T.brass : T.muted;
```

Switching index resets `text`, `confirmedDate`, `classification`, `newHours`, `newAmount`, `error`.

**Required input** (see Phase 4 for all input modes).

**Proof block** — `<ProofBlock proof={descriptor.proof} />` always present, collapsed by default.

**Audit preview**:
```tsx
background: T.audit; borderRadius: 10; padding: '12px 14px'; margin: '16px 0';
border: '1px solid rgba(158,225,199,.12)';

// Row 1
<Icon name="shield" size={13} color={T.auditAccent} />
"WILL BE WRITTEN TO THE AUDIT LOG"  — 10px mono T.auditMuted uppercase

// Row 2
activeAction.event  — 14px mono T.brass

// Row 3
`actor=${attorneyId} · entity=${descriptor.id} · tier=${activeAction.tier}`  — 12px mono T.auditMuted
```

Recomputed live from `activeAction` (derived from `actions[activeActionIndex]`).

### 3D. Footer (non-scrollable)

```tsx
borderTop: `1px solid ${T.line}`; padding: '14px 20px';
display: flex; justifyContent: flex-end; gap: 8;
```

Cancel:
```tsx
background: transparent; border: `1px solid ${T.line}`; borderRadius: 8;
padding: '9px 18px'; fontSize: 14; color: T.muted; cursor: pointer;
onClick: onClose
```

Primary button (disabled = `!isValid`):
```tsx
// Non-destructive
background: T.forest; color: T.brass; border: 'none'; borderRadius: 8;
padding: '9px 18px'; fontSize: 14; fontWeight: 600;

// Destructive (activeAction.destructive)
background: T.dangerSoft; color: T.danger; border: `1px solid ${T.danger}`;

// Disabled
opacity: 0.45; cursor: 'not-allowed'; pointerEvents: 'none';

// Icon when valid (not loading)
<Icon name="check" size={14} color="inherit" /> before label text

// Loading
label: 'Saving…'
```

Validity rules:
- `need.type === 'none'` → always valid
- `need.field === 'narrative'` → `text.trim().length >= 8`
- `need.field === 'reason'` → `text.trim().length >= 4`
- `need.type === 'date_select'` → `confirmedDate && classification` (both non-empty)
- `need.type === 'numeric_reason'` → `newHours > 0 && newHours < currentHours && newAmount > 0 && newAmount < currentAmount && reason.trim().length >= 4`

### 3E. Submit handler (event → api.ts dispatch)

```ts
async function handleSubmit() {
  const ikey = `${descriptor.id}-${activeAction.event}-${Date.now()}`;
  setLoading(true); setError(null);
  try {
    let result: ActionResult;
    switch (activeAction.event) {
      case 'deadline.confirmed':
        result = await confirmDeadline({ firm_id, attorney_id, deadline_id: descriptor.id, expected_version, idempotency_key: ikey });
        break;
      case 'deadline.extended':
        result = await extendDeadline({ ..., new_due_date: confirmedDate, reason: text, ... });
        break;
      case 'deadline.verified':
        result = await verifyDeadline({ ..., confirmed_date: confirmedDate, classification, ... });
        break;
      case 'deadline.dismissed':
        result = await dismissDeadline({ ..., reason: text, ... });
        break;
      case 'billing.approved':
        await updateNarrative({ ..., narrative: text, ... });
        result = await approveBilling({ ... });
        break;
      case 'billing.written_off':
        result = await writeOffBilling({ ..., reason: text, ... });
        break;
      case 'billing.written_down':
        result = await writeDownBilling({ ..., new_hours: Number(newHours), new_amount: Number(newAmount), reason, ... });
        break;
      case 'anomaly.dismissed':
      case 'budget.reviewed':
      case 'budget.increase_requested':
      case 'compound.acknowledged':
      case 'compound.dismissed':
        result = await dismissAlert({ ..., reason: text || undefined, ... });
        break;
      case 'comms.approved':
        result = await approveComm({ ..., draft_id: descriptor.id, ... });
        await queueComm({ ... });
        break;
      case 'comms.dismissed':
        result = await dismissComm({ ..., reason: text, ... });
        break;
    }
    if (result.success) onSuccess(result, descriptor.id);
    else setError(result.message ?? 'Action failed');
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Request failed');
  } finally { setLoading(false); }
}
```

Note: `descriptor.id` must be set to the correct entity ID by each factory (deadline_id, entry_id, escalation_id, etc.) — not the composite budget/silence IDs.

**Gate:** all 5 seed variants render against `resolve-01` through `resolve-05` screens. Destructive actions blocked without reason. Audit preview updates on radio switch.

---

## Phase 4 — Extended input modes

### 4A. textarea mode (base — narrative and reason)

```tsx
// Label row
<label>{field === 'narrative' ? 'Narrative' : 'Reason'}</label>
<span style={{ color: field === 'narrative' ? T.gold : T.danger, marginLeft: 4, fontSize: 12 }}>
  · required
</span>

// Textarea
rows={field === 'narrative' ? 3 : 2}; resize: 'vertical';
border: `1px solid ${text.trim().length > 0 ? T.teal : T.line}`;
borderRadius: 9; padding: '10px 12px'; fontSize: 14;
fontFamily: 'var(--font-sans)'; background: T.surface; color: T.ink;

// Helper line (12px italic T.faint)
narrative: "Goes onto the invoice and the LEDES export."
reason:    "Litt never dismisses silently — this reason is logged forever."
```

### 4B. date_select mode (E.3a — deadline verify)

Replaces textarea when `activeAction.need.type === 'date_select'`:

```tsx
display: flex; gap: 12; marginBottom: 12;

// Date input (flex: 1)
<label>Confirmed due date</label>
<input type="date" defaultValue={descriptor.extracted_date}
  border: `1px solid ${confirmedDate ? T.teal : T.line}`
  borderRadius: 9; padding: '9px 12px'; fontSize: 14; background: T.surface;
/>

// Classification select (flex: 1)
<label>Classification</label>
<select defaultValue={descriptor.extracted_class}
  // same border logic
  options: HARD_LEGAL · HARD_CONTRACTUAL · SOFT_INTERNAL · ADMINISTRATIVE
/>
```

Both fields required. Primary enabled only when both non-empty.

### 4C. numeric_reason mode (E.3b — billing write-down)

Rendered when `activeAction.need.type === 'numeric_reason'`:

```tsx
// Numeric row (flex)
display: flex; gap: 12; marginBottom: 12;

// New hours (flex: 1)
<label>New hours</label>
<input type="number" min={0.1} step={0.1} max={descriptor.current_hours}
  placeholder={String(descriptor.current_hours)}
  border: `1px solid ${newHours && Number(newHours) > 0 ? T.teal : T.line}`
  borderRadius: 9; padding: '9px 12px'; fontSize: 14; background: T.surface;
/>

// New amount (flex: 1)
<label>New amount ($)</label>
<input type="number" min={1} max={descriptor.current_amount}
  placeholder={`$${descriptor.current_amount}`}
  // same border logic
/>

// Reason textarea below (full width) — field='reason', minLen=4
```

Validation: `newHours > 0 && newHours < current_hours && newAmount > 0 && newAmount < current_amount && reason ≥ 4`.

### 4D. Scrubber BLOCK callout (E.3c)

When `descriptor.scrubber_flags?.length && descriptor.gate === 'ESCALATION'`, render ABOVE the input block:

```tsx
background: T.dangerSoft; borderRadius: 8; padding: '10px 12px'; marginBottom: 12;
border: `1px solid ${T.danger}`;

// Each flag
<span fontFamily: 'var(--font-mono)' color: T.danger fontWeight: 700>
  "{flag.matched_text}"
</span>
<span color: T.muted fontSize: 12> — {flag.message}</span>
```

Primary label changes to "Revise narrative & approve".
On submit: call `getScrubber(firmId, entry_id)` first. If `has_block` still true after revision, setError and block submit.

**Gate:** all 4 input modes render; BLOCK billing shows red tile + phrase callout.

---

## Phase 5 — New shapes (E.3d and E.3e)

### 5A. Inbound triage (E.3d)

**Correction #4:** `BriefInboundItem.action_items` is `string[]` — no handoff chips. Full `InboundMessage` (from `GET /api/inbound`) has `InboundActionItem[]` with `handoff_agent` + `urgency_signals` + `suggested_reply_body`. Must fetch on open.

**Correction #4 (id field):** `BriefInboundItem.message_id` → passed into modal. Full `InboundMessage.id` is the same value. Use `getInbound(firmId)` → `find(m => m.id === descriptor.inbound_message_id)`.

Shape check: `if (descriptor.inbound_message_id)` → render inbound shape. Width: `min(680px, 96vw)`.

```tsx
// On mount: fetch full InboundMessage
const [inboundMsg, setInboundMsg] = useState<InboundMessage | null>(null);
useEffect(() => {
  if (!descriptor.inbound_message_id) return;
  getInbound(firmId).then(msgs => {
    setInboundMsg(msgs.find(m => m.id === descriptor.inbound_message_id) ?? null);
  });
}, []);
```

Body sections (replaces normal action selector + input):

**1. Message block**
```
borderLeft: 2px solid T.tealSoft; paddingLeft: 12; marginBottom: 16;
Eyebrow: "from Gmail · read-only" — 10px mono T.faint
Body: inboundMsg.message_excerpt — italic T.muted lineHeight 1.6
```

**2. Triage grid (2-col, gap: 16)**
```
Left: "WHAT THEY NEED" (10px mono T.faint)
  inboundMsg.summary — 14px T.ink marginBottom 10
  urgency_signals: inboundMsg.urgency_signals.map → chip (T.soft bg, 11px mono T.muted)

Right: "ACTION ITEMS" (10px mono T.faint)
  inboundMsg.action_items.map({ text, handoff_agent }) →
    bullet + text
    when handoff_agent: chip "→ {handoff_agent}" (T.teal border + text, 11px mono)
  when inboundMsg.cross_agent: "Handed to {handoff_agent}" row (T.gold chip)
```

**3. Suggested reply card**
```
background: T.wash2; border: 1px solid T.line; borderRadius: 10; padding: 14; marginTop: 16;
Eyebrow: "SUGGESTED REPLY" (10px mono T.faint) + "Gemini" chip (T.teal text, T.soft bg)
Editable textarea: defaultValue=inboundMsg.suggested_reply_body
  border: 1px solid T.line → T.teal when edited; rows=4; fontSize:13
```

**4. Inbound footer** (overrides standard footer):
- "Approve & send" — `background: T.forest; color: T.brass` → `approveComm` → `queueComm`
- "Snooze" — ghost → `snoozeInbound({ firm_id, attorney_id, message_id: inboundMsg.id, expected_version: inboundMsg.version })`
- "Hand off" — ghost (v1.2 — renders disabled with `// TODO v1.2`)

Audit: `comms.approved` → `comms.sent` · operational.

### 5B. Compound escalation (E.3e)

Shape check: `if (descriptor.compound_signals?.length)` → render compound body between stakes and action selector.

Contributing signals list:
```tsx
marginBottom: 16;
// Each row
display: flex; alignItems: center; gap: 10; padding: '8px 0';
borderBottom: `1px solid ${T.line}`;
<Icon name={signal.icon} size={12} color={T.muted} />
<span fontSize:14 color:T.ink>{signal.label}</span>
// Clickable link to that item (onClick: navigate)
```

Synthesis paragraph:
```tsx
background: T.wash2; borderRadius: 8; padding: '12px 14px'; marginBottom: 16;
Eyebrow: "WHY THIS COMPOUNDS" — 10px mono T.faint marginBottom 6
{descriptor.compound_synthesis} — fontSize:13 color:T.muted lineHeight:1.7 fontStyle:italic
```

Then normal action selector (Acknowledge · Dismiss) + audit preview + footer.

**Gate:** inbound modal renders all 4 sections; compound modal renders signal list + synthesis.

---

## Phase 6 — Wire into Brief.tsx

**File:** `dashboard/src/pages/Brief.tsx`

**Correction #9:** verify variant fires on `conflict_flagged`, not `pending_verification`.

**Correction #5 (composite IDs):** budget uses `${i.client_id}-budget` and silence uses `${i.matter_id}-silence` as `modal.id`. The decision-list onClick must set `modal.id` with the SAME pattern. Confirm both sides of Brief.tsx are consistent.

**Correction #4 (inbound id):** `BriefInboundItem.message_id` → set `modal.id = item.message_id` in onClick, then `buildInboundDescriptor` receives only the id and the modal fetches the full record.

Changes:

1. Replace 5 modal imports with `import { ResolvePanel } from '../components/console/ResolvePanel'`
2. Import descriptor factories from `../components/console/buildDescriptor'`
3. Replace `modalContent` block:

```ts
let modalContent: React.ReactNode = null;
if (modal && brief) {
  const s = brief.sections;
  let descriptor: ItemDescriptor | null = null;

  if (modal.kind === 'deadline') {
    const item = s.deadlines.items.find(i => i.deadline_id === modal.id);
    if (item) {
      // Correction #9: conflict_flagged triggers verify variant (not pending_verification)
      descriptor = item.verification_status === 'conflict_flagged'
        ? buildDeadlineVerifyDescriptor(item)
        : buildDeadlineDescriptor(item, modal.gate);
    }
  } else if (modal.kind === 'billing') {
    const item = s.time_entries.items.find(i => i.entry_id === modal.id);
    if (item) descriptor = buildBillingDescriptor(item);
  } else if (modal.kind === 'budget risk') {
    // Correction #5: composite ID — verify onClick uses same pattern
    const item = s.budget_risks.items.find(i => `${i.client_id}-budget` === modal.id);
    if (item) descriptor = buildBudgetDescriptor(item);
  } else if (modal.kind === 'anomaly') {
    const item = s.anomalies.items.find(i => i.escalation_id === modal.id);
    if (item) descriptor = buildAnomalyDescriptor(item);
  } else if (modal.kind === 'client silence') {
    // Correction #5: composite ID
    const item = s.client_silence.items.find(i => `${i.matter_id}-silence` === modal.id);
    if (item) descriptor = buildSilenceDescriptor(item);
  } else if (modal.kind === 'inbound') {
    // Correction #4: modal.id = BriefInboundItem.message_id; descriptor fetches full InboundMessage
    const item = s.inbox_items?.items.find(i => i.message_id === modal.id);
    if (item) descriptor = buildInboundDescriptor(item.message_id);
  } else if (modal.kind === 'compound') {
    const item = s.compound_escalations?.items.find(i => i.escalation_id === modal.id);
    if (item) descriptor = buildCompoundDescriptor(item);
  }

  if (descriptor) {
    modalContent = (
      <ResolvePanel
        descriptor={descriptor}
        firmId={FIRM_ID}
        attorneyId={ATTORNEY_ID}
        onClose={closeModal}
        onSuccess={onModalSuccess}
      />
    );
  }
}
```

4. Add `// @deprecated — use ResolvePanel` to each old modal file; remove imports from Brief.tsx.
5. `tsc --noEmit` clean.

**Gate:** all 5 seed variants open from Brief decision list; no old modal code in render path.

---

## Phase 7 — Backend task (TOOL_CALL enrichment) ✓ COMPLETE

No changes from original plan. See BACKEND-TASK spec §§2-6 verbatim.

### 7A. registry.py ✓
- Add `signature: str = ""` to `ToolSpec` + `to_dict()`
- Populate `signature` on all existing entries
- Add gemini pseudo-tools: `draft_client_comm`, `summarize_inbound`, `draft_inbound_reply`, `suggest_narrative`, `assess_narrative_quality`, `extract_deadline_date`
- Add read/compute pseudo-tools: `get_pending_entries`, `run_prebill_scrubber`, `scan_inbox`, `score_urgency`, `get_active_deadlines`, `apply_escalation_tier`, `run_detectors`
- Annotation comment at each new site (from spec §0)

### 7B. observability.py ✓
Add `make_tool_call(agent_name, tool_name, result, commitment_level, confidence)` helper.
`_KIND_TO_WORK = { READ: 'deterministic', COMPUTE: 'deterministic', WRITE: 'tool_write', GEMINI: 'llm_assisted' }`.

### 7C. Agent instrumentation (additive only) ✓
Sites: billing_agent, deadline_agent, comms_agent, anomaly_agent.
Rule: gemini TOOL_CALL only when `_call_gemini_*` actually returned a result this run.

### 7D. Tests ✓
`backend/tests/test_agent_observations.py`: every TOOL_CALL has `data.tool.{name,kind,signature,result}`; gemini kind only when caller ran; write counts identical before/after.

**Gate:** `pytest` green (354/354 pass). `tsc --noEmit` clean.

---

## Phase 8 — Commit + deploy

Pre-commit checklist:
- [x] `tsc --noEmit` clean
- [ ] All 5 seed variants open from Brief (deadline/billing/budget/anomaly/silence)
- [ ] Destructive actions blocked without reason
- [ ] Audit preview updates on radio switch
- [ ] Inbound and compound shapes load without crash (can defer if no seed data)
- [x] `pytest` green (backend — 354/354)
- [x] `tasks/todo.md` and `tasks/plan.md` updated
- [x] `error-log.md` appended for any errors diagnosed this session

Deploy order:
1. `gcloud run deploy litt-backend --source backend/ ...` (after Phase 7 complete)
2. `gcloud run deploy litt-dashboard --source dashboard/ ...`
3. `POST /api/demo/reset` + `GET /api/demo/ready` — all 6 pass
4. Smoke: Brief → click each of 5 decision types → correct panel opens → submit resolves

---

## Corrections applied (post-review)

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | 🔴 | ProofData flat — ProofBlock renders blank | Nested: `{what, did, source:{tag,ref,line}, route:{agent,work,llm,extra}}` |
| 2 | 🔴 | Icon names wrong (calendar, dollar-sign, etc.) | deadline→shield, billing→dollar, budget→chart, anomaly→alert, silence→mail |
| 3 | 🔴 | GATE_TONE single color — BLOCKED wrong | `{fg,bg,bd}` per gate; BLOCKED fg=`#3A4A44`, bg=`rgba(20,34,31,.07)` |
| 4 | 🔴 | E.3d uses BriefInboundItem.id (doesn't exist) | Match by `message_id`; fetch full InboundMessage via `getInbound()` on open |
| 5 | 🟠 | Composite budget/silence IDs fragile | Annotated — verify both sides of Brief.tsx use identical pattern |
| 6 | 🟠 | Silence draft body needs fetch, no endpoint | Draft = null; panel hides draft section; `// TODO v1.2: GET /api/comms/:id` |
| 7 | 🟠 | Stakes row styling wrong (borderLeft 3px, radius 8) | Full `1px border (rgba)` + `borderRadius: 10` |
| 8 | 🟠 | Draft preview styling wrong (wash2 bg, 3px teal) | `borderLeft: 2px solid T.tealSoft; paddingLeft: 12; background: transparent` |
| 9 | 🟠 | Verify variant triggers on `pending_verification` | Triggers on `conflict_flagged` (assembler never passes pending_verification to brief) |
| 10 | 🟠 | No slot for third billing action (write-down) | `actions: ActionDef[]` array replaces `action`/`alt` pair |

---

## File map summary

| New file | Purpose |
|---|---|
| `dashboard/src/components/console/resolveTypes.ts` | `ItemDescriptor`, `ActionDef`, `InputMode`, `ProofData` types |
| `dashboard/src/components/console/buildDescriptor.ts` | 7 factory functions |
| `dashboard/src/components/console/ProofBlock.tsx` | Collapsible proof block |
| `dashboard/src/components/console/ResolvePanel.tsx` | Single parameterized modal |

| Modified file | Change |
|---|---|
| `dashboard/src/pages/Brief.tsx` | Swap 5 modal imports → ResolvePanel + factories |
| `dashboard/src/types.ts` | Add `suggested_reply_body?: string \| null` to `BriefInboundItem` |
| `backend/app/tools/registry.py` | `signature` + pseudo-tools |
| `backend/app/observability.py` | `make_tool_call()` helper |
| `backend/app/agents/billing_agent.py` | TOOL_CALL instrumentation |
| `backend/app/agents/deadline_agent.py` | TOOL_CALL instrumentation |
| `backend/app/agents/comms_agent.py` | TOOL_CALL instrumentation |
| `backend/app/agents/anomaly_agent.py` | TOOL_CALL instrumentation |
| `backend/tests/test_agent_observations.py` | data.tool assertions |

| Deprecated (add comment, keep file) | Reason |
|---|---|
| `dashboard/src/components/modals/DeadlineModal.tsx` | Replaced by ResolvePanel |
| `dashboard/src/components/modals/BillingWIPModal.tsx` | Replaced by ResolvePanel |
| `dashboard/src/components/modals/BudgetModal.tsx` | Replaced by ResolvePanel |
| `dashboard/src/components/modals/AnomalyModal.tsx` | Replaced by ResolvePanel |
| `dashboard/src/components/modals/ClientCommsModal.tsx` | Replaced by ResolvePanel |
