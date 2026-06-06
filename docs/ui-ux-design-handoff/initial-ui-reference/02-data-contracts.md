# 02 — Data Contracts (new entities + changes)

All new entities follow the existing conventions in `backend/app/models.py`:
extend `LittBaseModel` (mandatory `id`, `firm_id`, `created_at`, `updated_at`),
`ConfigDict(use_enum_values=True)`, Firestore path `firms/{firm_id}/{collection}/{id}`.
Every TS counterpart goes in `dashboard/src/types.ts` (keep mirrored — the repo already
enforces this discipline).

This doc defines the **shapes**. The behavior that fills them lives in `03-agent-core/`.

---

## 1. `Commitment` — a promise *you* made, watched as a soft deadline  `[NEW]`

Collection: `commitments`. Backs the Relationships "Commitments you've made" tracker
*(prototype: `console-clients.jsx` → `CommitmentTracker`)* and appears on the Deadlines
book as a soft-deadline row *(prototype: `console-deadlines.jsx`, "promise" chip)*.

```python
# backend/app/models.py  [EXTEND]

class CommitmentStatus(str, Enum):
    PENDING  = "PENDING"    # extracted from a draft reply not yet sent — tracks once sent
    TRACKED  = "TRACKED"    # active soft deadline
    DUE_SOON = "DUE_SOON"   # within cadence window (derived; see note)
    KEPT     = "KEPT"       # fulfilled (terminal)
    SLIPPED  = "SLIPPED"    # missed / closed late (terminal)

class CommitmentSource(str, Enum):
    ATTORNEY_REPLY = "ATTORNEY_REPLY"   # caught in a sent/held comms reply
    MANUAL         = "MANUAL"

class Commitment(LittBaseModel):
    matter_id: str
    client_id: str
    quote: str                       # verbatim promise text, e.g. "I'll send the exhibit list by EOD tomorrow"
    summary: str                     # normalized obligation, e.g. "Send updated exhibit list"
    due_date: date                   # parsed commitment date
    status: CommitmentStatus = CommitmentStatus.PENDING
    source: CommitmentSource = CommitmentSource.ATTORNEY_REPLY
    source_comm_id: Optional[str] = None     # the ClientCommunication it was extracted from
    extracted_by: Optional[str] = None       # model name when source == ATTORNEY_REPLY (provenance)
    confidence: Optional[float] = None
    on_deadline_book: bool = False           # True once a linked Deadline row is created
    linked_deadline_id: Optional[str] = None
    closed_at: Optional[datetime] = None
    closed_note: Optional[str] = None        # "Fulfilled May 24 — a day early" / "Re-sent May 27 — 5 days late"
    version: int = 1
```

**Notes**
- `DUE_SOON` is **derived for display** from `due_date - get_effective_date() <= 2`. Store
  `TRACKED`; let the read layer compute `due_soon`. (Mirror how deadlines derive
  `escalation_level`.) Do **not** persist a status the clock will invalidate.
- `days_out` is **never stored** — always computed from the effective date in the read
  layer (Rule 5). Same for the prototype's "captured today / X days late."
- Terminal transitions write a ledger event (see doc 03-02): `commitment.kept` /
  `commitment.slipped`. Creation writes `commitment.captured`.

TS mirror:
```ts
// dashboard/src/types.ts  [EXTEND]
export type CommitmentStatus = "PENDING" | "TRACKED" | "DUE_SOON" | "KEPT" | "SLIPPED";
export interface Commitment {
  id: string; firm_id: string; matter_id: string; client_id: string;
  quote: string; summary: string; due_date: string;            // ISO date
  status: CommitmentStatus; source: "ATTORNEY_REPLY" | "MANUAL";
  source_comm_id: string | null; extracted_by: string | null; confidence: number | null;
  on_deadline_book: boolean; linked_deadline_id: string | null;
  closed_at: string | null; closed_note: string | null;
  days_out: number;            // computed server-side, included in read responses
  version: number;
  created_at: string; updated_at: string;
}
```

---

