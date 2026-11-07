import KpiGrid from './KpiGrid';
import LineChart from './LineChart';
import DonutChart from './DonutChart';
import ActivityFeed from './ActivityFeed';
import './Sidebar.css';

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

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="aside-label">Platform Metrics</div>
      <KpiGrid />
      
      <div className="metrics-bottom-row">
        <LineChart />
        <div className="donut-row">
          <DonutChart
            id="donut-sector"
            title="Sector Split"
            centerVal="6" centerLbl="Sectors"
            {...SECTOR_DONUT}
          />
          <DonutChart
            id="donut-risk"
            title="Risk Rating"
            centerVal="A+" centerLbl="Avg Grade"
            {...RISK_DONUT}
          />
        </div>
        <ActivityFeed />
      </div>
    </aside>
  );
}
