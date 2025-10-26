import React from 'react';
import { FiHeart, FiTrendingUp, FiCheck, FiUsers } from 'react-icons/fi';

const ScoreGauge = ({ score }) => {
  const getScoreColor = () => {
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg className="w-full h-full" viewBox="0 0 36 36">
        <path
          className="text-gray-700"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className={getScoreColor()}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={`${score}, 100`}
        />
      </svg>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl font-bold text-white">
        {score}
      </div>
    </div>
  );
};

const HealthAndMaintenance = ({ data }) => {
  if (!data) return null;

  const {
    healthScore = 0,
    maintainabilityIndex = 0,
    testCoverage = 0,
    buildStatus = 'N/A',
    contributors = 0,
    commitFrequency = 'N/A',
  } = data;

  return (
    <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-200 dark:border-gray-700/50 mt-8">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <FiHeart className="mr-3 text-indigo-400" />
        Health & Maintenance
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div>
          <h3 className="text-center font-semibold text-white mb-4">Code Health Score</h3>
          <ScoreGauge score={healthScore} />
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-300 flex items-center"><FiTrendingUp className="mr-2"/>Maintainability Index</span>
            <span className="font-bold text-white">{maintainabilityIndex}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-300 flex items-center"><FiCheck className="mr-2"/>Test Coverage</span>
            <span className="font-bold text-white">{testCoverage}%</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-300 flex items-center"><FiCheck className="mr-2"/>Build Status</span>
            <span className={`font-bold ${buildStatus === 'Passing' ? 'text-green-400' : 'text-red-400'}`}>{buildStatus}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-300 flex items-center"><FiUsers className="mr-2"/>Active Contributors</span>
            <span className="font-bold text-white">{contributors}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-300 flex items-center"><FiTrendingUp className="mr-2"/>Commit Frequency</span>
            <span className="font-bold text-white">{commitFrequency}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthAndMaintenance;