# 05 — Litt Demo Fixtures & Hackathon Script

**Purpose:** Seed data and demo walkthrough that triggers all observation types and gates  
**Audience:** Everyone (fixtures are data, script is narration)  
**Time estimate:** 1 hour to finalize and test  

---

## May 31 Demo Sharpness Updates

Use this doc to make the judging story more demonstrably agentic:

- Preserve the existing v1.0 readiness backbone: `dl-mercer-001`, `te-005`, `te-001`, `acme-commercial`, and `whitmore-employment-2026` must remain visible in the run.
- Add any new Rivera/Okafor conflict fixtures only as supplemental scenes. They should not replace the required readiness checks.
- Make every scripted "agentic" moment show a behind-the-scenes action: source inspection, deterministic tool call, LLM-assisted extraction/draft, gate decision, or append-only audit event.
- Normalize all demo data to `firm_id="strand-okafor"`.
- Make the LLM role explicit but bounded: Gemini drafts/source-summarizes/explains; deterministic Python routes, gates, validates, and writes.
- Do not script a real court docket query unless it exists. Say "court order not present in the firm's sources" rather than "query court docket" for v1.0.

---

## Overview

The demo showcases Litt by:

1. **Attorney clicks "Run Closeout" button**
2. **Agent Run Timeline appears and auto-scrolls** with 24+ observations
3. **Observations show all 7 types:** signal_received, reasoning, routing, tool_call, result, escalation, approval_gate
4. **Observations show all 4 gates:** auto_safe, review_required, escalation, blocked
5. **Specific scenarios demonstrating safety:**
   - Deadline with conflicting sources (escalated)
   - Billing gap detected (suggested entry)
   - Client silence (draft generated)
   - Client email delivery blocked until attorney approval
   - Reconstruction flag (anomaly escalated)
6. **Backend sweep completes in ~2 seconds; UI plays the trace back slowly enough for judges**
7. **Daily Closeout Brief appears below timeline** with all items ready for approval

---

## Seed Data

### File: `backend/app/ingestion/demo_fixtures.py` and `backend/app/demo/seeder.py`

The current repo already has fixture adapters and a reset seeder. Prefer extending those files instead of creating a parallel `backend/app/fixtures/` package.

