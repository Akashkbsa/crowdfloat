"""
config.py — Central configuration for the Invoice Verification System.

All tuneable parameters (paths, weights, thresholds, mock data) live here
so that service modules stay free of hard-coded values.
"""

import os
import shutil
from pathlib import Path

# Resolve paths relative to this file so the service can be started from
# any working directory.
APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parent

# ─── Directory where uploaded invoices are temporarily stored ────────────────
UPLOAD_DIR = str(PROJECT_ROOT / "uploads")

# ─── Tesseract binary path ────────────────────────────────────────────────────
# Prefer an explicit env var, then fall back to common Windows install location,
# then finally to `tesseract` on PATH.
_DEFAULT_TESSERACT_CMD = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
TESSERACT_CMD = (os.getenv("TESSERACT_CMD") or "").strip() or None
if not TESSERACT_CMD:
    if Path(_DEFAULT_TESSERACT_CMD).exists():
        TESSERACT_CMD = _DEFAULT_TESSERACT_CMD
    else:
        # pytesseract will call whatever string we set here; if Tesseract is on PATH
        # this works without needing a full install directory.
        TESSERACT_CMD = shutil.which("tesseract") or "tesseract"

# ─── Scoring weights (must sum to 1.0) ──────────────────────────────────────
SCORE_WEIGHTS = {
    # New keys used by Stage-4 scoring (preferred)
    "data_validation": 0.2,
    "gst_validation": 0.3,
    "duplicate_check": 0.3,
    "behavior_check": 0.2,
}

# ─── Behavior-check parameters ──────────────────────────────────────────────
DEFAULT_AVERAGE_AMOUNT = 30_000          # baseline average invoice amount
HIGH_AMOUNT_MULTIPLIER = 2              # flag if amount > multiplier × average

# ─── Mock GST database (for demo / hackathon) ───────────────────────────────
# Format requested by spec:
#   GST_DB = {
#       "29ABCDE1234F1Z5": {"name": "...", "status": "Active"},
#       ...
#   }
GST_DB = {
    "29ABCDE1234F1Z5": {"name": "ABC Pvt Ltd", "status": "Active"},
    "33XYZAB5678K1Z2": {"name": "XYZ Traders", "status": "Active"},
    # Keep your existing demo / real sample GSTINs too.
    "27AAPFU0939F1ZV": {"name": "Demo GST 1", "status": "Active"},
    "07AAACH6188F1ZM": {"name": "Demo GST 2", "status": "Active"},
    "33AABCU9603R1ZM": {"name": "Demo GST 3", "status": "Active"},
    "06ABCDE1234F1Z5": {"name": "Demo GST 4", "status": "Active"},
    "24AAACC1206D1ZM": {"name": "Demo GST 5", "status": "Active"},
    "19AABCU9603R1ZM": {"name": "Demo GST 6", "status": "Active"},
    "32ABCDE5678G2H9": {"name": "Demo GST 7", "status": "Active"},
    "33DSZPP0624K1Z7": {"name": "RK Enterprises", "status": "Active"},
    "34AIRPV5028N1ZG": {"name": "Buyer", "status": "Active"},
    # GSTINs observed in your real sample invoices
    "34AEQFS3878C1ZN": {"name": "Sample GST", "status": "Active"},
    "33AKCPP4134A3ZR": {"name": "Sample GST", "status": "Active"},
    "19AAHFE2360C1ZR": {"name": "Sample GST", "status": "Active"},
    "20BDMPS2722M2ZD": {"name": "Sample GST", "status": "Active"},
}

# Backwards-compat: some parts of the app may still use a simple list.
VALID_GST_NUMBERS = list(GST_DB.keys())

# ─── PDF rendering settings (for pdf2image) ───────────────────────────────
# If you installed poppler in a non-standard location, set the path here.
# Example on Windows: r"C:\\Program Files\\poppler-23.05.0\\Library\\bin"
POPPLER_PATH = (os.getenv("POPPLER_PATH") or "").strip() or None


# ─── Risk-level thresholds ──────────────────────────────────────────────────
RISK_THRESHOLDS = {
    "LOW":    0.75,   # score > 0.75
    "MEDIUM": 0.50,   # 0.50 < score ≤ 0.75
    # anything ≤ 0.50 → HIGH
}
