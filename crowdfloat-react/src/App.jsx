import { useEffect, useState } from 'react';
import { API_BASE_URL } from './utils/api';
import './index.css';
import './App.css';
import Navbar from './components/Navbar';
import RoleCards from './components/RoleCards';
import FeatureSections from './components/FeatureSections';
import FunderKYC from './components/FunderKYC';
import CompanyOnboarding from './components/CompanyOnboarding';
import CompanyHome from './components/CompanyHome';
import CompanyLogin from './components/CompanyLogin';
import FunderLogin from './components/FunderLogin';
import FunderHome from './components/FunderHome';
import BuyerDashboard from './components/BuyerDashboard';
import Footer from './components/Footer';

const REGISTERED_BUYERS = [
  { id: 'buyer-aurora', name: 'Aurora Retail Pvt Ltd', email: 'ap@auroraretail.com' },
  { id: 'buyer-nova', name: 'Nova Trade Hub', email: 'finance@novatradehub.com' },
  { id: 'buyer-summit', name: 'Summit Procurement Ltd', email: 'payables@summitprocure.com' },
];

const LINKED_INVOICE_SEED = [];

const PATH_TO_VIEW = {
  '/': 'landing',
  '/company': 'company-home',
  '/company-login': 'company-login',
  '/company-onboarding': 'company-onboarding',
  '/funder': 'funder-home',
  '/funder-login': 'funder-login',
  '/funder-kyc': 'funder-kyc',
  '/buyer': 'buyer-dashboard',
};

