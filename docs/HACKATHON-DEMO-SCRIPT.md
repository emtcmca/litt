# Litt — Hackathon Demo Script

**Target duration:** 90 seconds  
**Hard cap:** 2:00 (contest rule)  
**Demo firm:** Strand & Okafor LLP (`strand-okafor`)  
**Demo date anchor:** May 29, 2026, 4:29 PM

---

## Pre-Recording Checklist

Run these before every take:

```
1. POST /api/demo/reset   {"firm_id": "strand-okafor", "confirm": true}
2. GET  /api/demo/ready   → all 5 checks must show "pass": true
3. Hard-refresh browser   → timeline is empty, brief shows loading state
4. Audio check            → no background noise
```

---

## Scene Layout

| Screen region | What judge sees |
|---|---|
| Top half | Agent Run Timeline (empty, "Run Closeout" button visible) |
| Bottom half | Daily Closeout Brief (loading state) |
| Banner | `DEMO MODE — strand-okafor — 2026-05-29` |

---

## Script with Timing Marks

### 0:00–0:10 — Hook

**NARRATOR:**
> "Small law firms don't lose time in one system. They lose it between systems — email, calendar, billing, client updates, and deadlines.
>
> Litt is an autonomous operations agent for that gap. It watches the firm's operational surface, finds what needs attorney attention, and produces a source-backed Daily Closeout Brief with an audit trail.
>
> Dana Strand at Strand & Okafor LLP. 4:29 PM. She clicks Run Closeout."

**ACTION:** Click the "Run Closeout" button.

---

### 0:10–0:50 — Agent Run Timeline Plays

The timeline auto-scrolls. 22 observations drip in at 250 ms each (~5.5 seconds total playback). **Do not skip ahead — let it play.**

**Key observations to highlight with narration:**

| Approx time | Observation | What to say |
|---|---|---|
| 0:14 | `deadline_agent` / ESCALATION — Rivera deadline | **"Here. Litt used Gemini to extract 'due tomorrow, Friday' from an opposing counsel email. No court order in firm sources. Confidence: 70%. Litt flags it — never auto-verifies."** |
| 0:22 | `billing_agent` / REVIEW_REQUIRED — 42-min gap | "Same run: 42-minute client call on calendar, no time entry." |
| 0:28 | `billing_agent` / REVIEW_REQUIRED — scrubber hit | "Forbidden billing phrase caught before invoice review." |
| 0:34 | `comms_agent` / BLOCKED — Whitmore draft | "Client update drafted. Delivery blocked until attorney approval." |
| 0:40 | `anomaly_agent` / ESCALATION — reconstruction | "Reconstruction risk flagged on a time entry with no session provenance." |

**NARRATOR (while timeline plays):**
> "That is the product: autonomy with professional boundaries. The backend completed the sweep in about two seconds. The interface replays the trace slowly enough to inspect.
>
> Notice the gate labels. AUTO_SAFE is informational. REVIEW_REQUIRED means Litt prepared work but needs approval. ESCALATION means professional judgment is required. BLOCKED means Litt cannot proceed."

---

### 0:50–1:15 — Brief Appears

Timeline shows `complete`. Daily Closeout Brief populates below.

**NARRATOR:**
> "Now Dana gets the closeout brief. This is not a summary of chat output. These are attorney decisions Litt found across the firm's workflow.
>
> The hero item is the Rivera deadline. It says 'tomorrow' — from opposing counsel, with no court order in the firm's sources. Litt escalates because guessing creates liability.
>
> Gemini helps with extraction, drafting, and explanation. Python controls routing, budget math, scrubber checks, state transitions, and gates. That boundary is enforced in code, not in a prompt."

**ACTION:** Scroll brief to show: Rivera ESCALATION → Okafor billing gap → Whitmore BLOCKED send → Acme budget warning.

---

### 1:15–1:35 — Audit Trail

**ACTION:** Click Rivera deadline item → modal opens → click "View source email" → show full opposing counsel email body. Point to the extracted text and confidence score.

**NARRATOR:**
> "Here is the opposing counsel email that triggered the escalation. Litt read this text, extracted 'May 30' with 92% confidence, and refused to verify it without attorney review. Dana clicks Verify — the deadline is now attorney-verified and enters the normal escalation cadence."

