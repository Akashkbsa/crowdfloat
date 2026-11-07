import { useRef } from 'react';
import './RoleCards.css';

const ROLES = [
  {
    id: 'company',
    label: 'Company',
    desc: 'Upload invoices, track financing requests, and manage your working capital with real-time visibility into approvals and disbursements.',
    tags: ['Invoice Upload', 'Working Capital', 'MSME'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
        <line x1="12" y1="12" x2="12" y2="16"/>
        <line x1="10" y1="14" x2="14" y2="14"/>
      </svg>
    ),
  },
  {
    id: 'funder',
    label: 'Funder',
    desc: 'Browse verified invoice pools, deploy capital with precision, and monitor returns with granular risk scoring and portfolio analytics.',
    tags: ['Capital Deployment', 'Risk Analytics', 'Portfolio'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    id: 'buyer',
    label: 'Buyer',
    desc: 'Confirm purchase orders, extend payment terms, and strengthen your supply chain with dynamic discounting and early settlement options.',
    tags: ['Payment Terms', 'Supply Chain', 'Discounting'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
];

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

function RoleCard({ role, index, onSelectRole }) {
  const cardRef = useRef(null);

  const handleClick = (e) => {
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.4;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
    card.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
    
    if (onSelectRole) {
      setTimeout(() => onSelectRole(role.id), 250);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`role-card role-card--${role.id}`}
      id={`card-${role.id}`}
      tabIndex={0}
      role="button"
      aria-label={`Enter as ${role.label}`}
      onClick={handleClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleClick(e); }}
      style={{ animationDelay: `${index * 0.12}s` }}
    >
      <div className="card-icon">{role.icon}</div>
      <div className="card-body">
        <div className="card-label">{role.label}</div>
        <div className="card-desc">{role.desc}</div>
      </div>
      <div className="card-tags">
        {role.tags.map(t => <span key={t} className="tag">{t}</span>)}
      </div>
      <div className="card-cta">
        <span className="card-cta-text">Enter Portal →</span>
        <div className="card-arrow"><ArrowIcon /></div>
      </div>
    </div>
  );
}

export default function RoleCards({ onSelectRole }) {
  return (
    <div className="role-cards">
      {ROLES.map((role, i) => <RoleCard key={role.id} role={role} index={i} onSelectRole={onSelectRole} />)}
    </div>
  );
}
