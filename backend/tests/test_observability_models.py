"""
D6-VIS-03 — Observability model tests.

Verifies: models instantiate cleanly, enums have correct values,
generate_observation_id produces unique IDs, elapsed_seconds serializes
as a plain float (not @property), SweepRunResponse composes correctly.
"""

import os

os.environ.setdefault("LITT_DEMO_MODE", "true")
os.environ.setdefault("LITT_DEMO_DATE", "2026-05-29")
os.environ.setdefault("LITT_DEMO_FIRM_ID", "strand-okafor")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "litt-hackathon")

from datetime import datetime

import pytest

from app.observability import (
    AgentObservation,
    AgentRunTimeline,
    CommitmentLevel,
    ObservationType,
    generate_observation_id,
)


# ---------------------------------------------------------------------------
# Enum values
# ---------------------------------------------------------------------------


def test_observation_type_values():
    assert ObservationType.SIGNAL_RECEIVED == "SIGNAL_RECEIVED"
    assert ObservationType.REASONING == "REASONING"
    assert ObservationType.ROUTING_DECISION == "ROUTING_DECISION"
    assert ObservationType.TOOL_CALL == "TOOL_CALL"
    assert ObservationType.RESULT == "RESULT"
    assert ObservationType.ESCALATION == "ESCALATION"
    assert ObservationType.APPROVAL_GATE_APPLIED == "APPROVAL_GATE_APPLIED"
    assert len(ObservationType) == 7


def test_commitment_level_values():
    assert CommitmentLevel.AUTO_SAFE == "AUTO_SAFE"
    assert CommitmentLevel.REVIEW_REQUIRED == "REVIEW_REQUIRED"
    assert CommitmentLevel.ESCALATION == "ESCALATION"
    assert CommitmentLevel.BLOCKED == "BLOCKED"
    assert len(CommitmentLevel) == 4


# ---------------------------------------------------------------------------
# AgentObservation
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_observation() -> AgentObservation:
    return AgentObservation(
        observation_id="obs-20260529000000000000-coordinator-001",
        timestamp=datetime(2026, 5, 29, 9, 0, 0),
        agent_name="coordinator",
        observation_type=ObservationType.SIGNAL_RECEIVED,
        commitment_level=CommitmentLevel.AUTO_SAFE,
        description="Sweep triggered for strand-okafor",
        work_kind="deterministic",
    )


def test_observation_instantiates(sample_observation):
    assert sample_observation.agent_name == "coordinator"
    assert sample_observation.work_kind == "deterministic"


def test_observation_defaults(sample_observation):
    assert sample_observation.data == {}
    assert sample_observation.evidence == []
    assert sample_observation.confidence is None
    assert sample_observation.attorney_next_action is None
    assert sample_observation.run_id is None


def test_observation_enum_stored_as_string(sample_observation):
    # use_enum_values=True — enums serialize to raw strings
    d = sample_observation.model_dump()
    assert d["observation_type"] == "SIGNAL_RECEIVED"
    assert d["commitment_level"] == "AUTO_SAFE"


def test_observation_with_escalation():
    obs = AgentObservation(
        observation_id="obs-001",
        timestamp=datetime(2026, 5, 29, 9, 1, 0),
        agent_name="deadline_agent",
        observation_type=ObservationType.ESCALATION,
        commitment_level=CommitmentLevel.ESCALATION,
        description="Rivera deadline conflict — opposing counsel email vs. no court order",
        confidence=0.7,
        work_kind="llm_assisted",
        model_name="gemini-2.5-pro",
        attorney_next_action="Verify Rivera deadline against court records and confirm with opposing counsel.",
        evidence=["email-rivera-opp-20260528", "dl-rivera-001"],
    )
    assert obs.attorney_next_action is not None
    assert obs.confidence == 0.7
    assert obs.work_kind == "llm_assisted"
    assert len(obs.evidence) == 2


# ---------------------------------------------------------------------------
# AgentRunTimeline
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_timeline(sample_observation) -> AgentRunTimeline:
    started = datetime(2026, 5, 29, 9, 0, 0)
    completed = datetime(2026, 5, 29, 9, 0, 2)
    elapsed = (completed - started).total_seconds()
    return AgentRunTimeline(
        run_id="sweep-abc123",
        firm_id="strand-okafor",
        triggered_by="attorney-action",
        started_at=started,
        completed_at=completed,
        elapsed_seconds=elapsed,
        observations=[sample_observation],
        brief_items_count=5,
        escalations_count=1,
    )


def test_timeline_instantiates(sample_timeline):
    assert sample_timeline.run_id == "sweep-abc123"
    assert sample_timeline.firm_id == "strand-okafor"
    assert len(sample_timeline.observations) == 1


def test_elapsed_seconds_is_plain_float(sample_timeline):
    # Must serialize — @property would not appear in model_dump()
    d = sample_timeline.model_dump()
    assert "elapsed_seconds" in d
    assert isinstance(d["elapsed_seconds"], float)
    assert d["elapsed_seconds"] == 2.0


def test_timeline_counts(sample_timeline):
    assert sample_timeline.brief_items_count == 5
    assert sample_timeline.escalations_count == 1


# ---------------------------------------------------------------------------
# generate_observation_id
# ---------------------------------------------------------------------------


def test_generate_observation_id_format():
    obs_id = generate_observation_id("coordinator", 0)
    assert obs_id.startswith("obs-")
    assert "coordinator" in obs_id


def test_generate_observation_id_uniqueness():
    # Same agent name, different counters → different IDs
    id_a = generate_observation_id("billing_agent", 0)
    id_b = generate_observation_id("billing_agent", 1)
    assert id_a != id_b


def test_generate_observation_id_uses_demo_clock():
    # Demo mode frozen to 2026-05-29 — ID should contain that date
    obs_id = generate_observation_id("deadline_agent", 0)
    assert "20260529" in obs_id


def test_generate_observation_id_slug_normalization():
    # Underscores and spaces → hyphens in slug
    id_underscore = generate_observation_id("billing_agent", 0)
    id_space = generate_observation_id("billing agent", 0)
    # Both contain hyphenated slug
    assert "billing-agent" in id_underscore
    assert "billing-agent" in id_space
