import React from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const FeatureList = ({ title, features, color }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  if (!features || features.length === 0) {
    return (
      <div className="p-3 rounded-lg bg-gray-700/50">
        <p className="font-semibold text-gray-400">{title} (0)</p>
        <p className="text-sm text-gray-500 italic">No features in this category.</p>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg bg-gray-800/70 border border-gray-700/50">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center text-left">
        <p className="font-semibold" style={{ color }}>{title} ({features.length})</p>
        {isOpen ? <FiChevronUp /> : <FiChevronDown />}
      </button>
      {isOpen && (
        <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
          {features.map((feature, index) => (
            <li key={index}>{feature}</li>
          ))}
        </ul>
      )}
    </div>
  );
};


export default function AnalyticsChart({ analytics }) {
  const counts = analytics?.counts || { supported: 0, partial: 0, unsupported: 0, suggested: 0 };
  const { supportedFeatures, partialFeatures, unsupportedCode, recommendations } = analytics || {};

  const doughnutData = {
    labels: ['Supported', 'Partial', 'Unsupported', 'Suggested'],
    datasets: [
      {
        data: [counts.supported, counts.partial, counts.unsupported, counts.suggested],
        backgroundColor: ['#22c55e', '#f59e0b', '#ef4444', '#6366f1'],
        borderColor: '#111827',
        borderWidth: 2,
      },
    ],
  };

  const barData = {
    labels: ['Supported', 'Partial', 'Unsupported', 'Suggested'],
    datasets: [
      {
        label: 'Feature Compatibility',
        data: [counts.supported, counts.partial, counts.unsupported, counts.suggested],
        backgroundColor: ['#22c55e', '#f59e0b', '#ef4444', '#6366f1'],
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 800, easing: 'easeOutQuart' },
    plugins: {
      legend: { position: 'bottom', labels: { color: '#e5e7eb' } },
      title: { display: true, text: 'Feature Compatibility Overview', color: '#e5e7eb', font: { size: 16 } },
    },
    scales: {
      x: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } },
      y: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' }, beginAtZero: true },
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
        <h3 className="text-white font-semibold mb-4 text-center">Compatibility Breakdown</h3>
        <div className="h-64 relative">
          <Doughnut
            key={`doughnut-${counts.supported}-${counts.partial}-${counts.unsupported}-${counts.suggested}`}
            data={doughnutData}
            options={{ ...options, plugins: { ...options.plugins, title: { ...options.plugins.title, text: 'By Category' } } }}
          />
        </div>
      </div>
      <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
        <h3 className="text-white font-semibold mb-4 text-center">Feature Details</h3>
        <div className="space-y-2">
          <FeatureList title="Supported Features" features={supportedFeatures} color="#22c55e" />
          <FeatureList title="Partially Supported" features={partialFeatures} color="#f59e0b" />
          <FeatureList title="Unsupported Code" features={unsupportedCode} color="#ef4444" />
          <FeatureList title="Recommendations" features={recommendations} color="#6366f1" />
        </div>
      </div>
    </div>
  );
}