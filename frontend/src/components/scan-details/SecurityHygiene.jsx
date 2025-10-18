import React, { useState, useMemo } from 'react';
import { FiShield, FiCheckCircle, FiCopy, FiCode } from 'react-icons/fi';

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
    <div className="mt-3 bg-black/50 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-400">
        <span className="flex items-center"><FiCode className="mr-2" />{title}</span>
        <button
          onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (_) {} }}
          className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-white text-xs"
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
  const toggleExpanded = (idx) => setExpandedMap(prev => ({ ...prev, [idx]: !prev[idx] }));

  const [filter, setFilter] = useState({ High: true, Medium: true, Low: true });
  const toggleSeverity = (sev) => setFilter(prev => ({ ...prev, [sev]: !prev[sev] }));
  const filteredIssues = useMemo(() => issues.filter(i => filter[i.severity || 'Low']), [issues, filter]);

  const storageKey = scanId ? `securityHygieneApplied:${scanId}` : null;
  const [appliedMap, setAppliedMap] = useState({});
  React.useEffect(() => {
    try {
      if (storageKey) {
        const v = localStorage.getItem(storageKey);
        if (v) setAppliedMap(JSON.parse(v) || {});
      }
    } catch {}
  }, [storageKey]);
  React.useEffect(() => {
    try {
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(appliedMap));
    } catch {}
  }, [appliedMap, storageKey]);
  const toggleApplied = (key) => setAppliedMap(prev => ({ ...prev, [key]: !prev[key] }));

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
    <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 mt-8">
      <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
        <FiShield className="mr-3 text-indigo-400" />
        Security Hygiene
      </h2>

      <div className="mb-4 flex gap-2 items-center">
        <span className="text-xs text-gray-400 mr-2">Severity Filters:</span>
        {['High', 'Medium', 'Low'].map((sev) => (
          <button
            key={sev}
            onClick={() => toggleSeverity(sev)}
            className={`text-xs px-2 py-1 rounded border ${filter[sev] ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-900 text-gray-400 border-gray-700'}`}
          >
            {sev} ({severityCounts[sev] || 0})
          </button>
        ))}
      </div>

      {filteredIssues.length === 0 && recommendations.length === 0 ? (
        <p className="text-sm text-gray-400">No security hygiene issues detected.</p>
      ) : (
        <div className="space-y-4">
          {filteredIssues.map((i, idx) => {
            const fix = snippetFor(i.title);
            const isExpanded = !!expandedMap[idx];
            const issueKey = `${i.source || 'unknown'}|${i.title}`;
            const isApplied = !!appliedMap[issueKey];
            return (
              <div key={idx} className={`p-4 rounded-xl border ${severityColor(i.severity)} bg-gray-900/40 ${isApplied ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full border ${severityColor(i.severity)}`}>{i.severity || 'Low'}</span>
                      <span className="text-white font-semibold">{i.title}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{i.description}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          data-testid={`applied-toggle-${idx}`}
                          checked={isApplied}
                          onChange={() => toggleApplied(issueKey)}
                        />
                        <span className="flex items-center gap-1">Applied?<FiCheckCircle className="text-green-400" /></span>
                      </label>
                    </div>
                  </div>
                  {fix ? (
                    <button onClick={() => toggleExpanded(idx)} className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm">
                      {isExpanded ? 'Hide Fix Snippet' : 'Show Fix Snippet'}
                    </button>
                  ) : null}
                </div>
                {fix && isExpanded ? (<SnippetBlock title={fix.label} code={fix.code} />) : null}
              </div>
            );
          })}

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
      )}

      <div className="mt-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-2"><FiCheckCircle className="text-green-400" />Apply fixes and re-run scans to validate improvements.</span>
      </div>
    </div>
  );
}

export default SecurityHygiene;