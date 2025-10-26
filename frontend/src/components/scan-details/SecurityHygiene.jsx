import React, { useState, useMemo } from 'react';
import { FiShield, FiCheckCircle, FiCopy, FiCode } from 'react-icons/fi';
import { SeverityBadge } from './VulnerabilityList.jsx';
import { applyScanChanges } from '../../api/scans.js'

const severityColor = (sev = 'Low') => {
  switch (sev) {
    case 'High': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'Medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    default: return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  }
};

const severityWeight = (sev = 'Low') => (sev === 'High' ? 3 : sev === 'Medium' ? 2 : 1);

const SnippetBlock = ({ title, code }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 bg-gray-100 dark:bg-black/50 rounded-lg border border-gray-300 dark:border-gray-700">
      <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-400">
        <span className="flex items-center"><FiCode className="mr-2" />{title}</span>
        <button
          onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (_) {} }}
          className="px-2 py-1 rounded text-xs bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
        >
          {copied ? 'Copied' : (<span className="flex items-center"><FiCopy className="mr-1" />Copy</span>)}
        </button>
      </div>
      <pre className="p-3 text-xs whitespace-pre-wrap font-mono text-gray-200">{code}</pre>
    </div>
  );
};

const snippets = {
  rateLimit: `const rateLimit = require('express-rate-limit');
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
app.use(limiter);`,
  csrf: `const csurf = require('csurf');
const csrfProtection = csurf({ cookie: true });
app.use(csrfProtection);`,
  helmetCsp: `const helmet = require('helmet');
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  useDefaults: true,
  directives: {
    'default-src': ["'self'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'script-src': ["'self'", "'strict-dynamic'"],
  },
}));`,
  xPoweredBy: `app.disable('x-powered-by');`,
  secureCookie: `res.cookie('name', value, { httpOnly: true, secure: true, sameSite: 'lax' });`,
  corsRestrict: `const cors = require('cors');
const corsOptions = {
  origin: ['https://your-domain.com'],
  credentials: false,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));`
};

