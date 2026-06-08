# Litt — Hackathon Demo Script v3.0

**Hard cap:** 2:00 (contest rule)  
**Track:** Track 1 — Build (Net-new agents)  
**Demo firm:** Strand & Okafor LLP (`strand-okafor`)  
**Demo date anchor:** June 25, 2026 (frozen — `LITT_DEMO_DATE=2026-06-25`)  
**Sweep timing:** ~45–55 seconds (live Gemini calls — fill every second)

---

## What judges score on Track 1

From the guide: *"Instead of just reporting data, the agent moves from static code to declarative intent. It autonomously [takes action]."*

The demo must prove three things — in order:

1. **Architecture** — ADK coordinator + sub-agents, MCP-compatible adapters, Gemini doing probabilistic work, Python enforcing deterministic logic
2. **Declarative autonomous action** — agent classifies, decides, and acts without human trigger
3. **Production-grade design** — state machine enforcement, CREATE-only audit trail, idempotency, human gating where it matters

The demo does NOT need to sell the product. It needs to show the architecture working.

---

## What to cut vs. keep (vs. v2.0)

| v2.0 element | Decision | Reason |
|---|---|---|
| `/clients` roster opening | **Cut** | Product tour, not architecture proof |
| "Small law firms lose time in gaps" hook | **Cut** | Sales pitch language |
| "Dana didn't search her inbox" close | **Cut** | Sales pitch language |
| Maintenance panel at 1:44 | **Move to 0:00** | This is the autonomous action proof — lead with it |
| Rivera ESCALATION + source email | **Keep** | Shows declarative intent: agent escalated instead of guessing |
| Sweep narration (4 sub-agents) | **Keep, reframe** | Lead with ADK coordinator vocabulary, not feature description |
| Audit trail | **Keep** | Production-grade proof |

---

## Pre-Recording Checklist

```
1. POST /api/demo/reset  OR  click "Reset demo" in toolbar
2. GET /api/demo/ready → all 5 checks must show ok: True
3. Hard-refresh browser → brief shows empty/loading state
4. Navigate to /clients/mercer-industries — confirm maintenance panel shows
   both "HELD FOR YOUR REVIEW" items AND "APPLIED AUTOMATICALLY" items
5. Navigate to Agent Console — confirm timeline is empty, "Run Closeout" visible
6. Browser: hide bookmarks bar (Ctrl+Shift+B), no extensions visible, full screen
7. Mic check
```

---

## Scene Map

| Time | Screen | Action | Narration |
|---|---|---|---|
| 0:00–0:12 | `/clients/mercer-industries` maintenance panel | Hold — both headers readable | Architecture hook (26 words) |
| 0:12–0:20 | Agent Console | Navigate, click Run Closeout | "ADK coordinator dispatching" (14 words) |
| 0:20–1:07 | Timeline loading | Do not touch | 4 sub-agents + routing (98 words) |
| 1:07–1:20 | Brief | Scroll: Rivera → Acme → Whitmore | "Coordinator output" (29 words) |
| 1:20–1:37 | ResolvePanel + source email | Click Rivera → View source email | "Declarative decision: escalate" (36 words) |
| 1:37–1:47 | AuditEventDrawer | Click Verify, hold 2s on audit_event_id | "CREATE-only, legal_defensibility" (25 words) |
| 1:47–1:54 | Close modal | — | Architecture close (12 words) |
| 1:54–2:00 | Title card | Static | Silent |

---

## Narration word budget

130 wpm is a natural technical speaking pace. Every narration block is calibrated to fit its window.

| Scene | Window | Word budget | Actual |
|---|---|---|---|
| Maintenance hook | 0:00–0:12 (12s) | 26 | 26 |
| Coordinator trigger | 0:12–0:20 (8s) | 17 | 14 |
| Sweep | 0:20–1:07 (47s) | 102 | 98 |
| Brief | 1:07–1:20 (13s) | 28 | 29 |
| Rivera | 1:20–1:37 (17s) | 37 | 36 |
| Audit | 1:37–1:47 (10s) | 22 | 25 |
| Close | 1:47–1:54 (7s) | 15 | 12 |
| **Total** | **114s narrated** | **247** | **240** |

---

## Script with Timing Marks

### 0:00–0:12 — Architecture hook (maintenance panel visible)

**SCREEN:** `/clients/mercer-industries` — maintenance panel. "APPLIED AUTOMATICALLY" section visible with 3–4 applied rows. "HELD FOR YOUR REVIEW" suggestion cards below.

