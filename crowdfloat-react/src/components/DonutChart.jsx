import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export default function DonutChart({ id, labels, data, colors, centerVal, centerLbl, title }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    chartRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data, backgroundColor: colors,
          borderWidth: 0, hoverOffset: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderColor: 'rgba(0,0,0,0.1)',
            borderWidth: 1, padding: 7,
            bodyColor: '#0a0a0a', titleColor: '#555555',
            callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}%` },
          },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, []);

  return (
    <div className="donut-panel">
      <div className="donut-title">{title}</div>
      <div className="donut-wrap">
        <canvas ref={canvasRef} id={id} />
        <div className="donut-center">
          <span className="donut-center-val">{centerVal}</span>
          <span className="donut-center-lbl">{centerLbl}</span>
        </div>
      </div>
    </div>
  );
}
