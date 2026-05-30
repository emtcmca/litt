"""
Static fixture data for demo mode ingestion.
Simulates what Gmail and Calendar parsing would produce in production.
All dates anchored to LITT_DEMO_DATE = 2026-05-29.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import date
from typing import List, Optional


@dataclass
class DeadlineCandidate:
    """Structured output from Gmail or Calendar parsing."""
    source_system: str        # "gmail" | "calendar"
    source_id: str            # email message ID or calendar event ID
    extracted_date: date
    description: str
    matter_id: Optional[str]
    source_excerpt: str
    confidence: float         # 0.0–1.0
    potential_injection_detected: bool = False

    @property
    def source_hash(self) -> str:
        """Deterministic hash for deduplication. Same signal = same hash."""
        raw = f"{self.source_id}|deadline_candidate|{self.extracted_date.isoformat()}"
        return hashlib.sha256(raw.encode()).hexdigest()[:32]


# ---------------------------------------------------------------------------
# Gmail fixtures — simulates what GMAIL_EXTRACTION_SYSTEM_PROMPT would return
# ---------------------------------------------------------------------------

DEMO_GMAIL_FIXTURES: dict[str, List[DeadlineCandidate]] = {
    "strand-okafor": [
        DeadlineCandidate(
            source_system="gmail",
            source_id="gmail-court-order-20260508",
            extracted_date=date(2026, 6, 4),
            description="Opposition to defendant's motion for summary judgment due",
            matter_id="mercer-v-dunlap",
            source_excerpt=(
                "Plaintiff's opposition to defendant's motion for summary judgment "
                "shall be filed no later than June 4, 2026."
            ),
            confidence=0.97,
        ),
        DeadlineCandidate(
            source_system="gmail",
            source_id="email-reyes-loi-20260518",
            extracted_date=date(2026, 6, 9),
            description="LOI acceptance window closes — counterparty signature required",
            matter_id="reyes-acquisition",
            source_excerpt=(
                "Acceptance of this Letter of Intent must be executed and returned "
                "no later than June 9, 2026."
            ),
            confidence=0.91,
        ),
    ]
}

# ---------------------------------------------------------------------------
# Calendar fixtures — simulates what Calendar event parsing would return
# ---------------------------------------------------------------------------

DEMO_CALENDAR_FIXTURES: dict[str, List[DeadlineCandidate]] = {
    "strand-okafor": [
        DeadlineCandidate(
            source_system="calendar",
            source_id="cal-event-mercer-opposition-20260604",
            extracted_date=date(2026, 6, 4),
            description="Mercer — File opposition to MSJ",
            matter_id="mercer-v-dunlap",
            source_excerpt="Mercer v. Dunlap — File opposition to motion for summary judgment",
            confidence=0.85,
        ),
    ]
}
