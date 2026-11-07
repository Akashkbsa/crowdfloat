import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export default function LineChart() {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 110);
    grad.addColorStop(0, 'rgba(104, 147, 227, 0.25)'); // soft blue transparent
    grad.addColorStop(1, 'rgba(104, 147, 227, 0)');

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Wk1','Wk2','Wk3','Wk4','Wk5','Wk6','Wk7','Wk8'],
        datasets: [{
          label: 'Funded (₹ Cr)',
          data: [24.5, 28.1, 25.4, 34.2, 38.6, 42.1, 39.5, 46.8],
          fill: true,
          backgroundColor: grad,
          borderColor: '#6893e3', // soft blue
          borderWidth: 2,
          pointBackgroundColor: '#0a0a0a',
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.42,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderColor: 'rgba(0,0,0,0.1)',
            borderWidth: 1,
            padding: 8,
            bodyColor: '#0a0a0a',
            titleColor: '#555555',
            callbacks: { label: ctx => ` ₹${ctx.parsed.y} Cr` },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { color: '#555555', font: { size: 9, family: 'Inter' } },
          },
          y: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { color: '#555555', font: { size: 9, family: 'Inter' }, callback: v => '₹'+v },
            beginAtZero: true,
          },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, []);

  return (
    <div className="chart-panel">
      <div className="chart-header">
        <span className="chart-title">Funding Volume</span>
        <span className="chart-period">Last 8 weeks</span>
      </div>
      <div className="chart-wrap">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
