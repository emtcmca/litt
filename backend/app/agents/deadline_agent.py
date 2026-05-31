"""
Deadline sub-agent — scans ACTIVE attorney-verified deadlines, determines
escalation cadence level, logs ESCALATION_SENT deadline events and
Escalation records for deadlines that haven't been escalated at the current level.

Also scans conflict_flagged deadlines (source conflicts requiring AI-assisted
date extraction) and emits ESCALATION observations for attorney review.

Calls tool functions directly (in-process). MCP toolset wiring added in v1.1.
"""

from __future__ import annotations

import json
from datetime import date
from typing import Any, Dict, List, Optional

from app import config
from app.db import collection_ref
from app.models import DeadlineEventType, EscalationType
from app.observability import (
    AgentObservation,
    CommitmentLevel,
    ObservationType,
    generate_observation_id,
)
from app.tools.alerts import log_escalation
from app.tools.deadlines import log_deadline_event

# Escalation cadence: (max_days_out, level_label, priority)
_CADENCE = [
    (0,  "CRITICAL",  5),
    (1,  "1_DAY",     5),
    (3,  "3_DAY",     4),
    (7,  "7_DAY",     4),
    (14, "14_DAY",    3),
]


def _get_escalation_level(days_out: int) -> Optional[tuple]:
    """Returns (label, priority) for days_out, or None if outside all cadence windows."""
    for max_days, label, priority in _CADENCE:
        if days_out <= max_days:
            return label, priority
    return None


def _already_escalated_at_level(firm_id: str, deadline_id: str, level: str) -> bool:
    """
    Check deadline_events for an existing ESCALATION_SENT record at this level.
    Prevents duplicate escalations per sweep run.
    """
    events = collection_ref(firm_id, "deadline_events").stream()
    for doc in events:
        evt = doc.to_dict()
        if (
            evt.get("deadline_id") == deadline_id
            and evt.get("event_type") == DeadlineEventType.ESCALATION_SENT.value
            and evt.get("escalation_level") == level
        ):
            return True
    return False


def _call_gemini_deadline_extraction(
    email_body: str,
    deadline_description: str,
) -> Optional[Dict[str, Any]]:
    """
    Ask Gemini to extract a deadline date from an email body.
    Returns dict with 'extracted_date', 'confidence', 'evidence' — or None on failure.
    Isolated to a single function so tests can mock it easily.
    """
    try:
        import vertexai
        from vertexai.generative_models import GenerativeModel

        vertexai.init(
            project=config.GOOGLE_CLOUD_PROJECT,
            location=config.VERTEX_AI_LOCATION,
        )
        model = GenerativeModel(model_name=config.GEMINI_MODEL)
        prompt = (
            f"A legal deadline '{deadline_description}' may be referenced in this email.\n"
            f"Email:\n{email_body[:2000]}\n\n"
            "If you find a specific deadline date mentioned, reply with JSON only:\n"
            '{"extracted_date": "YYYY-MM-DD", "confidence": 0.0-1.0, "evidence": "exact quote"}\n'
            'If no specific date is found, reply:\n'
            '{"extracted_date": null, "confidence": 0.0, "evidence": ""}'
        )
        resp = model.generate_content(prompt)
        text = resp.text.strip().strip("`").lstrip("json").strip()
        return json.loads(text)
    except Exception:
        return None


