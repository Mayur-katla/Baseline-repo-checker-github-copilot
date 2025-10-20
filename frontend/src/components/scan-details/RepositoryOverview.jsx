import React from 'react';
import { FiBox, FiFileText, FiUser, FiGitMerge, FiCode, FiClock, FiHardDrive } from 'react-icons/fi';

const StatItem = ({ icon, label, value }) => (
  <div className="flex items-center text-sm text-gray-300">
    <div className="text-gray-400 mr-3">{icon}</div>
    <span className="font-semibold mr-2">{label}:</span>
    <span>{value}</span>
  </div>
);

const formatDateSafe = (input) => {
  if (!input || input === 'N/A') return 'N/A';
  try {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
  } catch {
    return 'N/A';
  }
};

const RepositoryOverview = ({ data }) => {
  if (!data) return null;

  const {
    repoName = 'N/A',
    description = 'No description available.',
    owner = 'N/A',
    license = 'N/A',
    totalFiles = 0,
    totalFolders = 0,
    totalLinesOfCode = 0,
    languages = {},
    projectSize = 0,
    createdDate = 'N/A',
    lastUpdatedDate = 'N/A',
  } = data;

  const formattedSize = (Number(projectSize) / (1024 * 1024)).toFixed(2) + ' MB';
  const languageEntries = Object.entries(languages || {}).sort(([, a], [, b]) => b - a);

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50">
      <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
        <FiBox className="mr-3 text-indigo-400" />
        Repository Overview
      </h2>
      
      <p className="text-gray-400 mb-6">{description}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        <StatItem icon={<FiFileText />} label="Repo Name" value={repoName} />
        <StatItem icon={<FiUser />} label="Owner" value={owner} />
        <StatItem icon={<FiGitMerge />} label="License" value={license} />
        <StatItem icon={<FiFileText />} label="Total Files" value={totalFiles} />
        <StatItem icon={<FiFileText />} label="Total Folders" value={totalFolders} />
        <StatItem icon={<FiCode />} label="Lines of Code" value={Number(totalLinesOfCode || 0).toLocaleString()} />
        <StatItem icon={<FiHardDrive />} label="Project Size" value={formattedSize} />
        <StatItem icon={<FiClock />} label="Created" value={formatDateSafe(createdDate)} />
        <StatItem icon={<FiClock />} label="Last Updated" value={formatDateSafe(lastUpdatedDate)} />
      </div>

      <div className="mt-6">
        <h3 className="font-semibold text-white mb-3">Languages Used</h3>
        <div className="flex flex-wrap gap-2">
          {languageEntries.length > 0 ? (
            languageEntries.map(([lang, count]) => (
              <span key={lang} className="bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                {lang} ({count})
              </span>
            ))
          ) : (
            <p className="text-sm text-gray-400">No language data.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RepositoryOverview;