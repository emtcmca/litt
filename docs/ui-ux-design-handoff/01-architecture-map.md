# 01 — Architecture Map: What Already Exists

**Purpose:** the "do not rebuild this" doc. For every Console surface, this lists the
repo files that already implement most of it. Read this before writing *anything* —
most of the agent core is already in the repo and battle-tested by the test suite.

The golden rule: **the Console is a new presentation layer over an existing engine.**
The engine (coordinator, sub-agents, tools, observability, brief, audit) is built.
You are adding (a) a few new agent capabilities and (b) a new frontend.

---

## Backend, as it stands today

```
backend/app/
  config.py            # demo clock — get_effective_date() / get_effective_datetime()
  models.py            # ALL Pydantic entities (see below) — extend, don't fork
  observability.py     # AgentObservation, AgentRunTimeline, ObservationType, CommitmentLevel
  db.py                # collection_ref(firm_id, name) — Firestore tenancy helper
  agents/
    coordinator.py     # Coordinator.execute_sweep(), SIGNAL_ROUTING, classify_signal()
    billing_agent.py   # PENDING entry scan → prebill scrubber → log_anomaly
    deadline_agent.py  # verified deadline escalation + Gemini conflict-extraction
    comms_agent.py     # client SILENCE detection → Gemini draft → create_client_comm  [OUTBOUND ONLY]
    anomaly_agent.py   # pattern detectors + scoring overrides → log_anomaly
  tools/
    audit.py           # log_audit_event()  — CREATE-only, called by every write
    validation.py      # check_idempotency, register_idempotency, check_optimistic_lock
    alerts.py          # log_escalation(), log_anomaly(), dismiss_alert()
    billing.py         # write_time_entry, advance_entry_status, update_entry_narrative,
                       #   write_down_entry, write_off_entry, compute_budget_utilization, generate_invoice
    comms.py           # create_client_comm, approve_client_comm_draft, queue_client_comm_for_delivery,
                       #   log_client_comm_sent, dismiss_comm  + _COMM_TRANSITIONS state machine
    deadlines.py       # log_deadline_event, confirm_deadline, verify_deadline, resolve_deadline,
                       #   dismiss_deadline, supersede_deadline
  scrubber/prebill.py  # run_prebill_checks(entry, client), run_prebill_scrubber(firm_id, [ids])
  brief/assembler.py   # builds BriefResponse (the 5 sections)
  routes/
    brief.py           # GET /api/brief, POST /api/sweep
    actions.py         # ALL /api/actions/* write endpoints + billing/comms/deadline/timer
    demo.py            # /api/demo/ready, /reset, /state
  ingestion/           # fixture/OAuth adapters
  mcp_server/          # MCP toolset (v1.1 path)
```

### Entities already defined in `models.py` (extend; never duplicate)

`Attorney`, `Client`, `Matter`, `TimeEntry`, `Deadline`, `DeadlineEvent`,
`ClientCommunication`, `Invoice`, `AuditEvent`, `IngestionSignal`, `Escalation`,
`ToolResult`, `ToolError`, `BudgetUtilization`, plus nested: `BillingGuidelines`,
`EngagementTerms`, `SourceMapEntry`, `EscalationBrief`, write-down/off records.

Key enums already present: `TimeEntryStatus`, `DeadlineClass`, `DeadlineStatus`,
`VerificationStatus`, `DeadlineEventType`, `CommTrigger`, `CommStatus`, `AuditTier`,
`EscalationType`, `RiskLevel`, `AlertStatus`, `PermissionScope`.

### Observability model — **this is the Agent console's data source**

`backend/app/observability.py` already defines exactly what the prototype's sweep
playback consumes. Do not invent a parallel shape.

```python
class ObservationType(str, Enum):
    SIGNAL_RECEIVED, REASONING, ROUTING_DECISION, TOOL_CALL,
    RESULT, ESCALATION, APPROVAL_GATE_APPLIED            # 7 types

class CommitmentLevel(str, Enum):
    AUTO_SAFE, REVIEW_REQUIRED, ESCALATION, BLOCKED       # the 4 gates

class AgentObservation(BaseModel):
    observation_id, timestamp, agent_name,
    observation_type, commitment_level,
    description, data: dict,
    confidence, evidence: list[str],
    run_id, parent_observation_id, audit_log_id,
    work_kind: str = "deterministic"   # deterministic | llm_assisted | tool_write | human_gate
    model_name, attorney_next_action

class AgentRunTimeline(BaseModel):
    run_id, firm_id, triggered_by, started_at, completed_at,
    elapsed_seconds, observations: list[AgentObservation],
    brief_items_count, escalations_count
```

`POST /api/sweep` returns `SweepRunResponse = { timeline: AgentRunTimeline, brief: BriefResponse }`
(see `dashboard/src/types.ts`). **The Agent console graph is a new renderer over this
exact payload.** The four sub-agents already emit observations with `work_kind`,
`commitment_level`, `evidence`, and `attorney_next_action`.

---

## Prototype surface → existing code map

