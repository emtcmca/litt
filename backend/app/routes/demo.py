"""
Demo management endpoints.
/api/demo/ready  — validates all 5 demo conditions in Firestore
/api/demo/reset  — deletes + re-seeds firm data
/api/demo/state  — debugging view of current collection counts
"""

from datetime import date

from fastapi import APIRouter
from pydantic import BaseModel

from app import config
from app.db import collection_ref
from app.scrubber.prebill import run_prebill_checks

router = APIRouter()

DEMO_DATE = config.get_effective_date()


# ---------------------------------------------------------------------------
# GET /api/demo/ready
# ---------------------------------------------------------------------------

def _check_deadline_mercer(firm_id: str) -> dict:
    """dl-mercer-001: ACTIVE, attorney_verified, 6 days out, unconfirmed."""
    doc = collection_ref(firm_id, "deadlines").document("dl-mercer-001").get()
    if not doc.exists:
        return {"pass": False, "detail": "dl-mercer-001 not found"}
    dl = doc.to_dict()
    if dl.get("status") != "ACTIVE":
        return {"pass": False, "detail": f"status is {dl.get('status')}, expected ACTIVE"}
    if dl.get("verification_status") != "attorney_verified":
        return {"pass": False, "detail": "not attorney_verified"}
    try:
        due = date.fromisoformat(str(dl.get("due_date", ""))[:10])
        days_out = (due - DEMO_DATE).days
    except (ValueError, TypeError):
        return {"pass": False, "detail": "invalid due_date"}
    if days_out < 0 or days_out > 14:
        return {"pass": False, "detail": f"days_out={days_out}, expected 0–14"}
    if dl.get("last_confirmed_by") is not None:
        return {"pass": False, "detail": "last_confirmed_by is set — should be unconfirmed"}
    return {"pass": True, "detail": f"HARD_LEGAL, {days_out} days out, unconfirmed"}


def _check_te_005_scrubber(firm_id: str) -> dict:
    """te-005: PENDING with forbidden phrase 'review documents'."""
    entry_doc = collection_ref(firm_id, "time_entries").document("te-005").get()
    if not entry_doc.exists:
        return {"pass": False, "detail": "te-005 not found"}
    entry = entry_doc.to_dict()
    if entry.get("status") != "PENDING":
        return {"pass": False, "detail": f"status is {entry.get('status')}, expected PENDING"}

    client_doc = collection_ref(firm_id, "clients").document("acme-commercial").get()
    client = client_doc.to_dict() if client_doc.exists else {}
    result = run_prebill_checks(entry, client)

    blocked = [f for f in result.flags if f.severity == "BLOCK" and f.check_name == "forbidden_phrase"]
    if not blocked:
        return {"pass": False, "detail": "no forbidden_phrase BLOCK flag on te-005"}
    return {"pass": True, "detail": f"forbidden_phrase BLOCK: {blocked[0].matched_text}"}


def _check_te_001_missing_narrative(firm_id: str) -> dict:
    """te-001: PENDING, narrative is None."""
    doc = collection_ref(firm_id, "time_entries").document("te-001").get()
    if not doc.exists:
        return {"pass": False, "detail": "te-001 not found"}
    entry = doc.to_dict()
    if entry.get("status") != "PENDING":
        return {"pass": False, "detail": f"status is {entry.get('status')}, expected PENDING"}
    if entry.get("narrative") is not None:
        return {"pass": False, "detail": "narrative is not None"}
    return {"pass": True, "detail": "PENDING entry with no narrative"}


def _check_acme_budget_warn(firm_id: str) -> dict:
    """acme-commercial: total committed / budget_cap >= 75%."""
    client_doc = collection_ref(firm_id, "clients").document("acme-commercial").get()
    if not client_doc.exists:
        return {"pass": False, "detail": "acme-commercial client not found"}
    client = client_doc.to_dict()
    budget_cap = float(client.get("budget_cap") or 0)
    if budget_cap <= 0:
        return {"pass": False, "detail": "no budget_cap on acme-commercial"}

    billed = float(client.get("budget_billed") or 0)
    guidelines = client.get("billing_guidelines") or {}
    threshold = float(guidelines.get("budget_notice_threshold", 0.75) if isinstance(guidelines, dict) else 0.75)

    approved_entries = collection_ref(firm_id, "time_entries").stream()
    approved_total = sum(
        float(e.to_dict().get("amount") or 0)
        for e in approved_entries
        if e.to_dict().get("client_id") == "acme-commercial"
        and e.to_dict().get("status") == "APPROVED"
    )

    committed = billed + approved_total
    pct = committed / budget_cap
    if pct < threshold:
        return {"pass": False, "detail": f"utilization {pct:.1%} below threshold {threshold:.0%}"}
    return {"pass": True, "detail": f"utilization {pct:.1%} (${committed:,.0f} / ${budget_cap:,.0f}) — {('CRITICAL' if pct >= 0.9 else 'WARN')}"}


