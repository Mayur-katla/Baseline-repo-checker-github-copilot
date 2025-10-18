const crypto = require('crypto');

// Simple token bucket for rate limiting (per process)
const RATE = { capacity: 10, tokens: 10, refillMs: 60000, lastRefill: Date.now() };
function allow() {
  // Read env-configurable rate limit each call
  try {
    const capRaw = process.env.LLM_SUGGESTIONS_RATE_CAPACITY;
    const refillRaw = process.env.LLM_SUGGESTIONS_RATE_REFILL_MS;
    const disabled = String(process.env.LLM_SUGGESTIONS_RATE_DISABLE || '').toLowerCase() === 'true';
    if (typeof capRaw !== 'undefined') {
      const cap = Number(capRaw);
      if (Number.isFinite(cap) && cap >= 1) {
        RATE.capacity = cap;
        // Avoid exceeding capacity when shrinking
        RATE.tokens = Math.min(RATE.tokens, RATE.capacity);
      }
    }
    if (typeof refillRaw !== 'undefined') {
      const refill = Number(refillRaw);
      if (Number.isFinite(refill) && refill >= 250) {
        RATE.refillMs = refill;
      }
    }
    if (disabled) return true; // bypass rate limiting when disabled
  } catch (_) {}

  const now = Date.now();
  if (now - RATE.lastRefill >= RATE.refillMs) {
    RATE.tokens = RATE.capacity;
    RATE.lastRefill = now;
  }
  if (RATE.tokens > 0) {
    RATE.tokens -= 1;
    return true;
  }
  return false;
}

