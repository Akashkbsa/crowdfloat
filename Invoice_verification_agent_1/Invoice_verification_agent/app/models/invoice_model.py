"""
invoice_model.py — Pydantic models for structured API responses.

Using Pydantic ensures automatic validation, serialisation to JSON,
and clean Swagger documentation.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict


class InvoiceData(BaseModel):
    """Structured fields extracted from the invoice via OCR + parsing."""
    invoice_id: Optional[str] = Field(None, description="Unique invoice identifier")
    gst:        Optional[str] = Field(None, description="GST number found on invoice")
    amount:     Optional[float] = Field(None, description="Total amount on invoice")
    date:       Optional[str] = Field(None, description="Invoice date (DD-MM-YYYY)")


class ScoreBreakdown(BaseModel):
    """Individual scores from each verification check."""
    data_score:      float = Field(..., description="Completeness of extracted data")
    gst_score:       float = Field(..., description="GST validity score")
    duplicate_score: float = Field(..., description="Duplicate-invoice score")
    behavior_score:  float = Field(..., description="Behavioral anomaly score")


class VerificationResult(BaseModel):
    """Final response returned by POST /verify-invoice."""
    invoice_data:  InvoiceData     = Field(..., description="Parsed invoice fields")
    scores:        ScoreBreakdown  = Field(..., description="Per-check scores")
    invoice_score: float           = Field(..., description="Overall trust score (0–1)")
    risk_level:    str             = Field(..., description="LOW / MEDIUM / HIGH")
    flags:         List[str]       = Field(default_factory=list, description="Warning flags")


class FinalVerificationResponse(BaseModel):
    """Spec-compliant final output for the platform."""
    invoice_id: Optional[str] = Field(None, description="Invoice identifier")
    invoice_score: float = Field(..., ge=0.0, le=1.0, description="Final trust score (0..1)")
    risk_level: str = Field(..., description="LOW / MEDIUM / HIGH")
    status: str = Field(..., description="APPROVED / REVIEW / REJECTED")
    flags: List[str] = Field(default_factory=list, description="Deduplicated flags from all checks")