function SecurityHygiene({ data = {}, recommendations = [], scanId }) {
  const { insecureApiCalls = [], missingPolicies = [] } = data || {};

  const issues = useMemo(() => {
    const items = [
      ...missingPolicies.map(i => ({ ...i, source: 'missingPolicies' })),
      ...insecureApiCalls.map(i => ({ ...i, source: 'insecureApiCalls' })),
    ];
    return items.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));
  }, [insecureApiCalls, missingPolicies]);

  const severityCounts = useMemo(() => {
    const counts = { High: 0, Medium: 0, Low: 0 };
    for (const i of issues) counts[i.severity || 'Low'] = (counts[i.severity || 'Low'] || 0) + 1;
    return counts;
  }, [issues]);

  const [expandedMap, setExpandedMap] = useState({});
  const toggleExpanded = (key) => setExpandedMap(prev => ({ ...prev, [key]: !prev[key] }));

  const [filter, setFilter] = useState({ High: true, Medium: true, Low: true });
  const toggleSeverity = (sev) => setFilter(prev => ({ ...prev, [sev]: !prev[sev] }));
  const filteredIssues = useMemo(() => issues.filter(i => filter[i.severity || 'Low']), [issues, filter]);

  // Group issues by file path for accordion UI
  const fileKeyFor = (i) => i.file || i.path || i.filePath || (i.location && (i.location.file || i.location.path)) || 'General';
  const groupedByFile = useMemo(() => {
    const groups = {};
    for (const i of filteredIssues) {
      const key = fileKeyFor(i);
      if (!groups[key]) groups[key] = [];
      groups[key].push(i);
    }
    return groups;
  }, [filteredIssues]);
  const [openGroups, setOpenGroups] = useState({});
  const toggleGroup = (key) => setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const storageKey = scanId ? `securityHygieneApplied:${scanId}` : null;
  const [appliedMap, setAppliedMap] = useState({});
  React.useEffect(() => {
    try {
      if (storageKey) {
        const v = localStorage.getItem(storageKey);
        setAppliedMap(v ? (JSON.parse(v) || {}) : {});
      } else {
        setAppliedMap({});
      }
    } catch {}
  }, [storageKey]);
  React.useEffect(() => {
    try {
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(appliedMap));
    } catch {}
  }, [appliedMap, storageKey]);
  const toggleApplied = (key) => setAppliedMap(prev => ({ ...prev, [key]: !prev[key] }));

  const [applyStatusMap, setApplyStatusMap] = useState({});
  const [applyErrorMap, setApplyErrorMap] = useState({});
  const doApply = async (issueKey, issue, fix) => {
    if (!scanId) {
      setApplyErrorMap(prev => ({ ...prev, [issueKey]: 'Missing scanId' }));
      setApplyStatusMap(prev => ({ ...prev, [issueKey]: 'error' }));
      return;
    }
    setApplyStatusMap(prev => ({ ...prev, [issueKey]: 'loading' }));
    try {
      const changes = {
        type: 'security_hygiene',
        issue: { title: issue.title, severity: issue.severity, source: issue.source, description: issue.description },
        snippet: fix ? { label: fix.label, code: fix.code } : null,
        requestedAt: new Date().toISOString()
      };
      await applyScanChanges(scanId, changes);
      setApplyStatusMap(prev => ({ ...prev, [issueKey]: 'success' }));
    } catch (err) {
      setApplyErrorMap(prev => ({ ...prev, [issueKey]: err?.message || 'Apply failed' }));
      setApplyStatusMap(prev => ({ ...prev, [issueKey]: 'error' }));
    }
  };
  const snippetFor = (title = '') => {
    const t = String(title);
    if (t.includes('Rate limiting')) return { label: 'Add express-rate-limit', code: snippets.rateLimit };
    if (t.includes('CSRF')) return { label: 'Enable csurf middleware', code: snippets.csrf };
    if (t.includes('CSP')) return { label: 'Configure Helmet Content Security Policy', code: snippets.helmetCsp };
    if (t.includes('X-Powered-By')) return { label: "Disable X-Powered-By header", code: snippets.xPoweredBy };
    if (t.includes('Permissive CORS') || t.includes('Wildcard CORS')) return { label: 'Restrict CORS configuration', code: snippets.corsRestrict };
    if (t.includes('Cookie without httpOnly') || t.includes('Cookie without secure') || t.includes('Session cookie flags')) return { label: 'Set secure and httpOnly cookie flags', code: snippets.secureCookie };
    return null;
  };

  return (
    <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-200 dark:border-gray-700/50 mt-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
        <FiShield className="mr-3 text-indigo-400" />
        Security Hygiene
      </h2>

      <div className="mb-4 flex gap-2 items-center">
        <span className="text-xs text-gray-600 dark:text-gray-400 mr-2">Severity Filters:</span>
        {['High', 'Medium', 'Low'].map((sev) => (
          <button
            key={sev}
            onClick={() => toggleSeverity(sev)}
            className={`text-xs px-2 py-1 rounded border ${filter[sev] ? 'bg-gray-200 text-gray-900 border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600' : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700'}`}
          >
            {sev} ({severityCounts[sev] || 0})
          </button>
        ))}
      </div>

      {Object.keys(groupedByFile).length === 0 && recommendations.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">No security hygiene issues detected.</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByFile).map(([file, items]) => {
            const count = items.length;
            const maxSeverity = items.reduce((acc, cur) => (severityWeight(cur.severity) > severityWeight(acc) ? cur.severity : acc), 'Low');
            const headerColor = severityColor(maxSeverity);
            const isOpen = !!openGroups[file];
            return (
              <div key={file} className={`rounded-xl border ${headerColor} dark:bg-gray-900/40`}>
                <button onClick={() => toggleGroup(file)} className="w-full flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 dark:text-white font-semibold">{file}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-700 dark:text-gray-300">{count} issues</span>
                    <SeverityBadge severity={maxSeverity} />
                  </div>
                </button>
                {isOpen ? (
                  <div className="px-3 pb-3 space-y-3">
                    {items.map((i) => {
                      const fix = snippetFor(i.title);
                      const issueKey = `${i.source || 'unknown'}|${i.title}`;
                      const expandedKey = `${file}|${issueKey}`;
                      const isExpanded = !!expandedMap[expandedKey];
                      const isApplied = !!appliedMap[issueKey];
                      const globalIdx = filteredIssues.indexOf(i);
                      return (
                        <div key={expandedKey} className={`p-3 rounded-lg border ${severityColor(i.severity)} dark:bg-gray-900/60 ${isApplied ? 'opacity-70' : ''}`}>
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <SeverityBadge severity={i.severity || 'Low'} dataTestId="severity-badge" />
                                <span className="text-gray-900 dark:text-white font-semibold">{i.title}</span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{i.description}</p>
                              <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                <label className="inline-flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    data-testid={`applied-toggle-${globalIdx}`}
                                    checked={isApplied}
                                    onChange={() => toggleApplied(issueKey)}
                                  />
                                  <span className="flex items-center gap-1">Applied?<FiCheckCircle className="text-green-600 dark:text-green-400" /></span>
                                </label>
                              </div>
                            </div>
                            {fix ? (
                              <button onClick={() => toggleExpanded(expandedKey)} className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm">
                                {isExpanded ? 'Hide Fix Snippet' : 'Show Fix Snippet'}
                              </button>
                            ) : null}
                          </div>
                          {fix && isExpanded ? (
                            <>
                              <SnippetBlock title={fix.label} code={fix.code} />
                              <div className="mt-3 flex items-center gap-3">
                                <button
                                  data-testid={`apply-cta-${globalIdx}`}
                                  onClick={() => doApply(issueKey, i, fix)}
                                  className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-sm"
                                  disabled={applyStatusMap[issueKey] === 'loading'}
                                >
                                  Apply
                                </button>
                                <button
                                  onClick={() => {
                                    const text = `${fix.label}\n\n${fix.code}`;
                                    navigator.clipboard.writeText(text);
                                  }}
                                  className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white text-sm"
                                >
                                  <FiCopy /> Copy
                                </button>
                                {applyStatusMap[issueKey] === 'success' ? (
                                  <span className="text-xs text-green-600 dark:text-green-400">Apply job queued</span>
                                ) : null}
                                {applyStatusMap[issueKey] === 'error' ? (
                                  <span className="text-xs text-red-600 dark:text-red-400">{applyErrorMap[issueKey] || 'Apply failed'}</span>
                                ) : null}
                              </div>
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {recommendations.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-white mb-2">Recommendations</h3>
          <ul className="list-disc list-inside text-sm text-gray-300">
            {recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default SecurityHygiene;