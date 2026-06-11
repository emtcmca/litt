"""
gen-narration.py — generate demo narration MP3 via edge-tts (no API key needed)
Voice: en-US-AndrewNeural (clear, authoritative, technical)
Output: dashboard/demo-narration.mp3
"""

import asyncio
import edge_tts
import os

VOICE = "en-US-AndrewNeural"
RATE  = "+0%"   # natural pace; atempo in merge handles length fit

# ~195 words, ~86s at natural pace (+0%).
# Scene alignment (approximate):
#   0:00  — Scene 1: /brief, 11 decisions shown
#   0:15  — Scene 2: Mercer modal opens
#   0:37  — Scene 3: close modal, navigate to /agents
#   0:48  — Scene 4: Run Closeout clicked, sweep runs
#   1:09  — Scene 6: /splash (narration winds down, silent outro)
NARRATION = """
Eleven decisions. Six critical. Every morning, Litt surfaces what needs attorney attention
before the window closes.

Mercer v. Dunlap. Hard legal deadline. Six days out. Unconfirmed.
The source evidence is right there, opposing counsel's email, extracted and surfaced automatically.

Every action an attorney takes creates an immutable audit entry.
Create only. Tier: legal defensibility. Before and after state.
Append only at the Firestore security rule layer.

One coordinator. Four sub-agents on Google ADK. Running it now.

classify signal, a deterministic Python function, returns a signal type enum.
Gemini is never asked which agent to call. Routing is a Python dict.

Billing sub-agent: seven pre-bill scrubber rules, forbidden phrases, round-hour anomalies, missing narratives.
Deadline sub-agent: escalation fires on any hard legal deadline without attorney acknowledgment inside the window.
Comms sub-agent: source-grounded client update drafts via Gemini.
Anomaly sub-agent: thirteen deterministic detectors, severity-scored.

State machine transitions enforced by valid transitions.
Every Firestore write goes through the tool layer. Agents never write directly.

Google ADK. Gemini 2.5 Pro via Vertex AI. Cloud Run. Firestore.
One coordinator. Four specialists. Deterministic gates. Every decision logged.

Litt.
"""

OUTPUT = os.path.join(os.path.dirname(__file__), "demo-narration.mp3")

async def main():
    print(f"Voice:  {VOICE}")
    print(f"Rate:   {RATE}")
    print(f"Output: {OUTPUT}")
    print("Generating...")

    communicate = edge_tts.Communicate(NARRATION.strip(), VOICE, rate=RATE)
    await communicate.save(OUTPUT)

    size_kb = os.path.getsize(OUTPUT) // 1024
    print(f"Done — {size_kb} KB")

asyncio.run(main())
