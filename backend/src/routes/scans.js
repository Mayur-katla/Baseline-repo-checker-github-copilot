const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scanController');

router.post('/', scanController.createScan);
router.get('/:id/status', scanController.getScanStatus);
router.get('/:id/result', scanController.getScanResult);
router.get('/:id/suggestions', scanController.getScanSuggestions);
router.post('/:id/apply', scanController.applyScanChanges);

module.exports = router;