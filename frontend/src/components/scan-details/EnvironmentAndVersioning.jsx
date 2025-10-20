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

function normalizeEnvironment(data = {}) {
  const engines = data.engines || {};
  const inv = Array.isArray(data.dependencyInventory) ? data.dependencyInventory : [];
  const primaries = Array.isArray(data.primaryFrameworks) ? data.primaryFrameworks : (Array.isArray(data.frameworks) ? data.frameworks.map(f => (typeof f === 'string' ? f : f?.name)) : []);
  const versionComp = data.versionCompatibility && typeof data.versionCompatibility === 'object' ? data.versionCompatibility : {};
  const upgradesRaw = Array.isArray(data.recommendedUpgrades) ? data.recommendedUpgrades : [];

  // Build frameworks with versions inferred from dependency inventory
  const nameMap = {
    'React': 'react',
    'Angular': 'angular',
    'Vue': 'vue',
    'Next.js': 'next',
    'Express': 'express',
  };
  const frameworks = primaries
    .filter(Boolean)
    .map((name) => {
      const pkgName = nameMap[name] || name.toLowerCase();
      const match = inv.find((d) => String(d.name).toLowerCase() === pkgName);
      const version = match?.version || '';
      return { name, version };
    });

  // Version compatibility flattening: only include mismatches
  const versionCompatibility = Object.entries(versionComp)
    .map(([name, info]) => ({ name, current: info?.current, latest: info?.latest }))
    .filter((v) => v.current && v.latest && v.current !== v.latest);

  // Dependencies from inventory with outdated badge
  const dependencies = inv.map((d) => {
    const vc = versionComp[d.name];
    const isOutdated = vc && vc.current && vc.latest && vc.current !== vc.latest;
    return {
      name: d.name,
      version: d.version,
      status: isOutdated ? 'Outdated' : 'OK',
    };
  });

  // Recommended upgrades mapping (support both {package,current,latest} and {from,to})
  const recommendedUpgrades = upgradesRaw.map((u) => ({
    package: u.package || u.name,
    from: u.from || u.current,
    to: u.to || u.latest,
  })).filter((u) => u.package && u.from && u.to && u.from !== u.to);

  // Vulnerabilities best-effort mapping (npm audit shape varies)
  const vulnerabilities = Array.isArray(data.securityVulnerabilities)
    ? data.securityVulnerabilities.map((v) => ({
        cve: v.cve || v.name || v.title || v.module || 'Package',
        severity: v.severity || v.cvssSeverity || 'Unknown',
        summary: v.summary || v.url || '',
      }))
    : (Array.isArray(data.vulnerabilities) ? data.vulnerabilities : []);

  // Runtime versions from engines
  const runtimeVersions = {
    node: engines.node || 'N/A',
    npm: engines.npm || 'N/A',
    yarn: engines.yarn || 'N/A',
  };

  return { frameworks, versionCompatibility, dependencies, recommendedUpgrades, vulnerabilities, runtimeVersions };
}

const EnvironmentAndVersioning = ({ data }) => {
  if (!data) return null;

  const { frameworks, versionCompatibility, dependencies, vulnerabilities, recommendedUpgrades, runtimeVersions } = normalizeEnvironment(data);
  const outdatedCount = versionCompatibility.length;
  const vulnCount = Array.isArray(vulnerabilities) ? vulnerabilities.length : 0;

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 mt-8">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <FiPackage className="mr-3 text-indigo-400" />
        Environment & Versioning
      </h2>

      {/* Runtime Versions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-black/20 rounded-lg p-4 border border-gray-700/30">
          <h3 className="font-semibold text-white mb-2">Node</h3>
          <p className="font-mono text-sm text-gray-200">{runtimeVersions.node}</p>
        </div>
        <div className="bg-black/20 rounded-lg p-4 border border-gray-700/30">
          <h3 className="font-semibold text-white mb-2">npm</h3>
          <p className="font-mono text-sm text-gray-200">{runtimeVersions.npm}</p>
        </div>
        <div className="bg-black/20 rounded-lg p-4 border border-gray-700/30">
          <h3 className="font-semibold text-white mb-2">Yarn</h3>
          <p className="font-mono text-sm text-gray-200">{runtimeVersions.yarn}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="font-semibold text-white mb-3">Frameworks & Runtimes</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            {frameworks.length > 0 ? (
              frameworks.map((f) => (
                <li key={f.name}>
                  {f.name} <span className="text-gray-500">{f.version || ''}</span>
                </li>
              ))
            ) : (
              <li>No frameworks detected.</li>
            )}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-white mb-3">Version Compatibility</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            {versionCompatibility.length > 0 ? (
              versionCompatibility.map((v) => (
                <li key={v.name}>
                  {v.name}: <span className="text-yellow-400">{v.current}</span> → <span className="text-green-400">{v.latest}</span>
                </li>
              ))
            ) : (
              <li>No compatibility issues detected.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Warnings summary */}
      <div className="mt-6 flex gap-4">
        <div className="flex items-center gap-2 bg-yellow-500/10 text-yellow-300 px-3 py-2 rounded border border-yellow-500/30">
          <FiAlertTriangle />
          <span className="text-sm">{outdatedCount} outdated packages</span>
        </div>
        <div className="flex items-center gap-2 bg-red-500/10 text-red-300 px-3 py-2 rounded border border-red-500/30">
          <FiShield />
          <span className="text-sm">{vulnCount} known vulnerabilities</span>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="font-semibold text-white mb-4">Dependencies</h3>
        <ul className="bg-black/20 rounded-lg p-4 max-h-60 overflow-y-auto">
          {dependencies.length > 0 ? (
            dependencies.map((dep) => (
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
            vulnerabilities.map((vuln, idx) => (
              <div key={`${vuln.cve}-${idx}`} className="text-sm border-b border-gray-700/50 py-2 last:border-b-0">
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
            recommendedUpgrades.map((up) => (
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