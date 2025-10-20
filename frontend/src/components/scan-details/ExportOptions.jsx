import React from 'react';
import { FiDownload, FiGitPullRequest, FiFileText } from 'react-icons/fi';

const ActionButton = ({ icon, text, onClick, disabled }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center justify-center w-full p-4 rounded-lg transition-all duration-200 ${disabled ? 'bg-gray-700/30 text-gray-400 cursor-not-allowed' : 'bg-gray-700/50 hover:bg-indigo-600/30 hover:text-indigo-300'}`}
  >
    {icon}
    <span className="ml-3 font-semibold">{text}</span>
  </button>
);

const ExportOptions = ({ onDownloadReport, onGeneratePR, onExportCSV, onExportPDF, isGeneratingPR = false }) => {
  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 mt-8">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <FiDownload className="mr-3 text-indigo-400" />
        Export Options
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ActionButton 
          icon={<FiDownload />} 
          text="Download Report"
          onClick={onDownloadReport} 
        />
        <ActionButton 
          icon={<FiFileText />} 
          text="Export CSV"
          onClick={onExportCSV}
        />
        <ActionButton 
          icon={<FiFileText />} 
          text="Print/Save PDF"
          onClick={onExportPDF}
        />
        <ActionButton 
          icon={<FiGitPullRequest />} 
          text={isGeneratingPR ? 'Generating PR…' : 'Generate PR'}
          onClick={onGeneratePR}
          disabled={isGeneratingPR}
        />
      </div>
    </div>
  );
};

export default ExportOptions;