```python
"""
Demo fixtures for Litt hackathon showcase.

Designed to trigger:
- All 7 observation types
- All 4 commitment gates
- 1 deadline conflict (escalation)
- 1 billing gap (review required)
- 1 client silence (review required)
- 1 blocked send attempt (blocked)
- 1 reconstruction flag (escalation)

Seed data is deterministic and idempotent.
"""

from datetime import datetime, timedelta
from app.config import get_effective_date

# Reference date: May 29, 2026, 4:30 PM
DEMO_DATE = get_effective_date()  # 2026-05-29

# ============================================================================
# FIRM: Strand & Okafor LLP
# ============================================================================

DEMO_FIRM_ID = "strand-okafor"

DEMO_FIRM = {
    "id": DEMO_FIRM_ID,
    "name": "Strand & Okafor LLP",
    "practice_areas": ["litigation", "commercial"],
    "jurisdiction": "Ohio",
    "attorneys": [
        {
            "id": "attorney_001",
            "name": "Dana Strand",
            "rate": 350,
            "seniority": "partner",
            "email": "sarah@strand-okafor.law"
        },
        {
            "id": "attorney_002",
            "name": "James Okafor",
            "rate": 300,
            "seniority": "counsel",
            "email": "james@strand-okafor.law"
        }
    ]
}

# ============================================================================
# MATTERS
# ============================================================================

DEMO_MATTERS = {
    "mercer-v-dunlap": {
        "id": "mercer-v-dunlap",
        "firm_id": DEMO_FIRM_ID,
        "client_name": "Mercer Manufacturing LLC",
        "type": "litigation",
        "status": "active",
        "matter_number": "2026-001",
        "assigned_attorneys": ["attorney_001"],
        "budget_cap": 50000,
        "budget_used": 18500,
        "last_client_contact": DEMO_DATE - timedelta(days=16),
        "created_at": DEMO_DATE - timedelta(days=60)
    },
    "rivera-v-northline": {
        "id": "rivera-v-northline",
        "firm_id": DEMO_FIRM_ID,
        "client_name": "Rosa Rivera",
        "type": "litigation",
        "status": "active",
        "matter_number": "2026-002",
        "assigned_attorneys": ["attorney_001"],
        "budget_cap": 35000,
        "budget_used": 12000,
        "last_client_contact": DEMO_DATE - timedelta(days=3),
        "created_at": DEMO_DATE - timedelta(days=45)
    },
    "acme-commercial": {
        "id": "acme-commercial",
        "firm_id": DEMO_FIRM_ID,
        "client_name": "Acme Commercial Group",
        "type": "commercial",
        "status": "active",
        "matter_number": "2026-003",
        "assigned_attorneys": ["attorney_002"],
        "budget_cap": 15000,
        "budget_used": 11700,  # 78% — approaching limit
        "last_client_contact": DEMO_DATE - timedelta(days=8),
        "created_at": DEMO_DATE - timedelta(days=30)
    },
    "okafor-contract-review": {
        "id": "okafor-contract-review",
        "firm_id": DEMO_FIRM_ID,
        "client_name": "Strand & Okafor Internal",
        "type": "commercial",
        "status": "active",
        "matter_number": "2026-004",
        "assigned_attorneys": ["attorney_002"],
        "budget_cap": 8000,
        "budget_used": 2400,
        "last_client_contact": DEMO_DATE - timedelta(days=1),
        "created_at": DEMO_DATE - timedelta(days=14)
    }
}

# ============================================================================
# GMAIL FIXTURES (deadline candidates)
# ============================================================================

DEMO_GMAIL_FIXTURES = [
    {
        "message_id": "email-mercer-001",
        "from": "j.prosecutor@cuyahoga-courts.oh.us",
        "from_display": "Judge J. Prosecutor, Cuyahoga County",
        "subject": "Mercer v. Dunlap — Motion for Summary Judgment Order",
        "body": """
Your motion for summary judgment in Mercer v. Dunlap has been received.
Opposition to motion for summary judgment due June 4, 2026.
Service of all documents on opposing counsel required.
""",
        "received_at": DEMO_DATE - timedelta(days=1),
        "message_id": "email-mercer-001",
        "deadline_candidates": [
            {
                "extracted_date": "2026-06-04",
                "source_excerpt": "Opposition to motion for summary judgment due June 4, 2026",
                "confidence": 0.95,
                "source_type": "email",
                "jurisdiction": "Ohio",
                "matter_id": "mercer-v-dunlap",
                "verification_status": "unverified",
            }
        ]
    },
    
    # IMPORTANT: This email has CONFLICTING deadline info
    # Used to demonstrate escalation (cannot safely verify)
    {
        "message_id": "email-rivera-001",
        "from": "opposite.counsel@rivera-defense.com",
        "from_display": "Opposing Counsel, Rivera Defense",
        "subject": "Re: Rivera v. Northline — Motion Response",
        "body": """
Thank you for your motion filing. Response to your motion is due tomorrow (Friday).
Please ensure all documents are properly formatted per court rules.
""",
        "received_at": DEMO_DATE - timedelta(days=1),  # Thursday before the May 29 demo
        "deadline_candidates": [
            {
                "extracted_date": "2026-05-29",  # "Tomorrow (Friday)" relative to Thursday receipt
                "source_excerpt": "Response to your motion is due tomorrow (Friday)",
                "confidence": 0.7,  # Lower confidence — "tomorrow" is deictic, ambiguous
                "source_type": "email",
                "jurisdiction": "Ohio",
                "matter_id": "rivera-v-northline",
                "verification_status": "unverified",
                "conflict_flag": True,  # Opposing counsel says tomorrow, no court order confirmation
            }
        ]
    },
    
    {
        "message_id": "email-acme-001",
        "from": "general.counsel@acme-commercial.com",
        "from_display": "General Counsel, Acme Commercial",
        "subject": "Invoice 2026-05-100 Status",
        "body": """
We received your recent invoice for May work on the commercial contract review.
Payment may be delayed due to Q2 budget approvals in our organization.
We will advise as soon as payment is authorized.
""",
        "received_at": DEMO_DATE - timedelta(days=2),
        "deadline_candidates": []  # No deadline, but triggers A/R watchdog
    }
]

# ============================================================================
# CALENDAR FIXTURES
# ============================================================================

DEMO_CALENDAR_FIXTURES = [
    # Mercer deadline prep (already scheduled for June 1)
    {
        "event_id": "cal-mercer-prep",
        "summary": "Mercer — Motion prep block",
        "description": "Prepare opposition to summary judgment motion",
        "start": datetime(2026, 6, 1, 9, 0, 0),
        "end": datetime(2026, 6, 1, 12, 0, 0),
        "matter_id": "mercer-v-dunlap",
        "calendar_type": "internal"
    },
    
    # Rivera call with opposing counsel TODAY
    {
        "event_id": "cal-rivera-call",
        "summary": "Call with Rivera opposing counsel",
        "description": "Status check on motion timeline",
        "start": datetime.combine(DEMO_DATE, datetime.min.time()).replace(hour=14, minute=30),
        "end": datetime.combine(DEMO_DATE, datetime.min.time()).replace(hour=14, minute=45),
        "matter_id": "rivera-v-northline",
        "calendar_type": "external"
    },
    
    # IMPORTANT: Okafor call TODAY — NO corresponding time entry
    # Used to demonstrate billing gap detection
    {
        "event_id": "cal-okafor-call",
        "summary": "Okafor — client call, contract revisions",
        "description": "Discuss contract revisions, fallback positions, next steps",
        "start": datetime.combine(DEMO_DATE, datetime.min.time()).replace(hour=15, minute=30),
        "end": datetime.combine(DEMO_DATE, datetime.min.time()).replace(hour=16, minute=12),
        "matter_id": "okafor-contract-review",
        "duration_minutes": 42,
        "calendar_type": "external"
        # NO time entry exists for this — billing agent will flag it
    },
    
    # Acme meeting last week (past)
    {
        "event_id": "cal-acme-meeting",
        "summary": "Acme — In-person client meeting",
        "description": "Contract review kickoff",
        "start": DEMO_DATE - timedelta(days=8),
        "end": DEMO_DATE - timedelta(days=8, hours=-2),
        "matter_id": "acme-commercial",
        "calendar_type": "external"
    }
]

# ============================================================================
# TIME ENTRY FIXTURES (pending review)
# ============================================================================

DEMO_TIMEENTRY_FIXTURES = [
    {
        "id": "entry-mercer-001",
        "firm_id": DEMO_FIRM_ID,
        "matter_id": "mercer-v-dunlap",
        "attorney_id": "attorney_001",
        "duration_hours": 0.8,
        "task_code": "T200",  # Legal research
        "activity_code": "RESEARCH",
        "narrative": "Reviewed opposing motion and client email regarding production obligations",
        "status": "DRAFT",
        "created_at": DEMO_DATE - timedelta(minutes=10),
        "session_minutes_actual": 48,
        "ai_cost_usd": 0.32,
    },
    
    # IMPORTANT: Entry with NO narrative — triggers review flag
    {
        "id": "entry-mercer-002",
        "firm_id": DEMO_FIRM_ID,
        "matter_id": "mercer-v-dunlap",
        "attorney_id": "attorney_001",
        "duration_hours": 1.4,
        "task_code": "T100",  # General legal advice
        "activity_code": "PLANNING",
        "narrative": None,  # NO NARRATIVE — billing agent will flag
        "status": "DRAFT",
        "created_at": DEMO_DATE - timedelta(minutes=12),
    },
    
    # Completed entry (for reference, won't appear in draft list)
    {
        "id": "entry-acme-001",
        "firm_id": DEMO_FIRM_ID,
        "matter_id": "acme-commercial",
        "attorney_id": "attorney_002",
        "duration_hours": 0.5,
        "task_code": "T200",
        "activity_code": "RESEARCH",
        "narrative": "Reviewed client comments on contract Section 5 (Termination)",
        "status": "APPROVED",
        "created_at": DEMO_DATE - timedelta(days=1),
    },
]

# ============================================================================
# ANOMALY FIXTURES
# ============================================================================

# No explicit anomaly fixtures — they're detected by anomaly agent
# But we can seed entries that trigger anomalies:

DEMO_ANOMALY_TRIGGERS = [
    {
        "type": "BILLING_RECONSTRUCTION",
        "entry_id": "entry-mercer-002",
        "reason": "Entry has a rounded tenth-hour value without session provenance and minimal context",
        "confidence": 0.75,
        "severity": 3,
    },
    # More could be added, but one is enough for the demo
]

DEMO_BLOCKED_ACTION = {
    "id": "blocked-send-whitmore-001",
    "firm_id": DEMO_FIRM_ID,
    "matter_id": "whitmore-employment-2026",
    "draft_id": "comm-whitmore-status-001",
    "attempted_action": "send_client_update",
    "blocked_reason": "Client communications require attorney approval before delivery.",
    "gate": "blocked",
    "attorney_next_action": "Review and approve the draft, then queue it for demo outbox delivery.",
}

# ============================================================================
# REQUIRED V1.0 READINESS ANCHORS
# ============================================================================

# These IDs come from docs/data-contract.md and routes/demo.py. Keep them in
# the demo even if supplemental conflict scenes are added.
REQUIRED_DEMO_ANCHORS = {
    "deadline": "dl-mercer-001",  # HARD_LEGAL, 6 days out, not attorney-confirmed
    "forbidden_phrase_time_entry": "te-005",  # contains "review documents"
    "missing_narrative_time_entry": "te-001",  # PENDING with no narrative
    "budget_warning_client": "acme-commercial",  # 78% utilization
    "client_silence_matter": "whitmore-employment-2026",  # 16 days since contact
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_demo_firm(firm_id: str = DEMO_FIRM_ID) -> dict:
    """Get the demo firm"""
    if firm_id == DEMO_FIRM_ID:
        return DEMO_FIRM
    raise ValueError(f"Unknown demo firm: {firm_id}")


def get_demo_matter(matter_id: str) -> dict:
    """Get a demo matter"""
    if matter_id in DEMO_MATTERS:
        return DEMO_MATTERS[matter_id]
    raise ValueError(f"Unknown demo matter: {matter_id}")


def get_demo_gmail_fixtures(firm_id: str = DEMO_FIRM_ID) -> list:
    """Get all Gmail deadline candidates"""
    if firm_id == DEMO_FIRM_ID:
        return DEMO_GMAIL_FIXTURES
    return []


def get_demo_calendar_fixtures(firm_id: str = DEMO_FIRM_ID) -> list:
    """Get all calendar events"""
    if firm_id == DEMO_FIRM_ID:
        return DEMO_CALENDAR_FIXTURES
    return []


def get_demo_timeentry_fixtures(firm_id: str = DEMO_FIRM_ID) -> list:
    """Get all pending time entries"""
    if firm_id == DEMO_FIRM_ID:
        return DEMO_TIMEENTRY_FIXTURES
    return []


def seed_demo_data(firestore_client, firm_id: str = DEMO_FIRM_ID) -> None:
    """
    Seed all demo data into Firestore.
    
    Called by POST /api/demo/reset
    """
    # Seed firm
    firm = get_demo_firm(firm_id)
    firestore_client.collection("firms").document(firm_id).set(firm)
    
    # Seed matters
    for matter_id, matter in DEMO_MATTERS.items():
        firestore_client.collection("firms").document(firm_id).collection(
            "matters"
        ).document(matter_id).set(matter)
    
    # Seed time entries
    for entry in get_demo_timeentry_fixtures(firm_id):
        firestore_client.collection("firms").document(firm_id).collection(
            "time_entries"
        ).document(entry["id"]).set(entry)
    
    # Note: Gmail and Calendar fixtures are returned by
    # DemoFixtureGmailSource and DemoFixtureCalendarSource adapters
    # They're not persisted in Firestore, just returned in-memory


def reset_demo_data(firestore_client, firm_id: str = DEMO_FIRM_ID) -> None:
    """
    Delete all demo data and re-seed.
    
    Called by POST /api/demo/reset
    """
    # Delete all time entries
    entries = firestore_client.collection("firms").document(firm_id).collection(
        "time_entries"
    ).stream()
    for entry in entries:
        entry.reference.delete()
    
    # Delete all agent runs
    runs = firestore_client.collection("firms").document(firm_id).collection(
        "agent_runs"
    ).stream()
    for run in runs:
        run.reference.delete()
    
    # Delete all audit log entries
    # Demo-only reset exception: production audit_log remains CREATE-only.
    audit = firestore_client.collection("firms").document(firm_id).collection(
        "audit_log"
    ).stream()
    for entry in audit:
        entry.reference.delete()
    
    # Re-seed
    seed_demo_data(firestore_client, firm_id)
```

