import React from 'react';
import { hasNonZeroCounts } from '../../utils/visibility.js';
import { FiPieChart, FiBarChart2 } from 'react-icons/fi';

const StatBar = ({ label, value, color, onClick, tooltip }) => (
  <div className="mb-3">
    <div className="flex justify-between text-sm text-gray-300 mb-1">
      <button
        type="button"
        title={tooltip}
        onClick={onClick}
        className="text-left hover:text-white transition-colors"
      >
        {label}
      </button>
      <span className="font-mono text-white">{value}</span>
    </div>
    <div className="w-full h-2 bg-gray-700 rounded">
      <div className={`h-2 rounded ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  </div>
);

const AnalyticsStatistics = ({ counts }) => {
  const { supported = 0, partial = 0, unsupported = 0, suggested = 0 } = counts || {};

  if (!hasNonZeroCounts({ supported, partial, unsupported, suggested })) {
    return null;
  }

  const scrollTo = (id) => {
    try {
      const el = document.getElementById(id);
      if (el) {
        window.location.hash = `#${id}`;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch {}
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 mt-8 transition-all duration-300">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <FiBarChart2 className="mr-3 text-indigo-400" />
        Analytics Statistics
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <StatBar label="Supported" value={supported} color="bg-green-500" onClick={() => scrollTo('feature-list-supported')} tooltip="Feature fully compatible without changes." />
          <StatBar label="Partial" value={partial} color="bg-yellow-500" onClick={() => scrollTo('feature-list-partial')} tooltip="Feature works with minor modifications." />
          <StatBar label="Unsupported" value={unsupported} color="bg-red-500" onClick={() => scrollTo('feature-list-unsupported')} tooltip="Feature not supported; requires significant changes." />
          <StatBar label="Suggested" value={suggested} color="bg-indigo-500" onClick={() => scrollTo('feature-list-suggested')} tooltip="Recommended improvements for modern best practices." />
        </div>
        <div className="text-sm text-gray-300">
          <p className="mb-2 flex items-center"><FiPieChart className="mr-2 text-indigo-400"/>Live counts update during scanning.</p>
          <p>Click a metric to jump to the matching feature list; hover labels for quick definitions.</p>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsStatistics;
