# 03·04 — Tool-Call Layer (registry + enriched observations)

**One line:** make the four agents' tool use *visible* — every step in the Agent console names
the real function it called (`run_prebill_scrubber()`), its kind (read/compute/gemini/route/
gate/write), and its result; selecting an agent lists the tools it can call; selecting the
tool layer shows the whole catalog; and the deterministic-vs-Gemini boundary stat is computed
from it.

**Prototype:** `console-agents.jsx` — live tool chips under firing nodes, the inspector
"TOOL CALL" card (name, signature, result), the per-agent "Tools it can call" list, the Tool
layer catalog grouped by agent, and the boundary stat ("17/20 deterministic · 3 Gemini").

**Today:** observations already have `ObservationType.TOOL_CALL` and `work_kind`, but the
tool's **identity** (name/kind/signature/result) isn't carried in a consistent, renderable
shape, and there's no registry to enumerate what each agent *can* call. This formalizes both.
**No new write paths** — this is metadata over the existing tool layer.

---

## 1. The registry  `backend/app/tools/registry.py [NEW]`

One `ToolSpec` per real tool function. `kind` classifies it; `deterministic = (kind != GEMINI)`.

```python
from dataclasses import dataclass
from enum import Enum

class ToolKind(str, Enum):
    READ="read"; COMPUTE="compute"; GEMINI="gemini"; ROUTE="route"; GATE="gate"; WRITE="write"

@dataclass(frozen=True)
class ToolSpec:
    name: str; kind: ToolKind; signature: str; agent: str
    @property
    def deterministic(self) -> bool: return self.kind != ToolKind.GEMINI

TOOL_REGISTRY = {
    # deadline_agent
    "scan_deadlines":          ToolSpec("scan_deadlines", ToolKind.READ,
                                        "scan_deadlines(firm) -> Deadline[]", "deadline_agent"),
    "compute_days_out":        ToolSpec("compute_days_out", ToolKind.COMPUTE,
                                        "compute_days_out(deadline) -> int", "deadline_agent"),
    "get_escalation_level":    ToolSpec("get_escalation_level", ToolKind.COMPUTE,
                                        "get_escalation_level(days_out) -> level", "deadline_agent"),
    "extract_deadline_date":   ToolSpec("extract_deadline_date", ToolKind.GEMINI,
                                        "extract_deadline_date(email) -> {date,conf}", "deadline_agent"),
    "log_deadline_event":      ToolSpec("log_deadline_event", ToolKind.WRITE,
                                        "log_deadline_event(...) -> Event", "deadline_agent"),
    "log_escalation":          ToolSpec("log_escalation", ToolKind.WRITE,
                                        "log_escalation(...) -> Escalation", "deadline_agent"),
    # billing_agent
    "get_pending_entries":     ToolSpec("get_pending_entries", ToolKind.READ,
                                        "get_pending_entries() -> Entry[]", "billing_agent"),
    "run_prebill_scrubber":    ToolSpec("run_prebill_scrubber", ToolKind.COMPUTE,
                                        "run_prebill_scrubber(entry) -> Flag[]", "billing_agent"),
    "hold_entry":              ToolSpec("hold_entry", ToolKind.WRITE,
                                        "hold_entry(entry, flag) -> Held", "billing_agent"),
    "compute_budget_utilization": ToolSpec("compute_budget_utilization", ToolKind.COMPUTE,
                                        "compute_budget_utilization(matter) -> pct", "billing_agent"),
    # comms_agent
    "scan_inbox":              ToolSpec("scan_inbox", ToolKind.READ,
                                        "scan_inbox() -> Message[]", "comms_agent"),
    "score_urgency":           ToolSpec("score_urgency", ToolKind.COMPUTE,
                                        "score_urgency(msg) -> level", "comms_agent"),
    "summarize_message":       ToolSpec("summarize_message", ToolKind.GEMINI,
                                        "summarize_message(msg) -> summary", "comms_agent"),
    "extract_commitments":     ToolSpec("extract_commitments", ToolKind.GEMINI,
                                        "extract_commitments(reply) -> Promise[]", "comms_agent"),
    "draft_reply":             ToolSpec("draft_reply", ToolKind.GEMINI,
                                        "draft_reply(facts) -> draft", "comms_agent"),
    "route_to_agent":          ToolSpec("route_to_agent", ToolKind.ROUTE,
                                        "route_to_agent(agent, entity) -> Handoff", "comms_agent"),
    "create_client_comm":      ToolSpec("create_client_comm", ToolKind.WRITE,
                                        "create_client_comm(...) -> Comm", "comms_agent"),
    "compute_days_silent":     ToolSpec("compute_days_silent", ToolKind.COMPUTE,
                                        "compute_days_silent(matter) -> int", "comms_agent"),
    # anomaly_agent
    "run_detectors":           ToolSpec("run_detectors", ToolKind.COMPUTE,
                                        "run_detectors(entry) -> Anomaly[]", "anomaly_agent"),
    "score_risk":              ToolSpec("score_risk", ToolKind.COMPUTE,
                                        "score_risk(anomaly) -> sev x conf", "anomaly_agent"),
    "require_reason":          ToolSpec("require_reason", ToolKind.GATE,
                                        "require_reason(anomaly) -> Blocked", "anomaly_agent"),
    "log_anomaly":             ToolSpec("log_anomaly", ToolKind.WRITE,
                                        "log_anomaly(...) -> Escalation", "anomaly_agent"),
    # coordinator
    "classify_signal":         ToolSpec("classify_signal", ToolKind.ROUTE,
                                        "classify_signal(sig) -> SignalType", "coordinator"),
}
```

