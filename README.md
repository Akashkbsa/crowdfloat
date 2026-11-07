# CrowdFloat

Invoice-financing / crowdfunded working-capital platform for MSMEs.

Problem: MSMEs raise invoices against buyers on 60–90 day terms and cannot
wait for payment to run their operations. CrowdFloat lets the public fund
those verified invoices and get their principal + a fixed yield back when
the buyer pays.

Built for the SA Engineering College hackathon.

## Stack

- **Frontend:** React 19 + Vite 8 (`crowdfloat-react/`)
- **Backend:** FastAPI + SQLite (`backend/`)
- **Invoice Verification Agent:** OCR (pytesseract) + GST + scoring
  (`Invoice_verification_agent_1/Invoice_verification_agent/`)
- **Buyer Credit Risk Agent:** LightGBM + scikit-learn (`SA-Hackathon/`)
- **Settlement Agent:** fund allocation and payout (`backend/settlement_service.py`)

## Quick start (Windows)

Double-click `start-fullstack.bat`. It will:

1. Install backend Python deps.
2. Seed `crowdfloat.db` and `buyer_financials.db` if missing.
3. Install frontend deps if `node_modules` is missing.
4. Start FastAPI on `http://localhost:8001` and Vite on `http://localhost:5173`.

## Direct URL routes

| URL | Opens |
|---|---|
| `/` | Landing page |
| `/company` | Company (MSME) dashboard |
| `/company-login` | Company login |
| `/company-onboarding` | Company onboarding / KYC |
| `/funder` | Funder dashboard |
| `/funder-login` | Funder login |
| `/funder-kyc` | Funder KYC |
| `/buyer` | Buyer dashboard |
| `/confirm-invoice?invoice_id=...&token=...&action=approve` | Email approval target |

## End-to-end flow

1. MSME uploads an invoice → **Invoice Verification Agent** does OCR,
   validates GST, checks duplicates and anomalies, returns a trust score.
2. Platform emails the buyer an Approve / Reject link.
3. Buyer approves → invoice becomes `confirmed-financing-eligible`.
4. **Buyer Credit Agent** scores the buyer from `buyer_financials.db` so
   funders can see risk.
5. Public funders invest partial amounts into the invoice.
6. When the buyer pays, the **Settlement Agent** pays each funder
   `principal × 1.03` (3% yield), remainder to MSME, invoice `SETTLED`.

## Optional live setup

- **Real emails:** set `SMTP_PASSWORD` (Gmail App Password) env var
  before launch. Without it, emails print to the backend console.
- **Real OCR:** install Tesseract OCR + Poppler (for PDFs). Without
  them, `/api/invoice/verify` falls back to a mock response.
- **Demo buyer inbox:** set `DEMO_BUYER_EMAIL` env var to route all
  approval mails to one inbox for demos.

## Project layout

```
SAEC/
├── backend/                         FastAPI + SQLite + mailer + settlement
├── crowdfloat-react/                React 19 + Vite frontend
├── Invoice_verification_agent_1/    OCR + GST + scoring agent
├── SA-Hackathon/                    LightGBM buyer credit risk agent
└── start-fullstack.bat              one-click starter
```