---

## Demo Walkthrough Script

### File: `docs/HACKATHON-DEMO-SCRIPT.md`

```markdown
# Litt Hackathon Demo Script

**Duration:** 90 seconds (must fit within 2-minute video limit)  
**Setup:** Live instance running at deployed Cloud Run URL  

---

## Scene Setup

**Visual:**
- Web browser showing Litt dashboard (Daily Closeout Brief view)
- Attorney name: Dana Strand
- Firm: Strand & Okafor LLP
- Time: 4:29 PM, May 29, 2026 (one minute before closeout)

**Starting state:**
- Dashboard shows empty timeline and "Run Closeout" button
- Brief items section shows loading placeholder

---

## Demo Script with Timing

### 0:00-0:08 — Introduction

**NARRATOR:**
"Small law firms don't lose time in one system. They lose it between systems: email, calendar, billing records, client updates, and deadlines.

Litt is an autonomous operations agent for that gap. It doesn't replace lawyers. It watches the firm's operational surface area, finds what needs attorney attention, and produces a source-backed Daily Closeout Brief with an audit trail.

Here's Dana Strand at Strand & Okafor LLP. It's 4:29 PM, and she's about to run closeout."

**ACTION:**
- Show dashboard with four active matters on screen
- Highlight the time (4:29 PM)
- Show empty timeline section and "Run Closeout" button

### 0:08-0:12 — Trigger the Sweep

**ACTION:**
Dana clicks "Run Closeout" button.

**NARRATOR:**
"When Dana clicks Run Closeout, Litt starts observing the firm like an operations layer, not a chatbot."

### 0:12-0:48 — Timeline Auto-Scrolls (Primary Demo)

**ACTION:**
Agent Run Timeline appears and auto-scrolls with observations. The timeline should show in this order:

```
0:12 Coordinator observed 14 Gmail threads, 6 calendar events, 4 matters, 3 time entries
0:13 Deterministic plan: deadline verification, billing reconciliation, client comms, anomaly detection
0:14 Routing: deadline candidate to deadline_agent
0:15 Routing: time entries and calendar gaps to billing_agent

