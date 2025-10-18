export function csvEscape(val) {
  const v = val == null ? '' : String(val);
  if (/[",\n]/.test(v)) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

export function buildCsvCombined({ displayData = {}, compat = {}, analytics = {} }) {
  const rows = [];
  const addRow = (section, key, value) => rows.push([section, key, value]);

  const counts = analytics.counts || {};
  addRow('Analytics', 'Supported', counts.supported ?? 0);
  addRow('Analytics', 'Partial', counts.partial ?? 0);
  addRow('Analytics', 'Unsupported', counts.unsupported ?? 0);
  addRow('Analytics', 'Suggested', counts.suggested ?? 0);

  (compat.supportedFeatures || []).forEach(f => addRow('Compatibility-Supported', 'Feature', f));
  (compat.partialFeatures || []).forEach(f => addRow('Compatibility-Partial', 'Feature', f));
  (compat.unsupportedCode || []).forEach(i => addRow('Compatibility-Unsupported', 'Item', i));
  (compat.missingConfigs || []).forEach(i => addRow('Compatibility-MissingConfig', 'Config', i));
  (compat.recommendations || []).forEach(i => addRow('Compatibility-Recommendation', 'Action', i));

  const env = displayData.environment || {};
  (env.frameworks || []).forEach(f => addRow('Environment-Framework', f.name, f.version));
  (env.dependencies || []).forEach(d => addRow('Environment-Dependency', d.name, `${d.version} (${d.status || 'OK'})`));
  (env.recommendedUpgrades || []).forEach(u => addRow('Environment-Upgrade', u.package, `${u.from} -> ${u.to}`));

  const sp = displayData.securityAndPerformance || {};
  (sp.insecureApiCalls || []).forEach(i => addRow('Security', i.title, i.description));
  (sp.missingPolicies || []).forEach(i => addRow('Security', i.title, i.description));
  (sp.inefficientCode || []).forEach(i => addRow('Performance', i.title, i.description));
  (sp.largeAssets || []).forEach(i => addRow('Performance', i.title, i.description));
  (sp.bottlenecks || []).forEach(i => addRow('Performance', i.title, i.description));

  const arch = displayData.architecture || {};
  addRow('Architecture', 'Structure', arch.structure || '');
  addRow('Architecture', 'Pattern', arch.pattern || '');
  addRow('Architecture', 'Modularization', arch.modularization || '');
  (arch.configFiles || []).forEach(c => addRow('Architecture-Config', 'File', c));

  const summary = displayData.summaryLog || {};
  addRow('Summary', 'Duration', summary.duration || '');
  addRow('Summary', 'FilesIgnored', summary.filesIgnored ?? 0);
  addRow('Summary', 'AgentVersion', summary.agentVersion || '');
  addRow('Summary', 'ScanDate', summary.scanDate || '');
  (summary.errorLogs || displayData.logs || []).forEach(e => addRow('Summary-Error', 'Log', e));

  const header = ['Section', 'Key', 'Value'];
  const lines = [header, ...rows]
    .map(cols => cols.map(csvEscape).join(','))
    .join('\n');
  return lines;
}