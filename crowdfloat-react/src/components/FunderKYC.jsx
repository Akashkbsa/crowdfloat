import { useState, useEffect } from 'react';
import './FunderKYC.css';
import { funderAPI } from '../utils/api';

const STEPS = [
  { id: 1, label: 'Profile' },
  { id: 2, label: 'Regulatory' },
  { id: 3, label: 'Bank & payout' },
  { id: 4, label: 'Risk declaration' },
  { id: 5, label: 'Review' }
];

export default function FunderKYC({ onBack, onSuccess }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1
    entityType: 'NBFC',
    legalName: '', contactPerson: '', email: '', phone: '',
    // Step 2
    pan: '', gst: '', regNumber: '',
    // Step 3
    accountName: '', accountNumber: '', accountNumberConfirm: '', ifsc: '',
    bankName: '', branch: '', accountType: '', autoDebit: false,
    // Step 4
    investProfile: '', expLevel: '', 
    risk1: false, risk2: false, risk3: false, riskConfirm: false,
    // Step 5
    finalConfirm: false
  });
  const [errors, setErrors] = useState({});
  const [skipValidation, setSkipValidation] = useState(true);

  // Mock auto-fill bank
  useEffect(() => {
    if (formData.ifsc.length === 11) {
      setFormData(prev => ({ ...prev, bankName: 'HDFC Bank', branch: 'Mumbai Main Branch' }));
    } else if (formData.ifsc.length < 11 && formData.bankName) {
      setFormData(prev => ({ ...prev, bankName: '', branch: '' }));
    }
  }, [formData.ifsc]);

  const validateStep = () => {
    const newErrors = {};
    if (currentStep === 1) {
      if (!formData.legalName.trim()) newErrors.legalName = 'This field is required';
      const phoneRegex = /^[0-9]{10}$/;
      if (!formData.phone.trim()) newErrors.phone = 'This field is required';
      else if (!phoneRegex.test(formData.phone.trim())) newErrors.phone = 'Enter a valid 10-digit number';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!formData.email.trim()) newErrors.email = 'This field is required';
      else if (!emailRegex.test(formData.email.trim())) newErrors.email = 'Enter a valid email ID';
      if (formData.entityType !== 'Individual' && !formData.contactPerson.trim()) {
        newErrors.contactPerson = 'This field is required';
      }
    } 
    else if (currentStep === 2) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!formData.pan.trim()) newErrors.pan = 'This field is required';
      else if (!panRegex.test(formData.pan.trim())) newErrors.pan = 'Invalid PAN format';
      
      if (formData.entityType !== 'Individual' && formData.gst.trim()) {
        const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstRegex.test(formData.gst.trim())) newErrors.gst = 'Invalid GSTIN format';
      }
      if (formData.entityType === 'NBFC') {
        if (!formData.regNumber.trim()) newErrors.regNumber = 'This field is required';
      }
    }
    else if (currentStep === 3) {
      if (!formData.accountName.trim()) newErrors.accountName = 'This field is required';
      if (!formData.accountNumber.trim()) newErrors.accountNumber = 'This field is required';
      
      if (formData.accountNumber !== formData.accountNumberConfirm) {
        newErrors.accountNumberConfirm = 'Account numbers do not match';
      } else if (!formData.accountNumberConfirm.trim()) {
        newErrors.accountNumberConfirm = 'Please re-enter account number';
      }

      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!formData.ifsc.trim()) newErrors.ifsc = 'IFSC is required';
      else if (!ifscRegex.test(formData.ifsc)) newErrors.ifsc = 'Invalid IFSC code format';

      if (!formData.accountType) newErrors.accountType = 'Select an account type';
    }
    else if (currentStep === 4) {
      if (!formData.investProfile) newErrors.investProfile = 'Please select a profile';
      if (!formData.expLevel) newErrors.expLevel = 'Please select your experience';
      if (!formData.risk1 || !formData.risk2 || !formData.risk3) newErrors.riskChecklist = 'Please acknowledge all points';
      if (!formData.riskConfirm) newErrors.riskConfirm = 'Confirmation is mandatory to proceed';
    }
    else if (currentStep === 5) {
      if (!formData.finalConfirm) newErrors.finalConfirm = 'You must certify the information to submit.';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field] || errors.riskChecklist) {
      setErrors(prev => ({ ...prev, [field]: '', riskChecklist: '' }));
    }
  };

  const handleNext = async () => {
    if (skipValidation || validateStep()) {
      if (currentStep === 5) {
        try {
          const result = await funderAPI.submitKYC(formData);
          alert(`Verification submitted successfully! Submission ID: ${result.submissionId}`);
          if (onSuccess) {
            onSuccess(result.submissionId);
          } else {
            onBack();
          }
        } catch (err) {
          alert(`Failed to submit verification: ${err.message}`);
        }
      } else {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => prev - 1);
  };
  
  const progressPercent = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  const maskAccount = (acc) => acc.length > 4 ? `•••• ${acc.slice(-4)}` : acc;

  return (
    <div className="kyc-page-wrapper">
      <div className="kyc-header">
        <button className="kyc-back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Return to Portal
        </button>
      </div>

      <div className="kyc-main-card">
        {/* Progress Bar & Stepper */}
        <div className="kyc-stepper-container">
          <div className="kyc-progress-track">
            <div className="kyc-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="kyc-steps">
            {STEPS.map((s) => (
              <div key={s.id} className={`kyc-step ${currentStep >= s.id ? 'active' : ''} ${currentStep > s.id ? 'completed' : ''}`}>
                <div className="step-circle">
                  {currentStep > s.id ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : s.id}
                </div>
                <span className="step-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="kyc-content-split">
          
          {/* Left Form Area */}
          <div className="kyc-form-area">
            <div className="kyc-form-header">
              <h2>{STEPS[currentStep-1].label}</h2>
              {currentStep === 1 && <p>Please provide verifiable legal information to proceed with onboarding.</p>}
              {currentStep === 2 && <p>Regulatory details are used to verify your entity status with authorities.</p>}
              {currentStep === 3 && <p>Primary bank account for payouts. This account will be used for withdrawals and interest payouts.</p>}
              {currentStep === 4 && <p>Please review and confirm your risk preferences and declarations before deploying capital.</p>}
              {currentStep === 5 && <p>Please review the submitted details carefully. Ensure all records match your official documents.</p>}
            </div>

            <div className="kyc-form-fields slide-enter" key={`s-${currentStep}`}>
              
              {/* STEP 1: Profile */}
              {currentStep === 1 && (
                <>
                  <div className="kyc-radio-group">
                    {['NBFC', 'Individual'].map(type => (
                      <label key={type} className="radio-card">
                        <input type="radio" name="entityType" value={type} 
                          checked={formData.entityType === type}
                          onChange={(e) => {
                            handleChange('entityType', e.target.value);
                            setErrors({});
                          }} />
                        <div className="radio-content">
                          <div className="radio-circle" />
                          <span className="radio-label">{type}</span>
                        </div>
                      </label>
                    ))}
                  </div>

                  {formData.entityType === 'Individual' ? (
                    <>
                      <div className="float-group">
                        <input type="text" id="legalName" className={`float-input ${errors.legalName ? 'error' : ''}`} placeholder=" "
                          value={formData.legalName} onChange={e => handleChange('legalName', e.target.value)} />
                        <label htmlFor="legalName" className="float-label">Full Name (As per PAN)</label>
                        {errors.legalName && <div className="error-text">{errors.legalName}</div>}
                      </div>

                      <div className="form-row">
                        <div className="float-group">
                          <input type="tel" id="mobile" className={`float-input ${errors.phone ? 'error' : ''}`} placeholder=" "
                            value={formData.phone} onChange={e => handleChange('phone', e.target.value)} />
                          <label htmlFor="mobile" className="float-label">Mobile Number</label>
                          {errors.phone && <div className="error-text">{errors.phone}</div>}
                        </div>
                        <div className="float-group">
                          <input type="email" id="email" className={`float-input ${errors.email ? 'error' : ''}`} placeholder=" "
                            value={formData.email} onChange={e => handleChange('email', e.target.value)} />
                          <label htmlFor="email" className="float-label">Email ID</label>
                          {errors.email && <div className="error-text">{errors.email}</div>}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="float-group">
                        <input type="text" id="legalName" className={`float-input ${errors.legalName ? 'error' : ''}`} placeholder=" "
                          value={formData.legalName} onChange={e => handleChange('legalName', e.target.value)} />
                        <label htmlFor="legalName" className="float-label">Full Legal Entity Name</label>
                        {errors.legalName && <div className="error-text">{errors.legalName}</div>}
                      </div>

                      <div className="form-row">
                        <div className="float-group">
                          <input type="text" id="contactPerson" className={`float-input ${errors.contactPerson ? 'error' : ''}`} placeholder=" "
                            value={formData.contactPerson} onChange={e => handleChange('contactPerson', e.target.value)} />
                          <label htmlFor="contactPerson" className="float-label">Contact Person Name</label>
                          {errors.contactPerson && <div className="error-text">{errors.contactPerson}</div>}
                        </div>
                        <div className="float-group">
                          <input type="tel" id="mobile" className={`float-input ${errors.phone ? 'error' : ''}`} placeholder=" "
                            value={formData.phone} onChange={e => handleChange('phone', e.target.value)} />
                          <label htmlFor="mobile" className="float-label">Mobile Number</label>
                          {errors.phone && <div className="error-text">{errors.phone}</div>}
                        </div>
                      </div>

                      <div className="float-group">
                        <input type="email" id="email" className={`float-input ${errors.email ? 'error' : ''}`} placeholder=" "
                          value={formData.email} onChange={e => handleChange('email', e.target.value)} />
                        <label htmlFor="email" className="float-label">Authorised Email ID</label>
                        {errors.email && <div className="error-text">{errors.email}</div>}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* STEP 2: Regulatory */}
              {currentStep === 2 && (
                <>
                  <div className="float-group">
                    <input type="text" id="pan" className={`float-input ${errors.pan ? 'error' : ''}`} placeholder=" " maxLength={10}
                      value={formData.pan} onChange={e => handleChange('pan', e.target.value.toUpperCase())} />
                    <label htmlFor="pan" className="float-label">Company/Individual PAN Number</label>
                    {errors.pan && <div className="error-text">{errors.pan}</div>}
                  </div>
                  
                  {formData.entityType !== 'Individual' && (
                    <div className="float-group">
                      <input type="text" id="gst" className={`float-input ${errors.gst ? 'error' : ''}`} placeholder=" " maxLength={15}
                        value={formData.gst} onChange={e => handleChange('gst', e.target.value.toUpperCase())} />
                      <label htmlFor="gst" className="float-label">GSTIN (Optional for unlisted)</label>
                      {errors.gst && <div className="error-text">{errors.gst}</div>}
                    </div>
                  )}

                  {formData.entityType === 'NBFC' && (
                    <div className="float-group">
                      <input type="text" id="regNumber" className={`float-input ${errors.regNumber ? 'error' : ''}`} placeholder=" "
                        value={formData.regNumber} onChange={e => handleChange('regNumber', e.target.value)} />
                      <label htmlFor="regNumber" className="float-label">RBI/SEBI Registration Number</label>
                      {errors.regNumber && <div className="error-text">{errors.regNumber}</div>}
                    </div>
                  )}
                </>
              )}

              {/* STEP 3: Bank & Payout */}
              {currentStep === 3 && (
                <>
                  <div className="float-group">
                    <input type="text" id="accountName" className={`float-input ${errors.accountName ? 'error' : ''}`} placeholder=" "
                      value={formData.accountName} onChange={e => handleChange('accountName', e.target.value)} />
                    <label htmlFor="accountName" className="float-label">Account Holder Name</label>
                    {errors.accountName && <div className="error-text">{errors.accountName}</div>}
                  </div>

                  <div className="form-row">
                    <div className="float-group">
                      <input type="password" id="accountNumber" className={`float-input ${errors.accountNumber ? 'error' : ''}`} placeholder=" "
                        value={formData.accountNumber} onChange={e => handleChange('accountNumber', e.target.value)} />
                      <label htmlFor="accountNumber" className="float-label">Account Number</label>
                      {errors.accountNumber && <div className="error-text">{errors.accountNumber}</div>}
                    </div>
                    <div className="float-group">
                      <input type="text" id="accountNumberConfirm" 
                        className={`float-input ${errors.accountNumberConfirm ? 'error' : (formData.accountNumber && formData.accountNumber === formData.accountNumberConfirm) ? 'success' : ''}`} 
                        placeholder=" "
                        value={formData.accountNumberConfirm} onChange={e => handleChange('accountNumberConfirm', e.target.value)} />
                      <label htmlFor="accountNumberConfirm" className="float-label">Re-enter Account Number</label>
                      {errors.accountNumberConfirm && <div className="error-text">{errors.accountNumberConfirm}</div>}
                      {(!errors.accountNumberConfirm && formData.accountNumber && formData.accountNumber === formData.accountNumberConfirm) && 
                        <div className="success-text"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Matches</div>
                      }
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="float-group" style={{ flex: 1 }}>
                      <input type="text" id="ifsc" maxLength={11} className={`float-input ${errors.ifsc ? 'error' : ''}`} placeholder=" "
                        value={formData.ifsc} onChange={e => handleChange('ifsc', e.target.value.toUpperCase())} />
                      <label htmlFor="ifsc" className="float-label">IFSC Code</label>
                      {errors.ifsc && <div className="error-text">{errors.ifsc}</div>}
                    </div>
                    <div className="float-group" style={{ flex: 1 }}>
                      <select id="accountType" className={`float-select ${errors.accountType ? 'error' : ''}`} 
                        value={formData.accountType} onChange={e => handleChange('accountType', e.target.value)}>
                        <option value="" disabled hidden></option>
                        <option value="savings">Savings Account</option>
                        <option value="current">Current Account</option>
                      </select>
                      <label htmlFor="accountType" className="float-label">Account Type</label>
                      {errors.accountType && <div className="error-text">{errors.accountType}</div>}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="float-group">
                      <input type="text" id="bankName" className="float-input" placeholder=" " disabled
                        value={formData.bankName} />
                      <label htmlFor="bankName" className="float-label">Bank Name</label>
                    </div>
                    <div className="float-group">
                      <input type="text" id="branch" className="float-input" placeholder=" " disabled
                        value={formData.branch} />
                      <label htmlFor="branch" className="float-label">Branch</label>
                    </div>
                  </div>
                </>
              )}

              {/* STEP 4: Risk Declaration */}
              {currentStep === 4 && (
                <>
                  <div className="kyc-form-header" style={{ marginBottom: 16 }}>
                    <h5 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: '#94a3b8', marginBottom: 12 }}>1. Investment Profile</h5>
                    {errors.investProfile && <div className="error-text" style={{marginBottom: 8}}>{errors.investProfile}</div>}
                  </div>
                  <div className="kyc-radio-group">
                    {['Conservative', 'Moderate', 'Aggressive'].map(type => (
                      <label key={type} className="radio-card">
                        <input type="radio" name="investProfile" value={type} 
                          checked={formData.investProfile === type}
                          onChange={(e) => handleChange('investProfile', e.target.value)} />
                        <div className="radio-content">
                          <div className="radio-circle" />
                          <span className="radio-label" style={{ fontSize: 13 }}>{type}</span>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="kyc-form-header" style={{ marginBottom: 16, marginTop: 24 }}>
                    <h5 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: '#94a3b8', marginBottom: 12 }}>2. Experience Level</h5>
                    {errors.expLevel && <div className="error-text" style={{marginBottom: 8}}>{errors.expLevel}</div>}
                  </div>
                  <div className="kyc-radio-group">
                    {['New to fixed-income', 'Some experience', 'Advanced'].map(type => (
                      <label key={type} className="radio-card">
                        <input type="radio" name="expLevel" value={type} 
                          checked={formData.expLevel === type}
                          onChange={(e) => handleChange('expLevel', e.target.value)} />
                        <div className="radio-content">
                          <div className="radio-circle" />
                          <span className="radio-label" style={{ fontSize: 13 }}>{type}</span>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="kyc-form-header" style={{ marginBottom: 16, marginTop: 24 }}>
                    <h5 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: '#94a3b8', marginBottom: 12 }}>3. Risk Acknowledgement</h5>
                    {errors.riskChecklist && <div className="error-text" style={{marginBottom: 8}}>{errors.riskChecklist}</div>}
                  </div>
                  <div className="kyc-checklist">
                    <label className={`check-item ${formData.risk1 ? 'checked' : ''} ${errors.riskChecklist && !formData.risk1 ? 'error' : ''}`}>
                      <input type="checkbox" hidden checked={formData.risk1} onChange={e => handleChange('risk1', e.target.checked)} />
                      <div className="check-box">
                        {formData.risk1 && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </div>
                      <div className="check-text">I understand that these investments are not guaranteed by any government body.</div>
                    </label>
                    <label className={`check-item ${formData.risk2 ? 'checked' : ''} ${errors.riskChecklist && !formData.risk2 ? 'error' : ''}`}>
                      <input type="checkbox" hidden checked={formData.risk2} onChange={e => handleChange('risk2', e.target.checked)} />
                      <div className="check-box">
                        {formData.risk2 && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </div>
                      <div className="check-text">I acknowledge that my invested capital is at risk in case of invoice default.</div>
                    </label>
                    <label className={`check-item ${formData.risk3 ? 'checked' : ''} ${errors.riskChecklist && !formData.risk3 ? 'error' : ''}`}>
                      <input type="checkbox" hidden checked={formData.risk3} onChange={e => handleChange('risk3', e.target.checked)} />
                      <div className="check-box">
                        {formData.risk3 && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </div>
                      <div className="check-text">I understand liquidity may depend strictly on invoice performance and settlement timelines.</div>
                    </label>
                  </div>

                  <div className="mandatory-check">
                    <label className="check-item" style={{ border: 'none', padding: 0, background: 'none' }}>
                      <input type="checkbox" hidden checked={formData.riskConfirm} onChange={e => handleChange('riskConfirm', e.target.checked)} />
                      <div className={`check-box ${formData.riskConfirm ? 'checked' : ''}`} style={formData.riskConfirm ? {background: '#0f766e', borderColor: '#0f766e', color: '#fff'} : {borderWidth: 2, borderColor: errors.riskConfirm ? '#ef4444' : '#cbd5e1'}}>
                        {formData.riskConfirm && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </div>
                      <div className="check-text" style={{ fontWeight: 600, color: errors.riskConfirm && !formData.riskConfirm ? '#ef4444' : '#0f172a' }}>I have read and understood the risks associated with invoice-backed investments.</div>
                    </label>
                  </div>
                </>
              )}

              {/* STEP 5: Review */}
              {currentStep === 5 && (
                <div className="summary-container">
                  {/* Profile Summary */}
                  <div className="summary-section">
                    <div className="summary-header">
                      <h4>1. Profile</h4>
                      <span className="edit-link" onClick={() => setCurrentStep(1)}>Edit</span>
                    </div>
                    <div className="summary-grid">
                      <div className="summary-item">
                        <span className="summary-label">Entity Type</span>
                        <span className="summary-value">{formData.entityType}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">{formData.entityType === 'Individual' ? 'Full Name' : 'Legal Entity Name'}</span>
                        <span className="summary-value">{formData.legalName || '—'}</span>
                      </div>
                      {formData.entityType !== 'Individual' && (
                        <div className="summary-item">
                          <span className="summary-label">Contact Person</span>
                          <span className="summary-value light">{formData.contactPerson || '—'}</span>
                        </div>
                      )}
                      <div className="summary-item">
                        <span className="summary-label">Mobile Number</span>
                        <span className="summary-value light">{formData.phone || '—'}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Email ID</span>
                        <span className="summary-value light">{formData.email || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Regulatory Summary */}
                  <div className="summary-section">
                    <div className="summary-header">
                      <h4>2. Regulatory</h4>
                      <span className="edit-link" onClick={() => setCurrentStep(2)}>Edit</span>
                    </div>
                    <div className="summary-grid">
                      <div className="summary-item">
                        <span className="summary-label">PAN Number</span>
                        <span className="summary-value">{formData.pan || '—'}</span>
                      </div>
                      {formData.entityType !== 'Individual' && (
                        <div className="summary-item">
                          <span className="summary-label">GSTIN</span>
                          <span className="summary-value light">{formData.gst || 'Not provided'}</span>
                        </div>
                      )}
                      {formData.entityType === 'NBFC' && (
                        <div className="summary-item">
                          <span className="summary-label">Registration Number</span>
                          <span className="summary-value">{formData.regNumber || '—'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bank Summary */}
                  <div className="summary-section">
                    <div className="summary-header">
                      <h4>3. Bank & Payout</h4>
                      <span className="edit-link" onClick={() => setCurrentStep(3)}>Edit</span>
                    </div>
                    <div className="summary-grid">
                      <div className="summary-item">
                        <span className="summary-label">Account Holder</span>
                        <span className="summary-value">{formData.accountName || '—'}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Account Number</span>
                        <span className="summary-value">{maskAccount(formData.accountNumber) || '—'}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">IFSC Code</span>
                        <span className="summary-value light">{formData.ifsc || '—'}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Account Type</span>
                        <span className="summary-value light" style={{textTransform: 'capitalize'}}>{formData.accountType || '—'}</span>
                      </div>
                      <div className="summary-item full-width">
                        <span className="summary-label">Auto-Debit e-Mandate</span>
                        <span className="summary-value">{formData.autoDebit ? 'Enabled ✓' : 'Disabled'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Risk Summary */}
                  <div className="summary-section">
                    <div className="summary-header">
                      <h4>4. Risk Declaration</h4>
                      <span className="edit-link" onClick={() => setCurrentStep(4)}>Edit</span>
                    </div>
                    <div className="summary-grid">
                      <div className="summary-item">
                        <span className="summary-label">Investment Profile</span>
                        <span className="summary-value">{formData.investProfile || '—'}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Experience Level</span>
                        <span className="summary-value light">{formData.expLevel || '—'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mandatory-check" style={{ marginTop: 0 }}>
                    <label className="check-item" style={{ border: 'none', padding: 0, background: 'none' }}>
                      <input type="checkbox" hidden checked={formData.finalConfirm} onChange={e => handleChange('finalConfirm', e.target.checked)} />
                      <div className={`check-box ${formData.finalConfirm ? 'checked' : ''}`} style={formData.finalConfirm ? {background: '#0f766e', borderColor: '#0f766e', color: '#fff'} : {borderWidth: 2, borderColor: errors.finalConfirm ? '#ef4444' : '#cbd5e1'}}>
                        {formData.finalConfirm && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </div>
                      <div className="check-text" style={{ fontWeight: 600, color: errors.finalConfirm && !formData.finalConfirm ? '#ef4444' : '#0f172a' }}>By clicking Confirm & submit, I certify that the above information is true and I agree to the platform terms.</div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="kyc-actions">
              <label style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569' }}>
                <input
                  type="checkbox"
                  checked={skipValidation}
                  onChange={(e) => setSkipValidation(e.target.checked)}
                />
                Dev mode: Skip required validations
              </label>
              <button className="btn-continue" onClick={handleNext}>
                {currentStep === 5 ? 'Confirm & submit' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
