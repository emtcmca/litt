# Litt — Data Contract

**Version:** 1.0  
**Status:** Canonical — do not deviate without updating this file and logging in spec changelog  
**Governs:** All Firestore collections, all Pydantic models, all TypeScript types

---

## Tenancy Model

Every document in every collection includes `firm_id`. This is mandatory and enforced by the `LittBaseModel` Pydantic base class. There are no exceptions.

Firestore path structure:

```
firms/{firm_id}/attorneys/{attorney_id}
firms/{firm_id}/clients/{client_id}
firms/{firm_id}/matters/{matter_id}
firms/{firm_id}/time_entries/{entry_id}
firms/{firm_id}/deadlines/{deadline_id}
firms/{firm_id}/deadline_events/{event_id}
firms/{firm_id}/client_communications/{comm_id}
firms/{firm_id}/invoices/{invoice_id}
firms/{firm_id}/escalations/{escalation_id}
firms/{firm_id}/audit_log/{audit_id}
firms/{firm_id}/ingestion_signals/{signal_id}
```

The demo firm ID is `strand-okafor`. All seed data uses this `firm_id`.

---

## Base Model

All Firestore documents extend `LittBaseModel`:

```python
class LittBaseModel(BaseModel):
    id: str
    firm_id: str          # MANDATORY on every document
    created_at: datetime
    updated_at: datetime

    class Config:
        use_enum_values = True
```

---

## Pydantic Base Model — `backend/app/models.py`

This file is the canonical source of truth for all data structures. TypeScript types in `dashboard/src/types.ts` must mirror these exactly.

---

## Collection: `attorneys`

```python
class Attorney(LittBaseModel):
    id: str                        # slug: "dana-strand"
    firm_id: str
    name: str
    email: str                     # encrypted at rest (Cloud KMS)
    default_rate: Decimal          # USD per hour
    billing_increment: float       # 0.1 = 6-minute minimum
    timekeeper_id: str             # "ds001" — for LEDES TIMEKEEPER_ID
    timekeeper_classification: TimekeeperClass  # AT | PA | OF | CL
    rate_overrides: Dict[str, Decimal]  # {client_id: rate}
    permission_scope: List[PermissionScope]  # billing | deadlines | comms | admin
    is_backup_contact: bool
    created_at: datetime
    updated_at: datetime
```

**Demo seed:**
- `dana-strand`: Dana Strand, $350/hr, AT, all permissions, is_backup_contact=True
- `kofi-okafor`: Kofi Okafor, $375/hr, AT, all permissions, is_backup_contact=False

---

## Collection: `clients`

```python
class Client(LittBaseModel):
    id: str                        # slug: "acme-commercial"
    firm_id: str
    name: str
    billing_contact: str
    billing_email: str             # encrypted at rest (Cloud KMS)
    billing_address: str
    arrangement: BillingArrangement  # hourly | flat_fee | contingency | hybrid
    budget_cap: Optional[Decimal]
    budget_billed: Decimal         # total billed to date (all invoices)
    retainer_balance: Optional[Decimal]
    retainer_refill_threshold: Optional[Decimal]
    ledes_client_id: str           # CLIENT_ID in LEDES export
    client_matter_id_prefix: str   # e.g. "ACME" — prefix for client_matter_id generation
    last_client_contact: Optional[datetime]
    client_silence_threshold_days: int  # default 14
    billing_guidelines: BillingGuidelines  # see below
    engagement_terms: EngagementTerms     # see below
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
```

### Nested: `BillingGuidelines`

```python
class BillingGuidelines(BaseModel):
    block_billing_allowed: bool
    travel_time_allowed: bool
    intraoffice_conference_allowed: str    # "yes" | "no" | "limited"
    research_requires_preapproval: bool
    max_daily_hours_without_review: float
    forbidden_phrases: List[str]           # case-insensitive substring match
    required_task_codes: bool
    activity_codes_required: bool
    ledes_required: bool
    ai_disclosure_required: bool
    budget_notice_threshold: float         # 0.75 = 75%
    outside_counsel_guidelines: Optional[str]
```

**Forbidden phrase matching rules** (deterministic, not LLM):
- Matching is case-insensitive
- Matching is substring (not word-boundary) — "review documents" matches "I reviewed documents relating to"
- Match returns the specific phrase that triggered, not just a boolean
- All matches for a given entry are returned, not just the first

### Nested: `EngagementTerms`

```python
class EngagementTerms(BaseModel):
    fee_type: str                          # hourly | flat_fee | contingency | hybrid
    scope_summary: str
    excluded_work: List[str]
    retainer_required: bool
    retainer_amount: Optional[Decimal]
    evergreen_retainer: bool
    budget_cap: Optional[Decimal]
    client_approval_required_above: Optional[Decimal]
    outside_counsel_guidelines_attached: bool
    engagement_letter_signed: bool
    engagement_letter_date: Optional[date]
```

**Demo seed (4 clients):**
- `acme-commercial`: Acme Commercial Partners LLC, $15,000 budget, 78% utilized, retainer $800, silence threshold 14d
- `mercer-industries`: Mercer Industries, $25,000 budget, 34% utilized, HARD_LEGAL deadline active
- `reyes-family-holdings`: Reyes Family Holdings, $18,000 budget, 34% utilized
- `whitmore-group`: Whitmore Group, $12,000 budget, 40% utilized, 16 days since contact

---

## Collection: `matters`

```python
class Matter(LittBaseModel):
    id: str                        # slug: "acme-contract-review-2026"
    firm_id: str
    client_id: str
    client_matter_id: str          # client's own matter reference (e.g. "ACME-2026-0042")
    law_firm_matter_id: str        # same as id — explicit field for LEDES mapping
    name: str
    type: MatterType               # transactional | litigation | regulatory | advisory
    status: MatterStatus           # PROSPECT | CONFLICT_CHECK | ENGAGEMENT_PENDING | ACTIVE | PAUSED | CLOSING | CLOSED
    assigned_attorneys: List[str]  # attorney_ids
    opened_at: datetime
    last_activity: datetime
    last_client_contact: Optional[datetime]
    created_at: datetime
    updated_at: datetime
```

**Note:** `client_matter_id` and `law_firm_matter_id` are separate fields. Do not assume the internal matter slug is the client's billing system reference.

**Demo seed (4 matters):**

| ID | Client | Type | Status | Notes |
|----|--------|------|--------|-------|
| `mercer-v-dunlap` | mercer-industries | litigation | ACTIVE | HARD_LEGAL deadline 6 days |
| `reyes-acquisition` | reyes-family-holdings | transactional | ACTIVE | HARD_CONTRACTUAL deadline 11 days |
| `acme-contract-review-2026` | acme-commercial | transactional | ACTIVE | 78% budget |
| `whitmore-employment-2026` | whitmore-group | advisory | ACTIVE | 16 days since contact |

---

## Collection: `time_entries`

```python
class TimeEntry(LittBaseModel):
    id: str                        # "te-2026-0529-001"
    firm_id: str
    matter_id: str
    client_id: str
    attorney_id: str

    # Time and billing
    date: date
    hours: Decimal                 # rounded to billing_increment
    rate: Decimal                  # USD per hour
    amount: Decimal                # hours × rate
    session_minutes_actual: Optional[int]  # raw minutes from timer or seed data
    billing_increment: float       # inherited from attorney profile at time of entry

    # LEDES fields — NEVER collapsed into a single field
    task_code: Optional[str]       # UTBMS L-series or A-series → LINE_ITEM_TASK_CODE
    activity_code: Optional[str]   # ABA A101–A111 → LINE_ITEM_ACTIVITY_CODE
    expense_code: Optional[str]    # disbursements only → LINE_ITEM_EXPENSE_CODE (null on time entries)

    # Narrative and status
    narrative: Optional[str]
    status: TimeEntryStatus        # CAPTURED | PENDING | APPROVED | BILLED | WRITTEN_OFF | CLOSED
    invoice_id: Optional[str]

    # AI billing provenance (ABA FO 512)
    ai_assisted: bool
    ai_tool: Optional[str]         # "Gemini" | "Claude" | etc.
    model: Optional[str]           # specific model version
    ai_cost_usd: Optional[Decimal]
    human_minutes_actual: Optional[int]
    ai_minutes_estimated: Optional[int]
    output_type: Optional[AiOutputType]  # draft | research_summary | redline | extraction | analysis
    human_review_completed: bool
    reviewing_attorney_id: Optional[str]
    client_ai_disclosure_required: bool
    client_ai_disclosure_status: Optional[AiDisclosureStatus]  # included | not_required | withheld
    billing_treatment: Optional[BillingTreatment]  # billed_as_human_review | written_down | nonbillable_ai_overhead

    # Activity log (seeded in v1.0; browser extension in v1.1)
    activity_log: List[str]        # "ISO8601|action|filename" format

    # Modification records
    write_down_record: Optional[WriteDownRecord]
    write_off_record: Optional[WriteOffRecord]

    # Idempotency
    version: int                   # incremented on every state change
    created_at: datetime
    updated_at: datetime
```

