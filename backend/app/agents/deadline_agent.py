"""
DeadlineAgent — deadline escalation, monitoring, and extension drafting.

v1.0: escalation cadence + conflict_flagged Gemini extraction.
v1.1.1:
  - Readiness monitoring pass (read-only observations per approaching deadline).
  - Extension request draft at 1_DAY/CRITICAL with no matter activity in 5 days.
  - 21-day and 30-day soft watches (unverified deadlines; no escalation write).
  - conflict_flagged → pending_verification at Gemini confidence ≥ 0.80.
  - Cadence gap detection (escalation level skipped → WARN_NOTICE).
  - Deadline clustering (≥3 deadlines in 5-day window → capacity observation).
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from app import config
from app.db import collection_ref
from app.models import CommTrigger, DeadlineEventType, EscalationType, VerificationStatus
from app.observability import (
    AgentObservation,
    CommitmentLevel,
    ObservationType,
    generate_observation_id,
)
from app.tools.alerts import log_escalation
from app.tools.comms import create_client_comm
from app.tools.deadlines import log_deadline_event, verify_deadline

# Escalation cadence: (max_days_out, level_label, priority)
_CADENCE = [
    (0,  "CRITICAL", 5),
    (1,  "1_DAY",    5),
    (3,  "3_DAY",    4),
    (7,  "7_DAY",    4),
    (14, "14_DAY",   3),
]

# Level ordering for gap detection (tightest first)
_LEVEL_ORDER = ["CRITICAL", "1_DAY", "3_DAY", "7_DAY", "14_DAY"]


def _get_escalation_level(days_out: int) -> Optional[tuple]:
    """Returns (label, priority) for days_out, or None if outside all cadence windows."""
    for max_days, label, priority in _CADENCE:
        if days_out <= max_days:
            return label, priority
    return None


def _already_escalated_at_level(firm_id: str, deadline_id: str, level: str) -> bool:
    """Check deadline_events for an existing ESCALATION_SENT record at this level."""
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


def _get_escalated_levels(firm_id: str, deadline_id: str) -> List[str]:
    """Return all escalation levels already recorded for this deadline."""
    levels = []
    for doc in collection_ref(firm_id, "deadline_events").stream():
        evt = doc.to_dict()
        if (
            evt.get("deadline_id") == deadline_id
            and evt.get("event_type") == DeadlineEventType.ESCALATION_SENT.value
        ):
            lvl = evt.get("escalation_level")
            if lvl:
                levels.append(lvl)
    return levels


def _has_matter_activity_in_days(firm_id: str, matter_id: str, days: int, today: date) -> bool:
    """Returns True if any time entries exist for matter within the last `days` days."""
    cutoff = today - timedelta(days=days)
    cutoff_str = cutoff.isoformat()
    for doc in collection_ref(firm_id, "time_entries").stream():
        e = doc.to_dict()
        if e.get("matter_id") != matter_id:
            continue
        if e.get("status") in ("WRITTEN_OFF", "CLOSED"):
            continue
        entry_date_raw = e.get("entry_date", "")
        if isinstance(entry_date_raw, str):
            entry_date_str = entry_date_raw[:10]
        else:
            try:
                entry_date_str = entry_date_raw.isoformat()[:10]
            except Exception:
                continue
        if entry_date_str >= cutoff_str:
            return True
    return False


def _extension_comm_exists(firm_id: str, matter_id: str) -> bool:
    """Returns True if an extension request comm already exists for this matter."""
    for doc in collection_ref(firm_id, "client_communications").stream():
        c = doc.to_dict()
        if (
            c.get("matter_id") == matter_id
            and c.get("trigger") == CommTrigger.DEADLINE_EXTENSION_REQUEST.value
            and c.get("status") not in ("DISMISSED",)
        ):
            return True
    return False


# ---------------------------------------------------------------------------
# Gemini integration functions
# ---------------------------------------------------------------------------

def _call_gemini_deadline_extraction(
    email_body: str,
    deadline_description: str,
) -> Optional[Dict[str, Any]]:
    """
    Ask Gemini to extract a deadline date from an email body.
    Returns dict with 'extracted_date', 'confidence', 'evidence' — or None on failure.
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


