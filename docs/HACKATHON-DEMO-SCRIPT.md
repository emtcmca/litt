# Litt — Hackathon Demo Script v2.0

**Hard cap:** 2:00 (contest rule)  
**Demo firm:** Strand & Okafor LLP (`strand-okafor`)  
**Demo date anchor:** June 25, 2026 (frozen — `LITT_DEMO_DATE=2026-06-25`)  
**Sweep timing:** ~45–55 seconds (live Gemini calls — fill every second)

---

## What the demo must prove

Judges evaluate on three axes: **agent architecture quality**, **real use of Gemini reasoning**, and **product coherence**. Every second of footage earns one of these or it doesn't belong.

| Scene | What it proves |
|---|---|
| Hook — client roster | Product exists, real UI, real firm context |
| Sweep + narration | ADK multi-agent architecture, Gemini/Python boundary |
| Brief | Agents produced actionable output autonomously |
| Rivera ESCALATION + source email | Gemini reasoning is visible and traceable |
| Verify → audit trail | Legal defensibility — not a chatbot |
| Maintenance panel | Litt operates between sweeps — always watching |
| Title card | Stack callout for judges |

---

## Pre-Recording Checklist

Run these before every take:

```
1. POST /api/demo/reset  OR  click "Reset demo" in toolbar
2. GET /api/demo/ready → all 5 checks must show ok: True
3. Hard-refresh browser → brief shows empty/loading state
4. Navigate to /clients — confirm Mercer row shows at top with pending badge
5. Navigate to Agent Console — confirm timeline is empty, "Run Closeout" visible
6. Mic check — no background noise, no fans
7. Browser: hide bookmarks bar (Ctrl+Shift+B), close dev tools, no extensions visible
```

---

## Scene Map

| Time | Screen | Action | Narration |
|---|---|---|---|
| 0:00–0:09 | `/clients` roster | Establishing shot | Hook lines |
| 0:09–0:19 | Agent Console | Navigate, click Run Closeout | "Dana clicks Run Closeout" |
| 0:19–1:05 | Timeline loading | Sweep running — do not touch | 4 sub-agents narration |
| 1:05–1:20 | Brief | Scroll: Rivera → Acme → Whitmore | "The brief" callout |
| 1:20–1:36 | ResolvePanel | Click Rivera → source email | "Gemini extracted the date" |
| 1:36–1:44 | AuditEventDrawer | Click Verify, hold 2s | "CREATE-only. Immutable." |
| 1:44–1:54 | `/clients/mercer-industries` | Navigate, show maintenance panel | "Between sweeps, Litt maintains every client file" |
| 1:54–2:00 | Title card | Static | Silent or fade music |

---

## Script with Timing Marks

### 0:00–0:09 — Hook

**SCREEN:** `/clients` — roster visible. Mercer at top with red pending badge. Acme, Whitmore, Lindqvist below.

**NARRATOR:**
> "Small law firms don't lose time in one system — they lose it in the gaps between all of them. This is Litt: the autonomous operations layer for Strand & Okafor LLP."

**ACTION:** Hold on roster for 3 seconds, then navigate to Agent Console.

---

### 0:09–0:19 — Setup + trigger

**SCREEN:** Agent Console. Timeline empty. Brief in loading state. Banner: `DEMO MODE — strand-okafor — 2026-06-25`.

**NARRATOR:**
> "Thursday, June 25. End of day. Dana Strand clicks Run Closeout."

**ACTION:** Click Run Closeout button.

---

### 0:19–1:05 — Sweep runs (fill every second)

**SCREEN:** Timeline blank or showing first observation. Do not scroll. Do not click anything.

**NARRATOR:**
> "Litt just dispatched four sub-agents in parallel. The billing agent is scanning time entries against each client's billing guidelines — forbidden phrases, round-hour anomalies, missing narratives. The deadline agent is reading every active deadline — and for Rivera v. Holbrook, it's calling Gemini right now to extract a due date from an opposing counsel email, because no court order exists in firm records. The comms agent is measuring how long since each client heard from the firm. The anomaly agent is scoring patterns across the entire billing surface.
>
> Routing is a Python dictionary — not an LLM deciding which agents to call. Gemini only handles the probabilistic work: extracting dates from unstructured text, drafting client updates. State machine transitions, budget math, anomaly detection — all deterministic Python. That boundary is enforced in the codebase, not in a prompt."

