"""
scoring_service.py — Stage 4: Scoring System.

Consumes Stage-3 check outputs and returns a final trust score (0..1),
risk classification, and aggregated flags.
"""

from __future__ import annotations

from typing import Any, Dict, List, Mapping, Tuple

from app.config import SCORE_WEIGHTS
from app.utils.helpers import log_stage


DEFAULT_WEIGHTS: Dict[str, float] = {
    "data_validation": 0.2,
    "gst_validation": 0.3,
    "duplicate_check": 0.3,
    "behavior_check": 0.2,
}


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def compute_invoice_score(
    checks: Mapping[str, Mapping[str, Any]],
    weights: Mapping[str, float] | None = None,
) -> float:
    """
    Weighted sum of check scores.
    - Ensures 0..1
    - Rounded to 2 decimals
    """
    w = dict(DEFAULT_WEIGHTS)
    # Allow config override + caller override (bonus: configurable weights).
    if SCORE_WEIGHTS:
        # SCORE_WEIGHTS may still use old keys in your app; we only use matching keys.
        for k, v in SCORE_WEIGHTS.items():
            if isinstance(v, (int, float)):
                w[k] = float(v)
    if weights:
        for k, v in weights.items():
            w[k] = float(v)

    score = 0.0
    for check_name, weight in w.items():
        raw = checks.get(check_name, {})
        part = raw.get("score", 0.0)
        try:
            part_f = float(part)
        except (TypeError, ValueError):
            part_f = 0.0
        score += _clamp01(part_f) * float(weight)

    score = _clamp01(score)
    return round(score, 2)


def classify_risk(score: float) -> Tuple[str, str]:
    """
    - score > 0.75 → LOW RISK (APPROVED)
    - 0.5 <= score <= 0.75 → MEDIUM RISK (REVIEW)
    - score < 0.5 → HIGH RISK (REJECTED)
    """
    if score > 0.75:
        return "LOW", "APPROVED"
    if score >= 0.5:
        return "MEDIUM", "REVIEW"
    return "HIGH", "REJECTED"


def aggregate_flags(checks: Mapping[str, Mapping[str, Any]]) -> List[str]:
    """Combine flags from all checks, remove duplicates, stable-ish order."""
    seen: set[str] = set()
    combined: List[str] = []
    for _, result in checks.items():
        flags = result.get("flags") or []
        if not isinstance(flags, list):
            continue
        for f in flags:
            if isinstance(f, str) and f and f not in seen:
                seen.add(f)
                combined.append(f)
    return combined


def build_final_response(
    invoice_data: Mapping[str, Any],
    checks: Mapping[str, Mapping[str, Any]],
) -> Dict[str, Any]:
    """
    Final output format:
    {
      "invoice_id": "INV123",
      "invoice_score": 0.82,
      "risk_level": "LOW",
      "status": "APPROVED",
      "flags": [...]
    }
    """
    invoice_id = invoice_data.get("invoice_id")
    score = compute_invoice_score(checks)
    risk_level, status = classify_risk(score)
    flags = aggregate_flags(checks)

    log_stage("SCORING", f"invoice_id={invoice_id} score={score} risk={risk_level} status={status} flags={flags}")

    return {
        "invoice_id": invoice_id,
        "invoice_score": score,
        "risk_level": risk_level,
        "status": status,
        "flags": flags,
    }
