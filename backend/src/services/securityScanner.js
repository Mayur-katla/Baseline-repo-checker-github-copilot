const { spawn } = require('child_process');

function severityWeight(sev) {
  const s = String(sev || '').toLowerCase();
  if (s.includes('critical')) return 4;
  if (s.startsWith('high')) return 3;
  if (s.startsWith('medium')) return 2;
  if (s.startsWith('low')) return 1;
  return 0;
}

function summarizeVulnerabilities(secPerf = {}) {
  const list = Array.isArray(secPerf.securityVulnerabilities) ? secPerf.securityVulnerabilities : [];
  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  for (const v of list) {
    const sev = String(v.severity || 'Low').toLowerCase();
    if (sev.includes('critical')) counts.Critical += 1;
    else if (sev.startsWith('high')) counts.High += 1;
    else if (sev.startsWith('medium')) counts.Medium += 1;
    else counts.Low += 1;
  }
  const top = [...list].sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity)).slice(0, 50);
  return { counts, top };
}

function summarizeHygiene(secPerf = {}) {
  const insecure = Array.isArray(secPerf.insecureApiCalls) ? secPerf.insecureApiCalls : [];
  const missingPolicies = Array.isArray(secPerf.missingPolicies) ? secPerf.missingPolicies : [];
  const issues = [...insecure, ...missingPolicies];
  const counts = { High: 0, Medium: 0, Low: 0 };
  for (const i of issues) counts[i.severity || 'Low'] = (counts[i.severity || 'Low'] || 0) + 1;
  const top = [...issues].sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity)).slice(0, 50);
  return { counts, top };
}

function summarizeSecrets(secPerf = {}) {
  const secrets = Array.isArray(secPerf.secrets) ? secPerf.secrets : [];
  // Some repos store secrets findings inside vulnerabilities with a type marker
  const vulns = Array.isArray(secPerf.securityVulnerabilities) ? secPerf.securityVulnerabilities : [];
  const inferred = vulns.filter(v => /secret|credential|token|key/i.test(String(v.title || v.description || '')));
  const all = [...secrets, ...inferred];
  const counts = { High: 0, Medium: 0, Low: 0 };
  for (const i of all) counts[i.severity || 'Low'] = (counts[i.severity || 'Low'] || 0) + 1;
  const top = [...all].sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity)).slice(0, 50);
  return { counts, top };
}

function summarizeIaC(scan = {}) {
  const pf = scan.projectFeatures || {};
  const env = scan.environment || {};
  const hasTerraform = (pf.terraform || []).length > 0 || /terraform/i.test(JSON.stringify(pf));
  const hasK8s = (pf.kubernetes || []).length > 0 || /k8s|kubernetes|helm/i.test(JSON.stringify(pf));
  const hasDocker = (pf.docker || []).length > 0 || /docker|container/i.test(JSON.stringify(pf));
  const files = [];
  try {
    const arch = scan.architecture || {};
    const configs = arch.configFiles || [];
    for (const f of configs) files.push(f);
  } catch (_) {}
  return {
    hasTerraform,
    hasK8s,
    hasDocker,
    files: files.slice(0, 200)
  };
}

function runExternalTool(command, args = [], options = {}) {
  return new Promise((resolve) => {
    try {
      const proc = spawn(command, args, { cwd: options.cwd || process.cwd(), shell: process.platform === 'win32' });
      let out = '';
      let err = '';
      proc.stdout.on('data', (d) => { out += d.toString(); });
      proc.stderr.on('data', (d) => { err += d.toString(); });
      proc.on('error', (e) => resolve({ status: 'error', error: String(e.message || e), output: out, stderr: err }));
      proc.on('close', (code) => {
        resolve({ status: code === 0 ? 'ok' : 'failed', code, output: out, stderr: err });
      });
    } catch (e) {
      resolve({ status: 'error', error: String(e.message || e) });
    }
  });
}

function parseSemgrepJson(output) {
  try {
    const data = JSON.parse(String(output || '{}'));
    const results = Array.isArray(data.results) ? data.results : [];
    const bySeverity = { High: 0, Medium: 0, Low: 0 };
    const mapSev = (sev) => {
      const s = String(sev || '').toLowerCase();
      if (s.includes('error') || s.includes('high') || s.includes('critical')) return 'High';
      if (s.includes('warning') || s.includes('medium')) return 'Medium';
      return 'Low';
    };
    for (const r of results) {
      const sev = mapSev(r?.extra?.severity);
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
    }
    const top = results.slice(0, 100).map((r) => ({
      check_id: r?.check_id,
      path: r?.path,
      start: r?.start?.line,
      end: r?.end?.line,
      message: r?.extra?.message,
      severity: mapSev(r?.extra?.severity),
    }));
    return { findingsCount: results.length, bySeverity, results: top };
  } catch (e) {
    return { status: 'parse_error', error: String(e.message || e), raw: String(output || '') };
  }
}

function parseTrufflehogJson(output) {
  const lines = String(output || '').split(/\r?\n/).filter(Boolean);
  const items = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      items.push(obj);
    } catch (_) {
      // ignore non-JSON lines
    }
  }
  const count = items.length;
  const top = items.slice(0, 100).map((i) => ({
    detector: i?.DetectorName || i?.detector || i?.rule || 'unknown',
    path: i?.SourceMetadata?.Data?.filepath || i?.path || i?.File || '',
    verified: Boolean(i?.Verified || i?.verified),
  }));
  return { findingsCount: count, bySeverity: { High: count, Medium: 0, Low: 0 }, results: top };
}

module.exports = {
  summarizeVulnerabilities,
  summarizeHygiene,
  summarizeSecrets,
  summarizeIaC,
  runExternalTool,
  parseSemgrepJson,
  parseTrufflehogJson,
};