## 2. `InboundMessage` — a client email awaiting your response  `[NEW]`

Collection: `inbound_messages`. Backs the "Awaiting your response" triage cards
*(prototype: `console-clients.jsx` → `InboundCard`)*. Source emails already exist as a
`source_emails` collection (the deadline agent reads them); inbound triage **derives**
`InboundMessage` records from unanswered client emails.

```python
# backend/app/models.py  [EXTEND]

class InboundUrgency(str, Enum):
    HIGH = "HIGH"; MEDIUM = "MEDIUM"; LOW = "LOW"

class InboundStatus(str, Enum):
    AWAITING_TRIAGE  = "AWAITING_TRIAGE"
    TRIAGED          = "TRIAGED"          # summary + reply draft ready, held
    REPLY_HELD       = "REPLY_HELD"       # suggested reply drafted, awaiting attorney
    HANDLED          = "HANDLED"          # attorney sent / resolved
    SNOOZED          = "SNOOZED"
    DISMISSED        = "DISMISSED"

class InboundActionItem(BaseModel):           # nested
    text: str
    handoff_agent: Optional[str] = None       # "deadline_agent" | "billing_agent" — cross-agent link

class InboundMessage(LittBaseModel):
    source_email_id: str
    matter_id: Optional[str] = None
    client_id: str
    from_name: str
    from_role: Optional[str] = None
    received_at: datetime
    wait_days: int                            # computed at write; recompute on read against clock
    urgency: InboundUrgency
    urgency_signals: List[str] = Field(default_factory=list)   # deterministic reasons it surfaced
    message_excerpt: str                       # the read-only original (truncated)
    summary: str                               # Gemini: "what they need"
    action_items: List[InboundActionItem] = Field(default_factory=list)  # Gemini-extracted, Python-tagged handoffs
    suggested_reply_comm_id: Optional[str] = None   # a held ClientCommunication (reuse comms pipeline!)
    cross_agent: Optional[Dict[str, Any]] = None    # {agent, note, entity_id} when handed off
    status: InboundStatus = InboundStatus.AWAITING_TRIAGE
    version: int = 1
```

**Key reuse:** the **suggested reply is a `ClientCommunication`** in `DRAFT_GENERATED`,
created via the existing `create_client_comm()` tool with a `source_map`. This means
"Approve & send" on a triage card uses the **existing comms state machine**
(`approve → queue → confirm-sent`) and the existing audit events — no new send path.
`InboundMessage.suggested_reply_comm_id` points at it.

TS mirror: analogous interface in `types.ts` (`InboundMessage`, `InboundActionItem`,
`InboundUrgency`, `InboundStatus`) plus a read-shape `InboundTriageItem` that inlines the
linked `ClientCommunication.draft_body` + `source_map` for the card.

---

## 3. `FirmPolicy` + `AttorneyPolicyOverride` — the trust dial  `[NEW]`

Collections: `firm_policy` (one doc per firm, id = `firm-policy`) and
`attorney_policy_overrides` (one per attorney). Backs Policy & autonomy
*(prototype: `console-policy.jsx`)*. The four-gate `CommitmentLevel` already exists; this
makes the **gate per-rule configurable**, with firm-set floors and attorney tighten-only
overrides.

```python
# backend/app/models.py  [EXTEND]

class RulePosture(str, Enum):
    GATED = "GATED"    # ask the attorney (maps to BLOCKED/REVIEW_REQUIRED at runtime)
    AUTO  = "AUTO"     # auto + log (maps to AUTO_SAFE)

class PolicyRule(BaseModel):                  # nested
    rule_id: str                              # e.g. "comms.auto_send", "billing.auto_approve_under"
    domain: str                               # "Billing" | "Deadlines" | "Comms" | "Anomalies"
    label: str
    note: str
    kind: str                                 # "posture" | "threshold"
    firm_floor: str                           # posture: "GATED"/"AUTO";  threshold: "75%"/"14 days"
    lockable: bool                            # firm-locked (malpractice-critical) → attorney cannot widen
    attorney_value: Optional[str] = None      # override; must be == or stricter than firm_floor

class FirmPolicy(LittBaseModel):              # id = "firm-policy"
    rules: List[PolicyRule]

class AttorneyPolicyOverride(LittBaseModel):  # id = attorney_id
    attorney_id: str
    overrides: Dict[str, str]                 # rule_id -> value (validated tighten-only)
```

