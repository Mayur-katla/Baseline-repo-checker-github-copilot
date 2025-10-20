const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const scanController = require('../controllers/scanController');

// Validation middleware for creating a scan
const MAX_BASE64_LEN = 16000000; // ~12-13MB base64 (safe cap)
const validateCreateScan = [
  body('inputType')
    .exists().withMessage('inputType is required')
    .isIn(['github', 'url', 'local', 'zip']).withMessage('inputType must be one of github|url|local|zip'),
  body('repoUrl')
    .if(body('inputType').isIn(['github', 'url']))
    .isString().withMessage('repoUrl must be a string')
    .trim()
    .isURL({ require_protocol: true }).withMessage('repoUrl must be a valid URL with protocol'),
  body('localPath')
    .if(body('inputType').equals('local'))
    .isString().withMessage('localPath must be a string')
    .trim()
    .isLength({ min: 1 }).withMessage('localPath is required for local scans'),
  body('zipBuffer')
    .if(body('inputType').equals('zip'))
    .isString().withMessage('zipBuffer must be a base64 string')
    .custom((val) => /^[A-Za-z0-9+/=]+$/.test(val || '')).withMessage('zipBuffer must be base64')
    .custom((val) => (val || '').length <= MAX_BASE64_LEN).withMessage('zipBuffer exceeds maximum allowed size'),
  body('targetBrowsers')
    .optional()
    .custom((v) => typeof v === 'string' || (Array.isArray(v) && v.every(s => typeof s === 'string')))
    .withMessage('targetBrowsers must be a string or an array of strings'),
  body('branch')
    .optional()
    .isString().withMessage('branch must be a string')
    .trim()
    .isLength({ min: 1, max: 256 }).withMessage('branch must be between 1 and 256 characters')
    .custom((val) => /^[\w\-.\/]+$/.test(val)).withMessage('branch contains invalid characters'),
  body('excludePaths')
    .optional()
    .isArray().withMessage('excludePaths must be an array')
    .bail(),
  body('excludePaths.*')
    .optional()
    .isString().withMessage('excludePaths items must be strings')
    .trim()
    .isLength({ min: 1, max: 200 }).withMessage('excludePaths items must be non-empty strings'),
  (req, res, next) => {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(400).json({ errors: result.array().map(e => ({ param: e.param, msg: e.msg })) });
    }
    next();
  }
];

router.post('/', validateCreateScan, scanController.createScan);
router.get('/:id/status', scanController.getScanStatus);
router.get('/:id/result', scanController.getScanResult);
// Validation middleware for compare scans
const validateCompareScans = [
  query('a')
    .exists().withMessage('a is required')
    .isString().withMessage('a must be a string')
    .trim()
    .isLength({ min: 1 }).withMessage('a must be non-empty'),
  query('b')
    .exists().withMessage('b is required')
    .isString().withMessage('b must be a string')
    .trim()
    .isLength({ min: 1 }).withMessage('b must be non-empty'),
  (req, res, next) => {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(400).json({ errors: result.array().map(e => ({ param: e.param, msg: e.msg })) });
    }
    next();
  }
];

router.get('/compare', validateCompareScans, scanController.compareScans);
router.get('/:id', scanController.getScanResult);
router.get('/:id/impact', scanController.getScanImpact);
router.get('/:id/suggestions', scanController.getScanSuggestions);
router.post('/:id/apply', scanController.applyScanChanges);

module.exports = router;