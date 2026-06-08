# Client Module Build Plan — v1.3.0 (FINAL)

**Feature:** Client Onboarding · Client Command Center · Continuous Client Maintenance  
**Supersedes:** `tasks/client-module-build-plan.md` v1.2.0 — that file is retired. This is the single source of truth.  
**Design source:** `docs/ui-ux-design-handoff/design_handoff_client_module/` — read before building anything  
**Prototype:** `prototype-source/Litt - Clients.html` — open in Chrome, compare side-by-side during build  
**Acceptance target:** screenshots in `screens/` — after each page phase, match the screenshot; the screenshot is right  
**Fidelity:** pixel-level (every measurement, color, gap, font-size, radius, copy string is intentional)  
**Deadline:** June 10, 2026 (code freeze before demo rehearsal)

---

## Screens index (acceptance targets)

| File | Surface | Built in |
|---|---|---|
| `screens/01-roster.png` | `/clients` roster — subnav, summary strip, pending banner, client table | Phase 4 |
| `screens/02-cc-top.png` | Command Center — header, needs-attention (3), health strip | Phase 6 |
| `screens/03-cc-maintenance.png` | **Maintenance panel** — dark header + two-tier body | Phase 9 |
| `screens/04-cc-deadlines-billing.png` | Deadlines table + billing strip + inbound + audit header | Phase 6 |
| `screens/05-cc-audit.png` | Full audit trail — filter tabs, tier-colored events | Phase 6 |
| `screens/06-cc-billing-expanded.png` | Billing drawer expanded — WIP pipeline, held entry, invoices | Phase 6 |
| `screens/08-onboard-upload.png` | `/clients/new` upload — drop zone + dark auto-onboard panel | Phase 5 |
| `screens/09-onboard-review.png` | `/clients/new` review — side-by-side doc + extracted form | Phase 5 |

**No new ResolvePanel screenshots** — the Command Center's needs-attention items open the existing `ResolvePanel` unchanged.

---

## Architecture decisions (locked)

| Decision | Resolution |
|---|---|
| Route file | New `backend/app/routes/clients.py` — `app.include_router(clients.router, prefix="/api")` in `main.py` |
| Model strategy | Extend existing `Client` / `Matter` — additive only. No field removals. |
| Data loading (command center) | `Promise.all` of existing firm-wide endpoints, filter client-side by `client_id` + one new `getMaintenance` call |
| Audit log filter | `?client_id=X` added to `GET /api/audit-log`. Add `client_id: Optional[str] = None` to `AuditEvent` and `log_audit_event()` — all existing callers unaffected |
| Extraction | `POST /api/clients/extract` is **stateless** — PDF in memory, JSON out, nothing written |
| Create | `POST /api/clients` writes `clients/` + `matters/`, logs `client.created` + `matter.created` |
| Maintenance gate | **Two-tier, hardcoded.** `SAFE` → auto-apply via tool layer + log. `JUDGMENT` → Gemini drafts, persist as held `SuggestedUpdate`. Gate is a deterministic Python dict, never a model decision. |
| Auto-onboard | Watched inbox → `detect_engagement_letter()` → extract → write `PendingClient(status=drafted)`. Attorney confirms in one click. |
| Gemini output | `response_schema` structured output — flat fields + `confidence` dict. Same pattern for extraction and maintenance suggestions. |
| ResolvePanel | Needs-attention items on the Command Center open existing `ResolvePanel` — zero changes to that component |
| Nav | **Clients** (icon `users`) replaces "Clients & comms" (`relationships`) in the Watch rail. Relationships page stays; reached via "Comms" sub-nav tab. |
| Mercer billing rate | **$375/hr** — matches `te-001`. Any seed data saying $350 is wrong. |

---

## Design system (what to confirm before building pages)

### Tokens — already in `dashboard/src/tokens.ts`

No new tokens. Key ones for this module:

| Token | Value | Used for |
|---|---|---|
| `T.audit` | `#11140F` | Maintenance panel dark header |
| `T.auditAccent` | `#9EE1C7` | Freshness pulse dot, `refresh` tile |
| `T.auditMuted` | `#9DA89A` | Maintenance header secondary text |
| `T.gold` | `#A98435` | Held tier, medium confidence, budget WARN |
| `T.teal` | `#1D9E75` | Applied tier, high confidence, active/clear |
| `T.tealSoft` | `rgba(29,158,117,.10)` | "active" status chip background |
| `T.danger` | `#9B2D23` | Needs attention, unconfirmed, over budget |
| `T.wash2` | `#F8F7F4` | Applied column bg, roster header, alt rows |

### Atoms — confirm exist in `dashboard/src/components/ui/`

- **`Icon`** — verify `users` and `refresh` exist. If not, copy SVG paths from `prototype-source/litt-flows.jsx` (`Icon` function, `users` and `refresh` cases). `users` = two-figure group SVG; `refresh` = circular arrow SVG.
- **`Mono`** — `<span style={{ fontFamily:'var(--font-mono)' }}>`. Almost every micro-label is `Mono`, UPPERCASE, ~9.5–11px, `letterSpacing: '.06–.09em'`.

### New maps — add to `MaintenancePanel.tsx` (co-located, not global)

```ts
const MX_KIND_ICON: Record<string, IconName> = {
  deadline: 'shield', contact: 'mail', budget: 'chart', matter: 'book', conflict: 'alert',
};
const MX_KIND_TONE: Record<string, string> = {
  deadline: '#185FA5', contact: '#5F6F66', budget: T.gold, matter: '#1F4D3F', conflict: T.danger,
};
const CADENCES = [
  { k: 'hourly', label: 'Hourly',    next: 'in 48 min' },
  { k: 'daily',  label: 'Daily',     next: 'tomorrow 8:00 AM' },
  { k: 'events', label: 'On events', next: 'real-time' },
];
const CONF_TONE: Record<string, string> = {
  high: T.teal, medium: T.gold, low: T.danger, not_found: T.faint,
};
const CONF_LABEL: Record<string, string> = {
  high: 'high', medium: 'review', low: 'check', not_found: 'not in letter',
};
```

`CONF_TONE` / `CONF_LABEL` are also used in `ClientNew.tsx` — export from a shared `clientConstants.ts` if used in both.

### Shared components to extract (used by ≥2 surfaces)

| Component | File | Used by |
|---|---|---|
| `ClientsSubnav` | `dashboard/src/components/clients/ClientsSubnav.tsx` | `Clients.tsx`, `Relationships.tsx` |
| `BudgetBar` | `dashboard/src/components/clients/BudgetBar.tsx` | Roster rows, health strip, billing strip |
| `ConfidenceField` | `dashboard/src/components/clients/ConfidenceField.tsx` | `ClientNew.tsx` review form |
| `Sec` | inline atom (5 lines) in `Client.tsx` | Command Center section headers |

**`ClientsSubnav` spec** (from `client-roster.jsx`, `IA-AND-NAV.md`):
```tsx
// Container: display:inline-flex; gap:5; background:T.wash2; border:1px solid T.line; borderRadius:10; padding:4
// Active pill: background:T.surface; border:1px solid T.line; borderRadius:7; padding:6px 13px; fontSize:12.5; fontWeight:600; color:T.ink; leading Icon(13px) in T.forest
// Inactive pill: same padding; background:transparent; color:T.muted; Icon in T.muted; rendered as <Link>
// "All clients" → /clients;  "Comms" → /relationships
```

**`BudgetBar` spec** (from `client-roster.jsx`):
```tsx
// 7px track; borderRadius:999; background:T.wash2; overflow:hidden
// Fill: position:absolute; left:0; top:0; bottom:0; width:`${pct}%`; background:tone; borderRadius:999
// Marker: position:absolute; left:'75%'; top:0; bottom:0; width:2; background:T.gold; opacity:.45
// tone = pct>=90 ? T.danger : pct>=75 ? T.gold : T.teal
```

**`ConfidenceField` spec** (from `client-onboard.jsx`):
```tsx
// label row: label (12 T.muted, fontWeight:500) + right-aligned CONF_LABEL[conf] Mono chip (10, T.faint / T.teal / T.gold / T.danger)
// control: border:1px solid T.line; borderRadius:8; borderLeft:`3px solid ${CONF_TONE[conf]}`
// not_found: background:T.wash2; placeholder "Attorney to add…"; border-left in T.faint (neutral)
```

