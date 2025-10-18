const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);
const babelParser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const postcss = require('postcss');
const { walkFiles } = require('./repoAnalyzer.js');
const { getCache, setCache, generateCacheKey } = require('./caching');

const techEval = require('./techEval');
// Add AI router import
const { routeDetectors } = require('./aiRouter');

async function getPackageJson(repoPath) {
  try {
    const packageJsonPath = path.join(repoPath, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    return JSON.parse(packageJsonContent);
  } catch (error) {
    return null;
  }
}

async function detectJsFeatures(filePath) {
  const code = await fs.readFile(filePath, 'utf8');
  const features = new Set();
  try {
    const ast = babelParser.parse(code, {
      sourceType: 'unambiguous',
      plugins: [
        'jsx',
        'typescript',
        'dynamicImport',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'privateIn',
        'optionalChaining',
        'nullishCoalescingOperator',
      ],
    });

    traverse(ast, {
      MemberExpression(path) {
        const { node } = path;
        if (node.object?.name === 'navigator' && node.property) {
          if (node.property.name === 'clipboard') features.add('navigator.clipboard');
          if (node.property.name === 'share') features.add('WebShare');
        }
        if (node.object?.name === 'window' && node.property?.name === 'customElements') {
          features.add('CustomElements');
        }
      },
      CallExpression(path) {
        const callee = path.node.callee;
        if (callee.name === 'fetch') features.add('fetch');
        // Promise.allSettled
        if (callee.type === 'MemberExpression' && callee.object?.name === 'Promise' && callee.property?.name === 'allSettled') {
          features.add('promise-allSettled');
        }
        // String.prototype.replaceAll (heuristic)
        if (callee.type === 'MemberExpression' && callee.property?.name === 'replaceAll') {
          features.add('string-replaceAll');
        }
      },
      NewExpression(path) {
        const callee = path.node.callee;
        if (callee.name === 'XMLHttpRequest') features.add('XMLHttpRequest');
        if (callee.type === 'Identifier' && ['Worker', 'SharedWorker', 'IntersectionObserver', 'ResizeObserver'].includes(callee.name)) {
          features.add(callee.name);
        }
        if (callee.type === 'Identifier' && callee.name === 'AbortController') {
          features.add('AbortController');
        }
      },
      Import(path) {
        features.add('dynamic-import');
      },
      AwaitExpression(path) {
        features.add('async-await');
        // Top-level await (no function parent)
        if (!path.getFunctionParent()) {
          features.add('top-level-await');
        }
      },
      ImportDeclaration(path) {
        const source = path.node.source.value;
        if (source.startsWith('core-js/')) {
          features.add(source);
        }
      },
      // Add detection for modern syntax
      OptionalMemberExpression() {
        features.add('optional-chaining');
      },
      LogicalExpression(path) {
        if (path.node.operator === '??') {
          features.add('nullish-coalescing');
        }
      },
      ClassProperty() {
        features.add('class-fields');
      },
      ClassPrivateProperty() {
        features.add('private-class-fields');
      },
      ClassPrivateMethod() {
        features.add('private-class-fields');
      },
    });
  } catch (err) {
    // Ignore parsing errors
  }
  return Array.from(features);
}

async function detectCssFeatures(filePath) {
  const features = new Set();
  const css = await fs.readFile(filePath, 'utf-8');

  try {
    const result = await postcss().process(css, { from: filePath });

    result.root.walkRules(rule => {
      if (rule.selector.includes(':has(')) {
        features.add('css-has-pseudo');
      }
      // Detect nesting via parent rule & nested selector
      if (rule.parent && rule.parent.type === 'rule' && /&/.test(rule.selector)) {
        features.add('css-nesting');
      }
    });

    result.root.walkDecls(decl => {
      if (decl.prop.startsWith('--')) features.add('css-variables');
      if (decl.prop === 'backdrop-filter') features.add('css-backdrop-filter');
      if (decl.prop.includes('grid')) features.add('css-grid');
      if ((decl.prop === 'grid-template-columns' || decl.prop === 'grid-template-rows') && /subgrid/.test(decl.value)) {
        features.add('css-subgrid');
      }
      if (decl.prop.includes('flex')) features.add('css-flexbox');
      if (decl.value.includes('clamp(')) features.add('css-clamp');
    });

    // Container queries
    result.root.walkAtRules('container', atRule => {
      features.add('css-container-queries');
    });
  } catch (err) {
    console.error(`Error parsing CSS file: ${filePath}`, err);
  }
  return Array.from(features);
}

function parseOwnerRepoFromUrl(repoUrl) {
  try {
    if (!repoUrl) return null;
    const m = repoUrl.match(/github\.com\/(.*?)\/(.*?)(?:\.git|$)/i);
    if (m) {
      return { owner: m[1], repo: m[2] };
    }
  } catch (_) {}
  return null;
}

async function detectGithubMetadata(repoUrl) {
  const meta = { repoName: '', description: '', owner: '', license: '' };
  try {
    const parsed = parseOwnerRepoFromUrl(repoUrl);
    if (!parsed) return meta;

    const cacheKey = generateCacheKey(`github-metadata-${repoUrl}`);
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Use CommonJS require to avoid Babel transform issues in tests
    const { Octokit } = require('@octokit/rest');
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const { owner, repo } = parsed;
    const { data } = await octokit.repos.get({ owner, repo });
    meta.repoName = data.name || '';
    meta.description = data.description || '';
    meta.owner = (data.owner && data.owner.login) || '';
    meta.license = (data.license && data.license.spdx_id) || '';

    await setCache(cacheKey, meta);
    return meta;
  } catch (_) {
    return meta;
  }
}

async function detectRepoDetails(repoPath, repoUrl = '', versionControl = {}, packageJson) {
  const details = {
    repoName: '',
    description: '',
    owner: '',
    license: '',
    totalFiles: 0,
    totalFolders: 0,
    totalLinesOfCode: 0,
    projectSize: 0,
    languages: {},
    createdDate: '',
    lastUpdatedDate: '',
  };

  if (packageJson) {
    details.repoName = packageJson.name || '';
    details.description = packageJson.description || '';
    details.owner = packageJson.author || '';
    details.license = packageJson.license || '';
  }

  // Attempt GitHub enrichment using repoUrl or git remote URL
  try {
    let inferredUrl = repoUrl;
    if (!inferredUrl && versionControl && Array.isArray(versionControl.remotes) && versionControl.remotes.length > 0) {
      inferredUrl = versionControl.remotes[0].url || '';
    }
    const gh = await detectGithubMetadata(inferredUrl);
    details.repoName = gh.repoName || details.repoName;
    details.description = gh.description || details.description;
    details.owner = gh.owner || details.owner;
    details.license = gh.license || details.license;
  } catch (_) {}

  // Walk through the repository to get file and folder counts, lines of code, and project size
  const stats = {
    files: 0,
    folders: new Set(),
    lines: 0,
    size: 0,
    languages: {},
  };

  const files = await walkFiles(repoPath);

  for (const file of files) {
    const filePath = path.join(repoPath, file);
    const stat = await fs.stat(filePath);
    stats.files++;
    stats.size += stat.size;
    const fileContent = await fs.readFile(filePath, 'utf8');
    stats.lines += fileContent.split('\n').length;

    // Language detection based on file extension
    const ext = path.extname(file).toLowerCase();
    if (ext) {
      stats.languages[ext] = (stats.languages[ext] || 0) + 1;
    }

    // Add directory to folders set
    const dir = path.dirname(file);
    if (dir !== '.') {
      stats.folders.add(dir);
    }
  }

  details.totalFiles = stats.files;
  details.totalFolders = stats.folders.size;
  details.totalLinesOfCode = stats.lines;
  details.projectSize = stats.size;
  details.languages = stats.languages;

  // Get created and last updated dates
  const repoStat = await fs.stat(repoPath);
  details.createdDate = repoStat.birthtime;
  details.lastUpdatedDate = repoStat.mtime;

  return details;
}

async function detectEnvironmentAndVersioning(repoPath, packageJson) {
  const environment = {
    primaryFrameworks: [],
    versionCompatibility: {},
    dependencies: [],
    deprecatedPackages: [],
    securityVulnerabilities: [],
    recommendedUpgrades: [],
    dependencyInventory: [],
    // Router hints populated by AI-based detector routing
    routerHints: null,
    // Planned detector prioritization derived from router hints
    detectorPlan: null,
  };

  // Compute AI-based routing hints
  try {
    const hints = await routeDetectors(repoPath);
    environment.routerHints = hints;
    environment.detectorPlan = {
      frameworks: (hints.rankedFrameworks || []).map(x => x.name),
      languages: (hints.rankedLanguages || []).map(x => x.name),
      allowFrameworks: Array.from(hints.allowFrameworks || []),
      allowLanguages: Array.from(hints.allowLanguages || []),
    };
    try {
      const topFw = (hints.rankedFrameworks || []).slice(0, 3).map(x => `${x.name}:${x.score}`).join(', ');
      const topLang = (hints.rankedLanguages || []).slice(0, 3).map(x => `${x.name}:${x.score}`).join(', ');
      const enforce = String(process.env.ROUTER_ENFORCE || '').toLowerCase() === 'true';
      console.debug(`[router-hints] allowFrameworks=[${Array.from(hints.allowFrameworks || []).join(', ')}]; allowLanguages=[${Array.from(hints.allowLanguages || []).join(', ')}]; topFrameworks=[${topFw}]; topLanguages=[${topLang}]; enforce=${enforce}`);
    } catch {}
  } catch {}

  const addFramework = (name, source = 'auto') => {
    if (!name) return;
    const enforceHints = String(process.env.ROUTER_ENFORCE || '').toLowerCase() === 'true';
    if (enforceHints) {
      const allowed = new Set(environment?.detectorPlan?.allowFrameworks || []);
      if (allowed.size > 0 && !allowed.has(name)) {
        try { console.debug(`[router-enforce] Skipping framework '${name}' under enforcement; allowFrameworks=[${Array.from(allowed).join(', ')}]; source=${source}`); } catch {}
        return;
      }
      try { console.debug(`[router-enforce] Added framework '${name}' (allowed); source=${source}`); } catch {}
    } else {
      try { console.debug(`[router-enforce] Disabled; adding framework '${name}'; source=${source}`); } catch {}
    }
    if (!techEval.shouldDetect(name)) {
      try { console.debug(`[router-gate] Evaluation gate rejected '${name}'; source=${source}`); } catch {}
      return; // gate framework addition via evaluation
    }
    if (!environment.primaryFrameworks.includes(name)) environment.primaryFrameworks.push(name);
  };
  const addDep = (name) => {
    if (name) environment.dependencies.push(name);
  };

  if (packageJson) {
    // Detect primary frameworks and runtimes
    if (packageJson.dependencies) {
      if (packageJson.dependencies.react) addFramework('React', 'package.json:dependencies');
      if (packageJson.dependencies.angular) addFramework('Angular', 'package.json:dependencies');
      if (packageJson.dependencies.vue) addFramework('Vue', 'package.json:dependencies');
      if (packageJson.dependencies.express) addFramework('Express', 'package.json:dependencies');
      if (packageJson.dependencies.next) addFramework('Next.js', 'package.json:dependencies');
    }
    if (packageJson.devDependencies) {
      if (packageJson.devDependencies.react) addFramework('React', 'package.json:devDependencies');
      if (packageJson.devDependencies.angular) addFramework('Angular', 'package.json:devDependencies');
      if (packageJson.devDependencies.vue) addFramework('Vue', 'package.json:devDependencies');
    }

    // Get dependency list (aggregate across nested package.json files)
    environment.dependencies = packageJson.dependencies ? Object.keys(packageJson.dependencies) : [];
    environment.dependencies = environment.dependencies.concat(packageJson.devDependencies ? Object.keys(packageJson.devDependencies) : []);
    // Collect dependency inventory for root
    for (const [name, version] of Object.entries(packageJson.dependencies || {})) {
      environment.dependencyInventory.push({ name, version, dev: false, packageDir: repoPath });
    }
    for (const [name, version] of Object.entries(packageJson.devDependencies || {})) {
      environment.dependencyInventory.push({ name, version, dev: true, packageDir: repoPath });
    }

    let pkgFiles = [];
    try {
      const jsonFiles = await walkFiles(repoPath, { extensions: ['.json'] });
      pkgFiles = jsonFiles.filter(f => /(^|\\|\/)package\.json$/.test(f) && !f.includes('node_modules'));
      for (const rel of pkgFiles) {
        const full = path.join(repoPath, rel);
        try {
          const content = await fs.readFile(full, 'utf8');
          const pkg = JSON.parse(content);
          const deps = Object.keys(pkg.dependencies || {});
          const devDeps = Object.keys(pkg.devDependencies || {});
          environment.dependencies = environment.dependencies.concat(deps, devDeps);
          // Collect inventory for nested packages
          const pkgDir = path.dirname(full);
          for (const [name, version] of Object.entries(pkg.dependencies || {})) {
            environment.dependencyInventory.push({ name, version, dev: false, packageDir: pkgDir });
          }
          for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
            environment.dependencyInventory.push({ name, version, dev: true, packageDir: pkgDir });
          }
          // Angular heuristics via scripts or deps
          const scriptsStr = Object.values(pkg.scripts || {}).join(' ');
          if (/\bng\b/.test(scriptsStr) || pkg.dependencies?.['@angular/core'] || pkg.devDependencies?.['@angular/core']) {
            addFramework('Angular', `nested:${rel}`);
          }
        } catch {}
      }
    } catch {}
    // Angular config file heuristic
    try {
      const jsonFiles = await walkFiles(repoPath, { extensions: ['.json'] });
      if (jsonFiles.some(f => /(^|\\|\/)angular\.json$/.test(f))) {
        addFramework('Angular', 'angular.json');
      }
    } catch {}
    // Deduplicate dependencies
    environment.dependencies = Array.from(new Set(environment.dependencies));
    // Deduplicate inventory entries
    const _seenInv = new Set();
    environment.dependencyInventory = environment.dependencyInventory.filter(d => {
      const key = `${d.packageDir}:${d.name}:${d.version}:${d.dev ? 'dev' : 'prod'}`;
      if (_seenInv.has(key)) return false;
      _seenInv.add(key);
      return true;
    });

    // Compute package directories for audits/outdated
    const packageDirs = Array.from(new Set([repoPath, ...pkgFiles.map(rel => path.dirname(path.join(repoPath, rel)))]));

    // Get outdated packages (aggregate across nested packages) with concurrency + caching
    const mapLimit = async (items, limit, taskFn) => {
      const results = new Array(items.length);
      let i = 0;
      const workers = Array(Math.min(limit, items.length)).fill(0).map(async () => {
        while (true) {
          if (i >= items.length) break;
          const idx = i++;
          results[idx] = await taskFn(items[idx], idx);
        }
      });
      await Promise.all(workers);
      return results;
    };

    const runJSONCached = async (cmd, cwd, label) => {
      const cacheKey = generateCacheKey(`${label}:${cwd}`);
      const cached = await getCache(cacheKey);
      if (cached) return cached;
      return new Promise((resolve) => {
        exec(cmd, { cwd }, (err, stdout) => {
          let out = {};
          if (stdout) { try { out = JSON.parse(stdout); } catch { out = {}; } }
          setCache(cacheKey, out).catch(() => {});
          resolve(out);
        });
      });
    };

    const outdatedResults = await mapLimit(packageDirs, 4, async (dir) => {
      return await runJSONCached('npm outdated --json', dir, 'npm-outdated');
    });
    let mergedOutdated = {};
    for (const out of outdatedResults) {
      for (const [name, info] of Object.entries(out || {})) {
        mergedOutdated[name] = info;
      }
    }

    environment.versionCompatibility = mergedOutdated;
    environment.deprecatedPackages = Object.keys(mergedOutdated);
    environment.recommendedUpgrades = Object.entries(mergedOutdated).map(([name, versions]) => ({
      package: name,
      current: versions?.current,
      latest: versions?.latest,
    }));

    // Get security vulnerabilities (aggregate across nested packages) with concurrency + caching
    const allVulns = [];
    const auditResults = await mapLimit(packageDirs, 4, async (dir) => {
      return await runJSONCached('npm audit --json', dir, 'npm-audit');
    });
    for (const audit of auditResults) {
      const vulnsObj = audit?.vulnerabilities || {};
      allVulns.push(...Object.values(vulnsObj));
    }
    environment.securityVulnerabilities = allVulns;
  }

  // Detect Python and Java frameworks from common manifest files
  try {
    const otherFiles = await walkFiles(repoPath, { extensions: ['.txt', '.toml', '.xml', '.gradle', '.kts', '.py'] });
    const candidates = otherFiles.filter(f => /(^|\\|\/)(requirements\.txt|Pipfile|pyproject\.toml|setup\.py|pom\.xml|build\.gradle|build\.gradle\.kts)$/.test(f));
    for (const rel of candidates) {
      const full = path.join(repoPath, rel);
      let content = '';
      try { content = await fs.readFile(full, 'utf8'); } catch { continue; }
      const lower = content.toLowerCase();
      if (/flask|fastapi|django/.test(lower)) {
        if (/flask/.test(lower)) addFramework('Flask', rel);
        if (/fastapi/.test(lower)) addFramework('FastAPI', rel);
        if (/django/.test(lower)) addFramework('Django', rel);
      }
      if (/spring-boot|springframework|hibernate|jakarta\.persistence|javax\.persistence/.test(lower)) {
        if (/spring-boot|springframework/.test(lower)) addFramework('Spring Boot', rel);
        if (/hibernate/.test(lower)) addFramework('Hibernate', rel);
        if (/jakarta\.persistence|javax\.persistence/.test(lower)) addFramework('JPA', rel);
      }
    }
  } catch {}
  // Go modules and frameworks via go.mod
  try {
    const modFiles = await walkFiles(repoPath, { extensions: ['.mod'] });
    const gomods = modFiles.filter(f => /(^|\\|\/)go\.mod$/.test(f));
    for (const rel of gomods) {
      const full = path.join(repoPath, rel);
      let content = '';
      try { content = await fs.readFile(full, 'utf8'); } catch { continue; }
      const requires = [];
      const lines = content.split(/\r?\n/);
      let inBlock = false;
      for (const line of lines) {
        const l = line.trim();
        if (/^require\s*\(\s*$/.test(l)) { inBlock = true; continue; }
        if (inBlock && /^\)/.test(l)) { inBlock = false; continue; }
        const single = l.match(/^require\s+([^\s]+)\s+/);
        if (single) requires.push(single[1]);
        else if (inBlock) {
          const m = l.match(/^([^\s]+)\s+/);
          if (m) requires.push(m[1]);
        }
      }
      for (const mod of requires) {
        addDep(mod);
        if (/github\.com\/gin-gonic\/gin/.test(mod)) addFramework('Go (Gin)', 'go.mod');
        if (/github\.com\/labstack\/echo/.test(mod)) addFramework('Go (Echo)', 'go.mod');
        if (/github\.com\/gofiber\/fiber/.test(mod)) addFramework('Go (Fiber)', 'go.mod');
        if (/github\.com\/go-chi\/chi/.test(mod)) addFramework('Go (Chi)', 'go.mod');
        if (/github\.com\/gorilla\/mux/.test(mod)) addFramework('Go (Gorilla Mux)', 'go.mod');
        if (/gorm\.io\/gorm/.test(mod)) addFramework('GORM', 'go.mod');
      }
    }
  } catch {}

  // Next.js detection
  try {
    let nextDetected = false;
    // next.config.js or next.config.mjs at root
    try { await fs.access(path.join(repoPath, 'next.config.js')); nextDetected = true; } catch {}
    try { await fs.access(path.join(repoPath, 'next.config.mjs')); nextDetected = nextDetected || true; } catch {}

    if (!nextDetected) {
      // package.json dependencies/devDependencies include next
      try {
        const pkgStr = await fs.readFile(path.join(repoPath, 'package.json'), 'utf8');
        const pkg = JSON.parse(pkgStr);
        const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (Object.keys(allDeps).some(n => n === 'next')) nextDetected = true;
        // scripts using next
        const scripts = pkg.scripts || {};
        if (Object.values(scripts).some(s => /\bnext\b/.test(String(s)))) nextDetected = true;
      } catch {}
    }

    if (!nextDetected) {
      // Common Next.js app structure
      try {
        const pagesDir = path.join(repoPath, 'pages');
        const appDir = path.join(repoPath, 'app');
        const hasPages = await fs.stat(pagesDir).then(s => s.isDirectory()).catch(() => false);
        const hasApp = await fs.stat(appDir).then(s => s.isDirectory()).catch(() => false);
        if (hasPages || hasApp) nextDetected = true;
      } catch {}
    }

    if (!nextDetected) {
      // Look for typical Next imports in source files
      try {
        const srcFiles = await walkFiles(repoPath, { extensions: ['.js', '.jsx', '.ts', '.tsx'] });
        for (const rel of srcFiles) {
          let content = '';
          try { content = await fs.readFile(path.join(repoPath, rel), 'utf8'); } catch {}
          if (/from\s+'next\/link'|from\s+"next\/link"|from\s+'next\/router'|from\s+"next\/router"|from\s+'next\/head'|from\s+"next\/head"/.test(content)) {
            nextDetected = true; break;
          }
        }
      } catch {}
    }

    if (nextDetected) addFramework('Next.js');
  } catch {}

  // SvelteKit detection
  try {
    let svelteKitDetected = false;
    let svelteDetected = false;

    // svelte.config.js/mjs
    try { await fs.access(path.join(repoPath, 'svelte.config.js')); svelteDetected = true; } catch {}
    try { await fs.access(path.join(repoPath, 'svelte.config.mjs')); svelteDetected = svelteDetected || true; } catch {}

    // package.json includes @sveltejs/kit or svelte
    try {
      const pkgStr = await fs.readFile(path.join(repoPath, 'package.json'), 'utf8');
      const pkg = JSON.parse(pkgStr);
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (Object.keys(allDeps).some(n => n === '@sveltejs/kit')) svelteKitDetected = true;
      if (Object.keys(allDeps).some(n => n === 'svelte')) svelteDetected = true;
    } catch {}

    // src/routes structure and +page.svelte
    try {
      const routesDir = path.join(repoPath, 'src', 'routes');
      const hasRoutes = await fs.stat(routesDir).then(s => s.isDirectory()).catch(() => false);
      if (hasRoutes) svelteKitDetected = true;
      if (hasRoutes) {
        const files = await walkFiles(routesDir, { extensions: ['.svelte'] });
        if (files.some(f => /\+page\.svelte$/.test(f) || /\+layout\.svelte$/.test(f))) svelteKitDetected = true;
      }
    } catch {}

    // any .svelte files indicate Svelte usage
    try {
      const svelteFiles = await walkFiles(repoPath, { extensions: ['.svelte'] });
      if (svelteFiles.length > 0) svelteDetected = true;
    } catch {}

    if (svelteKitDetected) addFramework('SvelteKit');
    else if (svelteDetected) addFramework('Svelte');
  } catch {}

  // Nuxt detection
  try {
    let nuxtDetected = false;

    // nuxt.config.* files
    try { await fs.access(path.join(repoPath, 'nuxt.config.js')); nuxtDetected = true; } catch {}
    try { await fs.access(path.join(repoPath, 'nuxt.config.ts')); nuxtDetected = true; } catch {}
    try { await fs.access(path.join(repoPath, 'nuxt.config.mjs')); nuxtDetected = true; } catch {}
    try { await fs.access(path.join(repoPath, 'nuxt.config.cjs')); nuxtDetected = true; } catch {}

    // package.json includes nuxt or scripts using nuxt/nuxi
    try {
      const pkgStr = await fs.readFile(path.join(repoPath, 'package.json'), 'utf8');
      const pkg = JSON.parse(pkgStr);
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      const scripts = pkg.scripts || {};
      if (Object.keys(allDeps).some(n => n === 'nuxt')) nuxtDetected = true;
      if (Object.values(scripts).some(s => /(\b)(nuxt|nuxi)(\b)/.test(s))) nuxtDetected = true;
    } catch {}

    // pages directory and app.vue
    const pagesDirCandidates = [
      path.join(repoPath, 'pages'),
      path.join(repoPath, 'src', 'pages'),
    ];
    for (const dir of pagesDirCandidates) {
      try {
        const hasPages = await fs.stat(dir).then(s => s.isDirectory()).catch(() => false);
        if (hasPages) nuxtDetected = true;
        if (hasPages) {
          const files = await walkFiles(dir, { extensions: ['.vue'] });
          if (files.some(f => /index\.vue$/.test(f))) nuxtDetected = true;
        }
      } catch {}
    }
    try { await fs.access(path.join(repoPath, 'app.vue')); nuxtDetected = true; } catch {}

    // server directory (Nuxt 3 / Nitro)
    try {
      const serverDir = path.join(repoPath, 'server');
      const hasServer = await fs.stat(serverDir).then(s => s.isDirectory()).catch(() => false);
      if (hasServer) nuxtDetected = true;
    } catch {}

    if (nuxtDetected) addFramework('Nuxt');
  } catch {}

  // Vue detection (Vue CLI / Vite-Vue)
  try {
    let vueDetected = false;

    // vue.config.* indicates Vue CLI projects
    try { await fs.access(path.join(repoPath, 'vue.config.js')); vueDetected = true; } catch {}
    try { await fs.access(path.join(repoPath, 'vue.config.ts')); vueDetected = true; } catch {}
    try { await fs.access(path.join(repoPath, 'vue.config.mjs')); vueDetected = true; } catch {}
    try { await fs.access(path.join(repoPath, 'vue.config.cjs')); vueDetected = true; } catch {}

    // package.json: vue and @vue/cli-service or scripts using vue-cli-service
    try {
      const pkgStr = await fs.readFile(path.join(repoPath, 'package.json'), 'utf8');
      const pkg = JSON.parse(pkgStr);
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      const scripts = pkg.scripts || {};
      if (Object.keys(allDeps).some(n => n === 'vue' || n === '@vue/cli-service')) vueDetected = true;
      if (Object.values(scripts).some(s => /\bvue-cli-service\b/.test(String(s)))) vueDetected = true;
    } catch {}

    // src/main.{js,ts} importing vue
    try {
      const candidates = [path.join(repoPath, 'src', 'main.js'), path.join(repoPath, 'src', 'main.ts')];
      for (const f of candidates) {
        let content = '';
        try { content = await fs.readFile(f, 'utf8'); } catch {}
        if (content && /from\s+['\"]vue['\"]/.test(content)) { vueDetected = true; break; }
      }
    } catch {}

    // presence of .vue files under src
    try {
      const vueFiles = await walkFiles(path.join(repoPath, 'src'), { extensions: ['.vue'] }).catch(() => []);
      if (vueFiles.length > 0) vueDetected = true;
    } catch {}

    if (vueDetected) addFramework('Vue');
  } catch {}

  // Nx monorepo detection
  try {
    let nxDetected = false;
    const nxJsonPath = path.join(repoPath, 'nx.json');
    const workspaceJsonPath = path.join(repoPath, 'workspace.json');
    try { await fs.access(nxJsonPath); nxDetected = true; } catch {}
    try { await fs.access(workspaceJsonPath); nxDetected = nxDetected || true; } catch {}

    if (!nxDetected) {
      // Check package.json for nx/@nrwl dependencies
      try {
        const pkgStr = await fs.readFile(path.join(repoPath, 'package.json'), 'utf8');
        const pkg = JSON.parse(pkgStr);
        const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        for (const name of Object.keys(allDeps)) {
          if (name === 'nx' || name.startsWith('@nrwl/')) { nxDetected = true; break; }
        }
      } catch {}
    }

    if (!nxDetected) {
      // Look for Nx project.json files under apps/ or libs/
      try {
        const jsonFiles = await walkFiles(repoPath, { extensions: ['.json'] });
        for (const rel of jsonFiles) {
          if (path.basename(rel) === 'project.json') {
            try {
              const obj = JSON.parse(await fs.readFile(path.join(repoPath, rel), 'utf8'));
              if (obj && (obj.projectType || obj.sourceRoot || obj.targets)) { nxDetected = true; break; }
            } catch {}
          }
        }
      } catch {}
    }

    if (nxDetected) addFramework('Nx');
  } catch {}

  // ML frameworks and artifacts detection
  try {
    const mlFiles = await walkFiles(repoPath, { extensions: ['.py', '.ipynb', '.h5', '.pt', '.pth', '.onnx', '.joblib', '.pkl'] });
    for (const rel of mlFiles) {
      const full = path.join(repoPath, rel);
      const ext = path.extname(rel).toLowerCase();
      if (ext === '.py') {
        let content = '';
        try { content = await fs.readFile(full, 'utf8'); } catch {}
        const lower = content.toLowerCase();
        if (/\bimport\s+tensorflow\b|\bfrom\s+tensorflow\b/.test(lower)) addFramework('TensorFlow');
        if (/\bimport\s+torch\b|\bfrom\s+torch\b/.test(lower)) addFramework('PyTorch');
        if (/\bimport\s+keras\b|\bfrom\s+keras\b/.test(lower)) addFramework('Keras');
        if (/\bimport\s+sklearn\b|\bfrom\s+sklearn\b/.test(lower)) addFramework('Scikit-learn');
      } else if (ext === '.ipynb') {
        addFramework('Jupyter Notebook');
      } else if (['.h5', '.onnx', '.pt', '.pth', '.joblib', '.pkl'].includes(ext)) {
        addFramework('ML Artifacts');
      }
    }
  } catch {}

  // Reorder primary frameworks according to router hint ranking (stable for unknowns)
  try {
    const ranked = (environment.routerHints?.rankedFrameworks || []).reduce((acc, item, idx) => { acc[item.name] = idx; return acc; }, {});
    environment.primaryFrameworks = (environment.primaryFrameworks || []).sort((a, b) => {
      const aiA = Object.prototype.hasOwnProperty.call(ranked, a) ? ranked[a] : Number.POSITIVE_INFINITY;
      const aiB = Object.prototype.hasOwnProperty.call(ranked, b) ? ranked[b] : Number.POSITIVE_INFINITY;
      return aiA - aiB;
    });
  } catch {}

  return environment;
}

  async function detectSecurityAndPerformance(repoPath) {
    const securityAndPerformance = { securityVulnerabilities: [], performanceBottlenecks: [], sensitiveFiles: [], insecureApiCalls: [], missingPolicies: [], inefficientCode: [], largeAssets: [], bottlenecks: [] };

    // npm audit vulnerabilities (best-effort)
    try {
      const { stdout } = await execPromise('npm audit --json', { cwd: repoPath });
      const audit = JSON.parse(stdout || '{}');
      securityAndPerformance.securityVulnerabilities = Object.values(audit.vulnerabilities || {});
    } catch (_) {}

    // Detect large files (>100KB)
    const largeFiles = [];
    try {
      const allFiles = await walkFiles(repoPath, { includeHidden: true });
      for (const file of allFiles) {
        const fullPath = path.join(repoPath, file);
        try {
          const stat = await fs.stat(fullPath);
          if (stat.size > 100000) {
            largeFiles.push({ file: path.basename(file), size: stat.size });
          }
        } catch (_) {}
      }
    } catch (_) {}
    if (largeFiles.length > 0) {
      securityAndPerformance.performanceBottlenecks.push({ type: 'Large Assets', files: largeFiles });
      // Also provide flattened largeAssets for UI display
      securityAndPerformance.largeAssets = largeFiles.map((f) => ({
        title: 'Large asset',
        description: `${f.file} — ${Math.round(f.size / 1024)} KB`,
        severity: 'Low'
      }));
    }

    // Static code compliance and heuristics scanning
    try {
      const codeFiles = await walkFiles(repoPath, { includeHidden: true, extensions: ['.js', '.jsx', '.ts', '.tsx', '.html'] });
      let hasExpress = false;
      let hasHelmetImport = false;
      let hasHelmetUsage = false;
      let policyMentions = { csp: false, frameguard: false, nosniff: false, referrer: false, hsts: false, permissions: false };
      // Added tracking for additional security controls
      let hasCsurfImport = false;
      let hasCsurfUsage = false;
      let hasRateLimitImport = false;
      let hasRateLimitUsage = false;
      let hasDisableXPoweredBy = false;

      for (const rel of codeFiles) {
        const abs = path.join(repoPath, rel);
        let content = '';
        try {
          content = await fs.readFile(abs, 'utf8');
        } catch (_) { continue; }

        const lower = content.toLowerCase();
        // Express/Helmet detection
        if (/require\(['"]express['"]\)|from\s+['"]express['"]/i.test(content)) hasExpress = true;
        if (/require\(['"]helmet['"]\)|from\s+['"]helmet['"]/i.test(content)) hasHelmetImport = true;
        if (/helmet\s*\(/i.test(content)) hasHelmetUsage = true;
        if (/contentsecuritypolicy|csp/i.test(content)) policyMentions.csp = true;
        if (/frameguard/i.test(content)) policyMentions.frameguard = true;
        if (/nosniff|x-content-type-options/i.test(content)) policyMentions.nosniff = true;
        if (/referrerpolicy/i.test(content)) policyMentions.referrer = true;
        if (/hsts|stricttransportsecurity/i.test(content)) policyMentions.hsts = true;
        if (/permissionspolicy|feature-policy/i.test(content)) policyMentions.permissions = true;
        if (/app\.disable\(\s*['"]x-powered-by['"]\s*\)/i.test(content)) hasDisableXPoweredBy = true;

        // Additional middleware detections
        if (/require\(['"]csurf['"]\)|from\s+['"]csurf['"]/i.test(content)) hasCsurfImport = true;
        if (/csurf\s*\(/i.test(content)) hasCsurfUsage = true;
        if (/require\(['"]express-rate-limit['"]\)|from\s+['"]express-rate-limit['"]/i.test(content)) hasRateLimitImport = true;
        if (/rateLimit\s*\(/i.test(content)) hasRateLimitUsage = true;

        // Insecure HTTP usage (best-effort)
        if (/http:\/\//i.test(content)) {
          securityAndPerformance.insecureApiCalls.push({
            title: 'Insecure HTTP usage',
            description: `Found http:// reference in ${path.basename(rel)}`,
            severity: 'High'
          });
        }

        // Permissive CORS
        if (/app\.use\(\s*cors\s*\(\s*\)\s*\)/i.test(content) || /origin\s*:\s*['"][*]['"]/i.test(content)) {
          securityAndPerformance.missingPolicies.push({
            title: 'Permissive CORS',
            description: `Wildcard CORS policy in ${path.basename(rel)}`,
            severity: 'Medium'
          });
        }
        // Wildcard CORS with credentials
        if (/cors\s*\(\s*\{[^}]*origin\s*:\s*['"][*]['"][^}]*credentials\s*:\s*true/i.test(content)) {
          securityAndPerformance.missingPolicies.push({
            title: 'Permissive CORS with credentials',
            description: `Wildcard origin and credentials=true in ${path.basename(rel)}`,
            severity: 'High'
          });
        }
        // Wildcard CORS headers/methods
        if (/cors\s*\(\s*\{[^}]*(allowedHeaders|methods)\s*:\s*['"][*]['"]/i.test(content)) {
          securityAndPerformance.missingPolicies.push({
            title: 'Wildcard CORS headers/methods',
            description: `Wildcard headers or methods in ${path.basename(rel)}`,
            severity: 'Medium'
          });
        }

        // Blocking I/O and risky constructs
        if (/fs\.[a-zA-Z]+Sync\(/.test(content) || /execSync\(/.test(content) || /spawnSync\(/.test(content)) {
          securityAndPerformance.inefficientCode.push({
            title: 'Blocking I/O',
            description: `Synchronous operation in ${path.basename(rel)}`,
            severity: 'Medium'
          });
        }
        if (/eval\s*\(/.test(content) || /new\s+Function\s*\(/.test(content)) {
          securityAndPerformance.inefficientCode.push({
            title: 'Dynamic code execution',
            description: `Use of eval/new Function in ${path.basename(rel)}`,
            severity: 'High'
          });
        }
        if (/document\.write\s*\(/.test(content) || /dangerouslySetInnerHTML\s*:\s*/.test(content) || /innerHTML\s*=/.test(content)) {
          securityAndPerformance.insecureApiCalls.push({
            title: 'Potential XSS risk',
            description: `Direct HTML injection pattern in ${path.basename(rel)}`,
            severity: 'Medium'
          });
        }

        // Cookies & session flags
        if (/res\.cookie\s*\(/i.test(content) && !/httpOnly\s*:\s*true/i.test(content)) {
          securityAndPerformance.insecureApiCalls.push({
            title: 'Cookie without httpOnly',
            description: `res.cookie missing httpOnly in ${path.basename(rel)}`,
            severity: 'Medium'
          });
        }
        if (/res\.cookie\s*\(/i.test(content) && !/secure\s*:\s*true/i.test(content)) {
          securityAndPerformance.insecureApiCalls.push({
            title: 'Cookie without secure',
            description: `res.cookie missing secure in ${path.basename(rel)}`,
            severity: 'Low'
          });
        }
        if (/require\(['"]express-session['"]\)|from\s+['"]express-session['"]/i.test(content)) {
          const hasCookieSecure = /cookie\s*:\s*\{[^}]*secure\s*:\s*true/i.test(content);
          const hasCookieHttpOnly = /cookie\s*:\s*\{[^}]*httpOnly\s*:\s*true/i.test(content);
          if (!hasCookieSecure || !hasCookieHttpOnly) {
            securityAndPerformance.missingPolicies.push({
              title: 'Session cookie flags',
              description: `express-session cookies missing secure/httpOnly in ${path.basename(rel)}`,
              severity: 'Medium'
            });
          }
        }

        // Secrets patterns (basic)
        if (/AKIA[0-9A-Z]{16}/.test(content) || /-----BEGIN\s+PRIVATE\s+KEY-----/.test(content)) {
          securityAndPerformance.sensitiveFiles.push(path.basename(rel));
        }
      }

      // Policy compliance summary for Express apps
      if (hasExpress) {
        if (!hasHelmetImport || !hasHelmetUsage) {
          // If Helmet not used, mark common HTTP header policies as missing
          securityAndPerformance.missingPolicies.push({ title: 'CSP', description: 'Content Security Policy not configured (helmet)', severity: 'High' });
          securityAndPerformance.missingPolicies.push({ title: 'HSTS', description: 'Strict-Transport-Security not enforced', severity: 'High' });
          securityAndPerformance.missingPolicies.push({ title: 'X-Frame-Options', description: 'Frameguard missing (clickjacking protection)', severity: 'Medium' });
          securityAndPerformance.missingPolicies.push({ title: 'X-Content-Type-Options', description: 'MIME sniffing protection missing (noSniff)', severity: 'Medium' });
          securityAndPerformance.missingPolicies.push({ title: 'Referrer-Policy', description: 'Referrer policy not set', severity: 'Low' });
          securityAndPerformance.missingPolicies.push({ title: 'Permissions-Policy', description: 'Permissions policy not set', severity: 'Low' });
        } else {
          if (!policyMentions.csp) securityAndPerformance.missingPolicies.push({ title: 'CSP', description: 'Content Security Policy not configured', severity: 'High' });
          if (!policyMentions.hsts) securityAndPerformance.missingPolicies.push({ title: 'HSTS', description: 'Strict-Transport-Security not enforced', severity: 'High' });
          if (!policyMentions.frameguard) securityAndPerformance.missingPolicies.push({ title: 'X-Frame-Options', description: 'Frameguard missing (clickjacking protection)', severity: 'Medium' });
          if (!policyMentions.nosniff) securityAndPerformance.missingPolicies.push({ title: 'X-Content-Type-Options', description: 'MIME sniffing protection missing (noSniff)', severity: 'Medium' });
          if (!policyMentions.referrer) securityAndPerformance.missingPolicies.push({ title: 'Referrer-Policy', description: 'Referrer policy not set', severity: 'Low' });
          if (!policyMentions.permissions) securityAndPerformance.missingPolicies.push({ title: 'Permissions-Policy', description: 'Permissions policy not set', severity: 'Low' });
        }
        // Additional policy suggestions
        if (!hasDisableXPoweredBy) {
          securityAndPerformance.missingPolicies.push({ title: 'X-Powered-By', description: 'X-Powered-By header not disabled', severity: 'Low' });
        }
        if (!hasCsurfImport || !hasCsurfUsage) {
          securityAndPerformance.missingPolicies.push({ title: 'CSRF', description: 'CSRF protection not configured', severity: 'High' });
        }
        if (!hasRateLimitImport || !hasRateLimitUsage) {
          securityAndPerformance.missingPolicies.push({ title: 'Rate limiting', description: 'Express rate limiting not configured', severity: 'Medium' });
        }
      }

      // Simple bottleneck summary from large assets
      if (largeFiles.length > 3) {
        securityAndPerformance.bottlenecks.push({
          title: 'Multiple large assets',
          description: `${largeFiles.length} assets exceed 100KB`,
          severity: 'Low'
        });
      }
    } catch (_) {}

    // Detect sensitive files
    try {
      const allFiles = await walkFiles(repoPath, { includeHidden: true });
      const sensitivePatterns = ['.npmrc', '.yarnrc', 'credentials', '.env'];
      for (const file of allFiles) {
        const name = path.basename(file);
        if (sensitivePatterns.some(p => name.includes(p))) {
          if (!securityAndPerformance.sensitiveFiles.includes(name)) {
            securityAndPerformance.sensitiveFiles.push(name);
          }
        }
      }
    } catch (_) {}

    return securityAndPerformance;
  }

  module.exports = { detectSecurityAndPerformance, detectEnvironmentAndVersioning, detectRepoDetails, detectJsFeatures, detectCssFeatures, enforceRouterAllowList };

function enforceRouterAllowList(frameworks, environment) {
  try {
    const list = Array.isArray(frameworks) ? frameworks : [];
    const enforceHints = String(process.env.ROUTER_ENFORCE || '').toLowerCase() === 'true';
    if (!enforceHints) {
      try { console.debug(`[router-enforce] Disabled; passthrough frameworks=[${list.join(', ')}]`); } catch {}
      return list;
    }
    const allowed = new Set(environment?.detectorPlan?.allowFrameworks || []);
    const allowedLangs = new Set(environment?.detectorPlan?.allowLanguages || []);
    if (allowed.size === 0) {
      try { console.debug('[router-enforce] No allowFrameworks computed; returning original frameworks list'); } catch {}
      return list;
    }
    const kept = list.filter(f => allowed.has(f));
    const filtered = list.filter(f => !allowed.has(f));
    try { console.debug(`[router-enforce] Enforced; allowFrameworks=[${Array.from(allowed).join(', ')}]; allowLanguages=[${Array.from(allowedLangs).join(', ')}]; kept=[${kept.join(', ') || ''}]; filtered=[${filtered.join(', ') || ''}]`); } catch {}
    if (kept.length === 0) {
      try { console.debug('[router-enforce] Warning: none of detected frameworks matched allow list'); } catch {}
    }
    return kept;
  } catch (_) {
    return frameworks || [];
  }
}
