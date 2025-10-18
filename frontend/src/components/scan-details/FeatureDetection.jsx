import React from 'react';
import { FiCpu, FiDatabase, FiLayout, FiTerminal, FiCheckSquare, FiGitMerge } from 'react-icons/fi';

const FeatureItem = ({ icon, label, value }) => (
  <div className="bg-gray-700/30 p-4 rounded-lg flex items-center">
    <div className="text-indigo-400 mr-4">{icon}</div>
    <div>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  </div>
);

const FeatureDetection = ({ data }) => {
  if (!data) return null;

  const {
    authentication = [],
    database = [],
    uiFrameworks = [],
    apiLayer = [],
    testingFrameworks = [],
    cicd = [],
  } = data;

  const authSystem = Array.isArray(authentication) ? (authentication.length ? authentication.join(', ') : 'None') : (authentication || 'None');
  const databaseStr = Array.isArray(database) ? (database.length ? database.join(', ') : 'None') : (database || 'None');
  const apiLayerStr = Array.isArray(apiLayer) ? (apiLayer.length ? apiLayer.join(', ') : 'None') : (apiLayer || 'None');

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 mt-8">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <FiCpu className="mr-3 text-indigo-400" />
        Feature Detection
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <FeatureItem icon={<FiCheckSquare />} label="Authentication" value={authSystem} />
        <FeatureItem icon={<FiDatabase />} label="Database" value={databaseStr} />
        <FeatureItem icon={<FiLayout />} label="UI Frameworks" value={uiFrameworks.join(', ') || 'None'} />
        <FeatureItem icon={<FiTerminal />} label="API Layer" value={apiLayerStr} />
        <FeatureItem icon={<FiCheckSquare />} label="Testing" value={testingFrameworks.join(', ') || 'None'} />
        <FeatureItem icon={<FiGitMerge />} label="CI/CD" value={(Array.isArray(cicd) ? (cicd.length ? cicd.join(', ') : 'None') : (cicd || 'None'))} />
      </div>
    </div>
  );
};

export default FeatureDetection;