**`Sec` atom** (inline, 5 lines):
```tsx
// <div style={{ display:'flex'; alignItems:'center'; gap:8; marginBottom:10 }}>
//   <Mono style={{ fontSize:10; fontWeight:600; textTransform:'uppercase'; letterSpacing:'.08em'; color:T.muted }}>
//     {label}
//   </Mono>
//   {count != null && <Mono style={{ fontSize:10; color:T.danger; background:'rgba(155,45,35,.08)'; border:'1px solid rgba(155,45,35,.24)'; borderRadius:999; padding:'1px 7px' }}>{count}</Mono>}
// </div>
// + <div style={{ borderBottom:`1px solid ${T.line}`; marginBottom:14 }} />
```

---

## Phase summary

| Phase | Layer | Key work |
|---|---|---|
| **IA** | Nav change | `ConsoleRail.tsx` + `App.tsx` routes (apply first — everything hangs off this) |
| P0 | Models | New enums, `Client`/`Matter`/`AuditEvent` field additions, new models |
| P1 | Tools | `client_tools.py` (create, get) · `maintenance_tools.py` (review, classify, apply, suggest) |
| P2 | Routes | `clients.py` — all 11 endpoints; audit-log `client_id` filter |
| P3 | Types + api | TS mirrors + `api.ts` functions (incl. maintenance + pending) |
| P4 | Roster | `/clients` + `ClientsSubnav` + shared atoms → match `01-roster.png` |
| P5 | Onboarding | `/clients/new` upload→extract→review→confirm → match `08-onboard-upload.png`, `09-onboard-review.png` |
| P6 | Command center | `/clients/:clientId` all sections (excl. maintenance) → match `02`, `04`, `05`, `06` screens |
| P9 | Maintenance panel | `MaintenancePanel.tsx` → match `03-cc-maintenance.png` exactly |
| P10 | Maintenance job | `run_client_review`, `classify_update`, auto-onboard watcher, scheduler |
| P7 | Cross-page links | Client name links in Brief, Deadlines, Relationships |
| P8 | Tests + fixtures + deploy | Backend tests, Playwright smoke, demo seed, tsc, Cloud Run |

> **P9 before P10** — build the UI against mocked data first, then wire to the real backend.

---

## IA — Nav change (APPLY FIRST)

*Every page in this module needs the correct nav active state. Do this before writing any page component.*

### `dashboard/src/components/console/ConsoleRail.tsx`

Find the `Watch` group in the `NAV` array. Change from:
```ts
{ id: 'deadlines',     label: 'Deadlines',      path: '/deadlines',     icon: 'shield', count: 1 },
{ id: 'budgets',       label: 'Budgets',         path: '/budgets',       icon: 'chart',  count: 1 },
{ id: 'relationships', label: 'Clients & comms', path: '/relationships', icon: 'mail',   count: 1 },
{ id: 'anomalies',     label: 'Anomalies',       path: '/anomalies',     icon: 'alert',  count: 1 },
```
To:
```ts
{ id: 'clients',   label: 'Clients',   path: '/clients',    icon: 'users',  count: 4 },
{ id: 'deadlines', label: 'Deadlines', path: '/deadlines',  icon: 'shield', count: 1 },
{ id: 'budgets',   label: 'Budgets',   path: '/budgets',    icon: 'chart',  count: 1 },
{ id: 'anomalies', label: 'Anomalies', path: '/anomalies',  icon: 'alert',  count: 1 },
```

- `relationships` **removed from the rail** — keep the route in `App.tsx`.
- `isActive` for `clients` must match on prefix, not strict equality. Change the active check for this item to: `pathname === '/clients' || pathname.startsWith('/clients/')`.
- Verify `Icon` has `users` and `refresh`. Add them if missing (paths in `design-system.md`).

### `dashboard/src/App.tsx`

Add three routes **in this order** (specificity — `/clients/new` before `/:clientId`):
```tsx
<Route path="/clients"           element={<ConsoleShell><Clients /></ConsoleShell>} />
<Route path="/clients/new"       element={<ConsoleShell><ClientNew /></ConsoleShell>} />
<Route path="/clients/:clientId" element={<ConsoleShell><Client /></ConsoleShell>} />
```
Keep `<Route path="/relationships">` unchanged.

### IA Gate checks
- [ ] IA-G1 `/clients` renders, "Clients" rail item is active and highlighted
- [ ] IA-G2 `/clients/mercer-industries` — "Clients" rail item still active (prefix match)
- [ ] IA-G3 `/relationships` — "Clients" rail item **not** active
- [ ] IA-G4 `tsc --noEmit` clean

---

## Phase 0 — Data Models

*Must complete before Phase 1. All field additions use defaults — existing seed data continues to deserialize.*

### `backend/app/models.py` — new enums
- [ ] CM-P0-01 `ClientType`: `individual | entity | trust | estate`
- [ ] CM-P0-02 `ClientStatus`: `active | inactive | closed`
- [ ] CM-P0-03 `ExtractionConfidence`: `high | medium | low | not_found`
- [ ] CM-P0-04 `UpdateClass`: `safe | judgment`
- [ ] CM-P0-05 `SuggestionStatus`: `held | applied | dismissed`
- [ ] CM-P0-06 `MaintenanceCadence`: `hourly | daily | events`
- [ ] CM-P0-07 `PendingClientStatus`: `drafted | confirmed | discarded`
- [ ] CM-P0-08 Add `estate = "estate"` and `corporate = "corporate"` to `MatterType`

### `Client` model — net-new fields only (the rest already exist)
Already present — do NOT re-add: `name`, `billing_contact`, `billing_email`, `arrangement`, `budget_cap`, `budget_billed`, `retainer_balance`, `last_client_contact`, `client_silence_threshold_days`, `engagement_terms` (`EngagementTerms` has `engagement_letter_signed`, `engagement_letter_date`, `fee_type`), `notes`.

Add:
- [ ] CM-P0-09 `client_type: ClientType = ClientType.entity`
- [ ] CM-P0-10 `client_status: ClientStatus = ClientStatus.active`
- [ ] CM-P0-11 `primary_contact_name: str = ""`
- [ ] CM-P0-12 `primary_contact_phone: str = ""`
- [ ] CM-P0-13 `originating_attorney_id: str = ""`
- [ ] CM-P0-14 `responsible_attorney_id: str = ""`
- [ ] CM-P0-15 `engagement_letter_ref: Optional[str] = None`
- [ ] CM-P0-16 `conflict_check_names: List[str] = Field(default_factory=list)`
- [ ] CM-P0-17 `conflict_check_date: Optional[date] = None`
- [ ] CM-P0-18 `conflict_check_cleared: bool = False`
- [ ] CM-P0-19 `maintenance_cadence: MaintenanceCadence = MaintenanceCadence.hourly`
- [ ] CM-P0-20 `last_reviewed_at: Optional[datetime] = None`
- [ ] CM-P0-21 `watched_signal_count: int = 0`

> Note: `rate` displayed in the roster ($375/h for Mercer) is NOT a `Client` field — derive from `Attorney.default_rate` / `rate_overrides[matter_id]`. The roster's rate column is presentational.

### `Matter` model — litigation fields (all optional)
- [ ] CM-P0-22 `opposing_counsel: Optional[str] = None`
- [ ] CM-P0-23 `court: Optional[str] = None`
- [ ] CM-P0-24 `jurisdiction: Optional[str] = None`
- [ ] CM-P0-25 `case_number: Optional[str] = None`
- [ ] CM-P0-26 `expected_resolution: Optional[date] = None`
- [ ] CM-P0-27 `budget_cap: Optional[Decimal] = None` on Matter (separate from Client.budget_cap)

### `AuditEvent` model — add client scope
- [ ] CM-P0-28 Add `client_id: Optional[str] = None` to `AuditEvent`
- [ ] CM-P0-29 Add `client_id: Optional[str] = None` to `log_audit_event()` signature (default `None`, written to the doc). All existing call sites unchanged.

### New models

```python
# Stateless — NOT LittBaseModel — never written to Firestore
class ExtractionResult(BaseModel):
    client_name: Optional[str] = None
    client_type: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[str] = None
    primary_contact_phone: Optional[str] = None
    billing_rate: Optional[float] = None
    billing_type: Optional[str] = None
    billing_cycle: Optional[str] = None
    payment_terms: Optional[str] = None
    engagement_type: Optional[str] = None
    date_engaged: Optional[str] = None          # ISO string
    matter_name: Optional[str] = None
    matter_type: Optional[str] = None
    opposing_counsel: Optional[str] = None
    court: Optional[str] = None
    case_number: Optional[str] = None
    conflict_check_names: List[str] = Field(default_factory=list)
    confidence: Dict[str, str] = Field(default_factory=dict)   # field -> ExtractionConfidence
    extraction_notes: str = ""
    fields_extracted_count: int = 0
    fields_total: int = 16
```

- [ ] CM-P0-30 Add `ExtractionResult` to `models.py`