**[~1:02–1:05: Timeline populates — observations animate in]**

---

### 1:05–1:20 — Brief appears

**SCREEN:** Timeline shows `complete`. Brief populated below. Scroll slowly: Rivera → Acme → Whitmore.

**NARRATOR:**
> "The closeout brief. Not a chat summary — these are attorney decisions Litt found autonomously. Rivera v. Holbrook: ESCALATION, SOURCE CONFLICT, due tomorrow. Acme Commercial: 92% of budget — CRITICAL. Whitmore Group: 16 days since last contact."

**ACTION:** Pause 1 second on each section as you name it.

---

### 1:20–1:36 — Rivera deep-dive

**ACTION:** Click Rivera deadline item → ResolvePanel or DeadlineModal opens → click "View source email."

**SCREEN:** Source email body visible. From: jcolbert@colbertmarsh.com. "by tomorrow (Friday), June 26, 2026" visible.

**NARRATOR:**
> "The source. Opposing counsel email — 'by tomorrow, June 26.' No court order in firm records. Gemini extracted that date. Litt shows the evidence, not just the conclusion. It escalated instead of guessing."

---

### 1:36–1:44 — Audit trail

**ACTION:** Click Verify → AuditEventDrawer appears. Hold 2 seconds — `audit_event_id` must be readable.

**NARRATOR:**
> "Dana clicks Verify. Every action — agent and attorney — is a CREATE-only audit entry. Timestamped. Immutable. Before and after state. Fee dispute or malpractice review — the answer is here."

---

### 1:44–1:54 — Client maintenance panel

**ACTION:** Close modal. Navigate to `/clients/mercer-industries`. Scroll to maintenance panel. Both section headers must be visible: "HELD FOR YOUR REVIEW" and "APPLIED AUTOMATICALLY."

**NARRATOR:**
> "Between sweeps, Litt maintains every client file. Safe updates apply automatically and write to the ledger. Judgment calls are held for review. The attorney is always in the loop where it matters."

---

### 1:54–2:00 — Title card

**ACTION:** Cut or fade to title card.

```
Litt
Autonomous Operations for Small Law Firms

Gemini 2.5 Pro · Google ADK · Cloud Run · Firestore

github.com/emtcmca/litt
```

**MUSIC:** Fade out if background track is running.

---

## Pacing Notes

- **The sweep is ~45–55 seconds of real AI running.** Fill every second — silence looks like a broken demo.
- **Rivera is the clearest proof-of-safety moment.** Hold 2–3 seconds on the SOURCE CONFLICT badge when it appears. Do not rush past it.
- **Brief scroll: 1–2 seconds per item.** Three callouts only: Rivera, Acme, Whitmore. Skip everything else.
- **AuditEventDrawer: hold 2 full seconds.** The `audit_event_id` being readable is the legal-grade claim made concrete.
- **Maintenance panel: the section headers are the point.** "HELD FOR YOUR REVIEW" and "APPLIED AUTOMATICALLY" are self-explanatory. One sentence of narration is enough.
- **If sweep finishes faster than expected**, slow your scroll through the timeline observations. Never rush past Rivera.
- **If sweep finishes slower than expected**, pause the narration at the deterministic/probabilistic boundary explanation — expand it. Judges never find this boring.

---

## Key Shots Checklist (verify in post)

- [ ] `/clients` roster — Mercer row at top with pending badge
- [ ] Agent Console — `DEMO MODE — strand-okafor — 2026-06-25` banner visible
- [ ] "Run Closeout" button click visible
- [ ] Timeline loading state (not blank screen — spinner or empty state message)
- [ ] Rivera ESCALATION with amber badge in timeline
- [ ] Rivera `SOURCE CONFLICT` badge in modal header
- [ ] Source email body — from: jcolbert@colbertmarsh.com, "tomorrow (Friday), June 26" readable
- [ ] AuditEventDrawer — `audit_event_id` readable (hold 2s)
- [ ] `/clients/mercer-industries` — "HELD FOR YOUR REVIEW" + "APPLIED AUTOMATICALLY" both visible
- [ ] Title card — stack (Gemini 2.5 Pro, ADK, Cloud Run) legible

---

## Q&A Backup

**"How is this different from a rules engine?"**
Routing and gates are deterministic Python — but sub-agents reason about context. Gemini extracts dates from unstructured email, drafts client updates. Python decides and gates. The boundary is explicit in the codebase.