[Sub-agent work begins]

0:16 deadline_agent: Inspecting firm-held court order email
0:17 Deterministic date check: Mercer opposition due June 4, 2026 (6 days out)
0:18 Gate: ESCALATION because hard legal deadline is not attorney-confirmed

0:19 deadline_agent: Inspecting second deadline candidate from opposing counsel
0:20 Gemini-assisted extraction: "Response due tomorrow (Friday)"
0:21 Gate: ESCALATION. Litt refuses to verify the deadline.
     Evidence: "Response due tomorrow (Friday)" 
     Problem: Relative date, opposing-counsel source, no court order in firm sources
     Confidence: 70%
     Attorney next action: Confirm deadline before filing

0:22 billing_agent: Reconciles calendar against time entries
0:23 Result: Found 42-minute client call with no time entry
0:24 Gemini-assisted draft: suggested billing narrative from calendar context
     Suggested: "Client call re: contract revisions and fallback position"
     Confidence: 85%
     Gate: REVIEW_REQUIRED

0:25 billing_agent: Runs pre-bill scrubber
0:26 Deterministic scrubber hit: te-005 contains forbidden phrase "review documents"
     Gate: REVIEW_REQUIRED
     Attorney next action: Edit narrative before approval

0:27 billing_agent: Checks pending entry te-001
0:28 Result: Missing narrative and no session provenance
     Gate: ESCALATION for reconstruction risk