```python
class AppliedUpdate(LittBaseModel):          # already applied & logged — FYI
    client_id: str
    kind: str                                # deadline|contact|budget|matter|conflict
    field_label: str
    change: str
    source: str
    source_ref: str
    work: str                                # deterministic|llm_assisted
    confidence: Optional[float] = None
    applied_at: datetime
    audit_event_id: str

class SuggestedUpdate(LittBaseModel):        # judgment — held for attorney
    client_id: str
    title: str
    detail: str
    source: str
    source_ref: str
    confidence: float
    status: SuggestionStatus = SuggestionStatus.held
    resolution_reason: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None

class ClientMaintenanceState(BaseModel):     # computed read model — not stored as-is
    client_id: str
    cadence: MaintenanceCadence
    last_reviewed_label: str
    last_reviewed_at: datetime
    next_sweep_label: str
    reviews_today: int
    watched_signal_count: int
    applied: List[AppliedUpdate] = Field(default_factory=list)
    suggested: List[SuggestedUpdate] = Field(default_factory=list)

class PendingClient(LittBaseModel):          # auto-drafted from watched letter
    proposed_name: str
    via: str
    detected_at: datetime
    source_file: str
    extraction: ExtractionResult
    status: PendingClientStatus = PendingClientStatus.drafted

class ClientListItem(BaseModel):             # roster row — computed
    client_id: str
    client_name: str
    client_type: str
    client_status: str
    engagement: str
    matter_short: str
    rate: Optional[float] = None
    billing: str = ""
    matter_count: int
    pending_item_count: int
    budget_utilization_pct: Optional[float] = None
    budget_used: Optional[float] = None
    budget_cap: Optional[float] = None
    days_since_contact: Optional[int] = None
    last_contact_label: Optional[str] = None
    last_reviewed_label: Optional[str] = None
    held_suggestion_count: int = 0

class MatterCreateRequest(BaseModel):
    matter_name: str
    matter_type: str
    opposing_counsel: Optional[str] = None
    court: Optional[str] = None
    case_number: Optional[str] = None
    expected_resolution: Optional[str] = None  # ISO date

class ClientCreateRequest(BaseModel):
    firm_id: str
    client_name: str
    client_type: str = "entity"
    primary_contact_name: str
    primary_contact_email: str
    primary_contact_phone: str = ""
    billing_rate: float
    billing_type: str = "hourly"
    billing_cycle: str = "monthly"
    payment_terms: str = "net_30"
    engagement_type: str
    date_engaged: str
    engagement_letter_ref: Optional[str] = None
    responsible_attorney_id: str = "dana-strand"
    conflict_check_names: List[str] = Field(default_factory=list)
    silence_threshold_days: int = 14
    budget_warn_threshold_pct: int = 75
    budget_cap: Optional[float] = None
    notes: Optional[str] = None
    first_matter: MatterCreateRequest
```

- [ ] CM-P0-31 Add `AppliedUpdate`, `SuggestedUpdate`, `ClientMaintenanceState`, `PendingClient`, `ClientListItem`, `MatterCreateRequest`, `ClientCreateRequest` to `models.py`

Firestore collections (firm-scoped under `firms/{firm_id}/`): `clients`, `matters` already exist. Add: `pending_clients`, `client_suggestions`, `client_applied_updates`.

### Phase 0 gate checks
- [ ] CM-G0-01 `python -c "from app.models import ClientType, ClientStatus, UpdateClass, MaintenanceCadence"` clean
- [ ] CM-G0-02 `python -c "from app.models import ExtractionResult, ClientCreateRequest, ClientMaintenanceState, PendingClient"` clean
- [ ] CM-G0-03 `pytest tests/` green — no regressions (all new fields have defaults)
- [ ] CM-G0-04 `tsc --noEmit` clean (no TS changes yet — baseline)

---

## Phase 1 — Tool Layer

### `backend/app/tools/client_tools.py` [NEW]

- [ ] CM-P1-01 `create_client(firm_id, req: ClientCreateRequest, idempotency_key) -> ToolResult | ToolError`
  - Slug `client_id` from `client_name` (lowercase, hyphens, strip punctuation)
  - Idempotency check on `(firm_id, client_id)` — return existing if hit
  - Write `Client` doc mapping `req` fields onto `Client` model (including new fields); `created_at/updated_at = get_effective_datetime()`
  - `log_audit_event(tier=AuditTier.legal_defensibility, event_type="client.created", entity_type="client", entity_id=client_id, client_id=client_id, actor=req.responsible_attorney_id, after_state={...})`
  - Return `ToolResult(success=True, entity_id=client_id, entity_type="client", audit_event_id=ae_id)`

- [ ] CM-P1-02 `create_matter(firm_id, client_id, req: MatterCreateRequest, idempotency_key) -> ToolResult | ToolError`
  - Slug `matter_id` from `client_id + matter_name`
  - Write `Matter` doc; `status = MatterStatus.ACTIVE`
  - `log_audit_event(... event_type="matter.created", entity_type="matter", entity_id=matter_id, client_id=client_id)`
  - Return `ToolResult`

- [ ] CM-P1-03 `get_clients(firm_id) -> List[ClientListItem]`
  - Read `firms/{firm_id}/clients` collection
  - Per client: count matters (read `matters` where `client_id == id`), count `pending_item_count` (PENDING escalations for client), compute `budget_utilization_pct` from `budget_billed/budget_cap`, compute `days_since_contact` from `last_client_contact` vs `get_effective_datetime()`, read `held_suggestion_count` from `client_suggestions` where `status=held`
  - Sort: `pending_item_count DESC, budget_utilization_pct DESC`
  - Populate `rate` from `Attorney.default_rate` for `responsible_attorney_id`

### `backend/app/tools/maintenance_tools.py` [NEW]

- [ ] CM-P1-04 `classify_update(change: dict) -> UpdateClass`
  **Explicit table — never a model call:**
  - SAFE: `kind in {new_deadline_from_auth_source, contact_field_from_signature, deterministic_budget_recompute, inbound_logged_to_timeline}`
  - JUDGMENT: `kind in {matter_stage_reclassification, threshold_change, conflict_name_addition, status_transition, budget_increase_proposal}`

- [ ] CM-P1-05 `run_client_review(firm_id, client_id, sweep_id) -> dict`
  - Idempotent: check `(client_id, sweep_id)` — no-op if already processed
  - Read watched signals: active deadlines, pending/approved billing, budget utilization, inbound messages
  - Compute diff vs stored `Client`/`Matter`
  - Per diff: `classify_update(change)` →
    - **SAFE**: apply via tool layer, `log_audit_event(..., client_id=client_id)`, write `AppliedUpdate` (carry returned `audit_event_id`)
    - **JUDGMENT**: Gemini drafts `title`/`detail`/`confidence` (structured output); write `SuggestedUpdate(status=held)`; **no mutation**
  - Update `Client.last_reviewed_at = get_effective_datetime()`, increment `reviews_today`
  - Return `{"applied": [...], "suggested": [...], "sweep_id": sweep_id}`

- [ ] CM-P1-06 `apply_suggestion(firm_id, client_id, suggestion_id, actor) -> ToolResult | ToolError`
  - Fetch `SuggestedUpdate`; verify `status == held`
  - Perform the held change via the tool layer
  - `log_audit_event(... event_type="suggestion.applied", client_id=client_id)`
  - Set status `applied`, `resolved_by=actor`, `resolved_at=get_effective_datetime()`

- [ ] CM-P1-07 `dismiss_suggestion(firm_id, client_id, suggestion_id, reason, actor) -> ToolResult | ToolError`
  - Require `reason` (not empty, ≥4 chars) — else `ToolError(VALIDATION_FAILED, "reason is required")`
  - `log_audit_event(... event_type="suggestion.dismissed", notes=reason, client_id=client_id)`
  - Set status `dismissed`, `resolution_reason=reason`, `resolved_by=actor`

- [ ] CM-P1-08 `detect_engagement_letter(message: dict) -> bool`
  - Deterministic classifier: check subject keywords + attachment filetype (`.pdf`) + heuristic patterns (`"engagement letter"`, `"retainer"`, `"scope of representation"`)
  - On `True`: call `POST /api/clients/extract` internally → write `PendingClient(status=drafted)` → `log_audit_event(event_type="client.auto_drafted")`

