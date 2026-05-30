"""
Set demo mode env vars before any test imports app code.
"""

import os

os.environ.setdefault("LITT_DEMO_MODE", "true")
os.environ.setdefault("LITT_DEMO_DATE", "2026-05-29")
os.environ.setdefault("LITT_DEMO_FIRM_ID", "strand-okafor")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "litt-hackathon")