**NARRATOR:** *(26 words)*
> "Litt — a multi-agent system on Google ADK. One coordinator. Four sub-agents. Gemini 2.5 Pro via Vertex AI. This is maintenance agent output — client updates classified, auto-applied, and logged."

**ACTION:** Hold on maintenance panel. Both section headers must be readable.

---

### 0:12–0:20 — Coordinator trigger

**ACTION:** Navigate to Agent Console. Timeline is empty. Click "Run Closeout."

**NARRATOR:** *(14 words)*
> "ADK coordinator dispatching sub-agents in real time. Strand & Okafor — June 25."

---

### 0:20–1:07 — Sweep runs (architecture proof — every word earns its place)

**SCREEN:** Timeline loading. Do not scroll or click.

**NARRATOR:** *(98 words)*
> "classify_signal() — a deterministic Python function — returns a SignalType enum and routes to sub-agents. Gemini is never asked which agent to call. Routing is a Python dict.
>
> Billing sub-agent: seven pre-bill scrubber rules — forbidden phrases, round-hour anomalies, missing narratives. Deadline sub-agent: for Rivera v. Holbrook, Gemini is extracting a due date from opposing counsel email right now — no court order exists in Firestore. Comms sub-agent: MCP-compatible Gmail and Calendar adapters feed FactPackets into Gemini for source-grounded client update drafts. Anomaly sub-agent: 13 deterministic detectors, severity-scored.
>
> State machine transitions enforced by VALID_TRANSITIONS dict. Every Firestore write goes through the tool layer and calls log_audit_event(). Agents never write directly."

**[~1:04–1:07: Timeline populates — observations animate in]**

---

### 1:07–1:20 — Brief appears, three callouts

**SCREEN:** Timeline complete. Brief populated. Scroll slowly: Rivera → Acme → Whitmore.

**NARRATOR:** *(29 words)*
> "Coordinator output — the closeout brief. Three escalations: Rivera v. Holbrook, ESCALATION, SOURCE CONFLICT. Acme Commercial — 92% budget, CRITICAL. Whitmore Group — 16 days without client contact."

**ACTION:** 1-second pause on each item as you name it.

---

### 1:20–1:37 — Rivera: declarative intent in action

**ACTION:** Click Rivera deadline item → modal opens → click "View source email."

**SCREEN:** Source email body. From: jcolbert@colbertmarsh.com. "by tomorrow (Friday), June 26, 2026" readable.

**NARRATOR:** *(36 words)*
> "Deadline agent: source conflict — opposing counsel email only, no court order in Firestore. Gemini extracted the date. Declarative decision: escalate, do not auto-confirm from a single external source. Source visible. Reasoning traceable."

---

### 1:37–1:47 — Audit trail: production-grade proof

**ACTION:** Click Verify → AuditEventDrawer appears. Hold 2 seconds — `audit_event_id` readable.

**SCREEN:** AuditEventDrawer — tier: legal_defensibility, before_state, after_state visible.

**NARRATOR:** *(25 words)*
> "Every tool call — agent and attorney — is CREATE-only. Tier: legal_defensibility. Before and after state. Append-only at the Firestore security rule layer."

---

### 1:47–1:54 — Close

**ACTION:** Close modal.

**NARRATOR:** *(12 words)*
> "One coordinator. Four sub-agents. Deterministic gates. Every decision logged. This is the architecture."

---

### 1:54–2:00 — Title card

```
Litt
Autonomous Operations Agent for Small Law Firms

Google ADK · Gemini 2.5 Pro · Cloud Run · Firestore

Track 1 — Net-New Agents
github.com/emtcmca/litt
```

---

## Pacing Notes

- **0:00–0:12 is the most important scene change from v2.** Open on the maintenance panel showing work already done autonomously. This answers the judge's first question ("what does the agent actually *do*?") before the sweep even runs.
- **"Declarative intent" is the frame for Rivera.** The old script called it "proof of safety." The judge's vocabulary from the guide is "declarative intent." The agent decided to escalate — not a rule, a decision.
- **Use ADK vocabulary explicitly:** "coordinator," "sub-agent," "classify_signal()," "SignalType enum," "VALID_TRANSITIONS dict." Judges score this.
- **MCP gets one mention.** The guide weights MCP heavily. Work in: "The comms sub-agent uses MCP-compatible ingestion adapters for Gmail and Calendar." One sentence during sweep narration is sufficient — judges notice it.
- **Do not use product language during the sweep.** "Billing agent is protecting the firm's revenue" is sales copy. "Billing agent is running 7 pre-bill scrubber rules" is architecture.
- **The audit trail close is technical, not emotional.** The old script said "fee dispute or malpractice review — the answer is here." Cut that. "CREATE-only Firestore audit entry, tier: legal_defensibility, append-only at the security rule layer" is what impresses a technical judge.
- **If sweep finishes faster than expected**, expand the VALID_TRANSITIONS / tool layer explanation. Judges never tire of architectural detail.

---

## Key Shots Checklist

- [ ] `/clients/mercer-industries` maintenance panel — "APPLIED AUTOMATICALLY" rows + "HELD FOR YOUR REVIEW" cards both visible at 0:00
- [ ] Agent Console — `DEMO MODE — strand-okafor — 2026-06-25` banner visible
- [ ] "Run Closeout" button click visible
- [ ] Timeline loading state (not blank screen)
- [ ] Rivera ESCALATION with amber badge in timeline
- [ ] Rivera `SOURCE CONFLICT` badge in modal header
- [ ] Source email body — from: jcolbert@colbertmarsh.com, "tomorrow (Friday), June 26" readable
- [ ] AuditEventDrawer — `audit_event_id` + tier: legal_defensibility readable (hold 2s)
- [ ] Title card — "Track 1 — Net-New Agents" + full stack legible

---

## Q&A Backup

**"How does the coordinator route to sub-agents?"**
`classify_signal()` inspects the signal type and returns a `SignalType` enum. Routing table is a Python dict — `SIGNAL_ROUTING`. The coordinator never asks Gemini which sub-agent to call.

**"Where does MCP fit?"**
Gmail and Calendar ingestion adapters implement an MCP-compatible interface. v1.0 uses fixture adapters for demo reliability; the real OAuth adapters implement the same protocol. The boundary is in `backend/app/ingestion/`.

**"What does Gemini actually do vs. Python?"**
Gemini: date extraction from unstructured email text, client update draft generation, escalation brief narrative synthesis. Python: routing, state machine transitions, budget math, anomaly detection and scoring, LEDES field mapping, all date arithmetic. If the output must be identical given the same input — Python. If a human will read and possibly edit it — Gemini.

**"How does the audit trail work?"**
`log_audit_event()` is called by every tool function on every Firestore write, no exceptions. The `audit_log` collection is CREATE-only at the application layer and enforced at the Firestore security rule layer. It records `tier` (engineering / operational / legal_defensibility), `before_state`, `after_state`, `actor`, `event_type`.

**"What's the maintenance agent?"**
Between sweeps, the maintenance agent runs a `classify_update()` call per proposed change per client. Classification returns SAFE or JUDGMENT — a deterministic Python dict, not an LLM decision. SAFE → auto-apply via tool layer + audit log. JUDGMENT → persisted as a held `SuggestedUpdate` for attorney review.

---

---

# Production Guide — Recording, Editing, Narration

## Recording Setup (OBS Studio — Windows)

**Why OBS:** Free, professional-grade, outputs clean H.264 MP4, records browser without compression artifacts from window capture.

### 1. Install and configure OBS

1. Download OBS Studio from obsproject.com — install, launch.
2. **Settings → Output**
   - Output mode: `Simple`
   - Recording quality: `High Quality, Medium File Size`
   - Recording format: `mp4`
3. **Settings → Video**
   - Base (canvas) resolution: `1920x1080`
   - Output (scaled) resolution: `1920x1080`
   - FPS: `30`
4. **Settings → Audio**
   - Sample rate: `48 kHz`
   - Desktop audio: `Default`
   - Mic/Aux: select your microphone

### 2. Add sources

In OBS Sources panel, click `+`:
1. **Window Capture** → select your browser (crops to browser only — cleaner than display capture)
2. **Audio Input Capture** → select your mic (if recording voice live)

### 3. Prepare browser before every take

- Open Chrome in full-screen mode (F11)
- Hide bookmarks bar: `Ctrl+Shift+B`
- Use a clean Chrome profile (no extensions visible)
- Open tabs in this order for fast switching:
  - Tab 1: `/clients/mercer-industries` — starting frame
  - Tab 2: Agent Console (`/`)
- Run `POST /api/demo/reset` + `GET /api/demo/ready` before starting OBS
- Start on Tab 1 (maintenance panel)

### 4. Record

1. Click **Start Recording**
2. Wait 2 seconds — trim in editing
3. Execute the script
4. After title card: wait 2 seconds, then **Stop Recording**
5. Video saves to `C:\Users\tetzl\Videos`

