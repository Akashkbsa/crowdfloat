import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../utils/api';
import './CompanyLogin.css';

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
  return /^[0-9]{10}$/.test(value);
}

export default function CompanyLogin({ onBack, onSuccess, onSwitchToSignup }) {
  const [loginMode, setLoginMode] = useState('email');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!otpSent || resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((prev) => prev - 1), 1000);
    return () => clearTimeout(id);
  }, [otpSent, resendIn]);

  const maskedDestination = useMemo(() => {
    const raw = identifier.trim();
    if (!raw) return '';

    if (loginMode === 'phone') {
      return raw.length >= 4 ? `+91 ******${raw.slice(-4)}` : raw;
    }

    const [left, domain] = raw.split('@');
    if (!left || !domain) return raw;
    const visible = left.length <= 2 ? left[0] || '*' : `${left.slice(0, 2)}***`;
    return `${visible}@${domain}`;
  }, [identifier, loginMode]);

  const sendOtp = async () => {
    const input = identifier.trim();

    if (loginMode === 'email' && !isValidEmail(input)) {
      setError('Enter a valid business email address.');
      return;
    }

    if (loginMode === 'phone' && !isValidPhone(input)) {
      setError('Enter a valid 10-digit phone number.');
      return;
    }

    setError('');
    setIsSending(true);

    try {
      if (loginMode === 'email') {
        const res = await fetch(`${API_BASE_URL}/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: input }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to send OTP');
      }
      
      setOtpSent(true);
      setResendIn(30);
    } catch (err) {
      setError(err.message || 'Error sending OTP via email.');
    } finally {
      setIsSending(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.trim().length !== 6) {
      setError('Enter the 6-digit OTP.');
      return;
    }

    setError('');
    setIsVerifying(true);

    try {
      if (loginMode === 'email') {
        const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: identifier.trim(), otp: otp.trim() }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Invalid OTP');
      } else {
        // Phone OTP fallback logic
        if (otp !== '123456') throw new Error('Invalid OTP. Use 123456 for now.');
      }
      
      onSuccess(`LOGIN-${Date.now()}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const resetFlow = () => {
    setOtpSent(false);
    setOtp('');
    setError('');
    setResendIn(0);
  };

  return (
    <div className="company-login-page">
      <div className="company-login-wrap">
        <button className="company-login-back" onClick={onBack}>Return to Company Access</button>
        <div className="company-login-badge">Secure Company Access</div>
        <h1 className="company-login-title">Existing User Login</h1>
        <p className="company-login-sub">Sign in with OTP using your registered business email or mobile number.</p>

        <div className="company-login-mode">
          <button
            className={`mode-btn ${loginMode === 'email' ? 'active' : ''}`}
            onClick={() => {
              setLoginMode('email');
              setIdentifier('');
              resetFlow();
            }}
            type="button"
          >
            Email OTP
          </button>
          <button
            className={`mode-btn ${loginMode === 'phone' ? 'active' : ''}`}
            onClick={() => {
              setLoginMode('phone');
              setIdentifier('');
              resetFlow();
            }}
            type="button"
          >
            Phone OTP
          </button>
        </div>

        {error && <div className="company-login-error">{error}</div>}

        {!otpSent ? (
          <>
            <div className="company-login-field">
              <label>{loginMode === 'email' ? 'Business Email' : 'Mobile Number'}</label>
              <input
                type="text"
                value={identifier}
                placeholder={loginMode === 'email' ? 'name@company.com' : '9876543210'}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <div className="company-login-actions">
              <button className="company-login-btn" onClick={sendOtp} disabled={isSending}>
                {isSending ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </div>
            <p className="company-auth-switch">
              New user?{' '}
              <button type="button" className="company-auth-link" onClick={onSwitchToSignup}>
                Create account
              </button>
            </p>
          </>
        ) : (
          <>
            <div className="company-login-hint">
              OTP sent to <strong>{maskedDestination}</strong>.{' '}
              {loginMode === 'phone' && (<span>Demo OTP: <strong>123456</strong></span>)}
            </div>
            <div className="company-login-field">
              <label>Enter OTP</label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                placeholder="6-digit OTP"
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>
            <div className="company-login-actions">
              <button className="company-login-btn" onClick={verifyOtp} disabled={isVerifying}>
                {isVerifying ? 'Verifying...' : 'Verify & Login'}
              </button>
              <button className="company-login-btn alt" onClick={resetFlow}>
                Change Email/Phone
              </button>
              <button className="company-login-btn alt" onClick={sendOtp} disabled={resendIn > 0}>
                {resendIn > 0 ? `Resend OTP in ${resendIn}s` : 'Resend OTP'}
              </button>
            </div>
            <p className="company-auth-switch">
              New user?{' '}
              <button type="button" className="company-auth-link" onClick={onSwitchToSignup}>
                Create account
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
