"""
Seed script for Strand & Okafor LLP demo firm.
Idempotent — deletes existing data and re-creates it fresh each run.

Usage (from repo root):
    python scripts/seed_demo.py

Demo date anchor: 2026-06-25
All relative dates computed from this anchor.

Five demo conditions seeded:
  1. dl-mercer-001  — HARD_LEGAL, 6 days out, unconfirmed
  2. te-005         — PENDING, narrative contains "review documents"
  3. te-001         — PENDING, no narrative
  4. acme-commercial — 78% budget utilization (WARN)
  5. whitmore-employment-2026 — last_client_contact 16 days ago
"""

import os
import sys
from datetime import datetime, date, timezone
from decimal import Decimal
from pathlib import Path

# Load .env from repo root
repo_root = Path(__file__).parent.parent
env_file = repo_root / ".env"
if env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(env_file)

from google.cloud import firestore

PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT", "litt-prod")
FIRM_ID = os.getenv("LITT_DEMO_FIRM_ID", "strand-okafor")

# Demo date anchor
DEMO_DATE = date(2026, 6, 25)
DEMO_DT = datetime(2026, 6, 25, 16, 30, 0, tzinfo=timezone.utc)
FIRM_SETUP_DT = datetime(2026, 1, 15, 9, 0, 0, tzinfo=timezone.utc)


def dt(y, m, d, h=0, mn=0):
    return datetime(y, m, d, h, mn, 0, tzinfo=timezone.utc)


def delete_firm_data(db: firestore.Client):
    """Delete all subcollections under firms/{FIRM_ID}."""
    collections = [
        "attorneys", "clients", "matters", "time_entries",
        "deadlines", "deadline_events", "client_communications",
        "invoices", "escalations", "audit_log", "ingestion_signals",
        "pending_clients", "client_suggestions", "client_applied_updates",
        "inbound_messages",
    ]
    firm_ref = db.collection("firms").document(FIRM_ID)
    for col in collections:
        col_ref = firm_ref.collection(col)
        docs = list(col_ref.stream())
        for doc in docs:
            doc.reference.delete()
        if docs:
            print(f"  Deleted {len(docs)} docs from {col}")


def col(db: firestore.Client, collection_name: str):
    return db.collection("firms").document(FIRM_ID).collection(collection_name)