> Names like `scan_inbox`, `hold_entry`, `get_pending_entries`, `score_risk`, `require_reason`
> are the **prototype's display names**. Map each to the real underlying call where one already
> exists (e.g. `run_prebill_scrubber` → `scrubber.prebill.run_prebill_checks`; `hold_entry` →
> `alerts.log_anomaly` / a hold transition; `compute_budget_utilization` → `billing.py`).
> Where the prototype shows a tool that's currently inline code (e.g. `compute_days_out`),
> either extract a named helper or just register it as the label for that step. The registry is
> the *vocabulary the graph speaks*; keep the names stable.

---

## 2. Enriched `TOOL_CALL` observations

When an agent emits a `TOOL_CALL` (or `ROUTE_HANDOFF`/`APPROVAL_GATE_APPLIED` tied to a gate
tool), populate `data.tool` from the registry so the chip + inspector render with no guessing:

```python
spec = TOOL_REGISTRY["run_prebill_scrubber"]
observations.append(_obs(
    observation_type=ObservationType.TOOL_CALL,
    commitment_level=CommitmentLevel.REVIEW_REQUIRED,
    work_kind="tool_write" if spec.kind == ToolKind.WRITE else (
              "llm_assisted" if spec.kind == ToolKind.GEMINI else "deterministic"),
    model_name=config.GEMINI_MODEL if spec.kind == ToolKind.GEMINI else None,
    description=f"{spec.name}: te-001 flagged MISSING_NARRATIVE",
    data={"tool": {"name": spec.name, "kind": spec.kind.value,
                   "signature": spec.signature, "result": "te-001 · MISSING_NARRATIVE"}},
    evidence=["te-001"],
))
```

`work_kind` ↔ `kind` mapping (single source of truth):
`read/compute/route/gate → deterministic`, `gemini → llm_assisted`, `write → tool_write`,
plus the human gate stays `human_gate`. The prototype's billing sequence
(`get_pending_entries → run_prebill_scrubber → hold_entry → compute_budget_utilization`) and
anomaly sequence (`run_detectors → score_risk → require_reason`) are the reference depth — emit
one `TOOL_CALL` per real call rather than a single summary step.

---

## 3. Endpoint  `GET /api/tools`  + boundary stat

```
GET /api/tools  ->  ToolSpec[]   # the catalog (Agent console "Tool layer" node)
```

Boundary stat is computed client-side (or in the sweep response) from the run's observations:
`deterministic_count / total_tool_calls` using `data.tool.kind != "gemini"`. The prototype's
"17/20 deterministic · 3 Gemini" is exactly this over a full sweep.

---

## Acceptance criteria

- [ ] `GET /api/tools` returns the full registry; the Tool layer node renders the catalog
      grouped by agent with per-kind counts, no text clipping.
- [ ] Every `TOOL_CALL` in a sweep carries `data.tool {name, kind, signature, result}`.
- [ ] `work_kind` is derived from `kind` by the mapping above — the boundary stat matches the
      count of non-gemini tool calls.
- [ ] Selecting an agent node lists exactly the tools whose `spec.agent` matches.
- [ ] Billing emits the 4-call sequence and anomaly the 3-call sequence at full depth.