def _check_whitmore_silence(firm_id: str) -> dict:
    """whitmore-employment-2026: last_client_contact >= 14 days before demo date."""
    doc = collection_ref(firm_id, "matters").document("whitmore-employment-2026").get()
    if not doc.exists:
        return {"pass": False, "detail": "whitmore-employment-2026 matter not found"}
    matter = doc.to_dict()
    if matter.get("status") != "ACTIVE":
        return {"pass": False, "detail": f"matter status is {matter.get('status')}, expected ACTIVE"}

    lcc = matter.get("last_client_contact")
    if lcc is None:
        return {"pass": False, "detail": "last_client_contact is None"}

    if isinstance(lcc, str):
        try:
            from datetime import datetime, timezone
            lcc_date = datetime.fromisoformat(lcc.replace("Z", "+00:00")).date()
        except ValueError:
            return {"pass": False, "detail": f"unparseable last_client_contact: {lcc}"}
    elif hasattr(lcc, "date"):
        lcc_date = lcc.date()
    else:
        return {"pass": False, "detail": f"unexpected type for last_client_contact: {type(lcc)}"}

    days_since = (DEMO_DATE - lcc_date).days

    client_doc = collection_ref(firm_id, "clients").document("whitmore-group").get()
    threshold = 14
    if client_doc.exists:
        threshold = int(client_doc.to_dict().get("client_silence_threshold_days", 14))

    if days_since < threshold:
        return {"pass": False, "detail": f"only {days_since} days since contact (threshold {threshold})"}
    return {"pass": True, "detail": f"{days_since} days since last contact (threshold {threshold})"}


def _check_console_inbound(firm_id: str) -> dict:
    """Console: ≥3 inbound messages in AWAITING_TRIAGE status."""
    docs = list(collection_ref(firm_id, "inbound_messages").where("status", "==", "AWAITING_TRIAGE").stream())
    if len(docs) < 3:
        return {"pass": False, "detail": f"only {len(docs)} AWAITING_TRIAGE inbound messages (need ≥3)"}
    return {"pass": True, "detail": f"{len(docs)} AWAITING_TRIAGE inbound messages"}


@router.get("/demo/ready")
def demo_ready():
    firm_id = config.DEMO_FIRM_ID
    try:
        checks = {
            "deadline_mercer_escalates": _check_deadline_mercer(firm_id),
            "te_005_scrubber_hit": _check_te_005_scrubber(firm_id),
            "te_001_missing_narrative": _check_te_001_missing_narrative(firm_id),
            "acme_budget_warn": _check_acme_budget_warn(firm_id),
            "whitmore_client_silence": _check_whitmore_silence(firm_id),
            "console_inbound_messages": _check_console_inbound(firm_id),
        }
    except Exception as e:
        return {"ok": False, "error": str(e), "demo_date": config.DEMO_DATE_STR, "firm_id": firm_id}

    all_pass = all(c["pass"] for c in checks.values())
    return {
        "ok": all_pass,
        "demo_date": config.DEMO_DATE_STR,
        "firm_id": firm_id,
        "checks": checks,
    }


# ---------------------------------------------------------------------------
# POST /api/demo/reset
# ---------------------------------------------------------------------------

class ResetRequest(BaseModel):
    firm_id: str
    confirm: bool


@router.post("/demo/reset")
def demo_reset(req: ResetRequest):
    if not req.confirm:
        return {"ok": False, "message": "confirm must be true"}
    if req.firm_id != config.DEMO_FIRM_ID:
        return {"ok": False, "message": f"reset only allowed for demo firm {config.DEMO_FIRM_ID}"}
    try:
        from app.demo.seeder import run_reset
        result = run_reset(req.firm_id)
        return result
    except Exception as e:
        return {"ok": False, "error": str(e), "firm_id": req.firm_id}


# ---------------------------------------------------------------------------
# GET /api/demo/state
# ---------------------------------------------------------------------------

@router.get("/demo/state")
def demo_state():
    firm_id = config.DEMO_FIRM_ID
    collections = [
        "attorneys", "clients", "matters", "time_entries",
        "deadlines", "deadline_events", "client_communications",
        "invoices", "escalations", "audit_log", "ingestion_signals",
        "source_emails", "agent_runs",
    ]
    try:
        counts = {col: len(list(collection_ref(firm_id, col).stream())) for col in collections}
        return {"firm_id": firm_id, "ok": True, "demo_date": config.DEMO_DATE_STR, "counts": counts}
    except Exception as e:
        return {"firm_id": firm_id, "ok": False, "error": str(e)}
