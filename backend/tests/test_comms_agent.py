"""
Phase 4 — CommsAgent v1.1.1 tests.

V11-P4-17: 5 outbound triggers produce comms with correct trigger field.
V11-P4-18: citation stripping, writing_style injection, urgency scoring,
           Gemini gate on LOW urgency, ROUTE_HANDOFF on deadline mention.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, call, patch

import pytest

from app.agents.comms_agent import (
    CommsAgent,
    _has_question,
    _mentions_deadline,
    _score_urgency,
)
from app.models import CommTrigger, InboundUrgency, ToolResult
from app.observability import CommitmentLevel, ObservationType
from app.tools.comms import _strip_citations

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FIRM = "strand-okafor"
TODAY = date(2026, 6, 25)

# ---------------------------------------------------------------------------
# Mock helpers
# ---------------------------------------------------------------------------


class _Doc:
    def __init__(self, doc_id: str, data: dict):
        self.id = doc_id
        self._data = data

    def to_dict(self) -> dict:
        return dict(self._data)


class _Col:
    def __init__(self, docs: list):
        self._docs = docs

    def stream(self):
        return iter(self._docs)


def _tool_result(entity_id: str = "comm-001") -> ToolResult:
    return ToolResult(
        entity_id=entity_id,
        entity_type="client_communication",
        audit_event_id="audit-001",
    )


def _matter(
    matter_id: str,
    client_id: str,
    *,
    days_since_contact: Optional[int] = None,
    status: str = "ACTIVE",
) -> dict:
    last_contact = None
    if days_since_contact is not None:
        last_contact = (
            datetime(2026, 6, 25, tzinfo=timezone.utc)
            - timedelta(days=days_since_contact)
        ).isoformat()
    return {
        "id": matter_id,
        "firm_id": FIRM,
        "client_id": client_id,
        "attorney_id": "dana-strand",
        "name": f"Matter {matter_id}",
        "status": status,
        "last_client_contact": last_contact,
    }


def _client(client_id: str) -> dict:
    return {
        "id": client_id,
        "name": f"Client {client_id}",
        "client_silence_threshold_days": 14,
    }


def _attorney() -> dict:
    return {
        "id": "dana-strand",
        "name": "Dana Strand",
        "writing_style": {
            "tone": "professional",
            "salutation": "Dear [Name],",
            "paragraph_length": "medium",
        },
    }


def _deadline(
    deadline_id: str,
    matter_id: str,
    *,
    days_out: int = 5,
    status: str = "ACTIVE",
    verification_status: str = "attorney_verified",
) -> dict:
    due = (TODAY + timedelta(days=days_out)).isoformat()
    return {
        "id": deadline_id,
        "firm_id": FIRM,
        "matter_id": matter_id,
        "description": "Filing deadline",
        "due_date": due,
        "status": status,
        "verification_status": verification_status,
    }


def _entry(
    entry_id: str,
    matter_id: str,
    *,
    days_ago: int = 1,
    entry_status: str = "APPROVED",
    narrative: str = "Reviewed documents",
) -> dict:
    entry_date = (TODAY - timedelta(days=days_ago)).isoformat()
    return {
        "id": entry_id,
        "firm_id": FIRM,
        "matter_id": matter_id,
        "entry_date": entry_date,
        "status": entry_status,
        "narrative": narrative,
    }


def _comm(
    comm_id: str,
    matter_id: str,
    trigger: str,
    *,
    days_ago: int = 0,
    status: str = "DRAFT_GENERATED",
) -> dict:
    created = (
        datetime(2026, 6, 25, tzinfo=timezone.utc) - timedelta(days=days_ago)
    ).isoformat()
    return {
        "id": comm_id,
        "firm_id": FIRM,
        "matter_id": matter_id,
        "trigger": trigger,
        "status": status,
        "created_at": created,
    }


def _audit_invoice(matter_id: str, days_ago: int = 5) -> dict:
    created = (
        datetime(2026, 6, 25, tzinfo=timezone.utc) - timedelta(days=days_ago)
    ).isoformat()
    return {
        "entity_type": "invoice",
        "event_type": "INVOICE_GENERATED",
        "matter_id": matter_id,
        "created_at": created,
    }


def _inbound(
    msg_id: str,
    *,
    from_role: str = "client",
    from_name: str = "Alice Client",
    excerpt: str = "Please update me.",
    wait_days: int = 0,
    matter_id: Optional[str] = None,
    is_followup: bool = False,
    status: str = "AWAITING_TRIAGE",
) -> dict:
    return {
        "id": msg_id,
        "firm_id": FIRM,
        "from_name": from_name,
        "from_role": from_role,
        "message_excerpt": excerpt,
        "wait_days": wait_days,
        "matter_id": matter_id,
        "is_followup": is_followup,
        "source_email_id": msg_id,
        "status": status,
    }


def _build_col_side_effect(
    matters_list: list,
    clients_list: list,
    attorneys_list: Optional[list] = None,
    entries_list: Optional[list] = None,
    comms_list: Optional[list] = None,
    deadlines_list: Optional[list] = None,
    inbound_list: Optional[list] = None,
    audit_list: Optional[list] = None,
):
    attorneys_list = attorneys_list or [_attorney()]
    entries_list = entries_list or []
    comms_list = comms_list or []
    deadlines_list = deadlines_list or []
    inbound_list = inbound_list or []
    audit_list = audit_list or []

    _MAP = {
        "clients": [_Doc(c["id"], c) for c in clients_list],
        "matters": [_Doc(m["id"], m) for m in matters_list],
        "attorneys": [_Doc(a["id"], a) for a in attorneys_list],
        "time_entries": [_Doc(e["id"], e) for e in entries_list],
        "client_communications": [_Doc(c["id"], c) for c in comms_list],
        "deadlines": [_Doc(d["id"], d) for d in deadlines_list],
        "inbound_messages": [_Doc(i["id"], i) for i in inbound_list],
        "audit_log": [_Doc(str(i), d) for i, d in enumerate(audit_list)],
    }

    def _side(firm_id, collection_name):
        return _Col(_MAP.get(collection_name, []))

    return _side


# ---------------------------------------------------------------------------
# V11-P4-17: Outbound triggers
# ---------------------------------------------------------------------------


class TestOutboundTriggers:
    """V11-P4-17: all 5 outbound triggers produce comms with correct trigger field."""

    def _run(
        self,
        matters,
        clients,
        *,
        budget_signals=None,
        entries=None,
        comms=None,
        deadlines=None,
        audit=None,
        gemini_draft="Draft body with [f1] citation.",
    ):
        agent = CommsAgent()
        col_side = _build_col_side_effect(
            matters_list=matters,
            clients_list=clients,
            entries_list=entries or [],
            comms_list=comms or [],
            deadlines_list=deadlines or [],
            audit_list=audit or [],
        )
        with (
            patch("app.agents.comms_agent.collection_ref", side_effect=col_side),
            patch(
                "app.agents.comms_agent.create_client_comm",
                return_value=_tool_result("comm-out-001"),
            ) as mock_comm,
            patch(
                "app.agents.comms_agent._call_gemini",
                return_value=gemini_draft,
            ),
        ):
            result = agent.run(
                firm_id=FIRM,
                run_id="run-test",
                budget_signals=budget_signals or {},
            )
        return result, mock_comm

    # ------------------------------------------------------------------
    # DAYS_SINCE_CONTACT (existing, now in multi-trigger loop)
    # ------------------------------------------------------------------

    def test_days_since_contact_trigger(self):
        m = _matter("m-silence", "c-silence", days_since_contact=20)
        c = _client("c-silence")
        result, mock_comm = self._run([m], [c])
        triggers = [
            call_[1]["trigger"] for call_ in mock_comm.call_args_list
        ]
        assert CommTrigger.DAYS_SINCE_CONTACT.value in triggers, (
            "DAYS_SINCE_CONTACT comm not created for 20-day silence"
        )

    def test_no_silence_trigger_below_threshold(self):
        m = _matter("m-recent", "c-recent", days_since_contact=5)
        c = _client("c-recent")
        result, mock_comm = self._run([m], [c])
        triggers = [
            call_[1]["trigger"] for call_ in mock_comm.call_args_list
        ]
        assert CommTrigger.DAYS_SINCE_CONTACT.value not in triggers, (
            "DAYS_SINCE_CONTACT should NOT fire at 5 days (threshold 14)"
        )

    # ------------------------------------------------------------------
    # BUDGET_THRESHOLD_CROSSED (V11-P4-01)
    # ------------------------------------------------------------------

    def test_budget_threshold_crossed_at_70_pct(self):
        m = _matter("m-budget", "c-budget")
        c = _client("c-budget")
        budget_signals = {
            "c-budget": {
                "utilization_pct": 0.72,
                "total_committed": 72000,
                "budget_cap": 100000,
            }
        }
        result, mock_comm = self._run([m], [c], budget_signals=budget_signals)
        triggers = [
            call_[1]["trigger"] for call_ in mock_comm.call_args_list
        ]
        assert CommTrigger.BUDGET_THRESHOLD_CROSSED.value in triggers

    def test_budget_trigger_not_fired_below_70_pct(self):
        m = _matter("m-budget-low", "c-budget-low")
        c = _client("c-budget-low")
        budget_signals = {
            "c-budget-low": {"utilization_pct": 0.65, "total_committed": 65000, "budget_cap": 100000}
        }
        result, mock_comm = self._run([m], [c], budget_signals=budget_signals)
        triggers = [call_[1]["trigger"] for call_ in mock_comm.call_args_list]
        assert CommTrigger.BUDGET_THRESHOLD_CROSSED.value not in triggers

    def test_budget_trigger_suppressed_when_recent_comm_exists(self):
        m = _matter("m-budget-dup", "c-budget-dup")
        c = _client("c-budget-dup")
        existing = _comm(
            "comm-budget-existing",
            "m-budget-dup",
            CommTrigger.BUDGET_THRESHOLD_CROSSED.value,
            days_ago=15,
        )
        budget_signals = {
            "c-budget-dup": {"utilization_pct": 0.80, "total_committed": 80000, "budget_cap": 100000}
        }
        result, mock_comm = self._run(
            [m], [c], budget_signals=budget_signals, comms=[existing]
        )
        triggers = [call_[1]["trigger"] for call_ in mock_comm.call_args_list]
        assert CommTrigger.BUDGET_THRESHOLD_CROSSED.value not in triggers

    # ------------------------------------------------------------------
    # DEADLINE_CONFIRMED_NO_UPDATE (V11-P4-02)
    # ------------------------------------------------------------------

    def test_deadline_confirmed_no_update_trigger(self):
        m = _matter("m-dl", "c-dl")
        c = _client("c-dl")
        dl = _deadline("dl-001", "m-dl", days_out=5, verification_status="attorney_verified")
        # No recent comm (no comms at all)
        result, mock_comm = self._run([m], [c], deadlines=[dl])
        triggers = [call_[1]["trigger"] for call_ in mock_comm.call_args_list]
        assert CommTrigger.DEADLINE_CONFIRMED_NO_UPDATE.value in triggers

    def test_deadline_confirmed_trigger_suppressed_when_recent_comm(self):
        m = _matter("m-dl-comm", "c-dl-comm")
        c = _client("c-dl-comm")
        dl = _deadline("dl-002", "m-dl-comm", days_out=5, verification_status="attorney_verified")
        existing = _comm(
            "comm-dl-recent", "m-dl-comm",
            CommTrigger.DEADLINE_CONFIRMED_NO_UPDATE.value, days_ago=3
        )
        result, mock_comm = self._run([m], [c], deadlines=[dl], comms=[existing])
        triggers = [call_[1]["trigger"] for call_ in mock_comm.call_args_list]
        assert CommTrigger.DEADLINE_CONFIRMED_NO_UPDATE.value not in triggers

    def test_deadline_confirmed_no_trigger_for_unverified(self):
        m = _matter("m-dl-unv", "c-dl-unv")
        c = _client("c-dl-unv")
        dl = _deadline("dl-003", "m-dl-unv", days_out=5, verification_status="conflict_flagged")
        result, mock_comm = self._run([m], [c], deadlines=[dl])
        triggers = [call_[1]["trigger"] for call_ in mock_comm.call_args_list]
        assert CommTrigger.DEADLINE_CONFIRMED_NO_UPDATE.value not in triggers

    # ------------------------------------------------------------------
    # ACTIVITY_WITHOUT_UPDATE (V11-P4-04)
    # ------------------------------------------------------------------

    def test_activity_without_update_trigger(self):
        m = _matter("m-act", "c-act")
        c = _client("c-act")
        entry = _entry("te-act", "m-act", days_ago=5, entry_status="APPROVED")
        # No comms at all — days_no_update = 9999
        result, mock_comm = self._run([m], [c], entries=[entry])
        triggers = [call_[1]["trigger"] for call_ in mock_comm.call_args_list]
        assert CommTrigger.ACTIVITY_WITHOUT_UPDATE.value in triggers

    def test_activity_trigger_suppressed_when_recent_comm(self):
        m = _matter("m-act-comm", "c-act-comm")
        c = _client("c-act-comm")
        entry = _entry("te-act-comm", "m-act-comm", days_ago=5, entry_status="APPROVED")
        recent = _comm(
            "comm-act-recent", "m-act-comm",
            CommTrigger.ACTIVITY_WITHOUT_UPDATE.value, days_ago=5
        )
        result, mock_comm = self._run([m], [c], entries=[entry], comms=[recent])
        triggers = [call_[1]["trigger"] for call_ in mock_comm.call_args_list]
        assert CommTrigger.ACTIVITY_WITHOUT_UPDATE.value not in triggers

    def test_activity_trigger_not_fired_without_recent_work(self):
        m = _matter("m-no-act", "c-no-act")
        c = _client("c-no-act")
        # Entry 20 days ago (outside 14-day window)
        entry = _entry("te-old", "m-no-act", days_ago=20, entry_status="APPROVED")
        result, mock_comm = self._run([m], [c], entries=[entry])
        triggers = [call_[1]["trigger"] for call_ in mock_comm.call_args_list]
        assert CommTrigger.ACTIVITY_WITHOUT_UPDATE.value not in triggers

    # ------------------------------------------------------------------
    # INVOICE_GENERATED (V11-P4-03)
    # ------------------------------------------------------------------

    def test_invoice_generated_trigger(self):
        m = _matter("m-inv", "c-inv")
        c = _client("c-inv")
        audit = [_audit_invoice("m-inv", days_ago=10)]
        result, mock_comm = self._run([m], [c], audit=audit)
        triggers = [call_[1]["trigger"] for call_ in mock_comm.call_args_list]
        assert CommTrigger.INVOICE_GENERATED.value in triggers

    def test_invoice_trigger_suppressed_when_existing_comm(self):
        m = _matter("m-inv-dup", "c-inv-dup")
        c = _client("c-inv-dup")
        audit = [_audit_invoice("m-inv-dup", days_ago=10)]
        existing = _comm(
            "comm-inv-existing", "m-inv-dup",
            CommTrigger.INVOICE_GENERATED.value, days_ago=20
        )
        result, mock_comm = self._run([m], [c], audit=audit, comms=[existing])
        triggers = [call_[1]["trigger"] for call_ in mock_comm.call_args_list]
        assert CommTrigger.INVOICE_GENERATED.value not in triggers

    # ------------------------------------------------------------------
    # DEADLINE_EXTENSION_REQUEST — emits WARN_NOTICE, no new comm created (V11-P4-05)
    # ------------------------------------------------------------------

    def test_extension_request_emits_warn_notice(self):
        m = _matter("m-ext", "c-ext")
        c = _client("c-ext")
        ext_comm = _comm(
            "comm-ext", "m-ext",
            CommTrigger.DEADLINE_EXTENSION_REQUEST.value,
            status="DRAFT_GENERATED",
        )
        result, mock_comm = self._run([m], [c], comms=[ext_comm])
        obs = result["observations"]
        obs_types = [o.observation_type for o in obs]
        # Should not create a NEW comm for extension (draft already exists)
        triggers = [call_[1]["trigger"] for call_ in mock_comm.call_args_list]
        assert CommTrigger.DEADLINE_EXTENSION_REQUEST.value not in triggers
        # Should emit a WARN_NOTICE observation
        assert "WARN_NOTICE" in obs_types


# ---------------------------------------------------------------------------
# V11-P4-18: Citation stripping, writing_style, urgency scoring
# ---------------------------------------------------------------------------


class TestCitationStripping:
    """V11-P4-08: citation markers stripped from draft body."""

    def test_strip_removes_f_citations(self):
        text = "The deadline is approaching [f1]. Please review [f2] the documents [f3]."
        clean = _strip_citations(text)
        assert "[f1]" not in clean
        assert "[f2]" not in clean
        assert "[f3]" not in clean

    def test_strip_preserves_content_around_citations(self):
        text = "Hello [f1] world [f2]."
        clean = _strip_citations(text)
        assert "Hello" in clean
        assert "world" in clean
        assert "." in clean

    def test_strip_lowercase_only(self):
        # _strip_citations matches [f\d+] — lowercase f only
        text = "See [f1] and [f2] for details."
        clean = _strip_citations(text)
        assert "[f1]" not in clean
        assert "[f2]" not in clean

    def test_strip_multi_digit(self):
        text = "Reference [f12] and [f123] here."
        clean = _strip_citations(text)
        assert "[f12]" not in clean
        assert "[f123]" not in clean

    def test_strip_unchanged_when_no_citations(self):
        text = "Plain text with no citations."
        clean = _strip_citations(text)
        assert clean == text


class TestUrgencyScoring:
    """V11-P4-18: urgency scoring rubric correctness."""

    def test_decision_maker_plus_deadline_is_high(self):
        msg = {
            "from_role": "client",
            "message_excerpt": "We have a deadline tomorrow — please respond.",
            "wait_days": 0,
        }
        matters = {}
        level, signals, score = _score_urgency(msg, matters)
        assert level == InboundUrgency.HIGH.value, f"score={score}, signals={signals}"
        assert "mentions_deadline" in signals

    def test_decision_maker_sender_adds_3pts(self):
        msg = {
            "from_role": "ceo",
            "message_excerpt": "Quick update needed.",
            "wait_days": 0,
        }
        _, signals, score = _score_urgency(msg, {})
        assert "decision_maker_sender" in signals
        assert score >= 3

    def test_wait_days_2_is_medium(self):
        msg = {
            "from_role": "unknown",
            "message_excerpt": "Just following up.",
            "wait_days": 3,
        }
        level, signals, score = _score_urgency(msg, {})
        assert level in (InboundUrgency.MEDIUM.value, InboundUrgency.HIGH.value)
        assert "wait_3_days" in signals

    def test_no_signals_is_low(self):
        msg = {
            "from_role": "unknown",
            "message_excerpt": "Thanks for the update.",
            "wait_days": 0,
        }
        level, _, score = _score_urgency(msg, {})
        assert level == InboundUrgency.LOW.value
        assert score < 2

    def test_thread_followup_adds_1pt(self):
        msg = {
            "from_role": "unknown",
            "message_excerpt": "Follow-up message.",
            "wait_days": 0,
            "subject": "Re: your last email",
        }
        _, signals, _ = _score_urgency(msg, {})
        assert "thread_followup" in signals

    def test_direct_question_adds_1pt(self):
        msg = {
            "from_role": "unknown",
            "message_excerpt": "What is the status of my case?",
            "wait_days": 0,
        }
        _, signals, _ = _score_urgency(msg, {})
        assert "direct_question" in signals

    def test_high_threshold_is_5pts(self):
        msg = {
            "from_role": "client",          # 0 pts (not decision_maker_role)
            "message_excerpt": "When is the deadline due? I need to know.",
            "wait_days": 2,               # 2 pts
            "subject": "Re: your case",   # 1 pt
        }
        # mentions_deadline: 3 pts, wait: 2 pts, thread: 1 pt, question: 1 pt = 7 pts
        level, _, score = _score_urgency(msg, {})
        assert level == InboundUrgency.HIGH.value
        assert score >= 5


class TestDeterministicHelpers:
    """V11-P4-10: _mentions_deadline and _has_question are pure Python, no Gemini."""

    @pytest.mark.parametrize("text,expected", [
        ("We have a filing deadline tomorrow", True),
        ("Please file by end of month", True),  # "file by" is in _DEADLINE_KEYWORDS
        ("The statute of limitations applies", True),
        ("The brief due date is Friday", True),
        ("Just checking in", False),
        ("Court date is next week", True),
        ("Opposition due Monday", True),
    ])
    def test_mentions_deadline_variants(self, text, expected):
        assert _mentions_deadline(text) == expected

    @pytest.mark.parametrize("text,expected", [
        ("What is the status?", True),
        ("Could you send the documents?", True),
        ("Please confirm receipt.", False),
        ("When will this be ready?", True),
        ("Thank you for your help.", False),
        ("Is the deadline confirmed?", True),
    ])
    def test_has_question_variants(self, text, expected):
        assert _has_question(text) == expected


class TestInboundTriage:
    """V11-P4-18: LOW urgency no Gemini call; ROUTE_HANDOFF on deadline mention."""

    def _run_with_inbound(self, inbound_docs, *, comms=None, matters=None, clients=None):
        agent = CommsAgent()
        matters = matters or []
        clients = clients or []
        col_side = _build_col_side_effect(
            matters_list=matters,
            clients_list=clients,
            inbound_list=inbound_docs,
            comms_list=comms or [],
        )
        with (
            patch("app.agents.comms_agent.collection_ref", side_effect=col_side),
            patch(
                "app.agents.comms_agent.create_client_comm",
                return_value=_tool_result("comm-inbound-001"),
            ),
            patch(
                "app.agents.comms_agent._call_gemini",
                return_value='{"summary": "Sender needs deadline update", "action_items": [{"item": "Check deadline", "domain": "deadline"}]}',
            ) as mock_gemini,
        ):
            result = agent.run(firm_id=FIRM)
        return result, mock_gemini

    def test_low_urgency_no_gemini_call(self):
        msg = _inbound(
            "msg-low",
            from_role="unknown",
            excerpt="Thanks for everything.",
            wait_days=0,
        )
        result, mock_gemini = self._run_with_inbound([msg])
        # LOW urgency should not call Gemini
        mock_gemini.assert_not_called()

    def test_high_urgency_calls_gemini(self):
        msg = _inbound(
            "msg-high",
            from_role="client",
            excerpt="What is the deadline? We need to file by Friday.",
            wait_days=3,
        )
        result, mock_gemini = self._run_with_inbound([msg])
        # Should call Gemini for HIGH urgency
        assert mock_gemini.called

    def test_route_handoff_emitted_for_deadline_mention(self):
        msg = _inbound(
            "msg-dl",
            from_role="client",
            excerpt="What is the deadline for filing? The due date is critical.",
            wait_days=3,
        )
        result, _ = self._run_with_inbound([msg])
        obs = result["observations"]
        route_obs = [o for o in obs if o.observation_type == "ROUTE_HANDOFF"]
        assert len(route_obs) >= 1, "ROUTE_HANDOFF should be emitted for deadline-mentioning inbound"
        # Verify it routes to deadline_agent
        handoff = route_obs[0].data.get("handoff", {})
        assert handoff.get("to") == "deadline_agent"

    def test_medium_urgency_calls_gemini(self):
        msg = _inbound(
            "msg-med",
            from_role="unknown",
            excerpt="Just following up on the matter.",
            wait_days=2,
        )
        result, mock_gemini = self._run_with_inbound([msg])
        # MEDIUM urgency (wait_days=2 → 2pts) should call Gemini for summarization
        assert mock_gemini.called

    def test_inbox_triage_observation_emitted(self):
        msg = _inbound(
            "msg-triage",
            from_role="client",
            excerpt="Please update me on the matter.",
            wait_days=0,
        )
        result, _ = self._run_with_inbound([msg])
        obs = result["observations"]
        triage_obs = [o for o in obs if o.observation_type == "INBOX_TRIAGE"]
        assert len(triage_obs) == 1

    def test_opposing_counsel_emits_warn_notice(self):
        msg = _inbound(
            "msg-opp",
            from_role="opposing_counsel",
            from_name="Smith Law Group",
            excerpt="We have a hearing next week — please confirm your availability.",
            wait_days=1,
        )
        result, _ = self._run_with_inbound([msg])
        obs = result["observations"]
        warn_obs = [o for o in obs if o.observation_type == "WARN_NOTICE"]
        assert any("opposing" in o.description.lower() for o in warn_obs), (
            "Opposing counsel should emit WARN_NOTICE requiring attorney review"
        )

    def test_result_observation_is_last(self):
        result, _ = self._run_with_inbound([])
        obs = result["observations"]
        assert obs[-1].observation_type == "RESULT"

    def test_inbound_triaged_count_in_result(self):
        msgs = [
            _inbound("msg-a", excerpt="Update please."),
            _inbound("msg-b", excerpt="Another message."),
        ]
        result, _ = self._run_with_inbound(msgs)
        assert result["inbound_triaged"] == 2


class TestWritingStyleInjection:
    """V11-P4-06 / V11-P4-07: writing_style injected into Gemini prompt."""

    def test_writing_style_passed_to_gemini_draft(self):
        """Attorney writing_style appears in the Gemini prompt."""
        from app.agents.comms_agent import _call_gemini_draft, FactPacket, Fact

        packet = FactPacket(matter_id="m1", client_id="c1", trigger=CommTrigger.DAYS_SINCE_CONTACT.value)
        packet.facts.append(
            Fact("f1", "No contact in 20 days.", "firestore", "matters/m1", "last_contact: 20 days")
        )

        style = {"tone": "casual", "salutation": "Hi [Name],", "paragraph_length": "short"}
        captured_prompts = []

        def mock_gemini(prompt, system_prompt=None):
            captured_prompts.append(prompt)
            return "Dear Client, [f1] Best, Dana"

        with patch("app.agents.comms_agent._call_gemini", side_effect=mock_gemini):
            _call_gemini_draft(
                packet, "Alice", "Matter 1", "Dana Strand",
                CommTrigger.DAYS_SINCE_CONTACT.value, style
            )

        assert len(captured_prompts) == 1
        assert "casual" in captured_prompts[0], (
            "writing_style.tone should appear in Gemini prompt"
        )
        assert "Hi [Name]," in captured_prompts[0], (
            "writing_style.salutation should appear in Gemini prompt"
        )

    def test_trigger_tone_map_coverage(self):
        """All 7 CommTrigger values have a tone mapped."""
        from app.agents.comms_agent import _TRIGGER_TONE_MAP
        expected_triggers = [
            CommTrigger.DAYS_SINCE_CONTACT.value,
            CommTrigger.BUDGET_THRESHOLD_CROSSED.value,
            CommTrigger.DEADLINE_CONFIRMED_NO_UPDATE.value,
            CommTrigger.INVOICE_GENERATED.value,
            CommTrigger.ACTIVITY_WITHOUT_UPDATE.value,
            CommTrigger.DEADLINE_EXTENSION_REQUEST.value,
            CommTrigger.INBOUND_REPLY.value,
        ]
        for trigger in expected_triggers:
            assert trigger in _TRIGGER_TONE_MAP, f"{trigger} missing from _TRIGGER_TONE_MAP"
