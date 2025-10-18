import React from 'react';
import { FiCheckCircle, FiXCircle, FiAlertTriangle, FiTool } from 'react-icons/fi';

const ReportItem = ({ icon, title, items, color }) => (
  <div className="bg-gray-800/20 p-4 rounded-lg">
    <h3 className={`font-semibold text-white mb-3 flex items-center text-${color}-400`}>
      {icon}
      {title}
    </h3>
    <ul className="space-y-2 text-sm">
      {items.length > 0 ? (
        items.map((item, index) => (
          <li key={index} className="bg-gray-700/30 p-3 rounded-lg flex items-start">
            <span className={`text-${color}-400 mr-3 mt-1`}>•</span>
            <span className="text-gray-300">{item}</span>
          </li>
        ))
      ) : (
        <p className="text-sm text-gray-400 italic">None detected.</p>
      )}
    </ul>
  </div>
);

const CompatibilityReport = ({ data }) => {
  if (!data) return null;

  const {
    supportedFeatures = [],
    unsupportedCode = [],
    missingConfigs = [],
    recommendations = [],
  } = data;

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 mt-8">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <FiTool className="mr-3 text-indigo-400" />
        Compatibility Report
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ReportItem 
          icon={<FiCheckCircle className="mr-2" />} 
          title="Supported Features"
          items={supportedFeatures}
          color="green"
        />
        <ReportItem 
          icon={<FiXCircle className="mr-2" />} 
          title="Unsupported/Deprecated Code"
          items={unsupportedCode}
          color="red"
        />
        <ReportItem 
          icon={<FiAlertTriangle className="mr-2" />} 
          title="Missing Configurations"
          items={missingConfigs}
          color="yellow"
        />
        <ReportItem 
          icon={<FiTool className="mr-2" />} 
          title="Recommended Migrations"
          items={recommendations}
          color="indigo"
        />
      </div>
    </div>
  );
};

export default CompatibilityReport;