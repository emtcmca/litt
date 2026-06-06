# 06 — Build Sequence

Phased plan with dependencies. Mirrors the repo's existing build-order discipline
(`CLAUDE.md`: contracts → tools → agents → brief → UI). Each phase is shippable and testable
on its own. **Backend before the frontend that depends on it**, but the Console shell + surfaces
over *existing* data can proceed in parallel from day one.

Legend: `[BE]` backend, `[FE]` frontend, `[X]` cross-cutting.

---

## Phase 0 — Foundations (unblocks everything)

1. `[FE]` **Console shell + routing + token crosswalk.** Build `ConsoleShell` + `ConsoleRail`
   (Prove above Tune), wire React Router, reframe `DailyCloseoutBrief` as Overview. Map `T.*` →
   CSS vars (doc 05). No new data needed — ships immediately.
2. `[BE]` **`ObservationType.ROUTE_HANDOFF`** + the `data.tool` / `data.handoff` sub-shapes in
   `observability.py` and `types.ts` (doc 02 §5, 03-03, 03-04). Tiny, but everything visual
   downstream depends on it.
3. `[BE]` **Tool registry** `tools/registry.py` + `GET /api/tools` (doc 03-04). Pure metadata.

**Gate:** shell renders all surfaces (some empty), `GET /api/tools` returns the catalog,
`pytest` still green.

---

## Phase 1 — Surfaces over existing data (no new entities)

These need only thin read endpoints + the prototype UI; the writes already exist.

4. `[BE]` `GET /api/deadlines` (full book, enriched) · `GET /api/budgets` ·
   `GET /api/relationships` (or extend the brief). Reuse cadence/util helpers; **no new writes**.
5. `[FE]` **Deadlines hero**, **Collect hero**, **Budgets**, **Anomalies**, **Integrations**,
   **Audit ledger** (over existing `GET /api/audit-log`). (docs 04, 05)
6. `[FE]` **Agent console graph v1** over the *current* sweep payload — node graph, playback,
   gate/work_kind styling, idle heartbeat, source-mapping. Tool chips render from `data.tool`
   once Phase 0.2 lands; before that they show the step description. (doc 05)

**Gate:** every Console surface shows real data from the demo firm; Agent console plays a real
sweep; ledger shows real events. This is already a compelling, shippable Console.

---

## Phase 2 — Tool-call depth + cross-agent routing (agent core, no new entities)

7. `[BE]` **Enrich agent observations** so each real tool call emits a `TOOL_CALL` with
   `data.tool` at full depth — billing's 4-call sequence, anomaly's 3-call sequence, deadline +
   comms reads (doc 03-04). Derive `work_kind` from `ToolKind`.
8. `[BE]` **Cross-agent hand-offs**: emit `ROUTE_HANDOFF` from comms for deadline/billing
   findings; stitch `parent_observation_id` in the coordinator (doc 03-03).
9. `[FE]` Agent console: **tool chips, inspector cards, per-agent tool lists, Tool layer
   catalog, boundary stat, hand-off edges** (docs 03-04, 05).

**Gate:** boundary stat matches the run; hand-off edges draw; inspector renders TOOL CALL +
Cross-agent hand-off cards. Verify with a sweep on demo data.

---

## Phase 3 — Inbound triage (first new entity)

10. `[BE]` `InboundMessage` model + `tools/inbound.py` (create/snooze/dismiss) + TS types
    (docs 02 §2, 03-01).
11. `[BE]` **comms_agent inbound pass**: `scan_inbox` → deterministic urgency scoring →
    Gemini summarize + action items → held reply via existing `create_client_comm` →
    `ROUTE_HANDOFF` for deadline/billing items. Emits its observations into the sweep.
12. `[BE]` `GET /api/inbound` + `inbound` brief section. Approve/send reuse existing comms
    endpoints.
13. `[FE]` **Relationships hero — "Awaiting your response"**: `InboundCard` collapsed/expanded,
    cross-links, held reply with grounding (doc 05).
14. `[X]` **Seed**: add 3 demo inbound emails (Mercer/Lindqvist/Acme) to the seed script so the
    triage list is populated and demo-stable.

**Gate:** `GET /api/inbound` returns the demo set; the Mercer card matches the prototype;
approving a reply walks the comms state machine + writes audit events; sweep shows the inbound
beats.

---

## Phase 4 — Commitment capture + lifecycle (second new entity)

