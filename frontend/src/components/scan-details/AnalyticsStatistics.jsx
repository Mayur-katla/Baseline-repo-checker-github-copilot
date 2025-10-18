import React from 'react';
import { FiPieChart, FiBarChart2 } from 'react-icons/fi';

const StatBar = ({ label, value, color }) => (
  <div className="mb-3">
    <div className="flex justify-between text-sm text-gray-300 mb-1">
      <span>{label}</span>
      <span className="font-mono text-white">{value}</span>
    </div>
    <div className="w-full h-2 bg-gray-700 rounded">
      <div className={`h-2 rounded ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  </div>
);

const AnalyticsStatistics = ({ counts }) => {
  const { supported = 0, partial = 0, unsupported = 0, suggested = 0 } = counts || {};

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 mt-8">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <FiBarChart2 className="mr-3 text-indigo-400" />
        Analytics Statistics
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <StatBar label="Supported" value={supported} color="bg-green-500" />
          <StatBar label="Partial" value={partial} color="bg-yellow-500" />
          <StatBar label="Unsupported" value={unsupported} color="bg-red-500" />
          <StatBar label="Suggested" value={suggested} color="bg-indigo-500" />
        </div>
        <div className="text-sm text-gray-300">
          <p className="mb-2 flex items-center"><FiPieChart className="mr-2 text-indigo-400"/>Live counts update during scanning.</p>
          <p>These metrics derive from detected features, config files, and rule-based recommendations.</p>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsStatistics;