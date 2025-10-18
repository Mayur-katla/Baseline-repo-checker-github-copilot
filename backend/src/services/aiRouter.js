const fs = require('fs');
const path = require('path');
const { walkFiles } = require('./repoAnalyzer');

// Lightweight embedding-like scoring using keyword vectors.
// Produces ranked frameworks/languages and rationale for routing detectors.
async function routeDetectors(repoPath) {
  const scores = {
    frameworks: {
      'Next.js': 0,
      'SvelteKit': 0,
      'Nuxt': 0,
      'Vue': 0,
      'Angular': 0,
      'Nx': 0,
      'Express': 0,
    },
    languages: {
      'JavaScript': 0,
      'TypeScript': 0,
      'Python': 0,
      'Java': 0,
      'Go': 0,
    },
    ml: {
      'TensorFlow': 0,
      'PyTorch': 0,
      'Keras': 0,
      'Scikit-learn': 0,
    }
  };

  const rationale = [];

  const pkgPath = path.join(repoPath, 'package.json');
  let pkg = null;
  try {
    if (fs.existsSync(pkgPath)) {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    }
  } catch {}

  const addReason = (label, detail) => rationale.push({ label, detail });

  const bump = (group, name, by = 1) => {
    if (scores[group] && name in scores[group]) scores[group][name] += by;
  };

  // Package.json based heuristics
  try {
    const deps = Object.keys(pkg?.dependencies || {});
    const devDeps = Object.keys(pkg?.devDependencies || {});
    const allDeps = new Set([ ...deps, ...devDeps ]);
    if (allDeps.has('next')) { bump('frameworks', 'Next.js', 3); addReason('framework', 'Found next in dependencies'); }
    if (allDeps.has('@sveltejs/kit')) { bump('frameworks', 'SvelteKit', 3); addReason('framework', 'Found @sveltejs/kit in dependencies'); }
    if (allDeps.has('nuxt')) { bump('frameworks', 'Nuxt', 3); addReason('framework', 'Found nuxt in dependencies'); }
    if (allDeps.has('vue') || Array.from(allDeps).some(d => d.startsWith('@vue/'))) { bump('frameworks', 'Vue', 2); addReason('framework', 'Found vue related dependency'); }
    if (allDeps.has('@angular/core')) { bump('frameworks', 'Angular', 3); addReason('framework', 'Found @angular/core in dependencies'); }
    if (allDeps.has('express')) { bump('frameworks', 'Express', 2); addReason('framework', 'Found express dependency'); }
    if (allDeps.has('nx') || Array.from(allDeps).some(d => d.startsWith('@nrwl/'))) { bump('frameworks', 'Nx', 2); addReason('framework', 'Found nx/@nrwl dependencies'); }

    if (allDeps.has('typescript')) { bump('languages', 'TypeScript', 2); addReason('language', 'Found typescript dependency'); }
  } catch {}

  // File-based heuristics
  try {
    const files = await walkFiles(repoPath, { extensions: ['.js', '.jsx', '.ts', '.tsx', '.md', '.py', '.java', '.go', '.ipynb'] });

    for (const rel of files) {
      const relNormalized = rel.split(path.sep).join('/');
      const ext = path.extname(rel).toLowerCase();
      if (ext === '.ts' || ext === '.tsx') bump('languages', 'TypeScript', 1);
      if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) bump('languages', 'JavaScript', 1);
      if (ext === '.py' || ext === '.ipynb') bump('languages', 'Python', 2);
      if (ext === '.java') bump('languages', 'Java', 2);
      if (ext === '.go') bump('languages', 'Go', 2);

      if (relNormalized.includes('pages/') && (relNormalized.endsWith('.tsx') || relNormalized.endsWith('.jsx'))) bump('frameworks', 'Next.js', 1);
      if (relNormalized.endsWith('nuxt.config.ts') || relNormalized.endsWith('nuxt.config.js')) bump('frameworks', 'Nuxt', 2);
      if (relNormalized.endsWith('svelte.config.js') || relNormalized.includes('src/routes/')) bump('frameworks', 'SvelteKit', 1);
      if (relNormalized.endsWith('angular.json')) { bump('frameworks', 'Angular', 2); addReason('framework', 'Found angular.json'); }

      // ML libs in Python files
      if (ext === '.py') {
        try {
          const content = fs.readFileSync(path.join(repoPath, rel), 'utf8').toLowerCase();
          if (/\bimport\s+tensorflow\b|\bfrom\s+tensorflow\b/.test(content)) { bump('ml', 'TensorFlow', 3); addReason('ml', `tensorflow import in ${rel}`); }
          if (/\bimport\s+torch\b|\bfrom\s+torch\b/.test(content)) { bump('ml', 'PyTorch', 3); addReason('ml', `torch import in ${rel}`); }
          if (/\bimport\s+keras\b|\bfrom\s+keras\b/.test(content)) { bump('ml', 'Keras', 2); addReason('ml', `keras import in ${rel}`); }
          if (/\bimport\s+sklearn\b|\bfrom\s+sklearn\b/.test(content)) { bump('ml', 'Scikit-learn', 2); addReason('ml', `sklearn import in ${rel}`); }
        } catch {}
      }
    }
  } catch {}

  // Normalize: convert to ranked arrays
  const rank = (obj) => Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .map(([name, score]) => ({ name, score }))
    .filter(x => x.score > 0);

  const rankedFrameworks = rank(scores.frameworks);
  const rankedLanguages = rank(scores.languages);
  const rankedMl = rank(scores.ml);

  // Allow list thresholds (configurable via env, default 50%)
  const maxFw = rankedFrameworks.length ? rankedFrameworks[0].score : 0;
  const fwPctRaw = process.env.ROUTER_FW_THRESHOLD_PCT ?? '0.5';
  const fwPct = Math.min(1, Math.max(0, Number(fwPctRaw))); // clamp to [0,1]
  const fwThreshold = maxFw > 0 ? Math.max(1, Math.floor(maxFw * (Number.isFinite(fwPct) ? fwPct : 0.5))) : 0;
  const allowFrameworks = new Set(rankedFrameworks.filter(x => x.score >= fwThreshold).map(x => x.name));

  const maxLang = rankedLanguages.length ? rankedLanguages[0].score : 0;
  const langPctRaw = process.env.ROUTER_LANG_THRESHOLD_PCT ?? '0.5';
  const langPct = Math.min(1, Math.max(0, Number(langPctRaw)));
  const langThreshold = maxLang > 0 ? Math.max(1, Math.floor(maxLang * (Number.isFinite(langPct) ? langPct : 0.5))) : 0;
  const allowLanguages = new Set(rankedLanguages.filter(x => x.score >= langThreshold).map(x => x.name));

  return {
    rankedFrameworks,
    rankedLanguages,
    rankedMl,
    allowFrameworks,
    allowLanguages,
    rationale,
  };
}

module.exports = { routeDetectors };