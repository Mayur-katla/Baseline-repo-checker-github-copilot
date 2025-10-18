import React from 'react';
import { FiLayers, FiGitBranch, FiFile, FiAlertCircle } from 'react-icons/fi';

const AnalysisCard = ({ icon, title, value, details }) => (
  <div className="bg-gray-700/30 p-4 rounded-lg">
    <div className="flex items-center mb-2">
      <div className="text-indigo-400 mr-3">{icon}</div>
      <h4 className="font-semibold text-white">{title}</h4>
    </div>
    <p className="text-2xl font-bold text-white ml-9">{value}</p>
    {details && <p className="text-xs text-gray-400 ml-9 mt-1">{details}</p>}
  </div>
);

const ArchitectureAnalysis = ({ data }) => {
  if (!data) return null;

  const {
    structure = 'N/A',
    pattern = 'N/A',
    modularization = 'N/A',
    codeQuality = { complexity: 0, lintErrors: 0 },
    configFiles = [],
  } = data;

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 mt-8">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <FiLayers className="mr-3 text-indigo-400" />
        Architecture Analysis
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <AnalysisCard icon={<FiGitBranch />} title="Repo Structure" value={structure} />
        <AnalysisCard icon={<FiLayers />} title="Design Pattern" value={pattern} />
        <AnalysisCard icon={<FiGitBranch />} title="Modularization" value={modularization} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold text-white mb-3">Code Quality Metrics</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <p className="text-gray-300">Cyclomatic Complexity</p>
              <p className="font-bold text-white">{codeQuality.complexity}</p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <p className="text-gray-300">Lint Errors</p>
              <p className="font-bold text-red-400">{codeQuality.lintErrors}</p>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="font-semibold text-white mb-3">Configuration Files</h3>
          <div className="flex flex-wrap gap-2">
            {configFiles.length > 0 ? (
              configFiles.map(file => (
                <span key={file} className="bg-gray-700/50 text-xs font-mono px-2 py-1 rounded">
                  <FiFile className="inline mr-1.5"/>{file}
                </span>
              ))
            ) : (
              <p className="text-sm text-gray-400">No config files detected.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArchitectureAnalysis;