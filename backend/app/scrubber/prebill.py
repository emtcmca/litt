"""
Prebill scrubber — 8 deterministic checks run before any invoice is generated.
run_prebill_checks() is a pure function (no Firestore) — takes dicts, returns flags.
run_prebill_scrubber() loads data from Firestore and calls run_prebill_checks().
"""

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Dict, List, Optional

from app.db import collection_ref


# ---------------------------------------------------------------------------
# Output types
# ---------------------------------------------------------------------------

@dataclass
class ScrubberFlag:
    entry_id: str
    check_name: str
    severity: str          # "BLOCK" | "WARN"
    message: str
    matched_text: Optional[str] = None


@dataclass
class ScrubberResult:
    entry_id: str
    flags: List[ScrubberFlag] = field(default_factory=list)

    @property
    def has_block(self) -> bool:
        return any(f.severity == "BLOCK" for f in self.flags)

    @property
    def has_warn(self) -> bool:
        return any(f.severity == "WARN" for f in self.flags)

    @property
    def clean(self) -> bool:
        return len(self.flags) == 0


# ---------------------------------------------------------------------------
# Pure check functions (no Firestore)
# ---------------------------------------------------------------------------

def _check_missing_narrative(entry: dict) -> Optional[ScrubberFlag]:
    """BLOCK: no narrative on a billable entry."""
    narrative = entry.get("narrative")
    if not narrative or not str(narrative).strip():
        return ScrubberFlag(
            entry_id=entry["id"],
            check_name="missing_narrative",
            severity="BLOCK",
            message="Entry has no narrative. Narrative required before billing.",
        )
    return None


def _check_forbidden_phrases(entry: dict, client: dict) -> List[ScrubberFlag]:
    """BLOCK: narrative contains a phrase listed in client billing guidelines."""
    narrative = entry.get("narrative") or ""
    guidelines = client.get("billing_guidelines") or {}
    forbidden = guidelines.get("forbidden_phrases") or []
    flags = []
    for phrase in forbidden:
        if phrase.lower() in narrative.lower():
            flags.append(ScrubberFlag(
                entry_id=entry["id"],
                check_name="forbidden_phrase",
                severity="BLOCK",
                message=f"Narrative contains forbidden phrase: '{phrase}'",
                matched_text=phrase,
            ))
    return flags


def _check_round_hour_anomaly(entry: dict) -> Optional[ScrubberFlag]:
    """WARN: hours are a whole number but session_minutes_actual is absent."""
    hours = float(entry.get("hours", 0))
    session_minutes = entry.get("session_minutes_actual")
    if hours == int(hours) and hours > 0 and session_minutes is None:
        return ScrubberFlag(
            entry_id=entry["id"],
            check_name="round_hour_anomaly",
            severity="WARN",
            message=f"Hours are a round number ({hours:.1f}) with no session timer data. Verify accuracy.",
        )
    return None


def _check_excessive_hours(entry: dict, client: dict) -> Optional[ScrubberFlag]:
    """WARN: single entry hours exceed client's max_daily_hours_without_review."""
    hours = float(entry.get("hours", 0))
    guidelines = client.get("billing_guidelines") or {}
    max_hours = float(guidelines.get("max_daily_hours_without_review", 8.0))
    if hours > max_hours:
        return ScrubberFlag(
            entry_id=entry["id"],
            check_name="excessive_hours",
            severity="WARN",
            message=f"Entry hours ({hours:.1f}) exceed client max ({max_hours:.1f}) — requires review.",
        )
    return None


def _check_block_billing(entry: dict, client: dict) -> Optional[ScrubberFlag]:
    """WARN: narrative likely contains multiple tasks when block billing is disallowed."""
    guidelines = client.get("billing_guidelines") or {}
    if guidelines.get("block_billing_allowed", True):
        return None
    narrative = entry.get("narrative") or ""
    # Heuristic: semicolons separating task phrases indicate block billing
    if "; " in narrative and len(narrative.split("; ")) > 1:
        return ScrubberFlag(
            entry_id=entry["id"],
            check_name="block_billing",
            severity="WARN",
            message="Narrative may contain block billing (multiple tasks in one entry). Client prohibits block billing.",
            matched_text=narrative[:120],
        )
    return None


