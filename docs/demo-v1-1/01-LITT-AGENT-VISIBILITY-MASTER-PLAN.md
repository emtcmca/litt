# Litt — Agent Visibility & Autonomy Orchestration — Build Plan

**Version:** 1.0  
**Purpose:** Complete implementation specification for making Litt's agentic autonomy visible to hackathon judges  
**Scope:** Days 5-7 polish phase (6-8 hours total)  
**Status:** Build-ready  

---

## May 31 Review Direction

This package is strongest when it demonstrates a simple thesis:

> Litt is not "a chatbot that writes a brief." Litt is an operations agent that continuously turns messy firm signals into source-backed attorney decisions, while refusing to cross legal-risk boundaries without human judgment.

Sharpen the build around that thesis:

- Show **agent work**, not only agent output: observe, classify, route, inspect evidence, run tools, draft when appropriate, gate, and write audit evidence.
- Label each observation as one of three kinds of work: deterministic check, LLM-assisted language work, or human decision gate. Judges should see exactly where Gemini helps and where Python controls liability-sensitive behavior.
- Make refusals impressive. The Rivera deadline and any billing reconstruction flag should read as product value: Litt protects the attorney from false confidence.
- Use the existing v1.0 demo conditions as the backbone. Add visibility events around `dl-mercer-001`, `te-005`, `te-001`, `acme-commercial`, and `whitmore-employment-2026` before inventing additional scenarios.
- Avoid claiming real integrations that do not ship. Fixture Gmail/Calendar data is acceptable if the UI names it as seeded demo ingestion through production-shaped adapters.

---

## Executive Summary

The core architectural insight: **Litt is agentic where autonomy creates leverage, deterministic where autonomy would create liability.**

The build task: **Make this visible.**

Current state: Litt has complete agentic substance (Gmail ingestion, deadline monitoring, billing reconciliation, client comms, anomaly detection, audit logging), but judges see only outputs—not orchestration.

Target state: Judges watch Litt *work*—observing signals, planning checks, executing sub-agents, finding evidence, applying gates, escalating intelligently, refusing confidently.

### Key Changes

1. **Instrument agent execution** — Emit observations at each reasoning step
2. **Add commitment gates** — Make safety model visible (AUTO_SAFE, REVIEW_REQUIRED, ESCALATION, BLOCKED)
3. **Expose Agent Run Timeline** — New UI panel showing orchestration as it happens
4. **Structured audit log** — Evidence + confidence + gate + human decision for every action
5. **Demo seed data** — Fixtures designed to trigger all observation types + edge cases
6. **Demo script** — 90-second walkthrough showing autonomy + safety in action

### Time Allocation

| Task | Hours | Priority |
|------|-------|----------|
| Agent observation instrumentation | 2.0 | P0 |
| Commitment gate implementation | 1.5 | P0 |
| Audit log schema + API | 1.5 | P0 |
| React timeline component | 1.5 | P1 |
| Demo seed data (conflict cases) | 1.0 | P0 |
| Demo script + walkthrough | 0.5 | P1 |
| **Total** | **8.0** | |

---

## File Structure

This build plan is delivered as 5 focused files:

1. **01-LITT-AGENT-VISIBILITY-MASTER-PLAN.md** (this file)
   - Overview, time allocations, file structure
   - Executive summary for code reviewers

2. **02-AGENT-OBSERVATION-INSTRUMENTATION.md**
   - Data models: `AgentObservation`, `AgentRunTimeline`, commitment gates
   - Coordinator instrumentation (where to emit, what to emit)
   - Sub-agent instrumentation patterns
   - Code examples for each agent type

3. **03-AUDIT-LOG-AND-API.md**
   - Detailed `AuditLogEntry` schema with all fields
   - Firestore collection structure (`audit_log`, `agent_runs`)
   - API endpoints: `/api/sweep`, `/api/sweep/{run_id}`, `/api/audit/{entity_id}`
   - Response shapes with examples

4. **04-REACT-TIMELINE-COMPONENT.md**
   - `AgentRunTimeline` component (full JSX)
   - `TimelineItem` sub-component
   - CSS styling (using Litt design tokens)
   - Integration into Daily Closeout Brief view
   - Loading states, error states

5. **05-DEMO-FIXTURES-AND-SCRIPT.md**
   - Enhanced demo seed data (fixtures.py)
   - Conflict cases: deadline ambiguity, billing gaps, reconstruction flags
   - Demo script (narration + what happens at each step)
   - Expected timeline output for demo run