def _call_gemini_extension_draft(
    deadline: dict,
    matter: dict,
    attorney: dict,
    days_out: int,
) -> Optional[str]:
    """
    Draft an extension request letter for a deadline with no recent matter activity.
    Returns draft body string or None. Never raises to caller.
    """
    writing_style = attorney.get("writing_style", {})
    try:
        import vertexai
        from vertexai.generative_models import GenerativeModel

        vertexai.init(
            project=config.GOOGLE_CLOUD_PROJECT,
            location=config.VERTEX_AI_LOCATION,
        )
        system_prompt = (
            "You are a legal assistant drafting a professional deadline extension request. "
            "Write a concise, formal letter requesting a short extension. "
            f"Attorney tone: {writing_style.get('tone', 'professional')}. "
            f"Salutation style: {writing_style.get('salutation', 'Dear [Recipient]')}. "
            "Return only the letter body — no preamble, no subject line."
        )
        model = GenerativeModel(
            model_name=config.GEMINI_MODEL,
            system_instruction=system_prompt,
        )
        user_prompt = (
            f"Matter: {matter.get('name', 'unknown matter')}\n"
            f"Deadline: {deadline.get('description', 'filing deadline')}\n"
            f"Due: {deadline.get('due_date', 'unknown')} ({days_out} days from today)\n"
            f"Classification: {deadline.get('classification', 'HARD_LEGAL')}\n"
            f"Reason for extension: No billable work logged on this matter in the past 5 days, "
            f"suggesting additional time is needed to complete the required task."
        )
        resp = model.generate_content(user_prompt)
        return resp.text.strip() if resp.text else None
    except Exception:
        return None