### Seed demo data (`scripts/seed_demo.py`)
- [ ] CM-P1-09 Seed 4 `Client` documents with all new fields:
  - **mercer-industries**: `client_type=entity, client_status=active, primary_contact_name="Sandra Mercer", responsible_attorney_id="dana-strand", engagement_letter_ref="mercer-eng-ltr-2026.pdf", conflict_check_names=["Dunlap Construction LLP"], maintenance_cadence=hourly, rate=$375 (via attorney), budget_billed=37200, budget_cap=60000`
  - **acme-commercial**: `client_type=entity, engagement_type=transactional, rate=$325, billing=retainer, budget_billed=11700, budget_cap=15000`
  - **whitmore-group**: `client_type=individual, engagement_type=advisory, rate=$300, budget_billed=9300, budget_cap=30000`
  - **lindqvist-holdings**: `client_type=entity, engagement_type=litigation, rate=$400, budget_billed=22000, budget_cap=50000`
- [ ] CM-P1-10 Seed `client_suggestions` (held) and `client_applied_updates` for Mercer using `MAINTENANCE['mercer-industries']` values from `prototype-source/clients-data.js`
- [ ] CM-P1-11 Seed 5–7 client-scoped `audit_log` events for Mercer using `DETAIL['mercer-industries'].audit` values (incl. `client.created`, `billing.approved`, `contact.updated`, `deadline.escalated`)
- [ ] CM-P1-12 Seed one `PendingClient` doc: `proposed_name="Cordova Partners LLC"`, `via="Watched inbox · Gmail"`, `source_file="Cordova-Engagement-Letter-signed.pdf"`, `status=drafted`, `extraction=EXTRACTION` values from `clients-data.js`

### Phase 1 gate checks
- [ ] CM-G1-01 `from app.tools.client_tools import create_client, create_matter, get_clients` clean
- [ ] CM-G1-02 `from app.tools.maintenance_tools import run_client_review, classify_update, apply_suggestion, dismiss_suggestion` clean
- [ ] CM-G1-03 `create_client()` idempotent: second call with same key returns existing, no duplicate write
- [ ] CM-G1-04 `classify_update({kind: "new_deadline_from_auth_source"})` → `UpdateClass.safe`; `classify_update({kind: "matter_stage_reclassification"})` → `UpdateClass.judgment`
- [ ] CM-G1-05 `dismiss_suggestion()` with empty reason returns `ToolError(VALIDATION_FAILED)`
- [ ] CM-G1-06 `pytest tests/` green

---

## Phase 2 — Backend Routes

### `backend/app/routes/clients.py` [NEW]

Register in `main.py`: `app.include_router(clients.router, prefix="/api")`

| Method · path | Body / params | Returns | Tool calls |
|---|---|---|---|
| `GET /clients` | `?firm_id` | `List[ClientListItem]` | `get_clients` |
| `POST /clients` | `ClientCreateRequest` | `{client_id, matter_id, status}` | `create_client` → `create_matter` (idempotency_key = `firm_id+client_name+date_engaged`) |
| `POST /clients/extract` | multipart: `document` (PDF) + `firm_id` | `ExtractionResult` | validate `%PDF`; base64 → Gemini 2.5 Pro w/ `response_schema`; **stateless** |
| `GET /clients/pending` | `?firm_id` | `List[PendingClient]` | read `pending_clients` |
| `POST /clients/pending/{pid}/confirm` | edits | `{client_id, matter_id}` | promote via `create_client` / `create_matter`; set pending `confirmed` |
| `POST /clients/pending/{pid}/discard` | `{reason}` | `ActionResult` | status `discarded`, logged |
| `GET /clients/{id}/maintenance` | `?firm_id` | `ClientMaintenanceState` | read `client_suggestions` + `client_applied_updates` + client meta |
| `POST /clients/{id}/review` | `{firm_id}` | `ClientMaintenanceState` | `run_client_review` (synchronous "Review now") |
| `PATCH /clients/{id}/cadence` | `{cadence, firm_id}` | `ActionResult` | update `maintenance_cadence`, `log_audit_event` |
| `POST /clients/{id}/suggestions/{sid}/apply` | `{actor, firm_id}` | `ActionResult` | `apply_suggestion` |
| `POST /clients/{id}/suggestions/{sid}/dismiss` | `{reason, actor, firm_id}` | `ActionResult` | `dismiss_suggestion` |

- [ ] CM-P2-01 through CM-P2-11 — implement all 11 routes above
- [ ] CM-P2-12 Extraction Gemini system prompt: *"You are a legal document parser. Extract structured client intake data from this engagement letter. Return only fields explicitly stated. For each field extracted, add it to `confidence` as 'high' (explicitly stated), 'medium' (strongly implied), or 'low' (inferred). Leave fields absent if not found."*

### Audit-log client_id filter (`backend/app/routes/brief.py`)
- [ ] CM-P2-13 Add `client_id: Optional[str] = None` param to `GET /api/audit-log`
- [ ] CM-P2-14 When provided, filter Firestore query: `.where("client_id", "==", client_id)`

### Phase 2 gate checks
- [ ] CM-G2-01 `GET /api/clients?firm_id=strand-okafor` → 4 items after seed, sorted Mercer first
- [ ] CM-G2-02 `POST /api/clients` with valid request → 200, `{client_id, matter_id}`
- [ ] CM-G2-03 `POST /api/clients` called twice with same key → idempotent, no duplicate
- [ ] CM-G2-04 `POST /api/clients/extract` with fixture PDF → valid `ExtractionResult` JSON
- [ ] CM-G2-05 `GET /api/audit-log?firm_id=strand-okafor&client_id=mercer-industries` → filtered events
- [ ] CM-G2-06 `GET /api/clients/pending?firm_id=strand-okafor` → Cordova Partners pending client
- [ ] CM-G2-07 `GET /api/clients/mercer-industries/maintenance?firm_id=strand-okafor` → 3 held, 4 applied
- [ ] CM-G2-08 `POST /api/clients/mercer-industries/suggestions/ms-1/dismiss` with empty reason → 422
- [ ] CM-G2-09 `pytest tests/` green

---

## Phase 3 — TypeScript Types + api.ts

### `dashboard/src/types.ts` — add interfaces

Mirror every new model exactly. Key additions:
- [ ] CM-P3-01 `ClientListItem`, `ExtractionResult`, `ClientMaintenanceState`
- [ ] CM-P3-02 `AppliedUpdate`, `SuggestedUpdate`, `PendingClient`
- [ ] CM-P3-03 `MatterCreateRequest`, `ClientCreateRequest`, `ClientCreateResponse`

### `dashboard/src/api.ts` — add functions

Follow existing `get<T>` / `post<T>` helpers. `FIRM_ID = 'strand-okafor'`:

- [ ] CM-P3-04 `getClients(firmId): Promise<ClientListItem[]>` — `GET /clients`
- [ ] CM-P3-05 `getPendingClients(firmId): Promise<PendingClient[]>` — `GET /clients/pending`
- [ ] CM-P3-06 `createClient(req: ClientCreateRequest): Promise<ClientCreateResponse>` — `POST /clients`
- [ ] CM-P3-07 `confirmPendingClient(pid: string, edits: Partial<ClientCreateRequest>): Promise<ClientCreateResponse>` — `POST /clients/pending/:pid/confirm`
- [ ] CM-P3-08 `extractFromDocument(firmId: string, file: File): Promise<ExtractionResult>` — `POST /clients/extract` via `FormData` (not JSON — `Content-Type: multipart/form-data`)
- [ ] CM-P3-09 `getMaintenance(firmId: string, clientId: string): Promise<ClientMaintenanceState>` — `GET /clients/:id/maintenance`
- [ ] CM-P3-10 `reviewClient(firmId: string, clientId: string): Promise<ClientMaintenanceState>` — `POST /clients/:id/review`
- [ ] CM-P3-11 `setCadence(clientId: string, cadence: string): Promise<ActionResult>` — `PATCH /clients/:id/cadence`
- [ ] CM-P3-12 `applySuggestion(clientId: string, sid: string): Promise<ActionResult>` — `POST .../suggestions/:sid/apply`
- [ ] CM-P3-13 `dismissSuggestion(clientId: string, sid: string, reason: string): Promise<ActionResult>` — `POST .../suggestions/:sid/dismiss`
- [ ] CM-P3-14 Extend `getAuditLog` opts with `clientId?: string` → adds `client_id` query param

### Demo fixtures for mocked Playwright tests
- [ ] CM-P3-15 `dashboard/src/demo-fixtures/clients.json` — 4 `ClientListItem` objects
- [ ] CM-P3-16 `dashboard/src/demo-fixtures/maintenance.json` — `ClientMaintenanceState` for Mercer (3 held, 4 applied — values from `MAINTENANCE['mercer-industries']` in `clients-data.js`)
- [ ] CM-P3-17 `dashboard/src/demo-fixtures/pending.json` — 1 `PendingClient` (Cordova Partners)

