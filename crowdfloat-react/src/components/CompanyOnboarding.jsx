import { useEffect, useRef, useState } from 'react';
import './CompanyOnboarding.css';
import { companyAPI } from '../utils/api';

const STEPS = [
  { id: 1, label: 'Profile' },
  { id: 2, label: 'Regulatory' },
  { id: 3, label: 'Bank & payout' },
  { id: 4, label: 'Documents' },
  { id: 5, label: 'Risk declaration' },
  { id: 6, label: 'Review' }
];

const DOC_BLOCKS = [
  {
    key: 'bankHistory',
    title: 'Bank transaction history',
    description: 'Provide your primary operating account statement for reconciliation checks.',
    helper: 'Accepted: PDF, JPG, PNG | Time range: last 6 months'
  },
  {
    key: 'gstFilings',
    title: 'GST filings',
    description: 'Submit recent GSTR records to validate filing continuity and tax compliance.',
    helper: 'Accepted: PDF, JPG, PNG | Time range: last 2 quarters'
  },
  {
    key: 'ewayBills',
    title: 'E-way bills',
    description: 'Upload representative transport records to cross-verify invoice movement.',
    helper: 'Accepted: PDF, JPG, PNG | Time range: last 6 months'
  },
  {
    key: 'udyamCertificate',
    title: 'Udyam registration certificate',
    description: 'Attach your valid Udyam registration certificate for MSME verification.',
    helper: 'Accepted: PDF, JPG, PNG | Time range: latest valid certificate'
  }
];

const INITIAL_DOC_STATE = {
  bankHistory: { fileName: '', status: '' },
  gstFilings: { fileName: '', status: '' },
  ewayBills: { fileName: '', status: '' },
  udyamCertificate: { fileName: '', status: '' }
};

const INITIAL_FORM_STATE = {
  entityType: 'Private Ltd',
  legalName: '',
  contactPerson: '',
  email: '',
  phone: '',
  pan: '',
  gst: '',
  regNumber: '',
  accountName: '',
  accountNumber: '',
  accountNumberConfirm: '',
  ifsc: '',
  accountType: '',
  investProfile: '',
  expLevel: '',
  risk1: false,
  risk2: false,
  risk3: false,
  riskConfirm: false,
  finalConfirm: false
};

function DocumentIcon({ type }) {
  if (type === 'bankHistory') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="2"></rect>
        <line x1="2" y1="10" x2="22" y2="10"></line>
        <line x1="7" y1="15" x2="11" y2="15"></line>
      </svg>
    );
  }

  if (type === 'gstFilings') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="8" y1="13" x2="16" y2="13"></line>
        <line x1="8" y1="17" x2="13" y2="17"></line>
      </svg>
    );
  }

  if (type === 'ewayBills') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="1" y="7" width="13" height="9" rx="2"></rect>
        <path d="M14 10h3l3 3v3h-6z"></path>
        <circle cx="4.5" cy="18.5" r="1.5"></circle>
        <circle cx="16.5" cy="18.5" r="1.5"></circle>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="17 8 12 3 7 8"></polyline>
      <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
  );
}

export default function CompanyOnboarding({ onBack, onSuccess }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [documents, setDocuments] = useState(INITIAL_DOC_STATE);
  const [error, setError] = useState('');
  const [skipValidation, setSkipValidation] = useState(true);
  const timeoutRef = useRef({});

  useEffect(() => {
    const activeTimeouts = timeoutRef.current;
    return () => {
      Object.values(activeTimeouts).forEach((id) => clearTimeout(id));
    };
  }, []);

  const uploadedCount = DOC_BLOCKS.filter((item) => documents[item.key].status === 'Uploaded').length;
  const completionPercent = (uploadedCount / DOC_BLOCKS.length) * 100;
  const progressPercent = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  const bankName = formData.ifsc.length === 11 ? 'HDFC Bank' : '';
  const branchName = formData.ifsc.length === 11 ? 'Mumbai Main Branch' : '';

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateStep = () => {
    if (currentStep === 1) {
      if (!formData.legalName.trim()) return 'Please enter legal entity name.';
      if (!formData.contactPerson.trim()) return 'Please enter contact person name.';
      if (!formData.phone.trim() || !/^[0-9]{10}$/.test(formData.phone.trim())) return 'Please enter a valid 10-digit mobile number.';
      if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) return 'Please enter a valid email address.';
    }

    if (currentStep === 2) {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan.trim())) return 'Please enter a valid PAN number.';
      if (formData.gst.trim() && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gst.trim())) return 'Please enter a valid GSTIN.';
      if (!formData.regNumber.trim()) return 'Please enter RBI or SEBI registration number.';
    }

    if (currentStep === 3) {
      if (!formData.accountName.trim()) return 'Please enter account holder name.';
      if (!formData.accountNumber.trim()) return 'Please enter account number.';
      if (!formData.accountNumberConfirm.trim() || formData.accountNumberConfirm !== formData.accountNumber) return 'Account numbers do not match.';
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifsc.trim())) return 'Please enter a valid IFSC code.';
      if (!formData.accountType) return 'Please select account type.';
    }

    if (currentStep === 4 && uploadedCount !== DOC_BLOCKS.length) {
      return 'Please upload all required documents before continuing.';
    }

    if (currentStep === 5) {
      if (!formData.investProfile) return 'Please select an investment profile.';
      if (!formData.expLevel) return 'Please select experience level.';
      if (!formData.risk1 || !formData.risk2 || !formData.risk3 || !formData.riskConfirm) return 'Please acknowledge all risk declarations.';
    }

    if (currentStep === 6 && !formData.finalConfirm) {
      return 'Please confirm before submission.';
    }

    return '';
  };

  const openFilePicker = (docKey) => {
    const input = document.getElementById(`company-upload-${docKey}`);
    if (input) input.click();
  };

  const onUpload = (docKey, file) => {
    if (!file) return;

    if (timeoutRef.current[docKey]) {
      clearTimeout(timeoutRef.current[docKey]);
    }

    setDocuments((prev) => ({
      ...prev,
      [docKey]: {
        fileName: file.name,
        status: 'Verifying...'
      }
    }));

    setError('');

    timeoutRef.current[docKey] = setTimeout(() => {
      setDocuments((prev) => ({
        ...prev,
        [docKey]: {
          ...prev[docKey],
          status: 'Uploaded'
        }
      }));
    }, 900);
  };

  const handleContinue = async () => {
    const validationMessage = skipValidation ? '' : validateStep();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    if (currentStep === 6) {
      try {
        const result = await companyAPI.submitOnboarding({ formData, documents });
        if (onSuccess) {
          onSuccess(result.submissionId);
        } else {
          onBack();
        }
      } catch (err) {
        setError(`Submission failed: ${err.message}`);
      }
      return;
    }

    setCurrentStep((prev) => prev + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      setError('');
    }
  };

  const maskAccount = (accountNumber) => (accountNumber.length > 4 ? `•••• ${accountNumber.slice(-4)}` : accountNumber || '—');

  const renderDocumentsStep = () => (
    <>
      <div className="company-section-header">
        <h2>Documents verification</h2>
        <p>Upload recent compliance documents for automated trust and underwriting checks.</p>
      </div>

      <div className="doc-completion-wrap">
        <div className="doc-completion-meta">
          <span>Overall document completion</span>
          <strong>{uploadedCount} of {DOC_BLOCKS.length} uploaded</strong>
        </div>
        <div className="doc-completion-track">
          <div className="doc-completion-fill" style={{ width: `${completionPercent}%` }} />
        </div>
      </div>

      {error && <div className="company-error">{error}</div>}

      <div className="doc-grid">
        {DOC_BLOCKS.map((doc) => {
          const state = documents[doc.key];
          const statusClass = state.status.toLowerCase().replace(/[^a-z]/g, '');
          const uploaded = state.status === 'Uploaded';

          return (
            <article className="doc-card" key={doc.key}>
              <div className="doc-card-top">
                <div className="doc-icon"><DocumentIcon type={doc.key} /></div>
                <div>
                  <h4>{doc.title}</h4>
                  <p>{doc.description}</p>
                </div>
              </div>

              <input
                id={`company-upload-${doc.key}`}
                type="file"
                className="doc-input"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(event) => onUpload(doc.key, event.target.files?.[0])}
              />

              <button type="button" className="doc-upload-btn" onClick={() => openFilePicker(doc.key)}>
                Upload PDF / Image
              </button>

              <div className="doc-status-row">
                <span className="doc-file-name">{state.fileName || 'No file selected'}</span>
                {state.status && (
                  <span className={`doc-status ${statusClass}`}>
                    {uploaded && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                    {state.status}
                  </span>
                )}
              </div>

              <small>{doc.helper}</small>
            </article>
          );
        })}
      </div>
    </>
  );

  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <>
          <div className="company-section-header">
            <h2>Profile</h2>
            <p>Provide legal and authorized contact information for the company onboarding profile.</p>
          </div>
          <div className="company-form-grid two-col">
            <label className="company-field">
              <span>Entity Type</span>
              <select value={formData.entityType} onChange={(event) => handleChange('entityType', event.target.value)}>
                <option>Private Ltd</option>
                <option>LLP</option>
                <option>Partnership</option>
                <option>Proprietorship</option>
              </select>
            </label>
            <label className="company-field">
              <span>Contact Person Name</span>
              <input type="text" value={formData.contactPerson} onChange={(event) => handleChange('contactPerson', event.target.value)} />
            </label>
          </div>
          <div className="company-form-grid">
            <label className="company-field">
              <span>Full Legal Entity Name</span>
              <input type="text" value={formData.legalName} onChange={(event) => handleChange('legalName', event.target.value)} />
            </label>
          </div>
          <div className="company-form-grid two-col">
            <label className="company-field">
              <span>Mobile Number</span>
              <input type="tel" value={formData.phone} onChange={(event) => handleChange('phone', event.target.value)} />
            </label>
            <label className="company-field">
              <span>Authorized Email</span>
              <input type="email" value={formData.email} onChange={(event) => handleChange('email', event.target.value)} />
            </label>
          </div>
        </>
      );
    }

    if (currentStep === 2) {
      return (
        <>
          <div className="company-section-header">
            <h2>Regulatory</h2>
            <p>Regulatory data is validated against compliance registries before activation.</p>
          </div>
          <div className="company-form-grid two-col">
            <label className="company-field">
              <span>PAN Number</span>
              <input type="text" maxLength={10} value={formData.pan} onChange={(event) => handleChange('pan', event.target.value.toUpperCase())} />
            </label>
            <label className="company-field">
              <span>GSTIN</span>
              <input type="text" maxLength={15} value={formData.gst} onChange={(event) => handleChange('gst', event.target.value.toUpperCase())} />
            </label>
          </div>
          <div className="company-form-grid">
            <label className="company-field">
              <span>RBI or SEBI Registration Number</span>
              <input type="text" value={formData.regNumber} onChange={(event) => handleChange('regNumber', event.target.value)} />
            </label>
          </div>
        </>
      );
    }

    if (currentStep === 3) {
      return (
        <>
          <div className="company-section-header">
            <h2>Bank & payout</h2>
            <p>Add primary payout account details used for settlements and withdrawals.</p>
          </div>
          <div className="company-form-grid">
            <label className="company-field">
              <span>Account Holder Name</span>
              <input type="text" value={formData.accountName} onChange={(event) => handleChange('accountName', event.target.value)} />
            </label>
          </div>
          <div className="company-form-grid two-col">
            <label className="company-field">
              <span>Account Number</span>
              <input type="password" value={formData.accountNumber} onChange={(event) => handleChange('accountNumber', event.target.value)} />
            </label>
            <label className="company-field">
              <span>Re-enter Account Number</span>
              <input type="text" value={formData.accountNumberConfirm} onChange={(event) => handleChange('accountNumberConfirm', event.target.value)} />
            </label>
          </div>
          <div className="company-form-grid two-col">
            <label className="company-field">
              <span>IFSC Code</span>
              <input type="text" maxLength={11} value={formData.ifsc} onChange={(event) => handleChange('ifsc', event.target.value.toUpperCase())} />
            </label>
            <label className="company-field">
              <span>Account Type</span>
              <select value={formData.accountType} onChange={(event) => handleChange('accountType', event.target.value)}>
                <option value="">Select account type</option>
                <option value="current">Current account</option>
                <option value="savings">Savings account</option>
              </select>
            </label>
          </div>
          <div className="company-form-grid two-col">
            <label className="company-field muted">
              <span>Bank Name</span>
              <input type="text" value={bankName} disabled />
            </label>
            <label className="company-field muted">
              <span>Branch</span>
              <input type="text" value={branchName} disabled />
            </label>
          </div>
        </>
      );
    }

    if (currentStep === 4) {
      return renderDocumentsStep();
    }

    if (currentStep === 5) {
      return (
        <>
          <div className="company-section-header">
            <h2>Risk declaration</h2>
            <p>Confirm risk preferences and capital deployment understanding before activation.</p>
          </div>

          <div className="company-pick-wrap">
            <h5>Investment Profile</h5>
            <div className="company-choice-row">
              {['Conservative', 'Moderate', 'Aggressive'].map((profile) => (
                <label key={profile} className={`company-choice ${formData.investProfile === profile ? 'checked' : ''}`}>
                  <input type="radio" hidden checked={formData.investProfile === profile} onChange={() => handleChange('investProfile', profile)} />
                  <span>{profile}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="company-pick-wrap">
            <h5>Experience Level</h5>
            <div className="company-choice-row">
              {['New to fixed-income', 'Some experience', 'Advanced'].map((level) => (
                <label key={level} className={`company-choice ${formData.expLevel === level ? 'checked' : ''}`}>
                  <input type="radio" hidden checked={formData.expLevel === level} onChange={() => handleChange('expLevel', level)} />
                  <span>{level}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="company-checklist-wrap">
            <label className={`company-check-item ${formData.risk1 ? 'checked' : ''}`}>
              <input type="checkbox" hidden checked={formData.risk1} onChange={(event) => handleChange('risk1', event.target.checked)} />
              <div className="box">{formData.risk1 && '✓'}</div>
              <p>I understand that invoice-backed investments are not guaranteed returns.</p>
            </label>
            <label className={`company-check-item ${formData.risk2 ? 'checked' : ''}`}>
              <input type="checkbox" hidden checked={formData.risk2} onChange={(event) => handleChange('risk2', event.target.checked)} />
              <div className="box">{formData.risk2 && '✓'}</div>
              <p>I acknowledge that delayed repayments can impact liquidity timelines.</p>
            </label>
            <label className={`company-check-item ${formData.risk3 ? 'checked' : ''}`}>
              <input type="checkbox" hidden checked={formData.risk3} onChange={(event) => handleChange('risk3', event.target.checked)} />
              <div className="box">{formData.risk3 && '✓'}</div>
              <p>I confirm due diligence responsibility remains with the participating company.</p>
            </label>
            <label className={`company-check-item strong ${formData.riskConfirm ? 'checked' : ''}`}>
              <input type="checkbox" hidden checked={formData.riskConfirm} onChange={(event) => handleChange('riskConfirm', event.target.checked)} />
              <div className="box">{formData.riskConfirm && '✓'}</div>
              <p>I have read and understood all risk declarations above.</p>
            </label>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="company-section-header">
          <h2>Review</h2>
          <p>Review all submitted details before final onboarding submission.</p>
        </div>

        <div className="company-review-grid">
          <div className="company-review-card">
            <h4>Profile</h4>
            <p><strong>Entity:</strong> {formData.entityType}</p>
            <p><strong>Legal name:</strong> {formData.legalName || '—'}</p>
            <p><strong>Contact:</strong> {formData.contactPerson || '—'}</p>
            <p><strong>Email:</strong> {formData.email || '—'}</p>
            <p><strong>Mobile:</strong> {formData.phone || '—'}</p>
          </div>

          <div className="company-review-card">
            <h4>Regulatory</h4>
            <p><strong>PAN:</strong> {formData.pan || '—'}</p>
            <p><strong>GSTIN:</strong> {formData.gst || '—'}</p>
            <p><strong>Registration:</strong> {formData.regNumber || '—'}</p>
          </div>

          <div className="company-review-card">
            <h4>Bank & payout</h4>
            <p><strong>Account holder:</strong> {formData.accountName || '—'}</p>
            <p><strong>Account:</strong> {maskAccount(formData.accountNumber)}</p>
            <p><strong>IFSC:</strong> {formData.ifsc || '—'}</p>
            <p><strong>Type:</strong> {formData.accountType || '—'}</p>
          </div>

          <div className="company-review-card">
            <h4>Documents</h4>
            {DOC_BLOCKS.map((doc) => (
              <p key={doc.key}><strong>{doc.title}:</strong> {documents[doc.key].status}</p>
            ))}
          </div>
        </div>

        <label className={`company-check-item strong ${formData.finalConfirm ? 'checked' : ''}`}>
          <input type="checkbox" hidden checked={formData.finalConfirm} onChange={(event) => handleChange('finalConfirm', event.target.checked)} />
          <div className="box">{formData.finalConfirm && '✓'}</div>
          <p>I certify that all submitted information is accurate and complete.</p>
        </label>
      </>
    );
  };

  return (
    <div className="company-flow-wrapper">
      <div className="company-flow-header">
        <button className="company-back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Return to Portal
        </button>
      </div>

      <section className="company-main-card">
        <div className="company-stepper-wrap">
          <div className="company-progress-track">
            <div className="company-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="company-steps">
            {STEPS.map((step) => (
              <div key={step.id} className={`company-step ${currentStep >= step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}>
                <div className="company-step-circle">
                  {currentStep > step.id ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : step.id}
                </div>
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="company-card-body single-column">
          <div className="company-content-left">
            {renderStepContent()}
            {error && currentStep !== 4 && <div className="company-error company-error-top">{error}</div>}

            <div className="company-actions">
              <label style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569' }}>
                <input
                  type="checkbox"
                  checked={skipValidation}
                  onChange={(event) => setSkipValidation(event.target.checked)}
                />
                Dev mode: Skip required validations
              </label>
              {currentStep > 1 && (
                <button className="company-btn-back" onClick={handlePrevious}>Back</button>
              )}
              <button className="company-btn-primary" onClick={handleContinue}>{currentStep === 6 ? 'Confirm & submit' : 'Continue'}</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