---

## What You're Building

### The User Experience

```
Attorney clicks "Run Closeout"
     ↓
Agent Run Timeline appears (auto-scrolling)
     ↓
[2-second timeline: coordinator observing, routing, executing, escalating]
     ↓
Brief appears below timeline
     ↓
Attorney reviews items, approves/escalates/dismisses
     ↓
Audit log updated with human decision
```

### What Judges See

**Before:** "Litt generated a brief with rules and summaries."

**After:** "Litt observed 14 Gmail threads and 6 calendar events, planned a comprehensive check, routed signals to four sub-agents, found a deadline with conflicting evidence (which it escalated), detected a billing gap (which it suggested), drafted a client update (with source backing), flagged billing anomalies, and logged every decision."

### What Judges Must Understand Without Explanation

By the time the timeline finishes, the screen should answer these questions:

| Judge question | Timeline answer |
|---|---|
| Is this agentic? | Coordinator plans and routes work to deadline, billing, comms, and anomaly agents. |
| Is it safe for legal work? | Deterministic gates decide what can be auto-safe, reviewed, escalated, or blocked. |
| Where is the LLM? | Gemini is used for extraction/drafting/explanation, with source packets and confidence shown. |
| Why does it matter to attorneys? | It catches deadline risk, billing leakage, client silence, budget risk, and suspicious time entries before closeout. |
| Can this be defended later? | Every observation links to evidence and append-only audit events. |

---

## Architecture Decision: Observation Events

All agent reasoning emits structured `AgentObservation` events. No decisions are *hidden*—every non-deterministic step is logged with confidence, evidence, and gate.

### Observation Types

| Type | Who emits | Example |
|------|-----------|---------|
| `signal_received` | Coordinator | "Observed 14 Gmail threads and 6 calendar events" |
| `reasoning` | Any agent | "Checking deadline source: email from opposing counsel" |
| `routing_decision` | Coordinator | "Routing signal to deadline_monitor sub-agent" |
| `tool_call` | Sub-agent | "Querying Firestore for active deadlines in this matter" |
| `result` | Sub-agent | "Found unverified deadline candidate with 0.95 confidence" |
| `escalation` | Any agent | "Cannot safely verify deadline. Conflicting evidence. Escalating." |
| `approval_gate_applied` | Tool layer | "Time entry approved and logged to audit trail" |

### Commitment Levels (Gates)

Every action gets a gate. Visible in the timeline.

| Gate | Meaning | Who decides | Example |
|------|---------|-------------|---------|
| `AUTO_SAFE` | Information only, no action needed | System | "Status summary generated (informational)" |
| `REVIEW_REQUIRED` | Draft prepared, needs human approval | System + Human | "Time entry suggested. Attorney reviews + approves." |
| `ESCALATION` | Conflicting or insufficient evidence, requires human judgment | System + Human | "Deadline sources conflict. Human must verify date." |
| `BLOCKED` | Action exceeds authority, cannot proceed | System | "Cannot send client email without attorney signature." |

### Source-To-Decision Storyline

Each high-impact timeline item should include five visible pieces:

1. **Source:** email, calendar event, time entry, matter/client record, or prior audit event.
2. **Work:** what Litt did with that source, such as extraction, scrubber check, budget math, or FactPacket drafting.
3. **Evidence:** stable IDs and short excerpts where useful.
4. **Gate:** auto-safe, review required, escalation, or blocked.
5. **Attorney next action:** confirm deadline, approve/write down time, review draft, dismiss alert, or mark safe.

---

## Implementation Order

### Phase 1: Data Models (30 min)

- [ ] Create `observability.py` with `AgentObservation`, `AgentRunTimeline`, `CommitmentLevel` enum
- [ ] Update `audit_log.py` with enhanced `AuditLogEntry` schema
- [ ] Add Pydantic models to `backend/app/models/`

### Phase 2: Coordinator Instrumentation (1 hour)

- [ ] Modify `coordinator.py` to emit observations at each step
- [ ] Add observation collection list to sweep execution
- [ ] Ensure all sub-agent calls capture observations

### Phase 3: Sub-Agent Instrumentation (1 hour)

