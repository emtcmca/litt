"""
Demo fixtures v1.1 — supplemental data for agent visibility showcase.

Adds to the base v1.0 seed without modifying any existing records.
The five v1.0 demo conditions (dl-mercer-001, te-005, te-001, acme-commercial,
whitmore-employment-2026) are preserved exactly.

New fixtures:
  Rivera matter  — elena-rivera client + rivera-employment-2026 matter
  dl-rivera-001  — conflict_flagged HARD_LEGAL deadline (hero demo moment)
  email-rivera-opp-20260528 — opposing counsel email with "tomorrow (Friday)"
  te-009         — Kofi Okafor, 4.0h round hours, no session timer (Okafor calendar gap)
"""

from datetime import datetime, timezone

DEMO_DT = datetime(2026, 6, 25, 16, 30, 0, tzinfo=timezone.utc)


def _dt(y, m, d, h=0, mn=0):
    return datetime(y, m, d, h, mn, 0, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Rivera client
# ---------------------------------------------------------------------------

ELENA_RIVERA_CLIENT = {
    "id": "elena-rivera",
    "firm_id": None,  # patched at seed time
    "name": "Elena Rivera",
    "billing_contact": "Elena Rivera",
    "billing_email": "erivera@personalmail.com",
    "billing_address": "2214 Oak Street, Cleveland, OH 44106",
    "arrangement": "hourly",
    "budget_cap": 20000,
    "budget_billed": 1125,
    "retainer_balance": None,
    "retainer_refill_threshold": None,
    "ledes_client_id": "RIVERA-001",
    "client_matter_id_prefix": "RIVERA",
    "last_client_contact": _dt(2026, 6, 24),  # recent — no silence trigger
    "client_silence_threshold_days": 14,
    "billing_guidelines": {
        "block_billing_allowed": True,
        "travel_time_allowed": True,
        "intraoffice_conference_allowed": "yes",
        "research_requires_preapproval": False,
        "max_daily_hours_without_review": 10.0,
        "forbidden_phrases": [],
        "required_task_codes": False,
        "activity_codes_required": False,
        "ledes_required": False,
        "ai_disclosure_required": False,
        "budget_notice_threshold": 0.75,
        "outside_counsel_guidelines": None,
    },
    "engagement_terms": {
        "fee_type": "hourly",
        "scope_summary": "Employment discrimination claim against former employer",
        "excluded_work": [],
        "retainer_required": False,
        "retainer_amount": None,
        "evergreen_retainer": False,
        "budget_cap": 20000,
        "client_approval_required_above": 20000,
        "outside_counsel_guidelines_attached": False,
        "engagement_letter_signed": True,
        "engagement_letter_date": "2026-04-10",
    },
    "notes": "Contingency cap negotiated. Client prefers email updates.",
    "created_at": _dt(2026, 4, 10, 10),
    "updated_at": _dt(2026, 6, 24, 14),
}


# ---------------------------------------------------------------------------
# Rivera matter
# ---------------------------------------------------------------------------

RIVERA_MATTER = {
    "id": "rivera-employment-2026",
    "firm_id": None,  # patched at seed time
    "client_id": "elena-rivera",
    "client_matter_id": "RIVERA-2026-001",
    "law_firm_matter_id": "rivera-employment-2026",
    "name": "Rivera v. Holbrook Enterprises — Employment Discrimination",
    "type": "litigation",
    "status": "ACTIVE",
    "assigned_attorneys": ["dana-strand", "kofi-okafor"],
    "opened_at": _dt(2026, 4, 10, 10),
    "last_activity": _dt(2026, 6, 24, 14),
    "last_client_contact": _dt(2026, 6, 24, 14),
    "created_at": _dt(2026, 4, 10, 10),
    "updated_at": _dt(2026, 6, 24, 14),
}


# ---------------------------------------------------------------------------
# Rivera deadline — conflict_flagged (the hero demo moment)
#
# Opposing counsel's email references "tomorrow (Friday)" as the discovery
# response deadline. No court order in firm records confirms this date.
# verification_status = "conflict_flagged" triggers the deadline_agent's
# Gemini extraction path → ESCALATION observation (work_kind=llm_assisted).
# ---------------------------------------------------------------------------

DL_RIVERA_001 = {
    "id": "dl-rivera-001",
    "firm_id": None,  # patched at seed time
    "matter_id": "rivera-employment-2026",
    "description": "Rivera v. Holbrook — discovery responses to opposing counsel",
    "due_date": "2026-06-26",  # tomorrow from demo date 2026-06-25
    "classification": "HARD_LEGAL",
    "status": "ACTIVE",
    "source_type": "email",
    "source_document_id": "email-rivera-opp-20260528",
    "source_excerpt": (
        "we expect your client's responses to our First Set of Interrogatories "
        "and Requests for Production by tomorrow (Friday), June 26, 2026"
    ),
    "email_reference": "email-rivera-opp-20260528",
    "conflict_flag": True,
    "conflict_type": "source_mismatch",
    "conflict_detail": (
        "Deadline sourced from opposing counsel email only. "
        "No confirming court order found in firm document sources."
    ),
    "created_by": "dana-strand",
    "verified_by": None,
    "verification_status": "conflict_flagged",
    "supersedes_deadline_id": None,
    "jurisdiction": "Ohio",
    "court": "Cuyahoga County Court of Common Pleas",
    "last_confirmed_by": None,
    "last_confirmed_at": None,
    "version": 1,
    "created_at": _dt(2026, 6, 24, 15, 30),
    "updated_at": _dt(2026, 6, 24, 15, 30),
}


# ---------------------------------------------------------------------------
# Source email — opposing counsel's message
# Stored in source_emails collection for Gemini extraction.
# ---------------------------------------------------------------------------

EMAIL_RIVERA_OPP_20260528 = {
    "id": "email-rivera-opp-20260528",
    "firm_id": None,  # patched at seed time
    "matter_id": "rivera-employment-2026",
    "from_address": "jcolbert@colbertmarsh.com",
    "from_name": "James Colbert",
    "to_address": "dana@strand-okafor.com",
    "subject": "Rivera v. Holbrook Enterprises — Discovery Responses Due",
    "received_at": _dt(2026, 6, 24, 9, 17),
    "body": (
        "Dear Ms. Strand,\n\n"
        "Pursuant to our Rule 26(f) conference on June 11 and the agreed-upon schedule, "
        "we expect your client's responses to our First Set of Interrogatories and "
        "Requests for Production by tomorrow (Friday), June 26, 2026.\n\n"
        "Please confirm receipt of this email and advise immediately if your client "
        "requires an extension. Any extension must be agreed upon in writing before "
        "the current deadline.\n\n"
        "We note that no court order has been entered memorializing this schedule, "
        "and this email serves as the parties' agreed record of the deadline.\n\n"
        "Regards,\n"
        "James Colbert\n"
        "Colbert & Marsh LLP\n"
        "Counsel for Defendant Holbrook Enterprises LLC\n"
        "216-555-0147"
    ),
    "source_system": "gmail",
    "processed": True,
    "created_at": _dt(2026, 6, 24, 9, 20),
    "updated_at": _dt(2026, 6, 24, 9, 20),
}


# ---------------------------------------------------------------------------
# te-009 — Okafor calendar gap
# Kofi billed 4.0 round hours with no session timer on the Rivera matter.
# Triggers ROUND_HOURS_NO_SESSION in anomaly_agent (the Okafor calendar gap obs).
# ---------------------------------------------------------------------------

TE_009 = {
    "id": "te-009",
    "firm_id": None,  # patched at seed time
    "matter_id": "rivera-employment-2026",
    "client_id": "elena-rivera",
    "attorney_id": "kofi-okafor",
    "entry_date": "2026-06-24",
    "hours": 4.0,  # round hours — ROUND_HOURS_NO_SESSION anomaly
    "rate": 375,
    "amount": 1500.00,
    "session_minutes_actual": None,  # no timer data — calendar gap
    "billing_increment": 0.1,
    "task_code": "L200",
    "activity_code": None,
    "expense_code": None,
    "narrative": (
        "Initial case consultation with client; reviewed employment records, "
        "EEOC filing, and Holbrook's discovery requests; outlined defense strategy "
        "and identified key witnesses."
    ),
    "status": "PENDING",
    "invoice_id": None,
    "ai_assisted": False,
    "ai_tool": None,
    "model": None,
    "ai_cost_usd": None,
    "human_minutes_actual": None,
    "ai_minutes_estimated": None,
    "output_type": None,
    "human_review_completed": False,
    "reviewing_attorney_id": None,
    "client_ai_disclosure_required": False,
    "client_ai_disclosure_status": None,
    "billing_treatment": None,
    "activity_log": [],
    "write_down_record": None,
    "write_off_record": None,
    "version": 1,
    "created_at": _dt(2026, 6, 24, 18, 0),
    "updated_at": _dt(2026, 6, 24, 18, 0),
}


# ---------------------------------------------------------------------------
# Convenience list — all v1.1 supplemental records
# ---------------------------------------------------------------------------

V11_FIXTURES = {
    "clients": [ELENA_RIVERA_CLIENT],
    "matters": [RIVERA_MATTER],
    "deadlines": [DL_RIVERA_001],
    "source_emails": [EMAIL_RIVERA_OPP_20260528],
    "time_entries": [],  # te-009 removed — round hours triggered too many sweep anomalies
}
