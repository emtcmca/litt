# 03·01 — Inbound Triage (comms_agent gains an inbound path)

**One line:** Litt reads the attorney's inbox (read-only), surfaces client messages that
need a reply, summarizes each, extracts action items, and drafts a held reply — using the
**existing** comms draft + citation + state-machine pipeline.

**Prototype:** `console-clients.jsx` → "Awaiting your response" subheader + `InboundCard`.
The Mercer card is the fully-expanded reference: read-only message → "What they need" →
"Why it surfaced" (signal chips) → action items (with a `→ Deadline Monitor` cross-link) →
"Handed to Deadline Monitor" box → source-grounded suggested reply → Approve & send / Edit
/ Snooze / Hand off.

**Today:** `comms_agent.py` only does OUTBOUND silence detection. This adds the inbound
half. Reuse, don't replace.

---

## The deterministic / Gemini split (get this exactly right)

| Step | Where | Why |
|---|---|---|
| Pick which inbox emails are "client, unanswered, this matters" | **Python** | reproducible; no model deciding what's urgent |
| Score urgency HIGH/MED/LOW + the `urgency_signals` list | **Python** | deterministic rubric (below) |
| Summarize "what they need" | **Gemini** | natural-language, attorney reads it |
| Extract action items | **Gemini** (proposes) + **Python** (tags handoffs) | model finds tasks; Python decides routing |
| Draft suggested reply | **Gemini** | reuse `comms_agent` FactPacket + `[fN]` citation discipline |
| Tag a cross-agent hand-off (e.g. "Thursday deadline") | **Python** | routing is always Python (doc 03-03) |
| Hold the reply until attorney approves | **human_gate** | "Litt never sends" |

The Agent console renders `work_kind` per step; mislabeling any of the above makes the
headline boundary stat ("X deterministic · Y Gemini") wrong.

---

## Urgency scoring (deterministic rubric)

`backend/app/agents/comms_inbound.py [NEW]` — pure functions over pre-fetched data.

```python
# Each signal is (predicate, points, human_label). HIGH >= 5, MEDIUM >= 2, else LOW.
URGENCY_SIGNALS = [
    (lambda m: m.from_is_decision_maker,        3, "From the GC — decision-maker"),
    (lambda m: m.mentions_deadline,             3, "Mentions a deadline"),   # regex: due|by <date>|EOD|Thursday…
    (lambda m: m.wait_days >= 2,                2, "Awaiting {wait_days} days"),
    (lambda m: m.has_question,                  1, "Direct question awaiting reply"),
    (lambda m: m.is_thread_followup,            1, "Follow-up on an open thread"),
    (lambda m: m.matter_id is not None,         1, "Names the {matter} matter"),
]
```

- `mentions_deadline`, `has_question`, dates → **deterministic regex/keyword** over the
  email body. No model. The `urgency_signals` stored on the record are exactly the labels
  the prototype renders as chips.
- `from_is_decision_maker` ← look up the sender against the client's known contacts/role.
- All "X days" recompute from `config.get_effective_date()` at read time (Rule 5).

---

## Agent flow (extends `comms_agent.run()` or a sibling pass)

Keep the existing silence pass; add an inbound pass that emits its own observations into
the **same** `observations` list the coordinator collects. Suggested sequence of
observations (these become Agent-console steps — mirror the prototype's inbound-first
sweep ordering):

```
SIGNAL_RECEIVED   comms_agent  AUTO_SAFE        det     "Inbox scan: N client messages awaiting reply"
TOOL_CALL         comms_agent  AUTO_SAFE        tool    scan_inbox() -> Message[]            # read
REASONING         comms_agent  REVIEW_REQUIRED  det     score_urgency() -> HIGH: Sandra Mercer …
TOOL_CALL         comms_agent  REVIEW_REQUIRED  gemini  summarize_message() -> "wants Thu confirmation…"
ROUTE_HANDOFF     comms_agent  AUTO_SAFE        route   route_to_agent(deadline_agent, dl-mercer-001)   # doc 03-03
TOOL_CALL         comms_agent  REVIEW_REQUIRED  gemini  draft_reply() -> held ClientComm
APPROVAL_GATE…    comms_agent  BLOCKED          human   "Reply to S. Mercer held — attorney must approve"
```

