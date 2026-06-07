# Backend Task — Enrich `TOOL_CALL` observations with `data.tool`  (Path B)

**Status:** spec — needs sign-off (deliberately breaks the "no backend changes in v1.1.3" rule —
see §0).
**Owner surface:** `backend/app/` (agents + observability + registry). **No tool *behavior*
changes** — observation enrichment only.
**Why now:** the Agent Console (`/agents`) is a headline demo surface. Its already-built
Inspector (`dashboard/src/components/console/Inspector.tsx`) renders tool chips, a TOOL CALL
signature/result card, and the deterministic-vs-Gemini boundary stat **by reading
`obs.data.tool`** — which the live sweep does not emit today. Without this, those elements are
blank/wrong in the recorded demo even though Playwright (fixture-fed) passes.

---

## 0. Why we're breaking the rule — and the permission annotation

The v1.1.3 plan says "no backend changes." We are making a **narrow, additive exception**, by
explicit decision, because:

1. **The frontend is already built to consume `data.tool`.** `Inspector.tsx` `ToolCallCard` and
   `BoundaryStat` read `obs.data.tool.{name,kind,signature,result}`. The cheaper "frontend-only"
   path (count `work_kind`) would make the boundary *correct* but still can't produce per-call
   **tool chips + signatures + results** — those require the data to exist. The design
   (`screens/15`, `screens/17`) shows them. So the gap is genuinely a data gap, not a render gap.
2. **It's observation-only.** We add `AgentObservation`s (and enrich two existing ones). We do
   **not** change any tool's writes, state machine, gating, or Gemini call count. The
   deterministic/Gemini boundary story stays truthful — only real model calls are tagged
   `kind=gemini`.
3. **It's reversible and test-guarded** (§6).

**Annotation to paste at each new emit site and in the PR description:**

```python
# NOTE (v1.1.3 exception, approved): Observation enrichment only — emits a TOOL_CALL
# observation describing the tool that just ran. Does NOT change tool behavior, writes,
# gating, or Gemini call count. Added so the Agent Console can show real tool chips /
# signatures / the deterministic-vs-Gemini boundary on LIVE data (not just test fixtures).
# Breaks the "no backend changes in v1.1.3" rule by explicit decision. Safe to revert:
# delete the emit_tool_call() calls and the registry signature/gemini-pseudo-tool entries.
```

---

## 1. Scope / non-goals

**In scope (additive only):**
- Add a `signature` field to `ToolSpec` and populate it.
- Add **GEMINI-kind pseudo-tool** registry entries for the real model operations (so a model
  call can be represented as a `TOOL_CALL` with `data.tool.kind="gemini"`).
- Add a shared `emit_tool_call(...)` helper in `observability.py`.
- Instrument each agent's `run()` to append a `TOOL_CALL` observation at each real tool
  invocation and each Gemini call, carrying `data.tool`.

