// Simple baseline lookup service
// NOTE: For the hackathon this contains a small built-in mapping. In future replace with
// a local web-features snapshot or the web-features npm package.

const fs = require('fs');
const path = require('path');

let bcd;
try {
  bcd = require('@mdn/browser-compat-data');
} catch (_) {
  bcd = null;
}
let webFeaturesData = null;
try {
  // web-features provides data via package; try common paths
  webFeaturesData = require('web-features/data/features.json');
} catch (_) {
  try { webFeaturesData = require('web-features'); } catch (__) { webFeaturesData = null; }
}

const BROWSERS = ['chrome', 'firefox', 'safari', 'edge'];

let DEFAULT_MAP = {
  'fetch': 'supported',
  'navigator.clipboard': 'partial',
  'dynamic-import': 'supported',
  'async-await': 'supported',
  'css-has-pseudo': 'partial'
};



// Aliases to MDN BCD paths for our feature keys
const BCD_ALIASES = Object.freeze({
  // JavaScript
  'async-await': 'javascript.operators.await',
  'optional-chaining': 'javascript.operators.optional_chaining',
  'nullish-coalescing': 'javascript.operators.nullish_coalescing',
  'dynamic-import': 'javascript.statements.import.dynamic_import',
  'class-fields': 'javascript.classes.class_fields.public_class_fields',
  'private-class-fields': 'javascript.classes.class_fields.private_class_fields',
  'promise-allSettled': 'javascript.builtins.Promise.allSettled',
  'string-replaceAll': 'javascript.builtins.String.replaceAll',
  'top-level-await': 'javascript.operators.await.top_level_await',
  // Web APIs
  'XMLHttpRequest': 'api.XMLHttpRequest',
  'Worker': 'api.Worker',
  'SharedWorker': 'api.SharedWorker',
  'IntersectionObserver': 'api.IntersectionObserver',
  'ResizeObserver': 'api.ResizeObserver',
  'AbortController': 'api.AbortController',
  'ServiceWorker': 'api.ServiceWorker',
  'WebSockets': 'api.WebSocket',
  'WebRTC': 'api.RTCPeerConnection',
  'WebGL': 'api.WebGLRenderingContext',
  'WebAudio': 'api.AudioContext',
  'IndexedDB': 'api.IDBDatabase',
  'navigator.clipboard': 'api.Clipboard',
  'WebShare': 'api.Navigator.share',
  'CustomElements': 'api.CustomElementRegistry',
  // CSS
  'css-variables': 'css.properties.--*',
  'css-backdrop-filter': 'css.properties.backdrop-filter',
  'css-grid': 'css.features.grid',
  'css-flexbox': 'css.features.flexbox',
  'css-clamp': 'css.types.clamp',
  'css-has-pseudo': 'css.selectors.has',
  'css-subgrid': 'css.features.subgrid',
  'css-container-queries': 'css.at-rules.container',
  'css-nesting': 'css.selectors.nesting'
});

// Try to load resources/feature-mapping.json to enrich mapping
try {
  const mapPath = path.join(__dirname, '..', '..', 'resources', 'feature-mapping.json');
  if (fs.existsSync(mapPath)) {
    const data = fs.readFileSync(mapPath, 'utf8');
    const parsed = JSON.parse(data);
    DEFAULT_MAP = Object.assign({}, DEFAULT_MAP, parsed);
  }
} catch (err) {
  // ignore and keep defaults
}

function normalizeFeature(key) {
  return key && key.toString().trim();
}

// Utility: access nested BCD entry by dot path
function getByPath(obj, pathStr) {
  if (!obj || !pathStr) return null;
  const parts = pathStr.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur && Object.prototype.hasOwnProperty.call(cur, p)) {
      cur = cur[p];
    } else {
      return null;
    }
  }
  return cur;
}

function classifyFromBCDEntry(entry) {
  if (!entry) return 'unknown';
  const pick = Array.isArray(entry) ? entry[entry.length - 1] : entry;
  if (!pick || pick.version_added === null || pick.version_added === false) return 'unsupported';
  if (pick.partial_implementation) return 'partial';
  if (pick.flags || pick.prefix || pick.alternative_name) return 'partial';
  return 'supported';
}

