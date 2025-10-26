const queue = require('../jobs/queue');
const Scan = require('../models/Scan');
const { getRedis } = require('../utils/redisClient');

const createScan = async (req, res) => {
  try {
    // Accept both baseline contract shape and legacy fields
    const { inputType, repoUrl, localPath, zipBuffer, branch, ref: refTop, baseRef: baseRefTop, compareRef: compareRefTop, targetBrowsers: targetBrowsersTop, excludePaths: excludePathsTop, sparsePaths: sparsePathsTop, config = {} } = req.body;
    const targetBrowsers = config.targetBrowsers ?? targetBrowsersTop;
    const excludePaths = Array.isArray(config.excludePaths) ? config.excludePaths : (Array.isArray(excludePathsTop) ? excludePathsTop : []);
    const ref = (typeof config.ref === 'string' ? config.ref : undefined) ?? refTop;
    const baseRef = (typeof config.baseRef === 'string' ? config.baseRef : undefined) ?? baseRefTop;
    const compareRef = (typeof config.compareRef === 'string' ? config.compareRef : undefined) ?? compareRefTop;
    const sparsePaths = Array.isArray(config.sparsePaths) ? config.sparsePaths : (Array.isArray(sparsePathsTop) ? sparsePathsTop : []);
    const job = await queue.createJob({ inputType, repoUrl, localPath, targetBrowsers, zipBuffer });
    res.status(201).json({ scanId: job.id, status: job.status });
  } catch (error) {
    console.error('Error creating scan:', error);
    res.status(500).json({ error: 'Failed to create scan' });
  }
};

const getScanStatus = async (req, res) => {
  const { id } = req.params;
  const redis = getRedis?.() || null;
  const cacheKey = `scan:status:${id}`;
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    } catch (_) {}
  }

  try {
    const job = await queue.getJob(id);
    if (job) {
      const createdAt = Number(job.createdAt || Date.now());
      const progress = Number(job.progress || 0);
      let etaMs = null;
      if ((job.status === 'done') || progress >= 100) {
        etaMs = 0;
      } else if (progress > 0) {
        const elapsed = Date.now() - createdAt;
        etaMs = Math.round(elapsed * ((100 - progress) / progress));
      }
      const payload = { scanId: job.id, status: job.status, progress: job.progress };
      if (redis) { try { await redis.setex(cacheKey, 30, JSON.stringify(payload)); } catch (_) {} }
      return res.json(payload);
    } else {
      res.status(404).json({ error: 'Scan not found' });
    }
  } catch (error) {
    console.error(`Error getting status for scan ${id}:`, error);
    res.status(500).json({ error: 'Failed to get scan status' });
  }
};

const getScanResult = async (req, res) => {
  const { id } = req.params;
  const redis = getRedis?.() || null;
  const cacheKey = `scan:result:${id}`;
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    } catch (_) {}
  }

  try {
    const job = await queue.getJob(id);
    if (job && (job.status === 'done' || job.status === 'completed')) {
      const payload = { scanId: job.id, status: job.status, result: job.result };
      if (redis) { try { await redis.setex(cacheKey, 600, JSON.stringify(payload)); } catch (_) {} }
      return res.json(payload);
    } else if (job) {
      res.status(202).json({ scanId: job.id, status: job.status, message: 'Scan is not yet complete.' });
    } else {
      res.status(404).json({ error: 'Scan not found' });
    }
  } catch (error) {
    console.error(`Error getting result for scan ${id}:`, error);
    res.status(500).json({ error: 'Failed to get scan result' });
  }
};

const getScanSuggestions = async (req, res) => {
  const { id } = req.params;
  try {
    // Prefer DB if available
    try {
      const scan = await Scan.findOne({ id }, { aiSuggestions: 1, status: 1, _id: 0 }).lean();
      const ai = scan?.aiSuggestions;
      const dbHasItems = Array.isArray(ai?.items) ? ai.items.length > 0 : (ai && Object.keys(ai).length > 0);
      if (scan && dbHasItems) {
        const count = Array.isArray(ai?.items) ? ai.items.length : Object.keys(ai || {}).length;
        console.debug('[suggestions] source=db', { id, count });
        return res.json({ scanId: id, status: scan.status || 'done', aiSuggestions: ai });
      }
    } catch (_) {}

    // Fallback to job cache
    const job = await queue.getJob(id);
    if (job) {
      const completed = (job.status === 'done' || job.status === 'completed');
      const aiJob = job.result?.aiSuggestions;
      const legacy = job.result?.suggestions;
      const jobHasItems = Array.isArray(aiJob?.items) ? aiJob.items.length > 0 : (aiJob && Object.keys(aiJob).length > 0);
      if (completed && jobHasItems) {
        const count = Array.isArray(aiJob?.items) ? aiJob.items.length : Object.keys(aiJob || {}).length;
        console.debug('[suggestions] source=job', { id: job.id, count });
        return res.json({ scanId: job.id, status: job.status, aiSuggestions: aiJob });
      }
      if (completed && Array.isArray(legacy) && legacy.length > 0) {
        console.debug('[suggestions] source=job_legacy', { id: job.id, count: legacy.length });
        return res.json({ scanId: job.id, status: job.status, aiSuggestions: { items: legacy } });
      }
      console.debug('[suggestions] pending', { id: job.id, status: job.status });
      return res.status(202).json({ scanId: job.id, status: job.status, message: 'Scan is not yet complete.' });
    }
    console.debug('[suggestions] not_found', { id });
    return res.status(404).json({ error: 'Scan not found' });
  } catch (error) {
    console.error(`Error getting suggestions for scan ${id}:`, error);
    res.status(500).json({ error: 'Failed to get scan suggestions' });
  }
};

