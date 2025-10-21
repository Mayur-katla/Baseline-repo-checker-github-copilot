const fs = require('fs').promises;
const path = require('path');
const { walkFiles } = require('./repoAnalyzer.js');

async function scanCiWorkflows(repoPath) {
  const findings = [];
  try {
    const ymlFiles = await walkFiles(repoPath, { includeHidden: true, extensions: ['.yml', '.yaml'] });
    const wfFiles = ymlFiles.filter(rel => /(^|\/|\\)\.github(\/|\\)workflows(\/|\\)/.test(rel));
    for (const rel of wfFiles) {
      const abs = path.join(repoPath, rel);
      let content = '';
      try { content = await fs.readFile(abs, 'utf8'); } catch { continue; }
      const lower = content.toLowerCase();
      const fileName = path.basename(rel);

      if (/\bon\s*:\s*[\s\S]*pull_request_target\b/m.test(lower)) {
        findings.push({ type: 'GitHub Actions', title: 'Workflow triggered by pull_request_target', severity: 'High', file: fileName, description: 'pull_request_target runs with elevated permissions; prefer pull_request with least privileges.' });
      }

      const hasPermissions = /\n\s*permissions\s*:/i.test(content);
      if (!hasPermissions) {
        findings.push({ type: 'GitHub Actions', title: 'Missing explicit permissions for GITHUB_TOKEN', severity: 'Medium', file: fileName, description: 'Define permissions: at workflow/job level to enforce least privilege.' });
      }

      if (/runs-on\s*:\s*self-hosted/i.test(content)) {
        findings.push({ type: 'GitHub Actions', title: 'Self-hosted runner used', severity: 'Medium', file: fileName, description: 'Ensure self-hosted runners are trusted and hardened.' });
      }

      const usesMatches = content.match(/uses\s*:\s*([^\s]+)@([^\s]+)/ig) || [];
      for (const m of usesMatches) {
        const [, action, ver] = m.match(/uses\s*:\s*([^\s]+)@([^\s]+)/i) || [];
        if (!action || !ver) continue;
        const isSha = /^[0-9a-f]{7,40}$/i.test(ver);
        if (!isSha) {
          findings.push({ type: 'GitHub Actions', title: 'Unpinned action version', severity: 'Medium', file: fileName, description: `Action ${action}@${ver} not pinned to commit SHA.` });
        }
      }

      const hasCheckout = /uses\s*:\s*actions\/checkout@/i.test(content);
      const hasPersistFalse = /persist-credentials\s*:\s*false/i.test(content);
      if (hasCheckout && !hasPersistFalse) {
        findings.push({ type: 'GitHub Actions', title: 'Checkout persists credentials', severity: 'Medium', file: fileName, description: 'Set with: persist-credentials: false to avoid leaking GITHUB_TOKEN.' });
      }
    }
  } catch (_) {}
  return findings;
}

module.exports = { scanCiWorkflows };