Each `TOOL_CALL` carries the `data.tool` sub-shape from doc 03-04 so the inspector and live
chip can render (`scan_inbox() read`, `summarize_message() gemini`, …).

### Reusing the comms pipeline for the reply

The suggested reply is a **`ClientCommunication` in `DRAFT_GENERATED`**, created with the
existing `create_client_comm()` tool:

```python
# build a FactPacket exactly like the silence path (comms_agent._build_fact_packet),
# but seeded from matter records that ground the reply's claims.
reply = create_client_comm(
    firm_id=firm_id, matter_id=m.matter_id, client_id=m.client_id,
    trigger=CommTrigger.ATTORNEY_INITIATED.value,   # or a new INBOUND_REPLY trigger
    draft_body=gemini_draft, source_map=source_map,
    actor="system", idempotency_key=f"inbound-reply-{m.id}-{today}",
)
inbound.suggested_reply_comm_id = reply.entity_id
```

Then "Approve & send" on the card is the **existing** chain:
`approve_client_comm_draft → queue_client_comm_for_delivery → log_client_comm_sent`
(the last is the only one that touches `last_client_contact`). No new send path, and the
existing `COMM_*` audit events already cover it.

---

## New tool functions  `app/tools/inbound.py [NEW]`

Agents never write Firestore directly — these are the write path:

```python
create_inbound_message(firm_id, source_email_id, client_id, matter_id, from_name,
                       from_role, received_at, urgency, urgency_signals, message_excerpt,
                       summary, action_items, suggested_reply_comm_id, cross_agent,
                       actor, idempotency_key)  -> ToolResult   # status=TRIAGED, audit INBOUND_TRIAGED
snooze_inbound(firm_id, inbound_id, attorney_id, until, idempotency_key, expected_version)
dismiss_inbound(firm_id, inbound_id, attorney_id, reason, idempotency_key, expected_version)  # reason required
```

Idempotency key ties to `source_email_id` + effective date so a re-sweep doesn't duplicate.
Mark `InboundMessage.status = HANDLED` when its `suggested_reply_comm_id` reaches
`SENT_CONFIRMED` (hook in `log_client_comm_sent`, or recompute on read).

---

## Endpoints  `routes/inbound.py [NEW]` + `api.ts`

```
GET  /api/inbound?firm_id&attorney_id            -> InboundTriageItem[]   # inlines reply draft + source_map
POST /api/actions/inbound/snooze                 -> ToolResult
POST /api/actions/inbound/dismiss                -> ToolResult            # reason required
# Approve & send reuses existing: POST /api/actions/comms/{approve,queue,confirm-sent}
```

Add an `inbound` section to `BriefSections` (count → Overview badge). The triage list also
feeds the Relationships hero.

---

## Acceptance criteria

- [ ] Inbound pass adds observations to the sweep `timeline`; `work_kind` is `gemini` only
      on summarize/draft, `deterministic` on scoring, `route` on hand-off, `human_gate` on the hold.
- [ ] `GET /api/inbound` returns ≥3 items for the demo firm; the top item is HIGH urgency
      with ≥3 `urgency_signals` and a populated `summary`, `action_items`, and a held reply.
- [ ] At least one action item carries `handoff_agent` and the message has a `cross_agent`
      block (Mercer → deadline; the billing-question example → billing).
- [ ] The suggested reply is a real `ClientCommunication` in `DRAFT_GENERATED`; approving it
      walks the existing state machine and writes `COMM_*` audit events.
- [ ] Gmail access is **read-only**; nothing sends without the attorney advancing the comm.
- [ ] All "wait_days / received X ago" values are computed from the effective date.
- [ ] UI matches `InboundCard` (collapsed + expanded) pixel-for-intent.
