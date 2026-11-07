import { useEffect, useRef, useState } from 'react';

const KPIS = [
  { id:'k1', emoji:'💰', target: 412.5, suffix:'M', prefix:'₹', label:'Total Funded',    delta:'+22.1%', up:true  },
  { id:'k2', emoji:'📄', target: 2341,  suffix:'',  prefix:'',  label:'Active Invoices', delta:'+8.4%',  up:true  },
  { id:'k3', emoji:'✅', target: 98.6,  suffix:'%', prefix:'',  label:'Repayment Rate',  delta:'+0.4%',  up:true  },
  { id:'k4', emoji:'⚡', target: 3.5,   suffix:'h', prefix:'',  label:'Avg Approval',    delta:'-15%',   up:false },
];

function useCountUp(target, duration = 1400) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now) => {
      const elapsed = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - elapsed, 4);
      setValue(parseFloat((target * ease).toFixed(
        String(target).includes('.') ? (String(target).split('.')[1] || '').length : 0
      )));
      if (elapsed < 1) rafRef.current = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => { rafRef.current = requestAnimationFrame(tick); }, 350);
    return () => { clearTimeout(timer); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return value;
}

function KpiCard({ kpi }) {
  const val = useCountUp(kpi.target);
  return (
    <div className={`kpi-card ${kpi.id}`}>
      <div className="kpi-top-bar" />
      <span className="kpi-icon">{kpi.emoji}</span>
      <div className="kpi-value">{kpi.prefix}{val}{kpi.suffix}</div>
      <div className="kpi-label">{kpi.label}</div>
      <div className={`kpi-delta ${kpi.up ? 'up' : 'down'}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          {kpi.up
            ? <polyline points="18 15 12 9 6 15"/>
            : <polyline points="6 9 12 15 18 9"/>}
        </svg>
        {kpi.delta}
      </div>
    </div>
  );
}

export default function KpiGrid() {
  return (
    <div className="kpi-grid">
      {KPIS.map(k => <KpiCard key={k.id} kpi={k} />)}
    </div>
  );
}
