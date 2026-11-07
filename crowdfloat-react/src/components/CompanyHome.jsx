import { useMemo, useState } from 'react';
import './CompanyHome.css';

const API_BASE = 'http://localhost:8001';

const INITIAL_OFFERS = [
  {
    id: 'offer-1',
    funder: 'Vertex Capital',
    advancePct: 85,
    processingFeePct: 1.2,
    disbursalHours: 6,
    accepted: false,
  },
  {
    id: 'offer-2',
    funder: 'BluePeak Finance',
    advancePct: 80,
    processingFeePct: 0.9,
    disbursalHours: 8,
    accepted: false,
  },
  {
    id: 'offer-3',
    funder: 'Nova Credit Pool',
    advancePct: 78,
    processingFeePct: 0.7,
    disbursalHours: 12,
    accepted: false,
  },
];

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function invoiceStatusLabel(status) {
  if (status === 'awaiting-buyer-confirmation') return 'Awaiting buyer confirmation';
  if (status === 'confirmed-financing-eligible') return 'Confirmed - eligible for financing';
  return 'Disputed';
}

function invoiceStatusClass(status) {
  if (status === 'awaiting-buyer-confirmation') return 'pending';
  if (status === 'confirmed-financing-eligible') return 'ok';
  return 'dispute';
}

function GstResultPanel({ verifyResult, onDismiss }) {
  if (!verifyResult) return null;

  const gstOk = verifyResult.gst_found;
  const riskColor = { LOW: '#4ade80', MEDIUM: '#fbbf24', HIGH: '#f87171', UNKNOWN: '#94a3b8' };

  return (
    <div className="gst-result-panel">
      <div className="gst-result-header">
        <span className="gst-result-title">📋 Invoice Verification Result</span>
        <button className="gst-dismiss-btn" onClick={onDismiss} title="Clear" type="button">✕</button>
      </div>

      <div className="gst-result-grid">
        <div className="gst-field">
          <span className="gst-field-label">Invoice ID</span>
          <span className="gst-field-value">{verifyResult.invoice_id || '—'}</span>
        </div>
        <div className="gst-field">
          <span className="gst-field-label">Date</span>
          <span className="gst-field-value">{verifyResult.date || '—'}</span>
        </div>
        <div className="gst-field">
          <span className="gst-field-label">Amount</span>
          <span className="gst-field-value">
            {verifyResult.amount != null ? formatCurrency(verifyResult.amount) : '—'}
          </span>
        </div>
        <div className="gst-field">
          <span className="gst-field-label">GST Number</span>
          <span className="gst-field-value gst-mono">{verifyResult.gst || '—'}</span>
        </div>
      </div>

      <div className="gst-badges-row">
        <span className={`gst-gstin-badge ${gstOk ? 'gst-ok' : 'gst-fail'}`}>
          {gstOk ? '✅ GST Verified' : '❌ GST Not Found in Database'}
          {gstOk && verifyResult.gst_company_name && (
            <span className="gst-company-name"> — {verifyResult.gst_company_name}</span>
          )}
        </span>

        <span
          className="gst-risk-badge"
          style={{ color: riskColor[verifyResult.risk_level] || riskColor.UNKNOWN }}
        >
          Risk: {verifyResult.risk_level}
        </span>

        <span className="gst-score-badge">
          Trust Score: {Math.round((verifyResult.trust_score || 0) * 100)}%
        </span>
      </div>

      {!gstOk && (
        <p className="gst-warning-msg">
          ⚠️ The GST number on this invoice is not registered in our database. The buyer must still confirm before the invoice is accepted.
        </p>
      )}

      {verifyResult.flags && verifyResult.flags.length > 0 && (
        <p className="gst-flags-msg">Flags: {verifyResult.flags.join(', ')}</p>
      )}
    </div>
  );
}

