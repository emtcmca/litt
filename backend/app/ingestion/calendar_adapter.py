"""
Calendar ingestion adapter.
v1.0: DemoFixtureCalendarSource — returns seeded fixture data, no OAuth.
v1.1: RealCalendarOAuthSource — requires Google Calendar API OAuth.
"""

from __future__ import annotations

from typing import List, Protocol, runtime_checkable

from app.ingestion.demo_fixtures import DEMO_CALENDAR_FIXTURES, DeadlineCandidate


@runtime_checkable
class CalendarDeadlineSource(Protocol):
    def get_deadline_candidates(
        self, firm_id: str, lookback_hours: int = 24
    ) -> List[DeadlineCandidate]: ...


class DemoFixtureCalendarSource:
    """
    Returns seeded calendar fixture data. No OAuth, no network calls.
    Used by the coordinator in demo mode.
    """

    def get_deadline_candidates(
        self, firm_id: str, lookback_hours: int = 24
    ) -> List[DeadlineCandidate]:
        return DEMO_CALENDAR_FIXTURES.get(firm_id, [])


class RealCalendarOAuthSource:
    """
    Real Google Calendar API integration. v1.1 implementation path.
    Requires OAuth 2.0 user consent (calendar.readonly scope).
    """

    def get_deadline_candidates(
        self, firm_id: str, lookback_hours: int = 24
    ) -> List[DeadlineCandidate]:
        raise NotImplementedError("RealCalendarOAuthSource is v1.1 — not implemented")


def get_calendar_source(demo_mode: bool = True) -> CalendarDeadlineSource:
    if demo_mode:
        return DemoFixtureCalendarSource()
    return RealCalendarOAuthSource()