### State Machine

```python
VALID_TRANSITIONS: Dict[str, List[str]] = {
    "CAPTURED":    ["PENDING"],
    "PENDING":     ["APPROVED", "WRITTEN_OFF"],
    "APPROVED":    ["BILLED", "WRITTEN_OFF"],
    "BILLED":      ["CLOSED"],
    "WRITTEN_OFF": [],    # terminal — no further transitions
    "CLOSED":      []     # terminal — no further transitions
}
```

This dict is hardcoded in `tools/billing.py`. It is not configurable. It is not overridable by system prompt.

### Nested: `WriteDownRecord`

```python
class WriteDownRecord(BaseModel):
    original_hours: Decimal
    original_amount: Decimal
    new_hours: Decimal
    new_amount: Decimal
    reason: str        # required — no silent write-downs
    attorney_id: str
    written_down_at: datetime
```

### Nested: `WriteOffRecord`

```python
class WriteOffRecord(BaseModel):
    original_hours: Decimal
    original_amount: Decimal
    reason: str        # required — no silent write-offs
    attorney_id: str
    written_off_at: datetime
```

**Billing rounding rule:**
```python
def round_to_increment(minutes: int, increment: float = 0.1) -> Decimal:
    """
    Convert raw minutes to billed hours, rounded up to nearest increment.
    increment=0.1 means 6-minute minimum billing unit.
    46 minutes → 0.8 hours (46/60 = 0.767, rounds up to 0.8)
    """
    hours = minutes / 60
    return Decimal(str(math.ceil(hours / increment) * increment))
```

**Demo seed (8 entries):**

| ID | Matter | Attorney | Hours | Status | Demo flag |
|----|--------|----------|-------|--------|-----------|
| te-001 | mercer-v-dunlap | dana-strand | 1.4 | PENDING | No narrative — anomaly fires |
| te-002 | mercer-v-dunlap | dana-strand | 0.5 | APPROVED | Clean |
| te-003 | reyes-acquisition | dana-strand | 0.8 | PENDING | Clean, narrative ready |
| te-004 | reyes-acquisition | kofi-okafor | 1.2 | PENDING | Round hours, no session — anomaly |
| te-005 | acme-contract-review-2026 | dana-strand | 0.8 | PENDING | Contains "review documents" — scrubber |
| te-006 | acme-contract-review-2026 | dana-strand | 2.0 | APPROVED | Round hours — anomaly (already logged) |
| te-007 | whitmore-employment-2026 | dana-strand | 0.6 | BILLED | Clean, on INV-2026-006 |
| te-008 | whitmore-employment-2026 | kofi-okafor | 1.1 | APPROVED | Clean |

---

## Collection: `deadlines`

```python
class Deadline(LittBaseModel):
    id: str                        # "dl-mercer-resp-001"
    firm_id: str
    matter_id: str
    description: str
    due_date: date
    classification: DeadlineClass  # HARD_LEGAL | HARD_CONTRACTUAL | SOFT_INTERNAL | ADMINISTRATIVE
    status: DeadlineStatus         # ACTIVE | RESOLVED | SUPERSEDED | DISMISSED

    # Source model — every deadline must have this
    source_type: SourceType        # court_order | email | calendar | manual | contract | statute
    source_document_id: Optional[str]  # email ID, calendar event ID, etc.
    source_excerpt: Optional[str]  # the specific sentence containing the deadline
    created_by: str                # attorney_id or "system"

    # Verification — system-detected deadlines require attorney verification before activation
    verified_by: Optional[str]     # attorney_id
    verification_status: VerificationStatus  # unverified | attorney_verified | superseded
    supersedes_deadline_id: Optional[str]

    # Jurisdiction
    jurisdiction: Optional[str]
    court: Optional[str]

    # Confirmation tracking
    last_confirmed_by: Optional[str]
    last_confirmed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
```