def _check_missing_task_code(entry: dict, client: dict) -> Optional[ScrubberFlag]:
    """BLOCK: task_code absent when client requires it."""
    guidelines = client.get("billing_guidelines") or {}
    if not guidelines.get("required_task_codes", False):
        return None
    if not entry.get("task_code"):
        return ScrubberFlag(
            entry_id=entry["id"],
            check_name="missing_task_code",
            severity="BLOCK",
            message="Client requires UTBMS task code — task_code is missing.",
        )
    return None


def _check_missing_activity_code(entry: dict, client: dict) -> Optional[ScrubberFlag]:
    """BLOCK: activity_code absent when client requires it."""
    guidelines = client.get("billing_guidelines") or {}
    if not guidelines.get("activity_codes_required", False):
        return None
    if not entry.get("activity_code"):
        return ScrubberFlag(
            entry_id=entry["id"],
            check_name="missing_activity_code",
            severity="BLOCK",
            message="Client requires ABA activity code — activity_code is missing.",
        )
    return None


def _check_ai_disclosure(entry: dict) -> Optional[ScrubberFlag]:
    """BLOCK: AI-assisted entry missing required disclosure status."""
    if not entry.get("ai_assisted", False):
        return None
    if not entry.get("client_ai_disclosure_required", False):
        return None
    disclosure_status = entry.get("client_ai_disclosure_status")
    if not disclosure_status:
        return ScrubberFlag(
            entry_id=entry["id"],
            check_name="ai_disclosure_missing",
            severity="BLOCK",
            message="AI-assisted entry requires client disclosure status — client_ai_disclosure_status is not set.",
        )
    return None


# ---------------------------------------------------------------------------
# Pure aggregate function
# ---------------------------------------------------------------------------

def run_prebill_checks(entry: dict, client: dict) -> ScrubberResult:
    """
    Run all 8 checks against a single time entry dict and its client dict.
    Pure function — no Firestore. Safe to call in tests with synthetic data.
    """
    result = ScrubberResult(entry_id=entry["id"])

    checks = [
        _check_missing_narrative(entry),
        *_check_forbidden_phrases(entry, client),
        _check_round_hour_anomaly(entry),
        _check_excessive_hours(entry, client),
        _check_block_billing(entry, client),
        _check_missing_task_code(entry, client),
        _check_missing_activity_code(entry, client),
        _check_ai_disclosure(entry),
    ]

    result.flags = [c for c in checks if c is not None]
    return result


# ---------------------------------------------------------------------------
# Firestore-backed runner
# ---------------------------------------------------------------------------

def run_prebill_scrubber(firm_id: str, entry_ids: List[str]) -> List[ScrubberResult]:
    """
    Load entries and their clients from Firestore, run all 8 checks per entry.
    Returns one ScrubberResult per entry_id.
    """
    results = []
    client_cache: Dict[str, dict] = {}

    for entry_id in entry_ids:
        entry_doc = collection_ref(firm_id, "time_entries").document(entry_id).get()
        if not entry_doc.exists:
            results.append(ScrubberResult(
                entry_id=entry_id,
                flags=[ScrubberFlag(
                    entry_id=entry_id,
                    check_name="entry_not_found",
                    severity="BLOCK",
                    message=f"Entry {entry_id} not found in Firestore.",
                )],
            ))
            continue

        entry = entry_doc.to_dict()
        client_id = entry.get("client_id", "")

        if client_id not in client_cache:
            client_doc = collection_ref(firm_id, "clients").document(client_id).get()
            client_cache[client_id] = client_doc.to_dict() if client_doc.exists else {}

        client = client_cache[client_id]
        results.append(run_prebill_checks(entry, client))

    return results
