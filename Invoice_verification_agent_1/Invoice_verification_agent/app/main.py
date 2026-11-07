"""
main.py — FastAPI application entry point.

• Registers the invoice verification router.
• Creates the upload directory on startup.
• Provides Swagger documentation at /docs.
"""

import os
from fastapi import FastAPI
from app.routes.invoice import router as invoice_router
from app.config import UPLOAD_DIR
from app.utils.helpers import log_stage

# ─── Create the FastAPI app with Swagger metadata ───────────────────────────
app = FastAPI(
    title="Invoice Verification Engine",
    description=(
        "Upload an invoice image → OCR extraction → structured parsing → "
        "multi-check verification → trust score & risk level.\n\n"
        "Built with **FastAPI** and **Tesseract OCR** for the SA-Hackathon '26."
    ),
    version="1.0.0",
    docs_url="/docs",          # Swagger UI
    redoc_url="/redoc",        # ReDoc alternative
)

# ─── Include the invoice router ─────────────────────────────────────────────
app.include_router(invoice_router, tags=["Invoice Verification"])


# ─── Startup event: ensure uploads directory exists ─────────────────────────
@app.on_event("startup")
async def startup_event():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    log_stage("STARTUP", f"Upload directory ready → {os.path.abspath(UPLOAD_DIR)}")
    log_stage("STARTUP", "Invoice Verification Engine is running 🚀")


# ─── Health-check / root endpoint ───────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    """Simple health-check endpoint."""
    return {
        "status": "ok",
        "service": "Invoice Verification Engine",
        "docs": "/docs",
    }
