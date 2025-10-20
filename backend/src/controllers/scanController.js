const queue = require('../jobs/queue');
const Scan = require('../models/Scan');

const createScan = async (req, res) => {
  try {
    const { inputType, repoUrl, localPath, targetBrowsers, zipBuffer, branch, excludePaths } = req.body;
    const job = await queue.createJob({ inputType, repoUrl, localPath, targetBrowsers, zipBuffer, branch, excludePaths });
    res.status(201).json({ scanId: job.id, status: job.status });
  } catch (error) {
    console.error('Error creating scan:', error);
    res.status(500).json({ error: 'Failed to create scan' });
  }
};

const getScanStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const job = await queue.getJob(id);
    if (job) {
      res.json({ scanId: job.id, status: job.status, progress: job.progress });
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

  try {
    const job = await queue.getJob(id);
    if (job && (job.status === 'done' || job.status === 'completed')) {
      res.json({ scanId: job.id, status: job.status, result: job.result });
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

module.exports = {
  createScan,
  getScanStatus,
  getScanResult,
  getScanSuggestions,
  applyScanChanges,
};