const applyScanChanges = async (req, res) => {
  const { id } = req.params;
  const { changes } = req.body;

  try {
    const job = await queue.createApplyJob(id, changes);
    res.status(202).json({ applyJobId: job.id, status: job.status });
  } catch (error) {
    console.error(`Error applying changes for scan ${id}:`, error);
    res.status(500).json({ error: 'Failed to apply changes' });
  }
};

// Snapshot helper (DB first, fallback to job cache)
async function getSnapshot(id) {
  try {
    const scan = await Scan.findOne({ id }, { _id: 0 }).lean();
    if (scan) {
      const features = scan.features instanceof Map ? Object.fromEntries(scan.features) : (scan.features || {});
      const baseline = scan.baselineMapping instanceof Map ? Object.fromEntries(scan.baselineMapping) : (scan.baselineMapping || {});
      return {
        source: 'db', id,
        features,
        baseline,
        aiSuggestions: scan.aiSuggestions || {},
        architecture: scan.architecture || {},
        compatibility: scan.compatibility || {},
        environment: scan.environment || {},
        securityAndPerformance: scan.securityAndPerformance || {},
        projectFeatures: scan.projectFeatures || {}
      };
    }
  } catch (_) {}
  const job = await queue.getJob(id);
  if (!job) return null;
  const res = job.result || {};
  return {
    source: 'job', id,
    features: res.detectedFeatures?.features || {},
    baseline: res.baseline || {},
    aiSuggestions: res.aiSuggestions || {},
    architecture: res.architecture || res.detectedFeatures?.architecture || {},
    compatibility: res.compatibility || res.detectedFeatures?.compatibility || {},
    environment: res.environment || res.detectedFeatures?.environment || {},
    securityAndPerformance: res.securityAndPerformance || res.detectedFeatures?.securityAndPerformance || {},
    projectFeatures: res.projectFeatures || res.detectedFeatures?.projectFeatures || {}
  };
}

async function compareScans(req, res) {
  const a = String(req.query.a || '').trim();
  const b = String(req.query.b || '').trim();
  if (!a || !b) return res.status(400).json({ error: 'Query params a and b are required' });
  try {
    const snapA = await getSnapshot(a);
    const snapB = await getSnapshot(b);
    if (!snapA || !snapB) return res.status(404).json({ error: 'One or both scans not found' });

    const allFiles = Array.from(new Set([...Object.keys(snapA.features || {}), ...Object.keys(snapB.features || {})]));
    const featuresDelta = { addedByFile: {}, removedByFile: {}, changedByFile: {} };
    for (const file of allFiles) {
      const setA = new Set((snapA.features[file] || []).map(String));
      const setB = new Set((snapB.features[file] || []).map(String));
      const added = Array.from([...setB].filter(x => !setA.has(x)));
      const removed = Array.from([...setA].filter(x => !setB.has(x)));
      if (added.length) featuresDelta.addedByFile[file] = added;
      if (removed.length) featuresDelta.removedByFile[file] = removed;
      const intersection = Array.from([...setA].filter(x => setB.has(x)));
      const changed = [];
      for (const feat of intersection) {
        const baseA = (snapA.baseline[file] || []).find(x => x.feature === feat || x.feature === String(feat));
        const baseB = (snapB.baseline[file] || []).find(x => x.feature === feat || x.feature === String(feat));
        const statusA = baseA?.status || 'unknown';
        const statusB = baseB?.status || 'unknown';
        if (statusA !== statusB) changed.push({ feature: feat, from: statusA, to: statusB });
      }
      if (changed.length) featuresDelta.changedByFile[file] = changed;
    }

    const itemsA = Array.isArray(snapA.aiSuggestions?.items) ? snapA.aiSuggestions.items : [];
    const itemsB = Array.isArray(snapB.aiSuggestions?.items) ? snapB.aiSuggestions.items : [];
    const idsA = new Set(itemsA.map(s => s.id || `${s.file}:${s.title}`));
    const idsB = new Set(itemsB.map(s => s.id || `${s.file}:${s.title}`));
    const suggestionsDelta = {
      added: itemsB.filter(s => !idsA.has(s.id || `${s.file}:${s.title}`)),
      removed: itemsA.filter(s => !idsB.has(s.id || `${s.file}:${s.title}`)),
    };

    const diffList = (arrA = [], arrB = []) => {
      const A = new Set(arrA.map(String));
      const B = new Set(arrB.map(String));
      return { added: Array.from([...B].filter(x => !A.has(x))), removed: Array.from([...A].filter(x => !B.has(x))) };
    };

    const archDelta = {
      frameworks: diffList(snapA.architecture?.frameworks, snapB.architecture?.frameworks),
      configFiles: diffList(snapA.architecture?.configFiles, snapB.architecture?.configFiles),
      buildTools: diffList(snapA.architecture?.buildTools, snapB.architecture?.buildTools),
    };

    const summarizeBaseline = (baselineObj = {}) => {
      const counts = { supported: 0, partial: 0, unsupported: 0, unknown: 0 };
      for (const file of Object.keys(baselineObj)) {
        for (const entry of baselineObj[file] || []) {
          const s = String(entry?.status || 'unknown').toLowerCase();
          if (s === 'supported') counts.supported++; else if (s === 'partial') counts.partial++; else if (s === 'unsupported') counts.unsupported++; else counts.unknown++;
        }
      }
      return counts;
    };
    const baseA = summarizeBaseline(snapA.baseline);
    const baseB = summarizeBaseline(snapB.baseline);
    const baselineDelta = {
      supported: baseB.supported - baseA.supported,
      partial: baseB.partial - baseA.partial,
      unsupported: baseB.unsupported - baseA.unsupported,
      unknown: baseB.unknown - baseA.unknown,
    };

    const summary = {
      filesChanged: Object.keys(featuresDelta.changedByFile).length,
      featuresAdded: Object.values(featuresDelta.addedByFile).reduce((acc, v) => acc + v.length, 0),
      featuresRemoved: Object.values(featuresDelta.removedByFile).reduce((acc, v) => acc + v.length, 0),
      suggestionsAdded: suggestionsDelta.added.length,
      suggestionsRemoved: suggestionsDelta.removed.length,
    };

    return res.json({
      scans: { a, b, sourceA: snapA.source, sourceB: snapB.source },
      summary,
      delta: { features: featuresDelta, baseline: baselineDelta, suggestions: suggestionsDelta, architecture: archDelta },
    });
  } catch (err) {
    console.error('compareScans error', err);
    res.status(500).json({ error: 'Failed to compare scans' });
  }
}

