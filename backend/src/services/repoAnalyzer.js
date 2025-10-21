const os = require('os');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const simpleGit = require('simple-git');
const AdmZip = require('adm-zip');
const ignore = require('ignore');
const fetch = globalThis.fetch || (function () { try { return require('node-fetch'); } catch (_) { return undefined; } })();
const { getCache, setCache, generateCacheKey } = require('./caching');

async function getDirectorySize(dir) {
  let total = 0;
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        total += await getDirectorySize(full);
      } else if (e.isFile()) {
        try { const s = await fs.promises.stat(full); total += s.size || 0; } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
  return total;
}

async function pruneRepoCache(cacheRoot, { maxBytes = 2 * 1024 * 1024 * 1024, ttlMs = 30 * 24 * 60 * 60 * 1000 } = {}) {
  try {
    if (!fs.existsSync(cacheRoot)) return;
    const names = await fs.promises.readdir(cacheRoot);
    const items = [];
    let total = 0;
    for (const name of names) {
      const full = path.join(cacheRoot, name);
      try {
        const st = await fs.promises.stat(full);
        const size = await getDirectorySize(full);
        total += size;
        items.push({ full, size, mtimeMs: st.mtimeMs });
      } catch { /* ignore */ }
    }

    const now = Date.now();
    // Remove expired by TTL first
    for (const it of items) {
      if (ttlMs > 0 && (now - it.mtimeMs) > ttlMs) {
        try { await rimraf.rimraf(it.full); } catch { /* ignore */ }
      }
    }

    // Recompute sizes after TTL purge
    const remainingNames = await fs.promises.readdir(cacheRoot);
    const remaining = [];
    total = 0;
    for (const name of remainingNames) {
      const full = path.join(cacheRoot, name);
      try {
        const st = await fs.promises.stat(full);
        const size = await getDirectorySize(full);
        total += size;
        remaining.push({ full, size, mtimeMs: st.mtimeMs });
      } catch { /* ignore */ }
    }

    if (maxBytes > 0 && total > maxBytes) {
      // Sort by last modified ascending (oldest first)
      remaining.sort((a, b) => a.mtimeMs - b.mtimeMs);
      while (remaining.length && total > maxBytes) {
        const victim = remaining.shift();
        try { await rimraf.rimraf(victim.full); } catch { /* ignore */ }
        total -= victim.size;
      }
    }
  } catch { /* ignore */ }
}
async function cloneRepo(repoUrl, options = {}) {
  const { branch, ref, sparsePaths = [], retryAttempts = 3 } = options || {};
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-'));
  const git = simpleGit();
  try {
    console.log(`Cloning repository with URL: ${repoUrl}`);
    const normalize = (s) => String(s || '').trim();
    const requested = normalize(ref) || normalize(branch);
    const isSha = /^[a-f0-9]{7,40}$/i.test(requested);

    // Attempt local cache + git worktree strategy first
    const cacheRoot = path.resolve(__dirname, '../../.cache', 'repos');
    try { fs.mkdirSync(cacheRoot, { recursive: true }); } catch (_) {}
    // Apply cache policy: TTL + max size
    const maxMB = Number(process.env.CACHE_MAX_MB || 2048);
    const ttlDays = Number(process.env.CACHE_TTL_DAYS || 30);
    await pruneRepoCache(cacheRoot, { maxBytes: Math.max(0, maxMB) * 1024 * 1024, ttlMs: Math.max(0, ttlDays) * 24 * 60 * 60 * 1000 });
    const keyBase = generateCacheKey(`repoCache:${repoUrl}`);
    const safeKey = String(keyBase).replace(/[^a-z0-9_\-]/gi, '-');
    const cacheDir = path.join(cacheRoot, safeKey);
    let usedCache = false;
    try {
      if (fs.existsSync(cacheDir)) {
        const cacheGit = simpleGit({ baseDir: cacheDir });
        // Keep cache up to date
        await cacheGit.fetch(['--all', '--tags', '--prune']);
        // Create worktree for requested ref/branch or default HEAD
        if (requested) {
          if (isSha) {
            await cacheGit.raw(['worktree', 'add', '--detach', tmp, requested]);
          } else {
            try {
              // Ensure local branch exists tracking origin
              const branches = await cacheGit.branchLocal();
              const exists = branches.all.includes(requested);
              if (!exists) {
                await cacheGit.raw(['branch', '--track', requested, `origin/${requested}`]);
              }
            } catch (_) {}
            await cacheGit.raw(['worktree', 'add', tmp, requested]);
          }
        } else {
          await cacheGit.raw(['worktree', 'add', '--detach', tmp, 'HEAD']);
        }
        usedCache = true;
      } else {
        // Initialize cache repository with partial clone
        const cacheCloneArgs = ['--filter', 'blob:none'];
        let lastErrCache = null;
        for (let attempt = 1; attempt <= (retryAttempts || 3); attempt++) {
          try {
            await git.clone(repoUrl, cacheDir, cacheCloneArgs);
            lastErrCache = null;
            break;
          } catch (e) {
            lastErrCache = e;
            const delay = Math.min(8000, 1000 * Math.pow(2, attempt - 1));
            console.warn(`Cache clone attempt ${attempt} failed; retrying in ${delay}ms`);
            await new Promise(r => setTimeout(r, delay));
          }
        }
        if (!lastErrCache) {
          const cacheGit = simpleGit({ baseDir: cacheDir });
          // Fetch requested ref shallowly if provided
          if (requested) {
            if (isSha) {
              await cacheGit.fetch(['--depth', '1', 'origin', requested]);
            } else {
              await cacheGit.fetch(['--tags', 'origin', requested]);
            }
          }
          if (requested) {
            if (isSha) {
              await cacheGit.raw(['worktree', 'add', '--detach', tmp, requested]);
            } else {
              // Try worktree from remote branch; fallback to local branch
              try {
                await cacheGit.raw(['worktree', 'add', '-b', requested, tmp, `origin/${requested}`]);
              } catch (_) {
                await cacheGit.raw(['worktree', 'add', tmp, requested]);
              }
            }
          } else {
            await cacheGit.raw(['worktree', 'add', '--detach', tmp, 'HEAD']);
          }
          usedCache = true;
        }
      }
    } catch (_) {
      usedCache = false;
    }

    // If cache strategy didn’t produce a workspace, fall back to direct clone
    let lastErr = null;
    if (!usedCache) {
      const cloneArgs = ['--depth', '1', '--filter', 'blob:none'];
      // Only pass --branch when it looks like a branch or tag name, not a raw SHA
      if (requested && !isSha) {
        cloneArgs.push('--branch', requested, '--single-branch');
      }
      for (let attempt = 1; attempt <= (retryAttempts || 3); attempt++) {
        try {
          await git.clone(repoUrl, tmp, cloneArgs);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          const delay = Math.min(8000, 1000 * Math.pow(2, attempt - 1));
          console.warn(`Clone attempt ${attempt} failed; retrying in ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
        }
      }

      // Fallback to GitHub zipball archive for private/repos when clone fails
      if (lastErr) {
        try {
          const m = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\.git|$)/i);
          const token = process.env.GITHUB_TOKEN;
          if (m && token && fetch) {
            const owner = m[1];
            const repoName = m[2];
            const refOrDefault = requested || '';
            const zipUrl = refOrDefault
              ? `https://api.github.com/repos/${owner}/${repoName}/zipball/${encodeURIComponent(refOrDefault)}`
              : `https://api.github.com/repos/${owner}/${repoName}/zipball`;
            const resp = await fetch(zipUrl, {
              headers: {
                Authorization: `Bearer ${token}`,
                'User-Agent': 'Baseline-Repo-Scanner',
                Accept: 'application/zip'
              }
            });
            if (!resp.ok) {
              throw new Error(`GitHub zipball fetch failed: ${resp.status} ${resp.statusText}`);
            }
            const buf = typeof resp.buffer === 'function' ? await resp.buffer() : Buffer.from(await resp.arrayBuffer());
            const unzipPath = await unzipBuffer(buf);
            console.log(`Zipball fallback extracted to: ${unzipPath}`);
            try { await rimraf(tmp); } catch (_) {}
            return unzipPath;
          }
        } catch (zipErr) {
          console.error('Zipball fallback failed', zipErr);
        }
        // No fallback succeeded; throw original clone error
        throw lastErr;
      }
    }

    const repo = simpleGit({ baseDir: tmp });

    // Handle submodules (init/update with shallow depth)
    try {
      await repo.raw(['submodule', 'update', '--init', '--depth', '1']);
    } catch (_) {}

    // Optional sparse-checkout for large repos
    if (Array.isArray(sparsePaths) && sparsePaths.length > 0) {
      try {
        await repo.raw(['sparse-checkout', 'init', '--cone']);
        await repo.raw(['sparse-checkout', 'set', ...sparsePaths]);
      } catch (_) {}
    }

    // Post-clone: fetch and checkout specific ref (tag or SHA)
    if (requested) {
      try {
        if (isSha) {
          // Fetch the specific commit to ensure it exists locally with shallow history
          await repo.fetch(['--depth', '1', 'origin', requested]);
          await repo.checkout(requested);
        } else {
          // Tag or branch; ensure tags are available for tag checkout
          await repo.fetch(['--tags']);
          await repo.checkout(requested);
        }
      } catch (_) {
        // Fallback: try plain checkout even if fetch fails
        try { await repo.checkout(requested); } catch (e) { /* swallow */ }
      }
    }

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

// Add LFS pattern reader from .gitattributes to allow skipping LFS-managed files
function readGitAttributesLfsPatterns(root) {
  const attrPath = path.join(root, '.gitattributes');
  let patterns = [];
  try {
    if (!fs.existsSync(attrPath)) return [];
    const content = fs.readFileSync(attrPath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split(/\s+/);
      const pat = parts[0];
      const attrs = parts.slice(1);
      const isLfs = attrs.some(a => /filter\s*=\s*lfs|diff\s*=\s*lfs|merge\s*=\s*lfs/i.test(a));
      if (isLfs) {
        patterns.push(pat);
      }
    }
  } catch (_) {}
  // Convert git wildmatch-like pattern to a basic regex
  const toRegex = (p) => {
    const norm = String(p).replace(/\\/g, '/');
    let reStr = norm
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    return new RegExp(`^${reStr}$`);
  };
  return patterns.map(toRegex);
}

async function walkFiles(root, options = {}) {
  const exts = options.extensions || [];
  const includeHidden = options.includeHidden ?? false;
  const userIgnore = options.ignoreDirs || [];
  const excludePatterns = options.excludePaths || [];
  // Merge env-provided user excludes
  const envExcludes = String(process.env.SCAN_USER_EXCLUDE_PATHS || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
  const mergedExcludePatterns = Array.from(new Set([...excludePatterns, ...envExcludes]));
  const defaultIgnoreDirs = [
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
    'coverage', '.cache', 'tmp', 'vendor', 'target', 'out',
    '.svelte-kit', '.gradle', '__pycache__', 'venv', '.venv',
    '.mypy_cache', '.pytest_cache', '.yarn', '.pnpm', '.idea', '.vscode'
  ];
  const ignoreDirs = new Set([...defaultIgnoreDirs, ...userIgnore]);
  const files = [];
  const ig = readGitignore(root);

  const skipLfsFiles = (options.skipLfsFiles ?? (String(process.env.SCAN_SKIP_LFS || '').toLowerCase() === 'true')) === true;
  const maxFileMB = Number(options.maxFileMB || process.env.SCAN_MAX_FILE_MB || 0);
  const maxFileBytes = (options.maxFileBytes ?? (maxFileMB > 0 ? maxFileMB * 1024 * 1024 : 0)) || 0;
  const lfsMatchers = skipLfsFiles ? readGitAttributesLfsPatterns(root) : [];

  const isExcluded = (relPath) => {
    const norm = String(relPath).replace(/\\/g, '/');
    return mergedExcludePatterns.some(p => norm.includes(String(p)));
  };

  let gitignoreContent = '';
  try {
    const gitignorePath = path.join(root, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    }
  } catch {}

  const cacheKey = generateCacheKey(
    `walkFiles:${root}:${exts.sort().join(',')}:${Array.from(ignoreDirs).sort().join(',')}:${includeHidden}:${gitignoreContent.length}:${mergedExcludePatterns.sort().join(',')}:${skipLfsFiles}:${maxFileBytes}`
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
      const relNorm = String(rel).replace(/\\/g, '/');

      // Do not skip hidden files; ensure detection of .npmrc, .env, etc.
      if (ig && ig.ignores(rel)) continue;

      // Honor user-provided exclude patterns
      if (mergedExcludePatterns.length > 0 && isExcluded(relNorm)) continue;

      if (e.isDirectory()) {
        if (ignoreDirs.has(e.name)) continue;
        // Exclude directories by pattern as well
        if (mergedExcludePatterns.length > 0 && isExcluded(relNorm)) continue;
        queue.push(full);
      } else if (e.isFile()) {
        if (exts.length === 0 || exts.includes(path.extname(e.name))) {
          // Skip LFS-managed paths based on .gitattributes
          if (skipLfsFiles) {
            const isLfs = lfsMatchers.some((re) => re.test(relNorm));
            if (isLfs) continue;
          }
          // Skip files larger than maxFileBytes when configured
          if (maxFileBytes > 0) {
            try {
              const st = await fs.promises.stat(full);
              if ((st.size || 0) > maxFileBytes) continue;
            } catch (_) {}
          }
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
    const tmpBase = path.resolve(os.tmpdir());
    const absRoot = path.resolve(root || '');
    const isTemp = absRoot.startsWith(tmpBase) && path.basename(absRoot).startsWith('repo-');
    if (isTemp) {
      await rimraf.rimraf(root);
    }
  } catch (err) {
    // ignore
  }
}

async function getCommitMetadata(root) {
  const git = simpleGit({ baseDir: root });
  let commitSha = '';
  let defaultBranch = '';
  try {
    commitSha = await git.revparse(['HEAD']);
  } catch (_) {}
  try {
    const remoteInfo = await git.raw(['remote', 'show', 'origin']);
    const m = remoteInfo.match(/HEAD branch:\s*(\S+)/);
    if (m) defaultBranch = m[1];
  } catch (_) {}
  return { commitSha, defaultBranch };
}

async function getChangedPaths(root, baseRef, compareRef) {
  try {
    if (!baseRef || String(baseRef).trim().length === 0) return [];
    const repo = simpleGit({ baseDir: root });
    const norm = (s) => String(s || '').trim();
    const left = norm(baseRef);
    const right = norm(compareRef) || 'HEAD';
    const isSha = (s) => /^[a-f0-9]{7,40}$/i.test(String(s || ''));

    // Shallow fetch both refs when not HEAD
    try {
      if (left && left !== 'HEAD') {
        if (isSha(left)) await repo.fetch(['--depth', '1', 'origin', left]);
        else await repo.fetch(['--tags', 'origin', left]);
      }
      if (right && right !== 'HEAD') {
        if (isSha(right)) await repo.fetch(['--depth', '1', 'origin', right]);
        else await repo.fetch(['--tags', 'origin', right]);
      }
    } catch (_) {}

    const diffOut = await repo.diff(["--name-only", `${left}..${right}`]);
    const lines = String(diffOut || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return lines.map(p => p.replace(/\\/g, '/'));
  } catch (_) {
    return [];
  }
}
module.exports = {
  cloneRepo,
  unzipBuffer,
  walkFiles,
  cleanup,
  getCommitMetadata,
  getChangedPaths,
};
