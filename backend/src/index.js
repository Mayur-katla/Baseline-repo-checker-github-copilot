require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const http = require('http');
const { Server } = require('socket.io');
const { connectDB } = require('./config/database');
const Scan = require('./models/Scan');
const queue = require('./jobs/queue');
const uuid = require('uuid');
const { Octokit } = require('@octokit/rest');
const app = express();
const server = http.createServer(app);
const scanRoutes = require('./routes/scans');
const AdmZip = require('adm-zip');
const PDFDocument = require('pdfkit');
const { summarizeVulnerabilities, summarizeHygiene, summarizeSecrets, summarizeIaC, runExternalTool, parseSemgrepJson, parseTrufflehogJson } = require('./services/securityScanner');
const fs = require('fs');
const path = require('path');
const jobsRoutes = require('./routes/jobs');
const rateLimiter = require('./middleware/rateLimit');
const { BROWSERS } = require('./services/baseline');
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:5174,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:5174')
  .split(',')
  .map(s => s.trim());
// Allow undefined origin (non-browser), any explicitly allowed origin, and any localhost port
const originCheck = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin)) return callback(null, true);
  if (/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);
  return callback(null, false);
};
const io = new Server(server, {
  cors: {
    origin: originCheck,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});
app.use(cors({ origin: originCheck, credentials: true }));
app.use(express.json({ limit: '13mb' }));

// Apply rate limiting only outside test environment
if (process.env.NODE_ENV !== 'test') {
  app.use(rateLimiter());
}

// Authorization and standardized error helpers
function getBearerToken(req) {
  const authHeader = (req.headers && (req.headers.authorization || req.headers['authorization'])) || '';
  const m = authHeader.match(/^Bearer\s+(\S+)/i);
  return (m && m[1]) ? m[1] : '';
}
function logUnauthorizedAttempt(req, context = {}) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
    const method = req.method;
    const url = req.originalUrl || req.url;
    console.warn('[UNAUTHORIZED]', { ip, method, url, ...context });
  } catch (_) {}
}
function respondUnauthorized(req, res, message, details = {}) {
  logUnauthorizedAttempt(req, { message, ...details });
  const payload = Object.assign({ error: 'Invalid credentials/access' }, details);
  if (message) payload.message = message;
  return res.status(401).json(payload);
}
function respondForbidden(res, message, details = {}) {
  const payload = Object.assign({ error: 'Access denied' }, details);
  if (message) payload.message = message;
  return res.status(403).json(payload);
}

app.use('/api/scans', scanRoutes);

app.use('/api/jobs', jobsRoutes);

// Baseline browsers endpoint
app.get('/api/browsers', (req, res) => {
  try {
    res.json({ browsers: BROWSERS });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get browsers' });
  }
});

