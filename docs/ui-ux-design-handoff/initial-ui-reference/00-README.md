# Litt — Console UI/UX Build Handoff

**Audience:** Claude Code, working in the `litt/` repo.
**Purpose:** Implement the Console UI/UX prototyped in Omelette, and the backend work
required to make it real, *without breaking the non-negotiable architecture* in
`CLAUDE.md`.

**Source of truth for visuals:** the Omelette prototype (`Litt - Console.html` +
`console-*.jsx`). This package describes that prototype in implementable terms and
maps every screen onto real repo files. When in doubt about *look/behavior*, the
prototype wins. When in doubt about *architecture*, `CLAUDE.md` + `docs/` win.

---

## How to read this package

Read in order. Each doc is execution-first; prose is kept to commented section
headers and acceptance criteria.

| Doc | What it covers | Read before… |
|-----|----------------|--------------|
| `00-README.md` | This file — orientation, scope, conventions | anything |
| `01-architecture-map.md` | What already exists in the repo, mapped to each Console surface. **The "do not rebuild this" doc.** | touching any code |
| `02-data-contracts.md` | New Firestore entities + changes to existing models/types (`Commitment`, `InboundMessage`, `FirmPolicy`, `ToolSpec`) | any model/schema work |
| `03-agent-core/` | The four novel agentic features. **Deepest specs.** | backend agent work |
| `03-agent-core/01-inbound-triage.md` | comms_agent inbound: read inbox → triage → draft reply | — |
| `03-agent-core/02-commitment-capture.md` | promises in *your* replies → soft deadlines, lifecycle | — |
| `03-agent-core/03-cross-agent-routing.md` | comms → deadline/billing hand-offs in the coordinator | — |
| `03-agent-core/04-tool-call-layer.md` | tool registry + richer `TOOL_CALL` observations for the graph | — |
| `04-features/` | The remaining Console surfaces (mostly frontend) | frontend work |
| `05-ui-inventory.md` | Console shell, design tokens, prototype→file map, component list | any frontend work |
| `06-build-sequence.md` | Phased plan with dependencies and a demo-safety checklist | planning |

---

## Scope of the Console

The prototype is a single-attorney **operations console** organized as a left rail
with four sections — the product's mental model:

- **Watch** — what needs you: `Overview`, `Deadlines`, `Budgets`, `Clients & comms`, `Anomalies`
- **Collect** — billing: `Collect` (WIP/pre-bill hero)
- **Prove** — defensibility: `Agent console`, `Audit ledger`
- **Tune** — control: `Policy & autonomy`, `Integrations`

> The *current* dashboard (`dashboard/src/App.tsx`) is a single `DailyCloseoutBrief`
> page plus `/audit` and `/email-preview`, with a `TimerHUD`. **The Console is a new
> shell that wraps and extends this** — the existing Brief becomes the `Overview`/`Brief`
> surface; `AuditLog` becomes the `Audit ledger`; the modals become per-surface detail.
> Nothing in the existing dashboard is thrown away; it is reorganized and extended.

---

## What is NET-NEW vs. what EXISTS (one-screen summary)

**Backend — already built (do NOT rebuild; see `01-architecture-map.md`):**
- Coordinator with deterministic `SIGNAL_ROUTING` + `execute_sweep()` → `AgentRunTimeline`
- Four sub-agents: `billing_agent`, `deadline_agent`, `comms_agent` (outbound/silence only), `anomaly_agent`
- `AgentObservation` / `AgentRunTimeline` / `ObservationType` (7) / `CommitmentLevel` (4) / `work_kind` — **this is what drives the Agent console**
- Tool layer (`app/tools/`) as the only write path; idempotency + optimistic lock + `log_audit_event()`
- Pre-bill scrubber, budget utilization, LEDES export, escalations/anomalies
- Brief assembler + `GET /api/brief`; audit log; demo clock + demo endpoints

**Backend — net-new (specs in `03-agent-core/` + `02-data-contracts.md`):**
1. **Inbound triage** — `comms_agent` gains an inbound path (urgency scoring = Python, summary/action-items/reply = Gemini). New `InboundMessage` entity, tools, brief section, endpoints.
2. **Commitment capture + lifecycle** — new `Commitment` (soft-deadline) entity, Gemini extraction from sent replies, `pending→tracked→kept|slipped` state machine, ledger events, surfacing on the deadline book.
3. **Cross-agent routing** — coordinator hand-off mechanism (`comms→deadline`, `comms→billing`) + a `ROUTE_HANDOFF` observation type.
4. **Tool-call layer** — a `ToolSpec` registry (kind/signature) + richer `TOOL_CALL` observation payload so the graph can show live tool chips, an inspector, and a catalog.
5. **Policy & autonomy** — new `FirmPolicy` + `AttorneyPolicyOverride` models with *tighten-only* enforcement at the gate.

**Frontend — net-new (the whole Console; specs in `04-features/` + `05-ui-inventory.md`):**
- Console shell (rail + hash routing), `Overview`, `Deadlines` hero, `Collect` hero, **`Agent console` graph** (the existing `AgentRunTimeline.tsx` is a vertical list — the prototype is a node-graph with playback, tool chips, inspector, idle heartbeat, source-mapping, hand-off edges, two-way inbox channel), `Audit ledger` page, `Policy & autonomy`, `Relationships` (inbound triage + commitments + going-quiet), `Budgets`, `Anomalies`, `Integrations`.

---

## Conventions used in this package

- **File references** are repo-relative: `backend/app/agents/comms_agent.py`.
- **Symbols** are backticked: `execute_sweep()`, `CommitmentLevel.ESCALATION`.
- **Prototype references** name the JSX file: *(prototype: `console-clients.jsx` → `InboundCard`)*.
- Code blocks are **illustrative scaffolds**, not drop-in final code — they show shape,
  signatures, and where things plug in. Follow existing repo patterns for the details
  (idempotency, optimistic lock, `log_audit_event`, `config.get_effective_datetime`).
- **`[NEW]`** marks a net-new file; **`[EXTEND]`** marks an edit to an existing file.

---

## The five rules this UI must never violate

These come straight from `CLAUDE.md` and the prototype was designed to honor them.
Every feature spec restates the relevant ones, but globally:

1. **Agents never write Firestore.** All writes go agents → `app/tools/` → Firestore.
   New features (commitments, inbound) get their **own tool functions**.
2. **Deterministic vs. Gemini boundary is sacred.** Urgency scoring, silence/commitment
   *detection*, lifecycle transitions, routing = **Python**. Summaries, reply drafts,
   commitment *extraction* = **Gemini**. The Agent console literally visualizes this
   boundary via `work_kind` — get it wrong and the headline UI lies.
3. **Every write calls `log_audit_event()`.** Commitment `captured/kept/slipped`,
   inbound reply approve/send — all emit ledger events. The Audit ledger page reads them.
4. **Human gate is real, not cosmetic.** "Litt never sends" = the reply/draft sits in a
   `*_HELD`/`DRAFT_GENERATED` status until an attorney action advances it. The prototype's
   "Approve & send" maps to existing comms state-machine transitions.
5. **Demo clock only.** Never `datetime.now()`; always `config.get_effective_date()` /
   `get_effective_datetime()`. All the "days out / days silent / X days ago" math in the
   UI must be computed server-side from the effective date.