// Redaction regexes for secrets/tokens
const REDACT_PATTERNS = [
  /ghp_[A-Za-z0-9]{20,}/g, // GitHub PAT
  /sk-[A-Za-z0-9]{20,}/g, // OpenAI key
  /Bearer\s+[A-Za-z0-9\-_.]+/gi,
  /(password|secret|token)\s*[:=]\s*[^\s"']+/gi,
  /AWS_[A-Z_]+=\S+/g,
];

function redact(text) {
  let count = 0;
  let redacted = String(text || '');
  for (const re of REDACT_PATTERNS) {
    redacted = redacted.replace(re, (m) => { count += 1; return '[REDACTED]'; });
  }
  return { redacted, count };
}

function safeCategory(cat) {
  const allowed = new Set(['modernize','secure','performance','cleanup']);
  return allowed.has(cat) ? cat : 'modernize';
}

function sanitizeSuggestion(s) {
  const bad = [/\bexfiltrate\b/i, /\bcurl\s+http/i, /rm\s+-rf/i, /shutdown/i];
  const desc = String(s.description || '').slice(0, 400);
  for (const re of bad) {
    if (re.test(desc)) {
      return null; // drop unsafe suggestion
    }
  }
  return {
    id: s.id || crypto.randomUUID(),
    title: s.title || '',
    description: desc,
    severity: ['Low','Medium','High'].includes(s.severity) ? s.severity : 'Medium',
    category: safeCategory(s.category || 'modernize'),
    file: String(s.file || 'README.md'),
    patch: String(s.patch || '').slice(0, 2000),
    hint: String(s.hint || '').slice(0, 300)
  };
}

function stubGenerate(context) {
  const items = [];
  const features = Array.isArray(context?.projectFeatures?.detectedFeatures) ? context.projectFeatures.detectedFeatures : [];
  const cfg = new Set(context?.architecture?.configFiles || []);
  const frameworks = new Set(context?.architecture?.frameworks || []);
  const sec = context?.securityAndPerformance || {};

  if (features.includes('XMLHttpRequest') && !features.includes('fetch')) {
    items.push({
      title: 'Migrate XHR to fetch',
      description: 'Replace legacy XMLHttpRequest calls with the modern fetch API for simpler code and better streaming support.',
      severity: 'Medium',
      category: 'modernize',
      file: 'src/index.js',
      patch: '--- a/src/index.js\n+++ b/src/index.js\n@@\n-const xhr = new XMLHttpRequest();\n+xhr = undefined;\n+const res = await fetch("/api");',
      hint: 'Use AbortController for cancellable requests.'
    });
  }
  if (features.includes('core-js/features/promise') && features.includes('async-await')) {
    items.push({
      title: 'Remove Promise polyfill',
      description: 'Drop core-js Promise polyfill since async/await is supported in target browsers.',
      severity: 'Low',
      category: 'cleanup',
      file: 'package.json',
      patch: '--- a/package.json\n+++ b/package.json\n@@\n-  "dependencies": { "core-js": "^3" }\n+  "dependencies": {}',
      hint: 'Confirm baseline coverage before removal.'
    });
  }
  if (features.includes('fetch') && !features.includes('AbortController')) {
    items.push({
      title: 'Enable AbortController',
      description: 'Add AbortController to cancel in-flight fetch requests and avoid memory leaks.',
      severity: 'Medium',
      category: 'performance',
      file: 'src/api/client.js',
      patch: '--- a/src/api/client.js\n+++ b/src/api/client.js\n@@\n+const controller = new AbortController();\n+await fetch(url, { signal: controller.signal });',
      hint: 'Wire cancellation into retry logic.'
    });
  }
  const missingPolicies = Array.isArray(sec?.missingPolicies) ? sec.missingPolicies : [];
  if (missingPolicies.length > 0 && !cfg.has('helmet.config.js')) {
    items.push({
      title: 'Add CSP via helmet',
      description: 'Introduce Content Security Policy to mitigate XSS and data injection attacks.',
      severity: 'High',
      category: 'secure',
      file: 'server.js',
      patch: '--- a/server.js\n+++ b/server.js\n@@\n+const helmet = require("helmet");\n+app.use(helmet.contentSecurityPolicy({ directives: { defaultSrc: ["self"] } }));',
      hint: 'Tailor CSP for required domains.'
    });
  }
  if (frameworks.has('Next.js') && !cfg.has('next.config.js') && !cfg.has('next.config.mjs')) {
    items.push({
      title: 'Add next.config.js',
      description: 'Create next.config.js with performance-focused flags (swcMinify, reactStrictMode).',
      severity: 'Low',
      category: 'performance',
      file: 'next.config.js',
      patch: '--- /dev/null\n+++ b/next.config.js\n@@\n+module.exports = { swcMinify: true, reactStrictMode: true };',
      hint: 'Consider image optimization settings.'
    });
  }

  return items.map(sanitizeSuggestion);
}

async function generateAiSuggestions(detected, options = {}) {
  // Apply rate limit
  const allowed = allow();
  const meta = { rateLimited: !allowed, model: 'stub', redactions: 0 };

  const rawInput = JSON.stringify({
    projectFeatures: detected?.projectFeatures || {},
    architecture: detected?.architecture || {},
    securityAndPerformance: detected?.securityAndPerformance || {},
    environment: detected?.environment || {},
  });
  const { redacted, count } = redact(rawInput);
  meta.redactions = count;

  // Optionally disable generation entirely via env
  const disabled = String(process.env.LLM_SUGGESTIONS_DISABLE || '').toLowerCase() === 'true';

  // For demo/hackathon, use stub generation; a real provider can be wired when enabled
  let items = disabled ? [] : (stubGenerate({
    projectFeatures: detected?.projectFeatures || {},
    architecture: detected?.architecture || {},
    securityAndPerformance: detected?.securityAndPerformance || {},
    environment: detected?.environment || {},
  }) || []);

  // Filter out any nulls from sanitizer
  items = items.filter(Boolean);

  // Router hints rationale passthrough
  const router = detected?.environment?.routerHints || null;
  let rationale = [
    { label: 'features', detail: 'Suggestions derived from detected features and configs' },
    { label: 'guardrails', detail: 'Secrets redacted; unsafe actions filtered; rate limited' }
  ];
  try {
    if (router) {
      const allowFw = Array.from(router.allowFrameworks || []);
      const allowLang = Array.from(router.allowLanguages || []);
      rationale.push({
        label: 'router-hints',
        detail: `Allowed frameworks: ${allowFw.join(', ') || 'none'}; allowed languages: ${allowLang.join(', ') || 'none'}`
      });
      if (Array.isArray(router.rationale) && router.rationale.length > 0) {
        // Include up to 4 router rationale entries for context
        rationale = rationale.concat(router.rationale.slice(0, 4));
      }
    }
  } catch (_) {}

  return {
    items,
    meta: {
      ...meta,
      redactedInputSample: redacted.slice(0, 512)
    },
    rationale
  };
}

module.exports = { generateAiSuggestions };