def seed(db: firestore.Client):
    print(f"\nSeeding {FIRM_ID}...")

    # ------------------------------------------------------------------
    # Attorneys
    # ------------------------------------------------------------------
    col(db, "attorneys").document("dana-strand").set({
        "id": "dana-strand",
        "firm_id": FIRM_ID,
        "name": "Dana Strand",
        "email": "dana@strand-okafor.com",
        "default_rate": 350,
        "billing_increment": 0.1,
        "timekeeper_id": "ds001",
        "timekeeper_classification": "AT",
        "rate_overrides": {},
        "permission_scope": ["billing", "deadlines", "comms", "admin"],
        "is_backup_contact": True,
        "created_at": FIRM_SETUP_DT,
        "updated_at": FIRM_SETUP_DT,
    })

    col(db, "attorneys").document("kofi-okafor").set({
        "id": "kofi-okafor",
        "firm_id": FIRM_ID,
        "name": "Kofi Okafor",
        "email": "kofi@strand-okafor.com",
        "default_rate": 375,
        "billing_increment": 0.1,
        "timekeeper_id": "ko001",
        "timekeeper_classification": "AT",
        "rate_overrides": {},
        "permission_scope": ["billing", "deadlines", "comms", "admin"],
        "is_backup_contact": False,
        "created_at": FIRM_SETUP_DT,
        "updated_at": FIRM_SETUP_DT,
    })
    print("  [ok] attorneys")

    # ------------------------------------------------------------------
    # Clients
    # ------------------------------------------------------------------
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

    # acme-commercial at 78% = $11,700 of $15,000
    col(db, "clients").document("acme-commercial").set({
        "id": "acme-commercial",
        "firm_id": FIRM_ID,
        "name": "Acme Commercial RE",
        "billing_contact": "James Whitfield",
        "billing_email": "jwhitfield@acme-commercial.com",
        "billing_address": "500 Main St, Chicago, IL 60601",
        "arrangement": "hourly",
        "budget_cap": 15000,
        "budget_billed": 11700,  # 78%
        "retainer_balance": 800,
        "retainer_refill_threshold": 1000,
        "ledes_client_id": "ACME-COM-001",
        "client_matter_id_prefix": "ACME",
        "last_client_contact": dt(2026, 6, 17),
        "client_silence_threshold_days": 14,
        "billing_guidelines": acme_guidelines,
        "engagement_terms": acme_terms,
        "notes": "Prefers monthly invoices. Budget warning at 75%.",
        "client_type": "entity",
        "client_status": "active",
        "primary_contact_name": "James Whitfield",
        "primary_contact_phone": None,
        "originating_attorney_id": "dana-strand",
        "responsible_attorney_id": "dana-strand",
        "engagement_letter_ref": None,
        "conflict_check_names": ["Acme Commercial Partners LLC"],
        "conflict_check_date": dt(2026, 1, 15),
        "conflict_check_cleared": True,
        "maintenance_cadence": "daily",
        "last_reviewed_at": dt(2026, 6, 24, 16, 0),
        "watched_signal_count": 2,
        "pending_item_count": 1,
        "created_at": FIRM_SETUP_DT,
        "updated_at": DEMO_DT,
    })

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
    mercer_guidelines = {
        **default_guidelines,
        "forbidden_phrases": ["work on matter"],
        "budget_notice_threshold": 0.60,  # triggers WARN at 60% — Mercer is at 62%
    }

    col(db, "clients").document("mercer-industries").set({
        "id": "mercer-industries",
        "firm_id": FIRM_ID,
        "name": "Mercer Industries",
        "billing_contact": "Patricia Mercer",
        "billing_email": "pmercer@mercerindustries.com",
        "billing_address": "1200 Industrial Blvd, Cleveland, OH 44101",
        "arrangement": "hourly",
        "budget_cap": 60000,
        "budget_billed": 37200,  # 62%
        "retainer_balance": None,
        "retainer_refill_threshold": None,
        "ledes_client_id": "MERCER-001",
        "client_matter_id_prefix": "MERCER",
        "last_client_contact": dt(2026, 6, 23),  # 2 days before demo date
        "client_silence_threshold_days": 14,
        "billing_guidelines": mercer_guidelines,
        "engagement_terms": {**default_terms, "budget_cap": 60000},
        "notes": None,
        "client_type": "entity",
        "client_status": "active",
        "primary_contact_name": "Sandra Mercer",
        "primary_contact_phone": None,
        "originating_attorney_id": "kofi-okafor",
        "responsible_attorney_id": "kofi-okafor",
        "engagement_letter_ref": None,
        "conflict_check_names": ["Mercer Industries", "Dunlap Construction"],
        "conflict_check_date": dt(2026, 1, 20),
        "conflict_check_cleared": True,
        "maintenance_cadence": "hourly",
        "last_reviewed_at": dt(2026, 6, 24, 23, 48),  # 12 min before midnight (effective dt)
        "reviews_today": 6,
        "watched_signal_count": 5,
        "pending_item_count": 3,
        "created_at": FIRM_SETUP_DT,
        "updated_at": DEMO_DT,
    })

    col(db, "clients").document("reyes-family-holdings").set({
        "id": "reyes-family-holdings",
        "firm_id": FIRM_ID,
        "name": "Reyes Family Holdings LLC",
        "billing_contact": "Carlos Reyes",
        "billing_email": "creyes@reyesholdings.com",
        "billing_address": "800 Lakeside Dr, Cleveland, OH 44114",
        "arrangement": "hourly",
        "budget_cap": 18000,
        "budget_billed": 5500,
        "retainer_balance": None,
        "retainer_refill_threshold": None,
        "ledes_client_id": "REYES-001",
        "client_matter_id_prefix": "REYES",
        "last_client_contact": dt(2026, 6, 21),
        "client_silence_threshold_days": 14,
        "billing_guidelines": default_guidelines,
        "engagement_terms": {**default_terms, "budget_cap": 18000},
        "notes": None,
        "client_type": "entity",
        "client_status": "active",
        "primary_contact_name": "Carlos Reyes",
        "primary_contact_phone": None,
        "originating_attorney_id": "dana-strand",
        "responsible_attorney_id": "dana-strand",
        "engagement_letter_ref": None,
        "conflict_check_names": ["Reyes Family Holdings LLC"],
        "conflict_check_date": dt(2026, 2, 10),
        "conflict_check_cleared": True,
        "maintenance_cadence": "daily",
        "last_reviewed_at": dt(2026, 6, 24, 17, 0),
        "watched_signal_count": 1,
        "pending_item_count": 0,
        "created_at": FIRM_SETUP_DT,
        "updated_at": DEMO_DT,
    })

    col(db, "clients").document("whitmore-group").set({
        "id": "whitmore-group",
        "firm_id": FIRM_ID,
        "name": "Whitmore Group",
        "billing_contact": "Sandra Whitmore",
        "billing_email": "swhitmore@whitmoregroup.com",
        "billing_address": "350 Commerce Pkwy, Cleveland, OH 44135",
        "arrangement": "hourly",
        "budget_cap": 30000,
        "budget_billed": 9300,  # 31%
        "retainer_balance": None,
        "retainer_refill_threshold": None,
        "ledes_client_id": "WHITMORE-001",
        "client_matter_id_prefix": "WHIT",
        "last_client_contact": dt(2026, 6, 9),  # 16 days before demo date — silence trigger
        "client_silence_threshold_days": 14,
        "billing_guidelines": default_guidelines,
        "engagement_terms": {**default_terms, "budget_cap": 30000},
        "notes": "Monthly status updates preferred.",
        "client_type": "entity",
        "client_status": "active",
        "primary_contact_name": "Sandra Whitmore",
        "primary_contact_phone": None,
        "originating_attorney_id": "dana-strand",
        "responsible_attorney_id": "dana-strand",
        "engagement_letter_ref": None,
        "conflict_check_names": ["Whitmore Group"],
        "conflict_check_date": dt(2026, 3, 1),
        "conflict_check_cleared": True,
        "maintenance_cadence": "daily",
        "last_reviewed_at": dt(2026, 6, 24, 15, 0),
        "watched_signal_count": 3,
        "pending_item_count": 1,
        "created_at": FIRM_SETUP_DT,
        "updated_at": DEMO_DT,
    })

    col(db, "clients").document("lindqvist-holdings").set({
        "id": "lindqvist-holdings",
        "firm_id": FIRM_ID,
        "name": "Lindqvist Holdings",
        "billing_contact": "Erik Lindqvist",
        "billing_email": "erik@lindqvistholdings.com",
        "billing_address": "220 Lake Shore Dr, Chicago, IL 60611",
        "arrangement": "hourly",
        "budget_cap": 50000,
        "budget_billed": 22000,  # 44%
        "retainer_balance": None,
        "retainer_refill_threshold": None,
        "ledes_client_id": "LINDQVIST-001",
        "client_matter_id_prefix": "LIND",
        "last_client_contact": dt(2026, 6, 22),
        "client_silence_threshold_days": 14,
        "billing_guidelines": default_guidelines,
        "engagement_terms": {**default_terms, "budget_cap": 50000},
        "notes": None,
        "client_type": "entity",
        "client_status": "active",
        "primary_contact_name": "Erik Lindqvist",
        "primary_contact_phone": None,
        "originating_attorney_id": "kofi-okafor",
        "responsible_attorney_id": "kofi-okafor",
        "engagement_letter_ref": None,
        "conflict_check_names": ["Lindqvist Holdings"],
        "conflict_check_date": dt(2026, 4, 1),
        "conflict_check_cleared": True,
        "maintenance_cadence": "daily",
        "last_reviewed_at": dt(2026, 6, 24, 14, 0),
        "watched_signal_count": 0,
        "pending_item_count": 0,
        "created_at": dt(2026, 4, 1, 9, 0),
        "updated_at": DEMO_DT,
    })
    print("  [ok] clients")

    # ------------------------------------------------------------------
    # Matters
    # ------------------------------------------------------------------
    col(db, "matters").document("mercer-v-dunlap").set({
        "id": "mercer-v-dunlap",
        "firm_id": FIRM_ID,
        "client_id": "mercer-industries",
        "client_matter_id": "MERCER-2026-001",
        "law_firm_matter_id": "mercer-v-dunlap",
        "name": "Mercer Industries v. Dunlap Construction",
        "type": "litigation",
        "status": "ACTIVE",
        "assigned_attorneys": ["dana-strand", "kofi-okafor"],
        "opened_at": dt(2026, 1, 20),
        "last_activity": dt(2026, 6, 24),
        "last_client_contact": dt(2026, 6, 18),
        "created_at": dt(2026, 1, 20),
        "updated_at": DEMO_DT,
    })

    col(db, "matters").document("reyes-acquisition").set({
        "id": "reyes-acquisition",
        "firm_id": FIRM_ID,
        "client_id": "reyes-family-holdings",
        "client_matter_id": "REYES-2026-001",
        "law_firm_matter_id": "reyes-acquisition",
        "name": "Reyes Family Holdings — LOI Acquisition",
        "type": "transactional",
        "status": "ACTIVE",
        "assigned_attorneys": ["dana-strand", "kofi-okafor"],
        "opened_at": dt(2026, 2, 10),
        "last_activity": dt(2026, 6, 23),
        "last_client_contact": dt(2026, 6, 21),
        "created_at": dt(2026, 2, 10),
        "updated_at": DEMO_DT,
    })

    col(db, "matters").document("acme-contract-review-2026").set({
        "id": "acme-contract-review-2026",
        "firm_id": FIRM_ID,
        "client_id": "acme-commercial",
        "client_matter_id": "ACME-2026-0042",
        "law_firm_matter_id": "acme-contract-review-2026",
        "name": "Acme Commercial — Vendor MSA Review",
        "type": "transactional",
        "status": "ACTIVE",
        "assigned_attorneys": ["dana-strand"],
        "opened_at": dt(2026, 1, 15),
        "last_activity": dt(2026, 6, 24),
        "last_client_contact": dt(2026, 6, 17),
        "created_at": dt(2026, 1, 15),
        "updated_at": DEMO_DT,
    })

    col(db, "matters").document("whitmore-employment-2026").set({
        "id": "whitmore-employment-2026",
        "firm_id": FIRM_ID,
        "client_id": "whitmore-group",
        "client_matter_id": "WHIT-2026-001",
        "law_firm_matter_id": "whitmore-employment-2026",
        "name": "Whitmore Group — Employment Advisory",
        "type": "advisory",
        "status": "ACTIVE",
        "assigned_attorneys": ["dana-strand", "kofi-okafor"],
        "opened_at": dt(2026, 3, 1),
        "last_activity": dt(2026, 6, 9),
        "last_client_contact": dt(2026, 6, 9),  # 16 days before demo date
        "created_at": dt(2026, 3, 1),
        "updated_at": dt(2026, 6, 9),
    })

    col(db, "matters").document("lindqvist-real-estate-2026").set({
        "id": "lindqvist-real-estate-2026",
        "firm_id": FIRM_ID,
        "client_id": "lindqvist-holdings",
        "client_matter_id": "LIND-2026-001",
        "law_firm_matter_id": "lindqvist-real-estate-2026",
        "name": "Lindqvist Holdings — Commercial Portfolio Restructure",
        "type": "transactional",
        "status": "ACTIVE",
        "assigned_attorneys": ["kofi-okafor"],
        "opened_at": dt(2026, 4, 1),
        "last_activity": dt(2026, 6, 22),
        "last_client_contact": dt(2026, 6, 22),
        "created_at": dt(2026, 4, 1),
        "updated_at": DEMO_DT,
    })
    print("  [ok] matters")

    # ------------------------------------------------------------------
    # Time entries
    # ------------------------------------------------------------------

    # te-001: PENDING, no narrative — anomaly fires
    col(db, "time_entries").document("te-001").set({
        "id": "te-001",
        "firm_id": FIRM_ID,
        "matter_id": "mercer-v-dunlap",
        "client_id": "mercer-industries",
        "attorney_id": "dana-strand",
        "entry_date": "2026-06-23",
        "hours": 1.4,
        "rate": 350,
        "amount": 490.00,
        "session_minutes_actual": 83,
        "billing_increment": 0.1,
        "task_code": "L200",
        "activity_code": None,
        "expense_code": None,
        "narrative": None,  # intentionally blank — anomaly
        "status": "PENDING",
        "invoice_id": None,
        "ai_assisted": False,
        "ai_tool": None,
        "model": None,
        "ai_cost_usd": None,
        "human_minutes_actual": 83,
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
        "created_at": dt(2026, 6, 23, 17, 0),
        "updated_at": dt(2026, 6, 23, 17, 0),
    })

    # te-002: APPROVED, clean
    col(db, "time_entries").document("te-002").set({
        "id": "te-002",
        "firm_id": FIRM_ID,
        "matter_id": "mercer-v-dunlap",
        "client_id": "mercer-industries",
        "attorney_id": "dana-strand",
        "entry_date": "2026-06-22",
        "hours": 0.5,
        "rate": 350,
        "amount": 175.00,
        "session_minutes_actual": 29,
        "billing_increment": 0.1,
        "task_code": "L300",
        "activity_code": "A106",
        "expense_code": None,
        "narrative": "Reviewed deposition transcript of opposing expert; noted key inconsistencies for cross-examination outline.",
        "status": "APPROVED",
        "invoice_id": None,
        "ai_assisted": False,
        "ai_tool": None,
        "model": None,
        "ai_cost_usd": None,
        "human_minutes_actual": 29,
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
        "version": 2,
        "created_at": dt(2026, 6, 22, 16, 45),
        "updated_at": dt(2026, 6, 23, 9, 0),
    })

    # te-003: PENDING, clean narrative ready
    col(db, "time_entries").document("te-003").set({
        "id": "te-003",
        "firm_id": FIRM_ID,
        "matter_id": "reyes-acquisition",
        "client_id": "reyes-family-holdings",
        "attorney_id": "dana-strand",
        "entry_date": "2026-06-24",
        "hours": 0.8,
        "rate": 350,
        "amount": 280.00,
        "session_minutes_actual": 47,
        "billing_increment": 0.1,
        "task_code": "A100",
        "activity_code": "A104",
        "expense_code": None,
        "narrative": "Reviewed and marked up LOI draft; circulated redline to client for review prior to counterparty submission.",
        "status": "PENDING",
        "invoice_id": None,
        "ai_assisted": True,
        "ai_tool": "Gemini",
        "model": "gemini-2.5-pro",
        "ai_cost_usd": 0.11,
        "human_minutes_actual": 47,
        "ai_minutes_estimated": 4,
        "output_type": "redline",
        "human_review_completed": True,
        "reviewing_attorney_id": "dana-strand",
        "client_ai_disclosure_required": False,
        "client_ai_disclosure_status": "not_required",
        "billing_treatment": "billed_as_human_review",
        "activity_log": [
            "2026-06-24T14:10:00Z|Edit|reyes-loi-draft-v2.docx",
            "2026-06-24T14:38:00Z|Write|reyes-loi-redline-notes.md",
        ],
        "write_down_record": None,
        "write_off_record": None,
        "version": 1,
        "created_at": dt(2026, 6, 24, 15, 0),
        "updated_at": dt(2026, 6, 24, 15, 0),
    })

    # te-004: PENDING, round hours no session data — anomaly
    col(db, "time_entries").document("te-004").set({
        "id": "te-004",
        "firm_id": FIRM_ID,
        "matter_id": "reyes-acquisition",
        "client_id": "reyes-family-holdings",
        "attorney_id": "kofi-okafor",
        "entry_date": "2026-06-23",
        "hours": 1.2,
        "rate": 375,
        "amount": 450.00,
        "session_minutes_actual": None,  # missing — anomaly
        "billing_increment": 0.1,
        "task_code": "A200",
        "activity_code": None,
        "expense_code": None,
        "narrative": "Negotiation strategy conference and due diligence coordination for target entity review.",
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
        "created_at": dt(2026, 6, 23, 18, 0),
        "updated_at": dt(2026, 6, 23, 18, 0),
    })

    # te-005: PENDING, narrative contains "review documents" — pre-bill scrubber hit
    col(db, "time_entries").document("te-005").set({
        "id": "te-005",
        "firm_id": FIRM_ID,
        "matter_id": "acme-contract-review-2026",
        "client_id": "acme-commercial",
        "attorney_id": "dana-strand",
        "entry_date": "2026-06-24",
        "hours": 0.8,
        "rate": 350,
        "amount": 280.00,
        "session_minutes_actual": 46,
        "billing_increment": 0.1,
        "task_code": "A100",
        "activity_code": None,
        "expense_code": None,
        "narrative": "review documents relating to vendor MSA indemnification provisions.",  # scrubber hit
        "status": "PENDING",
        "invoice_id": None,
        "ai_assisted": False,
        "ai_tool": None,
        "model": None,
        "ai_cost_usd": None,
        "human_minutes_actual": 46,
        "ai_minutes_estimated": None,
        "output_type": None,
        "human_review_completed": False,
        "reviewing_attorney_id": None,
        "client_ai_disclosure_required": True,
        "client_ai_disclosure_status": None,
        "billing_treatment": None,
        "activity_log": [
            "2026-06-24T10:05:00Z|Read|acme-vendor-msa-draft.docx",
            "2026-06-24T10:41:00Z|Read|acme-indemnification-precedents.pdf",
        ],
        "write_down_record": None,
        "write_off_record": None,
        "version": 1,
        "created_at": dt(2026, 6, 24, 11, 0),
        "updated_at": dt(2026, 6, 24, 11, 0),
    })

    # te-006: APPROVED, round hours no session data — anomaly (already logged)
    # This is the APPROVED entry that pushes Acme to 78%: $11,000 billed + $700 = $11,700
    col(db, "time_entries").document("te-006").set({
        "id": "te-006",
        "firm_id": FIRM_ID,
        "matter_id": "acme-contract-review-2026",
        "client_id": "acme-commercial",
        "attorney_id": "dana-strand",
        "entry_date": "2026-06-18",
        "hours": 2.0,  # round hours — anomaly (already flagged/logged)
        "rate": 350,
        "amount": 700.00,
        "session_minutes_actual": None,  # missing
        "billing_increment": 0.1,
        "task_code": "A100",
        "activity_code": None,
        "expense_code": None,
        "narrative": "Analyzed indemnification and limitation of liability clauses in vendor MSA redline; drafted response memo for client review.",
        "status": "APPROVED",
        "invoice_id": None,
        "ai_assisted": True,
        "ai_tool": "Gemini",
        "model": "gemini-2.5-pro",
        "ai_cost_usd": 0.18,
        "human_minutes_actual": None,
        "ai_minutes_estimated": 8,
        "output_type": "analysis",
        "human_review_completed": True,
        "reviewing_attorney_id": "dana-strand",
        "client_ai_disclosure_required": True,
        "client_ai_disclosure_status": "included",
        "billing_treatment": "billed_as_human_review",
        "activity_log": [],
        "write_down_record": None,
        "write_off_record": None,
        "version": 2,
        "created_at": dt(2026, 6, 18, 17, 0),
        "updated_at": dt(2026, 6, 19, 9, 30),
    })

    # te-007: BILLED, clean, on INV-2026-006
    col(db, "time_entries").document("te-007").set({
        "id": "te-007",
        "firm_id": FIRM_ID,
        "matter_id": "whitmore-employment-2026",
        "client_id": "whitmore-group",
        "attorney_id": "dana-strand",
        "entry_date": "2026-06-08",
        "hours": 0.6,
        "rate": 350,
        "amount": 210.00,
        "session_minutes_actual": 35,
        "billing_increment": 0.1,
        "task_code": "A200",
        "activity_code": "A104",
        "expense_code": None,
        "narrative": "Researched FLSA exemption requirements applicable to Whitmore Group's proposed re-classification of sales staff.",
        "status": "BILLED",
        "invoice_id": "INV-2026-006",
        "ai_assisted": False,
        "ai_tool": None,
        "model": None,
        "ai_cost_usd": None,
        "human_minutes_actual": 35,
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
        "version": 3,
        "created_at": dt(2026, 6, 8, 16, 0),
        "updated_at": dt(2026, 6, 13, 10, 0),
    })

    # te-008: APPROVED, kofi, whitmore — clean
    col(db, "time_entries").document("te-008").set({
        "id": "te-008",
        "firm_id": FIRM_ID,
        "matter_id": "whitmore-employment-2026",
        "client_id": "whitmore-group",
        "attorney_id": "kofi-okafor",
        "entry_date": "2026-06-16",
        "hours": 1.1,
        "rate": 375,
        "amount": 412.50,
        "session_minutes_actual": 65,
        "billing_increment": 0.1,
        "task_code": "A200",
        "activity_code": "A107",
        "expense_code": None,
        "narrative": "Reviewed employment handbook provisions and drafted recommended policy amendments addressing remote-work and AI-tool usage disclosures.",
        "status": "APPROVED",
        "invoice_id": None,
        "ai_assisted": True,
        "ai_tool": "Gemini",
        "model": "gemini-2.5-pro",
        "ai_cost_usd": 0.09,
        "human_minutes_actual": 65,
        "ai_minutes_estimated": 5,
        "output_type": "draft",
        "human_review_completed": True,
        "reviewing_attorney_id": "kofi-okafor",
        "client_ai_disclosure_required": False,
        "client_ai_disclosure_status": "not_required",
        "billing_treatment": "billed_as_human_review",
        "activity_log": [
            "2026-06-16T13:30:00Z|Read|whitmore-employee-handbook-2025.pdf",
            "2026-06-16T14:15:00Z|Write|whitmore-policy-amendments-draft.docx",
        ],
        "write_down_record": None,
        "write_off_record": None,
        "version": 2,
        "created_at": dt(2026, 6, 16, 15, 0),
        "updated_at": dt(2026, 6, 17, 9, 0),
    })
    # te-010: PENDING, narrative contains "work on matter" — scrubber BLOCK for Mercer
    col(db, "time_entries").document("te-010").set({
        "id": "te-010",
        "firm_id": FIRM_ID,
        "matter_id": "mercer-v-dunlap",
        "client_id": "mercer-industries",
        "attorney_id": "kofi-okafor",
        "entry_date": "2026-06-24",
        "hours": 2.7,
        "rate": 375,
        "amount": 1012.50,
        "session_minutes_actual": 161,
        "billing_increment": 0.1,
        "task_code": "L200",
        "activity_code": None,
        "expense_code": None,
        "narrative": "Work on matter — reviewed opposition brief and prepared status conference outline.",  # scrubber BLOCK
        "status": "PENDING",
        "invoice_id": None,
        "ai_assisted": False,
        "ai_tool": None,
        "model": None,
        "ai_cost_usd": None,
        "human_minutes_actual": 161,
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
        "created_at": dt(2026, 6, 24, 16, 30),
        "updated_at": dt(2026, 6, 24, 16, 30),
    })
    print("  [ok] time_entries")

    # ------------------------------------------------------------------
    # Deadlines
    # ------------------------------------------------------------------

    # dl-mercer-001: HARD_LEGAL, 6 days out from 2026-06-25 = 2026-07-01, NO confirmation — escalation fires
    col(db, "deadlines").document("dl-mercer-001").set({
        "id": "dl-mercer-001",
        "firm_id": FIRM_ID,
        "matter_id": "mercer-v-dunlap",
        "client_id": "mercer-industries",
        "description": "Opposition to defendant's motion for summary judgment due",
        "due_date": "2026-07-01",
        "classification": "HARD_LEGAL",
        "status": "ACTIVE",
        "source_type": "court_order",
        "source_document_id": "court-order-2026-0508",
        "source_excerpt": "Plaintiff's opposition to defendant's motion for summary judgment shall be filed no later than July 1, 2026.",
        "created_by": "dana-strand",
        "verified_by": "dana-strand",
        "verification_status": "attorney_verified",
        "supersedes_deadline_id": None,
        "jurisdiction": "Ohio",
        "court": "Cuyahoga County Court of Common Pleas",
        "last_confirmed_by": None,  # not yet confirmed — escalation fires
        "last_confirmed_at": None,
        "created_at": dt(2026, 5, 8, 10, 30),
        "updated_at": dt(2026, 5, 8, 10, 30),
    })

    # dl-mercer-002: SOFT_INTERNAL, 18 days out, CONFIRMED — shows "CONFIRMED" pill in Command Center
    col(db, "deadlines").document("dl-mercer-002").set({
        "id": "dl-mercer-002",
        "firm_id": FIRM_ID,
        "matter_id": "mercer-v-dunlap",
        "client_id": "mercer-industries",
        "description": "Expert witness disclosure deadline",
        "due_date": "2026-07-13",
        "classification": "HARD_CONTRACTUAL",
        "status": "ACTIVE",
        "source_type": "scheduling_order",
        "source_document_id": "court-order-2026-0508",
        "source_excerpt": "Plaintiff expert disclosures due July 13, 2026.",
        "created_by": "kofi-okafor",
        "verified_by": "kofi-okafor",
        "verification_status": "attorney_verified",
        "supersedes_deadline_id": None,
        "jurisdiction": "Ohio",
        "court": "Cuyahoga County Court of Common Pleas",
        "last_confirmed_by": "kofi-okafor",
        "last_confirmed_at": dt(2026, 6, 24, 10, 0),
        "created_at": dt(2026, 5, 8, 10, 30),
        "updated_at": dt(2026, 6, 24, 10, 0),
    })

    # dl-reyes-001: HARD_CONTRACTUAL, 11 days out = 2026-07-06, no confirmation — digest mention
    col(db, "deadlines").document("dl-reyes-001").set({
        "id": "dl-reyes-001",
        "firm_id": FIRM_ID,
        "matter_id": "reyes-acquisition",
        "description": "LOI acceptance window closes — counterparty signature required",
        "due_date": "2026-07-06",
        "classification": "HARD_CONTRACTUAL",
        "status": "ACTIVE",
        "source_type": "contract",
        "source_document_id": "email-reyes-loi-20260518",
        "source_excerpt": "Acceptance of this Letter of Intent must be executed and returned no later than July 6, 2026.",
        "created_by": "dana-strand",
        "verified_by": "dana-strand",
        "verification_status": "attorney_verified",
        "supersedes_deadline_id": None,
        "jurisdiction": "Ohio",
        "court": None,
        "last_confirmed_by": None,
        "last_confirmed_at": None,
        "created_at": dt(2026, 5, 18, 14, 0),
        "updated_at": dt(2026, 5, 18, 14, 0),
    })
    print("  [ok] deadlines")

    # ------------------------------------------------------------------
    # Client communications — Whitmore silence trigger draft
    # ------------------------------------------------------------------
    col(db, "client_communications").document("comm-001").set({
        "id": "comm-001",
        "firm_id": FIRM_ID,
        "matter_id": "whitmore-employment-2026",
        "client_id": "whitmore-group",
        "trigger": "DAYS_SINCE_CONTACT",
        "draft_body": (
            "Dear Sandra,\n\n"
            "I wanted to reach out with a brief update on the Whitmore Group employment advisory matter. [f1]\n\n"
            "Our team has completed the initial review of the employment handbook and drafted recommended policy amendments. [f2] "
            "We are prepared to schedule a call at your convenience to walk through the proposed changes.\n\n"
            "Please let us know a time that works for your schedule.\n\n"
            "Best regards,\nDana Strand"
        ),
        "source_map": [
            {
                "fact_id": "f1",
                "fact_text": "No confirmed client contact since June 9, 2026 — 16 days ago.",
                "sentence_in_draft": "I wanted to reach out with a brief update on the Whitmore Group employment advisory matter.",
                "source_type": "firestore",
                "source_id": "matters/whitmore-employment-2026",
                "source_excerpt": "last_client_contact: 2026-06-09",
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
        "status": "DRAFT_GENERATED",
        "approved_by": None,
        "approved_at": None,
        "queued_at": None,
        "sent_confirmed_at": None,
        "dismissal_reason": None,
        "created_at": DEMO_DT,
        "updated_at": DEMO_DT,
    })
    print("  [ok] client_communications")

    # ------------------------------------------------------------------
    # Invoice (for te-007 reference)
    # ------------------------------------------------------------------
    col(db, "invoices").document("INV-2026-006").set({
        "id": "INV-2026-006",
        "firm_id": FIRM_ID,
        "client_id": "whitmore-group",
        "period_start": "2026-06-01",
        "period_end": "2026-06-15",
        "total_hours": 0.6,
        "total_amount": 210.00,
        "retainer_draw": None,
        "retainer_balance_after": None,
        "exhibit_md": "# Invoice INV-2026-006\n\n**Whitmore Group** — June 1–15, 2026\n\n| Date | Description | Hours | Rate | Amount |\n|------|-------------|-------|------|--------|\n| 2026-06-08 | FLSA exemption research | 0.6 | $350 | $210.00 |\n\n**Total: $210.00**",
        "ledes_file_path": None,
        "status": "ISSUED",
        "issued_at": dt(2026, 6, 16, 9, 0),
        "paid_at": None,
        "days_outstanding": 9,
        "created_at": dt(2026, 6, 16, 9, 0),
        "updated_at": dt(2026, 6, 16, 9, 0),
    })
    print("  [ok] invoices")

    # ------------------------------------------------------------------
    # Inbound messages (3 messages, 1 for Mercer so health strip shows "1 inbound")
    # ------------------------------------------------------------------
    col(db, "inbound_messages").document("inbound-mercer-q1").set({
        "id": "inbound-mercer-q1",
        "firm_id": FIRM_ID,
        "source_email_id": None,
        "matter_id": "mercer-v-dunlap",
        "client_id": "mercer-industries",
        "from_name": "Patricia Mercer",
        "from_role": "client",
        "received_at": dt(2026, 6, 23, 11, 30),
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
        "created_at": dt(2026, 6, 23, 11, 30),
        "updated_at": dt(2026, 6, 23, 11, 30),
    })
    col(db, "inbound_messages").document("inbound-acme-billing").set({
        "id": "inbound-acme-billing",
        "firm_id": FIRM_ID,
        "source_email_id": None,
        "matter_id": "acme-contract-review-2026",
        "client_id": "acme-commercial",
        "from_name": "James Whitfield",
        "from_role": "client",
        "received_at": dt(2026, 6, 22, 14, 0),
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
        "created_at": dt(2026, 6, 22, 14, 0),
        "updated_at": dt(2026, 6, 22, 14, 0),
    })
    col(db, "inbound_messages").document("inbound-whitmore-update").set({
        "id": "inbound-whitmore-update",
        "firm_id": FIRM_ID,
        "source_email_id": None,
        "matter_id": "whitmore-employment-2026",
        "client_id": "whitmore-group",
        "from_name": "Sandra Whitmore",
        "from_role": "client",
        "received_at": dt(2026, 6, 25, 8, 0),
        "wait_days": 0,
        "urgency": "LOW",
        "urgency_signals": [],
        "message_excerpt": "Thank you for the handbook update, Dana. Happy to connect whenever you have availability.",
        "summary": None,
        "action_items": [],
        "suggested_reply_comm_id": None,
        "cross_agent": False,
        "status": "AWAITING_TRIAGE",
        "version": 1,
        "created_at": dt(2026, 6, 25, 8, 0),
        "updated_at": dt(2026, 6, 25, 8, 0),
    })
    print("  [ok] inbound_messages")

    # ------------------------------------------------------------------
    # Ingestion signals (for deduplication demo)
    # ------------------------------------------------------------------
    col(db, "ingestion_signals").document("sig-gmail-mercer-dl").set({
        "id": "sig-gmail-mercer-dl",
        "firm_id": FIRM_ID,
        "source_system": "gmail",
        "source_id": "gmail-court-order-20260508",
        "source_hash": "sha256-mercer-opposition-july1-2026",
        "signal_type": "deadline_candidate",
        "extracted_date": "2026-07-01",
        "matter_id": "mercer-v-dunlap",
        "processed": True,
        "outcome_id": "dl-mercer-001",
        "first_seen_at": dt(2026, 5, 8, 11, 0),
        "last_seen_at": dt(2026, 5, 8, 11, 0),
        "created_at": dt(2026, 5, 8, 11, 0),
        "updated_at": dt(2026, 5, 8, 11, 0),
    })
    print("  [ok] ingestion_signals")

    # ------------------------------------------------------------------
    # Client suggestions (held — require attorney judgment, Mercer)
    # ------------------------------------------------------------------
    col(db, "client_suggestions").document("ms-1").set({
        "id": "ms-1",
        "firm_id": FIRM_ID,
        "client_id": "mercer-industries",
        "title": "Reclassify matter stage → Dispositive motions",
        "detail": "Three dispositive-motion filings observed on the docket this week. The matter is still tagged \"Discovery.\"",
        "source": "docket activity",
        "source_ref": "SDNY · 1:26-cv-0418",
        "confidence": 0.86,
        "status": "held",
        "resolution_reason": None,
        "resolved_at": None,
        "resolved_by": None,
        "created_at": DEMO_DT,
        "updated_at": DEMO_DT,
    })
    col(db, "client_suggestions").document("ms-2").set({
        "id": "ms-2",
        "firm_id": FIRM_ID,
        "client_id": "mercer-industries",
        "title": "Raise contact priority — board escalation",
        "detail": "Sandra's last email notes the board is asking for updates. Litt suggests tightening the silence threshold on this matter to 7 days.",
        "source": "inbound message",
        "source_ref": "in-mercer · Jun 3",
        "confidence": 0.79,
        "status": "held",
        "resolution_reason": None,
        "resolved_at": None,
        "resolved_by": None,
        "created_at": DEMO_DT,
        "updated_at": DEMO_DT,
    })
    col(db, "client_suggestions").document("ms-3").set({
        "id": "ms-3",
        "firm_id": FIRM_ID,
        "client_id": "mercer-industries",
        "title": "Add \"Dunlap Holdings Inc.\" to conflict names",
        "detail": "A related party appeared in a new filing. Not in the cleared conflict set — re-check recommended before further work.",
        "source": "court filing",
        "source_ref": "doc 41 · Jun 5",
        "confidence": 0.74,
        "status": "held",
        "resolution_reason": None,
        "resolved_at": None,
        "resolved_by": None,
        "created_at": DEMO_DT,
        "updated_at": DEMO_DT,
    })
    print("  [ok] client_suggestions")

    # ------------------------------------------------------------------
    # Client applied updates (auto-applied by Litt, Mercer)
    # ------------------------------------------------------------------
    col(db, "client_applied_updates").document("mx-1").set({
        "id": "mx-1",
        "firm_id": FIRM_ID,
        "client_id": "mercer-industries",
        "kind": "deadline",
        "field_label": "Deadline ingested",
        "change": "Expert disclosure · due Jul 10 added to the deadline book",
        "source": "scheduling order",
        "source_ref": "Calendar · MCP",
        "work": "deterministic",
        "confidence": None,
        "applied_at": dt(2026, 5, 29, 14, 58),
        "audit_event_id": "ae-mx1demo",
        "created_at": dt(2026, 5, 29, 14, 58),
        "updated_at": dt(2026, 5, 29, 14, 58),
    })
    col(db, "client_applied_updates").document("mx-2").set({
        "id": "mx-2",
        "firm_id": FIRM_ID,
        "client_id": "mercer-industries",
        "kind": "contact",
        "field_label": "Contact updated",
        "change": "Sandra Mercer title → General Counsel (was VP, Legal)",
        "source": "email signature",
        "source_ref": "in-mercer · Jun 3",
        "work": "llm_assisted",
        "confidence": 0.97,
        "applied_at": dt(2026, 5, 28, 9, 0),
        "audit_event_id": "ae-mx2demo",
        "created_at": dt(2026, 5, 28, 9, 0),
        "updated_at": dt(2026, 5, 28, 9, 0),
    })
    col(db, "client_applied_updates").document("mx-3").set({
        "id": "mx-3",
        "firm_id": FIRM_ID,
        "client_id": "mercer-industries",
        "kind": "budget",
        "field_label": "Budget recomputed",
        "change": "Matter utilization 58% → 62% on approved entry te-014",
        "source": "billing store",
        "source_ref": "te-014 · approved",
        "work": "deterministic",
        "confidence": None,
        "applied_at": dt(2026, 5, 29, 12, 58),
        "audit_event_id": "ae-mx3demo",
        "created_at": dt(2026, 5, 29, 12, 58),
        "updated_at": dt(2026, 5, 29, 12, 58),
    })
    col(db, "client_applied_updates").document("mx-4").set({
        "id": "mx-4",
        "firm_id": FIRM_ID,
        "client_id": "mercer-industries",
        "kind": "matter",
        "field_label": "Matter field set",
        "change": "Opposing counsel → Dunlap Construction LLP",
        "source": "engagement letter v2",
        "source_ref": "mercer · eng-ltr",
        "work": "llm_assisted",
        "confidence": 0.93,
        "applied_at": dt(2026, 6, 1, 8, 0),
        "audit_event_id": "ae-mx4demo",
        "created_at": dt(2026, 6, 1, 8, 0),
        "updated_at": dt(2026, 6, 1, 8, 0),
    })
    print("  [ok] client_applied_updates")

    # ------------------------------------------------------------------
    # Pending clients (auto-drafted from engagement letter)
    # ------------------------------------------------------------------
    col(db, "pending_clients").document("cordova-partners").set({
        "id": "cordova-partners",
        "firm_id": FIRM_ID,
        "proposed_name": "Cordova Partners LLC",
        "via": "Watched inbox · Gmail",
        "detected_at": dt(2026, 5, 29, 16, 22),
        "source_file": "Cordova-Engagement-Letter-signed.pdf",
        "status": "drafted",
        "extraction": {
            "client_name": "Cordova Partners LLC",
            "client_type": "entity",
            "primary_contact_name": "Raúl Cordova",
            "primary_contact_email": "rcordova@cordovapartners.com",
            "primary_contact_phone": None,
            "billing_rate": 360,
            "billing_type": "hourly",
            "billing_cycle": "monthly",
            "payment_terms": "net_30",
            "engagement_type": "litigation",
            "date_engaged": "2026-06-06",
            "matter_name": "Cordova Partners — commercial lease dispute",
            "matter_type": "litigation",
            "opposing_counsel": None,
            "court": None,
            "case_number": None,
            "conflict_check_names": ["Cordova Commercial Holdings"],
            "confidence": {
                "client_name": "high",
                "client_type": "high",
                "primary_contact_name": "high",
                "primary_contact_email": "high",
                "primary_contact_phone": "not_found",
                "billing_rate": "high",
                "billing_type": "high",
                "billing_cycle": "medium",
                "payment_terms": "medium",
                "engagement_type": "high",
                "date_engaged": "high",
                "matter_name": "high",
                "matter_type": "high",
                "opposing_counsel": "not_found",
                "court": "not_found",
                "case_number": "not_found",
            },
            "extraction_notes": "Engagement letter clearly states scope, rate, and parties. Phone, opposing counsel, court, and case number not present in the document — flagged for attorney entry.",
            "fields_extracted_count": 13,
            "fields_total": 16,
        },
        "created_at": dt(2026, 5, 29, 16, 22),
        "updated_at": dt(2026, 5, 29, 16, 22),
    })
    print("  [ok] pending_clients")

    print(f"\n[DONE] Seed complete — {FIRM_ID} ready")
    print(f"   Demo date: {DEMO_DATE}")
    print(f"   dl-mercer-001: HARD_LEGAL, due {date(2026,7,1)} ({(date(2026,7,1)-DEMO_DATE).days} days out)")
    print(f"   te-005: PENDING, 'review documents' in narrative")
    print(f"   te-001: PENDING, no narrative")
    print(f"   acme-commercial: $11,700 / $15,000 = 78%")
    print(f"   whitmore last contact: 2026-06-09 ({(DEMO_DATE - date(2026,6,9)).days} days ago)")
    print(f"   roster: mercer(62%) · acme(78%) · whitmore(31%) · lindqvist(44%)")
    print(f"   pending: cordova-partners LLC (13/16 fields extracted)")


if __name__ == "__main__":
    print(f"Connecting to Firestore project: {PROJECT}")
    db = firestore.Client(project=PROJECT)
    print("Deleting existing firm data...")
    delete_firm_data(db)
    seed(db)
