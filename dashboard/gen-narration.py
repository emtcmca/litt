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

# ~160 words, ~100s at natural pace (+0%) → atempo ≈ 1.01x at merge (imperceptible).
# Scene alignment (approximate):
#   0:00  — Scene 1: maintenance panel
#   0:12  — Scene 2: /agents trigger
#   0:20  — Scene 3: sweep (narrate architecture over running sweep)
#   0:46  — Scene 4: brief callouts
#   0:57  — Scene 5: Mercer modal
#   1:15  — Scene 6: audit panel
#   1:29  — title card (silent)
NARRATION = """
This is Litt — an autonomous operations agent for small law firms.
Every client update is classified. Safe actions apply automatically.
Anything requiring judgment is held for attorney review.

At the end of each day, Litt runs a sweep. One coordinator, four sub-agents,
on Google ADK with Gemini 2.5 Pro.

Each signal is classified and routed deterministically —
not by asking an AI which agent to call. A Python routing table decides.
Billing, deadlines, client communications, anomalies — each has its own specialist.

Tonight's brief — deadlines, billing flags, anomalies, silent clients.
Every item Litt surfaced, prioritized by urgency.
Mercer is escalating. Acme is over budget. Whitmore hasn't been contacted in sixteen days.

Mercer versus Dunlap. Hard legal deadline, six days out. Source is a court order.
Litt escalated it. Hard legal deadlines always require attorney acknowledgment.
Litt never confirms one automatically.

Behind every decision is a defensible audit trail.
Create only. Before and after state captured. Nothing ever edited or deleted.

Autonomous on operations. Human-gated on legal decisions. Every action logged.
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
