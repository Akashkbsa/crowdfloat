"""
invoice.py — API route for invoice verification.

Exposes a single endpoint:
    POST /verify-invoice

Orchestrates the full pipeline:
    upload → OCR → parse → verify → score → respond
"""

import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.config import UPLOAD_DIR
from app.services.ocr_service import extract_text
from app.services.parser_service import parse_invoice_text
from app.services.verification_service import run_verification
from app.services.scoring_service import build_final_response
from app.models.invoice_model import (
    FinalVerificationResponse,
)
from app.utils.helpers import save_upload_file, log_stage

router = APIRouter()


@router.post(
    "/verify-invoice",
    response_model=FinalVerificationResponse,
    summary="Upload & verify an invoice",
    description=(
        "Accepts an invoice image (PNG/JPG) or PDF, extracts text via OCR, "
        "parses structured fields, runs verification checks, and returns a "
        "trust score with risk level."
    ),
)
async def verify_invoice(file: UploadFile = File(..., description="Invoice image file")):
    """
    End-to-end invoice verification pipeline.

    Steps
    -----
    1. Save the uploaded file.
    2. Run OCR to extract raw text.
    3. Parse structured fields from the text.
    4. Run verification checks (data, GST, duplicate, behavior).
    5. Calculate the overall invoice score.
    6. Return the verification result.
    """

    # ── Step 1: Save uploaded file ──────────────────────────────────────────
    log_stage("API", f"Received file: {file.filename}")
    try:
        file_path = await save_upload_file(file, UPLOAD_DIR)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {exc}")

    # ── Step 2: OCR extraction ──────────────────────────────────────────────
    try:
        raw_text = extract_text(file_path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # ── Step 3: Parse text into structured data ─────────────────────────────
    parsed = parse_invoice_text(raw_text)

    # ── Step 4: Run modular verification engine ─────────────────────────────
    checks = run_verification(parsed)

    # ── Step 5: Score + classify risk/status + aggregate flags ───────────────
    result = build_final_response(parsed, checks)

    log_stage(
        "API",
        f"Verification complete → invoice_id={result.get('invoice_id')} score={result.get('invoice_score')} risk={result.get('risk_level')}",
    )

    # Clean up saved file after processing (optional)
    try:
        os.remove(file_path)
        log_stage("API", f"Cleaned up temp file: {file_path}")
    except OSError:
        pass

    return result


@router.post(
    "/debug-ocr",
    summary="Debug OCR output and parser fields",
    description=(
        "Upload an invoice image and return raw OCR text plus parsed fields "
        "for manual troubleshooting."
    ),
)
async def debug_ocr(file: UploadFile = File(..., description="Invoice image file")):
    """Debug endpoint for OCR text review and parser tuning."""
    log_stage("API", f"[DEBUG] Received file: {file.filename}")

    try:
        file_path = await save_upload_file(file, UPLOAD_DIR)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {exc}")

    try:
        raw_text = extract_text(file_path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    parsed = parse_invoice_text(raw_text)

    # Clean up as well
    try:
        os.remove(file_path)
        log_stage("API", f"[DEBUG] Cleaned up temp file: {file_path}")
    except OSError:
        pass

    return {
        "raw_text": raw_text,
        "parsed": parsed,
        "raw_preview": raw_text[:120],
        "parsed_summary": {
            "invoice_id": parsed.get("invoice_id"),
            "gst": parsed.get("gst"),
            "amount": parsed.get("amount"),
            "date": parsed.get("date"),
        },
    }
