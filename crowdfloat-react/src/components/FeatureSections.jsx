import KpiGrid from './KpiGrid';
import LineChart from './LineChart';
import DonutChart from './DonutChart';
import ActivityFeed from './ActivityFeed';
import './FeatureSections.css';
import './Sidebar.css'; // Required for all the inner dashboard components!

const SECTOR_DONUT = {
  labels: ['Mfg','Tech','Pharma','Agri','Logistics','Other'],
  data:   [35, 20, 15, 12, 10, 8],
  colors: ['#6893e3','#9fb399','#dcc9a3','#e8dcc4','#a7aab5','#dcdfe5'],
};
const RISK_DONUT = {
  labels: ['AAA','AA','A','BBB'],
  data:   [25, 45, 20, 10],
  colors: ['#6893e3','#dcc9a3','#a7aab5','#e8dcc4'],
};

export default function FeatureSections() {
  return (
    <div className="features-wrapper">
      
      {/* Feature 1: Core Metrics */}
      <section className="feature-row">
        <div className="feature-text pr-12">
          <div className="feature-eyebrow">Real-time Visibility</div>
          <h3 className="feature-heading">Unprecedented clarity into capital flow.</h3>
          <p className="feature-desc">Monitor live funding volumes, active invoices, and repayment rates across the entire CrowdFloat ecosystem. We provide industrial-grade transparency so our partners can fund with absolute confidence.</p>
        </div>
        <div className="feature-visual">
          <div className="mock-ui-container">
            <KpiGrid />
          </div>
        </div>
      </section>

      {/* Feature 2: Analytics & Trends */}
      <section className="feature-row reverse">
        <div className="feature-text pl-12">
          <div className="feature-eyebrow">Dynamic Analytics</div>
          <h3 className="feature-heading">Track growth and funding velocity.</h3>
          <p className="feature-desc">Our robust analytics engine maps historical funding volumes and visualizes trends. Make data-driven decisions on supply-chain credit deployment with real-time charting and reporting.</p>
        </div>
        <div className="feature-visual">
          <div className="mock-ui-container p-6">
            <LineChart />
          </div>
        </div>
      </section>

      {/* Feature 3: Risk & Activity */}
      <section className="feature-row">
        <div className="feature-text pr-12">
          <div className="feature-eyebrow">Risk Assessment</div>
          <h3 className="feature-heading">Granular sector intel and live updates.</h3>
          <p className="feature-desc">Diversify your exposure with deep sector splits and algorithmic risk grading. Stay informed instantly with our live activity feed capturing every invoice funded and PO confirmed.</p>
        </div>
        <div className="feature-visual">
          <div className="mock-ui-grid-2">
            <div className="mock-ui-container p-4">
              <DonutChart id="donut-sector-feat" title="Sector Split" centerVal="6" centerLbl="Sectors" {...SECTOR_DONUT} />
            </div>
            <div className="mock-ui-container p-4">
              <DonutChart id="donut-risk-feat" title="Risk Rating" centerVal="A+" centerLbl="Avg Grade" {...RISK_DONUT} />
            </div>
            <div className="mock-ui-container span-2 p-0">
              <ActivityFeed />
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