// GitHub token preflight: validate token and return user info
app.get('/api/github/me', async (req, res) => {
  try {
    const token = getBearerToken(req) || process.env.GITHUB_TOKEN || '';
    if (!token) {
      return respondUnauthorized(req, res, 'Missing GitHub token', { authenticated: false });
    }
    const octokit = new Octokit({ auth: token });
    const resp = await octokit.rest.users.getAuthenticated();
    const scopesHeader = (resp && resp.headers && (resp.headers['x-oauth-scopes'] || resp.headers['X-OAuth-Scopes'])) || '';
    const scopes = String(scopesHeader || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    return res.json({
      authenticated: true,
      user: {
        login: resp?.data?.login || '',
        name: resp?.data?.name || '',
        id: resp?.data?.id || '',
      },
      scopes,
    });
  } catch (e) {
    const status = e?.status;
    if (status === 401) return respondUnauthorized(req, res, 'Invalid GitHub token', { authenticated: false });
    if (status === 403) return respondForbidden(res, 'Token lacks required permissions', { authenticated: false });
    return res.status(400).json({ authenticated: false, error: 'Failed to validate GitHub token' });
  }
});

// GitHub repo metadata: verify access and default branch
// Usage: GET /api/github/repo/meta?owner=ORG&repo=NAME or /api/github/repo/meta?url=https://github.com/ORG/NAME
app.get('/api/github/repo/meta', async (req, res) => {
  try {
    const token = getBearerToken(req) || process.env.GITHUB_TOKEN || '';
    if (!token) {
      return respondUnauthorized(req, res, 'Missing GitHub token');
    }
    let owner = String(req.query.owner || '').trim();
    let repo = String(req.query.repo || '').trim();
    const url = String(req.query.url || '').trim();
    if ((!owner || !repo) && url) {
      try {
        const m = url.match(/github\.com\/(.*?)\/(.*?)(?:\.git|$)/i);
        if (m) { owner = m[1]; repo = m[2]; }
      } catch (_) {}
    }
    if (!owner || !repo) {
      return res.status(400).json({ error: 'Provide owner and repo or a GitHub repo URL' });
    }
    const octokit = new Octokit({ auth: token });
    const resp = await octokit.rest.repos.get({ owner, repo });
    const data = resp?.data || {};
    return res.json({
      owner,
      repo,
      defaultBranch: data.default_branch || 'main',
      private: Boolean(data.private),
      archived: Boolean(data.archived),
      htmlUrl: data.html_url || `https://github.com/${owner}/${repo}`,
      permissions: data.permissions || {},
    });
  } catch (e) {
    const status = e?.status;
    if (status === 401) return respondUnauthorized(req, res, 'Invalid GitHub token');
    if (status === 403) return respondForbidden(res, 'Forbidden: Cannot access repository metadata');
    if (status === 404) return res.status(404).json({ error: 'Repository not found' });
    return res.status(500).json({ error: 'Failed to get repo metadata' });
  }
});

// GitHub PR preflight: check token scopes, repo permissions, and branch protection (if accessible)
// Usage: GET /api/github/pr/preflight?owner=ORG&repo=NAME or /api/github/pr/preflight?url=https://github.com/ORG/NAME
app.get('/api/github/pr/preflight', async (req, res) => {
  try {
    const token = getBearerToken(req) || process.env.GITHUB_TOKEN || '';
    if (!token) {
      return respondUnauthorized(req, res, 'Missing GitHub token', { ready: false, reasons: ['No token provided'] });
    }

    let owner = String(req.query.owner || '').trim();
    let repo = String(req.query.repo || '').trim();
    const url = String(req.query.url || '').trim();
    if ((!owner || !repo) && url) {
      try {
        const m = url.match(/github\.com\/(.*?)\/(.*?)(?:\.git|$)/i);
        if (m) { owner = m[1]; repo = m[2]; }
      } catch (_) {}
    }
    if (!owner || !repo) {
      return res.status(400).json({ ready: false, error: 'Provide owner and repo or a GitHub repo URL', reasons: ['owner/repo missing'] });
    }

    const octokit = new Octokit({ auth: token });
    const reasons = [];
    let scopes = [];
    let user = {};
    let repoInfo = {};
    let permissions = {};
    let defaultBranch = 'main';
    let protection = { accessible: false };

    // Get authenticated user and scopes
    try {
      const resp = await octokit.rest.users.getAuthenticated();
      const scopesHeader = (resp && resp.headers && (resp.headers['x-oauth-scopes'] || resp.headers['X-OAuth-Scopes'])) || '';
      scopes = String(scopesHeader || '').split(',').map(s => s.trim()).filter(Boolean);
      user = { login: resp?.data?.login || '', id: resp?.data?.id || '', name: resp?.data?.name || '' };
    } catch (e) {
      const status = e?.status;
      if (status === 401) return respondUnauthorized(req, res, 'Invalid GitHub token', { ready: false });
      if (status === 403) return respondForbidden(res, 'Token lacks permission to fetch user', { ready: false });
      reasons.push('Token could not be authenticated');
    }

    // Repo details and permissions
    try {
      const r = await octokit.rest.repos.get({ owner, repo });
      repoInfo = r?.data || {};
      permissions = repoInfo.permissions || {};
      defaultBranch = repoInfo.default_branch || 'main';
      if (repoInfo.archived) reasons.push('Repository is archived');
    } catch (e) {
      const status = e?.status;
      if (status === 401) return respondUnauthorized(req, res, 'Invalid GitHub token', { ready: false });
      if (status === 403) return respondForbidden(res, 'Forbidden: Cannot access repository', { ready: false });
      if (status === 404) return res.status(404).json({ ready: false, error: 'Repository not found' });
      return res.status(500).json({ ready: false, error: 'Could not fetch repository details' });
    }

    // Scope checks: require 'repo' for private repo; 'public_repo' or 'repo' for public
    const isPrivate = Boolean(repoInfo.private);
    const hasRepoScope = scopes.includes('repo');
    const hasPublicRepoScope = scopes.includes('public_repo');
    if (isPrivate && !hasRepoScope) reasons.push('Missing repo scope for private repository');
    if (!isPrivate && !(hasRepoScope || hasPublicRepoScope)) reasons.push('Missing public_repo or repo scope');

    // Permission checks: need push to create branch and commit, and pull to open PR
    const canPush = Boolean(permissions.push);
    const canPull = Boolean(permissions.pull);
    if (!canPush) reasons.push('Token lacks push permission to the repository');
    if (!canPull) reasons.push('Token lacks pull permission to the repository');

    // Branch protection (optional; non-fatal if not accessible)
    try {
      const bp = await octokit.rest.repos.getBranchProtection({ owner, repo, branch: defaultBranch });
      const prReviews = bp?.data?.required_pull_request_reviews || null;
      const statusChecks = bp?.data?.required_status_checks || null;
      protection = {
        accessible: true,
        requiredApprovals: prReviews?.required_approving_review_count || 0,
        dismissStale: Boolean(prReviews?.dismiss_stale_reviews),
        codeOwnerReviews: Boolean(prReviews?.require_code_owner_reviews),
        strictStatusChecks: Boolean(statusChecks?.strict),
        requiredContexts: Array.isArray(statusChecks?.contexts) ? statusChecks.contexts : [],
      };
    } catch (e) {
      protection = { accessible: false };
      // Do not add a failure reason; PR creation is allowed even with branch protections
    }

    const ready = reasons.length === 0;
    return res.json({
      ready,
      reasons,
      owner,
      repo,
      defaultBranch,
      private: isPrivate,
      permissions,
      scopes,
      user,
      protection,
    });
  } catch (e) {
    const status = e?.status || 500;
    const msg = (e && e.message) ? String(e.message) : 'Preflight check failed';
    return res.status(status).json({ ready: false, error: msg });
  }
});

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

queue.on('progress', (data) => {
  io.emit('scan_progress', data);
});

queue.on('done', (data) => {
  console.log('=== EMITTING SCAN_DONE EVENT ===');
  console.log('Event data keys:', Object.keys(data));
  console.log('Result keys:', Object.keys(data.result || {}));
  console.log('Emitting to all connected clients...');
  io.emit('scan_done', data);
  console.log('scan_done event emitted successfully');
  console.log('================================');
});

queue.on('failed', (data) => {
  io.emit('scan_failed', data);
});

const createScan = async (inputType, repoUrl, localPath, targetBrowsers, zipBuffer) => {
  const payload = { inputType, repoUrl, localPath, targetBrowsers, zipBuffer };
  payload.repoUrl = typeof payload.repoUrl === 'string' ? payload.repoUrl.trim() : payload.repoUrl;
  payload.localPath = typeof payload.localPath === 'string' ? payload.localPath.trim() : payload.localPath;
  payload.targetBrowsers = Array.isArray(payload.targetBrowsers) ? payload.targetBrowsers.map(String) : [];
  payload.zipBuffer = typeof payload.zipBuffer === 'string' ? payload.zipBuffer.trim() : payload.zipBuffer;
  const job = await queue.createJob(payload);
  return { scanId: job.id, status: job.status };
};

// Duplicate route removed; using router at app.use('/api/scans', scanRoutes)

app.get('/api/scans', async (req, res) => {
  try {
    const scans = await Scan.find({}, {
      id: 1,
      repoUrl: 1,
      status: 1,
      progress: 1,
      createdAt: 1,
      updatedAt: 1,
      _id: 0
    }).sort({ createdAt: -1 }).limit(20);
    res.json(scans);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get scans' });
  }
});

app.get('/api/scans/:id', async (req, res) => {
  try {
    const scan = await Scan.findOne({ id: req.params.id }).lean();
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    res.json(scan);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get scan' });
  }
});

app.get('/api/scans/:id/status', async (req, res) => {
  try {
    const scan = await Scan.findOne({ id: req.params.id }, {
      id: 1,
      status: 1,
      progress: 1,
      _id: 0
    }).lean();

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    res.json(scan);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get scan status' });
  }
});

app.delete('/api/scans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const scan = await Scan.findOneAndDelete({ id: id });

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    await queue.removeJob(id);

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete scan' });
  }
});

