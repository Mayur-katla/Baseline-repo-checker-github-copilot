const os = require('os');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const simpleGit = require('simple-git');
const AdmZip = require('adm-zip');
const ignore = require('ignore');
const { getCache, setCache, generateCacheKey } = require('./caching');

async function cloneRepo(repoUrl) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-'));
  const git = simpleGit();
  try {
    console.log(`Cloning repository with URL: ${repoUrl}`);
    await git.clone(repoUrl, tmp, ['--depth', '1']);
    console.log(`Successfully cloned repository to: ${tmp}`);
    return tmp;
  } catch (err) {
    console.error(`Error cloning repository: ${repoUrl}`, err);
    await rimraf(tmp);
    throw err;
  }
}

async function unzipBuffer(buffer) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-'));
  const zip = new AdmZip(buffer);
  zip.extractAllTo(tmp, true);
  return tmp;
}

function readGitignore(root) {
  const gitignorePath = path.join(root, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return null;
  const content = fs.readFileSync(gitignorePath, 'utf8');
  const ig = ignore();
  ig.add(content);
  return ig;
}

async function walkFiles(root, options = {}) {
  const exts = options.extensions || [];
  const includeHidden = options.includeHidden ?? false;
  const userIgnore = options.ignoreDirs || [];
  const defaultIgnoreDirs = [
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
    'coverage', '.cache', 'tmp', 'vendor', 'target', 'out',
    '.svelte-kit', '.gradle', '__pycache__', 'venv', '.venv',
    '.mypy_cache', '.pytest_cache', '.yarn', '.pnpm', '.idea', '.vscode'
  ];
  const ignoreDirs = new Set([...defaultIgnoreDirs, ...userIgnore]);
  const files = [];
  const ig = readGitignore(root);

  let gitignoreContent = '';
  try {
    const gitignorePath = path.join(root, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    }
  } catch {}

  const cacheKey = generateCacheKey(
    `walkFiles:${root}:${exts.sort().join(',')}:${Array.from(ignoreDirs).sort().join(',')}:${includeHidden}:${gitignoreContent.length}`
  );
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const maxConcurrency = options.maxConcurrency || Math.max(2, Math.min(8, os.cpus().length));
  const queue = [root];
  const active = new Set();

  const worker = async (dir) => {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = path.relative(root, full);

      // Do not skip hidden files; ensure detection of .npmrc, .env, etc.
      if (ig && ig.ignores(rel)) continue;

      if (e.isDirectory()) {
        if (ignoreDirs.has(e.name)) continue;
        queue.push(full);
      } else if (e.isFile()) {
        if (exts.length === 0 || exts.includes(path.extname(e.name))) {
          files.push(rel);
        }
      }
    }
  };

  while (queue.length > 0 || active.size > 0) {
    while (queue.length > 0 && active.size < maxConcurrency) {
      const dir = queue.shift();
      const p = worker(dir).finally(() => active.delete(p));
      active.add(p);
    }
    if (active.size > 0) {
      await Promise.race(Array.from(active));
    }
  }
  await Promise.all(Array.from(active));
  await setCache(cacheKey, files);
  return files;
}

async function cleanup(root) {
  try {
    await rimraf.rimraf(root);
  } catch (err) {
    // ignore
  }
}

module.exports = {
  cloneRepo,
  unzipBuffer,
  walkFiles,
  cleanup,
};