| Console surface (prototype) | Backed by (exists) | Net-new work |
|---|---|---|
| **Overview / Brief** *(console-brief.jsx)* | `brief/assembler.py`, `GET /api/brief`, `DailyCloseoutBrief.tsx`, `types.ts BriefResponse` | Re-skin into Console shell; add inbound + commitment counts |
| **Deadlines** hero *(console-deadlines.jsx)* | `deadline_agent.py`, `Deadline`/`DeadlineEvent`, `BriefDeadlineItem`, deadline actions/modals | New full-book view + timeline + cadence ladder; needs a "list all deadlines" read (see note) |
| **Collect** hero *(console-collect.jsx)* | `billing.py`, scrubber, `BriefTimeEntryItem`, budget util, LEDES export, `BillingWIPModal` | New hero layout over existing data/actions |
| **Agent console** *(console-agents.jsx)* | `coordinator.py`, `observability.py`, `POST /api/sweep`, `AgentRunTimeline.tsx` (list form) | **New graph renderer**; tool-call layer (doc 03-04); routing edges (03-03) |
| **Audit ledger** *(console-record.jsx)* | `audit.py`, `AuditEvent`, `GET /api/audit-log`, `AuditLog.tsx`, `AuditEventDrawer.tsx` | New ledger page (filters, before→after diffs, export) over existing events |
| **Policy & autonomy** *(console-policy.jsx)* | gate model exists (`CommitmentLevel`) but is **not configurable** | New `FirmPolicy`/override models + enforcement (doc 02 + 04-02) |
| **Relationships / Clients & comms** *(console-clients.jsx)* | `comms_agent.py` (silence), `ClientCommunication`, comms tools/state-machine, `ClientCommsModal` | Inbound triage (03-01) + commitments (03-02) are net-new; going-quiet exists |
| **Budgets** *(console-stubs.jsx)* | `compute_budget_utilization()`, `BriefBudgetItem` | New page over existing util; multi-matter listing read |
| **Anomalies** *(console-stubs.jsx)* | `anomaly_agent.py` detectors, `BriefAnomalyItem`, `AnomalyModal` | New page; detector roster surfaced (mostly display) |
| **Integrations** *(console-stubs.jsx)* | `ingestion/`, `mcp_server/` | New page; mostly presentational + connect stubs |

> **Deadlines read note:** the brief only returns *escalating* deadlines
> (`BriefDeadlineItem`). The Deadlines hero shows the **full book**. Add a read endpoint
> `GET /api/deadlines?firm_id=…` that lists all `ACTIVE` deadlines with computed
> `days_out`/`escalation_level` (reuse `deadline_agent._get_escalation_level` and
> `_CADENCE`). No new write path. Same pattern for `GET /api/budgets`, `GET /api/matters`
> (matters route already referenced by `api.ts getMatters`).

---

## Frontend, as it stands today

```
dashboard/src/
  App.tsx                       # 3 routes: / (brief), /email-preview, /audit  + <TimerHUD/>
  types.ts                      # mirrors backend models + observability (authoritative TS shapes)
  api.ts                        # fetch client — getBrief, runSweep, all actions, audit log, demo
  index.css                     # design tokens live as CSS vars: --color-*, --font-*, --border-radius-*
  components/
    DailyCloseoutBrief.tsx      # the current homepage — becomes Overview/Brief surface
    AgentRunTimeline.tsx        # vertical drip-list of observations (evolve → graph, or keep as "log" tab)
    AgentRunTimeline.css
    TimerHUD.tsx                # floating timer — keep, dock into Console
    DemoBanner.tsx, DemoResetButton.tsx
    modals/ { Anomaly, BillingWIP, Budget, ClientComms, Deadline }Modal.tsx
    shared/AuditEventDrawer.tsx
  pages/ { AuditLog.tsx, EmailPreview.tsx }
```

**Design tokens already exist** as CSS variables (`--color-ramp-teal-*`, `--color-text-*`,
`--font-mono`, `--border-radius-*`). The prototype hard-codes a palette (`T.forest`,
`T.brass`, `T.teal`, `T.danger`, IBM Plex). **Reconcile by mapping the prototype palette
onto the existing tokens** — see `05-ui-inventory.md` for the exact crosswalk. Do not
introduce a third color system.

---

## What the prototype deliberately faked (and the real source)

| Prototype mock | Real source to wire to |
|---|---|
| `window.LITTC` fixtures, `SWEEP` steps | `POST /api/sweep` → `AgentRunTimeline.observations` |
| Hard-coded `T` palette | `dashboard/src/index.css` CSS vars |
| In-file `LEDGER` array *(console-record.jsx)* | `GET /api/audit-log` → `AuditLogEvent[]` |
| `INBOUND`, `COMMITMENTS` arrays *(console-clients.jsx)* | new endpoints (docs 03-01, 03-02) |
| `DEADLINES_BOOK` *(console-deadlines.jsx)* | new `GET /api/deadlines` |
| Client-side "Mark kept" state | `POST /api/actions/commitment/mark` (doc 03-02) |
| Tool chips / catalog *(console-agents.jsx)* | `ToolSpec` registry + enriched `TOOL_CALL` (doc 03-04) |

Everything else (layout, spacing, copy, interaction, color usage, the four-section rail)
should be reproduced as-is. The prototype is the spec for those.
