# Litt — Hackathon Demo Script

**Hard cap:** 2:00 (contest rule)  
**Demo firm:** Strand & Okafor LLP (`strand-okafor`)  
**Demo date anchor:** June 25, 2026, 4:29 PM  
**Sweep timing:** ~50 seconds (real Gemini calls: Rivera date extraction + comms drafts)

---

## Pre-Recording Checklist

Run these before every take:

```
1. Click "Reset demo" in the dashboard toolbar (not API — button seeds the timer too)
2. GET /api/demo/ready → all 5 checks must show "pass": true
3. Hard-refresh browser → timeline is empty, brief shows loading state
4. Verify: ▶ Timer button visible in toolbar, banner shows 2026-06-25
5. Audio check → no background noise
```

---

## Scene Layout

| Screen region | What judge sees |
|---|---|
| Top half | Agent Run Timeline (empty, "Run Closeout" button visible) |
| Bottom half | Daily Closeout Brief (loading state) |
| Topbar | Reset demo · **▶ Timer** · Audit Log · LEDES Export · Run Closeout |
| Banner | `DEMO MODE — strand-okafor — 2026-06-25` |

> **Note:** After Reset, the ▶ Timer button seeds a running timer (Rivera matter, ~7 min elapsed). It is visible throughout the demo as a passive demonstration of real-time billing capture. No dedicated scene needed — judges will notice it.

---

## Script with Timing Marks

### 0:00–0:12 — Hook

**NARRATOR:**
> "Small law firms don't lose time in one system — they lose it in the gaps between systems. Email, calendar, billing, client updates, deadlines — each a silo.
>
> Litt is an autonomous operations agent for that gap. Dana Strand, Strand & Okafor LLP, Thursday June 25. She clicks Run Closeout."

**ACTION:** Click the "Run Closeout" button.

---

### 0:12–1:08 — Sweep Loads + Timeline Plays

The backend runs four sub-agents — billing, deadline, comms, anomaly — including live Gemini calls. **The timeline is blank for ~50 seconds while the sweep runs. Fill every second with narration. Do not be silent.**

**NARRATOR (during loading, 0:12–~1:02):**
> "Litt just dispatched four sub-agents in parallel. The billing agent is scanning seven time entries against each client's billing guidelines — checking for forbidden phrases, missing narratives, round-hour anomalies with no session timer. The deadline agent is reading every active deadline — and for Rivera v. Holbrook, it's calling Gemini right now to extract a due date from an opposing counsel email, because no court order exists in firm records. The comms agent is checking how long since each client heard from the firm. The anomaly agent is scanning for billing patterns across everything.
>
> Routing is a Python dictionary — not an LLM deciding which agents to call. Gemini only handles the probabilistic work: extracting dates from unstructured email text, drafting client updates. The state machine, scrubber rules, budget math, and gate logic are all deterministic code. That boundary is enforced in the codebase, not in a prompt."

**[Timeline populates — observations animate ~1:02–1:08]**

**NARRATOR (during animation, ~1:02–1:08):**
> "Rivera v. Holbrook — ESCALATION. Forbidden billing phrase caught. Whitmore — BLOCKED send. AUTO_SAFE is informational. REVIEW_REQUIRED means Litt prepared work but needs approval. ESCALATION means attorney judgment required. BLOCKED means Litt cannot proceed."

---

### 1:08–1:26 — Brief Appears

Timeline shows `complete`. Daily Closeout Brief populates below.

**NARRATOR:**
> "The closeout brief. Not a chat summary — these are attorney decisions Litt found autonomously across the firm's operational surface.
>
> The hero item: Rivera, due tomorrow — from opposing counsel only, no court order. Acme Commercial: 92% of budget consumed, CRITICAL. Whitmore Group: 16 days since last contact."

**ACTION:** Scroll brief: Rivera deadline (amber, SOURCE CONFLICT badge) → Acme budget (CRITICAL) → Whitmore silence.

---

### 1:26–1:43 — Audit Trail

**ACTION:** Click Rivera deadline item → modal opens → click "View source email."

**NARRATOR:**
> "The source. James Colbert, Colbert & Marsh — 'by tomorrow Friday, June 26.' No court order. Gemini extracted that date. Litt escalated instead of guessing. Dana clicks Verify."

**ACTION:** Click Verify → AuditEventDrawer appears with audit_event_id visible. Hold 2 seconds.

**NARRATOR:**
> "Every action — attorney and agent — is a CREATE-only audit entry. Timestamped. Immutable. Before and after state. Fee dispute, malpractice review — the answer is here."

---

### 1:43–1:55 — Close

**ACTION:** Close modal. Zoom out to show full brief — all sections populated.

**NARRATOR:**
> "Dana didn't search her inbox, reconcile billing records, or remember which client went quiet. Litt brought the decisions, the evidence, and the guardrails.
>
> That's Litt — autonomous operations with legal-grade safety."

**ACTION:** Fade or cut to black.

---

### 1:55–2:00 — Title card

```
Litt
Autonomous Operations for Small Law Firms

Gemini 2.5 Pro · Google Cloud Run · Firestore
github.com/emtcmca/litt
```

---

## Pacing Notes

- **The loading wait is ~50 seconds. Fill every second.** The sweep is real AI running in real time — keep talking.
- **Pause on Rivera.** The ESCALATION with amber SOURCE CONFLICT badge is the product's clearest proof-of-safety moment. Hold 2–3 seconds when it appears in the timeline.
- **Three observations to call out during animation:** Rivera (ESCALATION), forbidden phrase (REVIEW_REQUIRED), Whitmore (BLOCKED). Skip the rest.
- **Brief scroll: 2–3 seconds per section.** Judges read fast but need a beat to absorb section headers.
- **AuditEventDrawer: hold 2 seconds** so the audit_event_id is readable. This is the legal defensibility proof.
- **If the sweep finishes faster than expected** (could vary 40–55s), slow the animation by pausing between callouts. Never rush past Rivera.
- **Timer in topbar:** The ▶ Timer button shows an active timer after Reset. Don't call it out explicitly — let judges notice it. If pressed for time, skip entirely.

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

- [ ] Empty dashboard — "Run Closeout" button visible, `▶ Timer` in toolbar
- [ ] Banner: `DEMO MODE — strand-okafor — 2026-06-25`
- [ ] Loading state visible while sweep runs (not blank screen)
- [ ] Timeline starts — `signal_received` first observation
- [ ] Rivera deadline ESCALATION (amber badge visible)
- [ ] Rivera `SOURCE CONFLICT` badge in DeadlineModal header
- [ ] Rivera source email body (from: jcolbert@colbertmarsh.com, "tomorrow (Friday), June 26, 2026")
- [ ] Rivera "Verify" action completing with AuditEventDrawer, audit_event_id readable
- [ ] Timeline shows `complete` status pill
- [ ] Brief fully populated — deadlines, WIP, budget, silence, anomalies all visible
- [ ] Acme 92% CRITICAL budget bar visible
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

**"What's the Timer button?"**
Real-time billing capture. Attorney selects a matter, starts the timer, works. On stop, Gemini normalizes the raw note into a LEDES-compliant billing narrative. Attorney confirms or edits, and the entry writes directly into the billing pipeline — PENDING status, through the scrubber, into the next sweep.
