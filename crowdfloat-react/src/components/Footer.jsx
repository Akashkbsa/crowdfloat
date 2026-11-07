import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer-wrap">
      <div className="footer-content">
        <div className="footer-brand">
          <div className="footer-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            CrowdFloat
          </div>
          <p className="footer-desc">Premium invoice financing and supply-chain credit for modern MSMEs.</p>
        </div>
        
        <div className="footer-links">
          <div className="link-col">
            <h4>Platform</h4>
            <a href="#">Company Portal</a>
            <a href="#">Funder Portal</a>
            <a href="#">Buyer Portal</a>
          </div>
          <div className="link-col">
            <h4>Resources</h4>
            <a href="#">Documentation</a>
            <a href="#">API Reference</a>
            <a href="#">Help Center</a>
          </div>
          <div className="link-col">
            <h4>Company</h4>
            <a href="#">About Us</a>
            <a href="#">Careers</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>&copy; {new Date().getFullYear()} CrowdFloat. All rights reserved.</span>
        <div className="footer-legal">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
}