- [ ] Update deadline_monitor sub-agent to emit observations
- [ ] Update billing_agent sub-agent to emit observations
- [ ] Update comms_agent sub-agent to emit observations
- [ ] Update anomaly_agent sub-agent to emit observations

### Phase 4: Audit Log API (1 hour)

- [ ] Create `/api/sweep` endpoint returning `AgentRunTimeline`
- [ ] Create `/api/sweep/{run_id}` endpoint for timeline review
- [ ] Create `/api/audit/{entity_id}` endpoint for entity audit history

### Phase 5: React Component (1.5 hours)

- [ ] Build `AgentRunTimeline` component
- [ ] Build `TimelineItem` sub-component
- [ ] Integrate into Daily Closeout Brief view
- [ ] Add CSS styling

### Phase 6: Demo Fixtures (1 hour)

- [ ] Create conflict case seed data
- [ ] Ensure fixtures trigger all 7 observation types
- [ ] Add edge cases: deadline ambiguity, billing gaps, reconstruction flags

### Phase 7: Demo Script & Recording (1 hour)

- [ ] Write narration
- [ ] Record timeline walkthrough
- [ ] Verify all observations appear in correct order

---

## Key Design Principles

### 1. Every Observation Has Evidence

No magic. If Litt says "deadline detected," the observation includes:
- What source (email? calendar? manual?)
- Exact excerpt or reference
- Confidence level
- Gate applied

### 2. Escalation Is Explicit

When Litt refuses or escalates, it says why:
```
⚠ Escalation: Conflicting evidence found
  Evidence: email-rivera-001 ("response due Friday")
           vs. calendar interpretation (no court order confirmation)
  Confidence: 0.7 (deictic reference, requires verification)
```

### 3. Gates Are Visible

Every action shows its commitment level:
- AUTO_SAFE (green) — Safe to assume
- REVIEW_REQUIRED (blue) — Draft ready, human approval pending
- ESCALATION (amber) — Requires human judgment
- BLOCKED (red) — Exceeds authority

### 4. Audit Trail Is the Demo

The `AgentRunTimeline` is not a feature—it's the proof. Judges see:
1. What Litt observed
2. What it planned
3. What it did
4. Why (confidence + evidence)
5. What it escalated
6. What the human decided

### 5. No Silent Autonomy

Nothing happens without a record. Every observation. Every gate. Every human decision.

---

## Success Criteria

The implementation is complete when:

- [ ] `/api/sweep` returns a `AgentRunTimeline` with 15+ observations
- [ ] Timeline renders in React with auto-scrolling animation
- [ ] All 7 observation types appear in demo run
- [ ] All 4 commitment gates are visible in timeline
- [ ] Demo fixtures include 1+ escalation case (deadline conflict)
- [ ] Audit log stores full observation chain + human decisions
- [ ] Demo video shows complete timeline + brief in <2 minutes
- [ ] Judge can understand agent orchestration from watching timeline alone
- [ ] Judge can identify which steps used deterministic tools and which steps used Gemini-assisted language work
- [ ] Every escalated item includes "why Litt refused to decide" in plain language

---

## Next Steps

1. **Read 02-AGENT-OBSERVATION-INSTRUMENTATION.md** — Data models and coordinator changes
2. **Read 03-AUDIT-LOG-AND-API.md** — API contract and Firestore schema
3. **Read 04-REACT-TIMELINE-COMPONENT.md** — UI implementation
4. **Read 05-DEMO-FIXTURES-AND-SCRIPT.md** — Demo data and walkthrough script
5. **Implement in order** — Models → Coordinator → Sub-agents → API → React → Fixtures
6. **Test each phase** — Demo reset → sweep → verify timeline output
7. **Record demo** — Run twice, keep second video

---

## Review Checklist

Before beginning implementation, confirm:

- [ ] You have access to the current `coordinator.py` implementation
- [ ] All sub-agents (deadline, billing, comms, anomaly) are working
- [ ] Firestore is configured and seed data loads
- [ ] React dashboard is rendering Daily Closeout Brief
- [ ] You can run a manual sweep via Cloud Run
- [ ] You have 6-8 hours uninterrupted build time (Day 6-7)

**Estimated completion:** End of Day 6 (polish phase)  
**Demo-ready:** Start of Day 7  
**Buffer time:** 2-3 hours for fixes before submission

---

*This plan prioritizes visibility and clarity over new functionality. The goal is not to add features—it's to make existing autonomy visible.*