0:29 comms_agent: Detects Whitmore client silence
0:30 Deterministic check: Last client contact was 16 days ago
0:31 Gemini-assisted draft: status update from source packet
     Sources: Recent motion activity, budget utilization
     Confidence: 90%
     Gate: REVIEW_REQUIRED
0:32 Gate: BLOCKED. Draft cannot be sent without attorney approval.

0:33 billing_agent: Computes Acme budget utilization
0:34 Deterministic result: 78% of budget used, WARN threshold crossed
     Gate: REVIEW_REQUIRED

0:35 anomaly_agent: Scores billing reconstruction risk
0:36 Gate: ESCALATION. Possible reconstructed time requires attorney review.

0:37 Brief assembly: 7 items queued, 3 escalations, 2 reviews, 1 blocked action
0:38 Append-only audit events linked to observations and evidence
0:39 Timeline complete
```

**NARRATOR (during timeline):**

"The key moment is this deadline. Litt extracted the date language, checked the source, saw it came from opposing counsel, and refused to treat it as verified. That is the product: autonomy with professional boundaries.

In the same run, Litt recovered a missing time entry, caught a billing-guideline phrase before invoice review, detected client silence, drafted a client update, blocked delivery until attorney approval, and raised a budget warning.

The backend completed the sweep in about two seconds; the UI is replaying the trace slowly enough to inspect."

### 0:48-1:05 — Show the Brief

**ACTION:**
Timeline completes. Daily Closeout Brief appears below.

**NARRATOR:**
"Now Dana gets the closeout brief. This is not a summary of chat output. These are attorney decisions Litt found across the firm's workflow.

The hero item is the ambiguous deadline. It says 'tomorrow,' but the source is opposing counsel and there is no court order in the firm's sources. Litt escalates because guessing would create liability."

**Show on screen:**
```
DEADLINES NEEDING CONFIRMATION
  ⚠ Rivera v. Northline — "Response due Friday" — ESCALATION
    Evidence: Email says tomorrow; no court order in firm sources
    Confidence: 70%
    [Confirm deadline] [Request verification]