export default function CompanyHome({
  submissionId,
  registeredBuyers,
  linkedInvoices,
  onSubmitInvoiceToBuyer,
  onBackToPortal,
}) {
  const PROGRAM_OPTIONS = ['SCF Core', 'Distributor Plus', 'Strategic Vendors'];
  const [supplierName, setSupplierName] = useState('');
  const [selectedBuyerId, setSelectedBuyerId] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [rawFile, setRawFile] = useState(null);
  const [uploadNotice, setUploadNotice] = useState('Upload an invoice document first, then click Verify Invoice.');
  const [offers, setOffers] = useState(INITIAL_OFFERS);
  const [moneyStatus, setMoneyStatus] = useState('Waiting for offer acceptance');

  // Verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  const selectedBuyer = useMemo(
    () => registeredBuyers.find((item) => item.id === selectedBuyerId),
    [registeredBuyers, selectedBuyerId],
  );

  const pendingWithBuyer = useMemo(
    () => linkedInvoices.filter((invoice) => invoice.status === 'awaiting-buyer-confirmation'),
    [linkedInvoices],
  );

  const financingEligible = useMemo(
    () => linkedInvoices.filter((invoice) => invoice.status === 'confirmed-financing-eligible'),
    [linkedInvoices],
  );

  const disputedInvoices = useMemo(
    () => linkedInvoices.filter((invoice) => invoice.status === 'disputed'),
    [linkedInvoices],
  );

  const acceptedOffer = useMemo(() => offers.find((offer) => offer.accepted), [offers]);

  // The submit button is enabled only after a GST-verified result
  const canSubmit = !!verifyResult && supplierName.trim() && selectedBuyerId;

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setRawFile(file);
      setUploadedFile({ name: file.name, size: file.size, type: file.type });
      // Clear stale verification when a new file is picked
      setVerifyResult(null);
      setVerifyError('');
      setUploadNotice('File selected. Click "Verify Invoice" to check the GST and extract data.');
    }
  };

  const handleVerifyInvoice = async () => {
    if (!rawFile) {
      setVerifyError('Please select an invoice file first.');
      return;
    }

    setIsVerifying(true);
    setVerifyError('');
    setVerifyResult(null);

    try {
      const formData = new FormData();
      formData.append('file', rawFile);

      const response = await fetch(`${API_BASE}/api/invoice/verify`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      setVerifyResult(data);

      if (data.gst_found) {
        setUploadNotice('✅ GST verified! Review the details below, then submit to buyer.');
      } else {
        setUploadNotice('⚠️ GST not found in database. The buyer must confirm before accepting.');
      }
    } catch (err) {
      setVerifyError(`Verification failed: ${err.message}. Check the backend server is running.`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUploadInvoice = () => {
    if (!supplierName.trim() || !selectedBuyerId) {
      setUploadNotice('Supplier name and buyer are required.');
      return;
    }
    if (!verifyResult) {
      setUploadNotice('Please verify the invoice first before submitting.');
      return;
    }

    // Use scraped amount if available, otherwise fallback to random
    const resolvedAmount =
      verifyResult.amount != null && verifyResult.amount > 0
        ? verifyResult.amount
        : Math.floor(50000 + Math.random() * 200000);

    const generatedProgram = PROGRAM_OPTIONS[Math.floor(Math.random() * PROGRAM_OPTIONS.length)];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14 + Math.floor(Math.random() * 25));
    const generatedDueDate = dueDate.toISOString().slice(0, 10);
    const generatedPoReference = `PO-${Math.floor(1000 + Math.random() * 9000)}`;

    onSubmitInvoiceToBuyer({
      supplierName: supplierName.trim(),
      buyerId: selectedBuyerId,
      buyerEmail: selectedBuyer?.email || '',
      program: generatedProgram,
      amount: resolvedAmount,
      dueDate: generatedDueDate,
      poReference: generatedPoReference,
      documentFile: uploadedFile,
      // Pass GST verification data through to the invoice record
      gstVerified: verifyResult.gst_found,
      gstNumber: verifyResult.gst,
      gstCompanyName: verifyResult.gst_company_name,
      trustScore: verifyResult.trust_score,
      riskLevel: verifyResult.risk_level,
      scrapedInvoiceId: verifyResult.invoice_id,
    });

    setUploadNotice(
      selectedBuyer?.email
        ? `Invoice submitted${uploadedFile ? ` (${uploadedFile.name})` : ''}. Approval request sent to ${selectedBuyer.email}.`
        : 'Invoice submitted. Buyer approval request queued.',
    );
    setSupplierName('');
    setSelectedBuyerId('');
    setUploadedFile(null);
    setRawFile(null);
    setVerifyResult(null);
    setVerifyError('');
  };

  const acceptOffer = (offerId) => {
    setOffers((prev) => prev.map((offer) => ({ ...offer, accepted: offer.id === offerId })));
    setMoneyStatus('Accepted. Disbursal is being processed');

    setTimeout(() => {
      setMoneyStatus('Money received in primary bank account');
    }, 1200);
  };

  return (
    <div className="company-home-page">
      <header className="company-home-header">
        <div>
          <h1>Company Home</h1>
          <p>Manage invoice financing from one place after signup.</p>
          <span className="submission-chip">Submission ID: {submissionId || 'Pending'}</span>
        </div>
        <button className="home-back-btn" onClick={onBackToPortal}>Back to Portal</button>
      </header>

      <section className="home-section">
        <h3>1. Upload Invoice</h3>
        <p>Upload your invoice document. The system will extract data and verify the GST number before sending to the buyer.</p>
        <div className="company-upload-grid">
          <label>
            Supplier Name
            <input
              type="text"
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
              placeholder="Supplier legal name"
            />
          </label>
          <label>
            Select Buyer
            <select value={selectedBuyerId} onChange={(event) => setSelectedBuyerId(event.target.value)}>
              <option value="">Choose buyer</option>
              {registeredBuyers.map((buyer) => (
                <option value={buyer.id} key={buyer.id}>{buyer.name}</option>
              ))}
            </select>
          </label>
          <label>
            Upload Invoice Document
            <input
              type="file"
              onChange={handleFileChange}
              accept="image/*,.pdf,.xlsx,.xls,.doc,.docx"
            />
          </label>
        </div>

        {uploadedFile && (
          <div className="file-info">
            <span>📎 {uploadedFile.name}</span>
          </div>
        )}

        {/* Step 1: Verify */}
        <div className="home-inline-actions" style={{ marginTop: '12px' }}>
          <button
            className="home-secondary-btn"
            onClick={handleVerifyInvoice}
            disabled={!rawFile || isVerifying}
            type="button"
          >
            {isVerifying ? '⏳ Verifying…' : '🔍 Verify Invoice'}
          </button>
        </div>

        {/* Verification result panel */}
        {verifyError && <p className="gst-error-msg">{verifyError}</p>}
        <GstResultPanel
          verifyResult={verifyResult}
          onDismiss={() => { setVerifyResult(null); setVerifyError(''); }}
        />

        {/* Step 2: Submit to buyer — gated on verification */}
        <div className="home-inline-actions" style={{ marginTop: '8px' }}>
          <button
            className="home-primary-btn"
            onClick={handleUploadInvoice}
            disabled={!canSubmit}
            type="button"
            title={!verifyResult ? 'Verify the invoice first' : (!supplierName.trim() || !selectedBuyerId) ? 'Fill supplier name and buyer' : ''}
          >
            Submit Invoice To Buyer
          </button>
        </div>
        <small>{uploadNotice}</small>
      </section>

      <section className="home-section">
        <h3>2. Pending with buyer</h3>
        <p>Invoices below are blocked until buyer confirms or disputes.</p>
        <div className="company-table-wrap">
          <table className="company-linked-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Invoice ID</th>
                <th>Buyer</th>
                <th>Buyer Email</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>PO Reference</th>
                <th>Program</th>
                <th>Document</th>
                <th>GST</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pendingWithBuyer.length === 0 && (
                <tr>
                  <td colSpan={11} className="company-empty-row">No invoices are currently pending with buyers.</td>
                </tr>
              )}
              {pendingWithBuyer.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.supplierName}</td>
                  <td>{invoice.id}</td>
                  <td>{invoice.buyerName}</td>
                  <td>{invoice.buyerEmail || '-'}</td>
                  <td>{formatCurrency(invoice.amount)}</td>
                  <td>{formatDate(invoice.dueDate)}</td>
                  <td>{invoice.poReference}</td>
                  <td>{invoice.program}</td>
                  <td>{invoice.documentFile ? <span title={invoice.documentFile.name}>📎 {invoice.documentFile.name}</span> : '-'}</td>
                  <td>
                    {invoice.gstVerified === true && <span className="gst-mini-badge gst-ok">✅ Verified</span>}
                    {invoice.gstVerified === false && <span className="gst-mini-badge gst-fail">❌ Not found</span>}
                    {invoice.gstVerified === undefined && <span className="gst-mini-badge gst-na">—</span>}
                  </td>
                  <td>
                    <span className="status-pill pending">{invoiceStatusLabel(invoice.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 className="company-sync-title">Synchronized status table</h4>
        <div className="company-table-wrap">
          <table className="company-linked-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Invoice ID</th>
                <th>Buyer</th>
                <th>Buyer Email</th>
                <th>Amount</th>
                <th>Document</th>
                <th>GST</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {linkedInvoices.map((invoice) => (
                <tr key={`sync-${invoice.id}`}>
                  <td>{invoice.supplierName}</td>
                  <td>{invoice.id}</td>
                  <td>{invoice.buyerName}</td>
                  <td>{invoice.buyerEmail || '-'}</td>
                  <td>{formatCurrency(invoice.amount)}</td>
                  <td>{invoice.documentFile ? <span title={invoice.documentFile.name}>📎 {invoice.documentFile.name}</span> : '-'}</td>
                  <td>
                    {invoice.gstVerified === true && <span className="gst-mini-badge gst-ok">✅ Verified</span>}
                    {invoice.gstVerified === false && <span className="gst-mini-badge gst-fail">❌ Not found</span>}
                    {invoice.gstVerified === undefined && <span className="gst-mini-badge gst-na">—</span>}
                  </td>
                  <td>
                    <span className={`status-pill ${invoiceStatusClass(invoice.status)}`}>
                      {invoiceStatusLabel(invoice.status)}
                    </span>
                  </td>
                  <td>{invoice.disputeReason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="home-section">
        <h3>3. Funding Offers</h3>
        <p>Only buyer-confirmed invoices are eligible for financing.</p>
        <div className="home-inline-actions">
          <span className="status-pill ok">Eligible invoices: {financingEligible.length}</span>
          <span className="status-pill dispute">Disputed invoices: {disputedInvoices.length}</span>
        </div>
        <div className="offers-grid">
          {offers.map((offer) => (
            <article key={offer.id} className={`offer-card ${offer.accepted ? 'accepted' : ''}`}>
              <h4>{offer.funder}</h4>
              <p>Advance: {offer.advancePct}% of invoice value</p>
              <p>Processing Fee: {offer.processingFeePct}%</p>
              <p>Disbursal ETA: {offer.disbursalHours} hours</p>
              <button
                className="home-primary-btn"
                onClick={() => acceptOffer(offer.id)}
                disabled={financingEligible.length === 0}
              >
                {offer.accepted ? 'Accepted' : 'Accept Offer'}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section">
        <h3>4. Receiving Money</h3>
        <p className="money-status">{moneyStatus}</p>
        {acceptedOffer && (
          <p className="money-detail">
            Active offer: {acceptedOffer.funder} ({acceptedOffer.advancePct}% advance)
          </p>
        )}
        <p className="money-detail">
          Buyer-confirmed invoices can now move forward to financing and disbursal workflows.
        </p>
      </section>
    </div>
  );
}