function fallbackUsingMDN(k) {
  if (!bcd) return null;
  const alias = BCD_ALIASES[k];
  if (!alias) return null;
  const node = getByPath(bcd, alias);
  if (!node || !node.__compat || !node.__compat.support) return null;
  const support = node.__compat.support;
  const mapped = {
    chrome: classifyFromBCDEntry(support.chrome),
    firefox: classifyFromBCDEntry(support.firefox),
    safari: classifyFromBCDEntry(support.safari),
    edge: classifyFromBCDEntry(support.edge),
  };
  const status = deriveStatusFromSupportMap(mapped);
  const notes = (node.__compat.status && node.__compat.status.message) || '';
  return { support: mapped, status, notes };
}

function deriveStatusFromSupportMap(support) {
  const rank = (v) => (v === 'unsupported' || v === 'no' || v === 'n') ? 3 : (v === 'partial' || v === 'a') ? 2 : (v === 'supported' || v === 'yes' || v === 'y') ? 1 : 0;
  const worst = BROWSERS.reduce((acc, b) => Math.max(acc, rank(support[b])), 0);
  return worst === 3 ? 'unsupported' : worst === 2 ? 'partial' : worst === 1 ? 'supported' : 'unknown';
}



function fallbackUsingWebFeatures(k) {
  if (!webFeaturesData) return null;
  try {
    const features = Array.isArray(webFeaturesData.features) ? webFeaturesData.features : webFeaturesData;
    const found = features.find((f) => {
      const name = (f.name || f.title || '').toLowerCase();
      const slug = (f.slug || '').toLowerCase();
      const q = k.toLowerCase();
      return name.includes(q) || slug.includes(q);
    });
    if (!found) return null;
    const bf = found.compat && found.compat.browsers ? found.compat.browsers : {};
    const support = {
      chrome: bf.chrome?.status || 'unknown',
      firefox: bf.firefox?.status || 'unknown',
      safari: bf.safari?.status || 'unknown',
      edge: bf.edge?.status || 'unknown',
    };
    const status = deriveStatusFromSupportMap(support);
    return { support, status, notes: `Fallback from web-features for '${found.slug || found.name}'` };
  } catch (_) {
    return null;
  }
}

function lookup(featureKey) {
  const k = normalizeFeature(featureKey);
  if (!k) return { feature: featureKey, status: 'unknown', support: Object.fromEntries(BROWSERS.map(b => [b, 'unknown'])) };
  const val = DEFAULT_MAP[k];
  let support = Object.fromEntries(BROWSERS.map(b => [b, 'unknown']));
  let status = 'unknown';

  const rank = (v) => (v === 'unsupported' || v === 'no') ? 3 : (v === 'partial' ? 2 : (v === 'supported' || v === 'yes') ? 1 : 0);

  if (val && typeof val === 'object' && !Array.isArray(val)) {
    // Per-browser mapping provided
    BROWSERS.forEach((b) => {
      const s = val[b];
      support[b] = s ? String(s) : 'unknown';
    });
    // Derive global status by worst-case across browsers
    const worst = BROWSERS.reduce((acc, b) => Math.max(acc, rank(support[b])), 0);
    status = worst === 3 ? 'unsupported' : worst === 2 ? 'partial' : worst === 1 ? 'supported' : 'unknown';
  } else if (typeof val === 'string') {
    // Single global status; replicate across browsers
    status = val;
    support = Object.fromEntries(BROWSERS.map(b => [b, val]));
  } else {
    status = 'unknown';
    support = Object.fromEntries(BROWSERS.map(b => [b, 'unknown']));
  }

  if (status === 'unknown') {
    // Prefer MDN BCD, then web-features
    const mdn = fallbackUsingMDN(k);
    if (mdn) {
      return { feature: k, status: mdn.status, support: mdn.support, notes: mdn.notes };
    }
    const wf = fallbackUsingWebFeatures(k);
    if (wf) {
      return { feature: k, status: wf.status, support: wf.support, notes: wf.notes };
    }
  }

  const notes = status === 'unknown' ? 'No baseline mapping available (fallback)' : '';
  return { feature: k, status, support, notes };
}

module.exports = { lookup, BROWSERS };