### Phase 3 gate checks
- [ ] CM-G3-01 `tsc --noEmit` clean after type additions
- [ ] CM-G3-02 All 10 new api.ts functions callable from browser console without TS errors
- [ ] CM-G3-03 `clients.json` fixture validates against `ClientListItem[]` shape

---

## Phase 4 — Roster (`/clients`)

**Accept target: `screens/01-roster.png`**  
**Prototype source: `prototype-source/client-roster.jsx` — `ClientRoster`, `RosterRow`**

### Shared components (build first)
- [ ] CM-P4-01 `ClientsSubnav.tsx` — All clients / Comms segmented control per spec in design-system.md
- [ ] CM-P4-02 `BudgetBar.tsx` — 7px track with 75% marker per spec above
- [ ] CM-P4-03 Apply `ClientsSubnav` to `Relationships.tsx` ("Comms" tab active, "All clients" links to `/clients`)

### `dashboard/src/pages/Clients.tsx` [NEW]
- [ ] CM-P4-04 Column `max-width: 960px`, `margin: 0 auto`, `display:grid; gap:18`, `padding: 24px 30px 60px`
- [ ] CM-P4-05 **`ClientsSubnav`** — `justify-self: start`
- [ ] CM-P4-06 **Header row** — `flex; justify-between; align-end; flex-wrap`:
  - Left: `<h1>` "Clients" (26/600/`-.02em`, `T.ink`) + teal "ROSTER" `Mono` chip (`T.tealSoft` bg, `rgba(29,158,117,.28)` border, `5` radius, `2px 7px` pad)
  - Sub-paragraph: 14px `T.muted`, `lineHeight:1.5`, `maxWidth:60ch`: *"Every client Litt watches — health, budget, and the items on your radar at a glance. Litt keeps each file current on a cadence; open one for the full command center."*
  - Right: **Add client** button — `forest` bg, `brass` text, `users` icon (15px), `11px 17px` pad, `10` radius → `/clients/new`
- [ ] CM-P4-07 **Summary strip** — `surface` card, `1px solid T.line`, `14` radius, `flex; gap:26; flex-wrap; align:center; padding:15px 20px`:
  - 4 stat blocks: `{dot}{number}` + `Mono` label + `Mono` sub:
    - Active clients `{count}` / `T.teal` / "on the roster"
    - Needs you `{pendingSum}` / `T.danger` / "open items"
    - Going quiet `{quietCount}` (days > 14) / `T.gold` / "past 14d silent"
    - Budget watch `{watchCount}` (pct ≥ 75) / `T.gold` / "over 75%"
  - Each stat: `8px dot + 22/700 number` then `Mono` 10 uppercase label + `Mono` 10 sub
  - Right-pushed pill: `wash2` bg + `soft` border, `9` radius, `8px 12px` pad — pulsing `auditAccent` 6px dot + `Mono` "All files reviewed within the hour"
- [ ] CM-P4-08 **Pending-onboarding banner** (only when `getPendingClients()` non-empty):
  - `surface` card, `border: 1px solid rgba(169,132,53,.34)`, `borderLeft: 3px solid T.gold`, `13` radius, `grid; gridTemplate: auto 1fr auto; gap:14; align:center; padding:14px 18px`
  - Gold icon tile: `36x36`, `9` radius, `rgba(169,132,53,.1)` bg, `rgba(169,132,53,.28)` border → `mail` icon 16px `T.gold`
  - Text: "New client drafted from an engagement letter" (13.5/600, `T.ink`) + `Mono` gold chip "auto · held" (9px, gold bg/border, `5` radius)
  - Sub `Mono` (10.5, `T.faint`): `{name} · {via} · detected {detectedLabel} · {fieldsExtracted}/{fieldsTotal} fields extracted`
  - **Review & confirm** button (forest/brass, `arrow` icon) → `/clients/new?pending={id}`
- [ ] CM-P4-09 **Roster table** — `surface` card, `1px solid T.line`, `14` radius, `overflow:hidden`:
  - Header: grid `232px 1fr 150px 132px`, `gap:16`, `padding:10px 18px`, `wash2` bg, bottom border `1px solid T.soft`. Columns: `Mono` 9.5 uppercase `T.faint` "Client · Matter · budget · Contact · (empty right-aligned)"
  - **`RosterRow`**: grid `232px 1fr 150px 132px`, `gap:16`, `padding:14px 18px`, hover bg `wash2`, `borderLeft:3px solid {pending ? T.danger : 'transparent'}`, cursor pointer:
    - **Col 1**: client name (14/600, `T.ink`) + `flex; gap:7`: `Mono` 9.5 engagement uppercase `T.muted` · 3px `T.faint` dot · `Mono` 9.5 status `T.teal`
    - **Col 2**: `flex; justify-between; marginBottom:5`: `Mono` 10 `T.faint` matterShort + `{pct}%` (12/600, budget tone). Below: `BudgetBar` with `pct`
    - **Col 3**: `{N}d since contact` — `12.5 T.gold fontWeight:600` iff stale (>14d), else `12.5 T.muted`. Below: `Mono` 9.5 `T.faint` "reviewed {label}"
    - **Col 4**: right-aligned: iff `pending > 0` → `Mono` 10.5/600 danger pill "N needs you" (`rgba(155,45,35,.08)` bg, `rgba(155,45,35,.24)` border, `999` radius, `2px 9px`); else `Mono` 10.5 `T.teal` "clear". + `chevron` 14px `T.faint`
  - Sort: `pending DESC, budgetPct DESC` → order is Mercer (2), Acme (1, 78%), Whitmore (1, 31%), Lindqvist (0)
  - Row click → `/clients/:clientId`
- [ ] CM-P4-10 Loading: 4 skeleton rows (`wash2` animated bars)
- [ ] CM-P4-11 Empty state: "No clients yet — add your first client" centered in the table card

### Phase 4 gate checks
- [ ] CM-G4-01 Open browser at `/clients`. Side-by-side with `screens/01-roster.png`. Match: subnav position, header, summary strip stat values, pending banner gold border + chip, table column widths, sort order (Mercer first), budget bar colors, "needs you" pill vs "clear" text
- [ ] CM-G4-02 Budget bar: Acme 78% → gold fill; Mercer 62% → teal fill; 75% marker visible on both
- [ ] CM-G4-03 Mercer row: `borderLeft: 3px solid T.danger`; Lindqvist row: `borderLeft: 3px transparent`
- [ ] CM-G4-04 Whitmore "16d since contact" → gold, fontWeight 600
- [ ] CM-G4-05 "Review & confirm" button → navigates to `/clients/new?pending=cordova-partners`
- [ ] CM-G4-06 `tsc --noEmit` clean

---

## Phase 5 — Onboarding (`/clients/new`)

**Accept targets: `screens/08-onboard-upload.png`, `screens/09-onboard-review.png`**  
**Prototype source: `prototype-source/client-onboard.jsx` — `ClientOnboard`, `Field`, `FieldGroup`, `DocPanel`**

Internal state machine: `upload → extracting → reviewing → confirming → done`  
Entering with `?pending={id}` → skip to `reviewing` with `entry='pending'`

### Upload state (`08-onboard-upload.png`)
- [ ] CM-P5-01 `max-width: 720px`, `margin:0 auto`, `padding: 24px 30px 60px`
- [ ] CM-P5-02 `< Clients` back link (`Mono` ish, `T.muted`) → `/clients`
- [ ] CM-P5-03 `<h1>` "Add a client" (26/600) + sub: *"Drop the engagement letter. Gemini extracts the profile and first matter — you review everything before anything is saved."*
- [ ] CM-P5-04 **Drop zone** — `<button>`, `2px dashed T.line`, hover `borderColor: T.gold`, `padding:46px`, `borderRadius:14`, full-width:
  - `book` icon tile (32px, `wash2` bg, `9` radius)
  - "Drop engagement letter here" (15/600, `T.ink`) + `Mono` "or click to select a PDF" (`T.faint`)
  - **Select PDF** button (`forest/brass`, `10` radius, `11px 22px`)
  - On drop / file select → `extractFromDocument()` → `extracting` state
  - Hidden `<input type="file" accept=".pdf">`
- [ ] CM-P5-05 **Extracting state** (transient overlay in drop zone): centered `ag-spin` + "Reading the engagement letter…" + `Mono` "gemini-2.5-pro · structured extraction · nothing saved yet" + step chips
- [ ] CM-P5-06 **"Litt also onboards automatically"** dark panel (`T.audit`, `14` radius, `padding:18px 20px`):
  - Header: `refresh` icon + `Mono` "LITT ALSO ONBOARDS AUTOMATICALLY" (`auditAccent`)
  - Body text: 13.5 `#EFEBDB`: *"When a signed engagement letter lands in your watched inbox, Litt extracts the same profile and holds it as a **pending client** — ready for one-click confirm. You never start from a blank form."*
  - Pending row (when `getPendingClients()` non-empty, `rgba(0,0,0,.2)` bg, `10` radius, `12px 14px` pad): gold `6px` dot · `proposed_name` (13/600, `#EFEBDB`) + `Mono` faint "{via} · detected {detectedLabel}" · **Review draft** brass outline button → `reviewing` state, `entry='pending'`

### Reviewing state (`09-onboard-review.png`)
- [ ] CM-P5-07 `max-width: 1080px`; in-page state change (no route change)
- [ ] CM-P5-08 Header: `< Clients` back · `<h1>` "Review extraction" + gold chip "auto-drafted · held" iff `entry==='pending'`. Right: **Back** ghost + **Confirm & add client** forest button (`check` icon). Sub: `Mono` *"{extracted} of {total} fields extracted · {needsReview} need review · nothing saved until you confirm"*
- [ ] CM-P5-09 **Confidence legend strip** (`wash2` bg, `10` radius, `10px 14px`, `flex gap:18`): 4 swatches — `Stated in letter` (3px teal left) · `Implied — review` (gold) · `Inferred — check` (danger) · `Not found — add` (faint). Each: 3px × 14px block + 12px `T.muted` label
- [ ] CM-P5-10 **Side-by-side grid** (`grid; 1fr 1.15fr; gap:20`; collapses < 980px):
  - **Left — `DocPanel`**: `surface` card, `14` radius, `overflow:hidden`. Header: `Mono` filename + pages + "PDF" chip. Body: `<embed src={URL.createObjectURL(file)} type="application/pdf" width="100%" style={{minHeight:460}}` />. Caption: `Mono` faint "native browser PDF viewer · highlighted spans = extracted". When `entry='pending'`, show striped placeholder (prototype style) since no real file object.
  - **Right — extracted form**: `surface` card, `18px` pad, `14` radius. `FieldGroup` sections:
    - **CLIENT**: Name\* (`high`), Type (`high`, `<select>`), Primary contact\* (`high`), Email\* (`high`), Phone (`not_found`)
    - **BILLING**: Rate $/hr\* (`high`), Type (`high`, `<select>`), Cycle (`medium`, `<select>`), Terms (`medium`, `<select>`)
    - **FIRST MATTER**: Matter name\* (`high`), Type (`high`, `<select>`), Engaged\* (`high`, date), Opposing counsel (`medium`), Court (`not_found`), Case # (`not_found`)
    - **CONFLICT NAMES**: removable chips + `+ add` button; gold note: *"Conflict check pending — attorney responsibility. Auto-detection arrives in v1.2.2."*
    - **GEMINI'S NOTE**: `Mono` `T.faint` extraction_notes from `ExtractionResult`
  - Each **`ConfidenceField`**: label (12, 500, `T.muted`) + right-aligned `CONF_LABEL[conf]` `Mono` chip (10, toned); control with `borderLeft:3px solid CONF_TONE[conf]`; `not_found` → `wash2` bg, "Attorney to add…" placeholder
  - Required fields (`*`): gate Confirm button (disabled until all filled; extraction pre-fills, so enabled by default)
- [ ] CM-P5-11 **Confirming state**: spinner + "Adding {client_name}…" + `Mono` "create_client() · create_matter() · log_audit_event()"
- [ ] CM-P5-12 On success → `navigate('/clients/${response.client_id}')`
- [ ] CM-P5-13 Extraction failure (500) → show empty manual form with all fields empty, no confidence borders, no crash

### Phase 5 gate checks
- [ ] CM-G5-01 Open browser at `/clients/new`. Side-by-side with `screens/08-onboard-upload.png`. Match: drop zone dashed border, dark auto-onboard panel, Cordova Partners pending row, "Review draft" button
- [ ] CM-G5-02 Drop a PDF → extracting spinner → reviewing state. Side-by-side with `screens/09-onboard-review.png`. Match: confidence legend colors, DocPanel frame, form field borders (teal/gold/danger/none)
- [ ] CM-G5-03 "Phone" field has `not_found` style (faint border, `wash2` bg, "Attorney to add…" placeholder)
- [ ] CM-G5-04 Confirm button enabled (all required fields prefilled)
- [ ] CM-G5-05 Empty required field → Confirm button disabled
- [ ] CM-G5-06 "Review draft" (pending path) → opens review with "auto-drafted · held" gold chip
- [ ] CM-G5-07 `tsc --noEmit` clean

---

## Phase 6 — Command Center (`/clients/:clientId`)

**Accept targets: `screens/02-cc-top.png`, `screens/04-cc-deadlines-billing.png`, `screens/05-cc-audit.png`, `screens/06-cc-billing-expanded.png`**  
**Prototype source: `prototype-source/client-command.jsx` — `ClientCommand`, `AttnCard`, `HealthStrip`, `BillingSection`, `AuditTrail`**  
*MaintenancePanel built separately in Phase 9 — mount a placeholder here, fill it in Phase 9.*

Load on mount via `Promise.all`: `getClients`, `getDeadlinesFull`, `getBudgets`, `getInbound`, `getAuditLog({client_id})`, `getMaintenance`. Filter all firm-wide results to `clientId`.

- [x] CM-P6-01 Column `max-width: 1040px`, `margin:0 auto`, `padding:24px 30px 60px`, `display:grid; gap:16`

### Header (`02-cc-top.png`)
- [x] CM-P6-02 `< Clients` back link (`Mono` `T.muted`, chevron icon, `flex; gap:5; align:center`) → `/clients`
- [x] CM-P6-03 `flex; justify-between; align-start`: 
  - Left: `<h1>` client name (27/600) + flex row: `Mono` matter name + 3 uppercase chips (engagement, type, status — status `tealSoft` bg). Below: `Mono` `T.faint` *"{contact} · {role} · responsible {attorney} · engaged {engagedDate}"*
  - Right: **Run sweep** button (forest/brass, `refresh` icon) → calls `reviewClient()`. Below right: `Mono` "● reviewed by Litt {label}" with pulsing `auditAccent` dot

### Needs-attention + Health (grid `1.5fr 1fr`, collapses < 1080px)
- [x] CM-P6-04 **`Sec` header**: "NEEDS ATTENTION" + danger count pill when > 0
- [x] CM-P6-05 **`AttnCard`** per brief decision item filtered to this client
- [x] CM-P6-06 **`HealthStrip`** (`surface` card, `1px solid T.line`, `14` radius)

### Maintenance panel placeholder
- [x] CM-P6-07 Placeholder card "Maintenance panel — built in Phase 9" between health strip and deadlines

### All deadlines (`04-cc-deadlines-billing.png`)
- [x] CM-P6-08 `Sec` "ALL DEADLINES" + count pill
- [x] CM-P6-09 Deadline rows with UNCONFIRMED/CONFIRMED pills; `last_confirmed_at` drives `isUnconf`

### Billing · WIP · budget (`04` collapsed, `06` expanded)
- [x] CM-P6-10 `Sec` "BILLING · WIP · BUDGET"
- [x] CM-P6-11 Summary strip — budget%, WIP, realization, rate, Full billing toggle
- [x] CM-P6-12 Expanded drawer — WIP pipeline, held-by-scrubber entries, invoices placeholder

### Inbound
- [x] CM-P6-13 `Sec` "INBOUND" + danger count
- [x] CM-P6-14 Message cards with initials avatar, urgency left-border, Triage button
- [x] CM-P6-15 Empty state

### Full audit trail (`05-cc-audit.png`)
- [x] CM-P6-16 `Sec` "FULL AUDIT TRAIL"
- [x] CM-P6-17 Toolbar with filter tabs + "append-only · N events"
- [x] CM-P6-18 Event rows with tier color coding
- [x] CM-P6-19 Filter logic — attorney/tool/state categories
- [x] CM-P6-20 Empty state

### ResolvePanel wiring
- [x] CM-P6-21 `useState<ItemDescriptor | null>` modal state
- [x] CM-P6-22 `<ResolvePanel>` mounted below scroll area, onSuccess marks resolved

