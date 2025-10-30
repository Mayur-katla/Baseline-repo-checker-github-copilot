export function buildMarkdownReport({ displayData = {}, compat = {}, analytics = {} }) {
  const lines = [];
  const counts = analytics.counts || {};
  const repo = displayData.repoDetails || {};
  const env = displayData.environment || {};
  const secPerf = displayData.securityAndPerformance || {};
  const arch = displayData.architecture || {};
  const health = displayData.healthAndMaintenance || {};

  lines.push(`# Baseline Scan Report`);
  lines.push('');
  lines.push(`- Repo: ${repo.repoName || 'N/A'} (${repo.owner || ''})`);
  lines.push(`- License: ${repo.license || 'N/A'}`);
  lines.push(`- Size: ${repo.size || 'N/A'}`);
  lines.push(`- Last Updated: ${repo.lastUpdated || 'N/A'}`);
  lines.push('');
  lines.push(`## Analytics`);
  lines.push(`- Supported: ${counts.supported ?? 0}`);
  lines.push(`- Partial: ${counts.partial ?? 0}`);
  lines.push(`- Unsupported: ${counts.unsupported ?? 0}`);
  lines.push(`- Suggested: ${counts.suggested ?? 0}`);
  lines.push('');
  lines.push(`## Compatibility Report`);
  lines.push('### Supported Features');
  (compat.supportedFeatures || []).forEach(f => lines.push(`- ${f}`));
  lines.push('');
  lines.push('### Partial Features');
  (compat.partialFeatures || []).forEach(f => lines.push(`- ${f}`));
  lines.push('');
  lines.push('### Unsupported/Deprecated Code');
  (compat.unsupportedCode || []).forEach(i => lines.push(`- ${i}`));
  lines.push('');
  lines.push('### Missing Configurations');
  (compat.missingConfigs || []).forEach(i => lines.push(`- ${i}`));
  lines.push('');
  lines.push('### Recommended Migrations');
  (compat.recommendations || []).forEach(i => lines.push(`- ${i}`));
  lines.push('');
  lines.push('## Environment & Versioning');
  lines.push('### Frameworks');
  (env.frameworks || []).forEach(f => lines.push(`- ${f.name} ${f.version}`));
  lines.push('### Dependencies');
  (env.dependencies || []).forEach(d => lines.push(`- ${d.name} ${d.version} (${d.status || 'OK'})`));
  lines.push('### Recommended Upgrades');
  (env.recommendedUpgrades || []).forEach(u => lines.push(`- ${u.package}: ${u.from} → ${u.to}`));
  lines.push('');
  lines.push('## Security & Performance');
  (secPerf.insecureApiCalls || []).forEach(i => lines.push(`- [Security] ${i.title}: ${i.description}`));
  (secPerf.missingPolicies || []).forEach(i => lines.push(`- [Security] ${i.title}: ${i.description}`));
  (secPerf.inefficientCode || []).forEach(i => lines.push(`- [Perf] ${i.title}: ${i.description}`));
  (secPerf.largeAssets || []).forEach(i => lines.push(`- [Perf] ${i.title}: ${i.description}`));
  (secPerf.bottlenecks || []).forEach(i => lines.push(`- [Perf] ${i.title}: ${i.description}`));
  lines.push('');
  lines.push('## Architecture');
  lines.push(`- Structure: ${arch.structure || 'N/A'}`);
  lines.push(`- Pattern: ${arch.pattern || 'N/A'}`);
  lines.push(`- Modularization: ${arch.modularization || 'N/A'}`);
  lines.push('### Config Files');
  (arch.configFiles || []).forEach(c => lines.push(`- ${c}`));
  lines.push('');
  lines.push('## Health & Maintenance');
  lines.push(`- Health Score: ${health.healthScore ?? 0}`);
  lines.push(`- Maintainability Index: ${health.maintainabilityIndex ?? 0}`);
  lines.push(`- Test Coverage: ${health.testCoverage ?? 0}%`);
  lines.push(`- Build Status: ${health.buildStatus || 'N/A'}`);
  lines.push(`- Contributors: ${health.contributors ?? 0}`);
  lines.push(`- Commit Frequency: ${health.commitFrequency || 'N/A'}`);
  lines.push('');
  lines.push('## Summary Log');
  const summary = displayData.summaryLog || {};
  lines.push(`- Duration: ${summary.duration || 'N/A'}`);
  lines.push(`- Files Ignored: ${summary.filesIgnored ?? 0}`);
  lines.push(`- Agent Version: ${summary.agentVersion || 'N/A'}`);
  lines.push(`- Scan Date: ${summary.scanDate || 'N/A'}`);
  if (summary.stats) {
    const s = summary.stats || {};
    if (typeof s.filesScanned === 'number') lines.push(`- Files Scanned: ${s.filesScanned}`);
    if (typeof s.filesAnalyzed === 'number') lines.push(`- Files Analyzed: ${s.filesAnalyzed}`);
    if (typeof s.issuesFound === 'number') lines.push(`- Issues Found: ${s.issuesFound}`);
  }
  if (summary.resourceUsage) {
    const r = summary.resourceUsage || {};
    const rss = r.memoryRSSMB != null ? `${r.memoryRSSMB}MB` : null;
    const heap = r.heapUsedMB != null ? `${r.heapUsedMB}MB` : null;
    const cpu = (r.cpuUserMs != null || r.cpuSystemMs != null)
      ? `user ${r.cpuUserMs ?? 0}ms / sys ${r.cpuSystemMs ?? 0}ms`
      : null;
    const parts = [rss && `RSS ${rss}`, heap && `Heap ${heap}`, cpu && `CPU ${cpu}`].filter(Boolean);
    if (parts.length) lines.push(`- Resource Usage: ${parts.join('; ')}`);
  }
  if (Array.isArray(summary.warnings) && summary.warnings.length > 0) {
    (summary.warnings || []).forEach(w => lines.push(`- Warning: ${w}`));
  }
  const timeline = (summary.logs || summary.errorLogs || displayData.logs || []);
  timeline.forEach(e => lines.push(`- LOG: ${e}`));

  return lines.join('\n');
}

export function downloadBlob(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildUnifiedDiff(suggestions = []) {
  const lines = [];
  suggestions.forEach((s, idx) => {
    const patch = typeof s.patch === 'string' ? s.patch.trim() : '';
    if (patch && patch.length > 0) {
      // If suggestion already provides a unified diff, append as-is
      lines.push(patch);
      if (!patch.endsWith('\n')) lines.push('');
      return;
    }

    // Fallback: construct a simplified diff from original/modified fields
    const file = s.file || `file-${idx}`;
    lines.push(`--- a/${file}`);
    lines.push(`+++ b/${file}`);
    lines.push(`@@`);
    String(s.original || '').split('\n').forEach(line => lines.push(`-${line}`));
    String(s.modified || '').split('\n').forEach(line => lines.push(`+${line}`));
    lines.push('');
  });
  return lines.join('\n');
}