// Added endpoints to resolve 404 errors
// Duplicate route removed; handled by scans router GET /api/scans/:id/result

// Duplicate route removed; handled by scans router POST /api/scans/:id/apply

// Create a Pull Request (stubbed)
app.post(
  '/api/scans/:id/pull-request',
  [
    body('title').optional().isString(),
    body('description').optional().isString(),
    body('patch').optional().isString(),
    body('dryRun').optional().isBoolean(),
    body('allowInsecure').optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const scan = await Scan.findOne({ id }).lean();
      if (!scan) {
        return res.status(404).json({ error: 'Scan not found' });
      }

      const repoUrl = scan.repoUrl || '';
      // Derive owner/repo from URL if possible
      let owner = 'unknown';
      let repo = 'unknown';
      try {
        const m = repoUrl.match(/github\.com\/(.*?)\/(.*?)(?:\.git|$)/i);
        if (m) {
          owner = m[1];
          repo = m[2];
        }
      } catch (_) {}

      const token = getBearerToken(req) || process.env.GITHUB_TOKEN || '';
      const tokenDetected = Boolean(token);
      const appliedPatchBytes = (req.body?.patch ? Buffer.byteLength(String(req.body.patch), 'utf8') : 0);
      const branchBase = `baseline-modernization-${id}`;
      const title = (req.body?.title && String(req.body.title)) || `Baseline Modernization - ${owner}/${repo}`;
      const description = String(req.body?.description || '').trim();
      const patch = String(req.body?.patch || '');
      const dryRunReq = (req.body?.dryRun !== undefined ? Boolean(req.body.dryRun) : undefined);
      const dryRun = dryRunReq !== undefined ? dryRunReq : String(process.env.PR_DRY_RUN_DEFAULT || 'false').toLowerCase() === 'true';
      const allowInsecure = Boolean(req.body?.allowInsecure || req.query?.allowInsecure);

      // Strict mode: require token, owner/repo, and non-empty patch
      if (!tokenDetected) {
        return respondUnauthorized(req, res, 'Missing GitHub token', {
          code: 'PR_TOKEN_MISSING',
          hint: 'Provide Authorization: Bearer <token> header or set GITHUB_TOKEN in environment.'
        });
      }
      if (owner === 'unknown' || repo === 'unknown') {
        return res.status(400).json({
          error: 'Unable to derive repository owner/name from scan repoUrl',
          code: 'PR_REPO_PARSE_FAILED',
          hint: 'Ensure scan.repoUrl includes github.com/<owner>/<repo> and is a valid GitHub URL.'
        });
      }
      if (!patch || patch.trim().length === 0) {
        return res.status(400).json({
          error: 'Patch is required to create a PR',
          code: 'PR_PATCH_REQUIRED',
          hint: 'Send a unified diff string as "patch" in the request body.'
        });
      }

      // Helper: parse simplified unified diff generated by frontend buildUnifiedDiff
      // Expected shape per file:
      // --- a/<path>\n
      // +++ b/<path>\n
      // @@\n
      // -<original lines...>\n
      // +<modified lines...>\n
      function parseUnifiedDiff(input) {
        const lines = String(input || '').split(/\r?\n/);
        const files = [];
        let currentFile = null;
        let originalLines = [];
        let modifiedLines = [];
        let aPath = null;
        const pushCurrent = () => {
          if (currentFile) {
            files.push({ path: currentFile, original: originalLines.join('\n'), modified: modifiedLines.join('\n') });
          }
        };
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith('--- ')) {
            // finalize previous file block
            pushCurrent();
            currentFile = null;
            originalLines = [];
            modifiedLines = [];
            const mA = line.match(/^---\s+(?:a\/)?(.+?)\s*$/);
            aPath = mA ? mA[1] : null; // may be '/dev/null' or path
          } else if (line.startsWith('+++ ')) {
            const mB = line.match(/^\+\+\+\s+b\/(.+?)\s*$/);
            const bPath = mB ? mB[1] : null;
            currentFile = bPath || aPath || currentFile;
          } else if (line.startsWith('@@')) {
            // start hunk; ignore header metadata in simplified application
          } else if (line.startsWith('-')) {
            originalLines.push(line.substring(1));
          } else if (line.startsWith('+')) {
            modifiedLines.push(line.substring(1));
          } else {
            // ignore other context lines
          }
        }
        // finalize last
        pushCurrent();
        return files.filter(f => f && f.path);
      }

      try {
          const stage = 'octokit';
          const octokit = new Octokit({ auth: token });
          // Get repo and default branch
          const repoInfo = await octokit.repos.get({ owner, repo });
          const defaultBranch = repoInfo?.data?.default_branch || 'main';
          const baseRef = await octokit.git.getRef({ owner, repo, ref: `heads/${defaultBranch}` });
          const baseSha = baseRef?.data?.object?.sha;

          // Create branch (handle existing branch by suffixing timestamp)
          let branchName = branchBase;
          try {
            await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branchName}`, sha: baseSha });
          } catch (e) {
            const msg = String(e?.message || '');
            if (msg.includes('Reference already exists')) {
              branchName = `${branchBase}-${Date.now()}`;
              await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branchName}`, sha: baseSha });
            } else {
              throw e;
            }
          }

          // Apply unified diff by committing modified file contents to the new branch
          const changes = parseUnifiedDiff(patch);
          const summaryChangedFiles = [];
          const commitMessageBase = `${title}\n\n${description || 'Automated PR created from baseline scan.'}`;

          // Security gating: block PR when high-risk findings are present, unless allowInsecure
          const sec = scan.securityAndPerformance || {};
          const sev = sec.vulnSeveritySummary || {};
          const criticalHigh = Number(sev.critical || 0) + Number(sev.high || 0);
          const secretsCount = Array.isArray(sec.secretsFindings) ? sec.secretsFindings.length : Number((sec.toolRuns && sec.toolRuns.trufflehog && sec.toolRuns.trufflehog.findingsCount) || 0);
          const gatingEnabled = String(process.env.PR_SECURITY_GATING || 'on').toLowerCase() !== 'off';
          if (gatingEnabled && !allowInsecure && (criticalHigh > 0 || secretsCount > 0)) {
            return res.status(412).json({
              error: 'PR blocked by security gating',
              code: 'PR_SECURITY_GATE_BLOCKED',
              details: {
                criticalHighVulns: criticalHigh,
                secretsFindings: secretsCount,
                summary: sev,
                toolRuns: sec.toolRuns || {},
              },
              remedies: [
                'Run /api/security/run/semgrep and address critical/high findings',
                'Run /api/security/run/trufflehog and remove exposed secrets',
                'Re-run scan and retry PR with allowInsecure=true to acknowledge'
              ]
            });
          }

          // If dry-run requested, do not commit changes or open PR; return a summary
          if (dryRun) {
            const files = changes.map(c => String(c.path || '').replace(/^\/+/, '')).filter(Boolean);
            return res.status(200).json({
              id,
              owner,
              repo,
              defaultBranch,
              wouldCreateBranch: branchName,
              dryRunOnly: true,
              tokenDetected,
              appliedPatchBytes,
              changedFiles: files,
              provider: 'github',
              message: 'Dry-run successful. No commits or PR were made.'
            });
          }

          // Optionally keep the patch artifact for transparency
          try {
            const patchArtifactPath = `.baseline/baseline-changes-${id}.patch`;
            const patchB64 = Buffer.from(patch || 'No patch provided').toString('base64');
            await octokit.repos.createOrUpdateFileContents({
              owner,
              repo,
              path: patchArtifactPath,
              message: `${commitMessageBase}\n\nAdd patch artifact: ${patchArtifactPath}`,
              content: patchB64,
              branch: branchName,
            });
            summaryChangedFiles.push(patchArtifactPath);
          } catch (e) {
            // Non-fatal; continue with file changes
          }

          // Commit each file change (create if missing, update if exists)
          for (const change of changes) {
            const filePath = String(change.path || '').replace(/^\/+/, '');
            if (!filePath) continue;
            const newContent = String(change.modified || '');
            const contentB64 = Buffer.from(newContent).toString('base64');
            let sha = undefined;
            try {
              // Attempt to get current file on the new branch (same tip as default)
              const cur = await octokit.repos.getContent({ owner, repo, path: filePath, ref: branchName });
              if (cur && cur.data && !Array.isArray(cur.data) && cur.data.sha) {
                sha = cur.data.sha;
              }
            } catch (e) {
              // If 404, the file doesn't exist; proceed without sha to create
            }
            try {
              await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: filePath,
                message: `${commitMessageBase}\n\nApply changes to ${filePath}`,
                content: contentB64,
                branch: branchName,
                ...(sha ? { sha } : {}),
              });
              summaryChangedFiles.push(filePath);
            } catch (e) {
              // If update failed because file is missing on branch, try create without sha
              const msg = String(e?.message || '');
              if (msg.includes('sha') || /Not Found/i.test(msg)) {
                try {
                  await octokit.repos.createOrUpdateFileContents({
                    owner,
                    repo,
                    path: filePath,
                    message: `${commitMessageBase}\n\nCreate ${filePath}`,
                    content: contentB64,
                    branch: branchName,
                  });
                  summaryChangedFiles.push(filePath);
                } catch (e2) {
                  // Skip this file; continue to next
                }
              }
            }
          }

          // Open pull request
          const prBodySummary = summaryChangedFiles.length
            ? `\n\nFiles changed (${summaryChangedFiles.length}):\n- ${summaryChangedFiles.join('\n- ')}`
            : '';
          const pr = await octokit.pulls.create({
            owner,
            repo,
            title,
            body: `${description}${prBodySummary}`,
            head: branchName,
            base: defaultBranch,
          });

          const prUrl = pr?.data?.html_url || `https://github.com/${owner}/${repo}/pull/${pr?.data?.number || ''}`;
          return res.status(201).json({
            id,
            owner,
            repo,
            branch: branchName,
            prUrl,
            tokenDetected,
            appliedPatchBytes,
            provider: 'github',
            message: 'Pull Request created successfully.'
          });
      } catch (e) {
          console.error('Octokit PR creation failed:', e);
          const status = Number(e?.status) || 500;
          const msg = (e && e.message) ? String(e.message) : 'Failed to create pull request';
          return res.status(status).json({
            error: msg,
            code: 'PR_PROVIDER_ERROR',
            provider: 'github',
            stage: 'octokit',
            hint: 'Verify repository permissions, branch protection, and token scopes.'
          });
      }
    } catch (error) {
      console.error(`Error creating pull request for scan ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to create pull request', code: 'PR_CREATE_FAILED' });
    }
  }
);

// New endpoint: Download modernized report for a scan
// GET /api/report/download?scanId=...
app.get('/api/report/download', async (req, res) => {
  try {
    const { scanId } = req.query;
    if (!scanId) {
      return res.status(400).json({ error: 'scanId is required' });
    }
    const scan = await Scan.findOne({ id: scanId }).lean();
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    const payload = {
      id: scan.id,
      repoUrl: scan.repoUrl,
      repoDetails: scan.repoDetails || {},
      projectFeatures: scan.projectFeatures || {},
      architecture: scan.architecture || {},
      compatibility: scan.compatibility || {},
      securityAndPerformance: scan.securityAndPerformance || {},
      healthAndMaintenance: scan.healthAndMaintenance || {},
      modernizationSuggestions: scan.modernizationSuggestions || [],
      analytics: scan.analytics || {},
      summaryLog: scan.summaryLog || {},
      generatedAt: new Date().toISOString(),
      apiVersion: 'v1'
    };

    const filename = `scan-${scan.id}-report.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error('Error generating report download:', error);
    res.status(500).json({ error: 'Failed to download report' });
  }
});