### Phase 6 gate checks
- [ ] CM-G6-01 Open `/clients/mercer-industries`. Side-by-side with `02-cc-top.png`. Match: header layout, back link, chips (LITIGATION · ENTITY · ACTIVE), "reviewed by Litt 12 min ago" stamp, 3 needs-attention cards, health strip values (62% · $37,200 / $60,000 · 2d · 1 inbound · 3 open items)
- [ ] CM-G6-02 Click a needs-attention card → `ResolvePanel` opens correctly
- [ ] CM-G6-03 Scroll to deadlines. Side-by-side with `04-cc-deadlines-billing.png`. Match: "Opposition to MSJ" danger left-border + "UNCONFIRMED" pill; "Expert disclosure" no left-border + "CONFIRMED" pill
- [ ] CM-G6-04 Billing strip: `62% · $1,500 · 92% · $375/h`. Click "Full billing →" → expanded drawer renders. Side-by-side with `06-cc-billing-expanded.png`. Match: WIP pipeline bars, held entry gold border + flag chip, invoices.
- [ ] CM-G6-05 Audit trail: filter "Attorney actions" → only `billing.approved` + `client.created` events visible. "Tool calls" → `deadline.escalated` + `deadline.ingested` + `contact.updated` + `client.reviewed` visible.
- [x] CM-G6-06 `tsc --noEmit` clean

---

## Phase 9 — Maintenance Panel (THE HERO)

**Accept target: `screens/03-cc-maintenance.png` — match this exactly**  
**Prototype source: `prototype-source/client-maintenance.jsx` — `MaintenancePanel`, `SuggestionCard`, `AppliedRow`**

*This panel is the most important surface in the module. Every detail matters.*

### `dashboard/src/components/MaintenancePanel.tsx` [NEW]

Full-width `section`: `border:1px solid T.line; borderRadius:16; overflow:hidden`

#### (a) Dark "machinery" header
- [x] CM-P9-01 `background:T.audit; padding:15px 20px; flex; gap:12; flex-wrap; align:center`
  - `auditAccent` `refresh` icon tile (30px, `rgba(158,225,199,.12)` bg, `8` radius)
  - Title block: **"Litt is keeping this file current"** (15/600, `#EFEBDB`) + pulsing `auditAccent` 6px dot (`litt-pulse`). Below: `Mono` `T.auditMuted` *"Reviewed {lastReviewedLabel} · {reviewsToday} sweeps today · watching {watchedSignalCount} signals · next {nextSweepLabel}"*
  - **Cadence segmented control** (`CADENCES` — Hourly / Daily / On events):
    - Track: `rgba(0,0,0,.28)` bg, `8` radius, `padding:3`
    - Active pill: `T.brass` bg, `T.forest` text, `6` radius
    - Inactive: transparent, `auditMuted` text
    - On click → `setCadence(clientId, k)` then refetch `getMaintenance`
  - **Review now** outline-brass button (brass text + border, forest text hover, `refresh` icon) → `reviewClient()`. While pending: spinner + "Reviewing…". On resolve: relabel "Reviewed just now" + refetch

#### (b) Two-tier body
- [x] CM-P9-02 Grid `1fr 1fr` (`< 900px` → stack single column, drop divider). No padding — sections are full-height.

**Left — Held for your review** (`surface` bg, `padding:15px 18px`, `borderRight:1px solid T.line`):
- [x] CM-P9-03 Header: `8px T.gold` dot + `Mono` "HELD FOR YOUR REVIEW" (`T.muted`) + gold count pill
- [x] CM-P9-04 **`SuggestionCard`** per `SuggestedUpdate` with `status === 'held'`:
  - `surface` card, `3px gold left-border`, `12` radius, `overflow:hidden`
  - Body (`padding:14px 16px`): title (13.5/600, `T.ink`) + confidence pill top-right (10, toned by conf band — `≥.85 → teal, ≥.70 → gold, <.70 → danger`, value `.toFixed(2)`)
  - Detail (12, `T.muted`, `marginTop:5`)
  - Source chip row: gold `Mono` source label + `T.faint` sourceRef
  - **Footer** (`wash2` bg, `topBorder:1px solid T.line`, `padding:10px 16px; flex; gap:8; align:center`):
    - **Apply & log** (forest/brass, `check` icon, `10` radius) → `applySuggestion(clientId, sid)`
    - **Dismiss** ghost → swap footer to dismiss input
    - `Mono` `T.faint` "held · Litt won't apply judgment calls silently"
  - **Dismiss input** (replaces footer): `reason` textarea (`minHeight:52`, `1px solid T.line`, `borderLeft:3px solid T.gold`) + **Cancel** ghost + **Dismiss with reason** danger button (disabled until `reason.trim().length >= 4`) → `dismissSuggestion(clientId, sid, reason)`
  - **Post-action collapse** (`cm-flash` animation → row collapses to 1 line): Applied → teal check + "Applied & written to the ledger". Dismissed → `T.muted` strike + "Dismissed · '{reason}'"
  - After any action: refetch `getMaintenance`
- [x] CM-P9-05 Empty state (all applied/dismissed): centered teal `check` tile + "Nothing needs your judgment — file is current."

**Right — Applied automatically** (`wash2` bg, `padding:15px 18px`):
- [x] CM-P9-06 Header: `8px T.teal` dot + `Mono` "APPLIED AUTOMATICALLY" + right `Mono` `T.faint` "safe · already logged"
- [x] CM-P9-07 **`AppliedRow`** per `AppliedUpdate`:
  - Grid `auto 1fr auto`, `padding:9px 4px`, hairline bottom border `T.soft`
  - Kind icon tile: 28px, `MX_KIND_TONE[kind]`-tinted bg (light), icon `MX_KIND_ICON[kind]`
  - `Mono` `MX_KIND_TONE[kind]` field_label (10.5/600) + `Mono` `T.faint` when. Below: change (12.5, `T.ink`). Chip row: gold `Mono` source + `T.faint` sourceRef + `Mono` `T.faint` work label (`deterministic` or `gemini · {conf.toFixed(2)}`)
  - Right: teal `check` (12px) + `Mono` `T.teal` "logged" (9.5)
  - Entire row links to its `audit_event_id` entry in the audit trail

#### (c) Footer contract line
- [x] CM-P9-08 `surface` bg, `topBorder:1px solid T.line`, `padding:10px 20px; flex; gap:8; align:center`
  - `lock` icon (14px, `T.faint`)
  - `Mono` `T.faint` 10: *"Two tiers, one rule: factual updates apply & log; anything needing judgment is held. Every change — applied or held — is on the audit ledger."*

### Mount on `Client.tsx`
- [x] CM-P9-09 Replace Phase 6 placeholder with `<MaintenancePanel clientId={clientId} firmId={FIRM_ID} />` between health strip and All Deadlines section
- [x] CM-P9-10 "Run sweep" header button increments `sweepToken` → `MaintenancePanel` re-fetches on `refreshTrigger` change

### Phase 9 gate checks
- [ ] CM-G9-01 Open `/clients/mercer-industries`. Scroll to maintenance panel. Side-by-side with `screens/03-cc-maintenance.png`. Match: dark header with cadence control, "Reviewed 12 min ago · 6 sweeps today · watching 5 signals · next in 48 min", "Hourly" active pill (brass bg). Left: 3 gold-bordered suggestion cards with correct titles, detail, source chips, confidence pills. Right: 4 applied rows — Deadline ingested, Contact updated, Budget recomputed, Matter field set — each with kind icon toned correctly + "logged" marker. Footer contract line.
- [ ] CM-G9-02 Click "Apply & log" on first suggestion → card collapses to "Applied & written to the ledger", `POST .../apply` fires, re-fetch updates counts
- [ ] CM-G9-03 Click "Dismiss" → footer swaps to textarea. "Dismiss with reason" disabled. Type 3 chars → still disabled. Type 4 chars → enabled. Submit → card collapses, `POST .../dismiss` fires with reason
- [ ] CM-G9-04 Click "Daily" cadence → `PATCH .../cadence` fires, "next" label updates to "tomorrow 8:00 AM"
- [ ] CM-G9-05 "Review now" → spinner → `POST .../review` fires → state refreshes, "Reviewed just now"
- [x] CM-G9-06 `tsc --noEmit` clean

---

## Phase 10 — Maintenance Job + Auto-Onboard Watcher

*All in backend. Frontend already built in P9.*

### `backend/app/tools/maintenance_tools.py` — complete
(Tasks CM-P1-04 through CM-P1-08 cover the core functions. P10 adds the scheduler wiring.)

- [ ] CM-P10-01 `POST /api/clients/{id}/review` route already handles manual "Review now" — wire `run_client_review(firm_id, client_id, sweep_id=generate_sweep_id())` synchronously
- [ ] CM-P10-02 `POST /api/internal/maintenance/sweep` — Cloud Scheduler target: iterate all clients in the given cadence bucket → `run_client_review` per client. Auth: service-account bearer token. Not a public endpoint.
- [ ] CM-P10-03 Verify `detect_engagement_letter()` true-positive on the Cordova fixture PDF (or any engagement letter PDF with standard signatures)

### Phase 10 gate checks
- [ ] CM-G10-01 `run_client_review` on seeded Mercer → ≥1 applied + ≥1 held; second call with same `sweep_id` is no-op (idempotent)
- [ ] CM-G10-02 A SAFE update writes exactly one `audit_log` row; a JUDGMENT update writes zero mutations + one held suggestion
- [ ] CM-G10-03 `dismiss_suggestion` with empty reason → `ToolError(VALIDATION_FAILED)`
- [ ] CM-G10-04 `detect_engagement_letter` → `True` on fixture → `PendingClient` appears in `GET /api/clients/pending`
- [ ] CM-G10-05 `pytest tests/` green

---

## Phase 7 — Cross-Page Client Links

*Small changes — client names become `<Link>` in 3 existing pages.*

- [ ] CM-P7-01 `dashboard/src/pages/Brief.tsx` — `client_name` in each decision card → `<Link to={/clients/${d.client_id}} style={{color:T.ink}} onClick={e => e.stopPropagation()}>{d.client_name}</Link>` (stop propagation so the ResolvePanel opener doesn't fire)
- [ ] CM-P7-02 Deadlines page — `client_name` column → `<Link>`
- [ ] CM-P7-03 `Relationships.tsx` — client name rows → `<Link>`

### Phase 7 gate checks
- [ ] CM-G7-01 Brief → clicking client name navigates to command center (not ResolvePanel)
- [ ] CM-G7-02 `tsc --noEmit` clean

---

## Phase 8 — Tests, Demo Fixtures, Deploy

### Backend tests
- [ ] CM-P8-01 `backend/tests/test_client_tools.py` [NEW]:
  - `test_create_client_idempotent`
  - `test_create_matter_links_client`
  - `test_get_clients_returns_sorted_list`
  - `test_classify_update_safe_cases`
  - `test_classify_update_judgment_cases`
  - `test_dismiss_suggestion_rejects_empty_reason`

- [ ] CM-P8-02 `backend/tests/test_client_routes.py` [NEW]:
  - `test_get_clients_200`
  - `test_create_client_201`
  - `test_create_client_idempotent_200`
  - `test_extract_endpoint_200`
  - `test_get_maintenance_200`
  - `test_dismiss_suggestion_empty_reason_422`

### Playwright smoke tests (`dashboard/tests/14-client-module.spec.ts`) [NEW]
- [ ] CM-P8-03 Mock `**/api/clients*` with `clients.json`; `**/api/clients/*/maintenance*` with `maintenance.json`; `**/api/clients/pending*` with `pending.json`
- [ ] CM-P8-04 Test: `/clients` renders 4 rows, sorted Mercer first
- [ ] CM-P8-05 Test: Mercer row has danger left-border; Lindqvist row has no danger left-border
- [ ] CM-P8-06 Test: clicking Mercer row navigates to `/clients/mercer-industries`
- [ ] CM-P8-07 Test: `/clients/mercer-industries` renders without crash — "Needs attention" section visible
- [ ] CM-P8-08 Test: needs-attention card click opens `ResolvePanel` (heading visible)
- [ ] CM-P8-09 Test: maintenance panel renders "HELD FOR YOUR REVIEW" + "APPLIED AUTOMATICALLY" headers
- [ ] CM-P8-10 Test: "Apply & log" fires `POST` to maintenance apply endpoint
- [ ] CM-P8-11 Test: "Dismiss" → "Dismiss with reason" disabled; type 4 chars → enabled
- [ ] CM-P8-12 Test: `/clients/new` renders drop zone + dark auto-onboard panel
- [ ] CM-P8-13 Test: `/clients/new?pending=cordova-partners` renders review state with "auto-drafted · held" chip

### Final gate checks
- [ ] CM-G8-01 `pytest tests/` — all tests green (200+ total incl. new client tests)
- [ ] CM-G8-02 `tsc --noEmit` clean
- [ ] CM-G8-03 `npm run build` clean (no unused vars, no type errors — catches TS6133 before Cloud Run)
- [ ] CM-G8-04 `GET /api/demo/ready` — all 5 demo conditions still pass after seeding clients
- [ ] CM-G8-05 Cloud Run redeploy: `gcloud run deploy --source` — `/clients` accessible at live URL

---

## File inventory

### New files

| Path | Description |
|---|---|
| `backend/app/routes/clients.py` | 11 endpoints — CRUD, extract, maintenance, pending |
| `backend/app/tools/client_tools.py` | create_client, create_matter, get_clients |
| `backend/app/tools/maintenance_tools.py` | run_client_review, classify_update, apply/dismiss, detect_engagement_letter |
| `backend/tests/test_client_tools.py` | tool layer unit tests |
| `backend/tests/test_client_routes.py` | route integration tests |
| `dashboard/src/pages/Clients.tsx` | Roster |
| `dashboard/src/pages/ClientNew.tsx` | Onboarding (upload → review → confirm) |
| `dashboard/src/pages/Client.tsx` | Command center |
| `dashboard/src/components/MaintenancePanel.tsx` | Continuous maintenance UI |
| `dashboard/src/components/clients/ClientsSubnav.tsx` | All clients / Comms tab control |
| `dashboard/src/components/clients/BudgetBar.tsx` | Threshold-marked utilization bar |
| `dashboard/src/components/clients/ConfidenceField.tsx` | Labeled input with confidence border |
| `dashboard/src/demo-fixtures/clients.json` | `ClientListItem[]` mock fixture |
| `dashboard/src/demo-fixtures/maintenance.json` | Mercer `ClientMaintenanceState` fixture |
| `dashboard/src/demo-fixtures/pending.json` | Cordova `PendingClient` fixture |
| `dashboard/tests/14-client-module.spec.ts` | Playwright smoke tests |

### Modified files

| Path | Changes |
|---|---|
| `backend/app/models.py` | 7 new enums, Client/Matter/AuditEvent field additions, 8 new models |
| `backend/app/main.py` | `app.include_router(clients.router, prefix="/api")` |
| `backend/app/routes/brief.py` | `client_id` filter on `GET /api/audit-log` |
| `backend/app/tools/audit.py` | `client_id` param on `log_audit_event()` |
| `scripts/seed_demo.py` | 4 clients, maintenance state, pending client, audit events (Mercer $375) |
| `dashboard/src/types.ts` | 8 new interfaces |
| `dashboard/src/api.ts` | 11 new functions + extend `getAuditLog` |
| `dashboard/src/App.tsx` | 3 new routes (specific order: /clients/new before /:clientId) |
| `dashboard/src/components/console/ConsoleRail.tsx` | Watch group: Clients replaces Clients & comms; isActive prefix match |
| `dashboard/src/pages/Brief.tsx` | client_name → Link (stopPropagation) |
| `dashboard/src/pages/Relationships.tsx` | ClientsSubnav added; client_name → Link |
| `dashboard/src/pages/Deadlines.tsx` | client_name → Link |

---

## Demo script (7 steps — for recording)

1. Open `/clients` — 4 clients with health bars, "Needs you" counts; pending banner "Cordova Partners LLC · AUTO · HELD" at top
2. Click **Mercer Industries** — command center loads; header shows matter + chips + "reviewed 12 min ago"
3. Show **Needs attention** (3 cards) — click Opposition to MSJ → **ResolvePanel** opens → confirm deadline → card collapses to "resolved"
4. Scroll to **"Litt is keeping this file current"** maintenance panel — show Held (3) + Applied (4). **Apply** "Reclassify matter stage" → collapses to applied. **Dismiss** "Add Dunlap Holdings" → reason required → type reason → collapses to dismissed.
5. Continue scrolling — All deadlines, billing strip ($1,500 unbilled), open **Full billing** drawer (WIP pipeline, held entry, invoices). Scroll to audit trail — filter "Tool calls" → show Litt's passive work.
6. Navigate back to `/clients` → pending banner → **Review & confirm** → onboarding review screen (Cordova Partners extraction, confidence indicators) → **Confirm & add client** → land on new Cordova command center.
7. Navigate to `/clients` — Cordova now appears in the roster.

---

## Not in scope for this build (v1.2.x / v1.3.x)

- Conflict-check automation (auto-scan for name collisions) — v1.2.2
- Client status workflow (active → closing → closed)
- Multi-matter rollup per client (command center shows primary matter)
- Live Gmail OAuth for real letter ingestion (watcher is fixture-driven)
- Timer HUD — v1.2.1
- Per-suggestion "explain Litt's work" ProofBlock drawer — fast follow
- Per-client billing summary (total billed YTD, outstanding balance)
