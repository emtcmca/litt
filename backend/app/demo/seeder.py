"""
Demo seeder — reproduces the full Strand & Okafor LLP seed data.
Used by POST /api/demo/reset. Uses app.db.get_db() — same client as the app.

Demo date anchor: 2026-06-25. All relative dates computed from this anchor.
"""

from datetime import datetime, timezone

from app import config
from app.db import get_db

FIRM_ID = config.DEMO_FIRM_ID

DEMO_DT = datetime(2026, 6, 25, 16, 30, 0, tzinfo=timezone.utc)
FIRM_SETUP_DT = datetime(2026, 1, 15, 9, 0, 0, tzinfo=timezone.utc)


def _dt(y, m, d, h=0, mn=0):
    return datetime(y, m, d, h, mn, 0, tzinfo=timezone.utc)


def _col(db, name):
    return db.collection("firms").document(FIRM_ID).collection(name)


_COLLECTIONS = [
    "attorneys", "clients", "matters", "time_entries",
    "deadlines", "deadline_events", "client_communications",
    "invoices", "escalations", "audit_log", "ingestion_signals",
    "idempotency_keys",
    "source_emails",      # v1.1 — Rivera opposing-counsel email
    "agent_runs",         # observability telemetry — cleared on reset so timelines don't accumulate
    "inbound_messages",   # v1.1.1 — inbound triage pass
]


def delete_firm_data(db=None) -> int:
    """Delete all documents under firms/{FIRM_ID}. Returns total doc count deleted."""
    if db is None:
        db = get_db()
    total = 0
    for col_name in _COLLECTIONS:
        docs = list(_col(db, col_name).stream())
        for doc in docs:
            doc.reference.delete()
        total += len(docs)
    return total


