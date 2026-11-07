const ACTIVITIES = [
  { color:'#6893e3', text: <><strong>INV-9021</strong> funded — ₹24.5L approved</>,  time:'5m ago'  },
  { color:'#9fb399', text: <><strong>Global Logistics</strong> repaid ₹12.2L</>,       time:'14m ago'  },
  { color:'#dcc9a3', text: <><strong>Vertex Capital</strong> joined the pool</>,       time:'45m ago' },
  { color:'#a7aab5', text: <><strong>INV-8834</strong> buyer confirmed PO</>,          time:'2h ago'  },
];

export default function ActivityFeed() {
  return (
    <div className="activity-panel">
      <div className="activity-header">Recent Activity</div>
      {ACTIVITIES.map((a, i) => (
        <div key={i} className="activity-item">
          <span className="activity-dot" style={{ background: a.color }} />
          <span className="activity-text">{a.text}</span>
          <span className="activity-time">{a.time}</span>
        </div>
      ))}
    </div>
  );
}
