import React from 'react';
import { FiShield, FiZap, FiAlertOctagon, FiPackage, FiFastForward } from 'react-icons/fi';

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

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 mt-8">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <FiShield className="mr-3 text-indigo-400" />
        Security & Performance
      </h2>

      <div className="space-y-4">
        {insights.length > 0 ? (
          insights.map((item, index) => (
            <InsightItem
              key={index}
              icon={item.icon}
              title={item.title}
              description={item.description}
              severity={item.severity}
            />
          ))
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">No specific security or performance insights found.</p>
        )}
      </div>
    </div>
  );
};

export default SecurityAndPerformance;