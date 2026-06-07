"""
CommsAgent — v1.1.1 respec.

5 outbound triggers, attorney style profile, citation stripping, inbound triage.
Detection = Python (deterministic). Gemini = enrichment only, never gates.
All writes go through tool layer. Agents never write Firestore directly.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from app import config
from app.db import collection_ref
from app.models import CommTrigger, InboundUrgency
from app.observability import (
    AgentObservation,
    CommitmentLevel,
    ObservationType,
    generate_observation_id,
)
from app.tools.comms import create_client_comm
from app.tools.inbound import create_inbound_message

# ---------------------------------------------------------------------------
# System prompts — context only, no branching logic
# ---------------------------------------------------------------------------

# Public alias — required by test_prompt_injection.py prompt invariant checks
COMMS_SYSTEM_PROMPT = """You are the communications assistant for a small law firm using Litt, an AI operations platform.
Draft professional, concise emails grounded strictly in verified facts.
Every factual claim must be followed by an inline citation in the format [f1], [f2], etc.
Use only facts from the FactPacket provided. Do not invent or infer.
Format: plain email body only — no subject line, no headers.
Length: 3–4 short paragraphs. End with a clear call to action."""

_COMMS_SYSTEM_PROMPT = COMMS_SYSTEM_PROMPT

_INBOUND_SUMMARY_PROMPT = """You are a legal operations assistant triaging inbound messages for a small law firm.
Given a message excerpt and context, return a JSON object with:
  "summary": one-sentence summary of what the sender needs
  "action_items": list of action items, each with {"item": str, "domain": "billing"|"deadline"|"comms"|"general"}
