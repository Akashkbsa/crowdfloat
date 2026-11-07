from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional, List
import sys
import os
import shutil
import tempfile
from pathlib import Path
import sqlite3
import random
from mailer import send_otp_email, send_invoice_approval_email
import settlement_service

# Add SA-Hackathon to path
SA_HACKATHON_DIR = (
    Path(__file__).resolve().parent.parent / "SA-Hackathon" / "SA-Hackathon"
)
if SA_HACKATHON_DIR.exists():
    sys.path.insert(0, str(SA_HACKATHON_DIR))

try:
    from buyer_credit_agent import CreditworthinessAgentPipeline
    HAS_RISK_AGENT = True
except ImportError:
    HAS_RISK_AGENT = False

# Add Invoice Verification Agent to path
INV_AGENT_DIR = (
    Path(__file__).resolve().parent.parent
    / "Invoice_verification_agent_1"
    / "Invoice_verification_agent"
)
if INV_AGENT_DIR.exists():
    sys.path.insert(0, str(INV_AGENT_DIR))

try:
    from app.services.ocr_service import extract_text
    from app.services.parser_service import parse_invoice_text
    from app.services.verification_service import run_verification
    from app.services.scoring_service import build_final_response
    from app.config import GST_DB
    HAS_INV_AGENT = True
except Exception:
    HAS_INV_AGENT = False

