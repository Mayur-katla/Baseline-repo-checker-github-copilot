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

module.exports = router;