def seed_firm_data(db=None) -> None:
    """Seed complete Strand & Okafor LLP demo data."""
    if db is None:
        db = get_db()

    acme_guidelines = {
        "block_billing_allowed": False,
        "travel_time_allowed": False,
        "intraoffice_conference_allowed": "limited",
        "research_requires_preapproval": False,
        "max_daily_hours_without_review": 8.0,
        "forbidden_phrases": ["attention to file", "review documents", "work on matter", "various matters"],
        "required_task_codes": True,
        "activity_codes_required": False,
        "ledes_required": True,
        "ai_disclosure_required": True,
        "budget_notice_threshold": 0.75,
        "outside_counsel_guidelines": "Acme OCG v2.1",
    }
    acme_terms = {
        "fee_type": "hourly",
        "scope_summary": "Review and negotiate commercial vendor agreements",
        "excluded_work": [],
        "retainer_required": True,
        "retainer_amount": 5000,
        "evergreen_retainer": True,
        "budget_cap": 15000,
        "client_approval_required_above": 15000,
        "outside_counsel_guidelines_attached": True,
        "engagement_letter_signed": True,
        "engagement_letter_date": "2026-01-15",
    }
    default_guidelines = {
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
    }
    default_terms = {
        "fee_type": "hourly",
        "scope_summary": "",
        "excluded_work": [],
        "retainer_required": False,
        "retainer_amount": None,
        "evergreen_retainer": False,
        "budget_cap": None,
        "client_approval_required_above": None,
        "outside_counsel_guidelines_attached": False,
        "engagement_letter_signed": True,
        "engagement_letter_date": "2026-01-15",
    }

    # -- attorneys --
    _col(db, "attorneys").document("dana-strand").set({
        "id": "dana-strand", "firm_id": FIRM_ID,
        "name": "Dana Strand", "email": "dana@strand-okafor.com",
        "default_rate": 350, "billing_increment": 0.1,
        "timekeeper_id": "ds001", "timekeeper_classification": "AT",
        "rate_overrides": {}, "permission_scope": ["billing", "deadlines", "comms", "admin"],
        "is_backup_contact": True,
        "writing_style": {
            "tone": "professional and warm",
            "salutation": "Dear [First Name],",
            "closing": "Best regards,\nDana Strand",
            "paragraph_length": "short",
            "avoid": ["passive voice", "legalese in client letters"],
            "preferred_update_structure": "status first, next steps second, ask at end",
        },
        "created_at": FIRM_SETUP_DT, "updated_at": FIRM_SETUP_DT,
    })
    _col(db, "attorneys").document("kofi-okafor").set({
        "id": "kofi-okafor", "firm_id": FIRM_ID,
        "name": "Kofi Okafor", "email": "kofi@strand-okafor.com",
        "default_rate": 375, "billing_increment": 0.1,
        "timekeeper_id": "ko001", "timekeeper_classification": "AT",
        "rate_overrides": {}, "permission_scope": ["billing", "deadlines", "comms", "admin"],
        "is_backup_contact": False, "created_at": FIRM_SETUP_DT, "updated_at": FIRM_SETUP_DT,
    })

    # -- clients --
    _col(db, "clients").document("acme-commercial").set({
        "id": "acme-commercial", "firm_id": FIRM_ID,
        "name": "Acme Commercial Partners LLC",
        "billing_contact": "James Whitfield",
        "billing_email": "jwhitfield@acme-commercial.com",
        "billing_address": "500 Main St, Chicago, IL 60601",
        "arrangement": "hourly", "budget_cap": 15000, "budget_billed": 13100,
        "retainer_balance": 800, "retainer_refill_threshold": 1000,
        "ledes_client_id": "ACME-COM-001", "client_matter_id_prefix": "ACME",
        "last_client_contact": _dt(2026, 6, 17),
        "client_silence_threshold_days": 14,
        "billing_guidelines": acme_guidelines,
        "engagement_terms": acme_terms,
        "notes": "Prefers monthly invoices. Budget warning at 75%.",
        "created_at": FIRM_SETUP_DT, "updated_at": DEMO_DT,
    })
    _col(db, "clients").document("mercer-industries").set({
        "id": "mercer-industries", "firm_id": FIRM_ID,
        "name": "Mercer Industries",
        "billing_contact": "Patricia Mercer",
        "billing_email": "pmercer@mercerindustries.com",
        "billing_address": "1200 Industrial Blvd, Cleveland, OH 44101",
        "arrangement": "hourly", "budget_cap": 25000, "budget_billed": 8000,
        "retainer_balance": None, "retainer_refill_threshold": None,
        "ledes_client_id": "MERCER-001", "client_matter_id_prefix": "MERCER",
        "last_client_contact": _dt(2026, 6, 5),  # 20 days before demo date — triggers silence
        "client_silence_threshold_days": 14,
        "billing_guidelines": default_guidelines,
        "engagement_terms": {**default_terms, "budget_cap": 25000},
        "notes": None, "created_at": FIRM_SETUP_DT, "updated_at": DEMO_DT,
    })
    _col(db, "clients").document("reyes-family-holdings").set({
        "id": "reyes-family-holdings", "firm_id": FIRM_ID,
        "name": "Reyes Family Holdings LLC",
        "billing_contact": "Carlos Reyes",
        "billing_email": "creyes@reyesholdings.com",
        "billing_address": "800 Lakeside Dr, Cleveland, OH 44114",
        "arrangement": "hourly", "budget_cap": 18000, "budget_billed": 5500,
        "retainer_balance": None, "retainer_refill_threshold": None,
        "ledes_client_id": "REYES-001", "client_matter_id_prefix": "REYES",
        "last_client_contact": _dt(2026, 6, 21),
        "client_silence_threshold_days": 14,
        "billing_guidelines": default_guidelines,
        "engagement_terms": {**default_terms, "budget_cap": 18000},
        "notes": None, "created_at": FIRM_SETUP_DT, "updated_at": DEMO_DT,
    })
    _col(db, "clients").document("whitmore-group").set({
        "id": "whitmore-group", "firm_id": FIRM_ID,
        "name": "Whitmore Group",
        "billing_contact": "Sandra Whitmore",
        "billing_email": "swhitmore@whitmoregroup.com",
        "billing_address": "350 Commerce Pkwy, Cleveland, OH 44135",
        "arrangement": "hourly", "budget_cap": 12000, "budget_billed": 4388,
        "retainer_balance": None, "retainer_refill_threshold": None,
        "ledes_client_id": "WHITMORE-001", "client_matter_id_prefix": "WHIT",
        "last_client_contact": _dt(2026, 6, 9),  # 16 days before demo date
        "client_silence_threshold_days": 14,
        "billing_guidelines": default_guidelines,
        "engagement_terms": {**default_terms, "budget_cap": 12000},
        "notes": "Monthly status updates preferred.",
        "created_at": FIRM_SETUP_DT, "updated_at": DEMO_DT,
    })

    # -- matters --
    _col(db, "matters").document("mercer-v-dunlap").set({
        "id": "mercer-v-dunlap", "firm_id": FIRM_ID,
        "client_id": "mercer-industries",
        "client_matter_id": "MERCER-2026-001",
        "law_firm_matter_id": "mercer-v-dunlap",
        "name": "Mercer Industries v. Dunlap Construction",
        "type": "litigation", "status": "ACTIVE",
        "assigned_attorneys": ["dana-strand", "kofi-okafor"],
        "opened_at": _dt(2026, 1, 20), "last_activity": _dt(2026, 6, 24),
        "last_client_contact": _dt(2026, 6, 5),  # 20 days before demo date
        "created_at": _dt(2026, 1, 20), "updated_at": DEMO_DT,
    })
    _col(db, "matters").document("reyes-acquisition").set({
        "id": "reyes-acquisition", "firm_id": FIRM_ID,
        "client_id": "reyes-family-holdings",
        "client_matter_id": "REYES-2026-001",
        "law_firm_matter_id": "reyes-acquisition",
        "name": "Reyes Family Holdings — LOI Acquisition",
        "type": "transactional", "status": "ACTIVE",
        "assigned_attorneys": ["dana-strand", "kofi-okafor"],
        "opened_at": _dt(2026, 2, 10), "last_activity": _dt(2026, 6, 23),
        "last_client_contact": _dt(2026, 6, 21),
        "created_at": _dt(2026, 2, 10), "updated_at": DEMO_DT,
    })
    _col(db, "matters").document("acme-contract-review-2026").set({
        "id": "acme-contract-review-2026", "firm_id": FIRM_ID,
        "client_id": "acme-commercial",
        "client_matter_id": "ACME-2026-0042",
        "law_firm_matter_id": "acme-contract-review-2026",
        "name": "Acme Commercial — Vendor MSA Review",
        "type": "transactional", "status": "ACTIVE",
        "assigned_attorneys": ["dana-strand"],
        "opened_at": _dt(2026, 1, 15), "last_activity": _dt(2026, 6, 24),
        "last_client_contact": _dt(2026, 6, 17),
        "created_at": _dt(2026, 1, 15), "updated_at": DEMO_DT,
    })
    _col(db, "matters").document("whitmore-employment-2026").set({
        "id": "whitmore-employment-2026", "firm_id": FIRM_ID,
        "client_id": "whitmore-group",
        "client_matter_id": "WHIT-2026-001",
        "law_firm_matter_id": "whitmore-employment-2026",
        "name": "Whitmore Group — Employment Advisory",
        "type": "advisory", "status": "ACTIVE",
        "assigned_attorneys": ["dana-strand", "kofi-okafor"],
        "opened_at": _dt(2026, 3, 1), "last_activity": _dt(2026, 6, 9),
        "last_client_contact": _dt(2026, 6, 9),  # 16 days before demo date
        "created_at": _dt(2026, 3, 1), "updated_at": _dt(2026, 6, 9),
    })

    # -- time entries --
    entries = [
        {   # te-001: PENDING, no narrative
            "id": "te-001", "firm_id": FIRM_ID, "matter_id": "mercer-v-dunlap",
            "client_id": "mercer-industries", "attorney_id": "dana-strand",
            "entry_date": "2026-06-23", "hours": 1.4, "rate": 350, "amount": 490.00,
            "session_minutes_actual": 83, "billing_increment": 0.1,
            "task_code": "L200", "activity_code": None, "expense_code": None,
            "narrative": None, "status": "PENDING", "invoice_id": None,
            "ai_assisted": False, "ai_tool": None, "model": None, "ai_cost_usd": None,
            "human_minutes_actual": 83, "ai_minutes_estimated": None,
            "output_type": None, "human_review_completed": False,
            "reviewing_attorney_id": None, "client_ai_disclosure_required": False,
            "client_ai_disclosure_status": None, "billing_treatment": None,
            "activity_log": [], "write_down_record": None, "write_off_record": None,
            "version": 1, "created_at": _dt(2026, 6, 23, 17), "updated_at": _dt(2026, 6, 23, 17),
        },
        {   # te-002: APPROVED, clean
            "id": "te-002", "firm_id": FIRM_ID, "matter_id": "mercer-v-dunlap",
            "client_id": "mercer-industries", "attorney_id": "dana-strand",
            "entry_date": "2026-06-22", "hours": 0.5, "rate": 350, "amount": 175.00,
            "session_minutes_actual": 29, "billing_increment": 0.1,
            "task_code": "L300", "activity_code": "A106", "expense_code": None,
            "narrative": "Reviewed deposition transcript of opposing expert; noted key inconsistencies for cross-examination outline.",
            "status": "APPROVED", "invoice_id": None,
            "ai_assisted": False, "ai_tool": None, "model": None, "ai_cost_usd": None,
            "human_minutes_actual": 29, "ai_minutes_estimated": None,
            "output_type": None, "human_review_completed": False,
            "reviewing_attorney_id": None, "client_ai_disclosure_required": False,
            "client_ai_disclosure_status": None, "billing_treatment": None,
            "activity_log": [], "write_down_record": None, "write_off_record": None,
            "version": 2, "created_at": _dt(2026, 6, 22, 16, 45), "updated_at": _dt(2026, 6, 23, 9),
        },
        {   # te-003: PENDING, clean
            "id": "te-003", "firm_id": FIRM_ID, "matter_id": "reyes-acquisition",
            "client_id": "reyes-family-holdings", "attorney_id": "dana-strand",
            "entry_date": "2026-06-24", "hours": 0.8, "rate": 350, "amount": 280.00,
            "session_minutes_actual": 47, "billing_increment": 0.1,
            "task_code": "A100", "activity_code": "A104", "expense_code": None,
            "narrative": "Reviewed and marked up LOI draft; circulated redline to client for review prior to counterparty submission.",
            "status": "PENDING", "invoice_id": None,
            "ai_assisted": True, "ai_tool": "Gemini", "model": "gemini-2.5-pro", "ai_cost_usd": 0.11,
            "human_minutes_actual": 47, "ai_minutes_estimated": 4,
            "output_type": "redline", "human_review_completed": True,
            "reviewing_attorney_id": "dana-strand", "client_ai_disclosure_required": False,
            "client_ai_disclosure_status": "not_required", "billing_treatment": "billed_as_human_review",
            "activity_log": [], "write_down_record": None, "write_off_record": None,
            "version": 1, "created_at": _dt(2026, 6, 24, 15), "updated_at": _dt(2026, 6, 24, 15),
        },
        {   # te-004: PENDING, round hours no session
            "id": "te-004", "firm_id": FIRM_ID, "matter_id": "reyes-acquisition",
            "client_id": "reyes-family-holdings", "attorney_id": "kofi-okafor",
            "entry_date": "2026-06-23", "hours": 1.2, "rate": 375, "amount": 450.00,
            "session_minutes_actual": None, "billing_increment": 0.1,
            "task_code": "A200", "activity_code": None, "expense_code": None,
            "narrative": "Negotiation strategy conference and due diligence coordination for target entity review.",
            "status": "PENDING", "invoice_id": None,
            "ai_assisted": False, "ai_tool": None, "model": None, "ai_cost_usd": None,
            "human_minutes_actual": None, "ai_minutes_estimated": None,
            "output_type": None, "human_review_completed": False,
            "reviewing_attorney_id": None, "client_ai_disclosure_required": False,
            "client_ai_disclosure_status": None, "billing_treatment": None,
            "activity_log": [], "write_down_record": None, "write_off_record": None,
            "version": 1, "created_at": _dt(2026, 6, 23, 18), "updated_at": _dt(2026, 6, 23, 18),
        },
        {   # te-005: PENDING, forbidden phrase "review documents"
            "id": "te-005", "firm_id": FIRM_ID, "matter_id": "acme-contract-review-2026",
            "client_id": "acme-commercial", "attorney_id": "dana-strand",
            "entry_date": "2026-06-24", "hours": 0.8, "rate": 350, "amount": 280.00,
            "session_minutes_actual": 46, "billing_increment": 0.1,
            "task_code": "A100", "activity_code": None, "expense_code": None,
            "narrative": "review documents relating to vendor MSA indemnification provisions.",
            "status": "PENDING", "invoice_id": None,
            "ai_assisted": False, "ai_tool": None, "model": None, "ai_cost_usd": None,
            "human_minutes_actual": 46, "ai_minutes_estimated": None,
            "output_type": None, "human_review_completed": False,
            "reviewing_attorney_id": None, "client_ai_disclosure_required": True,
            "client_ai_disclosure_status": None, "billing_treatment": None,
            "activity_log": [], "write_down_record": None, "write_off_record": None,
            "version": 1, "created_at": _dt(2026, 6, 24, 11), "updated_at": _dt(2026, 6, 24, 11),
        },
        {   # te-010: PENDING, AI-assisted, NO disclosure status — triggers AI_DISCLOSURE_GAP
            "id": "te-010", "firm_id": FIRM_ID, "matter_id": "acme-contract-review-2026",
            "client_id": "acme-commercial", "attorney_id": "dana-strand",
            "entry_date": "2026-06-23", "hours": 1.5, "rate": 350, "amount": 525.00,
            "session_minutes_actual": 62, "billing_increment": 0.1,
            "task_code": "A100", "activity_code": "A104", "expense_code": None,
            "narrative": "Analyzed three vendor data-processing addenda using Gemini-assisted clause extraction; summarized compliance gaps against Acme standard requirements and prepared markup recommendations.",
            "status": "PENDING", "invoice_id": None,
            "ai_assisted": True, "ai_tool": "Gemini", "model": "gemini-2.5-pro", "ai_cost_usd": 0.14,
            "human_minutes_actual": 62, "ai_minutes_estimated": 11,
            "output_type": "analysis", "human_review_completed": True,
            "reviewing_attorney_id": "dana-strand", "client_ai_disclosure_required": True,
            "client_ai_disclosure_status": None,  # NOT SET — anomaly_agent fires AI_DISCLOSURE_GAP
            "billing_treatment": None,
            "activity_log": [], "write_down_record": None, "write_off_record": None,
            "version": 1, "created_at": _dt(2026, 6, 23, 14), "updated_at": _dt(2026, 6, 23, 14),
        },
        {   # te-011: PENDING, duplicate of te-001 — same attorney/matter/date/hours
            "id": "te-011", "firm_id": FIRM_ID, "matter_id": "mercer-v-dunlap",
            "client_id": "mercer-industries", "attorney_id": "dana-strand",
            "entry_date": "2026-06-23", "hours": 1.4, "rate": 350, "amount": 490.00,
            "session_minutes_actual": None, "billing_increment": 0.1,
            "task_code": "L200", "activity_code": None, "expense_code": None,
            "narrative": "Continued review of MSJ opposition brief; researched procedural posture on summary judgment standard in Cuyahoga County.",
            "status": "PENDING", "invoice_id": None,
            "ai_assisted": False, "ai_tool": None, "model": None, "ai_cost_usd": None,
            "human_minutes_actual": None, "ai_minutes_estimated": None,
            "output_type": None, "human_review_completed": False,
            "reviewing_attorney_id": None, "client_ai_disclosure_required": False,
            "client_ai_disclosure_status": None, "billing_treatment": None,
            "activity_log": [], "write_down_record": None, "write_off_record": None,
            "version": 1, "created_at": _dt(2026, 6, 23, 17, 30), "updated_at": _dt(2026, 6, 23, 17, 30),
        },
        {   # te-006: APPROVED — committed = 13100 billed + 700 unbilled = 13800 / 15000 = 92% CRITICAL
            "id": "te-006", "firm_id": FIRM_ID, "matter_id": "acme-contract-review-2026",
            "client_id": "acme-commercial", "attorney_id": "dana-strand",
            "entry_date": "2026-06-18", "hours": 2.0, "rate": 350, "amount": 700.00,
            "session_minutes_actual": None, "billing_increment": 0.1,
            "task_code": "A100", "activity_code": None, "expense_code": None,
            "narrative": "Analyzed indemnification and limitation of liability clauses in vendor MSA redline; drafted response memo for client review.",
            "status": "APPROVED", "invoice_id": None,
            "ai_assisted": True, "ai_tool": "Gemini", "model": "gemini-2.5-pro", "ai_cost_usd": 0.18,
            "human_minutes_actual": None, "ai_minutes_estimated": 8,
            "output_type": "analysis", "human_review_completed": True,
            "reviewing_attorney_id": "dana-strand", "client_ai_disclosure_required": True,
            "client_ai_disclosure_status": "included", "billing_treatment": "billed_as_human_review",
            "activity_log": [], "write_down_record": None, "write_off_record": None,
            "version": 2, "created_at": _dt(2026, 6, 18, 17), "updated_at": _dt(2026, 6, 19, 9, 30),
        },
        {   # te-007: BILLED
            "id": "te-007", "firm_id": FIRM_ID, "matter_id": "whitmore-employment-2026",
            "client_id": "whitmore-group", "attorney_id": "dana-strand",
            "entry_date": "2026-06-08", "hours": 0.6, "rate": 350, "amount": 210.00,
            "session_minutes_actual": 35, "billing_increment": 0.1,
            "task_code": "A200", "activity_code": "A104", "expense_code": None,
            "narrative": "Researched FLSA exemption requirements applicable to Whitmore Group's proposed re-classification of sales staff.",
            "status": "BILLED", "invoice_id": "INV-2026-006",
            "ai_assisted": False, "ai_tool": None, "model": None, "ai_cost_usd": None,
            "human_minutes_actual": 35, "ai_minutes_estimated": None,
            "output_type": None, "human_review_completed": False,
            "reviewing_attorney_id": None, "client_ai_disclosure_required": False,
            "client_ai_disclosure_status": None, "billing_treatment": None,
            "activity_log": [], "write_down_record": None, "write_off_record": None,
            "version": 3, "created_at": _dt(2026, 6, 8, 16), "updated_at": _dt(2026, 6, 13, 10),
        },
        {   # te-008: APPROVED, kofi, whitmore
            "id": "te-008", "firm_id": FIRM_ID, "matter_id": "whitmore-employment-2026",
            "client_id": "whitmore-group", "attorney_id": "kofi-okafor",
            "entry_date": "2026-06-16", "hours": 1.1, "rate": 375, "amount": 412.50,
            "session_minutes_actual": 65, "billing_increment": 0.1,
            "task_code": "A200", "activity_code": "A107", "expense_code": None,
            "narrative": "Reviewed employment handbook provisions and drafted recommended policy amendments addressing remote-work and AI-tool usage disclosures.",
            "status": "APPROVED", "invoice_id": None,
            "ai_assisted": True, "ai_tool": "Gemini", "model": "gemini-2.5-pro", "ai_cost_usd": 0.09,
            "human_minutes_actual": 65, "ai_minutes_estimated": 5,
            "output_type": "draft", "human_review_completed": True,
            "reviewing_attorney_id": "kofi-okafor", "client_ai_disclosure_required": False,
            "client_ai_disclosure_status": "not_required", "billing_treatment": "billed_as_human_review",
            "activity_log": [], "write_down_record": None, "write_off_record": None,
            "version": 2, "created_at": _dt(2026, 6, 16, 15), "updated_at": _dt(2026, 6, 17, 9),
        },
    ]
    for entry in entries:
        _col(db, "time_entries").document(entry["id"]).set(entry)

    # -- deadlines --
    _col(db, "deadlines").document("dl-mercer-001").set({
        "id": "dl-mercer-001", "firm_id": FIRM_ID, "matter_id": "mercer-v-dunlap",
        "description": "Opposition to defendant's motion for summary judgment due",
        "due_date": "2026-07-01", "classification": "HARD_LEGAL",
        "status": "ACTIVE", "source_type": "court_order",
        "source_document_id": "court-order-2026-0508",
        "source_excerpt": "Plaintiff's opposition shall be filed no later than July 1, 2026.",
        "created_by": "dana-strand", "verified_by": "dana-strand",
        "verification_status": "attorney_verified",
        "supersedes_deadline_id": None, "jurisdiction": "Ohio",
        "court": "Cuyahoga County Court of Common Pleas",
        "last_confirmed_by": None, "last_confirmed_at": None,
        "created_at": _dt(2026, 5, 8, 10, 30), "updated_at": _dt(2026, 5, 8, 10, 30),
        "version": 1,
    })
    _col(db, "deadlines").document("dl-reyes-001").set({
        "id": "dl-reyes-001", "firm_id": FIRM_ID, "matter_id": "reyes-acquisition",
        "description": "LOI acceptance window closes — counterparty signature required",
        "due_date": "2026-07-06", "classification": "HARD_CONTRACTUAL",
        "status": "ACTIVE", "source_type": "contract",
        "source_document_id": "email-reyes-loi-20260518",
        "source_excerpt": "Acceptance must be executed and returned no later than July 6, 2026.",
        "created_by": "dana-strand", "verified_by": "dana-strand",
        "verification_status": "attorney_verified",
        "supersedes_deadline_id": None, "jurisdiction": "Ohio", "court": None,
        "last_confirmed_by": None, "last_confirmed_at": None,
        "created_at": _dt(2026, 5, 18, 14), "updated_at": _dt(2026, 5, 18, 14),
        "version": 1,
    })

    # -- client communications --
    # comm-001: prior sent update — SENT_CONFIRMED (terminal) so sweep re-triggers silence
    # and fires the BLOCKED gate when it creates a new draft.
    _col(db, "client_communications").document("comm-001").set({
        "id": "comm-001", "firm_id": FIRM_ID,
        "matter_id": "whitmore-employment-2026", "client_id": "whitmore-group",
        "trigger": "DAYS_SINCE_CONTACT",
        "draft_body": (
            "Dear Sandra,\n\n"
            "I wanted to reach out with a brief update on the Whitmore Group employment advisory matter.\n\n"
            "Our team has completed the initial review of the employment handbook and drafted recommended "
            "policy amendments. We are prepared to schedule a call at your convenience to walk through "
            "the proposed changes.\n\n"
            "Please let us know a time that works for your schedule.\n\n"
            "Best regards,\nDana Strand"
        ),
        "source_map": [
            {
                "fact_id": "f1",
                "fact_text": "No confirmed client contact since June 2, 2026.",
                "sentence_in_draft": "I wanted to reach out with a brief update on the Whitmore Group employment advisory matter.",
                "source_type": "firestore",
                "source_id": "matters/whitmore-employment-2026",
                "source_excerpt": "last_client_contact: 2026-06-02",
            },
            {
                "fact_id": "f2",
                "fact_text": "te-008 (APPROVED, June 16) — reviewed handbook and drafted policy amendments.",
                "sentence_in_draft": "Our team has completed the initial review of the employment handbook and drafted recommended policy amendments.",
                "source_type": "firestore",
                "source_id": "time_entries/te-008",
                "source_excerpt": "Reviewed employment handbook provisions and drafted recommended policy amendments",
            },
        ],
        "status": "SENT_CONFIRMED",
        "approved_by": "dana-strand", "approved_at": _dt(2026, 6, 10, 9),
        "queued_at": _dt(2026, 6, 10, 9, 5),
        "sent_confirmed_at": _dt(2026, 6, 10, 9, 10),
        "dismissal_reason": None,
        "version": 3, "created_at": _dt(2026, 6, 9, 17), "updated_at": _dt(2026, 6, 10, 9, 10),
    })

    # -- invoice --
    _col(db, "invoices").document("INV-2026-006").set({
        "id": "INV-2026-006", "firm_id": FIRM_ID, "client_id": "whitmore-group",
        "period_start": "2026-06-01", "period_end": "2026-06-15",
        "total_hours": 0.6, "total_amount": 210.00,
        "retainer_draw": None, "retainer_balance_after": None,
        "exhibit_md": "# Invoice INV-2026-006\n\n**Whitmore Group** — June 1–15, 2026",
        "ledes_file_path": None, "status": "ISSUED",
        "issued_at": _dt(2026, 6, 16, 9), "paid_at": None, "days_outstanding": 9,
        "created_at": _dt(2026, 6, 16, 9), "updated_at": _dt(2026, 6, 16, 9),
    })

    # -- ingestion signals --
    _col(db, "ingestion_signals").document("sig-gmail-mercer-dl").set({
        "id": "sig-gmail-mercer-dl", "firm_id": FIRM_ID,
        "source_system": "gmail", "source_id": "gmail-court-order-20260508",
        "source_hash": "sha256-mercer-opposition-july1-2026",
        "signal_type": "deadline_candidate", "extracted_date": "2026-07-01",
        "matter_id": "mercer-v-dunlap", "processed": True,
        "outcome_id": "dl-mercer-001",
        "first_seen_at": _dt(2026, 5, 8, 11), "last_seen_at": _dt(2026, 5, 8, 11),
        "created_at": _dt(2026, 5, 8, 11), "updated_at": _dt(2026, 5, 8, 11),
    })

    # -- v1.1.1 inbound messages (4 fixtures, all AWAITING_TRIAGE) --
    inbound_messages = [
        {
            "id": "inbound-mercer-q1",
            "firm_id": FIRM_ID,
            "source_email_id": None,
            "matter_id": "mercer-v-dunlap",
            "client_id": "mercer-industries",
            "from_name": "Patricia Mercer",
            "from_role": "client",
            "received_at": _dt(2026, 6, 23, 11, 30),
            "wait_days": 2,
            "urgency": "HIGH",
            "urgency_signals": ["mentions deadline", "decision-maker", "wait_days >= 2"],
            "message_excerpt": (
                "Dana, just checking in on the Dunlap opposition brief — do you still expect to "
                "file by Thursday? I want to be sure we're on track given the July 1st deadline."
            ),
            "summary": None,
            "action_items": [{"text": "Confirm opposition brief status for July 1 deadline", "handoff_agent": "deadline_agent"}],
            "suggested_reply_comm_id": None,
            "cross_agent": True,
            "status": "AWAITING_TRIAGE",
            "version": 1,
            "created_at": _dt(2026, 6, 23, 11, 30),
            "updated_at": _dt(2026, 6, 23, 11, 30),
        },
        {
            "id": "inbound-acme-billing",
            "firm_id": FIRM_ID,
            "source_email_id": None,
            "matter_id": "acme-contract-review-2026",
            "client_id": "acme-commercial",
            "from_name": "James Whitfield",
            "from_role": "client",
            "received_at": _dt(2026, 6, 22, 14, 0),
            "wait_days": 3,
            "urgency": "MEDIUM",
            "urgency_signals": ["budget concern", "wait_days >= 2"],
            "message_excerpt": (
                "Hi Dana, I noticed we're getting close to our $15,000 budget on the MSA review. "
                "Can you give me a sense of what's left to complete and whether we'll need to extend the cap?"
            ),
            "summary": None,
            "action_items": [{"text": "Provide budget status update and remaining scope estimate", "handoff_agent": "billing_agent"}],
            "suggested_reply_comm_id": None,
            "cross_agent": True,
            "status": "AWAITING_TRIAGE",
            "version": 1,
            "created_at": _dt(2026, 6, 22, 14, 0),
            "updated_at": _dt(2026, 6, 22, 14, 0),
        },
        {
            "id": "inbound-opp-counsel-001",
            "firm_id": FIRM_ID,
            "source_email_id": None,
            "matter_id": "mercer-v-dunlap",
            "client_id": "mercer-industries",
            "from_name": "Robert Dunlap (Counsel)",
            "from_role": "opposing_counsel",
            "received_at": _dt(2026, 6, 24, 9, 15),
            "wait_days": 1,
            "urgency": "HIGH",
            "urgency_signals": ["opposing counsel", "mentions deadline", "decision-maker"],
            "message_excerpt": (
                "Ms. Strand, we are proposing a mutual 14-day extension on all pending summary judgment "
                "briefing. Please advise by COB Friday whether plaintiff agrees to the proposed extension."
            ),
            "summary": None,
            "action_items": [
                {"text": "Advise on 14-day extension proposal — requires attorney decision", "handoff_agent": None},
                {"text": "If extension agreed, update dl-mercer-001 due date", "handoff_agent": "deadline_agent"},
            ],
            "suggested_reply_comm_id": None,
            "cross_agent": True,
            "status": "AWAITING_TRIAGE",
            "version": 1,
            "created_at": _dt(2026, 6, 24, 9, 15),
            "updated_at": _dt(2026, 6, 24, 9, 15),
        },
        {
            "id": "inbound-whitmore-update",
            "firm_id": FIRM_ID,
            "source_email_id": None,
            "matter_id": "whitmore-employment-2026",
            "client_id": "whitmore-group",
            "from_name": "Sandra Whitmore",
            "from_role": "client",
            "received_at": _dt(2026, 6, 25, 8, 0),
            "wait_days": 0,
            "urgency": "LOW",
            "urgency_signals": [],
            "message_excerpt": (
                "Thank you for the handbook update, Dana. Happy to connect whenever you have availability."
            ),
            "summary": None,
            "action_items": [],
            "suggested_reply_comm_id": None,
            "cross_agent": False,
            "status": "AWAITING_TRIAGE",
            "version": 1,
            "created_at": _dt(2026, 6, 25, 8, 0),
            "updated_at": _dt(2026, 6, 25, 8, 0),
        },
    ]
    for msg in inbound_messages:
        _col(db, "inbound_messages").document(msg["id"]).set(msg)

    # -- v1.1 supplemental fixtures (Rivera + Okafor calendar gap) --
    # Additive only — no existing v1.0 records are modified.
    _seed_v11_fixtures(db)


def _seed_v11_fixtures(db) -> None:
    """
    Seed v1.1 supplemental fixtures: Rivera matter + conflict_flagged deadline +
    source email + Okafor calendar-gap time entry.
    None of these touch existing v1.0 records.
    """
    from app.demo.fixtures_v11 import V11_FIXTURES

    for collection_name, records in V11_FIXTURES.items():
        for record in records:
            doc = {**record, "firm_id": FIRM_ID}
            _col(db, collection_name).document(doc["id"]).set(doc)


def run_reset(firm_id: str = FIRM_ID) -> dict:
    """Delete all firm data and re-seed. Returns summary."""
    db = get_db()
    deleted = delete_firm_data(db)
    seed_firm_data(db)
    return {"ok": True, "firm_id": firm_id, "docs_deleted": deleted}
