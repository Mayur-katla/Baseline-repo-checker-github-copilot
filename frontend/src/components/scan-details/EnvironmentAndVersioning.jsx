import React from 'react';
import { FiPackage, FiGitPullRequest, FiAlertTriangle, FiShield } from 'react-icons/fi';

const ListItem = ({ icon, text, value, badge, badgeColor }) => (
  <li className="flex justify-between items-center py-2 border-b border-gray-700/50">
    <div className="flex items-center">
      <div className="text-gray-400 mr-3">{icon}</div>
      <span className="text-gray-300">{text}</span>
    </div>
    <div className="flex items-center">
      <span className="font-mono text-sm text-white mr-3">{value}</span>
      {badge && <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>}
    </div>
  </li>
);

const EnvironmentAndVersioning = ({ data }) => {
  if (!data) return null;

  const {
    frameworks = [],
    versionCompatibility = [],
    dependencies = [],
    vulnerabilities = [],
    recommendedUpgrades = [],
  } = data;

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 mt-8">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <FiPackage className="mr-3 text-indigo-400" />
        Environment & Versioning
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="font-semibold text-white mb-3">Frameworks & Runtimes</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            {frameworks.length > 0 ? frameworks.map(f => <li key={f.name}>{f.name} <span className="text-gray-500">{f.version}</span></li>) : <li>No frameworks detected.</li>}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-white mb-3">Version Compatibility</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            {versionCompatibility.length > 0 ? versionCompatibility.map(v => <li key={v.name}>{v.name}: <span className="text-gray-500">{v.version}</span></li>) : <li>No compatibility info.</li>}
          </ul>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="font-semibold text-white mb-4">Dependencies</h3>
        <ul className="bg-black/20 rounded-lg p-4 max-h-60 overflow-y-auto">
          {dependencies.length > 0 ? (
            dependencies.map(dep => (
              <ListItem
                key={dep.name}
                icon={<FiPackage />}
                text={dep.name}
                value={dep.version}
                badge={dep.status}
                badgeColor={dep.status === 'Outdated' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}
              />
            ))
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No dependencies found.</p>
          )}
        </ul>
      </div>

      <div className="mt-8">
        <h3 className="font-semibold text-white mb-4 flex items-center"><FiAlertTriangle className="mr-2 text-red-400"/>Security Vulnerabilities</h3>
        <div className="bg-black/20 rounded-lg p-4">
          {vulnerabilities.length > 0 ? (
            vulnerabilities.map(vuln => (
              <div key={vuln.cve} className="text-sm border-b border-gray-700/50 py-2 last:border-b-0">
                <p className="text-red-300 font-semibold">{vuln.cve} ({vuln.severity})</p>
                <p className="text-gray-400">{vuln.summary}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400">No vulnerabilities found.</p>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="font-semibold text-white mb-4 flex items-center"><FiGitPullRequest className="mr-2 text-green-400"/>Recommended Upgrades</h3>
        <ul className="space-y-2">
          {recommendedUpgrades.length > 0 ? (
            recommendedUpgrades.map(up => (
              <li key={up.package} className="text-sm text-gray-300 bg-gray-700/30 p-3 rounded-lg">
                Upgrade <span className="font-semibold text-white">{up.package}</span> from <span className="text-yellow-400">{up.from}</span> to <span className="text-green-400">{up.to}</span>
              </li>
            ))
          ) : (
            <p className="text-sm text-gray-400">All packages are up-to-date.</p>
          )}
        </ul>
      </div>
    </div>
  );
};

export default EnvironmentAndVersioning;