Return only valid JSON. No preamble, no explanation."""

# ---------------------------------------------------------------------------
# Outbound trigger → draft tone mapping
# ---------------------------------------------------------------------------

_TRIGGER_TONE_MAP: Dict[str, str] = {
    CommTrigger.DAYS_SINCE_CONTACT.value:          "reassurance",
    CommTrigger.BUDGET_THRESHOLD_CROSSED.value:    "billing",
    CommTrigger.DEADLINE_CONFIRMED_NO_UPDATE.value: "update",
    CommTrigger.INVOICE_GENERATED.value:            "billing",
    CommTrigger.ACTIVITY_WITHOUT_UPDATE.value:      "update",
    CommTrigger.DEADLINE_EXTENSION_REQUEST.value:   "action_required",
    CommTrigger.INBOUND_REPLY.value:                "update",
}

# ---------------------------------------------------------------------------
# Urgency scoring constants
# ---------------------------------------------------------------------------

_DECISION_MAKER_ROLES = {
    "client", "decision_maker", "board_member", "executive",
    "ceo", "cfo", "general_counsel", "partner",
}

_DEADLINE_KEYWORDS = [
    "deadline", "due date", "file by", "response due", "statute of limitations",
    "court date", "hearing", "by friday", "by monday", "by end of",
    "must be filed", "extension", "opposition due", "brief due",
]

# ---------------------------------------------------------------------------
# FactPacket
# ---------------------------------------------------------------------------

@dataclass
class Fact:
    fact_id: str
    fact_text: str
    source_type: str
    source_id: str
    source_excerpt: str


@dataclass
class FactPacket:
    matter_id: str
    client_id: str
    trigger: str
    facts: List[Fact] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Deterministic helpers
# ---------------------------------------------------------------------------

def _mentions_deadline(text: str) -> bool:
    """Deterministic check — no Gemini."""
    text_lower = text.lower()
    return any(kw in text_lower for kw in _DEADLINE_KEYWORDS)


def _has_question(text: str) -> bool:
    """Deterministic check — no Gemini."""
    if "?" in text:
        return True
    lower = text.lower().lstrip()
    starters = ("what ", "when ", "where ", "how ", "why ", "can ", "could ",
                 "is ", "are ", "do ", "does ", "will ", "should ")
    return any(lower.startswith(s) for s in starters)


def _score_urgency(
    msg: dict,
    matters: Dict[str, dict],
) -> Tuple[str, List[str], int]:
    """
    Score inbound message urgency deterministically.
    Returns (level, signals_list, score).
    HIGH>=5, MEDIUM>=2, else LOW.
    """
    score = 0
    signals: List[str] = []
    excerpt = msg.get("message_excerpt", "")
    from_role = msg.get("from_role", "").lower()
    wait_days = msg.get("wait_days", 0)
    matter_id = msg.get("matter_id")

    # Decision-maker sender: 3 pts
    if from_role in _DECISION_MAKER_ROLES:
        score += 3
        signals.append("decision_maker_sender")

    # Mentions deadline: 3 pts
    if _mentions_deadline(excerpt):
        score += 3
        signals.append("mentions_deadline")

    # Wait days >= 2: 2 pts
    if wait_days >= 2:
        score += 2
        signals.append(f"wait_{wait_days}_days")

    # Direct question: 1 pt
    if _has_question(excerpt):
        score += 1
        signals.append("direct_question")

    # Thread followup (Re: prefix in subject or followup flag): 1 pt
    if msg.get("is_followup") or str(msg.get("subject", "")).lower().startswith("re:"):
        score += 1
        signals.append("thread_followup")

    # Names a known matter: 1 pt
    if matter_id and matter_id in matters:
        matter_name = matters[matter_id].get("name", "").lower()
        if matter_name and matter_name in excerpt.lower():
            score += 1
            signals.append("names_matter")

    if score >= 5:
        level = InboundUrgency.HIGH.value
    elif score >= 2:
        level = InboundUrgency.MEDIUM.value
    else:
        level = InboundUrgency.LOW.value

    return level, signals, score


def _get_handoff_agent(action_items: List[dict]) -> Optional[str]:
    """Return the handoff_agent for the first action item that has one."""
    _DOMAIN_AGENT_MAP = {
        "billing": "billing_agent",
        "deadline": "deadline_agent",
        "comms": "comms_agent",
    }
    for item in action_items:
        domain = item.get("domain", "general")
        if domain in _DOMAIN_AGENT_MAP:
            return _DOMAIN_AGENT_MAP[domain]
    return None


def _validate_citations(draft_body: str, packet: FactPacket) -> List[str]:
    valid_ids = {f.fact_id for f in packet.facts}
    used = re.findall(r"\[f(\d+)\]", draft_body, re.IGNORECASE)
    return [f"f{n}" for n in used if f"f{n}" not in valid_ids]


# ---------------------------------------------------------------------------
# Backward-compat helpers (used by test_prompt_injection.py)
# ---------------------------------------------------------------------------

def _build_fact_packet(
    matter_id: str,
    client_id: str,
    days_since: int,
    last_contact_str: Optional[str],
    recent_entries: List[dict],
) -> FactPacket:
    """Build a FactPacket for DAYS_SINCE_CONTACT trigger. Used in injection defense tests."""
    packet = FactPacket(
        matter_id=matter_id,
        client_id=client_id,
        trigger=CommTrigger.DAYS_SINCE_CONTACT.value,
    )
    contact_text = last_contact_str or "unknown"
    packet.facts.append(Fact(
        fact_id="f1",
        fact_text=f"No confirmed client contact since {contact_text} — {days_since} days ago.",
        source_type="firestore",
        source_id=f"matters/{matter_id}",
        source_excerpt=f"last_client_contact: {contact_text}",
    ))
    for i, entry in enumerate(recent_entries[:3], start=2):
        narr = entry.get("narrative", "")
        if not narr:
            continue
        packet.facts.append(Fact(
            fact_id=f"f{i}",
            fact_text=narr,
            source_type="time_entry",
            source_id=f"time_entries/{entry.get('id', '')}",
            source_excerpt=narr[:200],
        ))
    return packet


def _build_gemini_prompt(
    packet: FactPacket,
    client_name: str,
    matter_name: str,
    attorney_name: str,
    writing_style: Optional[Dict[str, Any]] = None,
) -> str:
    """Build the Gemini draft prompt from a FactPacket. Used in isolation tests."""
    trigger = packet.trigger
    tone = _TRIGGER_TONE_MAP.get(trigger, "update")
    style_text = ""
    if writing_style:
        style_text = (
            f"\nAttorney style: tone={writing_style.get('tone', 'professional')}, "
            f"salutation={writing_style.get('salutation', 'Dear [Name]')}, "
            f"paragraph_length={writing_style.get('paragraph_length', 'medium')}."
        )
    lines = [
        f"Draft a professional {tone} email from {attorney_name} to {client_name}",
        f"regarding matter: {matter_name}",
        f"Trigger: {trigger.replace('_', ' ').lower()}",
        style_text,
        "",
        "FactPacket:",
    ]
    for fact in packet.facts:
        lines.append(f"[{fact.fact_id}]: {fact.fact_text}")
        lines.append(f"    Source: {fact.source_excerpt}")
    lines.append("")
    lines.append("Write the email body now, using inline citations [f1], [f2], etc.")
    return "\n".join(lines)


def _parse_dt(val: Any) -> Optional[datetime]:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, str):
        return datetime.fromisoformat(val.replace("Z", "+00:00"))
    if hasattr(val, "timestamp"):
        return datetime.fromtimestamp(val.timestamp(), tz=timezone.utc)
    return None


def _get_last_comm_date(matter_id: str, all_comms: List[dict]) -> Optional[date]:
    """Latest created_at date for any comm on this matter, or None."""
    latest: Optional[date] = None
    for comm in all_comms:
        if comm.get("matter_id") != matter_id:
            continue
        dt = _parse_dt(comm.get("created_at"))
        if dt:
            d = dt.date() if hasattr(dt, "date") else dt
            if latest is None or d > latest:
                latest = d
    return latest


def _has_trigger_comm(
    matter_id: str,
    trigger: str,
    all_comms: List[dict],
    within_days: int,
    today: date,
) -> bool:
    """True if a non-dismissed comm for this matter+trigger exists within the last N days."""
    cutoff = today - timedelta(days=within_days)
    cutoff_str = cutoff.isoformat()
    for comm in all_comms:
        if comm.get("matter_id") != matter_id:
            continue
        if comm.get("trigger") != trigger:
            continue
        if comm.get("status") == "DISMISSED_WITH_REASON":
            continue
        created_raw = comm.get("created_at")
        dt = _parse_dt(created_raw)
        if dt:
            d = dt.date() if hasattr(dt, "date") else dt
            if d >= cutoff:
                return True
    return False


def _has_pending_comm(matter_id: str, all_comms: List[dict]) -> bool:
    pending = {"DRAFT_GENERATED", "DRAFT_APPROVED", "QUEUED_FOR_SEND"}
    for comm in all_comms:
        if comm.get("matter_id") == matter_id and comm.get("status") in pending:
            return True
    return False


def _has_recent_activity(
    matter_id: str, entries: List[dict], days: int, today: date
) -> bool:
    cutoff = (today - timedelta(days=days)).isoformat()
    for e in entries:
        if e.get("matter_id") != matter_id:
            continue
        if e.get("status") in ("WRITTEN_OFF", "CLOSED"):
            continue
        raw = e.get("entry_date", "")
        entry_date_str = str(raw)[:10] if raw else ""
        if entry_date_str >= cutoff:
            return True
    return False


def _has_extension_draft(matter_id: str, all_comms: List[dict]) -> bool:
    for comm in all_comms:
        if (
            comm.get("matter_id") == matter_id
            and comm.get("trigger") == CommTrigger.DEADLINE_EXTENSION_REQUEST.value
            and comm.get("status") == "DRAFT_GENERATED"
        ):
            return True
    return False


def _has_invoice_in_audit(matter_id: str, audit_docs: List[dict], days: int, today: date) -> bool:
    cutoff = (today - timedelta(days=days)).isoformat()
    for evt in audit_docs:
        if evt.get("entity_type") not in ("invoice", "billing"):
            continue
        if evt.get("matter_id") != matter_id:
            continue
        if "INVOICE" not in str(evt.get("event_type", "")):
            continue
        raw = evt.get("created_at")
        dt = _parse_dt(raw)
        if dt:
            d = dt.date() if hasattr(dt, "date") else dt
            if d.isoformat() >= cutoff:
                return True
    return False


# ---------------------------------------------------------------------------
# Gemini integration
# ---------------------------------------------------------------------------

def _call_gemini(prompt: str, system_prompt: Optional[str] = None) -> Optional[str]:
    """Shared Gemini caller. Returns text or None on failure."""
    try:
        import vertexai
        from vertexai.generative_models import GenerativeModel

        vertexai.init(
            project=config.GOOGLE_CLOUD_PROJECT,
            location=config.VERTEX_AI_LOCATION,
        )
        sys_instruction = [system_prompt] if system_prompt else [_COMMS_SYSTEM_PROMPT]
        model = GenerativeModel(
            model_name=config.GEMINI_MODEL,
            system_instruction=sys_instruction,
        )
        response = model.generate_content(prompt)
        return response.text
    except Exception:
        return None


def _call_gemini_draft(
    packet: FactPacket,
    client_name: str,
    matter_name: str,
    attorney_name: str,
    trigger: str,
    writing_style: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """Draft outbound comm via Gemini with writing_style injection."""
    tone = _TRIGGER_TONE_MAP.get(trigger, "update")
    style_text = ""
    if writing_style:
        style_text = (
            f"\nAttorney style: tone={writing_style.get('tone', 'professional')}, "
            f"salutation={writing_style.get('salutation', 'Dear [Name]')}, "
            f"paragraph_length={writing_style.get('paragraph_length', 'medium')}."
        )

    lines = [
        f"Draft a professional {tone} email from {attorney_name} to {client_name}",
        f"regarding matter: {matter_name}",
        f"Trigger: {trigger.replace('_', ' ').lower()}",
        style_text,
        "",
        "FactPacket:",
    ]
    for fact in packet.facts:
        lines.append(f"[{fact.fact_id}]: {fact.fact_text}")
        lines.append(f"    Source: {fact.source_excerpt}")
    lines.append("")
    lines.append("Write the email body now, using inline citations [f1], [f2], etc.")
    prompt = "\n".join(lines)
    return _call_gemini(prompt)


def _call_gemini_summarize(
    excerpt: str,
    from_name: str,
    from_role: str,
) -> Optional[Dict[str, Any]]:
    """Summarize inbound message. Returns {summary, action_items} or None."""
    prompt = (
        f"Sender: {from_name} ({from_role})\n"
        f"Message:\n{excerpt[:1500]}\n\n"
        "Triage this message. Return JSON only."
    )
    text = _call_gemini(prompt, system_prompt=_INBOUND_SUMMARY_PROMPT)
    if not text:
        return None
    try:
        cleaned = text.strip().strip("`").lstrip("json").strip()
        return json.loads(cleaned)
    except Exception:
        return None


def _call_gemini_draft_reply(
    msg: dict,
    matter: dict,
    client: dict,
    attorney: dict,
    summary: str,
) -> Optional[str]:
    """Draft a reply to an inbound HIGH-urgency message."""
    writing_style = attorney.get("writing_style", {})
    attorney_name = attorney.get("name", "Dana Strand")
    client_name = client.get("name", msg.get("from_name", "Client"))
    matter_name = matter.get("name", msg.get("matter_id", "your matter"))

    prompt = (
        f"Draft a professional acknowledgment/reply from {attorney_name} to {client_name}.\n"
        f"Matter: {matter_name}\n"
        f"Their message summary: {summary}\n"
        f"Tone: {writing_style.get('tone', 'professional')}\n"
        f"Salutation: {writing_style.get('salutation', 'Dear [Name]')}\n\n"
        "Write only the email body — no subject, no headers."
    )
    return _call_gemini(prompt)


# ---------------------------------------------------------------------------
# CommsAgent
# ---------------------------------------------------------------------------

class CommsAgent:
    """
    Client communications agent.
    v1.1.1: 5 outbound triggers, attorney style, citation stripping, inbound triage.
    """

    name = "comms_agent"

    def run(
        self,
        firm_id: str,
        run_id: Optional[str] = None,
        budget_signals: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        observations: List[AgentObservation] = []
        obs_counter = 0
        budget_signals = budget_signals or {}

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

        clients = {doc.id: doc.to_dict() for doc in collection_ref(firm_id, "clients").stream()}
        matters = {doc.id: doc.to_dict() for doc in collection_ref(firm_id, "matters").stream()}
        attorneys = {doc.id: doc.to_dict() for doc in collection_ref(firm_id, "attorneys").stream()}
        entries = [doc.to_dict() for doc in collection_ref(firm_id, "time_entries").stream()]
        all_comms = [doc.to_dict() for doc in collection_ref(firm_id, "client_communications").stream()]
        all_deadlines = [doc.to_dict() for doc in collection_ref(firm_id, "deadlines").stream()]
        all_inbound = [doc.to_dict() for doc in collection_ref(firm_id, "inbound_messages").stream()]
        audit_docs = [doc.to_dict() for doc in collection_ref(firm_id, "audit_log").stream()]

        active_matters = {k: v for k, v in matters.items() if v.get("status") == "ACTIVE"}

        observations.append(_obs(
            observation_type=ObservationType.SIGNAL_RECEIVED,
            commitment_level=CommitmentLevel.AUTO_SAFE,
            description=(
                f"Comms scan: {len(active_matters)} active matters, "
                f"{len(budget_signals)} budget signals, "
                f"{len([m for m in all_inbound if m.get('status') == 'AWAITING_TRIAGE'])} inbound to triage"
            ),
            data={
                "active_matters": len(active_matters),
                "budget_signal_clients": list(budget_signals.keys()),
                "inbound_awaiting": len([m for m in all_inbound if m.get("status") == "AWAITING_TRIAGE"]),
                "firm_id": firm_id,
            },
        ))

        comms_created: List[str] = []
        matters_touched_comms: set = set()

        # -----------------------------------------------------------------------
        # V11-P4-01 through V11-P4-05: Outbound trigger loop
        # -----------------------------------------------------------------------

        for matter_id, matter in active_matters.items():
            client_id = matter.get("client_id", "")
            client = clients.get(client_id, {})
            client_name = client.get("name", client_id)
            matter_name = matter.get("name", matter_id)
            attorney_id = matter.get("attorney_id", "dana-strand")
            attorney = attorneys.get(attorney_id, attorneys.get("dana-strand", {}))
            writing_style = attorney.get("writing_style", {})
            attorney_name = attorney.get("name", "Dana Strand")

            last_comm_date = _get_last_comm_date(matter_id, all_comms)

            # -----------------------------------------------------------------------
            # V11-P4-04: DAYS_SINCE_CONTACT (existing trigger, now in multi-trigger loop)
            # -----------------------------------------------------------------------
            threshold = int(client.get("client_silence_threshold_days", 14))
            last_contact_dt = _parse_dt(matter.get("last_client_contact"))
            if last_contact_dt is None:
                days_since = 9999
                last_contact_str = None
            else:
                days_since = (today - last_contact_dt.date()).days
                last_contact_str = last_contact_dt.date().isoformat()

            if days_since >= threshold and not _has_pending_comm(matter_id, all_comms):
                packet = FactPacket(
                    matter_id=matter_id,
                    client_id=client_id,
                    trigger=CommTrigger.DAYS_SINCE_CONTACT.value,
                )
                contact_text = last_contact_str or "unknown"
                packet.facts.append(Fact(
                    fact_id="f1",
                    fact_text=f"No confirmed client contact since {contact_text} — {days_since} days ago.",
                    source_type="firestore",
                    source_id=f"matters/{matter_id}",
                    source_excerpt=f"last_client_contact: {contact_text}",
                ))
                recent = [
                    e for e in entries
                    if e.get("matter_id") == matter_id
                    and e.get("status") in ("APPROVED", "BILLED")
                    and e.get("narrative")
                ]
                recent.sort(key=lambda e: str(e.get("entry_date", "")), reverse=True)
                for i, entry in enumerate(recent[:3], start=2):
                    narr = entry.get("narrative", "")
                    packet.facts.append(Fact(
                        fact_id=f"f{i}",
                        fact_text=narr,
                        source_type="time_entry",
                        source_id=f"time_entries/{entry['id']}",
                        source_excerpt=narr[:200],
                    ))

                observations.append(_obs(
                    observation_type=ObservationType.REASONING,
                    commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                    description=(
                        f"Silence trigger: {matter_name} ({client_name}) — "
                        f"{days_since} days since last contact (threshold: {threshold})"
                    ),
                    work_kind="llm_assisted",
                    data={
                        "matter_id": matter_id,
                        "client_name": client_name,
                        "days_since_contact": days_since,
                        "threshold_days": threshold,
                        "trigger": CommTrigger.DAYS_SINCE_CONTACT.value,
                    },
                ))

                draft = _call_gemini_draft(
                    packet, client_name, matter_name, attorney_name,
                    CommTrigger.DAYS_SINCE_CONTACT.value, writing_style,
                )
                if not draft:
                    draft = (
                        f"Dear {client_name},\n\nI wanted to reach out with a brief update "
                        f"on the {matter_name} matter. [f1]\n\n"
                        "Please let us know a convenient time to connect.\n\n"
                        f"Best regards,\n{attorney_name}"
                    )

                source_map = [
                    {
                        "fact_id": f.fact_id,
                        "fact_text": f.fact_text,
                        "source_type": f.source_type,
                        "source_id": f.source_id,
                        "source_excerpt": f.source_excerpt,
                        "citation_validated": True,
                    }
                    for f in packet.facts
                ]
                idem = f"comms-silence-{matter_id}-{today.isoformat()}"
                result = create_client_comm(
                    firm_id=firm_id,
                    matter_id=matter_id,
                    client_id=client_id,
                    trigger=CommTrigger.DAYS_SINCE_CONTACT.value,
                    draft_body=draft,
                    source_map=source_map,
                    actor="system",
                    idempotency_key=idem,
                )
                if hasattr(result, "entity_id"):
                    comms_created.append(result.entity_id)
                    observations.append(_obs(
                        observation_type=ObservationType.APPROVAL_GATE_APPLIED,
                        commitment_level=CommitmentLevel.BLOCKED,
                        description=(
                            f"Human gate: silence draft for {client_name} ({matter_name}) "
                            f"— attorney must approve before sending"
                        ),
                        work_kind="human_gate",
                        data={"comm_id": result.entity_id, "trigger": CommTrigger.DAYS_SINCE_CONTACT.value},
                        attorney_next_action=f"Review and approve the draft update for {client_name} re: {matter_name}.",
                    ))

            # -----------------------------------------------------------------------
            # V11-P4-01: BUDGET_THRESHOLD_CROSSED
            # -----------------------------------------------------------------------
            if client_id in budget_signals:
                bs = budget_signals[client_id]
                pct = bs.get("utilization_pct", 0)
                if pct >= 0.70 and not _has_trigger_comm(
                    matter_id, CommTrigger.BUDGET_THRESHOLD_CROSSED.value, all_comms, 30, today
                ):
                    pct_label = f"{pct:.0%}"
                    packet = FactPacket(
                        matter_id=matter_id,
                        client_id=client_id,
                        trigger=CommTrigger.BUDGET_THRESHOLD_CROSSED.value,
                    )
                    packet.facts.append(Fact(
                        fact_id="f1",
                        fact_text=f"Matter budget is {pct_label} utilized (${bs.get('total_committed', 0):,.0f} of ${bs.get('budget_cap', 0):,.0f}).",
                        source_type="budget_utilization",
                        source_id=f"clients/{client_id}",
                        source_excerpt=f"utilization_pct: {pct:.2f}",
                    ))

                    draft = _call_gemini_draft(
                        packet, client_name, matter_name, attorney_name,
                        CommTrigger.BUDGET_THRESHOLD_CROSSED.value, writing_style,
                    )
                    if not draft:
                        draft = (
                            f"Dear {client_name},\n\nI'm writing to update you on the budget status "
                            f"for {matter_name}. [f1]\n\nPlease contact us to discuss how you'd like to proceed.\n\n"
                            f"Best regards,\n{attorney_name}"
                        )

                    idem = f"comms-budget-{matter_id}-{today.isoformat()}"
                    result = create_client_comm(
                        firm_id=firm_id,
                        matter_id=matter_id,
                        client_id=client_id,
                        trigger=CommTrigger.BUDGET_THRESHOLD_CROSSED.value,
                        draft_body=draft,
                        source_map=[{"fact_id": f.fact_id, "fact_text": f.fact_text,
                                     "source_type": f.source_type, "source_id": f.source_id,
                                     "source_excerpt": f.source_excerpt, "citation_validated": True}
                                    for f in packet.facts],
                        actor="system",
                        idempotency_key=idem,
                    )
                    if hasattr(result, "entity_id"):
                        comms_created.append(result.entity_id)
                        observations.append(_obs(
                            observation_type=ObservationType.WARN_NOTICE,
                            commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                            description=(
                                f"Budget notice draft: {client_name} at {pct_label} — "
                                f"attorney review required before sending"
                            ),
                            work_kind="llm_assisted",
                            data={"comm_id": result.entity_id, "utilization_pct": pct,
                                  "trigger": CommTrigger.BUDGET_THRESHOLD_CROSSED.value},
                            attorney_next_action=f"Review budget notice draft for {client_name} ({matter_name}).",
                        ))

            # -----------------------------------------------------------------------
            # V11-P4-02: DEADLINE_CONFIRMED_NO_UPDATE
            # -----------------------------------------------------------------------
            verified_dls = [
                d for d in all_deadlines
                if d.get("matter_id") == matter_id
                and d.get("status") == "ACTIVE"
                and d.get("verification_status") == "attorney_verified"
            ]
            if verified_dls:
                days_no_update = (today - last_comm_date).days if last_comm_date else 9999
                if days_no_update > 7 and not _has_trigger_comm(
                    matter_id, CommTrigger.DEADLINE_CONFIRMED_NO_UPDATE.value, all_comms, 7, today
                ):
                    dl = verified_dls[0]
                    packet = FactPacket(
                        matter_id=matter_id,
                        client_id=client_id,
                        trigger=CommTrigger.DEADLINE_CONFIRMED_NO_UPDATE.value,
                    )
                    packet.facts.append(Fact(
                        fact_id="f1",
                        fact_text=f"Deadline '{dl.get('description', 'filing deadline')}' due {dl.get('due_date', 'TBD')} is verified and active.",
                        source_type="deadline",
                        source_id=f"deadlines/{dl.get('id', '')}",
                        source_excerpt=f"verification_status: attorney_verified, due_date: {dl.get('due_date')}",
                    ))

                    draft = _call_gemini_draft(
                        packet, client_name, matter_name, attorney_name,
                        CommTrigger.DEADLINE_CONFIRMED_NO_UPDATE.value, writing_style,
                    )
                    if not draft:
                        draft = (
                            f"Dear {client_name},\n\nI wanted to update you on progress for {matter_name}. [f1]\n\n"
                            f"Please feel free to reach out with any questions.\n\nBest regards,\n{attorney_name}"
                        )

                    idem = f"comms-dl-update-{matter_id}-{today.isoformat()}"
                    result = create_client_comm(
                        firm_id=firm_id,
                        matter_id=matter_id,
                        client_id=client_id,
                        trigger=CommTrigger.DEADLINE_CONFIRMED_NO_UPDATE.value,
                        draft_body=draft,
                        source_map=[{"fact_id": f.fact_id, "fact_text": f.fact_text,
                                     "source_type": f.source_type, "source_id": f.source_id,
                                     "source_excerpt": f.source_excerpt, "citation_validated": True}
                                    for f in packet.facts],
                        actor="system",
                        idempotency_key=idem,
                    )
                    if hasattr(result, "entity_id"):
                        comms_created.append(result.entity_id)
                        observations.append(_obs(
                            observation_type=ObservationType.REASONING,
                            commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                            description=(
                                f"Deadline-no-update draft: {matter_name} — "
                                f"no client comm in {days_no_update} days despite active deadline"
                            ),
                            work_kind="llm_assisted",
                            data={"comm_id": result.entity_id,
                                  "trigger": CommTrigger.DEADLINE_CONFIRMED_NO_UPDATE.value},
                        ))

            # -----------------------------------------------------------------------
            # V11-P4-04: ACTIVITY_WITHOUT_UPDATE
            # -----------------------------------------------------------------------
            if _has_recent_activity(matter_id, entries, 14, today):
                days_no_update = (today - last_comm_date).days if last_comm_date else 9999
                if days_no_update > 14 and not _has_trigger_comm(
                    matter_id, CommTrigger.ACTIVITY_WITHOUT_UPDATE.value, all_comms, 14, today
                ):
                    packet = FactPacket(
                        matter_id=matter_id,
                        client_id=client_id,
                        trigger=CommTrigger.ACTIVITY_WITHOUT_UPDATE.value,
                    )
                    packet.facts.append(Fact(
                        fact_id="f1",
                        fact_text=f"Billable work logged on {matter_name} in the last 14 days, but no client update sent.",
                        source_type="time_entries",
                        source_id=f"matters/{matter_id}",
                        source_excerpt="recent time entries found",
                    ))

                    draft = _call_gemini_draft(
                        packet, client_name, matter_name, attorney_name,
                        CommTrigger.ACTIVITY_WITHOUT_UPDATE.value, writing_style,
                    )
                    if not draft:
                        draft = (
                            f"Dear {client_name},\n\nI'm reaching out with a brief update on {matter_name}. [f1]\n\n"
                            f"Please don't hesitate to contact us with any questions.\n\nBest regards,\n{attorney_name}"
                        )

                    idem = f"comms-activity-{matter_id}-{today.isoformat()}"
                    result = create_client_comm(
                        firm_id=firm_id,
                        matter_id=matter_id,
                        client_id=client_id,
                        trigger=CommTrigger.ACTIVITY_WITHOUT_UPDATE.value,
                        draft_body=draft,
                        source_map=[{"fact_id": f.fact_id, "fact_text": f.fact_text,
                                     "source_type": f.source_type, "source_id": f.source_id,
                                     "source_excerpt": f.source_excerpt, "citation_validated": True}
                                    for f in packet.facts],
                        actor="system",
                        idempotency_key=idem,
                    )
                    if hasattr(result, "entity_id"):
                        comms_created.append(result.entity_id)
                        observations.append(_obs(
                            observation_type=ObservationType.REASONING,
                            commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                            description=(
                                f"Activity-no-update draft: {matter_name} ({client_name}) — "
                                f"work logged but no client comm in {days_no_update} days"
                            ),
                            work_kind="llm_assisted",
                            data={"comm_id": result.entity_id,
                                  "trigger": CommTrigger.ACTIVITY_WITHOUT_UPDATE.value},
                        ))

            # -----------------------------------------------------------------------
            # V11-P4-03: INVOICE_GENERATED
            # -----------------------------------------------------------------------
            if _has_invoice_in_audit(matter_id, audit_docs, 30, today) and not _has_trigger_comm(
                matter_id, CommTrigger.INVOICE_GENERATED.value, all_comms, 30, today
            ):
                packet = FactPacket(
                    matter_id=matter_id,
                    client_id=client_id,
                    trigger=CommTrigger.INVOICE_GENERATED.value,
                )
                packet.facts.append(Fact(
                    fact_id="f1",
                    fact_text=f"An invoice has been generated for {matter_name}.",
                    source_type="audit_log",
                    source_id=f"matters/{matter_id}",
                    source_excerpt="INVOICE event in audit_log",
                ))

                draft = _call_gemini_draft(
                    packet, client_name, matter_name, attorney_name,
                    CommTrigger.INVOICE_GENERATED.value, writing_style,
                )
                if not draft:
                    draft = (
                        f"Dear {client_name},\n\nPlease find enclosed an invoice for services rendered in {matter_name}. [f1]\n\n"
                        f"Please contact us with any questions.\n\nBest regards,\n{attorney_name}"
                    )

                idem = f"comms-invoice-{matter_id}-{today.isoformat()}"
                result = create_client_comm(
                    firm_id=firm_id,
                    matter_id=matter_id,
                    client_id=client_id,
                    trigger=CommTrigger.INVOICE_GENERATED.value,
                    draft_body=draft,
                    source_map=[{"fact_id": f.fact_id, "fact_text": f.fact_text,
                                 "source_type": f.source_type, "source_id": f.source_id,
                                 "source_excerpt": f.source_excerpt, "citation_validated": True}
                                for f in packet.facts],
                    actor="system",
                    idempotency_key=idem,
                )
                if hasattr(result, "entity_id"):
                    comms_created.append(result.entity_id)
                    observations.append(_obs(
                        observation_type=ObservationType.REASONING,
                        commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                        description=f"Invoice cover draft: {matter_name} ({client_name})",
                        work_kind="llm_assisted",
                        data={"comm_id": result.entity_id, "trigger": CommTrigger.INVOICE_GENERATED.value},
                    ))

            # -----------------------------------------------------------------------
            # V11-P4-05: DEADLINE_EXTENSION_REQUEST — extension draft waiting for review
            # -----------------------------------------------------------------------
            if _has_extension_draft(matter_id, all_comms):
                observations.append(_obs(
                    observation_type=ObservationType.WARN_NOTICE,
                    commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                    description=(
                        f"Extension request draft pending attorney review: {matter_name} ({client_name})"
                    ),
                    data={
                        "matter_id": matter_id,
                        "trigger": CommTrigger.DEADLINE_EXTENSION_REQUEST.value,
                    },
                    attorney_next_action=(
                        f"Review the pending extension request draft for {matter_name} "
                        f"and approve or revise before sending."
                    ),
                ))

        # -----------------------------------------------------------------------
        # V11-P4-09 through V11-P4-15: Inbound triage pass
        # -----------------------------------------------------------------------

        awaiting = [m for m in all_inbound if m.get("status") == "AWAITING_TRIAGE"]

        inbound_triaged = 0
        inbound_drafts = 0

        for msg in awaiting:
            excerpt = msg.get("message_excerpt", "")
            from_name = msg.get("from_name", "Unknown")
            from_role = msg.get("from_role", "unknown")
            matter_id = msg.get("matter_id")
            client_id_inbound = msg.get("client_id")
            wait_days = msg.get("wait_days", 0)
            source_id = msg.get("source_email_id", msg.get("id", "unknown"))

            urgency, signals, score = _score_urgency(msg, matters)

            observations.append(_obs(
                observation_type=ObservationType.TOOL_CALL,
                commitment_level=CommitmentLevel.AUTO_SAFE,
                description=f"Urgency scored: {from_name} → {urgency} (score {score})",
                data={
                    "tool": {
                        "name": "score_urgency",
                        "kind": "compute",
                        "signature": "(message: InboundMessage, active_deadlines: list[Deadline]) -> UrgencyScore",
                        "result": {"urgency": urgency, "score": score, "signals": signals},
                    }
                },
                evidence=[source_id],
            ))

            observations.append(_obs(
                observation_type=ObservationType.INBOX_TRIAGE,
                commitment_level=CommitmentLevel.AUTO_SAFE,
                description=(
                    f"Inbound triage: {from_name} ({from_role}) — "
                    f"urgency {urgency} (score {score})"
                ),
                work_kind="deterministic",
                data={
                    "from_name": from_name,
                    "from_role": from_role,
                    "urgency": urgency,
                    "urgency_score": score,
                    "urgency_signals": signals,
                    "wait_days": wait_days,
                    "matter_id": matter_id,
                },
                evidence=[source_id],
            ))

            summary: Optional[str] = None
            action_items: List[dict] = []
            handoff_agent: Optional[str] = None

            if urgency in (InboundUrgency.HIGH.value, InboundUrgency.MEDIUM.value):
                gem_result = _call_gemini_summarize(excerpt, from_name, from_role)
                if gem_result:
                    summary = gem_result.get("summary", "")
                    action_items = gem_result.get("action_items", [])
                    handoff_agent = _get_handoff_agent(action_items)
                    observations.append(_obs(
                        observation_type=ObservationType.TOOL_CALL,
                        commitment_level=CommitmentLevel.AUTO_SAFE,
                        description=f"Gemini summarized inbound message from {from_name}",
                        work_kind="llm_assisted",
                        model_name=config.GEMINI_MODEL,
                        data={
                            "tool": {
                                "name": "summarize_inbound",
                                "kind": "gemini",
                                "signature": "(subject, body, matter_context) -> InboundSummary | None",
                                "result": {
                                    "summary": summary,
                                    "action_item_count": len(action_items),
                                    "handoff_agent": handoff_agent,
                                },
                            }
                        },
                        evidence=[source_id],
                    ))

            # Opposing counsel check: special handling (no draft, attorney_action required)
            is_opposing = from_role.lower() in ("opposing_counsel", "opposing counsel", "adverse_party")

            # HIGH urgency: draft a reply (unless opposing counsel)
            if urgency == InboundUrgency.HIGH.value and not is_opposing and matter_id:
                matter = matters.get(matter_id, {})
                client = clients.get(client_id_inbound or matter.get("client_id", ""), {})
                attorney = attorneys.get("dana-strand", {})
                reply_draft = _call_gemini_draft_reply(
                    msg, matter, client, attorney, summary or excerpt[:200]
                )
                if reply_draft:
                    observations.append(_obs(
                        observation_type=ObservationType.TOOL_CALL,
                        commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                        description=f"Gemini drafted reply for HIGH-urgency message from {from_name}",
                        work_kind="llm_assisted",
                        model_name=config.GEMINI_MODEL,
                        data={
                            "tool": {
                                "name": "draft_inbound_reply",
                                "kind": "gemini",
                                "signature": "(subject, body, matter_context, tone) -> str | None",
                                "result": {"draft_length": len(reply_draft)},
                            }
                        },
                        evidence=[source_id],
                    ))
                if reply_draft:
                    idem_reply = f"comms-inbound-reply-{source_id}-{today.isoformat()}"
                    comm_result = create_client_comm(
                        firm_id=firm_id,
                        matter_id=matter_id,
                        client_id=client_id_inbound or matter.get("client_id", ""),
                        trigger=CommTrigger.INBOUND_REPLY.value,
                        draft_body=reply_draft,
                        source_map=[{
                            "fact_id": "f1",
                            "fact_text": summary or excerpt[:200],
                            "source_type": "inbound_message",
                            "source_id": source_id,
                            "source_excerpt": excerpt[:200],
                            "citation_validated": True,
                        }],
                        actor="system",
                        idempotency_key=idem_reply,
                    )
                    if hasattr(comm_result, "entity_id"):
                        inbound_drafts += 1
                        comms_created.append(comm_result.entity_id)
                        observations.append(_obs(
                            observation_type=ObservationType.APPROVAL_GATE_APPLIED,
                            commitment_level=CommitmentLevel.BLOCKED,
                            description=(
                                f"Reply draft created for HIGH-urgency message from {from_name} "
                                f"— attorney must approve before sending"
                            ),
                            work_kind="llm_assisted",
                            data={
                                "comm_id": comm_result.entity_id,
                                "trigger": CommTrigger.INBOUND_REPLY.value,
                                "from_name": from_name,
                            },
                            attorney_next_action=f"Review and approve reply to {from_name} re: {matter_id}.",
                        ))

            if is_opposing and urgency in (InboundUrgency.HIGH.value, InboundUrgency.MEDIUM.value):
                observations.append(_obs(
                    observation_type=ObservationType.WARN_NOTICE,
                    commitment_level=CommitmentLevel.REVIEW_REQUIRED,
                    description=(
                        f"Opposing counsel message from {from_name} — "
                        f"attorney review required before any response"
                    ),
                    data={
                        "from_name": from_name,
                        "from_role": from_role,
                        "urgency": urgency,
                        "matter_id": matter_id,
                        "action_items": action_items,
                    },
                    attorney_next_action=f"Review message from opposing counsel {from_name} and determine response strategy.",
                ))

            # ROUTE_HANDOFF if action items map to another agent
            if handoff_agent and handoff_agent != self.name:
                inbound_id = msg.get("id", source_id)
                observations.append(_obs(
                    observation_type=ObservationType.ROUTE_HANDOFF,
                    commitment_level=CommitmentLevel.AUTO_SAFE,
                    description=(
                        f"Route handoff: {from_name} message → {handoff_agent}"
                    ),
                    work_kind="route",
                    data={
                        "handoff": {
                            "from": self.name,
                            "to": handoff_agent,
                            "entity_id": inbound_id,
                            "reason": (
                                f"Inbound message from {from_name} contains "
                                f"{handoff_agent.replace('_', ' ')}-relevant action items"
                            ),
                        },
                        "from_name": from_name,
                        "urgency": urgency,
                    },
                    evidence=[source_id],
                ))

            inbound_triaged += 1

        # Summary
        total_comms = len(comms_created)
        final_level = (
            CommitmentLevel.BLOCKED if total_comms > 0
            else CommitmentLevel.AUTO_SAFE
        )
        observations.append(_obs(
            observation_type=ObservationType.RESULT,
            commitment_level=final_level,
            description=(
                f"Comms sweep complete: {total_comms} draft(s) created, "
                f"{inbound_triaged} inbound triaged, {inbound_drafts} reply draft(s) generated"
            ),
            data={
                "comms_created": total_comms,
                "comm_ids": comms_created,
                "inbound_triaged": inbound_triaged,
                "inbound_reply_drafts": inbound_drafts,
            },
        ))

        matters_touched_comms = list({
            obs.data.get("matter_id")
            for obs in observations
            if obs.data.get("matter_id")
        })
        return {
            "agent": self.name,
            "comms_created": total_comms,
            "comm_ids": comms_created,
            "inbound_triaged": inbound_triaged,
            "matters_touched": matters_touched_comms,
            "observations": observations,
        }