BILLING GAPS
  ⚠ Okafor Contract Review — 42 min call on calendar, no entry
    Suggested: "Client call re: revisions and fallback position"
    [Review suggested entry] [Create manually]

  ⚠ Acme Commercial — "review documents" phrase violates billing guidelines
    [Edit narrative] [Write down] [Dismiss with reason]

CLIENT COMMS
  ✓ Whitmore Employment — 16 days since contact
    Draft status update prepared from case history
    Send is blocked until approval
    [Review draft] [Approve for delivery] [Dismiss]

ANOMALIES
  ⚠ Billing reconstruction suspected
    Missing narrative and weak session provenance
    [Review entries] [Mark safe]
```

### 1:05-1:35 — Explain the Safety Model

**ACTION:**
Click on one escalation item to show the audit trail.

**NARRATOR:**
"Notice the gates. AUTO_SAFE is informational. REVIEW_REQUIRED means Litt prepared work but needs approval. ESCALATION means professional judgment is required. BLOCKED means Litt cannot proceed.

That is the boundary. Gemini helps with extraction, drafting, and explanation. Python controls routing, budget math, scrubber checks, state transitions, and gates.

The audit trail shows what Litt observed, which source it used, why it escalated, what confidence it had, and what Dana decided. That is how an attorney can rely on the system without turning it into an unreviewed black box."

**Show on screen:**
Audit log entry for the escalated deadline:

```
AUDIT LOG — Deadline Escalation

What Litt observed:
- Email from opposing counsel: "Response due tomorrow (Friday)"
- No court order present in firm sources
- Relative date language: ambiguous

System suggestion:
- Confidence: 70%
- Gate: ESCALATION
- Reason: Cannot safely verify from this source alone

What Litt recommended:
- Request attorney verification
- Check firm-held court order or docket source before confirmation

Human decision audit event: [Pending]
```

### 1:35-1:55 — Close with the Attorney Outcome

**ACTION:**
Show the dashboard with all items resolved (some approved, some escalated).

**NARRATOR:**
"Dana did not have to search her inbox, compare calendars against billing, remember which client went quiet, or manually reconstruct why an item was risky.

Litt brought her the decisions, the evidence, and the guardrails: deadline risk surfaced, billing leakage caught, client relationship maintained, budget pressure visible, and every action documented.

That's Litt: autonomous operations with legal-grade safety."

### 1:55-2:00 — Final Frame

**ACTION:**
Zoom out to show full dashboard. Fade to Litt logo.

**TEXT OVERLAY:**
```
Litt
Autonomous Operations for Small Law Firms

