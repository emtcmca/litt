"""
Brief response schema — all 5 sections.
TypeScript counterparts live in dashboard/src/types.ts.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel
from app.observability import AgentRunTimeline


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------

class BriefScrubberFlag(BaseModel):
    check_name: str
    severity: str          # BLOCK | WARN
    message: str
    matched_text: Optional[str] = None


# ---------------------------------------------------------------------------
# Section 1 — Deadlines
# ---------------------------------------------------------------------------

class BriefDeadlineItem(BaseModel):
    deadline_id: str
    version: int = 1
    matter_id: str
    matter_name: str
    client_id: str
    client_name: str
    description: str
    due_date: str          # ISO YYYY-MM-DD
    days_out: int
    classification: str    # HARD_LEGAL | HARD_CONTRACTUAL | SOFT_INTERNAL | ADMINISTRATIVE
    status: str
    verification_status: str
    last_confirmed_by: Optional[str] = None
    last_confirmed_at: Optional[str] = None
    is_unconfirmed: bool   # attorney_verified but never confirmed
    escalation_level: Optional[str] = None  # 7_DAY | 3_DAY | 1_DAY | CRITICAL
    # Source grounding — links item back to the document that generated it
    source_type: Optional[str] = None          # court_order | contract | email | calendar
    source_document_id: Optional[str] = None   # document/email ID from ingestion
    source_excerpt: Optional[str] = None       # verbatim text extracted from source
    court: Optional[str] = None
    jurisdiction: Optional[str] = None
    detected_at: Optional[str] = None          # ISO datetime when ingested
    conflict_detail: Optional[str] = None      # set when verification_status=conflict_flagged


class DeadlineSection(BaseModel):
    items: List[BriefDeadlineItem]
    count: int
    has_critical: bool     # HARD_LEGAL with ≤7 days out


# ---------------------------------------------------------------------------
# Section 2 — Time entries (PENDING, with inline scrubber flags)
# ---------------------------------------------------------------------------

class BriefTimeEntryItem(BaseModel):
    entry_id: str
    version: int = 1
    matter_id: str
    matter_name: str
    client_id: str
    client_name: str
    attorney_id: str
    entry_date: str
    hours: float
    amount: float
    narrative: Optional[str] = None
    status: str
    scrubber_flags: List[BriefScrubberFlag]
    has_block: bool
    has_warn: bool
    task_code: Optional[str] = None
    activity_code: Optional[str] = None
    session_minutes_actual: Optional[int] = None


class TimeEntrySection(BaseModel):
    items: List[BriefTimeEntryItem]
    count: int
    total_wip_usd: float


# ---------------------------------------------------------------------------
# Section 3 — Budget risks
# ---------------------------------------------------------------------------

class BriefBudgetItem(BaseModel):
    client_id: str
    client_name: str
    budget_cap: float
    budget_billed: float           # from prior invoices
    approved_unbilled: float       # APPROVED entries not yet invoiced
    total_committed: float         # budget_billed + approved_unbilled
    utilization_pct: float         # 0–100
    alert_status: str              # WARN | CRITICAL
    threshold_pct: float           # threshold that triggered the alert


class BudgetRisksSection(BaseModel):
    items: List[BriefBudgetItem]
    count: int


# ---------------------------------------------------------------------------
# Section 4 — Client silence
# ---------------------------------------------------------------------------

class BriefClientSilenceItem(BaseModel):
    matter_id: str
    matter_name: str
    client_id: str
    client_name: str
    days_since_contact: int
    threshold_days: int
    last_contact_date: Optional[str] = None   # ISO YYYY-MM-DD
    comm_draft_id: Optional[str] = None       # if a draft already exists


class ClientSilenceSection(BaseModel):
    items: List[BriefClientSilenceItem]
    count: int


# ---------------------------------------------------------------------------
# Section 5 — Anomalies (ANOMALY escalations, PENDING)
# ---------------------------------------------------------------------------

class BriefAnomalyItem(BaseModel):
    escalation_id: str
    matter_id: Optional[str] = None
    entity_id: str
    entity_type: str               # time_entry | deadline | communication
    risk_level: str                # CRITICAL | ELEVATED | ROUTINE
    priority: int
    what_is_happening: str
    why_it_matters: str
    what_litt_has_done: str
    what_attorney_must_decide: str
    created_at: str


class AnomaliesSection(BaseModel):
    items: List[BriefAnomalyItem]
    count: int


# ---------------------------------------------------------------------------
# Top-level response
# ---------------------------------------------------------------------------

class BriefSections(BaseModel):
    deadlines: DeadlineSection
    time_entries: TimeEntrySection
    budget_risks: BudgetRisksSection
    client_silence: ClientSilenceSection
    anomalies: AnomaliesSection


class BriefResponse(BaseModel):
    firm_id: str
    firm_name: str
    attorney_id: str
    attorney_name: str
    generated_at: str
    demo_mode: bool
    sections: BriefSections
    resolved_today: List[dict] = []


# ---------------------------------------------------------------------------
# Sweep result
# ---------------------------------------------------------------------------

class SweepResponse(BaseModel):
    sweep_id: str
    firm_id: str
    duration_ms: int
    sections_updated: List[str]
    escalations_created: int
    anomalies_detected: int


class SweepRunResponse(BaseModel):
    """
    Full sweep result — timeline of agent observations + assembled brief.
    Returned by POST /api/sweep so the frontend needs only one call.
    """
    timeline: AgentRunTimeline
    brief: BriefResponse