// Unified reporting bundle: JSON + CSV + PDF in a ZIP
// GET /api/report/bundle?scanId=...
app.get('/api/report/bundle', async (req, res) => {
  try {
    const { scanId } = req.query;
    if (!scanId) return res.status(400).json({ error: 'scanId is required' });
    const scan = await Scan.findOne({ id: scanId }).lean();
    if (!scan) return res.status(404).json({ error: 'Scan not found' });

    const payload = {
      id: scan.id,
      repoUrl: scan.repoUrl,
      repoDetails: scan.repoDetails || {},
      projectFeatures: scan.projectFeatures || {},
      architecture: scan.architecture || {},
      compatibility: scan.compatibility || {},
      securityAndPerformance: scan.securityAndPerformance || {},
      healthAndMaintenance: scan.healthAndMaintenance || {},
      modernizationSuggestions: scan.modernizationSuggestions || [],
      analytics: scan.analytics || {},
      summaryLog: scan.summaryLog || {},
      generatedAt: new Date().toISOString(),
      apiVersion: 'v1'
    };

    const esc = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    const repo = payload.repoDetails || {};
    const analytics = payload.analytics || {};
    const compat = payload.compatibility || {};
    const statusData = scan || {};

    const ownerRepo = [repo.owner, repo.repoName].filter(Boolean).join('/');
    const branch = statusData?.branch || payload?.versionControl?.branch || '';
    const createdAt = statusData?.createdAt || '';
    const completedAt = statusData?.updatedAt || '';

    const lines = [];
    lines.push(['Meta','Repo', ownerRepo].map(esc).join(','));
    lines.push(['Meta','Branch', branch].map(esc).join(','));
    lines.push(['Meta','Started', createdAt].map(esc).join(','));
    lines.push(['Meta','Completed', completedAt].map(esc).join(','));
    lines.push(['Analytics','Supported', (analytics.counts?.supported || 0)].map(esc).join(','));
    lines.push(['Analytics','Partial', (analytics.counts?.partial || 0)].map(esc).join(','));
    lines.push(['Analytics','Unsupported', (analytics.counts?.unsupported || 0)].map(esc).join(','));
    lines.push(['Analytics','Suggested', (analytics.counts?.suggested || 0)].map(esc).join(','));
    (compat.supportedFeatures || []).forEach(f => lines.push(['Supported','Feature', f].map(esc).join(',')));
    (compat.partialFeatures || []).forEach(f => lines.push(['Partial','Feature', f].map(esc).join(',')));
    (compat.unsupportedCode || []).forEach(i => lines.push(['Unsupported','Item', i].map(esc).join(',')));
    (compat.missingConfigs || []).forEach(i => lines.push(['MissingConfig','File', i].map(esc).join(',')));
    (compat.recommendations || []).forEach(i => lines.push(['Recommendation','Action', i].map(esc).join(',')));
    const csv = lines.join('\n');

    const pdfBuffer = await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.fontSize(20).text('Baseline Scan Report');
        doc.moveDown();
        doc.fontSize(12).text(`Scan ID: ${payload.id}`);
        doc.text(`Repo: ${payload.repoUrl || 'N/A'}`);
        doc.text(`Generated At: ${payload.generatedAt}`);
        doc.moveDown();
        const cnt = analytics.counts || {};
        doc.fontSize(14).text('Summary');
        doc.fontSize(12).text(`Supported: ${cnt.supported || 0}`);
        doc.text(`Partial: ${cnt.partial || 0}`);
        doc.text(`Unsupported: ${cnt.unsupported || 0}`);
        doc.text(`Suggested: ${cnt.suggested || 0}`);
        doc.moveDown();
        doc.fontSize(14).text('Recommendations');
        (compat.recommendations || []).slice(0, 100).forEach((r) => {
          doc.fontSize(12).text(`• ${r}`);
        });
        doc.end();
      } catch (e) {
        reject(e);
      }
    });

    const repoName = (payload.repoDetails?.repoName || payload.repoDetails?.name || '').trim();
    const baseName = repoName && repoName.length > 0 ? repoName : `scan-${scan.id}`;
    const zip = new AdmZip();
    zip.addFile(`${baseName}-report.json`, Buffer.from(JSON.stringify(payload, null, 2), 'utf-8'));
    zip.addFile(`${baseName}-summary.csv`, Buffer.from(csv, 'utf-8'));
    zip.addFile(`${baseName}-report.pdf`, pdfBuffer);

    const bundleName = `${baseName}-bundle.zip`;
    res.setHeader('Content-Disposition', `attachment; filename="${bundleName}"`);
    res.setHeader('Content-Type', 'application/zip');
    res.status(200).send(zip.toBuffer());
  } catch (error) {
    console.error('Error generating report bundle:', error);
    res.status(500).json({ error: 'Failed to download report bundle' });
  }
});

// Compliance reporting scaffolds
// GET /api/report/compliance?scanId=...&standards=SOC2,ISO27001,GDPR
app.get('/api/report/compliance', async (req, res) => {
  try {
    const { scanId, standards = 'SOC2,ISO27001,GDPR' } = req.query;
    if (!scanId) return res.status(400).json({ error: 'scanId is required' });
    const scan = await Scan.findOne({ id: scanId }).lean();
    if (!scan) return res.status(404).json({ error: 'Scan not found' });

    const list = String(standards)
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    const sec = scan.securityAndPerformance || {};
    const env = scan.environment || {};
    const compat = scan.compatibility || {};

    const findingCount = (arr) => Array.isArray(arr) ? arr.length : 0;
    const sections = {};

    for (const std of list) {
      const baseFindings = findingCount(sec.securityVulnerabilities) + findingCount(sec.missingPolicies);
      const unsupportedCount = findingCount(compat.unsupportedCode);
      const recommendedActions = (compat.recommendations || []).slice(0, 20);
      const status = baseFindings + unsupportedCount > 0 ? 'attention' : 'pass';
      sections[std] = {
        status,
        findings: {
          vulnerabilities: baseFindings,
          unsupportedCode: unsupportedCount,
          missingPolicies: findingCount(sec.missingPolicies),
          largeAssets: findingCount(sec.largeAssets),
        },
        environmentHints: {
          languages: Array.isArray(env.languages) ? env.languages : [],
          frameworks: Array.isArray(env.primaryFrameworks) ? env.primaryFrameworks : [],
        },
        recommendations: recommendedActions,
      };
    }

    res.json({
      scanId,
      standards: list,
      sections,
      generatedAt: new Date().toISOString(),
      apiVersion: 'v1'
    });
  } catch (error) {
    console.error('Error generating compliance report:', error);
    res.status(500).json({ error: 'Failed to generate compliance report' });
  }
});

