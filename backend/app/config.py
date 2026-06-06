import os
from datetime import date, datetime
from pathlib import Path

from dotenv import load_dotenv

# Load .env from repo root (backend/app/config.py → backend/app → backend → repo root)
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=_env_path, override=False)

# Empty GOOGLE_APPLICATION_CREDENTIALS breaks ADC fallback — remove it so Google auth
# can find the well-known ADC file at %APPDATA%/gcloud/application_default_credentials.json
if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
    os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)

DEMO_MODE: bool = os.getenv("LITT_DEMO_MODE", "false").lower() == "true"
DEMO_DATE_STR: str = os.getenv("LITT_DEMO_DATE", "")
DEMO_FIRM_ID: str = os.getenv("LITT_DEMO_FIRM_ID", "strand-okafor")
FIRM_TIMEZONE: str = os.getenv("LITT_FIRM_TIMEZONE", "America/New_York")

GOOGLE_CLOUD_PROJECT: str = os.getenv("GOOGLE_CLOUD_PROJECT", "litt-hackathon")
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
    Reads env at call time so tests can override without re-importing.
    """
    demo_mode = os.getenv("LITT_DEMO_MODE", "false").lower() == "true"
    demo_date_str = os.getenv("LITT_DEMO_DATE", "")
    if demo_mode and demo_date_str:
        return date.fromisoformat(demo_date_str)
    return date.today()


def get_effective_datetime() -> datetime:
    """
    Always use this instead of datetime.now(). Returns frozen demo datetime in demo mode.
    Reads env at call time so tests can override without re-importing.
    """
    demo_mode = os.getenv("LITT_DEMO_MODE", "false").lower() == "true"
    demo_date_str = os.getenv("LITT_DEMO_DATE", "")
    if demo_mode and demo_date_str:
        demo_date = date.fromisoformat(demo_date_str)
        return datetime.combine(demo_date, datetime.min.time())
    return datetime.now()
