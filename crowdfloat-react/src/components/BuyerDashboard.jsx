import { useMemo, useState } from 'react';
import './BuyerDashboard.css';

const API_BASE = 'http://localhost:8001';

const NAV_ITEMS = ['Dashboard', 'Invoices', 'Financing', 'Payments', 'Credit Risk'];

const PROGRAM_TRACKING = [
  { name: 'SCF Core', progress: 78, financedCount: 16, upcoming: 4, trend: [5, 9, 12, 10, 13, 16] },
  { name: 'Distributor Plus', progress: 61, financedCount: 9, upcoming: 3, trend: [2, 5, 8, 6, 7, 9] },
  { name: 'Strategic Vendors', progress: 42, financedCount: 5, upcoming: 2, trend: [1, 2, 3, 2, 4, 5] },
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

function statusLabel(status) {
  if (status === 'awaiting-buyer-confirmation') return 'Pending confirmation';
  if (status === 'confirmed-financing-eligible') return 'Confirmed - eligible for financing';
  return 'Disputed';
}

function Sparkline({ points }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = Math.max(max - min, 1);
  const stepX = 100 / Math.max(points.length - 1, 1);
  const coords = points
    .map((point, index) => {
      const x = index * stepX;
      const y = 100 - ((point - min) / span) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={coords} />
    </svg>
  );
}

function ProgramProgress({ item }) {
  return (
    <div className="buyer-program-card">
      <div className="buyer-program-head">
        <h4>{item.name}</h4>
        <span>{item.progress}% funded</span>
      </div>
      <div className="buyer-program-meta">
        <span>{item.financedCount} financed</span>
        <span>{item.upcoming} upcoming payables</span>
      </div>
      <div className="buyer-progress-track" role="progressbar" aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="buyer-progress-fill" style={{ width: `${item.progress}%` }} />
      </div>
      <div className="buyer-sparkline">
        <Sparkline points={item.trend} />
      </div>
    </div>
  );
}

export default function BuyerDashboard({
  registeredBuyers,
  selectedBuyerUserId,
  onSelectBuyerUser,
  linkedInvoices,
  onConfirmInvoice,
  onDisputeInvoice,
  onBackToPortal,
}) {
  const [selectedNav, setSelectedNav] = useState('Dashboard');
  const [filterDate, setFilterDate] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [filterProgram, setFilterProgram] = useState('all');
  const [payingInvoices, setPayingInvoices] = useState([]);
  const [confirmDialogInvoiceId, setConfirmDialogInvoiceId] = useState('');
  const [disputeTargetInvoiceId, setDisputeTargetInvoiceId] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeError, setDisputeError] = useState('');

  // ── Buyer Risk Assessment state ──────────────────────────────────────────

  const [riskLoading, setRiskLoading] = useState(false);
  const [riskResult, setRiskResult] = useState(null);
  const [riskError, setRiskError] = useState('');

  const buyerInvoices = useMemo(
    () => linkedInvoices.filter((invoice) => invoice.buyerId === selectedBuyerUserId),
    [linkedInvoices, selectedBuyerUserId],
  );

  const suppliers = useMemo(
    () => Array.from(new Set(buyerInvoices.map((invoice) => invoice.supplierName))),
    [buyerInvoices],
  );

  const programs = ['SCF Core', 'Distributor Plus', 'Strategic Vendors'];

  const stats = useMemo(() => {
    const confirmed = buyerInvoices.filter((invoice) => invoice.status === 'confirmed-financing-eligible');
    const disputed = buyerInvoices.filter((invoice) => invoice.status === 'disputed');
    const pending = buyerInvoices.filter((invoice) => invoice.status === 'awaiting-buyer-confirmation');
    const totalFinanced = confirmed.reduce((sum, invoice) => sum + invoice.amount, 0);
    const upcomingPayables = confirmed
      .filter((invoice) => new Date(invoice.dueDate).getTime() >= Date.now())
      .reduce((sum, invoice) => sum + invoice.amount, 0);

    return {
      confirmedCount: confirmed.length,
      pendingCount: pending.length,
      disputedCount: disputed.length,
      totalFinanced,
      upcomingPayables,
    };
  }, [buyerInvoices]);

  const toConfirm = useMemo(
    () => buyerInvoices.filter((invoice) => invoice.status === 'awaiting-buyer-confirmation'),
    [buyerInvoices],
  );

  const dueForPayment = useMemo(() => {
    return buyerInvoices
      .filter((invoice) => invoice.status === 'confirmed-financing-eligible')
      .filter((invoice) => (filterDate ? invoice.dueDate <= filterDate : true))
      .filter((invoice) => (filterSupplier === 'all' ? true : invoice.supplierName === filterSupplier))
      .filter((invoice) => (filterProgram === 'all' ? true : (invoice.program || 'SCF Core') === filterProgram))
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }, [buyerInvoices, filterDate, filterSupplier, filterProgram]);

  const selectedBuyerLabel = useMemo(
    () => registeredBuyers.find((buyer) => buyer.id === selectedBuyerUserId)?.name || 'Buyer',
    [registeredBuyers, selectedBuyerUserId],
  );

  const confirmFromDialog = () => {
    onConfirmInvoice(confirmDialogInvoiceId);
    setConfirmDialogInvoiceId('');
  };

  const submitDispute = () => {
    if (!disputeReason.trim()) {
      setDisputeError('Dispute reason is required before submitting.');
      return;
    }

    onDisputeInvoice(disputeTargetInvoiceId, disputeReason.trim());
    setDisputeTargetInvoiceId('');
    setDisputeReason('');
    setDisputeError('');
  };

  const onPayNow = (invoiceId) => {
    setPayingInvoices((current) => [...current, invoiceId]);
    setTimeout(() => {
      setPayingInvoices((current) => current.filter((id) => id !== invoiceId));
      setInvoices((current) =>
        current.map((invoice) =>
          invoice.id === invoiceId ? { ...invoice, status: 'paid', justUpdated: 'paid' } : invoice,
        ),
      );
    }, 900);
  };

  // ── Risk Assessment API call ──────────────────────────────────────────────
  const handleRunRiskAssessment = async () => {
    setRiskLoading(true);
    setRiskError('');
    setRiskResult(null);
    try {
      const resp = await fetch(`${API_BASE}/api/buyer/risk-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerId: selectedBuyerUserId,
          buyerName: selectedBuyerLabel,
        }),
      });
      if (!resp.ok) throw new Error(`Server error ${resp.status}`);
      const data = await resp.json();
      setRiskResult(data);
    } catch (err) {
      setRiskError(`Assessment failed: ${err.message}. Ensure the backend is running at ${API_BASE}.`);
    } finally {
      setRiskLoading(false);
    }
  };

  return (
    <div className="buyer-dashboard-page">
      <aside className="buyer-sidebar">
        <div className="buyer-brand">
          <div className="buyer-brand-mark">CF</div>
          <div>
            <h2>CrowdFloat</h2>
            <p>Buyer Console</p>
          </div>
        </div>

        <nav className="buyer-nav" aria-label="Buyer dashboard navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              className={`buyer-nav-item ${selectedNav === item ? 'active' : ''}`}
              onClick={() => setSelectedNav(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>

        <button className="buyer-back-btn" onClick={onBackToPortal} type="button">
          Back to role selector
        </button>
      </aside>

      <main className="buyer-main">
        <header className="buyer-main-header">
          <div>
            <h1>Buyer Dashboard</h1>
            <p>Manage confirmations, financing progress, and scheduled payments across your supplier network.</p>
          </div>
          <div className="buyer-identity-row">
            <label>
              Active buyer profile
              <select value={selectedBuyerUserId} onChange={(event) => onSelectBuyerUser(event.target.value)}>
                {registeredBuyers.map((buyer) => (
                  <option value={buyer.id} key={buyer.id}>{buyer.name}</option>
                ))}
              </select>
            </label>
            <span className="buyer-live-chip">Live sync with Company dashboard</span>
          </div>
          <div className="buyer-kpi-grid">
            <article className="buyer-kpi-card">
              <span>Confirmed invoices</span>
              <strong>{stats.confirmedCount}</strong>
            </article>
            <article className="buyer-kpi-card">
              <span>Total financed</span>
              <strong>{formatCurrency(stats.totalFinanced)}</strong>
            </article>
            <article className="buyer-kpi-card">
              <span>Upcoming payables</span>
              <strong>{formatCurrency(stats.upcomingPayables)}</strong>
            </article>
            <article className="buyer-kpi-card warn">
              <span>Pending or disputed</span>
              <strong>{stats.pendingCount + stats.disputedCount}</strong>
            </article>
          </div>
        </header>

        <section className="buyer-section">
          <div className="buyer-section-title-row">
            <h3>Invoices to confirm</h3>
            <span>{toConfirm.length} pending for {selectedBuyerLabel}</span>
          </div>
          <div className="buyer-table-wrap">
            <table className="buyer-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Invoice ID</th>
                  <th>PO Reference</th>
                  <th>Due date</th>
                  <th>Amount</th>
                  <th>GST Verified</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {buyerInvoices.length === 0 && (
                  <tr>
                    <td className="buyer-empty-row" colSpan={7}>No invoices assigned to this buyer profile.</td>
                  </tr>
                )}
                {buyerInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.supplierName}</td>
                    <td>{invoice.id}</td>
                    <td>{invoice.poReference}</td>
                    <td>{formatDate(invoice.dueDate)}</td>
                    <td>{formatCurrency(invoice.amount)}</td>
                    <td>
                      {invoice.gstVerified === true && (
                        <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '999px', background: '#dcfce7', color: '#166534' }}>✅ Verified</span>
                      )}
                      {invoice.gstVerified === false && (
                        <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '999px', background: '#fee2e2', color: '#b91c1c' }}>❌ Not found</span>
                      )}
                      {invoice.gstVerified === undefined && <span style={{ color: '#9ca3af', fontSize: '12px' }}>—</span>}
                      {invoice.gstCompanyName && (
                        <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '2px' }}>{invoice.gstCompanyName}</div>
                      )}
                    </td>
                    <td>
                      <span className={`status-tag ${invoice.status}`}>
                        {statusLabel(invoice.status)}
                      </span>
                    </td>
                    <td>
                      {invoice.status === 'awaiting-buyer-confirmation' && (
                        <div className="invoice-actions">
                          <button type="button" className="btn-confirm" onClick={() => setConfirmDialogInvoiceId(invoice.id)}>
                            Confirm invoice
                          </button>
                          <button
                            type="button"
                            className="btn-issue"
                            onClick={() => {
                              setDisputeTargetInvoiceId(invoice.id);
                              setDisputeReason('');
                              setDisputeError('');
                            }}
                          >
                            Dispute
                          </button>
                        </div>
                      )}
                      {invoice.status === 'confirmed-financing-eligible' && (
                        <span className="action-done">Confirmed <span className="checkmark" aria-hidden="true">✓</span></span>
                      )}
                      {invoice.status === 'disputed' && (
                        <span className="action-problem">Disputed: {invoice.disputeReason}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="buyer-section split">
          <div>
            <div className="buyer-section-title-row">
              <h3>Track financing</h3>
              <span>{PROGRAM_TRACKING.length} programs</span>
            </div>
            <div className="buyer-program-grid">
              {PROGRAM_TRACKING.map((item) => (
                <ProgramProgress item={item} key={item.name} />
              ))}
            </div>
          </div>
          <div className="buyer-summary-card">
            <h4>Financing snapshot</h4>
            <div className="mini-metrics">
              <div>
                <span>Financed invoices</span>
                <strong>{stats.confirmedCount}</strong>
              </div>
              <div>
                <span>Average ticket size</span>
                <strong>{stats.confirmedCount > 0 ? formatCurrency(Math.round(stats.totalFinanced / stats.confirmedCount)) : formatCurrency(0)}</strong>
              </div>
              <div>
                <span>Disputes open</span>
                <strong>{stats.disputedCount}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="buyer-section">
          <div className="buyer-section-title-row">
            <h3>Make payments</h3>
            <span>Invoices approaching due date</span>
          </div>

          <div className="payment-filters">
            <label>
              By date
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            </label>
            <label>
              By supplier
              <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)}>
                <option value="all">All suppliers</option>
                {suppliers.map((supplier) => (
                  <option key={supplier} value={supplier}>{supplier}</option>
                ))}
              </select>
            </label>
            <label>
              Financing program
              <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)}>
                <option value="all">All programs</option>
                {programs.map((program) => (
                  <option key={program} value={program}>{program}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="payment-list">
            {dueForPayment.length === 0 && <p className="empty-payments">No invoices match your payment filters.</p>}
            {dueForPayment.map((invoice) => (
              <article className={`payment-item ${payingInvoices.includes(invoice.id) ? 'is-paying' : ''}`} key={invoice.id}>
                <div>
                  <h4>{invoice.supplierName}</h4>
                  <p>{invoice.id} · Due {formatDate(invoice.dueDate)} · {invoice.program || 'SCF Core'} · {invoice.poReference}</p>
                </div>
                <strong>{formatCurrency(invoice.amount)}</strong>
                <div className="payment-actions">
                  <button
                    type="button"
                    className="pay-btn"
                    onClick={() => onPayNow(invoice.id)}
                    disabled={payingInvoices.includes(invoice.id)}
                  >
                    {payingInvoices.includes(invoice.id) ? 'Processing...' : 'Pay now'}
                  </button>
                  <button type="button" className="schedule-btn">Schedule payment</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── Credit Risk Assessment section ──────────────────────────────── */}
        {selectedNav === 'Credit Risk' && (
          <section className="buyer-section risk-section">
            <div className="buyer-section-title-row">
              <h3>🧠 Buyer Credit Risk Assessment</h3>
              <span>Powered by LightGBM · Score: 0–1000</span>
            </div>
            <p className="risk-subtitle">
              Fetch the automated CIBIL-style creditworthiness score for <strong>{selectedBuyerLabel}</strong> based on historical transactions, ratings, and financial records.
            </p>

            <button
              type="button"
              className="risk-run-btn"
              onClick={handleRunRiskAssessment}
              disabled={riskLoading}
            >
              {riskLoading ? '⏳ Fetching Data & Running Model…' : '🔍 Check Buyer Credit Score'}
            </button>

            {riskError && <p className="risk-error">{riskError}</p>}

            {riskResult && (
              <div className="risk-result-card">
                <div className="risk-result-top">
                  {/* Score Gauge */}
                  <div className="risk-gauge-wrap">
                    <svg viewBox="0 0 200 120" className="risk-gauge-svg">
                      {/* Background arc */}
                      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e5e7eb" strokeWidth="18" strokeLinecap="round" />
                      {/* Filled arc proportional to score */}
                      <path
                        d={`M 20 100 A 80 80 0 0 1 ${20 + 160 * Math.min(riskResult.creditworthinessScore / 1000, 1)} ${100 - Math.sin(Math.PI * Math.min(riskResult.creditworthinessScore / 1000, 1)) * 80}`}
                        fill="none"
                        stroke={
                          riskResult.riskLevel === 'Low' ? '#22c55e'
                          : riskResult.riskLevel === 'Medium' ? '#f59e0b'
                          : '#ef4444'
                        }
                        strokeWidth="18"
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1s ease' }}
                      />
                      <text x="100" y="90" textAnchor="middle" className="gauge-score-text">
                        {Math.round(riskResult.creditworthinessScore)}
                      </text>
                      <text x="100" y="108" textAnchor="middle" className="gauge-label-text">out of 1000</text>
                    </svg>
                    <div
                      className="risk-level-badge"
                      data-level={riskResult.riskLevel?.toLowerCase()}
                    >
                      {riskResult.riskLevel === 'Low' && '🟢'}
                      {riskResult.riskLevel === 'Medium' && '🟡'}
                      {riskResult.riskLevel === 'High' && '🔴'}
                      {' '}{riskResult.riskLevel} Risk
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="risk-metrics">
                    <div className="risk-metric">
                      <span className="risk-metric-label">Creditworthiness Score</span>
                      <span className="risk-metric-value score">{Math.round(riskResult.creditworthinessScore)} / 1000</span>
                    </div>
                    <div className="risk-metric">
                      <span className="risk-metric-label">Risk Probability</span>
                      <span className="risk-metric-value">{(riskResult.riskProbability * 100).toFixed(1)}%</span>
                    </div>
                    <div className="risk-metric">
                      <span className="risk-metric-label">Buyer</span>
                      <span className="risk-metric-value">{riskResult.buyerName}</span>
                    </div>
                    <div className="risk-recommendation">
                      <strong>Recommendation</strong>
                      <p>{riskResult.recommendation}</p>
                    </div>
                  </div>
                </div>

                {/* Feature table */}
                {riskResult.details && typeof riskResult.details === 'object' && !Array.isArray(riskResult.details) && (
                  <div className="risk-features">
                    <h5>Model Input Features</h5>
                    <table className="risk-feature-table">
                      <thead><tr><th>Feature</th><th>Value</th></tr></thead>
                      <tbody>
                        {Object.entries(riskResult.details).map(([k, v]) => (
                          <tr key={k}>
                            <td>{k.replace(/_/g, ' ')}</td>
                            <td>{typeof v === 'number' ? v.toFixed(4) : String(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {confirmDialogInvoiceId && (
          <div className="buyer-modal-backdrop" role="dialog" aria-modal="true">
            <div className="buyer-modal-card">
              <h4>Confirm this invoice?</h4>
              <p>This will update both dashboards to Confirmed - eligible for financing.</p>
              <div className="buyer-modal-actions">
                <button type="button" className="schedule-btn" onClick={() => setConfirmDialogInvoiceId('')}>Cancel</button>
                <button type="button" className="pay-btn" onClick={confirmFromDialog}>Confirm invoice</button>
              </div>
            </div>
          </div>
        )}

        {disputeTargetInvoiceId && (
          <div className="buyer-modal-backdrop" role="dialog" aria-modal="true">
            <div className="buyer-modal-card">
              <h4>Dispute invoice {disputeTargetInvoiceId}</h4>
              <p>Add a reason. This invoice will be marked as disputed for the Company.</p>
              <textarea
                value={disputeReason}
                onChange={(event) => setDisputeReason(event.target.value)}
                placeholder="Describe the mismatch or issue"
                rows={4}
              />
              {disputeError && <div className="buyer-dispute-error">{disputeError}</div>}
              <div className="buyer-modal-actions">
                <button
                  type="button"
                  className="schedule-btn"
                  onClick={() => {
                    setDisputeTargetInvoiceId('');
                    setDisputeReason('');
                    setDisputeError('');
                  }}
                >
                  Cancel
                </button>
                <button type="button" className="btn-issue" onClick={submitDispute}>Submit dispute</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
