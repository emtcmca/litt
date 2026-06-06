# 03·03 — Cross-Agent Routing (hand-offs in the coordinator)

**One line:** when one agent finds something that belongs to another — an inbound email that
names a court deadline, or a billing question — it **hands off** to that agent instead of
dead-ending. The prototype draws this as a gold dashed edge between Client Comms and the
Deadline Monitor, with a "Cross-agent hand-off" inspector card.

**Prototype:** `console-agents.jsx` — the two `ROUTE_HANDOFF` sweep steps (comms → deadline,
comms → billing) and the bowed hand-off edge; cross-links also appear as `→ Deadline Monitor`
chips on inbound triage action items (`console-clients.jsx`).

**Today:** `coordinator.py` runs the four agents in a **fixed sequence** with no
inter-agent communication. `SIGNAL_ROUTING` maps *signal types* to agents, but nothing routes
*a finding from one agent into another*. This adds that.

---

## Design: keep routing deterministic and observable

Routing is Python (Rule 8). A hand-off is **not** an agent deciding to call another agent via
an LLM — it is a deterministic rule: "inbound message mentions a deadline → emit a hand-off to
`deadline_agent` for that entity." Two ways to implement; **prefer A** for v1.

### Option A — hand-off as a recorded intent (simplest, demo-faithful)

The originating agent (comms) emits a `ROUTE_HANDOFF` observation naming the target agent and
entity. The coordinator already runs every agent each sweep, so the target agent will pick the
entity up on its own pass. The hand-off observation is what the graph renders; no new control
flow is required.

```python
# in comms_agent inbound pass, when an action item names a deadline:
observations.append(_obs(
    observation_type=ObservationType.ROUTE_HANDOFF,
    commitment_level=CommitmentLevel.AUTO_SAFE,
    work_kind="route",
    description="Hand-off: Mercer message names a Thursday deadline → Deadline Monitor",
    data={"handoff": {"from": "comms_agent", "to": "deadline_agent",
                      "entity_id": "dl-mercer-001", "reason": "inbound mentions court date"}},
    evidence=["dl-mercer-001"],
))
```

### Option B — explicit dispatch (v1.1)

The coordinator exposes a small in-process bus; comms enqueues a typed signal
(`DEADLINE_CANDIDATE`, entity id) that the coordinator feeds to `route_signal()` →
`deadline_agent` within the same sweep, threading `parent_observation_id` so the graph can
draw a true causal edge. More faithful, more plumbing. Park unless time allows.

---

## Coordinator changes  `[EXTEND] coordinator.py`

- Add `ROUTE_HANDOFF` to the pre/sub-observation collection (no special handling needed if you
  use Option A — it just flows through `result["observations"]`).
- Optionally, after sub-agent runs, **link** hand-offs to their target observations by setting
  `parent_observation_id` on the target agent's matching observation (the deadline escalation
  for `dl-mercer-001`). This lets the graph connect the two nodes precisely.

```python
# after collecting sub_obs, stitch handoff → target by entity_id
handoffs = [o for o in sub_obs if o.observation_type == "ROUTE_HANDOFF"]
for h in handoffs:
    target_entity = h.data["handoff"]["entity_id"]
    for o in sub_obs:
        if o.agent_name == h.data["handoff"]["to"] and target_entity in o.evidence:
            o.parent_observation_id = h.observation_id
            break
```

---

## ObservationType change  `[EXTEND] observability.py` + `types.ts`

```python
class ObservationType(str, Enum):
    SIGNAL_RECEIVED = "SIGNAL_RECEIVED"
    REASONING = "REASONING"
    ROUTING_DECISION = "ROUTING_DECISION"
    ROUTE_HANDOFF = "ROUTE_HANDOFF"          # NEW — agent→agent hand-off
    TOOL_CALL = "TOOL_CALL"
    RESULT = "RESULT"
    ESCALATION = "ESCALATION"
    APPROVAL_GATE_APPLIED = "APPROVAL_GATE_APPLIED"
```

`work_kind="route"` for these (the existing `WORK_KIND_SPEC` in `AgentRunTimeline.tsx` should
gain a `route` entry; the Console graph already styles it).

---

## The hand-off rules (deterministic, enumerated)

| Trigger (Python-detected) | From → To | entity |
|---|---|---|
| Inbound message body mentions a deadline/date for a known matter | comms → deadline | the `Deadline` id (or a new candidate) |
| Inbound message is a billing/invoice question | comms → billing | the matter/entry id |
| Commitment extracted with a date | comms → deadline | the `Commitment` (as `SOFT_INTERNAL` deadline) |
| Anomaly references a HARD_LEGAL deadline (already exists as a scoring override) | anomaly → (escalation) | keep as-is |

Only the first three are new. Keep the list small and explicit — these are the exact
hand-offs the prototype shows.

---

## Acceptance criteria

- [ ] A sweep over the demo data produces ≥2 `ROUTE_HANDOFF` observations: comms→deadline
      (Mercer inbound) and comms→deadline (Reyes commitment); the billing hand-off fires when
      the Acme billing-question inbound is present.
- [ ] Each hand-off observation carries `data.handoff = {from, to, entity_id, reason}` and
      `work_kind="route"`.
- [ ] (If Option A+stitch) the target agent's observation for that entity has
      `parent_observation_id` set to the hand-off's id.
- [ ] Routing remains deterministic — no Gemini call decides a hand-off.
- [ ] The Agent console renders the gold hand-off edge between the two agent nodes and a
      "Cross-agent hand-off" inspector card (prototype parity).