Built with Gemini 2.5 Pro
Deployed on Google Cloud Run
Open source governance

www.litt-ops.com (or submission URL)
```

---

## Technical Notes for Recording

### Before Recording

1. **Reset demo data:** `POST /api/demo/reset?firm_id=strand-okafor`
2. **Verify timeline observations:** Should produce 20+ observations in 2-3 seconds
3. **Verify all 4 gates appear:** AUTO_SAFE, REVIEW_REQUIRED, ESCALATION, BLOCKED
4. **Verify conflict case triggers:** Rivera deadline with 70% confidence should escalate
5. **Record in clean environment:** One firm, no extra data, clean browser console

### Recording Settings

- **Resolution:** 1920x1080 (HD)
- **Frame rate:** 30 FPS
- **Audio:** Clear voiceover, no background noise
- **Codec:** H.264 MP4
- **Total duration:** 2:00 hard cap

### Key Shots to Get

- [ ] Timeline start (signal received)
- [ ] Deadline escalation (conflicting evidence)
- [ ] Billing gap suggestion (42-minute call)
- [ ] Brief appearance (all items)
- [ ] Audit log (human decision trail)
- [ ] Final stats (observation count, gate summary)

### Common Mistakes to Avoid

- ❌ Timeline scrolling too fast (use 150ms delay between items)
- ❌ Not showing escalation clearly (highlight the amber warning color)
- ❌ Not explaining why deadline was escalated (mention the 70% confidence + deictic reference)
- ❌ Rushing through the brief (pause on each section for 3-5 seconds)
- ❌ Not showing the audit trail (critical for hackathon judges)

---

## Alternative Demo Flows (if needed)

### Shorter Version (60 seconds)

Skip the detailed walk-through of each sub-agent. Jump to:
1. Timeline starts
2. Show key observations (3 escalations highlighted)
3. Brief appears
4. Show audit trail for one escalation
5. Final pitch

### Longer Version (2 minutes, fully utilized)

Add:
- Pre-demo: Show fixture data (what Gmail/Calendar look like)
- During timeline: Pause and explain each observation type
- Post-brief: Walk through attorney approving an item
- Post-approval: Show audit log entry with human decision recorded

---

## What Judges Will Be Looking For

✅ **Autonomy is visible** — Not hidden behind a brief  
✅ **Safety gates are clear** — AUTO_SAFE vs. REVIEW_REQUIRED vs. ESCALATION vs. BLOCKED  
✅ **Escalation is intelligent** — System can refuse to verify when sources conflict  
✅ **Audit trail is complete** — Every decision is logged with evidence  
✅ **Demo is credible** — Not oversimplified, shows real complexity  
✅ **Code is clean** — Fixture data is deterministic and reproducible  

---

## Post-Demo Q&A Talking Points

**"How is this different from a rules engine?"**
"It's agentic up to the point of professional commitment. The coordinator observes, plans, routes. Sub-agents reason about context (deadline sources, billing narrative, anomalies). But gates are deterministic — escalations can't be overridden by prompting."

**"What prevents the agent from auto-sending client emails?"**
"That gate is BLOCKED. Only the attorney can send client communications. The agent can draft and suggest, but sending requires human review and approval, logged in the audit trail."

**"How do you prevent hallucination?"**
"Three ways: (1) Deterministic routing and gates in Python, not LLM. (2) FactPacket architecture for comms — agent can only cite facts that exist in structured data. (3) Anomaly detection is rule-based, not inferred. LLM is used for narrative generation and escalation explanation, not critical decisions."

**"What about scalability?"**
"This is v1.0 for 2-15 person firms. Firestore scales. Cloud Run scales. The architecture is stateless. For larger firms, we'd add event-driven triggers (currently stubbed in v1.0)."

---
```

---

## Expected Observations Order

When the demo runs, the timeline should show observations in approximately this order. Use this for testing:

```python
# Expected observation sequence (timing approximate)

0:00 signal_received    Coordinator observed X signals
0:01 reasoning          Deterministic plan created
0:02 routing_decision   → deadline_agent (mercer deadline)
0:02 routing_decision   → billing_agent (time entry)
0:03 routing_decision   → billing_agent (calendar gap)
0:03 tool_call          deadline_agent: inspect firm-held court order email
0:04 result             deadline_agent: Mercer hard deadline is 6 days out
0:04 escalation         deadline_agent: attorney confirmation required
0:05 reasoning          deadline_agent: inspect opposing-counsel deadline email
0:06 result             Gemini-assisted extraction found "tomorrow (Friday)"
0:06 escalation         deadline_agent: cannot verify Rivera deadline from this source alone
0:07 tool_call          billing_agent: reconcile calendar against time entries
0:08 result             billing_agent: suggested entry for 42-minute calendar gap
0:08 tool_call          billing_agent: run pre-bill scrubber
0:09 result             billing_agent: te-005 forbidden phrase requires review
0:09 escalation         billing_agent: te-001 missing narrative and provenance
0:10 reasoning          comms_agent: Whitmore client silence detected
0:10 tool_call          comms_agent: extract source packet
0:11 result             Gemini-assisted client update draft prepared
0:11 approval_gate      comms_agent: sending blocked until attorney approval
0:12 result             billing_agent: Acme budget utilization is 78%
0:12 escalation         anomaly_agent: reconstruction flag
0:12 result             Assembled brief (7 items, 3 escalations, 1 blocked action)
0:12 result             Append-only audit events linked; timeline complete
```

---

## Firestore Query to Verify Demo Data

After running `POST /api/demo/reset`, verify:

```javascript
// Matters exist
db.collection('firms').doc('strand-okafor').collection('matters').get()
// Should return 4 documents

// Time entries exist
db.collection('firms').doc('strand-okafor').collection('time_entries').get()
// Should return 2-3 documents (DRAFT status)

// No agent_runs or audit_log yet (empty)
db.collection('firms').doc('strand-okafor').collection('agent_runs').get()
// Should be empty

// After running POST /api/sweep:
// Should have 1 agent_run with 20+ observations
// Should have 7 audit_log entries (one per brief item)
```

---

## Testing Checklist

Before recording final demo:

- [ ] `POST /api/demo/reset` completes in <1 second
- [ ] `GET /api/demo/ready` returns all checks passing
- [ ] `POST /api/sweep` completes in 2-3 seconds
- [ ] Timeline returns 20+ observations
- [ ] All 7 observation types appear in timeline
- [ ] All 4 gates appear (auto_safe, review_required, escalation, blocked)
- [ ] Rivera deadline shows ESCALATION gate
- [ ] Okafor call shows billing gap suggestion
- [ ] Mercer entry shows narrative missing flag
- [ ] Brief appears after timeline completes
- [ ] Audit log has 7 entries, one per brief item
- [ ] React timeline component renders smoothly (no jank)
- [ ] Dark mode works correctly
- [ ] Mobile responsive (if testing on smaller screen)

---

## File Locations Summary

| Component | File | Notes |
|-----------|------|-------|
| Fixture data | `backend/app/fixtures/demo_fixtures.py` | Deterministic seed data |
| Reset endpoint | `backend/app/routes/demo.py` | `POST /api/demo/reset` |
| Script (this) | `docs/HACKATHON-DEMO-SCRIPT.md` | Narration + timing |
| Timeline component | `dashboard/src/components/AgentRunTimeline.tsx` | Displays observations |
| CSS | `dashboard/src/components/AgentRunTimeline.css` | Styling + animations |
| Brief integration | `dashboard/src/components/DailyCloseoutBrief.tsx` | Uses timeline component |

---

## Next Steps

1. **Finalize fixtures** — Run through and verify all scenarios trigger
2. **Test timeline rendering** — Verify smooth scrolling, no jank
3. **Record first take** — Full 2-minute run-through
4. **Review for impact** — Does escalation come across clearly?
5. **Re-record if needed** — Tighten narration, adjust pacing
6. **Final cleanup** — Verify demo data resets for submission

---

*Litt Hackathon Demo — Ready for Recording*