15. `[BE]` `Commitment` model + `tools/commitments.py` (create/mark/link-to-book) + TS types
    (docs 02 §1, 03-02).
16. `[BE]` **`commitment_extractor`** + hook into `log_client_comm_sent` (extract on send);
    `ROUTE_HANDOFF` to deadline; `commitment.captured` ledger event.
17. `[BE]` `GET /api/commitments` + `POST /api/actions/commitment/mark`
    (`commitment.kept`/`slipped` events) + `commitments` brief section.
18. `[BE]` **Link to deadline book**: `SOFT_INTERNAL` deadline so commitments show on
    `GET /api/deadlines` (the "promise" chip).
19. `[FE]` **Relationships hero — "Commitments you've made"**: `CommitmentTracker`, `StageRail`,
    Mark kept/Slipped, ledger flash; **Deadlines** promise chip (docs 04-01, 05).
20. `[X]` **Seed**: the Reyes "answer by Friday" reply + the demo commitment set (incl. one
    KEPT, one SLIPPED) for a stable tracker.

**Gate:** sending the seeded reply creates a `TRACKED` commitment + `commitment.captured`;
marking outcomes writes events + flips the card; a linked commitment appears on the book.

---

## Phase 5 — Policy & autonomy (configurable gates)

21. `[BE]` `FirmPolicy` / `AttorneyPolicyOverride` models + `tools/policy.py` (set with
    tighten-only validation) + `GET /api/policy` + `POST /api/actions/policy/set` (doc 02 §3,
    04-02).
22. `[BE]` **Enforcement**: agents read effective posture when choosing `commitment_level`;
    `lockable` rules stay GATED; `policy.updated` ledger event.
23. `[FE]` **Policy & autonomy** page: dial, scope banner, rule rows, firm-locked pills,
    tighten-only stepper (docs 04-02, 05).
24. `[X]` **Seed**: the firm policy doc + the demo rule set (matches the prototype's domains).

**Gate:** loosening past the firm floor is rejected; a firm-locked rule can't be widened; every
change writes `policy.updated`; toggling a rule moves the dial.

---

## Phase 6 — Polish + demo hardening

25. `[X]` Wire the **email digest deep-links** to Console routes (ledger → `/ledger`, deadline →
    `/deadlines` focused, comms → `/relationships`).
26. `[X]` **Demo readiness**: extend `GET /api/demo/ready` with the new conditions (≥3 inbound,
    ≥1 due-soon commitment, policy doc present). Update `seed_demo.py` / `reset_demo.py` so
    `POST /api/demo/reset` restores the full Console state.
27. `[X]` `tsc --noEmit` + `pytest` green; screenshot every surface; verify the boundary stat,
    hand-off edges, ledger flash, and all date math against the frozen demo date.

---

## Dependency graph (what blocks what)

```
P0 shell ──────────────► all FE surfaces
P0 ROUTE_HANDOFF/data ─► P2 tool depth, P2 routing, P3/P4 handoffs
P0 registry ───────────► P2 chips/catalog/boundary stat
P1 read endpoints ─────► P1 FE surfaces
P3 inbound entity ─────► P4 commitments (capture hooks comms send)
P5 policy enforcement ─► (independent; can land any time after P0)
seed updates ──────────► demo readiness (P6)
```

## Risk notes / gotchas

- **Demo clock everywhere.** Every new `days_out`/`wait_days`/`days_silent` must use
  `config.get_effective_date()`. The single most likely bug class.
- **Don't fork models.** Extend `models.py` + mirror `types.ts`. The repo enforces parity.
- **Agents never write Firestore.** New features get tool functions in `app/tools/`; the agent
  calls the tool. No exceptions, including commitments/inbound.
- **`work_kind` honesty.** The boundary stat and the whole "deterministic vs Gemini" story are
  load-bearing for the demo. Only summarize/draft/extract are `gemini`.
- **Reuse the comms state machine** for inbound replies — don't build a second send path.
- **Contest rule:** all agent reasoning uses Gemini 2.5 Pro via Vertex AI (not Claude). The
  extraction/summary/draft calls already follow `comms_agent`/`deadline_agent` patterns — keep
  them.
- **Keep `pytest` green at every phase.** The existing suites (`test_state_machine`,
  `test_scrubber`, `test_idempotency`, `test_agent_observations`, …) guard the invariants the
  Console relies on.
