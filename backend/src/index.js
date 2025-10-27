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

      // Detect bearer token presence from Authorization header
      const authHeader = req.headers['authorization'] || '';
      const tokenDetected = /^Bearer\s+\S+/.test(authHeader);
      const appliedPatchBytes = (req.body?.patch ? Buffer.byteLength(String(req.body.patch), 'utf8') : 0);

      // In a real implementation, we'd push a branch and call GitHub API here
      const prUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}`;

      res.status(201).json({
        id,
        owner,
        repo,
        branch: branchName,
        prUrl,
        tokenDetected,
        appliedPatchBytes,
        provider: 'github',
        mode: 'stub',
        message: tokenDetected
          ? 'Demo mode: token detected, but PR creation is stubbed; no remote changes were made.'
          : 'Demo mode: no token detected; PR creation is stubbed and no remote changes were made.'
      });
    } catch (error) {
      console.error(`Error creating pull request for scan ${req.params.id}:`, error);
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

    const zip = new AdmZip();
    zip.addFile(`scan-${scan.id}-report.json`, Buffer.from(JSON.stringify(payload, null, 2), 'utf-8'));
    zip.addFile(`scan-${scan.id}-summary.csv`, Buffer.from(csv, 'utf-8'));
    zip.addFile(`scan-${scan.id}-report.pdf`, pdfBuffer);

    const bundleName = `scan-${scan.id}-bundle.zip`;
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