class DeadlineAgent:
    """
    Deterministic deadline escalation sweep. Gemini used only for conflict_flagged
    deadline date extraction — all routing and escalation decisions are Python.
    """

    name = "deadline_agent"

    def run(self, firm_id: str, run_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Sweep ACTIVE attorney-verified deadlines (deterministic) plus
        conflict_flagged deadlines (Gemini-assisted extraction).
        Returns a summary dict including 'observations' list for the coordinator.
        """
        observations: List[AgentObservation] = []
        obs_counter = 0

        def _obs(**kwargs) -> AgentObservation:
            nonlocal obs_counter
            obs_counter += 1
            work_kind = kwargs.pop("work_kind", "deterministic")
            return AgentObservation(
                observation_id=generate_observation_id(self.name, obs_counter),
                timestamp=config.get_effective_datetime(),
                agent_name=self.name,
                run_id=run_id,
                work_kind=work_kind,
                **kwargs,
            )

        today = config.get_effective_date()
        matters = {
            doc.id: doc.to_dict()
            for doc in collection_ref(firm_id, "matters").stream()
        }
        clients = {
            doc.id: doc.to_dict()
            for doc in collection_ref(firm_id, "clients").stream()
        }
        all_deadlines = [doc.to_dict() for doc in collection_ref(firm_id, "deadlines").stream()]

        verified = [d for d in all_deadlines if d.get("verification_status") == "attorney_verified" and d.get("status") == "ACTIVE"]
        conflict_flagged = [d for d in all_deadlines if d.get("verification_status") == "conflict_flagged" and d.get("status") == "ACTIVE"]

        observations.append(_obs(
            observation_type=ObservationType.SIGNAL_RECEIVED,
            commitment_level=CommitmentLevel.AUTO_SAFE,
            description=(
                f"Deadline scan: {len(verified)} attorney-verified, "
                f"{len(conflict_flagged)} conflict-flagged"
            ),
            data={
                "verified_count": len(verified),
                "conflict_flagged_count": len(conflict_flagged),
                "firm_id": firm_id,
            },
        ))

        # -----------------------------------------------------------------------
        # Deterministic escalation pass — attorney_verified deadlines
        # -----------------------------------------------------------------------

        escalations_created: List[str] = []
        deadlines_scanned = 0
        hard_legal_obs_emitted = False

        for dl in verified:
            due_raw = dl.get("due_date")
            try:
                due_date = date.fromisoformat(str(due_raw)[:10])
            except (ValueError, TypeError):
                continue

            days_out = (due_date - today).days
            deadlines_scanned += 1

            cadence = _get_escalation_level(days_out)
            if cadence is None:
                continue

            level, priority = cadence
            deadline_id = dl["id"]

            if _already_escalated_at_level(firm_id, deadline_id, level):
                continue

            matter = matters.get(dl.get("matter_id", ""), {})
            client = clients.get(matter.get("client_id", ""), {})
            matter_name = matter.get("name", dl.get("matter_id", ""))
            client_name = client.get("name", matter.get("client_id", ""))
            classification = dl.get("classification", "HARD_LEGAL")

            # Emit one focused HARD_LEGAL observation — the demo anchor for dl-mercer-001.
            if not hard_legal_obs_emitted and classification == "HARD_LEGAL":
                hard_legal_obs_emitted = True
                urgency = f"{days_out} day{'s' if days_out != 1 else ''}" if days_out > 0 else "TODAY"
                observations.append(_obs(
                    observation_type=ObservationType.REASONING,
                    commitment_level=CommitmentLevel.AUTO_SAFE,
                    description=(
                        f"HARD_LEGAL deadline: {dl.get('description', deadline_id)} "
                        f"({client_name}) — {urgency} out, {level} escalation"
                    ),
                    data={
                        "deadline_id": deadline_id,
                        "classification": classification,
                        "days_out": days_out,
                        "level": level,
                        "matter_name": matter_name,
                        "client_name": client_name,
                    },
                    evidence=[deadline_id],
                ))

            idem_evt = f"sweep-dl-evt-{deadline_id}-{level}"
            log_deadline_event(
                firm_id=firm_id,
                deadline_id=deadline_id,
                event_type=DeadlineEventType.ESCALATION_SENT.value,
                actor="system",
                idempotency_key=idem_evt,
                escalation_level=level,
                notes=f"Auto-escalated at {level} cadence by sweep",
            )

            idem_esc = f"sweep-dl-esc-{deadline_id}-{level}"
            urgency_str = f"{days_out} day{'s' if days_out != 1 else ''}" if days_out > 0 else "TODAY"
            outcome = log_escalation(
                firm_id=firm_id,
                escalation_type=EscalationType.DEADLINE.value,
                entity_id=deadline_id,
                routed_to="dana-strand",
                actor="system",
                idempotency_key=idem_esc,
                what_is_happening=(
                    f"{classification.replace('_', ' ')} deadline due in {urgency_str}: "
                    f"{dl.get('description', deadline_id)}"
                ),
                why_it_matters=(
                    f"Deadline for {matter_name} ({client_name}) is at the {level} escalation "
                    f"threshold and has not been confirmed. Missing this deadline may expose "
                    f"the firm to malpractice liability."
                ),
                what_litt_has_done=(
                    f"Logged {level} escalation event on deadline record. "
                    f"No action has been taken that could change the deadline."
                ),
                what_attorney_must_decide=(
                    "Confirm the deadline is on track, request an extension, or dismiss "
                    "with a reason if the deadline has been resolved by other means."
                ),
                risk_level="CRITICAL" if classification == "HARD_LEGAL" and days_out <= 7 else "ELEVATED",
                matter_id=dl.get("matter_id"),
                priority=priority,
            )

            if hasattr(outcome, "entity_id"):
                escalations_created.append(outcome.entity_id)

        # -----------------------------------------------------------------------
        # AI-assisted pass — conflict_flagged deadlines (Rivera demo anchor)
        # -----------------------------------------------------------------------

        for dl in conflict_flagged:
            deadline_id = dl["id"]
            description = dl.get("description", deadline_id)
            email_ref = dl.get("email_reference", "")
            matter = matters.get(dl.get("matter_id", ""), {})
            client = clients.get(matter.get("client_id", ""), {})
            client_name = client.get("name", matter.get("client_id", deadline_id))

            observations.append(_obs(
                observation_type=ObservationType.REASONING,
                commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                description=(
                    f"Source conflict: extracting deadline date from "
                    f"{'email ' + email_ref if email_ref else 'external reference'} for {deadline_id}"
                ),
                work_kind="llm_assisted",
                data={"deadline_id": deadline_id, "email_reference": email_ref},
                evidence=[email_ref] if email_ref else [],
            ))

            # Look up email body from Firestore if reference provided.
            email_body = ""
            if email_ref:
                try:
                    email_doc = collection_ref(firm_id, "source_emails").document(email_ref).get()
                    if email_doc.exists:
                        email_body = email_doc.to_dict().get("body", "")
                except Exception:
                    pass

            extraction = _call_gemini_deadline_extraction(email_body, description) if email_body else None
            confidence = extraction.get("confidence", 0.70) if extraction else 0.70
            extracted_date = extraction.get("extracted_date") if extraction else None
            evidence_text = extraction.get("evidence", "") if extraction else ""

            observations.append(_obs(
                observation_type=ObservationType.ESCALATION,
                commitment_level=CommitmentLevel.ESCALATION,
                description=(
                    f"Deadline unverifiable from firm records: {description} "
                    f"({'extracted ' + extracted_date if extracted_date else 'no confirming court order found'})"
                ),
                work_kind="llm_assisted",
                model_name=config.GEMINI_MODEL if extraction else None,
                confidence=confidence,
                data={
                    "deadline_id": deadline_id,
                    "extracted_date": extracted_date,
                    "evidence_excerpt": evidence_text[:200] if evidence_text else None,
                    "email_reference": email_ref,
                    "conflict_type": "source_mismatch",
                },
                evidence=([email_ref] if email_ref else []) + ([deadline_id]),
                attorney_next_action=(
                    f"Verify {description} ({client_name}) against authoritative court records "
                    f"or confirm directly with opposing counsel."
                ),
            ))

        # -----------------------------------------------------------------------
        # Summary observation
        # -----------------------------------------------------------------------

        total_escalations = len(escalations_created)
        conflict_count = len(conflict_flagged)
        final_level = CommitmentLevel.ESCALATION if (total_escalations > 0 or conflict_count > 0) else CommitmentLevel.AUTO_SAFE

        observations.append(_obs(
            observation_type=ObservationType.RESULT,
            commitment_level=final_level,
            description=(
                f"Deadline scan complete: {deadlines_scanned} verified scanned, "
                f"{total_escalations} escalation(s) logged, "
                f"{conflict_count} conflict(s) requiring attorney review"
            ),
            data={
                "deadlines_scanned": deadlines_scanned,
                "escalations_created": total_escalations,
                "conflict_flagged": conflict_count,
            },
        ))

        return {
            "agent": self.name,
            "deadlines_scanned": deadlines_scanned,
            "escalations_created": total_escalations,
            "escalation_ids": escalations_created,
            "observations": observations,
        }