export default function App() {
  const [showRoles, setShowRoles] = useState(false);
  const [currentView, setCurrentView] = useState(() => {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    if (path === '/confirm-invoice') return 'confirm-invoice';
    return PATH_TO_VIEW[path] || 'landing';
  });
  const [companySubmissionId, setCompanySubmissionId] = useState('');
  const [funderSubmissionId, setFunderSubmissionId] = useState('');
  const [selectedBuyerUserId, setSelectedBuyerUserId] = useState(REGISTERED_BUYERS[0].id);
  
  // Persist linked invoices so email links in new tabs can modify the state!
  const [linkedInvoices, setLinkedInvoices] = useState(() => {
    try {
      const saved = localStorage.getItem('linkedInvoices');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.error('Error parsing invoices from localStorage', err);
    }
    return LINKED_INVOICE_SEED;
  });

  // Sync state to local storage and across tabs
  useEffect(() => {
    localStorage.setItem('linkedInvoices', JSON.stringify(linkedInvoices));
  }, [linkedInvoices]);

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'linkedInvoices' && e.newValue) {
        setLinkedInvoices(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const [confirmStatus, setConfirmStatus] = useState(null);

  // Parse email approval link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    
    if (path === '/confirm-invoice') {
      const invoiceId = params.get('invoice_id');
      const token = params.get('token');
      const action = params.get('action'); // 'approve' or 'reject'
      
      if (invoiceId && token) {
        setCurrentView('confirm-invoice');
        
        // Let the backend process the email link
        fetch(`${API_BASE_URL}/invoice/confirm-action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoiceId, token, action: action || 'approve' }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setConfirmStatus({ success: true, action: action || 'approve', invoiceId });
              if (action === 'reject') {
                disputeLinkedInvoice(invoiceId, 'Rejected via email link');
              } else {
                confirmLinkedInvoice(invoiceId);
              }
            } else {
              setConfirmStatus({ success: false, error: data.error });
            }
          })
          .catch((err) => {
            setConfirmStatus({ success: false, error: err.message });
          });
      }
    }
  }, []);

  useEffect(() => {
    // Initial load from real DB!
    fetch(`${API_BASE_URL}/invoices`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.invoices) {
          setLinkedInvoices(data.invoices);
        }
      })
      .catch(err => console.error("Failed to load invoices from DB:", err));
  }, []);

  useEffect(() => {
    // Ensure stale in-memory rows from previous hot-reload sessions are cleared.
    // However, since we now fetch from DB, we don't clear it forcefully if we have DB data.
  }, []);

  const createLinkedInvoice = (payload) => {
    const buyer = REGISTERED_BUYERS.find((item) => item.id === payload.buyerId);
    if (!buyer) return;

    const invoiceCode = `CF-INV-${Math.floor(1000 + Math.random() * 9000)}`;
    const newInvoice = {
      id: invoiceCode,
      supplierName: payload.supplierName,
      buyerId: buyer.id,
      buyerName: buyer.name,
      buyerEmail: payload.buyerEmail,
      program: payload.program,
      poReference: payload.poReference,
      dueDate: payload.dueDate,
      amount: Number(payload.amount),
      status: 'awaiting-buyer-confirmation',
      disputeReason: '',
      documentFile: payload.documentFile || null,
      gstVerified: payload.gstVerified ?? undefined,
      gstNumber: payload.gstNumber || '',
      gstCompanyName: payload.gstCompanyName || '',
      trustScore: payload.trustScore ?? null,
      riskLevel: payload.riskLevel || '',
      scrapedInvoiceId: payload.scrapedInvoiceId || '',
    };
    
    setLinkedInvoices((prev) => [newInvoice, ...prev]);

    // Async request to save it to DB
    fetch(`${API_BASE_URL}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newInvoice),
    }).catch(console.error);

    // Async request to backend to shoot the email to the buyer!
    fetch(`${API_BASE_URL}/invoice/request-approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId: invoiceCode,
        amount: Number(payload.amount),
        buyerEmail: payload.buyerEmail,
        buyerName: buyer.name
      }),
    }).then(res => res.json()).then(data => {
      if (data.success) {
        console.log("Approval email API hit successfully!");
      } else {
        alert("Server failed to send email: " + data.error);
      }
    }).catch(err => {
      console.error('Error sending request-approval email:', err);
      alert("Network error making email request: " + err.message);
    });
  };

  const confirmLinkedInvoice = (invoiceId) => {
    setLinkedInvoices((prev) =>
      prev.map((item) =>
        item.id === invoiceId
          ? { ...item, status: 'confirmed-financing-eligible', disputeReason: '' }
          : item,
      ),
    );
    // Sync to DB
    fetch(`${API_BASE_URL}/invoices/${invoiceId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed-financing-eligible', disputeReason: '' })
    }).catch(console.error);
  };

  const disputeLinkedInvoice = (invoiceId, reason) => {
    setLinkedInvoices((prev) =>
      prev.map((item) =>
        item.id === invoiceId
          ? { ...item, status: 'disputed', disputeReason: reason }
          : item,
      ),
    );
    // Sync to DB
    fetch(`${API_BASE_URL}/invoices/${invoiceId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'disputed', disputeReason: reason })
    }).catch(console.error);
  };

  if (currentView === 'confirm-invoice') {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f8fafc', flexDirection: 'column' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', textAlign: 'center', maxWidth: '500px' }}>
          {!confirmStatus ? (
            <h2 style={{ color: '#1d4ed8' }}>Processing your response...</h2>
          ) : confirmStatus.success ? (
            <>
              <h1 style={{ color: confirmStatus.action === 'approve' ? '#16a34a' : '#ef4444', fontSize: '32px', marginBottom: '16px' }}>
                {confirmStatus.action === 'approve' ? '✅ Invoice Approved Successfully' : '❌ Invoice Rejected'}
              </h1>
              <p style={{ color: '#475569', fontSize: '18px' }}>
                Invoice {confirmStatus.invoiceId} has been successfully {confirmStatus.action}d. The MSME supplier has been notified and the dashboard states are updated.
              </p>
            </>
          ) : (
            <>
              <h1 style={{ color: '#ef4444', fontSize: '32px', marginBottom: '16px' }}>❌ Error</h1>
              <p style={{ color: '#475569', fontSize: '18px' }}>{confirmStatus.error}</p>
            </>
          )}
          <button 
            onClick={() => { window.location.href = '/'; }}
            style={{ marginTop: '30px', padding: '12px 24px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: '600' }}
          >
            Return to CrowdFloat Login
          </button>
        </div>
      </div>
    );
  }

  if (currentView === 'funder-kyc') {
    return (
      <FunderKYC
        onBack={() => setCurrentView('landing')}
        onSuccess={(submissionId) => {
          setFunderSubmissionId(submissionId || '');
          setCurrentView('funder-home');
        }}
      />
    );
  }

  if (currentView === 'funder-login') {
    return (
      <FunderLogin
        onBack={() => setCurrentView('landing')}
        onSwitchToSignup={() => setCurrentView('funder-kyc')}
        onSuccess={(submissionId) => {
          setFunderSubmissionId(submissionId || '');
          setCurrentView('funder-home');
        }}
      />
    );
  }

  if (currentView === 'funder-home') {
    return (
      <FunderHome
        submissionId={funderSubmissionId}
        linkedInvoices={linkedInvoices}
        registeredBuyers={REGISTERED_BUYERS}
        onBackToPortal={() => {
          setShowRoles(false);
          setCurrentView('landing');
        }}
      />
    );
  }

  if (currentView === 'company-onboarding') {
    return (
      <CompanyOnboarding
        onBack={() => setCurrentView('landing')}
        onSuccess={(submissionId) => {
          setCompanySubmissionId(submissionId || '');
          setCurrentView('company-home');
        }}
      />
    );
  }

  if (currentView === 'company-login') {
    return (
      <CompanyLogin
        onBack={() => setCurrentView('landing')}
        onSwitchToSignup={() => setCurrentView('company-onboarding')}
        onSuccess={(submissionId) => {
          setCompanySubmissionId(submissionId || '');
          setCurrentView('company-home');
        }}
      />
    );
  }

  if (currentView === 'company-home') {
    return (
      <CompanyHome
        submissionId={companySubmissionId}
        registeredBuyers={REGISTERED_BUYERS}
        linkedInvoices={linkedInvoices}
        onSubmitInvoiceToBuyer={createLinkedInvoice}
        onBackToPortal={() => {
          setShowRoles(false);
          setCurrentView('landing');
        }}
      />
    );
  }

  if (currentView === 'buyer-dashboard') {
    return (
      <BuyerDashboard
        registeredBuyers={REGISTERED_BUYERS}
        selectedBuyerUserId={selectedBuyerUserId}
        onSelectBuyerUser={setSelectedBuyerUserId}
        linkedInvoices={linkedInvoices}
        onConfirmInvoice={confirmLinkedInvoice}
        onDisputeInvoice={disputeLinkedInvoice}
        onBackToPortal={() => {
          setShowRoles(false);
          setCurrentView('landing');
        }}
      />
    );
  }

  return (
    <>
      <div className="bg-orbs" />

      <div className="app-shell">
        <Navbar />

        <main className="main-content">
          <div className={`hero-transition-wrap ${showRoles ? 'showing-roles' : 'showing-hero'}`}>
            <div className="hero-section">
              <div className="main-eyebrow">Invoice Financing · Supply-Chain Credit</div>
              <h1 className="main-heading">
                Capital flows freely<br />when trust is verified.
              </h1>
              <p className="main-sub">
                CrowdFloat is a transparent, real-time invoice financing platform connecting MSMEs with verified capital. Bridge your working capital gaps with dynamic discounting and supply-chain credit.
              </p>
              <button className="btn-get-started" onClick={() => setShowRoles(true)}>
                Get Started
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>

            <div className="roles-section">
              <div className="main-eyebrow">Select Account Type</div>
              <h2 className="main-heading">Choose your portal</h2>
              <p className="main-sub">Select your primary platform role below to begin the onboarding process.</p>
              {showRoles && (
                <RoleCards
                  onSelectRole={(role) => {
                    if (role === 'company') setCurrentView('company-login');
                    if (role === 'funder') setCurrentView('funder-login');
                    if (role === 'buyer') setCurrentView('buyer-dashboard');
                  }}
                />
              )}
            </div>
          </div>
        </main>

        <FeatureSections />
        <Footer />
      </div>
    </>
  );
}