// Predictive analytics endpoint
// GET /api/analytics/predictive?scanId=...
app.get('/api/analytics/predictive', async (req, res) => {
  try {
    const { scanId } = req.query;
    if (!scanId) return res.status(400).json({ error: 'scanId is required' });
    const scan = await Scan.findOne({ id: scanId }).lean();
    if (!scan) return res.status(404).json({ error: 'Scan not found' });

    const sec = scan.securityAndPerformance || {};
    const compat = scan.compatibility || {};

    const sev = sec.vulnSeveritySummary || { low: 0, moderate: 0, high: 0, critical: 0 };
    const totalVulns = (sev.low || 0) + (sev.moderate || 0) + (sev.high || 0) + (sev.critical || 0);
    const weightedRisk = (sev.low || 0) * 5 + (sev.moderate || 0) * 10 + (sev.high || 0) * 20 + (sev.critical || 0) * 30;
    const riskScore = Math.max(0, Math.min(100, Math.round(weightedRisk)));

    const highRatio = totalVulns ? ((sev.high || 0) + (sev.critical || 0)) / totalVulns : 0;
    const trend = highRatio > 0.25 ? 'increasing' : highRatio < 0.05 ? 'decreasing' : 'stable';

    const unsupported = Array.isArray(compat.unsupportedCode) ? compat.unsupportedCode.length : 0;
    const projectedDebt = Math.round(unsupported * 3 + (sec.inefficientCode ? sec.inefficientCode.length * 2 : 0));

    const recommendations = [];
    if ((sev.critical || 0) > 0) recommendations.push('Prioritize critical vulnerabilities with immediate patches');
    if ((sev.high || 0) > 5) recommendations.push('Address high-severity issues within one sprint');
    if (unsupported > 0) recommendations.push('Refactor unsupported code paths and add polyfills where needed');
    if (trend === 'increasing') recommendations.push('Increase test coverage and enable stricter CI checks');

    res.json({
      scanId,
      riskScore,
      trend,
      projectedDebt,
      recommendations,
      generatedAt: new Date().toISOString(),
      apiVersion: 'v1'
    });
  } catch (error) {
    console.error('Error generating predictive analytics:', error);
    res.status(500).json({ error: 'Failed to generate predictive analytics' });
  }
});

