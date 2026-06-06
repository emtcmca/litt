"""
Backend-level pytest conftest — sets demo env vars before any test module is collected.
This runs before any test module import, ensuring config.py reads the correct date.
"""
import os

os.environ["LITT_DEMO_MODE"] = "true"
os.environ["LITT_DEMO_DATE"] = "2026-06-25"
os.environ["LITT_DEMO_FIRM_ID"] = "strand-okafor"
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "litt-hackathon")
