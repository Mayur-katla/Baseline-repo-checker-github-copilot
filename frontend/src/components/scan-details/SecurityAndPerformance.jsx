import React, { useState, useEffect } from 'react';
import { FiShield, FiZap, FiAlertOctagon, FiPackage, FiFastForward, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const InsightItem = ({ icon, title, description, severity }) => {
  const severityClasses = {
    High: 'border-red-500/50 text-red-300',
    Medium: 'border-yellow-500/50 text-yellow-300',
    Low: 'border-blue-500/50 text-blue-300',
  };

  return (
    <div className={`bg-gray-700/30 p-4 rounded-lg border-l-4 ${severityClasses[severity]}`}>
      <div className="flex items-center mb-1">
        <div className="mr-3">{icon}</div>
        <h4 className="font-semibold text-white">{title}</h4>
      </div>
      <p className="text-sm text-gray-400 ml-9">{description}</p>
    </div>
  );
};

const SecurityAndPerformance = ({ data }) => {
  if (!data) return null;

  const {
    insecureApiCalls = [],
    missingPolicies = [],
    inefficientCode = [],
    largeAssets = [],
    bottlenecks = [],
  } = data;

  const insights = [
    ...insecureApiCalls.map(i => ({ ...i, icon: <FiAlertOctagon />, type: 'Security' })),
    ...missingPolicies.map(i => ({ ...i, icon: <FiShield />, type: 'Security' })),
    ...inefficientCode.map(i => ({ ...i, icon: <FiZap />, type: 'Performance' })),
    ...largeAssets.map(i => ({ ...i, icon: <FiPackage />, type: 'Performance' })),
    ...bottlenecks.map(i => ({ ...i, icon: <FiFastForward />, type: 'Performance' })),
  ];

  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex((i) => (insights.length ? Math.min(i, insights.length - 1) : 0));
  }, [insights.length]);

  return (
    <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-200 dark:border-gray-700/50 mt-8">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <FiShield className="mr-3 text-indigo-400" />
        Security & Performance
      </h2>

      <div className="space-y-4">
        {insights.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setIndex((index - 1 + insights.length) % insights.length)}
                className="p-2 rounded-lg bg-gray-700/40 hover:bg-gray-700/60 text-gray-200"
                aria-label="Previous insight"
              >
                <FiChevronLeft />
              </button>
              <span className="text-sm text-gray-400">{index + 1} / {insights.length}</span>
              <button
                onClick={() => setIndex((index + 1) % insights.length)}
                className="p-2 rounded-lg bg-gray-700/40 hover:bg-gray-700/60 text-gray-200"
                aria-label="Next insight"
              >
                <FiChevronRight />
              </button>
            </div>
            {(() => {
              const item = insights[index];
              return (
                <InsightItem
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                  severity={item.severity}
                />
              );
            })()}
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">No specific security or performance insights found.</p>
        )}
      </div>
    </div>
  );
};

export default SecurityAndPerformance;