**"What prevents auto-sending client emails?"**
`comms_agent` returns `BLOCKED`. That's a Python enum from deterministic code, not a prompt instruction. Attorney must approve before delivery. Logged in the audit trail.

**"How do you prevent hallucination?"**
Three ways: (1) routing is a Python dict; (2) Gemini drafts are sourced from structured FactPacket data, not open-ended generation; (3) anomaly detection is rule-based.

**"What's the maintenance panel?"**
Between sweeps, a client review agent runs on each active client. It classifies proposed updates as SAFE (auto-apply) or JUDGMENT (held for attorney). Classification is a deterministic Python dict with Gemini handling narrative-only outputs. Every auto-apply writes an audit entry.

**"What's the stack?"**
Python FastAPI, Google ADK, Gemini 2.5 Pro via Vertex AI, Firestore, React, Cloud Run. Firestore is the only write path — all writes go through the tool layer, every write calls `log_audit_event()`.

---

---

# Production Guide — Recording, Editing, Narration

## Recording Setup (OBS Studio — Windows)

**Why OBS:** Free, professional-grade, outputs clean H.264 MP4, records browser without compression artifacts from window capture.

### 1. Install and configure OBS

1. Download OBS Studio from obsproject.com — install, launch.
2. In OBS: **Settings → Output**
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
1. **Display Capture** — select your monitor
   - OR **Window Capture** → select your browser — this crops to only the browser, cleaner
2. **Audio Input Capture** — select your mic (if recording voice live)

### 3. Prepare your browser before every take

- Open Chrome in **full-screen mode** (F11)
- Hide bookmarks bar: `Ctrl+Shift+B`
- Use a **clean Chrome profile** (no extensions visible, no personal bookmarks)
- Open these tabs in this order (so switching is fast):
  - Tab 1: `http://localhost:3002/clients` (or live URL)
  - Tab 2: `http://localhost:3002/` (Agent Console)
  - Tab 3: `http://localhost:3002/clients/mercer-industries`
- Run `POST /api/demo/reset` + `GET /api/demo/ready` before you start OBS
- Navigate to Tab 1 (`/clients`) — this is your starting frame

### 4. Record

1. Click **Start Recording** in OBS
2. Wait 2 seconds (buffer before you speak) — trim in editing
3. Execute the demo script
4. After title card: wait 2 seconds, then click **Stop Recording**
5. Video saves to your OBS default folder (`C:\Users\tetzl\Videos`)

**Record 3–5 full takes.** You will not nail it on take 1. The sweep timing varies slightly, which affects narration pacing. Pick the take where the narration most naturally fills the loading wait.

---

## Narration Options (choose one)

### Option A — Live voice during recording (fastest)
Record your own voice through your mic while OBS captures the screen. Use a USB headset or standalone USB mic (Blue Yeti, Rode NT-USB, even a headset works).

- Pro: One file, no sync needed
- Con: Any verbal stumble requires a full re-take
- Best for: People comfortable with live narration

### Option B — Screen first, voice after (most takes preserved)
Record screen in OBS with no mic (or mic muted). Then record voice separately in Audacity or directly in DaVinci Resolve while watching the video. Sync audio in editing.

- Pro: Best takes of screen and voice independently selectable
- Con: Requires precise audio sync
- Best for: People who want maximum takes and control

### Option C — AI voiceover via ElevenLabs (most polished)
Generate narration using ElevenLabs after recording the screen. Write the script word-for-word, generate audio, sync in editing.

1. Go to elevenlabs.io — free tier allows ~10 min/month
2. Choose voice: **"Adam"** or **"Antoni"** (clear, neutral, professional)
3. Paste each scene's narration as a separate audio file (makes sync easier)
4. Download MP3s
5. Import into DaVinci Resolve, align to corresponding video sections

- Pro: No vocal stumbles, no mouth noise, perfectly timed
- Con: Requires careful text editing to sound natural
- Best for: Highest production value, not pressed for time

**Recommendation:** Option C if you have 2–3 hours. Option A if you need to ship today.

---

## Editing (DaVinci Resolve — Free)

### Install

Download DaVinci Resolve (free version) from blackmagicdesign.com. Install. Launch. Create a new project: "Litt Demo."

### 1. Import footage

