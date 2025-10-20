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
// const { Octokit } = require('@octokit/rest');
const app = express();
const server = http.createServer(app);
const scanRoutes = require('./routes/scans');
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

app.use('/api/scans', scanRoutes);

// Baseline browsers endpoint
app.get('/api/browsers', (req, res) => {
  try {
    res.json({ browsers: BROWSERS });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get browsers' });
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

      // Stub PR number and branch
      const prNumber = Math.floor(100 + Math.random() * 900);
      const branchName = `baseline-modernization-${id}`;

      // In a real implementation, we'd push a branch and call GitHub API here
      const prUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}`;

      res.status(201).json({
        id,
        branch: branchName,
        prUrl,
        provider: 'github',
        message: 'PR creation is stubbed for demo; no remote changes were made.'
      });
    } catch (error) {
      console.error(`Error creating pull request for scan ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to create pull request' });
    }
  }
);

// New endpoint: Create a Pull Request via unified route (stubbed)
// Accepts { scanId, title, description, patch }
app.post(
  '/api/github/pr',
  [
    body('scanId').isString(),
    body('title').optional().isString(),
    body('description').optional().isString(),
    body('patch').optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { scanId, title, description, patch } = req.body;
      const scan = await Scan.findOne({ id: scanId }).lean();
      if (!scan) {
        return res.status(404).json({ error: 'Scan not found' });
      }

      const repoUrl = scan.repoUrl || '';
      let owner = 'unknown';
      let repo = 'unknown';
      try {
        const m = repoUrl.match(/github\.com\/(.*?)\/(.*?)(?:\.git|$)/i);
        if (m) {
          owner = m[1];
          repo = m[2];
        }
      } catch (_) {}

      if (owner === 'unknown' || repo === 'unknown') {
        return res.status(400).json({ error: 'Could not determine repository owner and name from URL.' });
      }

      const { Octokit } = require('@octokit/rest');
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      const branchName = `baseline-modernization-${scanId}`;

      // 1. Get default branch
      const { data: repoData } = await octokit.repos.get({ owner, repo });
      const baseBranch = repoData.default_branch;
      const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
      const baseSha = refData.object.sha;

      // 2. Create new branch
      try {
        await octokit.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        });
      } catch (error) {
        // If branch already exists, we can either fail or try to update it.
        // For this example, we'll fail.
        if (error.status === 422) {
          return res.status(422).json({ error: `Branch ${branchName} already exists.` });
        }
        throw error;
      }

      // 3. Create a commit with the patch.
      // Note: This is a simplified example. A real implementation would need to handle creating a blob, then a tree, then a commit.
      // For this hackathon, we'll use a trick: create a file to represent the patch.
      const { data: commitData } = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: `patches/${scanId}.diff`,
        message: title || `Apply baseline modernization patch for scan ${scanId}`,
        content: Buffer.from(patch).toString('base64'),
        branch: branchName,
      });

      // 4. Create Pull Request
      const { data: prData } = await octokit.pulls.create({
        owner,
        repo,
        title: title || `Baseline Modernization - Scan ${scanId}`,
        head: branchName,
        base: baseBranch,
        body: description || `Automated PR generated from baseline scan.`,
      });

      res.status(201).json({
        id: scanId,
        branch: branchName,
        prUrl: prData.html_url,
        provider: 'github',
        message: 'Pull Request created successfully.'
      });
    } catch (error) {
      console.error(`Error creating pull request via /api/github/pr:`, error);
      res.status(500).json({ error: 'Failed to create pull request' });
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
