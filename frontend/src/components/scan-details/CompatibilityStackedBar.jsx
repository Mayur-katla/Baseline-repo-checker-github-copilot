import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend, Title } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, Title);

function CompatibilityStackedBar({ analytics }) {
  const counts = analytics?.counts || { supported: 0, partial: 0, unsupported: 0 };

  const data = useMemo(() => ({
    labels: ['Compatibility'],
    datasets: [
      { label: 'Supported', data: [counts.supported], backgroundColor: '#22c55e' },
      { label: 'Partial', data: [counts.partial], backgroundColor: '#f59e0b' },
      { label: 'Unsupported', data: [counts.unsupported], backgroundColor: '#ef4444' },
    ],
  }), [counts.supported, counts.partial, counts.unsupported]);

  const options = useMemo(() => ({
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 800, easing: 'easeOutQuart' },
    plugins: {
      legend: { position: 'top', labels: { color: '#e5e7eb' } },
      title: { display: true, text: 'Feature Compatibility Distribution', color: '#e5e7eb', font: { size: 16 } },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.x !== null) {
              label += context.parsed.x;
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: { stacked: true, ticks: { color: '#9ca3af' }, grid: { color: '#374151' }, beginAtZero: true },
      y: { stacked: true, ticks: { display: false }, grid: { display: false } },
    },
    onClick: (evt, elements) => {
      if (!elements || !elements.length) return;
      const element = elements[0];
      const datasetIndex = element.datasetIndex;
      const label = data.datasets[datasetIndex]?.label;
      const map = { Supported: '#supported-features', Partial: '#partial-features', Unsupported: '#unsupported-features' };
      const target = map[label];
      if (target) {
        try {
          window.location.hash = target;
          const el = document.getElementById(target.substring(1));
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (_) {}
      }
    }
  }), [data.datasets]);

  return (
    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
      <h3 className="text-white font-semibold mb-4 text-center">Compatibility Distribution</h3>
      <div className="h-48 relative">
        <Bar key={`stacked-${counts.supported}-${counts.partial}-${counts.unsupported}`} data={data} options={options} />
      </div>
    </div>
  );
}
export default React.memo(CompatibilityStackedBar);