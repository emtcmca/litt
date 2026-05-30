"""
CommsAgent — detects client silence triggers and generates draft communications.

Deterministic detection logic (Python). Gemini used only for draft body generation.
Calls tool layer to write comm records — never writes Firestore directly.

FactPacket → Gemini 2.5 Pro → citation validation → create_client_comm()
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app import config
from app.db import collection_ref
from app.models import CommTrigger
from app.tools.comms import create_client_comm

# ---------------------------------------------------------------------------
# System prompt — context only, no branching logic or routing decisions
# ---------------------------------------------------------------------------

COMMS_SYSTEM_PROMPT = """You are the communications assistant for a small law firm using Litt, an AI operations platform.
Your role is to draft professional, concise client update emails grounded strictly in verified facts.

Every factual claim in the email body must be followed by an inline citation in the format [f1], [f2], etc.
You will be given a FactPacket — a numbered list of verified facts with source references.
Use only the facts in the FactPacket. Do not invent, infer, or expand beyond what is provided.

Format: plain email body only — no subject line, no "To:" or "From:" headers.
Length: 3–4 short paragraphs. End with a clear, specific call to action."""


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


def _build_fact_packet(
    matter_id: str,
    client_id: str,
    days_since: int,
    last_contact_str: Optional[str],
    recent_entries: List[dict],
) -> FactPacket:
    packet = FactPacket(
        matter_id=matter_id,
        client_id=client_id,
        trigger=CommTrigger.DAYS_SINCE_CONTACT.value,
    )

    contact_text = f"{last_contact_str}" if last_contact_str else "unknown"
    packet.facts.append(Fact(
        fact_id="f1",
        fact_text=f"No confirmed client contact since {contact_text} — {days_since} days ago.",
        source_type="firestore",
        source_id=f"matters/{matter_id}",
        source_excerpt=f"last_client_contact: {contact_text}",
    ))

    for i, entry in enumerate(recent_entries[:3], start=2):
        narrative = entry.get("narrative", "")
        if not narrative:
            continue
        packet.facts.append(Fact(
            fact_id=f"f{i}",
            fact_text=narrative,
            source_type="time_entry",
            source_id=f"time_entries/{entry['id']}",
            source_excerpt=narrative[:200],
        ))

    return packet


def _build_gemini_prompt(
    packet: FactPacket,
    client_name: str,
    matter_name: str,
    attorney_name: str,
) -> str:
    lines = [
        f"Draft a professional status update email from {attorney_name} to {client_name}",
        f"regarding the matter: {matter_name}",
        f"Trigger: {days_since_description(packet)}",
        "",
        "FactPacket:",
    ]
    for fact in packet.facts:
        lines.append(f"[{fact.fact_id}]: {fact.fact_text}")
        lines.append(f"    Source: {fact.source_excerpt}")
    lines.append("")
    lines.append("Write the email body now, using inline citations [f1], [f2], etc.")
    return "\n".join(lines)


def days_since_description(packet: FactPacket) -> str:
    f1 = next((f for f in packet.facts if f.fact_id == "f1"), None)
    return f1.fact_text if f1 else "Client silence trigger"


def _validate_citations(draft_body: str, packet: FactPacket) -> List[str]:
    """Return list of citation refs in the draft that have no matching fact."""
    valid_ids = {f.fact_id for f in packet.facts}
    used = re.findall(r"\[f(\d+)\]", draft_body, re.IGNORECASE)
    return [f"f{n}" for n in used if f"f{n}" not in valid_ids]


def _call_gemini(prompt: str) -> Optional[str]:
    """
    Call Gemini 2.5 Pro via Vertex AI. Returns draft body text or None on failure.
    Isolated to a single function so tests can mock it easily.
    """
    try:
        import vertexai
        from vertexai.generative_models import GenerativeModel

        vertexai.init(
            project=config.GOOGLE_CLOUD_PROJECT,
            location=config.VERTEX_AI_LOCATION,
        )
        model = GenerativeModel(
            model_name=config.GEMINI_MODEL,
            system_instruction=[COMMS_SYSTEM_PROMPT],
        )
        response = model.generate_content(prompt)
        return response.text
    except Exception:
        return None


def _has_pending_comm(firm_id: str, matter_id: str) -> bool:
    """Check if a non-terminal comm draft already exists for this matter."""
    pending_statuses = {"DRAFT_GENERATED", "DRAFT_APPROVED", "QUEUED_FOR_SEND"}
    comms = collection_ref(firm_id, "client_communications").stream()
    for doc in comms:
        comm = doc.to_dict()
        if comm.get("matter_id") == matter_id and comm.get("status") in pending_statuses:
            return True
    return False


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


class CommsAgent:
    """
    Detects client silence triggers and generates draft communications.
    Calls Gemini for draft body generation. Deterministic detection logic.
    """

    name = "comms_agent"

    def run(self, firm_id: str) -> Dict[str, Any]:
        today = config.get_effective_date()
        clients = {doc.id: doc.to_dict() for doc in collection_ref(firm_id, "clients").stream()}
        matters = {doc.id: doc.to_dict() for doc in collection_ref(firm_id, "matters").stream()}
        attorneys = {doc.id: doc.to_dict() for doc in collection_ref(firm_id, "attorneys").stream()}
        entries = [doc.to_dict() for doc in collection_ref(firm_id, "time_entries").stream()]

        comms_created: List[str] = []
        triggers_found = 0

        for matter_id, matter in matters.items():
            if matter.get("status") != "ACTIVE":
                continue

            client_id = matter.get("client_id", "")
            client = clients.get(client_id, {})
            threshold = int(client.get("client_silence_threshold_days", 14))

            last_contact_dt = _parse_dt(matter.get("last_client_contact"))
            if last_contact_dt is None:
                days_since = 9999
                last_contact_str = None
            else:
                days_since = (today - last_contact_dt.date()).days
                last_contact_str = last_contact_dt.date().isoformat()

            if days_since < threshold:
                continue

            triggers_found += 1

            if _has_pending_comm(firm_id, matter_id):
                continue

            # Gather recent APPROVED entries for this matter (fact sources)
            recent_entries = [
                e for e in entries
                if e.get("matter_id") == matter_id
                and e.get("status") in ("APPROVED", "BILLED")
                and e.get("narrative")
            ]
            recent_entries.sort(key=lambda e: str(e.get("entry_date", "")), reverse=True)

            packet = _build_fact_packet(
                matter_id=matter_id,
                client_id=client_id,
                days_since=days_since,
                last_contact_str=last_contact_str,
                recent_entries=recent_entries,
            )

            client_name = client.get("name", client_id)
            matter_name = matter.get("name", matter_id)
            attorney_name = attorneys.get("dana-strand", {}).get("name", "Dana Strand")

            prompt = _build_gemini_prompt(packet, client_name, matter_name, attorney_name)
            draft_body = _call_gemini(prompt)

            if not draft_body:
                # Fallback template when Gemini unavailable
                draft_body = (
                    f"Dear {client_name},\n\n"
                    f"I wanted to reach out with a brief update on the {matter_name} matter. [f1]\n\n"
                    "Please let us know a convenient time to connect.\n\n"
                    f"Best regards,\n{attorney_name}"
                )

            invalid_cites = _validate_citations(draft_body, packet)

            source_map = [
                {
                    "fact_id": f.fact_id,
                    "fact_text": f.fact_text,
                    "sentence_in_draft": "",
                    "source_type": f.source_type,
                    "source_id": f.source_id,
                    "source_excerpt": f.source_excerpt,
                    "citation_validated": f.fact_id not in invalid_cites,
                }
                for f in packet.facts
            ]

            idem = f"comms-sweep-silence-{matter_id}-{today.isoformat()}"
            result = create_client_comm(
                firm_id=firm_id,
                matter_id=matter_id,
                client_id=client_id,
                trigger=CommTrigger.DAYS_SINCE_CONTACT.value,
                draft_body=draft_body,
                source_map=source_map,
                actor="system",
                idempotency_key=idem,
            )

            if hasattr(result, "entity_id"):
                comms_created.append(result.entity_id)

        return {
            "agent": self.name,
            "triggers_found": triggers_found,
            "comms_created": len(comms_created),
            "comm_ids": comms_created,
        }
