import { useState, useMemo, useEffect } from 'react';
import { API_BASE_URL } from '../utils/api';

export default function FunderHome({ submissionId, onBackToPortal, linkedInvoices = [], registeredBuyers = [] }) {
  const [activeOffer, setActiveOffer] = useState('');
  const [selectedBuyerForRisk, setSelectedBuyerForRisk] = useState(null);
  const [riskAssessments, setRiskAssessments] = useState({});
  const [loadingRisk, setLoadingRisk] = useState(false);

  // Get available invoices (confirmed for financing)
  const availableInvoices = useMemo(() => {
    return linkedInvoices.filter((inv) => inv.status === 'confirmed-financing-eligible');
  }, [linkedInvoices]);

  // Calculate portfolio performance
  const portfolioMetrics = useMemo(() => {
    const totalValue = availableInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const invoiceCount = availableInvoices.length;
    const avgYield = invoiceCount > 0 ? 12.5 + Math.random() * 3 : 0; // 12.5% - 15.5%
    const totalReturn = (totalValue * avgYield) / 100;
    
    // Calculate weighted risk based on buyer creditworthiness
    let weightedRisk = 0;
    availableInvoices.forEach((inv) => {
      const buyerRisk = riskAssessments[inv.buyerId];
      if (buyerRisk?.success) {
        const riskScore = buyerRisk.riskProbability;
        weightedRisk += (inv.amount * riskScore) / totalValue;
      }
    });
    
    return {
      totalPortfolioValue: totalValue,
      invoiceCount,
      averageYield: avgYield,
      expectedReturn: totalReturn,
      weightedRiskScore: weightedRisk || 'N/A',
    };
  }, [availableInvoices, riskAssessments]);

  // Assign risk scores to invoices
  const invoicesWithRisk = useMemo(() => {
    return availableInvoices.map((inv) => {
      const buyerRisk = riskAssessments[inv.buyerId];
      return {
        ...inv,
        riskScore: buyerRisk?.success ? buyerRisk.creditworthinessScore : null,
        riskLevel: buyerRisk?.success ? buyerRisk.riskLevel : null,
      };
    });
  }, [availableInvoices, riskAssessments]);

  // Get unique buyers from linked invoices
  const buyersInPipeline = useMemo(() => {
    const uniqueBuyers = {};
    linkedInvoices.forEach((invoice) => {
      if (invoice.buyerId && !uniqueBuyers[invoice.buyerId]) {
        uniqueBuyers[invoice.buyerId] = {
          id: invoice.buyerId,
          name: invoice.buyerName,
          email: invoice.buyerEmail,
          invoiceCount: 0,
        };
      }
      if (invoice.buyerId) {
        uniqueBuyers[invoice.buyerId].invoiceCount += 1;
      }
    });
    return Object.values(uniqueBuyers);
  }, [linkedInvoices]);

  // Fetch risk assessment for a buyer
  const fetchBuyerRisk = async (buyerId, buyerName, isAutoFetch = false) => {
    if (riskAssessments[buyerId]) {
      if (!isAutoFetch) setSelectedBuyerForRisk(riskAssessments[buyerId]);
      return;
    }

    if (!isAutoFetch) setLoadingRisk(true);
    try {
      const response = await fetch(`${API_BASE_URL}/buyer/risk-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerId, buyerName }),
      });

      const result = await response.json();
      setRiskAssessments((prev) => ({ ...prev, [buyerId]: result }));
      if (!isAutoFetch) setSelectedBuyerForRisk(result);
    } catch (error) {
      console.error('Risk assessment error:', error);
      if (!isAutoFetch) {
        setSelectedBuyerForRisk({
          success: false,
          error: 'Failed to fetch risk assessment',
          buyerId,
        });
      }
    } finally {
      if (!isAutoFetch) setLoadingRisk(false);
    }
  };

  // Auto-fetch risk for all unique buyers on mount/update to populate portfolio stats
  useEffect(() => {
    buyersInPipeline.forEach((buyer) => {
      if (!riskAssessments[buyer.id]) {
        fetchBuyerRisk(buyer.id, buyer.name, true);
      }
    });
  }, [buyersInPipeline]);

  return (
    <div style={{ minHeight: '100vh', background: '#eef3ff', padding: '32px 20px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ color: '#1e3a8a', marginBottom: '6px' }}>Funder Home</h1>
            <p style={{ color: '#475569' }}>Review buyer risk & deploy capital</p>
          </div>
          <button onClick={onBackToPortal} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: '8px', padding: '10px 14px', cursor: 'pointer' }}>
            Back to Portal
          </button>
        </div>

        <div style={{ marginBottom: '14px', background: '#fff', border: '1px solid #dbe5ff', borderRadius: '12px', padding: '12px 14px', color: '#1e3a8a', fontWeight: 600 }}>
          Login / Submission ID: {submissionId || 'N/A'}
        </div>

        {/* Portfolio Performance Section */}
        <div style={{ marginBottom: '24px', background: '#fff', border: '1px solid #dbe5ff', borderRadius: '12px', padding: '16px' }}>
          <h3 style={{ color: '#1e3a8a', marginBottom: '12px' }}>📈 Portfolio Performance</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>AVAILABLE INVOICES</p>
              <p style={{ fontSize: '20px', color: '#1e3a8a', fontWeight: 700 }}>{portfolioMetrics.invoiceCount}</p>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>TOTAL VALUE</p>
              <p style={{ fontSize: '20px', color: '#1e3a8a', fontWeight: 700 }}>₹{portfolioMetrics.totalPortfolioValue.toLocaleString()}</p>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>AVG YIELD</p>
              <p style={{ fontSize: '20px', color: '#16a34a', fontWeight: 700 }}>{portfolioMetrics.averageYield.toFixed(2)}%</p>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>EXPECTED RETURN</p>
              <p style={{ fontSize: '20px', color: '#16a34a', fontWeight: 700 }}>₹{portfolioMetrics.expectedReturn.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>WEIGHTED RISK SCORE</p>
              <p style={{ fontSize: '20px', color: '#d97706', fontWeight: 700 }}>
                {typeof portfolioMetrics.weightedRiskScore === 'number' 
                  ? portfolioMetrics.weightedRiskScore.toFixed(3) 
                  : portfolioMetrics.weightedRiskScore}
              </p>
            </div>
          </div>
        </div>

        {/* Buyer Risk Assessment Section */}
        <div style={{ marginBottom: '24px', background: '#fff', border: '1px solid #dbe5ff', borderRadius: '12px', padding: '16px' }}>
          <h3 style={{ color: '#1e3a8a', marginBottom: '12px' }}>🔍 Buyer Risk Assessment</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {buyersInPipeline.length === 0 ? (
              <p style={{ color: '#64748b', gridColumn: '1/-1' }}>No buyers in pipeline yet</p>
            ) : (
              buyersInPipeline.map((buyer) => (
                <div
                  key={buyer.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                  }}
                  onClick={() => fetchBuyerRisk(buyer.id, buyer.name)}
                >
                  <h4 style={{ color: '#1e3a8a', marginBottom: '4px' }}>{buyer.name}</h4>
                  <p style={{ fontSize: '12px', color: '#64748b' }}>Invoices: {buyer.invoiceCount}</p>
                  {riskAssessments[buyer.id] && riskAssessments[buyer.id].success && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background:
                            riskAssessments[buyer.id].riskLevel === 'Low'
                              ? '#dcfce7'
                              : riskAssessments[buyer.id].riskLevel === 'Medium'
                                ? '#fef3c7'
                                : '#fee2e2',
                          color:
                            riskAssessments[buyer.id].riskLevel === 'Low'
                              ? '#166534'
                              : riskAssessments[buyer.id].riskLevel === 'Medium'
                                ? '#92400e'
                                : '#991b1b',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        {riskAssessments[buyer.id].riskLevel}
                      </span>
                    </div>
                  )}
                  <p style={{ fontSize: '12px', color: '#475569', marginTop: '8px' }}>
                    Click to view details →
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Risk Assessment Modal */}
        {selectedBuyerForRisk && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}>
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ color: '#1e3a8a' }}>Buyer Risk Assessment</h3>
                <button
                  onClick={() => setSelectedBuyerForRisk(null)}
                  style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>

              {selectedBuyerForRisk.success ? (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>BUYER NAME</p>
                    <p style={{ color: '#1e3a8a', fontWeight: 600, fontSize: '16px' }}>{selectedBuyerForRisk.buyerName}</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                      <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>CREDITWORTHINESS SCORE</p>
                      <p style={{ color: '#1e3a8a', fontWeight: 'bold', fontSize: '20px' }}>
                        {selectedBuyerForRisk.creditworthinessScore}/1000
                      </p>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                      <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>RISK LEVEL</p>
                      <p
                        style={{
                          display: 'inline-block',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background:
                            selectedBuyerForRisk.riskLevel === 'Low'
                              ? '#dcfce7'
                              : selectedBuyerForRisk.riskLevel === 'Medium'
                                ? '#fef3c7'
                                : '#fee2e2',
                          color:
                            selectedBuyerForRisk.riskLevel === 'Low'
                              ? '#166534'
                              : selectedBuyerForRisk.riskLevel === 'Medium'
                                ? '#92400e'
                                : '#991b1b',
                          fontWeight: 600,
                        }}
                      >
                        {selectedBuyerForRisk.riskLevel}
                      </p>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px', background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #86efac' }}>
                    <p style={{ color: '#166534', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>RECOMMENDATION</p>
                    <p style={{ color: '#166534' }}>{selectedBuyerForRisk.recommendation}</p>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '8px', fontWeight: 600 }}>RISK PROBABILITY</p>
                    <div style={{ background: '#f1f5f9', padding: '8px', borderRadius: '4px' }}>
                      <p style={{ color: '#1e3a8a' }}>{(selectedBuyerForRisk.riskProbability * 100).toFixed(2)}%</p>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '8px', fontWeight: 600 }}>FINANCIAL DETAILS</p>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                      {Object.entries(selectedBuyerForRisk.details).map(([key, value]) => (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ color: '#64748b', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}:</span>
                          <span style={{ color: '#1e3a8a', fontWeight: 600 }}>{typeof value === 'number' ? value.toFixed(3) : value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedBuyerForRisk(null)}
                    style={{
                      width: '100%',
                      border: 'none',
                      borderRadius: '8px',
                      background: '#1d4ed8',
                      color: '#fff',
                      padding: '10px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ color: '#991b1b' }}>⚠️ {selectedBuyerForRisk.error}</p>
                  <button
                    onClick={() => setSelectedBuyerForRisk(null)}
                    style={{
                      marginTop: '12px',
                      width: '100%',
                      border: 'none',
                      borderRadius: '8px',
                      background: '#cbd5e1',
                      color: '#1e293b',
                      padding: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <h3 style={{ color: '#1e3a8a', marginBottom: '12px' }}>💰 Available Invoices for MSMEs</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
          {invoicesWithRisk.length === 0 ? (
            <p style={{ color: '#64748b' }}>No confirmed invoices available for financing.</p>
          ) : (
            invoicesWithRisk.map((invoice) => (
              <article key={invoice.id} style={{ background: '#fff', border: activeOffer === invoice.id ? '2px solid #1d4ed8' : '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ color: '#1e3a8a', margin: 0 }}>{invoice.id}</h4>
                  <span style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                    Due: {new Date(invoice.dueDate).toLocaleDateString()}
                  </span>
                </div>
                
                <div style={{ marginTop: '4px' }}>
                  <p style={{ fontSize: '13px', color: '#475569', marginBottom: '2px' }}><strong>Supplier:</strong> {invoice.supplierName}</p>
                  <p style={{ fontSize: '13px', color: '#475569', marginBottom: '2px' }}><strong>Buyer:</strong> {invoice.buyerName}</p>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>INVOICE AMOUNT</p>
                    <p style={{ fontSize: '18px', color: '#1e3a8a', fontWeight: 700 }}>₹{invoice.amount?.toLocaleString()}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>BUYER RISK SCORE</p>
                    {invoice.riskScore ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '18px', fontWeight: 700, color: invoice.riskLevel === 'Low' ? '#16a34a' : invoice.riskLevel === 'Medium' ? '#d97706' : '#dc2626' }}>
                          {invoice.riskScore}
                        </span>
                        <span style={{ 
                          fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '10px',
                          background: invoice.riskLevel === 'Low' ? '#dcfce7' : invoice.riskLevel === 'Medium' ? '#fef3c7' : '#fee2e2',
                          color: invoice.riskLevel === 'Low' ? '#166534' : invoice.riskLevel === 'Medium' ? '#92400e' : '#991b1b'
                        }}>
                          {invoice.riskLevel}
                        </span>
                      </div>
                    ) : (
                      <p style={{ fontSize: '12px', color: '#ef4444', fontStyle: 'italic', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => fetchBuyerRisk(invoice.buyerId, invoice.buyerName)}>
                        Assess risk ↑
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setActiveOffer(invoice.id)}
                  style={{ 
                    marginTop: '4px',
                    border: 'none', 
                    borderRadius: '8px', 
                    background: activeOffer === invoice.id ? '#10b981' : '#1d4ed8', 
                    color: '#fff', 
                    padding: '10px 12px', 
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'background 0.2s',
                  }}
                >
                  {activeOffer === invoice.id ? '✓ Funding Selected' : 'Provide Capital'}
                </button>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