// Security: SAST summary
// GET /api/security/sast?scanId=...
app.get('/api/security/sast', async (req, res) => {
  try {
    const { scanId } = req.query;
    if (!scanId) return res.status(400).json({ error: 'scanId is required' });
    const scan = await Scan.findOne({ id: scanId }).lean();
    if (!scan) return res.status(404).json({ error: 'Scan not found' });

    const sec = scan.securityAndPerformance || {};
    const env = scan.environment || {};
    const compat = scan.compatibility || {};

    const vuln = summarizeVulnerabilities(sec);
    const hygiene = summarizeHygiene(sec);
    const ciSummary = sec.ciSummary || {};

    res.json({
      scanId,
      summary: {
        vulnerabilities: vuln.counts,
        hygiene: hygiene.counts,
        unsupportedCode: Array.isArray(compat.unsupportedCode) ? compat.unsupportedCode.length : 0,
        frameworks: Array.isArray(env.primaryFrameworks) ? env.primaryFrameworks : [],
      },
      topFindings: {
        vulnerabilities: vuln.top,
        hygiene: hygiene.top,
      },
      ci: ciSummary,
      tools: [
        { name: 'semgrep', status: (sec.toolRuns?.semgrep?.status || 'not_executed'), findings: (sec.toolRuns?.semgrep?.findingsCount || 0) },
        { name: 'npm audit', status: (sec.toolRuns?.['npm audit']?.status || 'not_executed') },
        { name: 'owasp-dependency-check', status: (sec.toolRuns?.['owasp-dependency-check']?.status || 'not_executed') },
        { name: 'safety (Python)', status: (sec.toolRuns?.['safety']?.status || 'not_executed') },
      ],
      generatedAt: new Date().toISOString(),
      apiVersion: 'v1'
    });
  } catch (error) {
    console.error('Error generating SAST summary:', error);
    res.status(500).json({ error: 'Failed to generate SAST summary' });
  }
});

// Security: Secrets summary
// GET /api/security/secrets?scanId=...
app.get('/api/security/secrets', async (req, res) => {
  try {
    const { scanId } = req.query;
    if (!scanId) return res.status(400).json({ error: 'scanId is required' });
    const scan = await Scan.findOne({ id: scanId }).lean();
    if (!scan) return res.status(404).json({ error: 'Scan not found' });

    const sec = scan.securityAndPerformance || {};
    const summary = summarizeSecrets(sec);

    res.json({
      scanId,
      summary: summary.counts,
      topFindings: summary.top,
      tools: [
        { name: 'trufflehog', status: (sec.toolRuns?.trufflehog?.status || 'not_executed'), findings: (sec.toolRuns?.trufflehog?.findingsCount || 0) },
        { name: 'gitleaks', status: (sec.toolRuns?.gitleaks?.status || 'not_executed') },
        { name: 'detect-secrets', status: (sec.toolRuns?.['detect-secrets']?.status || 'not_executed') },
      ],
      generatedAt: new Date().toISOString(),
      apiVersion: 'v1'
    });
  } catch (error) {
    console.error('Error generating secrets summary:', error);
    res.status(500).json({ error: 'Failed to generate secrets summary' });
  }
});

// Infrastructure: IaC checks summary
// GET /api/iac/checks?scanId=...
app.get('/api/iac/checks', async (req, res) => {
  try {
    const { scanId } = req.query;
    if (!scanId) return res.status(400).json({ error: 'scanId is required' });
    const scan = await Scan.findOne({ id: scanId }).lean();
    if (!scan) return res.status(404).json({ error: 'Scan not found' });

    const iac = summarizeIaC(scan);
    res.json({
      scanId,
      features: {
        terraform: iac.hasTerraform,
        kubernetes: iac.hasK8s,
        docker: iac.hasDocker,
      },
      files: iac.files,
      tools: [
        { name: 'checkov', status: 'not_executed' },
        { name: 'tfsec', status: 'not_executed' },
        { name: 'dockle', status: 'not_executed' },
      ],
      generatedAt: new Date().toISOString(),
      apiVersion: 'v1'
    });
  } catch (error) {
    console.error('Error generating IaC checks summary:', error);
    res.status(500).json({ error: 'Failed to generate IaC checks summary' });
  }
});

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    const dbConnected = await connectDB();
    await queue.init(dbConnected);
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })();
}

module.exports = { app, server };