- **Media Pool** (bottom left): right-click → Import Media → select your OBS recording(s)
- If using Option B/C: import your audio file(s) too

### 2. Create timeline

- Drag your best screen recording take to the **Timeline** (bottom panel)
- Set timeline settings: 1920x1080, 30fps

### 3. Trim head and tail

- Trim the 2-second buffer at the start (before you start talking)
- Trim after the title card fades
- **Hard cap: 2:00.** Export at 1:58–1:59 to leave margin for contest upload compression.

### 4. Add audio (if Option B or C)

- Drag audio file(s) onto the timeline on the A2 audio track
- Align narration to the visual action it describes:
  - "Dana clicks Run Closeout" → align to the exact frame you click
  - "Rivera v. Holbrook: ESCALATION" → align to when the Rivera card is visible
- Set mic audio level: around -12dB (not peaking, not quiet)

### 5. Add lower-third labels (optional but professional)

Lower thirds = small text overlays that label what judges are seeing.

In the **Effects Library** search "Text+" — drag onto video track above the main clip. Set:
- Font: Inter or SF Pro (or any clean sans-serif)
- Size: 28–32
- Position: bottom-left, 10% from bottom
- Duration: match the scene it labels (2–4 seconds)

Labels to add:
| Label | When |
|---|---|
| `Google ADK — 4 sub-agents dispatched in parallel` | When sweep starts |
| `Gemini 2.5 Pro — live date extraction from email` | When Rivera section appears in brief |
| `SOURCE CONFLICT — opposing counsel email only` | When Rivera modal opens |
| `CREATE-only audit log — legal defensibility` | When AuditEventDrawer visible |
| `Maintenance Panel — autonomous between sweeps` | When `/clients/mercer-industries` visible |

Keep labels **small, tasteful, bottom-left** — they should reinforce, not obscure.

### 6. Add title card

- Drag a **Solid Color** generator (from Effects Library → Generators) at the end of timeline
- Set color to `#0E1118` (Litt's dark background)
- Duration: 6 seconds
- Add "Text+" over it with the title card content
- Font: Inter Bold for "Litt", Inter Regular for the rest
- Animate: 0.3s fade in from transparent

### 7. Add background music (optional)

Subtle music lifts production value significantly.

1. Go to **YouTube Audio Library** (studio.youtube.com → Audio Library)
2. Filter: Mood → `Calm`, Genre → `Ambient`
3. Download a 2–3 minute ambient track
4. Import into DaVinci, drag to A3 audio track
5. Set volume to **-25dB** — barely audible, atmospheric only
6. Fade in over 3 seconds at start, fade out over 3 seconds before title card ends

### 8. Export

1. Click **Deliver** (bottom rocket icon)
2. Settings:
   - Format: MP4
   - Codec: H.264
   - Resolution: 1920x1080
   - Frame rate: 30
   - Quality: Restrict to 50,000 kbps
3. Click **Add to Render Queue** → **Start Render**
4. Output file goes to your chosen folder

---

## Professional Polish Checklist

Before final export, verify:

- [ ] No browser chrome visible (bookmarks bar hidden, tabs cropped out if using window capture)
- [ ] Demo banner `DEMO MODE — strand-okafor — 2026-06-25` readable in opening frames
- [ ] No mouse cursor lingering over unrelated elements between actions
- [ ] Narration ends cleanly before 1:54 (leaves silence under title card)
- [ ] Rivera `audit_event_id` is readable — if blurry, zoom in on that frame in editing
- [ ] Title card legible — stack text (Gemini 2.5 Pro, ADK, Cloud Run) in smaller font below title
- [ ] Total runtime: ≤ 1:59 (render the timeline, check the exact duration)
- [ ] Audio peaks no higher than -6dB, no lower than -18dB (check in DaVinci's audio meters)
- [ ] File size under 500MB (standard for hackathon uploads)

---

## Submission Checklist

- [ ] Video exported as H.264 MP4, 1920x1080, ≤ 2:00
- [ ] Live Cloud Run URL: `https://litt-dashboard-1073532050878.us-central1.run.app`
- [ ] GitHub repo public: `github.com/emtcmca/litt`
- [ ] All commits after April 22, 2026 (contest rule)
- [ ] `docs/architecture.png` exists and embedded in Devpost description
- [ ] Devpost description references Gemini 2.5 Pro + Google ADK explicitly
- [ ] Third-party disclosures section complete
