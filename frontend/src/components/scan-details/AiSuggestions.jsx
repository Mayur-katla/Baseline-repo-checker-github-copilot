import React from 'react';
import { FiCpu, FiGitPullRequest, FiPackage, FiTool } from 'react-icons/fi';

const SuggestionCard = ({ icon, title, items, cta, onCtaClick }) => (
  <div className="bg-gray-700/30 p-5 rounded-lg">
    <h3 className="font-semibold text-white mb-3 flex items-center">
      {icon}
      {title}
    </h3>
    <ul className="space-y-2 text-sm text-gray-300 mb-4">
      {items.length > 0 ? (
        items.map((item, index) => <li key={index}>- {item}</li>)
      ) : (
        <li className="italic">No suggestions in this category.</li>
      )}
    </ul>
    {cta && (
      <button 
        onClick={onCtaClick}
        className="w-full text-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-lg hover:bg-indigo-700 transition-colors"
      >
        {cta}
      </button>
    )}
  </div>
);

const AiSuggestions = ({ data }) => {
  if (!data) return null;

  const {
    modernization = [],
    autoPR = [],
    simplification = [],
    removals = [],
    autoFix = [],
  } = data;

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 mt-8">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <FiCpu className="mr-3 text-indigo-400" />
        AI Suggestions / Autopilot
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SuggestionCard 
          icon={<FiGitPullRequest className="mr-2"/>} 
          title="Modernization Suggestions"
          items={modernization}
        />
        <SuggestionCard 
          icon={<FiGitPullRequest className="mr-2"/>} 
          title="Auto-PR Candidates"
          items={autoPR}
          cta="Generate Pull Requests"
        />
        <SuggestionCard 
          icon={<FiTool className="mr-2"/>} 
          title="Code Simplification Tips"
          items={simplification}
        />
        <SuggestionCard 
          icon={<FiPackage className="mr-2"/>} 
          title="Unnecessary Dependencies"
          items={removals}
          cta="Remove Dependencies"
        />
        <div className="md:col-span-2">
          <SuggestionCard 
            icon={<FiTool className="mr-2"/>} 
            title="Auto-fix Commands"
            items={autoFix.map(cmd => <code className="text-indigo-300 bg-black/30 px-1.5 py-1 rounded">{cmd}</code>)}
            cta="Run Auto-fixes"
          />
        </div>
      </div>
    </div>
  );
};

export default AiSuggestions;