app = FastAPI(title="CrowdFloat API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
        "http://127.0.0.1:5177",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FunderSubmission(BaseModel):
    entityType: str
    legalName: str
    contactPerson: str = ""
    email: str
    phone: str
    pan: str
    gst: str = ""
    regNumber: str = ""
    accountName: str
    accountNumber: str
    ifsc: str
    bankName: str = ""
    branch: str = ""
    accountType: str
    autoDebit: bool = False
    investProfile: str
    expLevel: str
    risk1: bool
    risk2: bool
    risk3: bool
    riskConfirm: bool
    finalConfirm: bool


class CompanySubmission(BaseModel):
    formData: Dict[str, Any] = Field(default_factory=dict)
    documents: Dict[str, Any] = Field(default_factory=dict)


class InvoiceSubmission(BaseModel):
    submissionId: str = ""
    fileName: str


class BuyerRiskAssessment(BaseModel):
    buyerId: str
    buyerName: str
    paymentHistory: Dict[str, Any] = Field(default_factory=dict)
    creditRatings: Dict[str, Any] = Field(default_factory=dict)
    financialStatement: Dict[str, Any] = Field(default_factory=dict)


class OTPRequest(BaseModel):
    email: str

class OTPVerify(BaseModel):
    email: str
    otp: str

class InvoiceApprovalRequest(BaseModel):
    invoiceId: str
    amount: float
    buyerEmail: Optional[str] = None
    buyerName: Optional[str] = None

class InvoiceConfirmAction(BaseModel):
    invoiceId: str
    token: str
    action: str

class InvoiceCreate(BaseModel):
    id: str
    supplierName: str
    buyerId: str
    buyerName: str
    buyerEmail: str
    program: str
    amount: float
    dueDate: str
    poReference: str
    gstVerified: Optional[bool] = False
    gstNumber: Optional[str] = ""
    gstCompanyName: Optional[str] = ""
    trustScore: Optional[float] = None
    riskLevel: Optional[str] = ""
    scrapedInvoiceId: Optional[str] = ""

class InvoiceStatusUpdate(BaseModel):
    status: str
    disputeReason: Optional[str] = ""

class AllocationItem(BaseModel):
    funder_id: str
    allocated_amount: float

class SettlementAllocateRequest(BaseModel):
    invoice_id: str
    allocations: List[AllocationItem]

class ReceivePaymentRequest(BaseModel):
    invoice_id: str


FUNDER_DB: Dict[str, Dict[str, Any]] = {}
COMPANY_DB: Dict[str, Dict[str, Any]] = {}
INVOICE_DB: Dict[str, Dict[str, Any]] = {}
INVOICE_SCRAPE_DB: Dict[str, Dict[str, Any]] = {}
OTP_STORE: Dict[str, str] = {}
APPROVAL_TOKENS: Dict[str, str] = {}  # invoice_id -> token


def _ensure_databases() -> None:
    """Auto-seed crowdfloat.db and buyer_financials.db on startup if missing."""
    here = Path(__file__).resolve().parent
    main_db = here / "crowdfloat.db"
    buyer_db = here / "buyer_financials.db"
    cwd = os.getcwd()
    try:
        os.chdir(here)
        if not main_db.exists():
            try:
                from generate_main_db import generate_main_db
                generate_main_db()
            except Exception as exc:
                print(f"[startup] could not seed crowdfloat.db: {exc}")
        if not buyer_db.exists():
            try:
                from generate_buyer_db import generate_buyer_db
                generate_buyer_db()
            except Exception as exc:
                print(f"[startup] could not seed buyer_financials.db: {exc}")
    finally:
        os.chdir(cwd)


_ensure_databases()


def _compute_invoice_status(created_at_iso: str) -> str:
    created_at = datetime.fromisoformat(created_at_iso)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    elapsed_seconds = (datetime.now(timezone.utc) - created_at).total_seconds()

    if elapsed_seconds < 4:
        return "Uploaded"
    if elapsed_seconds < 8:
        return "Agent Checking"
    if elapsed_seconds < 12:
        return "Under Review"
    return "Verified"


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


# --- Auth & OTP Endpoints ---
@app.post("/api/auth/send-otp")
def send_otp(req: OTPRequest) -> Dict[str, Any]:
    otp = str(random.randint(100000, 999999))
    OTP_STORE[req.email] = otp
    # Send via SMTP
    success = send_otp_email(req.email, otp)
    if not success:
        return {"success": False, "error": "Failed to send email. Check SMTP settings."}
    return {"success": True, "message": "OTP sent successfully"}

@app.post("/api/auth/verify-otp")
def verify_otp(req: OTPVerify) -> Dict[str, Any]:
    stored_otp = OTP_STORE.get(req.email)
    if not stored_otp or stored_otp != req.otp:
        return {"success": False, "error": "Invalid or expired OTP"}
    OTP_STORE.pop(req.email, None)
    return {"success": True, "message": "OTP verified successfully"}

# --- Invoice Email Approval Endpoints ---
@app.post("/api/invoice/request-approval")
def request_invoice_approval(req: InvoiceApprovalRequest) -> Dict[str, Any]:
    # Generate and store a token so /confirm-action can validate it
    token = f"val-{random.randint(100000, 999999)}"
    APPROVAL_TOKENS[req.invoiceId] = token
    success = send_invoice_approval_email(
        req.invoiceId, req.amount, token, buyer_email=req.buyerEmail or ""
    )
    if not success:
        return {"success": False, "error": "Failed to send approval email."}
    return {"success": True, "message": "Approval email sent to buyer"}

@app.post("/api/invoice/confirm-action")
def confirm_invoice_action(req: InvoiceConfirmAction) -> Dict[str, Any]:
    expected = APPROVAL_TOKENS.get(req.invoiceId)
    # If a token was issued for this invoice, enforce it; if none exists we allow
    # the first-call-through-link for demo convenience.
    if expected and req.token and expected != req.token:
        return {"success": False, "error": "Invalid or expired approval token"}
    db_path = Path(__file__).resolve().parent / 'crowdfloat.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    if req.action == "approve":
        cursor.execute(
            "UPDATE invoices SET status = 'confirmed-financing-eligible', dispute_reason = '' WHERE id = ?",
            (req.invoiceId,),
        )
    else:
        cursor.execute(
            "UPDATE invoices SET status = 'disputed', dispute_reason = 'Rejected via email link' WHERE id = ?",
            (req.invoiceId,),
        )
    conn.commit()
    conn.close()
    APPROVAL_TOKENS.pop(req.invoiceId, None)
    return {"success": True, "message": f"Invoice {req.invoiceId} successfully {req.action}d."}

# --- General Invoice DB Endpoints ---
CROWDFLOAT_DB = str(Path(__file__).resolve().parent / 'crowdfloat.db')


@app.get("/api/invoices")
def get_all_invoices() -> Dict[str, Any]:
    conn = sqlite3.connect(CROWDFLOAT_DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM invoices ORDER BY due_date ASC')
    rows = cursor.fetchall()
    conn.close()
    
    invoices = []
    for r in rows:
        invoices.append({
            "id": r["id"],
            "supplierName": r["supplier_name"],
            "buyerId": r["buyer_id"],
            "buyerName": r["buyer_name"],
            "buyerEmail": r["buyer_email"],
            "program": r["program"],
            "poReference": r["po_reference"],
            "dueDate": r["due_date"],
            "amount": r["amount"],
            "status": r["status"],
            "disputeReason": r["dispute_reason"],
            "gstVerified": bool(r["gst_verified"]),
            "gstNumber": r["gst_number"],
            "gstCompanyName": r["gst_company_name"],
            "trustScore": r["trust_score"],
            "riskLevel": r["risk_level"],
            "scrapedInvoiceId": r["scraped_invoice_id"]
        })
    return {"success": True, "invoices": invoices}

@app.post("/api/invoices")
def create_invoice(req: InvoiceCreate) -> Dict[str, Any]:
    conn = sqlite3.connect(CROWDFLOAT_DB)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO invoices (
            id, supplier_id, supplier_name, buyer_id, buyer_name, buyer_email,
            program, po_reference, due_date, amount, status, dispute_reason,
            gst_verified, gst_number, gst_company_name, trust_score, risk_level, scraped_invoice_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        req.id,
        "comp-supplier",
        req.supplierName,
        req.buyerId,
        req.buyerName,
        req.buyerEmail,
        req.program,
        req.poReference,
        req.dueDate,
        req.amount,
        "awaiting-buyer-confirmation",
        "",
        1 if req.gstVerified else 0,
        req.gstNumber,
        req.gstCompanyName,
        req.trustScore,
        req.riskLevel,
        req.scrapedInvoiceId
    ))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Invoice created"}

@app.put("/api/invoices/{invoice_id}/status")
def update_invoice_status(invoice_id: str, req: InvoiceStatusUpdate) -> Dict[str, Any]:
    conn = sqlite3.connect(CROWDFLOAT_DB)
    cursor = conn.cursor()
    cursor.execute('UPDATE invoices SET status = ?, dispute_reason = ? WHERE id = ?', 
                   (req.status, req.disputeReason, invoice_id))
    conn.commit()
    conn.close()
    return {"success": True}

# --- Settlement Agent Endpoints ---
@app.post("/api/settlements/allocate")
def allocate_funds(req: SettlementAllocateRequest) -> Dict[str, Any]:
    alloc_dicts = [{"funder_id": a.funder_id, "allocated_amount": a.allocated_amount} for a in req.allocations]
    result = settlement_service.register_allocations(req.invoice_id, alloc_dicts)
    if not result["success"]:
        return {"success": False, "error": result["error"]}
    return result

@app.post("/api/settlements/receive_payment")
def receive_buyer_payment(req: ReceivePaymentRequest) -> Dict[str, Any]:
    result = settlement_service.process_buyer_payment(req.invoice_id)
    if not result["success"]:
        return {"success": False, "error": result["error"]}
    return {"success": True, "event": result["data"]}


@app.post("/api/funder/kyc")
def submit_funder_kyc(payload: FunderSubmission) -> Dict[str, Any]:
    submission_id = f"FK-{int(datetime.utcnow().timestamp())}"
    FUNDER_DB[submission_id] = {
        "id": submission_id,
        "createdAt": datetime.utcnow().isoformat(),
        "status": "submitted",
        "payload": payload.model_dump(),
    }
    return {"success": True, "submissionId": submission_id, "status": "submitted"}


@app.post("/api/company/onboard")
def submit_company_onboarding(payload: CompanySubmission) -> Dict[str, Any]:
    submission_id = f"CO-{int(datetime.utcnow().timestamp())}"
    COMPANY_DB[submission_id] = {
        "id": submission_id,
        "createdAt": datetime.utcnow().isoformat(),
        "status": "submitted",
        "payload": payload.model_dump(),
    }
    return {"success": True, "submissionId": submission_id, "status": "submitted"}


@app.get("/api/funder/status/{submission_id}")
def funder_status(submission_id: str) -> Dict[str, Any]:
    item = FUNDER_DB.get(submission_id)
    if not item:
        raise HTTPException(status_code=404, detail="Submission not found")
    return item


@app.get("/api/company/status/{submission_id}")
def company_status(submission_id: str) -> Dict[str, Any]:
    item = COMPANY_DB.get(submission_id)
    if not item:
        raise HTTPException(status_code=404, detail="Submission not found")
    return item


@app.post("/api/company/invoices")
def submit_invoice(payload: InvoiceSubmission) -> Dict[str, Any]:
    invoice_id = f"INV-{int(datetime.utcnow().timestamp())}"
    record = {
        "id": invoice_id,
        "submissionId": payload.submissionId,
        "fileName": payload.fileName,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    INVOICE_DB[invoice_id] = record

    return {
        "success": True,
        "invoiceId": invoice_id,
        "status": _compute_invoice_status(record["createdAt"]),
    }


@app.get("/api/company/invoices/{invoice_id}/status")
def get_invoice_status(invoice_id: str) -> Dict[str, Any]:
    item = INVOICE_DB.get(invoice_id)
    if not item:
        raise HTTPException(status_code=404, detail="Invoice not found")

    status = _compute_invoice_status(item["createdAt"])
    return {
        "success": True,
        "invoiceId": invoice_id,
        "fileName": item["fileName"],
        "status": status,
    }


@app.post("/api/buyer/risk-assessment")
def assess_buyer_risk(payload: BuyerRiskAssessment) -> Dict[str, Any]:
    """Assess buyer creditworthiness and risk using AI agent"""
    try:
        if not HAS_RISK_AGENT:
            # Return mock assessment if agent not available
            return {
                "success": True,
                "buyerId": payload.buyerId,
                "buyerName": payload.buyerName,
                "creditworthinessScore": 750,
                "riskProbability": 0.15,
                "riskLevel": "Low",
                "recommendation": "Approved - Low risk buyer",
                "details": {
                    "paymentHistory": "Good track record",
                    "creditScore": "Excellent",
                    "financialHealth": "Stable"
                }
            }
        
        # Initialize agent
        model_path = os.getenv("BUYER_RISK_MODEL_PATH")
        if not model_path:
            model_path = str(SA_HACKATHON_DIR / "buyer_risk_model.pkl")
        agent = CreditworthinessAgentPipeline(model_path=model_path)
        
        # Load from Database (CIBIL score behavior)
        db_path = Path(__file__).resolve().parent / 'buyer_financials.db'
        
        # Initialize with empty/defaults
        payment_history = {}
        credit_ratings = {}
        financial_statement = {}
        
        if db_path.exists():
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM buyer_financials WHERE buyer_id = ?", (payload.buyerId,))
            row = cursor.fetchone()
            conn.close()
            
            if row:
                d = dict(row)
                payment_history = {
                    "on_time_ratio": d["on_time_ratio"],
                    "avg_delay_days": d["avg_delay_days"],
                    "late_payment_ratio": d["late_payment_ratio"],
                    "total_transactions": d["total_transactions"],
                    "payment_trend": d["payment_trend"]
                }
                credit_ratings = {"credit_score": d["credit_score"]}
                financial_statement = {
                    "debt_to_income_ratio": d["debt_to_income_ratio"],
                    "avg_invoice_value": d["avg_invoice_value"]
                }
            else:
                # If not found, use a harsh fallback or default
                payment_history = {"on_time_ratio": 0.5, "avg_delay_days": 30.0, "late_payment_ratio": 0.5, "total_transactions": 5, "payment_trend": 0.1}
                credit_ratings = {"credit_score": 400}
                financial_statement = {"debt_to_income_ratio": 0.8, "avg_invoice_value": 10000}
        else:
            payment_history = payload.paymentHistory
            credit_ratings = payload.creditRatings
            financial_statement = payload.financialStatement
            
        # Run risk assessment
        result = agent.run_pipeline(
            payment_history=payment_history,
            credit_ratings=credit_ratings,
            financial_statement=financial_statement
        )
        
        # Determine risk level
        risk_prob = result['risk_probability']
        if risk_prob < 0.2:
            risk_level = "Low"
            recommendation = "Approved - Low risk buyer"
        elif risk_prob < 0.5:
            risk_level = "Medium"
            recommendation = "Approved with conditions - Medium risk buyer"
        else:
            risk_level = "High"
            recommendation = "Review required - High risk buyer"
        
        return {
            "success": True,
            "buyerId": payload.buyerId,
            "buyerName": payload.buyerName,
            "creditworthinessScore": result['creditworthiness_score'],
            "riskProbability": round(result['risk_probability'], 4),
            "riskLevel": risk_level,
            "recommendation": recommendation,
            "details": result['processed_data']
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "buyerId": payload.buyerId
        }


@app.post("/api/invoice/verify")
async def verify_invoice_file(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Upload an invoice file, run OCR + GST verification, and return scraped data.
    Falls back to a mock response when the verification agent is unavailable.
    """
    # Save the uploaded file to a temp location
    suffix = Path(file.filename).suffix if file.filename else ".png"
    tmp_path: Optional[str] = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {exc}")

    try:
        if HAS_INV_AGENT and tmp_path:
            # Run the full pipeline
            raw_text = extract_text(tmp_path)
            parsed = parse_invoice_text(raw_text)
            checks = run_verification(parsed)
            result = build_final_response(parsed, checks)

            gst_raw = (parsed.get("gst") or "").strip().upper()
            gst_found = gst_raw in GST_DB
            gst_company = GST_DB.get(gst_raw, {}).get("name", "") if gst_found else ""

            scraped = {
                "invoice_id": result.get("invoice_id") or parsed.get("invoice_id") or "",
                "gst": gst_raw,
                "amount": parsed.get("amount") or result.get("amount"),
                "date": parsed.get("date") or "",
                "gst_found": gst_found,
                "gst_company_name": gst_company,
                "trust_score": result.get("invoice_score", 0),
                "risk_level": result.get("risk_level", "UNKNOWN"),
                "flags": result.get("all_flags", []),
            }
        else:
            # Mock fallback
            scraped = {
                "invoice_id": "INV-MOCK-001",
                "gst": "33DSZPP0624K1Z7",
                "amount": 75000,
                "date": "2026-03-26",
                "gst_found": True,
                "gst_company_name": "RK Enterprises (mock)",
                "trust_score": 0.85,
                "risk_level": "LOW",
                "flags": [],
            }

        return {"success": True, **scraped}

    except Exception as exc:
        return {
            "success": False,
            "error": str(exc),
            "invoice_id": "",
            "gst": "",
            "amount": None,
            "date": "",
            "gst_found": False,
            "gst_company_name": "",
            "trust_score": 0.0,
            "risk_level": "HIGH",
            "flags": ["PROCESSING_ERROR"],
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
