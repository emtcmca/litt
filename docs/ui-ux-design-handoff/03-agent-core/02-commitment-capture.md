# 03·02 — Commitment Capture + Lifecycle

**One line:** when *you* promise a client something in a reply ("I'll send the exhibit list
by EOD tomorrow"), Litt catches it, quotes it verbatim, and watches it as a soft deadline
through `pending → tracked → kept | slipped` — holding *you* to your word the way it holds
clients to theirs.

**Prototype:** `console-clients.jsx` → `CommitmentTracker` / `CommitmentCard` / `StageRail`
(the Relationships hero), and `console-deadlines.jsx` (a "promise" chip row on the book).
Marking an outcome flashes "commitment.kept written to the audit ledger" → `console-record.jsx`
shows a `commitment.captured` event.

**Today:** does not exist. Entirely net-new, but it composes from existing pieces
(comms replies, deadline book, audit ledger, the soft-deadline cadence).

---

## Where capture happens

Capture runs over **sent or held attorney replies** — i.e. `ClientCommunication` bodies.
Two trigger points (do the first now, the second is a nice-to-have):

1. **On send** — hook `log_client_comm_sent()` (the moment a reply is confirmed sent): run
   extraction over `draft_body`. This is the cleanest seam and matches the demo (the Reyes
   reply you sent contained "answer by Friday").
2. *(optional)* **On draft** — extract from a held draft too, creating a `PENDING` commitment
   that flips to `TRACKED` when the comm reaches `SENT_CONFIRMED`.

---

## The deterministic / Gemini split

| Step | Where |
|---|---|
| Detect candidate promise sentences ("I'll", "we'll", "by <date>", "send/confirm/circulate") | **Python** pre-filter (regex) |
| Extract the obligation + parse the date into `due_date` | **Gemini** (returns JSON: quote, summary, date, confidence) |
| Validate/clamp the date, dedupe, decide it's trackable | **Python** |
| Create the `Commitment` + (optionally) a linked `Deadline` | **tool_write** |
| Lifecycle transitions (`kept`/`slipped`, due-soon derivation) | **Python** |

Extraction is the only Gemini call; mirror `deadline_agent._call_gemini_deadline_extraction`
(same "reply with JSON only" pattern, same isolation for test-mocking).

```python
# backend/app/agents/commitment_extractor.py [NEW]
def extract_commitments(reply_body: str, matter_ctx: dict) -> list[ExtractedCommitment]:
    # 1. Python pre-filter: sentences matching PROMISE_PATTERNS
    # 2. Gemini: for each candidate, return {quote, summary, due_date, confidence}
    # 3. Python: parse/clamp date vs effective date; drop low-confidence/no-date
    ...
```

---

## Lifecycle state machine (deterministic, like the comms/deadline machines)

```python
# backend/app/tools/commitments.py [NEW]
_COMMITMENT_TRANSITIONS = {
    "PENDING": ["TRACKED", "DISMISSED"],            # PENDING only when extracted from an unsent draft
    "TRACKED": ["KEPT", "SLIPPED"],
    "KEPT":    [],
    "SLIPPED": [],
}
# DUE_SOON is NOT a stored state — it is derived at read time:
#   due_soon = (due_date - get_effective_date()).days <= 2 and status == "TRACKED"
```

Tools (the only write path):

```python
create_commitment(firm_id, matter_id, client_id, quote, summary, due_date, source,
                  source_comm_id, extracted_by, confidence, actor, idempotency_key)
    -> ToolResult   # status=TRACKED (or PENDING), audit "commitment.captured"

mark_commitment(firm_id, commitment_id, attorney_id, outcome, idempotency_key, expected_version)
    # outcome in {"KEPT","SLIPPED"}; sets closed_at, closed_note; audit "commitment.kept"/"commitment.slipped"

link_commitment_to_book(firm_id, commitment_id, actor, idempotency_key)
    # creates a SOFT_INTERNAL Deadline (classification=SOFT_INTERNAL, source_type=manual,
    # verification_status=attorney_verified) and sets on_deadline_book=True, linked_deadline_id
```

**Reuse the deadline book:** a tracked commitment that should appear on the Deadlines hero
becomes a real `Deadline` with `classification = SOFT_INTERNAL`. That means the existing
`deadline_agent` cadence/escalation and the Deadlines read endpoint show it for free — the
"promise" chip in the prototype is just a `Deadline` whose `linked` commitment id is set.
This is why `Commitment.linked_deadline_id` exists.

---

## Ledger events (close the loop the prototype shows)

Every transition writes to the CREATE-only `audit_log` via `log_audit_event()`:

```
commitment.captured   tier=operational           after={due_date, source:"attorney_reply", extracted_by, confidence}
commitment.kept        tier=legal_defensibility   before={status:"TRACKED"} after={status:"KEPT", closed_note}
commitment.slipped     tier=operational           before={status:"TRACKED"} after={status:"SLIPPED", closed_note}
```

`commitment.captured` is the row the prototype's Audit ledger displays
(`console-record.jsx` seed `Lc1`). `commitment.kept`/`slipped` are what the "Mark kept"
flash refers to. Use `legal_defensibility` tier for `kept` (it's an attorney attesting they
fulfilled an obligation — defensible record), `operational` for the rest.

---

## Agent console integration

Add a capture beat to the sweep (prototype steps 11–12, "Litt also reads a note you sent
Reyes — and catches a promise…"):

```
TOOL_CALL      comms_agent  REVIEW_REQUIRED  gemini  extract_commitments() -> 1 promise
ROUTE_HANDOFF  comms_agent  AUTO_SAFE        route   route_to_agent(deadline_agent, cm-reyes)   # doc 03-03
RESULT         comms_agent  AUTO_SAFE        tool    create_commitment() -> cm-reyes TRACKED
```

---

## Endpoints  `routes/commitments.py [NEW]` + `api.ts`

```
GET  /api/commitments?firm_id&attorney_id   -> Commitment[]   # each with computed days_out + derived due_soon
POST /api/actions/commitment/mark           -> ToolResult      # {commitment_id, outcome: KEPT|SLIPPED, reason?}
```

Add a `commitments` section to `BriefSections` (Overview "active / due soon / kept / slipped"
counts mirror the prototype's `CommitmentTracker` stat strip).

---

## Acceptance criteria

- [ ] Sending a reply containing a datable promise creates a `Commitment` (`TRACKED`) and a
      `commitment.captured` audit event; extraction is Gemini, everything else Python.
- [ ] `GET /api/commitments` returns the demo set with correct `days_out` from the effective
      date; one is `due_soon` (≤2d), one `KEPT`, one `SLIPPED` with `closed_note`.
- [ ] `POST /api/actions/commitment/mark` advances `TRACKED → KEPT|SLIPPED`, writes the
      matching ledger event, is idempotent + optimistic-locked, and rejects invalid transitions.
- [ ] A commitment with `on_deadline_book=True` appears on `GET /api/deadlines` as a
      `SOFT_INTERNAL` row (the prototype's "promise" chip).
- [ ] UI matches `CommitmentTracker`: stat strip, 3-stage `StageRail`, active list, "Closed
      this period" group, Mark kept/Slipped buttons (absent on `PENDING`), ledger flash.