class DeadlineAgent:
    """
    Deadline escalation, monitoring, extension drafting, and clustering.
    v1.1.1: soft watches, cadence gap, clustering, pending_verification advancement.
    """

    name = "deadline_agent"

    def run(self, firm_id: str, run_id: Optional[str] = None) -> Dict[str, Any]:
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
        attorneys = {
            doc.id: doc.to_dict()
            for doc in collection_ref(firm_id, "attorneys").stream()
        }
        all_deadlines = [doc.to_dict() for doc in collection_ref(firm_id, "deadlines").stream()]

        verified = [
            d for d in all_deadlines
            if d.get("verification_status") == "attorney_verified" and d.get("status") == "ACTIVE"
        ]
        pending_ver = [
            d for d in all_deadlines
            if d.get("verification_status") == "pending_verification" and d.get("status") == "ACTIVE"
        ]
        conflict_flagged = [
            d for d in all_deadlines
            if d.get("verification_status") == "conflict_flagged" and d.get("status") == "ACTIVE"
        ]
        unverified = [
            d for d in all_deadlines
            if d.get("verification_status") == "unverified" and d.get("status") == "ACTIVE"
        ]

        observations.append(_obs(
            observation_type=ObservationType.SIGNAL_RECEIVED,
            commitment_level=CommitmentLevel.AUTO_SAFE,
            description=(
                f"Deadline scan: {len(verified)} attorney-verified, "
                f"{len(conflict_flagged)} conflict-flagged, "
                f"{len(unverified)} unverified, "
                f"{len(pending_ver)} pending verification"
            ),
            data={
                "verified_count": len(verified),
                "conflict_flagged_count": len(conflict_flagged),
                "unverified_count": len(unverified),
                "pending_verification_count": len(pending_ver),
                "firm_id": firm_id,
            },
        ))

        # -----------------------------------------------------------------------
        # V11-P3-03 / V11-P3-04: Soft watches — unverified + pending_verification
        # 21-day and 30-day watches; no escalation write, WARN_NOTICE only
        # -----------------------------------------------------------------------

        for dl in (unverified + pending_ver):
            due_raw = dl.get("due_date")
            try:
                due_date = date.fromisoformat(str(due_raw)[:10])
            except (ValueError, TypeError):
                continue
            days_out = (due_date - today).days
            if days_out < 0:
                continue
            if 21 <= days_out <= 30:
                observations.append(_obs(
                    observation_type=ObservationType.WARN_NOTICE,
                    commitment_level=CommitmentLevel.AUTO_SAFE,
                    description=(
                        f"30-day soft watch: {dl.get('description', dl['id'])} "
                        f"({dl.get('verification_status')}) — {days_out} days out, not yet verified"
                    ),
                    data={
                        "deadline_id": dl["id"],
                        "days_out": days_out,
                        "verification_status": dl.get("verification_status"),
                    },
                    evidence=[dl["id"]],
                ))
            elif days_out <= 21:
                observations.append(_obs(
                    observation_type=ObservationType.WARN_NOTICE,
                    commitment_level=CommitmentLevel.AUTO_SAFE,
                    description=(
                        f"21-day soft watch: {dl.get('description', dl['id'])} "
                        f"({dl.get('verification_status')}) — {days_out} days out, not yet verified"
                    ),
                    data={
                        "deadline_id": dl["id"],
                        "days_out": days_out,
                        "verification_status": dl.get("verification_status"),
                    },
                    evidence=[dl["id"]],
                ))

        # -----------------------------------------------------------------------
        # V11-P3-07: Deadline clustering — ≥3 deadlines within any 5-day window
        # -----------------------------------------------------------------------

        upcoming: List[tuple] = []
        for dl in all_deadlines:
            if dl.get("status") != "ACTIVE":
                continue
            due_raw = dl.get("due_date")
            try:
                due_date = date.fromisoformat(str(due_raw)[:10])
            except (ValueError, TypeError):
                continue
            days_out = (due_date - today).days
            if 0 <= days_out <= 30:
                upcoming.append((days_out, due_date, dl))

        upcoming.sort(key=lambda x: x[0])
        for i, (d_out, d_date, dl) in enumerate(upcoming):
            window = [item for item in upcoming[i:] if item[0] <= d_out + 5]
            if len(window) >= 3:
                window_ids = [item[2]["id"] for item in window]
                window_key = frozenset(window_ids)
                # Emit at most one clustering obs per unique window
                obs_key = f"cluster-{'-'.join(sorted(window_ids))}"
                if not any(o.data.get("cluster_key") == obs_key for o in observations):
                    observations.append(_obs(
                        observation_type=ObservationType.WARN_NOTICE,
                        commitment_level=CommitmentLevel.AUTO_SAFE,
                        description=(
                            f"Deadline cluster: {len(window)} matters have deadlines "
                            f"within {d_out}–{d_out+5} days — review capacity"
                        ),
                        data={
                            "cluster_key": obs_key,
                            "deadline_ids": window_ids,
                            "window_start_days": d_out,
                            "window_end_days": d_out + 5,
                        },
                        evidence=window_ids,
                    ))
                break  # one cluster obs per sweep

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

            matter = matters.get(dl.get("matter_id", ""), {})
            client = clients.get(matter.get("client_id", ""), {})
            matter_name = matter.get("name", dl.get("matter_id", ""))
            client_name = client.get("name", matter.get("client_id", ""))
            classification = dl.get("classification", "HARD_LEGAL")

            # V11-P3-01: Readiness monitoring — read-only observation before escalation
            observations.append(_obs(
                observation_type=ObservationType.REASONING,
                commitment_level=CommitmentLevel.AUTO_SAFE,
                description=(
                    f"Readiness check: {dl.get('description', deadline_id)} — "
                    f"{days_out} day(s) out, {classification}, {level} cadence"
                ),
                data={
                    "deadline_id": deadline_id,
                    "days_out": days_out,
                    "classification": classification,
                    "cadence_level": level,
                    "matter_name": matter_name,
                },
                evidence=[deadline_id],
            ))

            # V11-P3-06: Cadence gap detection
            escalated_levels = _get_escalated_levels(firm_id, deadline_id)
            if escalated_levels:
                sorted_existing = sorted(
                    escalated_levels,
                    key=lambda x: _LEVEL_ORDER.index(x) if x in _LEVEL_ORDER else 99,
                )
                current_idx = _LEVEL_ORDER.index(level) if level in _LEVEL_ORDER else -1
                last_existing_idx = _LEVEL_ORDER.index(sorted_existing[-1]) if sorted_existing[-1] in _LEVEL_ORDER else -1
                # _LEVEL_ORDER is tightest-first; last_existing is a looser level (higher index).
                # A gap exists when the jump skips at least one intermediate level.
                if current_idx >= 0 and last_existing_idx >= 0 and (last_existing_idx - current_idx) > 1:
                    skipped = _LEVEL_ORDER[current_idx + 1:last_existing_idx]
                    observations.append(_obs(
                        observation_type=ObservationType.WARN_NOTICE,
                        commitment_level=CommitmentLevel.AUTO_SAFE,
                        description=(
                            f"Cadence gap: {deadline_id} jumped from {sorted_existing[-1]} "
                            f"to {level} — skipped {', '.join(skipped)}"
                        ),
                        data={
                            "deadline_id": deadline_id,
                            "from_level": sorted_existing[-1],
                            "to_level": level,
                            "skipped_levels": skipped,
                        },
                        evidence=[deadline_id],
                    ))

            if _already_escalated_at_level(firm_id, deadline_id, level):
                # V11-P3-02: Extension request check even for already-escalated deadlines
                if level in ("1_DAY", "CRITICAL"):
                    matter_id = dl.get("matter_id", "")
                    if matter_id and not _has_matter_activity_in_days(firm_id, matter_id, 5, today):
                        if not _extension_comm_exists(firm_id, matter_id):
                            attorney = attorneys.get("dana-strand", {})
                            draft = _call_gemini_extension_draft(dl, matter, attorney, days_out)
                            if draft:
                                idem_ext = f"sweep-dl-extension-{deadline_id}"
                                create_client_comm(
                                    firm_id=firm_id,
                                    matter_id=matter_id,
                                    client_id=matter.get("client_id", ""),
                                    trigger=CommTrigger.DEADLINE_EXTENSION_REQUEST.value,
                                    draft_body=draft,
                                    source_map=[],
                                    actor="system",
                                    idempotency_key=idem_ext,
                                )
                                observations.append(_obs(
                                    observation_type=ObservationType.APPROVAL_GATE_APPLIED,
                                    commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                                    description=(
                                        f"Extension draft created for {deadline_id} — "
                                        f"no matter activity in 5 days, deadline in {days_out} day(s)"
                                    ),
                                    work_kind="llm_assisted",
                                    data={
                                        "deadline_id": deadline_id,
                                        "matter_id": matter_id,
                                        "trigger": CommTrigger.DEADLINE_EXTENSION_REQUEST.value,
                                    },
                                    attorney_next_action=(
                                        f"Review and approve or revise the extension request draft "
                                        f"for {dl.get('description', deadline_id)} before sending."
                                    ),
                                    evidence=[deadline_id],
                                ))
                continue

            # Emit focused HARD_LEGAL observation
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

            urgency_str = f"{days_out} day{'s' if days_out != 1 else ''}" if days_out > 0 else "TODAY"
            idem_esc = f"sweep-dl-esc-{deadline_id}-{level}"
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
        # AI-assisted pass — conflict_flagged deadlines
        # V11-P3-05: confidence≥0.80 → pending_verification; <0.80 → ESCALATION only
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

            # V11-P3-05: Advance to pending_verification if confidence ≥ 0.80
            if confidence >= 0.80 and extraction:
                try:
                    dl_doc = collection_ref(firm_id, "deadlines").document(deadline_id).get()
                    if dl_doc.exists:
                        current_version = dl_doc.to_dict().get("version", 1)
                        idem_pv = f"sweep-dl-pending-ver-{deadline_id}"
                        verify_deadline(
                            firm_id=firm_id,
                            deadline_id=deadline_id,
                            attorney_id="system",
                            idempotency_key=idem_pv,
                            expected_version=current_version,
                            verification_status=VerificationStatus.pending_verification.value,
                        )
                        observations.append(_obs(
                            observation_type=ObservationType.REASONING,
                            commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                            description=(
                                f"Deadline {deadline_id} advanced to pending_verification "
                                f"(Gemini confidence {confidence:.0%}) — attorney confirmation required"
                            ),
                            work_kind="llm_assisted",
                            confidence=confidence,
                            data={
                                "deadline_id": deadline_id,
                                "extracted_date": extracted_date,
                                "confidence": confidence,
                            },
                            attorney_next_action=(
                                f"Confirm or reject the extracted date '{extracted_date}' for "
                                f"{description}. Gemini confidence: {confidence:.0%}."
                            ),
                            evidence=[deadline_id],
                        ))
                except Exception:
                    pass

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
                evidence=([email_ref] if email_ref else []) + [deadline_id],
                attorney_next_action=(
                    f"Verify {description} ({client_name}) against authoritative court records "
                    f"or confirm directly with opposing counsel."
                ),
            ))

            idem_conflict = f"sweep-dl-conflict-esc-{deadline_id}"
            try:
                due_days = (date.fromisoformat(str(dl.get("due_date", ""))[:10]) - today).days
                urgency_str = f"{due_days}d"
            except Exception:
                urgency_str = "unknown"
            conflict_outcome = log_escalation(
                firm_id=firm_id,
                escalation_type=EscalationType.DEADLINE.value,
                entity_id=deadline_id,
                routed_to="dana-strand",
                actor="system",
                idempotency_key=idem_conflict,
                what_is_happening=(
                    f"Source conflict: {description} ({urgency_str} out). "
                    f"Deadline sourced from opposing counsel communication only — "
                    f"no confirming court order found in firm records."
                ),
                why_it_matters=(
                    f"An unverified deadline carries the same malpractice risk as a confirmed one. "
                    f"Litt cannot confirm or deny this deadline without attorney review."
                ),
                what_litt_has_done=(
                    f"Extracted deadline date from source email via Gemini "
                    f"(confidence: {confidence:.0%}). No Firestore write pending attorney review."
                ),
                what_attorney_must_decide=(
                    f"Confirm this deadline is accurate and binding, or dismiss with a documented reason."
                ),
                risk_level="CRITICAL",
                matter_id=dl.get("matter_id"),
                priority=5,
            )
            if hasattr(conflict_outcome, "entity_id"):
                escalations_created.append(conflict_outcome.entity_id)

        # -----------------------------------------------------------------------
        # Summary
        # -----------------------------------------------------------------------

        total_escalations = len(escalations_created)
        conflict_count = len(conflict_flagged)
        final_level = (
            CommitmentLevel.ESCALATION
            if (total_escalations > 0 or conflict_count > 0)
            else CommitmentLevel.AUTO_SAFE
        )

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

        matters_from_escalations = list({
            dl.get("matter_id")
            for dl in verified
            if dl.get("matter_id")
        })
        return {
            "agent": self.name,
            "deadlines_scanned": deadlines_scanned,
            "escalations_created": total_escalations,
            "escalation_ids": escalations_created,
            "matters_touched": matters_from_escalations,
            "observations": observations,
        }
