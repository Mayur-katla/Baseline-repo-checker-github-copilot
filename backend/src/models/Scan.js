const mongoose = require('mongoose');

const SuggestionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  file: { type: String, required: true },
  description: { type: String, required: true },
  severity: { type: String, required: true },
  patch: { type: String },
  original: { type: String },
  modified: { type: String },
});

const ScanSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  repoUrl: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['queued', 'processing', 'done', 'failed'],
    default: 'queued',
  },
  progress: {
    type: Number,
    default: 0,
  },
  features: {
    type: Object,
    of: [String],
    default: {},
  },
  baselineMapping: {
    type: Object,
    of: [{ feature: String, status: String }],
    default: {},
  },
  modernizationSuggestions: {
    type: [SuggestionSchema],
    default: [],
  },
  aiSuggestions: {
    type: Object,
    default: {},
  },
  repoDetails: {
    type: Object,
    default: {},
  },
  environment: {
    type: Object,
    default: {},
  },
  projectFeatures: {
    type: Object,
    default: {},
  },
  architecture: {
    type: Object,
    default: {},
  },
  compatibility: {
    type: Object,
    default: {},
  },
  versionControl: {
    type: Object,
    default: {},
  },
  securityAndPerformance: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  healthAndMaintenance: {
    type: Object,
    default: {},
  },
  summaryLog: {
    type: Object,
    default: {},
  },
  exportOptions: {
    type: Object,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field on save
ScanSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Scan', ScanSchema);