// Security: Run Semgrep (SAST)
// POST /api/security/run/semgrep { scanId, config?, cwd? }
app.post('/api/security/run/semgrep', async (req, res) => {
  try {
    const { scanId, config, cwd } = req.body || {};
    if (!scanId) return res.status(400).json({ error: 'scanId is required' });
    const scan = await Scan.findOne({ id: scanId });
    if (!scan) return res.status(404).json({ error: 'Scan not found' });

    const candidatePath = String(cwd || scan.repoUrl || '').trim();
    const workspaceRoot = candidatePath && fs.existsSync(candidatePath) ? candidatePath : null;
    if (!workspaceRoot) {
      return res.status(400).json({ error: 'Workspace path not available. Provide "cwd" (absolute path) in request body.' });
    }

    const args = ['--json', '--quiet'];
    if (config) { args.push('--config', String(config)); } else { args.push('--config', 'auto'); }
    const run = await runExternalTool('semgrep', args, { cwd: workspaceRoot });
    const parsed = parseSemgrepJson(run.output);

    const sec = scan.securityAndPerformance || {};
    sec.toolRuns = sec.toolRuns || {};
    sec.toolRuns.semgrep = {
      status: run.status,
      code: run.code,
      stderr: String(run.stderr || '').slice(0, 2000),
      findingsCount: parsed.findingsCount || 0,
      bySeverity: parsed.bySeverity || { High: 0, Medium: 0, Low: 0 },
      lastRunAt: new Date().toISOString(),
    };

    // Merge findings into securityVulnerabilities
    const vulns = Array.isArray(sec.securityVulnerabilities) ? sec.securityVulnerabilities : [];
    const toAdd = Array.isArray(parsed.results) ? parsed.results : [];
    for (const r of toAdd) {
      vulns.push({
        source: 'semgrep',
        severity: r.severity || 'Low',
        title: r.check_id || r.message || 'Semgrep finding',
        file: r.path || '',
        range: { start: r.start || null, end: r.end || null },
        description: r.message || '',
      });
    }
    sec.securityVulnerabilities = vulns;

    // Update aggregate severity summary
    const prev = sec.vulnSeveritySummary || { low: 0, moderate: 0, high: 0, critical: 0, unknown: 0 };
    const add = parsed.bySeverity || { High: 0, Medium: 0, Low: 0 };
    sec.vulnSeveritySummary = {
      low: (prev.low || 0) + (add.Low || 0),
      moderate: (prev.moderate || 0) + (add.Medium || 0),
      high: (prev.high || 0) + (add.High || 0),
      critical: prev.critical || 0,
      unknown: prev.unknown || 0,
    };

    await Scan.findOneAndUpdate(
      { id: scanId },
      {
        $set: {
          'securityAndPerformance.toolRuns.semgrep': sec.toolRuns.semgrep,
          'securityAndPerformance.securityVulnerabilities': sec.securityVulnerabilities,
          'securityAndPerformance.vulnSeveritySummary': sec.vulnSeveritySummary,
        }
      },
      { upsert: false }
    );

    return res.status(200).json({
      scanId,
      tool: 'semgrep',
      status: run.status,
      findingsCount: parsed.findingsCount || 0,
      bySeverity: parsed.bySeverity || {},
      cwd: workspaceRoot,
      apiVersion: 'v1'
    });
  } catch (error) {
    console.error('Error running semgrep:', error);
    res.status(500).json({ error: 'Failed to run semgrep' });
  }
});

// Security: Run Trufflehog (Secrets)
// POST /api/security/run/trufflehog { scanId, cwd? }
app.post('/api/security/run/trufflehog', async (req, res) => {
  try {
    const { scanId, cwd } = req.body || {};
    if (!scanId) return res.status(400).json({ error: 'scanId is required' });
    const scan = await Scan.findOne({ id: scanId });
    if (!scan) return res.status(404).json({ error: 'Scan not found' });

    const candidatePath = String(cwd || scan.repoUrl || '').trim();
    const workspaceRoot = candidatePath && fs.existsSync(candidatePath) ? candidatePath : null;
    if (!workspaceRoot) {
      return res.status(400).json({ error: 'Workspace path not available. Provide "cwd" (absolute path) in request body.' });
    }

    const args = ['filesystem', '--json', '.'];
    const run = await runExternalTool('trufflehog', args, { cwd: workspaceRoot });
    const parsed = parseTrufflehogJson(run.output);

    const sec = scan.securityAndPerformance || {};
    sec.toolRuns = sec.toolRuns || {};
    sec.toolRuns.trufflehog = {
      status: run.status,
      code: run.code,
      stderr: String(run.stderr || '').slice(0, 2000),
      findingsCount: parsed.findingsCount || 0,
      bySeverity: parsed.bySeverity || { High: 0, Medium: 0, Low: 0 },
      lastRunAt: new Date().toISOString(),
    };

    // Merge findings into secrets array
    const secrets = Array.isArray(sec.secrets) ? sec.secrets : [];
    const toAdd = Array.isArray(parsed.results) ? parsed.results : [];
    for (const r of toAdd) {
      secrets.push({
        source: 'trufflehog',
        severity: 'High',
        title: 'Potential secret',
        file: r.path || '',
        description: `Detector: ${r.detector || 'unknown'}, verified: ${r.verified}`,
        verified: Boolean(r.verified),
      });
    }
    sec.secrets = secrets;

    await Scan.findOneAndUpdate(
      { id: scanId },
      {
        $set: {
          'securityAndPerformance.toolRuns.trufflehog': sec.toolRuns.trufflehog,
          'securityAndPerformance.secrets': sec.secrets,
        }
      },
      { upsert: false }
    );

    return res.status(200).json({
      scanId,
      tool: 'trufflehog',
      status: run.status,
      findingsCount: parsed.findingsCount || 0,
      cwd: workspaceRoot,
      apiVersion: 'v1'
    });
  } catch (error) {
    console.error('Error running trufflehog:', error);
    res.status(500).json({ error: 'Failed to run trufflehog' });
  }
});