**Critical rule:** Deadlines with `verification_status = "unverified"` do not fire escalation notifications. They appear in a separate "needs verification" section of the Daily Closeout Brief. Only attorney-verified deadlines enter the escalation cadence.

**Demo seed (2 deadlines):**

| ID | Matter | Due Date | Days Out | Class | Verified | Confirmed |
|----|--------|----------|----------|-------|----------|-----------|
| dl-mercer-001 | mercer-v-dunlap | 2026-06-04 | 6 | HARD_LEGAL | Yes | No (escalation fires) |
| dl-reyes-001 | reyes-acquisition | 2026-06-09 | 11 | HARD_CONTRACTUAL | Yes | No (digest mention) |

Days out calculated relative to `LITT_DEMO_DATE=2026-05-29`.

---

## Collection: `deadline_events` (append-only)

```python
class DeadlineEvent(LittBaseModel):
    id: str
    firm_id: str
    deadline_id: str
    event_type: DeadlineEventType  # see enum below
    escalation_level: Optional[str]  # "7_DAY" | "14_DAY" | "3_DAY" | "1_DAY" | "CRITICAL"
    attorney_id: Optional[str]     # null for system events
    response: Optional[str]        # attorney's response text
    dismissal_reason: Optional[str]  # required if event_type = DISMISSED_WITH_REASON
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime           # same as created_at for append-only records

class DeadlineEventType(str, Enum):
    ESCALATION_SENT = "ESCALATION_SENT"
    ATTORNEY_CONFIRMED = "ATTORNEY_CONFIRMED"
    ATTORNEY_RESOLVED = "ATTORNEY_RESOLVED"
    ATTORNEY_EXTENDED = "ATTORNEY_EXTENDED"
    ATTORNEY_DELEGATED = "ATTORNEY_DELEGATED"
    DISMISSED_WITH_REASON = "DISMISSED_WITH_REASON"
    BACKUP_NOTIFIED = "BACKUP_NOTIFIED"
    VERIFICATION_COMPLETED = "VERIFICATION_COMPLETED"
```

**Append-only enforcement:** Application code never calls `.update()` on deadline_events documents. Firestore security rules deny UPDATE and DELETE on this collection.

---

## Collection: `client_communications`

```python
class ClientCommunication(LittBaseModel):
    id: str
    firm_id: str
    matter_id: str
    client_id: str
    trigger: CommTrigger           # DAYS_SINCE_CONTACT | MILESTONE_COMPLETE | BUDGET_THRESHOLD | DEADLINE_APPROACHING | INVOICE_ISSUED | ATTORNEY_INITIATED
    draft_body: str
    source_map: List[SourceMapEntry]  # structured fact → source attribution
    status: CommStatus             # DRAFT_GENERATED | DRAFT_APPROVED | QUEUED_FOR_SEND | SENT_CONFIRMED | DISMISSED_WITH_REASON
    approved_by: Optional[str]     # attorney_id
    approved_at: Optional[datetime]
    queued_at: Optional[datetime]
    sent_confirmed_at: Optional[datetime]  # only this field triggers last_client_contact update
    dismissal_reason: Optional[str]  # required if DISMISSED_WITH_REASON
    created_at: datetime
    updated_at: datetime
```

### Nested: `SourceMapEntry`

```python
class SourceMapEntry(BaseModel):
    fact_id: str                   # "f1", "f2", etc.
    fact_text: str                 # the structured fact given to the model
    sentence_in_draft: str         # the sentence in the generated draft that uses this fact
    source_type: str               # "firestore" | "calendar" | "email" | "manual"
    source_id: str                 # document ID, email ID, event ID, etc.
    source_excerpt: str            # the specific text from the source
```

**Source-backed draft protocol:** The comms agent receives a structured `FactPacket` — a list of `SourceMapEntry` objects with pre-extracted facts from Firestore and ingestion data. The model draft must cite `fact_id` values. Facts not in the packet cannot be asserted in the draft. Uncited facts become `[ATTORNEY: verify and add detail]` placeholders.

**`last_client_contact` update rule:** Only `log_client_comm_sent()` updates `last_client_contact` on the matter record. `approve_client_comm_draft()` does not. `queue_client_comm_for_delivery()` does not. The state transition `SENT_CONFIRMED` is the only trigger.