async function getScanImpact(req, res) {
  const { id } = req.params;
  try {
    const snap = await getSnapshot(id);
    if (!snap) return res.status(404).json({ error: 'Scan not found' });

    const impactByFile = {};
    const rank = (s) => { const v = String(s || 'unknown').toLowerCase(); return v === 'unsupported' ? 3 : v === 'partial' ? 2 : v === 'supported' ? 1 : 1; };
    for (const file of Object.keys(snap.baseline || {})) {
      const entries = snap.baseline[file] || [];
      const score = entries.reduce((acc, e) => acc + rank(e?.status), 0);
      const unsupported = entries.filter(e => String(e?.status).toLowerCase() === 'unsupported').length;
      const partial = entries.filter(e => String(e?.status).toLowerCase() === 'partial').length;
      impactByFile[file] = { score, unsupported, partial, total: entries.length };
    }

    const topImpacted = Object.entries(impactByFile).sort((a, b) => b[1].score - a[1].score).slice(0, 15).map(([file, stats]) => ({ file, ...stats }));

    return res.json({ scanId: id, impactByFile, topImpacted });
  } catch (err) {
    console.error('getScanImpact error', err);
    res.status(500).json({ error: 'Failed to compute impact' });
  }
}

function streamScanProgress(req, res) {
  const { id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  let closed = false;
  const heartbeat = setInterval(() => {
    try { res.write(':\n\n'); } catch (_) {}
  }, 30000);

  const send = (event, payload) => {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (_) {}
  };

  queue.getJob(id).then(job => {
    if (!job) {
      send('error', { id, error: 'Scan not found' });
      cleanup();
      return;
    }
    send('status', { id: job.id, status: job.status, progress: job.progress });
  }).catch(() => { send('error', { id, error: 'Scan lookup failed' }); });

  const startTime = Date.now();

  const computeEta = (progress) => {
    if (closed) return 0;
    const p = Math.min(99, Math.max(1, Number(progress || 0)));
    const elapsed = Math.max(0, Date.now() - startTime);
    return Math.round(elapsed * ((100 - p) / p));
  };

  const onProgress = ({ id: jobId, progress, step }) => {
    if (jobId !== id) return;
    send('progress', { id, progress, step, etaMs: computeEta(progress) });
  };

  const onDone = ({ id: jobId, result }) => {
    if (jobId !== id) return;
    send('done', { id, progress: 100, result });
    cleanup();
  };

  const onRemoved = ({ id: jobId }) => {
    if (jobId !== id) return;
    send('removed', { id });
    cleanup();
  };

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    queue.off('progress', onProgress);
    queue.off('done', onDone);
    queue.off('removed', onRemoved);
    try { res.end(); } catch (_) {}
  };

  req.on('close', cleanup);

  queue.on('progress', onProgress);
  queue.on('done', onDone);
  queue.on('removed', onRemoved);
}

module.exports = {
  createScan,
  getScanStatus,
  getScanResult,
  getScanSuggestions,
  applyScanChanges,
  compareScans,
  getScanImpact,
  streamScanProgress,
};