const fs = require('fs');
const path = require('path');

let _pluginsCache = null;

function loadPlugins() {
  if (_pluginsCache) return _pluginsCache;
  const pluginsDir = path.join(__dirname, '..', 'plugins');
  const plugins = [];
  try {
    if (fs.existsSync(pluginsDir)) {
      const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));
      for (const f of files) {
        try {
          const mod = require(path.join(pluginsDir, f));
          if (mod && typeof mod.detect === 'function') {
            const name = String(mod.name || path.basename(f, '.js'));
            plugins.push({ name, detect: mod.detect });
          }
        } catch (e) {
          console.warn(`[pluginRegistry] Failed to load plugin ${f}:`, e?.message || e);
        }
      }
    }
  } catch (e) {
    console.warn('[pluginRegistry] loadPlugins error:', e?.message || e);
  }
  _pluginsCache = plugins;
  return _pluginsCache;
}

async function runDetectors(context) {
  const plugins = loadPlugins();
  const results = { ...context.result };
  const log = (msg) => {
    try {
      const arr = Array.isArray(results.summaryLog) ? results.summaryLog : [];
      arr.push({ ts: Date.now(), msg: `[plugin] ${msg}` });
      results.summaryLog = arr;
    } catch {}
  };

  for (const p of plugins) {
    try {
      const out = await p.detect({
        root: context.root,
        files: context.files,
        repoUrl: context.repoUrl,
        result: results,
        log,
      });
      if (out && typeof out === 'object') {
        Object.assign(results, out);
      }
      log(`Executed ${p.name}`);
    } catch (e) {
      log(`Error in ${p.name}: ${e?.message || e}`);
    }
  }
  return results;
}

module.exports = { loadPlugins, runDetectors };