---

## Collection: `invoices`

```python
class Invoice(LittBaseModel):
    id: str                        # "INV-2026-007"
    firm_id: str
    client_id: str
    period_start: date
    period_end: date
    total_hours: Decimal
    total_amount: Decimal
    retainer_draw: Optional[Decimal]
    retainer_balance_after: Optional[Decimal]
    exhibit_md: str                # Markdown invoice exhibit
    ledes_file_path: Optional[str]  # GCS path after export
    status: InvoiceStatus          # DRAFT | ISSUED | PAID | DISPUTED | VOID
    issued_at: Optional[datetime]
    paid_at: Optional[datetime]
    days_outstanding: Optional[int]  # computed, not stored
    created_at: datetime
    updated_at: datetime
```

### LEDES 1998B Field Mapping

| Litt field | LEDES 1998B field | Notes |
|-----------|-------------------|-------|
| `entry.task_code` | `LINE_ITEM_TASK_CODE` | UTBMS L-series (litigation) or A-series (transactional). Required. |
| `entry.activity_code` | `LINE_ITEM_ACTIVITY_CODE` | ABA A101–A111. Optional unless client requires. |
| `entry.expense_code` | `LINE_ITEM_EXPENSE_CODE` | Null on all time entries. Disbursements only. |
| `computed line_item_number` | `LINE_ITEM_NUMBER` | Sequential integer per invoice, generated at export time. NOT stored on entry. |
| `attorney.timekeeper_id` | `TIMEKEEPER_ID` | |
| `attorney.timekeeper_classification` | `TIMEKEEPER_CLASSIFICATION` | AT / PA / OF / CL |
| `client.ledes_client_id` | `CLIENT_ID` | |
| `matter.client_matter_id` | `CLIENT_MATTER_ID` | Client's own matter reference |
| `matter.law_firm_matter_id` | `LAW_FIRM_MATTER_ID` | Litt matter slug |
| `entry.hours` | `NUMBER_OF_UNITS` | |
| `entry.rate` | `BILLING_TIMEKEEPER_RATE` | |
| `entry.amount` | `LINE_ITEM_TOTAL` | |
| `entry.narrative` | `LINE_ITEM_COMMENT` | |
| `invoice.id` | `INVOICE_NUMBER` | |
| `invoice.issued_at` | `INVOICE_DATE` | Format: YYYYMMDD |

**`LINE_ITEM_NUMBER`** is generated sequentially during `export_ledes()`. It starts at 1 per invoice and increments per line item. It is not a stored field on the time entry.

**WRITTEN_OFF entries are excluded from LEDES export.**

---

## Collection: `audit_log` (CREATE-only)

```python
class AuditEvent(LittBaseModel):
    id: str
    firm_id: str
    tier: AuditTier                # engineering | operational | legal_defensibility
    event_type: str                # see audit event type registry below
    actor: str                     # attorney_id or "system"
    entity_type: str               # time_entry | deadline | invoice | communication | anomaly | escalation
    entity_id: str
    before_state: Optional[Dict]   # null for CREATE events
    after_state: Optional[Dict]
    idempotency_key: Optional[str]  # from the write request
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime           # same as created_at — audit records never updated
```

**Security rule:** `allow create: if request.auth.uid == serviceAccountUid; allow read: if isAttorney(request.auth); allow update, delete: if false;`

**Audit event type registry:**

```
ENTRY_CREATED
ENTRY_STATUS_ADVANCED
ENTRY_WRITTEN_DOWN
ENTRY_WRITTEN_OFF
ENTRY_NARRATIVE_AMENDED
ENTRY_CODE_CORRECTED
DEADLINE_DETECTED
DEADLINE_VERIFIED
DEADLINE_CONFIRMED
DEADLINE_RESOLVED
DEADLINE_EXTENDED
DEADLINE_DELEGATED
DEADLINE_DISMISSED
ESCALATION_SENT
ESCALATION_BACKUP_NOTIFIED
INVOICE_GENERATED
INVOICE_LEDES_EXPORTED
COMM_DRAFT_GENERATED
COMM_DRAFT_APPROVED
COMM_QUEUED
COMM_SENT_CONFIRMED
COMM_DISMISSED
ANOMALY_DETECTED
ANOMALY_RESOLVED
ANOMALY_DISMISSED
ALERT_DISMISSED
BUDGET_THRESHOLD_CROSSED
SWEEP_COMPLETED
DEMO_RESET
```

