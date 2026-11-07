"""
verification_service.py — Stage 3: Verification Engine (modular checks).

Each check is an independent component that returns:
    {
        "score": float,     # 0..1
        "flags": [str, ...] # warnings / failure reasons
    }

Designed to be hackathon-friendly, easy to extend, and FastAPI-ready.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, MutableMapping, Optional, Set, TypedDict

from app.config import DEFAULT_AVERAGE_AMOUNT, GST_DB, HIGH_AMOUNT_MULTIPLIER
from app.utils.helpers import log_stage


class CheckResult(TypedDict):
    score: float
    flags: List[str]


# ─── In-memory store of already-processed invoice IDs ────────────────────────
_processed_invoices: Set[str] = set()


GSTIN_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9][A-Z][A-Z0-9]$")


def _to_float(value: Any) -> Optional[float]:
    """Best-effort numeric conversion used by checks."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        s = value.strip().replace(",", "")
        if not s:
            return None
        try:
            return float(s)
        except ValueError:
            return None
    return None


# ─── 1) DATA VALIDATION CHECK ────────────────────────────────────────────────

def data_validation_check(invoice_data: Dict[str, Any]) -> CheckResult:
    """
    Rules:
    - If invoice_id or amount is missing → score=0.3
    - Otherwise → score=1.0
    """
    flags: List[str] = []
    invoice_id = (invoice_data.get("invoice_id") or "").strip() if isinstance(invoice_data.get("invoice_id"), str) else invoice_data.get("invoice_id")
    amount = _to_float(invoice_data.get("amount"))

    if not invoice_id or amount is None:
        flags.append("MISSING_REQUIRED_FIELDS")
        log_stage("VERIFY", f"[data_validation] missing invoice_id/amount → score=0.3 flags={flags}")
        return {"score": 0.3, "flags": flags}

    log_stage("VERIFY", "[data_validation] ok → score=1.0")
    return {"score": 1.0, "flags": flags}


# ─── 2) GST VALIDATION CHECK (MOCK DB) ───────────────────────────────────────

def gst_validation_check(
    gst: Optional[str],
    valid_gst_db: MutableMapping[str, Dict[str, Any]] | None = None,
) -> CheckResult:
    """
    Steps:
    - Validate GST format via regex
    - Check GST against mock DB

    Rules:
    - Invalid format → score=0.2, flag=INVALID_GST_FORMAT
    - Not found → score=0.3, flag=GST_NOT_FOUND
    - Valid → score=1.0
    """
    flags: List[str] = []
    db = valid_gst_db if valid_gst_db is not None else GST_DB

    gst_norm = (gst or "").strip().upper()
    if not gst_norm or not GSTIN_REGEX.match(gst_norm):
        flags.append("INVALID_GST_FORMAT")
        log_stage("VERIFY", f"[gst_validation] invalid format gst={gst!r} → score=0.2")
        return {"score": 0.2, "flags": flags}

    if gst_norm not in db:
        flags.append("GST_NOT_FOUND")
        log_stage("VERIFY", f"[gst_validation] gst not found gst={gst_norm} → score=0.3")
        return {"score": 0.3, "flags": flags}

    log_stage("VERIFY", f"[gst_validation] ok gst={gst_norm} → score=1.0")
    return {"score": 1.0, "flags": flags}


# ─── 3) DUPLICATE CHECK ─────────────────────────────────────────────────────

def duplicate_check(invoice_id: Optional[str]) -> CheckResult:
    """
    Rules:
    - If invoice_id already exists → score=0.0, flag=DUPLICATE_INVOICE
    - Else → score=1.0
    """
    flags: List[str] = []
    inv = (invoice_id or "").strip().upper()
    if not inv:
        # Can't check duplicates; treat as "not duplicate" here (data_validation handles missing ID).
        log_stage("VERIFY", "[duplicate_check] missing invoice_id → score=1.0")
        return {"score": 1.0, "flags": flags}

    if inv in _processed_invoices:
        flags.append("DUPLICATE_INVOICE")
        log_stage("VERIFY", f"[duplicate_check] duplicate inv={inv} → score=0.0")
        return {"score": 0.0, "flags": flags}

    _processed_invoices.add(inv)
    log_stage("VERIFY", f"[duplicate_check] new inv={inv} → score=1.0")
    return {"score": 1.0, "flags": flags}


# ─── 4) BEHAVIOR / ANOMALY CHECK ────────────────────────────────────────────

def behavior_check(amount: Any, average_amount: float = DEFAULT_AVERAGE_AMOUNT) -> CheckResult:
    """
    Rules:
    - If amount > 2 * average_amount (default avg=30000) → score=0.5, flag=HIGH_AMOUNT_ANOMALY
    - Else → score=0.9
    """
    flags: List[str] = []
    amt = _to_float(amount)
    if amt is None:
        log_stage("VERIFY", "[behavior_check] missing/invalid amount → score=0.9")
        return {"score": 0.9, "flags": flags}

    if amt > (HIGH_AMOUNT_MULTIPLIER * average_amount):
        flags.append("HIGH_AMOUNT_ANOMALY")
        log_stage("VERIFY", f"[behavior_check] high amount amt={amt} → score=0.5")
        return {"score": 0.5, "flags": flags}

    log_stage("VERIFY", f"[behavior_check] normal amt={amt} → score=0.9")
    return {"score": 0.9, "flags": flags}


# ─── Runner: run all checks ─────────────────────────────────────────────────

def run_verification(invoice_data: Dict[str, Any]) -> Dict[str, CheckResult]:
    """
    Run all verification checks and return a dict keyed by check name.
    """
    return {
        "data_validation": data_validation_check(invoice_data),
        "gst_validation": gst_validation_check(invoice_data.get("gst")),
        "duplicate_check": duplicate_check(invoice_data.get("invoice_id")),
        "behavior_check": behavior_check(invoice_data.get("amount")),
    }
