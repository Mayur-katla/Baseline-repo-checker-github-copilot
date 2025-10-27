import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { hasMeaningfulValue } from '../../utils/visibility.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function CompatibilityStackedBar({ analytics }) {
  const counts = analytics?.counts || { supported: 0, partial: 0, unsupported: 0, suggested: 0 };

  const total = (counts.supported || 0) + (counts.partial || 0) + (counts.unsupported || 0) + (counts.suggested || 0);
  // Hide chart when there are zero valid data points
  if (!hasMeaningfulValue(total)) {
    return null;
  }

  const data = useMemo(() => ({
    labels: ['Compatibility Distribution'],
    datasets: [
      { label: 'Supported', data: [counts.supported], backgroundColor: '#22c55e', stack: 'compat' },
      { label: 'Partial', data: [counts.partial], backgroundColor: '#f59e0b', stack: 'compat' },
      { label: 'Unsupported', data: [counts.unsupported], backgroundColor: '#ef4444', stack: 'compat' },
      { label: 'Suggested', data: [counts.suggested], backgroundColor: '#6366f1', stack: 'compat' },
    ],
  }), [counts.supported, counts.partial, counts.unsupported, counts.suggested]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeOutQuart' },
    plugins: {
      legend: { position: 'bottom', labels: { color: '#4b5563' } },
      title: { display: true, text: 'Compatibility Distribution', color: '#111827', font: { size: 16 } },
    },
    scales: {
      x: { stacked: true, ticks: { color: '#6b7280' }, grid: { color: '#e5e7eb' } },
      y: { stacked: true, beginAtZero: true, ticks: { color: '#6b7280' }, grid: { color: '#e5e7eb' } },
    },
    onClick: (evt, elements) => {
      if (!elements || elements.length === 0) return;
      const datasetIndex = elements[0].datasetIndex;
      const labels = ['supported', 'partial', 'unsupported', 'suggested'];
      const id = `feature-list-${labels[datasetIndex]}`;
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  }), []);

  return (
    <div className="bg-white/80 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700/50 transition-all duration-300">
      <div className="h-56">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}