const fs = require('fs');
const path = require('path');

// Loads technology evaluation metadata and exposes gating helpers.
// Config path resolution order:
// 1) env EVAL_CONFIG_PATH
// 2) repo root resources/tech-evaluation.json
const getConfigPath = () => {
  const envPath = process.env.EVAL_CONFIG_PATH;
  if (envPath && envPath.trim().length > 0) return envPath;
  // backend/src/services -> repo root is three levels up
  const repoRoot = path.resolve(__dirname, '../../..');
  return path.join(repoRoot, 'resources', 'tech-evaluation.json');
};

let cache = null;
let lastLoadedPath = null;

function load() {
  const cfgPath = getConfigPath();
  try {
    if (!lastLoadedPath || lastLoadedPath !== cfgPath || cache === null) {
      const raw = fs.readFileSync(cfgPath, 'utf8');
      cache = JSON.parse(raw);
      lastLoadedPath = cfgPath;
    }
  } catch (e) {
    cache = { technologies: {} };
  }
  return cache;
}

function getTech(name) {
  const data = load();
  const techs = data.technologies || {};
  return techs[name] || null;
}

function isInactive(name) {
  const t = getTech(name);
  if (!t) return false; // default to active when not defined
  return t.status === 'inactive' || t.approved === false;
}

function shouldDetect(name) {
  // If gating enforcement is enabled, require approved === true
  const enforce = String(process.env.EVAL_ENFORCE || '').toLowerCase() === 'true';
  const t = getTech(name);
  if (!t) return true; // default allow when no record exists
  if (t.status === 'inactive') return false;
  if (enforce) return !!t.approved;
  return true;
}

function testingLevel(name) {
  const t = getTech(name);
  return (t && t.testing_level) || 'smoke';
}

function refreshCache() {
  cache = null;
  lastLoadedPath = null;
  load();
}

module.exports = {
  load,
  getTech,
  isInactive,
  shouldDetect,
  testingLevel,
  refreshCache,
};