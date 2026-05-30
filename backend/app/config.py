import os
from datetime import date, datetime

DEMO_MODE: bool = os.getenv("LITT_DEMO_MODE", "false").lower() == "true"
DEMO_DATE_STR: str = os.getenv("LITT_DEMO_DATE", "")
DEMO_FIRM_ID: str = os.getenv("LITT_DEMO_FIRM_ID", "strand-okafor")
FIRM_TIMEZONE: str = os.getenv("LITT_FIRM_TIMEZONE", "America/New_York")

GOOGLE_CLOUD_PROJECT: str = os.getenv("GOOGLE_CLOUD_PROJECT", "litt-prod")
VERTEX_AI_LOCATION: str = os.getenv("VERTEX_AI_LOCATION", "us-central1")
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")

BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8000")
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
CORS_ORIGINS: list[str] = os.getenv(
    "CORS_ORIGINS", "http://localhost:3000"
).split(",")

EMAIL_DELIVERY_MODE: str = os.getenv("EMAIL_DELIVERY_MODE", "demo_outbox")

CLIENT_SILENCE_THRESHOLD_DAYS: int = 14


def get_effective_date() -> date:
    """
    Always use this instead of date.today(). Returns frozen demo date in demo mode.
    """
    if DEMO_MODE and DEMO_DATE_STR:
        return date.fromisoformat(DEMO_DATE_STR)
    return date.today()


def get_effective_datetime() -> datetime:
    """
    Always use this instead of datetime.now(). Returns frozen demo datetime in demo mode.
    """
    if DEMO_MODE and DEMO_DATE_STR:
        demo_date = date.fromisoformat(DEMO_DATE_STR)
        return datetime.combine(demo_date, datetime.min.time())
    return datetime.now()