**Enforcement invariant (must be server-side, deterministic):**
- `lockable=True` rules are **firm-locked** — overrides rejected (`ToolError VALIDATION_FAILED`).
  These are always `GATED` (e.g. `deadline.confirm`, `comms.auto_send`). The prototype shows
  these as a non-interactive "Always gated" pill.
- For `threshold` rules, an attorney override must be **stricter** (lower %, fewer days).
  Looser → `ToolError`. The prototype's `+` stepper disables at the firm floor.
- Effective posture = strictest of (firm_floor, attorney_value). The coordinator/agents read
  effective posture when choosing `commitment_level`. **A gated action physically cannot
  auto-execute** — it routes to a held status. This is the whole point; do not implement the
  dial as cosmetic.

Every policy change writes `policy.updated` to the audit ledger (matches prototype copy).

---

## 4. `ToolSpec` — the tool registry  `[NEW, backend metadata]`

Powers the Agent console's tool chips, inspector cards, and catalog
*(prototype: `console-agents.jsx`)*. This is **metadata about the existing tool layer**,
not new write paths. See `03-agent-core/04-tool-call-layer.md` for how observations carry it.

```python
# backend/app/tools/registry.py   [NEW]

class ToolKind(str, Enum):
    READ = "read"; COMPUTE = "compute"; GEMINI = "gemini"
    ROUTE = "route"; GATE = "gate"; WRITE = "write"

@dataclass(frozen=True)
class ToolSpec:
    name: str            # "run_prebill_scrubber"
    kind: ToolKind
    signature: str       # "run_prebill_scrubber(entry) -> Flag[]"
    agent: str           # owning agent: "billing_agent"
    deterministic: bool  # True for everything except kind == GEMINI

TOOL_REGISTRY: dict[str, ToolSpec] = { ... }   # one entry per real tool fn (see doc 03-04)
```

`GET /api/tools` returns `TOOL_REGISTRY` for the catalog. The boundary stat
("17/20 deterministic · 3 Gemini") is computed from `deterministic` across the
observations in a run.

---

## 5. Changes to existing shapes  `[EXTEND]`

- **`ObservationType`** (`observability.py`): add `ROUTE_HANDOFF = "ROUTE_HANDOFF"` for
  cross-agent hand-offs (doc 03-03). Mirror in `types.ts`.
- **`AgentObservation.data`**: for `TOOL_CALL`/`ROUTE_HANDOFF`, populate a documented
  sub-shape so the inspector can render it without guessing:
  ```python
  data = {
    "tool": {"name": "...", "kind": "compute", "signature": "...", "result": "te-001 · MISSING_NARRATIVE"},
    # ROUTE_HANDOFF adds:
    "handoff": {"from": "comms_agent", "to": "deadline_agent", "entity_id": "dl-mercer-001", "reason": "..."},
  }
  ```
  This is additive — existing observations already use `data` freely.
- **`BriefSections`** (assembler + `types.ts`): add `inbound` and `commitments` sections so
  the Overview can show their counts. Each is `{ items, count }` like the others.
- **`work_kind`**: already supports `tool_write`/`llm_assisted`/`deterministic`/`human_gate`.
  No change — just make sure new observations set it correctly.

---

## Firestore security rules (carry the existing invariants)

- `commitments`, `inbound_messages`: standard CREATE + status-advancing UPDATE under
  `firms/{firm_id}/…`, same tenancy guard as other business entities.
- `firm_policy`, `attorney_policy_overrides`: UPDATE allowed (config), but **every** change
  must emit `policy.updated` to the CREATE-only `audit_log`.
- `audit_log` and `deadline_events` remain **CREATE-only** — commitment/inbound events are
  new `event_type`s, not new collections with delete semantics.