**Explicitly NOT in scope (do not touch):**
- Any tool function's logic, writes, idempotency, optimistic-lock, or state machine.
- The number of Gemini calls actually made (we *observe* existing calls; we don't add any).
- `commitment_level` / gating decisions.
- Frontend: **no change required.** `Inspector.tsx` already reads `data.tool`. (Optional polish
  only — see §5.)

---

## 2. `registry.py` — add `signature`, add GEMINI pseudo-tools

`backend/app/tools/registry.py` today: `ToolKind = read|write|compute|gemini`; `ToolSpec` has
`name, agent, kind, description, write_collection, audit_tier, tags`. **No `signature`, and no
GEMINI-kind entries** (model ops are internal `_call_gemini_*` functions, unregistered).

```python
@dataclass
class ToolSpec:
    name: str
    agent: str
    kind: ToolKind
    description: str
    signature: str = ""          # NEW — e.g. "run_prebill_scrubber(entry) -> Flag[]"
    write_collection: str = ""
    audit_tier: str = ""
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = { ... existing ... }
        d["signature"] = self.signature   # NEW — also surfaces in GET /api/tools catalog
        return d
```

- **Populate `signature`** on every existing entry (one line each).
- **Add GEMINI pseudo-tools** for the real model operations the agents already call
  (`_call_gemini_*`). Minimum set to instrument (kind=`GEMINI`):
  | name | agent | represents (existing fn) |
  |---|---|---|
  | `draft_client_comm` | comms_agent | `_call_gemini_draft` |
  | `summarize_inbound` | comms_agent | `_call_gemini_summarize` |
  | `draft_inbound_reply` | comms_agent | `_call_gemini_draft_reply` |
  | `suggest_narrative` | billing_agent | `_call_gemini_narrative_suggestion` |
  | `assess_narrative_quality` | anomaly_agent | `_call_gemini_narrative_quality` |
  | `extract_deadline_date` | deadline_agent | `_call_gemini_deadline_extraction` |
  > Add only the ones that actually fire in the demo sweep. The boundary's "Gemini calls" count
  > = number of these TOOL_CALLs emitted in the run. **Do not aim for a hardcoded "3"** — it is
  > whatever the seeded demo legitimately triggers (§5 honesty note).

`read`/`compute` pseudo-tools for non-write steps you want to show as chips (e.g.
`get_pending_entries` read, `run_prebill_scrubber` compute, `scan_inbox` read, `score_urgency`
compute, `get_active_deadlines` read, `apply_escalation_tier` compute, `run_detectors` compute)
may also be registered so they appear in the catalog and as chips. Keep names matching the
prototype where possible (`screens/15`, `screens/17`).

---

## 3. `observability.py` — shared emit helper

Add next to `AgentObservation` (`backend/app/observability.py`). Single source of truth for the
`ToolKind → work_kind` mapping so the boundary stat is consistent.

```python
from app.tools.registry import TOOL_REGISTRY, ToolKind

_KIND_TO_WORK = {
    ToolKind.READ:    "deterministic",
    ToolKind.COMPUTE: "deterministic",
    ToolKind.WRITE:   "tool_write",
    ToolKind.GEMINI:  "llm_assisted",
}

def make_tool_call(agent_name: str, tool_name: str, result: str,
                   commitment_level: CommitmentLevel = CommitmentLevel.AUTO_SAFE,
                   confidence: float | None = None) -> AgentObservation:
    """Build a TOOL_CALL observation carrying data.tool for the Console.
    Observation-only — see v1.1.3-exception note. tool_name must be in TOOL_REGISTRY."""
    spec = TOOL_REGISTRY[tool_name]
    return AgentObservation(
        agent_name=agent_name,
        observation_type=ObservationType.TOOL_CALL,
        commitment_level=commitment_level,
        work_kind=_KIND_TO_WORK[spec.kind],
        model_name=(config.GEMINI_MODEL if spec.kind == ToolKind.GEMINI else None),
        confidence=confidence,
        description=f"{spec.name}: {result}",
        data={"tool": {
            "name": spec.name,
            "kind": spec.kind.value,           # read|write|compute|gemini → matches Inspector
            "signature": spec.signature,
            "result": result,                  # short human string, e.g. "te-001 · MISSING_NARRATIVE"
        }},
    )
```

> The Inspector's `BoundaryStat` counts `observation_type==='TOOL_CALL'` where
> `data.tool.kind === 'gemini'` → with this, `det` = read/write/compute TOOL_CALLs, `llm` =
> gemini TOOL_CALLs. Correct and populated.

---

## 4. Agent instrumentation — where to append

Today there are only **two** `TOOL_CALL` emit sites and **neither carries `data.tool`**:
- `billing_agent.py:124` — `"Running pre-bill scrubber on N entries"` (no data)
- `coordinator.py:248` — `"Dispatching Round 1 sub-agents"` (no data)

Append `make_tool_call(...)` observations at each real tool/model invocation inside each agent's
`run()`. Keep all existing `RESULT`/`REASONING`/`APPROVAL_GATE_APPLIED`/`WARN_NOTICE`/
`ROUTE_HANDOFF` observations as-is (TOOL_CALL is an added layer). Suggested coverage (instrument
what actually executes in the demo sweep; `result` is a short string):

- **billing_agent.run():** `get_pending_entries` (read) → `run_prebill_scrubber` (compute) →
  on flag `advance_entry_status`/`update_entry_narrative`/`log_anomaly` (write) →
  `compute_budget_utilization` (compute); if a Gemini suggestion fires, `suggest_narrative`
  (gemini). Replace the bare line-124 TOOL_CALL with these.
- **deadline_agent.run():** `get_active_deadlines` (read) → `apply_escalation_tier` (compute) →
  `log_deadline_event` (write); if extraction fires, `extract_deadline_date` (gemini).
- **comms_agent.run():** `scan_inbox` (read) → `score_urgency` (compute) → `summarize_inbound`
  (gemini) → `draft_inbound_reply`/`draft_client_comm` (gemini) → `create_client_comm` (write).
  (The existing `ROUTE_HANDOFF` with `data.handoff` stays — it already works in the Inspector.)
- **anomaly_agent.run():** `run_detectors` (compute) → `assess_narrative_quality` (gemini, when
  it fires) → `log_anomaly` (write).
- **coordinator:** keep the line-248 TOOL_CALL but either give it a real `data.tool`
  (`classify_signal`, if you register it) or leave it as a plain non-tool observation. Don't
  fabricate a tool that didn't run.

Rule: **emit a `gemini` TOOL_CALL only when the corresponding `_call_gemini_*` actually returned
a result this run.** Never tag a deterministic step `gemini`.

---

## 5. Boundary-number honesty + (optional) frontend polish

- **No frontend change is required** — `Inspector.tsx` already reads `data.tool` and counts
  gemini. After this task, the boundary renders real numbers and the TOOL CALL card populates.
- The recorded demo's boundary (e.g. "17/20 · 3 Gemini") is **whatever the seeded sweep emits** —
  it is *not* hardcoded and likely won't be exactly 17/20. If a specific headline ratio is
  wanted, tune it by (a) which steps you instrument and (b) the seeded demo data — **not** by
  faking kinds. Keep it truthful.
- Optional polish (only if desired): have `AgentConsole`/`Inspector` also show a `work_kind`
  badge on non-TOOL_CALL steps (`llm_assisted` REASONING, `route` hand-offs) so the Gemini story
  is visible even on steps that aren't tool calls. Not required.

---

## 6. Tests, acceptance, rollback

**Tests** (`backend/tests/test_agent_observations.py` already exists — extend it):
- After a sweep on the demo firm, **every `TOOL_CALL` observation has `data.tool` with
  non-empty `name`, `kind ∈ {read,write,compute,gemini}`, `signature`, `result`.**
- `kind=='gemini'` TOOL_CALLs appear **only** when the matching `_call_gemini_*` ran (mock the
  Gemini callers; assert no gemini TOOL_CALL when they return None).
- No change to write counts / audit events / final entity states vs. the pre-change sweep
  (snapshot the Firestore writes before/after — must be identical).
- `GET /api/tools` includes `signature` for every entry and the new gemini pseudo-tools.

**Acceptance:**
- Live `/agents` sweep: tool chips render, TOOL CALL card shows name+signature+result, boundary
  shows real det/gemini counts, hand-off card still works.
- `npm run build` (frontend) unchanged & green; backend `pytest` green.

**Rollback:** delete the `make_tool_call(...)` calls, the `signature` field, and the gemini
pseudo-tool entries. Frontend already null-guards `data.tool`, so it degrades cleanly to the
pre-change state.

---

## 7. One-line summary for the plan

> **Phase 5 (amended):** with the approved backend exception, the Agent Console binds to live
> data — `data.tool` (new) drives chips/signatures/boundary; `data.handoff` (already emitted)
> drives the hand-off card. No frontend rebind needed; the Inspector already reads these.
> The "frontend-only `work_kind`" fallback from the prior patch is **superseded** by this task.