Record 3–5 full takes. The sweep timing varies (45–55s), which affects narration pacing. Pick the take where narration fills the wait most naturally without dead air.

---

## Narration Options

### Option A — Live voice during recording (fastest)
Record through mic while OBS captures screen. One file, no sync needed.
- Best for: people comfortable with live narration, deadline pressure

### Option B — Screen first, voice after
Record screen in OBS (mic muted). Record voice separately in Audacity or directly in DaVinci Resolve while watching the video. Sync in editing.
- Best for: maximum control over both takes independently

### Option C — AI voiceover via ElevenLabs (most polished)
1. Go to elevenlabs.io — free tier ~10 min/month
2. Voice: **"Adam"** or **"Antoni"** (clear, neutral, authoritative)
3. Paste each scene's narration as a separate clip for easier sync
4. Download MP3s, import into DaVinci, align to video
- Best for: highest production value with 2–3 hours available

**Recommendation:** Option C. The narration in this script is dense and technical. AI voice delivers it cleanly with no stumbles. ElevenLabs free tier is sufficient for a 2-minute video.

---

## Editing (DaVinci Resolve — Free)

Download from blackmagicdesign.com. Create project "Litt Demo."

### Workflow

1. **Import** OBS recording + audio files (if Option B/C) into Media Pool
2. **Drag** best screen recording take to Timeline
3. **Timeline settings:** 1920x1080, 30fps
4. **Trim** head (2s buffer) and tail. Hard cap: 1:58–1:59 after render
5. **Sync audio** (Option B/C): align narration to visual action frame-precisely
   - "Coordinator dispatches sub-agents" → aligns to click of Run Closeout
   - "Rivera, SOURCE CONFLICT" → aligns to Rivera card appearing in timeline
6. **Set audio level:** narration at -12dB peak. Background music at -25dB if used.

### Lower-third labels (recommended — judges notice technical callouts)

Drag "Text+" from Effects Library onto video track. Small, bottom-left, 2–4 second duration each:

| Label text | When to show |
|---|---|
| `Google ADK — Coordinator + 4 Sub-Agents` | 0:18 — sweep starts |
| `MCP-compatible Gmail + Calendar adapters` | ~0:45 — comms sub-agent mentioned |
| `classify_signal() → SignalType enum` | ~0:25 — routing explained |
| `Gemini 2.5 Pro — live date extraction` | When Rivera appears in brief |
| `SOURCE CONFLICT — escalated, not auto-applied` | Rivera modal open |
| `CREATE-only · tier: legal_defensibility` | AuditEventDrawer visible |
| `SAFE → auto-applied · JUDGMENT → held` | Maintenance panel at start |

### Title card

Add a **Solid Color** generator at end of timeline. Color: `#0E1118`. Duration: 6 seconds. Overlay "Text+" with title card content. Animate: 0.3s fade in.

### Background music (optional)

YouTube Audio Library → filter Mood: Calm, Genre: Ambient. Import, set to -25dB, fade in/out over 3 seconds at start/end.

### Export

Deliver tab → Format: MP4, Codec: H.264, 1920x1080, 30fps, 50,000 kbps max. Render.

---

## Professional Polish Checklist

- [ ] No browser chrome visible (bookmarks bar hidden)
- [ ] Demo banner `DEMO MODE — strand-okafor — 2026-06-25` readable at start
- [ ] Maintenance panel "APPLIED AUTOMATICALLY" rows clearly readable at 0:00
- [ ] `audit_event_id` + tier readable in AuditEventDrawer (zoom in if blurry)
- [ ] ADK/Gemini lower-third labels present for key architectural moments
- [ ] Title card includes "Track 1 — Net-New Agents" and full stack
- [ ] Total runtime ≤ 1:59 (check exact duration before final export)
- [ ] Audio peaks -6dB max, -18dB min
- [ ] File size under 500MB

---

## Submission Checklist

- [ ] Video exported as H.264 MP4, 1920x1080, ≤ 2:00
- [ ] Live Cloud Run URL: `https://litt-dashboard-1073532050878.us-central1.run.app`
- [ ] GitHub repo public: `github.com/emtcmca/litt` — all commits after April 22, 2026
- [ ] `docs/architecture.png` exists and embedded in Devpost description
- [ ] Devpost description explicitly names: Gemini 2.5 Pro via Vertex AI, Google ADK, MCP-compatible adapters, Cloud Run, Firestore
- [ ] Track 1 selected in submission form
- [ ] Third-party disclosures section complete