---

## Collection: `ingestion_signals` (Idempotency Registry)

```python
class IngestionSignal(LittBaseModel):
    id: str
    firm_id: str
    source_system: str             # "gmail" | "calendar" | "manual"
    source_id: str                 # email message ID, calendar event ID, etc.
    source_hash: str               # SHA256 of (source_id + signal_type + extracted_date)
    signal_type: str               # "deadline_candidate" | "matter_event"
    extracted_date: Optional[date]
    matter_id: Optional[str]
    processed: bool
    outcome_id: Optional[str]      # deadline ID if a deadline was created
    first_seen_at: datetime
    last_seen_at: datetime
    created_at: datetime
    updated_at: datetime
```

**Deduplication rule:** Before creating any deadline candidate from Gmail or Calendar parsing, check if `source_hash` already exists in `ingestion_signals`. If it does, update `last_seen_at` and return the existing `outcome_id`. Do not create a duplicate deadline record.

---

## Collection: `escalations`

```python
class Escalation(LittBaseModel):
    id: str
    firm_id: str
    type: EscalationType           # DEADLINE | BILLING | COMMS | ANOMALY
    matter_id: Optional[str]
    entity_id: str                 # deadline_id, entry_id, comm_id, anomaly_id
    brief: EscalationBrief         # structured brief
    status: EscalationStatus       # PENDING | ACKNOWLEDGED | RESOLVED | DISMISSED
    routed_to: str                 # attorney_id
    priority: int                  # 1 (routine) to 5 (critical)
    workflow_state: Optional[Dict]  # saved workflow state for pause-and-wait
    workflow_status: Optional[str]  # PAUSED_AWAITING_INPUT | RESUMED | COMPLETED
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]
```

### Nested: `EscalationBrief`

```python
class EscalationBrief(BaseModel):
    what_is_happening: str         # one sentence, specific
    why_it_matters: str            # risk level, financial exposure, or relationship implication
    what_litt_has_done: str        # autonomous actions already taken
    what_attorney_must_decide: str # specific decision, options pre-populated
    decision_deadline: Optional[datetime]  # if time-constrained
    risk_level: RiskLevel          # CRITICAL | ELEVATED | ROUTINE
```

---

## Firestore Security Rules Summary

```javascript
// audit_log — CREATE only
match /firms/{firmId}/audit_log/{docId} {
  allow create: if isServiceAccount();
  allow read: if isAttorneyInFirm(firmId);
  allow update, delete: if false;
}

// deadline_events — CREATE only  
match /firms/{firmId}/deadline_events/{docId} {
  allow create: if isServiceAccount();
  allow read: if isAttorneyInFirm(firmId);
  allow update, delete: if false;
}

// time_entries — no DELETE
match /firms/{firmId}/time_entries/{docId} {
  allow create, read, update: if isAttorneyInFirm(firmId);
  allow delete: if false;
}

// ingestion_signals — service account only
match /firms/{firmId}/ingestion_signals/{docId} {
  allow create, read, update: if isServiceAccount();
  allow delete: if false;
}

// all other firm collections
match /firms/{firmId}/{collection}/{docId} {
  allow read, write: if isAttorneyInFirm(firmId);
}
```

**Note on immutability claims:** Firestore security rules prevent client-side mutations. Cloud admin and service accounts with appropriate IAM can still access data. For production, add Cloud Audit Logs, restricted IAM roles, and periodic export to WORM-style archival storage. Do not claim the audit log is absolutely immutable — claim it is append-only at the application and security-rule layer.

---

## Demo Mode Fields

Every collection query in demo mode filters by `firm_id = "strand-okafor"`. The demo reset script (`scripts/reset_demo.py`) deletes and re-seeds all documents under `firms/strand-okafor/`.

The demo readiness check (`GET /api/demo/ready`) validates:

```json
{
  "ok": true,
  "checks": {
    "deadline_mercer_escalates": true,
    "te_005_has_scrubber_warning": true,
    "te_001_has_missing_narrative": true,
    "acme_budget_warn": true,
    "whitmore_client_silence_trigger": true,
    "all_sections_non_empty": true
  }
}
```

If any check returns `false`, do not record the demo.
