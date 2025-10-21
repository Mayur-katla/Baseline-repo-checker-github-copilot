const express = require('express');
const router = express.Router();
const queue = require('../jobs/queue');

// GET /api/jobs/:id - return job status and progress
router.get('/:id', async (req, res) => {
  try {
    const job = await queue.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Error fetching job ${req.params.id}:`, err);
    res.status(500).json({ error: 'Failed to get job' });
  }
});

// POST /api/jobs/:id/cancel - request job cancellation
router.post('/:id/cancel', async (req, res) => {
  try {
    const result = await queue.cancelJob(req.params.id);
    if (!result.found) return res.status(404).json({ error: 'Job not found' });
    if (!result.changed) return res.status(409).json({ error: `Job already ${result.status}` });
    return res.json({ id: req.params.id, status: result.status });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Error cancelling job ${req.params.id}:`, err);
    return res.status(500).json({ error: 'Failed to cancel job' });
  }
});

module.exports = router;