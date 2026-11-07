import './Navbar.css';

export default function Navbar() {
  return (
    <nav className="navbar">
      <a href="#" className="nav-logo">
        <div className="logo-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <span className="logo-name">Crowd<span>Float</span></span>
      </a>

      <div className="nav-spacer" />

      <div className="nav-badge">
        <span className="nav-dot" />
        Live Platform
      </div>

      <button className="nav-btn" id="btn-help">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        Help
      </button>

    </nav>
  );
}