**Show:** Full source email (from: jcolbert@colbertmarsh.com, subject: Rivera v. Holbrook — Discovery Responses Due, body with "tomorrow (Friday)" text). Then Verify action completing with AuditEventDrawer confirmation (audit_event_id visible).

**ACTION:** Click "Audit Log" button in topbar → `/audit` page opens → point to legal_defensibility tier entries; expand one `before_state` / `after_state` diff.

**NARRATOR:**
> "Every action Dana takes — and every action Litt takes — is a CREATE-only entry in the audit log. Two tiers: operational for billing and deadline decisions, legal defensibility for anything that could appear in a fee dispute or malpractice review. If a client ever asks 'why was this billed this way?' or 'when did you know about this deadline?' — the answer is here, immutable, timestamped."

---

### 1:35–1:50 — Close

**ACTION:** Navigate back to brief (`← Brief` link). Zoom out to show full dashboard — all sections populated.

**NARRATOR:**
> "Dana did not search her inbox, compare calendars to billing records, remember which client went quiet, or reconstruct why an entry looked risky.
>
> Litt brought her the decisions, the evidence, and the guardrails: deadline risk surfaced with source proof, billing leakage caught before invoicing, client relationship flagged before it became a complaint, budget pressure visible before it became a dispute, every action logged with full provenance.
>
> That's Litt — autonomous operations with legal-grade safety."

**ACTION:** Fade or cut to black.

---

### 1:50–2:00 — Title card (optional — use remaining time)

```
Litt
Autonomous Operations for Small Law Firms

Gemini 2.5 Pro · Google Cloud Run · Firestore
github.com/emtcmca/litt
```

---

## Pacing Notes

- **Do not rush the timeline.** 22 observations at 250 ms = ~5.5 seconds backend playback. Narration fills the gap.
- **Pause on Rivera.** The ESCALATION observation with amber badge is the clearest proof-of-safety moment. Hold 2–3 seconds.
- **Don't narrate every observation.** Let the labels speak. Call out only Rivera (deadline conflict), Okafor (billing gap), Whitmore (BLOCKED).
- **Brief scroll should be slow.** Judges need to read the section headers.

---

## Recording Settings

| Setting | Value |
|---|---|
| Resolution | 1920 × 1080 |
| Frame rate | 30 FPS |
| Audio | Clear voiceover, no background noise |
| Format | H.264 MP4 |
| Hard cap | 2:00 |

---

## Key Shots Checklist

- [ ] Empty dashboard + "Run Closeout" button visible
- [ ] Timeline starts (`signal_received` first observation)
- [ ] Rivera deadline ESCALATION (amber badge, 70% confidence visible)
- [ ] Rivera "SOURCE CONFLICT" badge in DeadlineModal header
- [ ] Rivera source email body visible (from: jcolbert@colbertmarsh.com, body with "tomorrow (Friday)" text)
- [ ] Gemini extraction badge (confidence 0.92) visible in email viewer
- [ ] Rivera "Verify" tab selected (amber), action completing with AuditEventDrawer
- [ ] AuditEventDrawer: audit_event_id visible
- [ ] BLOCKED observation for Whitmore comms
- [ ] Timeline shows `complete` status pill
- [ ] Brief fully populated (deadlines, WIP, budget, silence, anomalies all visible)
- [ ] Audit Log page (`/audit`) — legal_defensibility tier entries visible
- [ ] Expanded before/after state diff in audit log
- [ ] LEDES Export button visible in topbar (bonus shot if time allows)
- [ ] Final frame or title card

---

## Q&A Backup (if judges ask)

**"How is this different from a rules engine?"**
Routing and gates are deterministic Python — but sub-agents reason about context (deadline sources, billing narrative, anomalies). Gemini drafts and extracts; Python decides and gates.

**"What prevents auto-sending client emails?"**
The `comms_agent` gate is `BLOCKED`. That is a Python enum value returned by deterministic code, not a prompt instruction. The attorney must approve before delivery. Logged in the audit trail.

**"How do you prevent hallucination?"**
Three ways: (1) routing is a Python dict, not LLM routing; (2) Gemini drafts are sourced from structured `FactPacket` data, not open-ended generation; (3) anomaly detection is rule-based, not inferred.

**"What's the stack?"**
Python (FastAPI), Google ADK, Gemini 2.5 Pro via Vertex AI, Firestore, React, Cloud Run. Firestore is the only write path — all writes go through the tool layer, every write calls `log_audit_event()`.
