const request = require('supertest');
const { app, server } = require('../src/index');
const queue = require('../src/jobs/queue');
const { connectDB } = require('../src/config/database');
const mongoose = require('mongoose');
const Scan = require('../src/models/Scan');
const fs = require('fs');
const path = require('path');
jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => cb(null, '{}'),
}));

const { detectSecurityAndPerformance } = require('../src/services/parser');

jest.mock('../src/jobs/queue', () => ({
  createJob: jest.fn(),
  getJob: jest.fn(),
  on: jest.fn(),
  init: jest.fn(),
}));

beforeAll(async () => {
  await connectDB();
  await queue.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  server.close();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/scans', () => {
  it('should create a new scan job and return a job ID', async () => {
    const repoUrl = 'https://github.com/example/repo';
    const jobId = 'test-job-id';

    queue.createJob.mockResolvedValue({ id: jobId, status: 'queued' });

    const response = await request(app)
      .post('/api/scans')
      .send({ inputType: 'github', repoUrl })
      .expect(201);

    expect(response.body.scanId).toBe(jobId);
    expect(queue.createJob).toHaveBeenCalledWith({ inputType: 'github', repoUrl, localPath: undefined, targetBrowsers: undefined, zipBuffer: undefined });
  });
});

describe('GET /api/scans/:id/status', () => {
  it('should return the scan status', async () => {
    const scanId = 'test-scan-id';
    const scanStatus = { id: scanId, status: 'in-progress', progress: 50 };

    queue.getJob.mockResolvedValue(scanStatus);

    const response = await request(app)
      .get(`/api/scans/${scanId}/status`)
      .expect(200);

    expect(response.body).toEqual({ scanId: scanStatus.id, status: scanStatus.status, progress: scanStatus.progress });
    expect(queue.getJob).toHaveBeenCalledWith(scanId);
  });
});

describe('GET /api/scans/:id/result', () => {
  it('should return the scan result if the job is done', async () => {
    const scanId = 'test-scan-id';
    const scanResult = { id: scanId, status: 'completed', result: { some: 'data' } };

    queue.getJob.mockResolvedValue(scanResult);

    const response = await request(app)
      .get(`/api/scans/${scanId}/result`)
      .expect(200);

    expect(response.body).toEqual({ scanId: scanResult.id, status: scanResult.status, result: scanResult.result });
    expect(queue.getJob).toHaveBeenCalledWith(scanId);
  });

  it('should return a 202 status if the job is in progress', async () => {
    const scanId = 'test-scan-id';
    const scanResult = { id: scanId, status: 'in-progress' };

    queue.getJob.mockResolvedValue(scanResult);

    const response = await request(app)
      .get(`/api/scans/${scanId}/result`)
      .expect(202);

    expect(queue.getJob).toHaveBeenCalledWith(scanId);
  });

  it('should return a 404 status if the scan is not found', async () => {
    const scanId = 'not-found-id';

    queue.getJob.mockResolvedValue(null);

    const response = await request(app)
      .get(`/api/scans/${scanId}/result`)
      .expect(404);

    expect(queue.getJob).toHaveBeenCalledWith(scanId);
  });
});

describe('GET /api/scans/:id/suggestions', () => {
  it('returns aiSuggestions when job is completed', async () => {
    const scanId = 'suggest-job-id';
    const ai = { items: [{ id: 'a1', title: 'Test', description: 'Desc', severity: 'Low', category: 'modernize', file: 'file.js' }], meta: { rateLimited: false }, rationale: [] };
    queue.getJob.mockResolvedValue({ id: scanId, status: 'completed', result: { aiSuggestions: ai } });

    const res = await request(app)
      .get(`/api/scans/${scanId}/suggestions`)
      .expect(200);

    expect(res.body.aiSuggestions).toBeDefined();
    expect(res.body.aiSuggestions.items).toHaveLength(1);
    expect(queue.getJob).toHaveBeenCalledWith(scanId);
  });

  it('returns 202 when job is in progress', async () => {
    const scanId = 'suggest-in-progress';
    queue.getJob.mockResolvedValue({ id: scanId, status: 'in-progress' });

    await request(app)
      .get(`/api/scans/${scanId}/suggestions`)
      .expect(202);

    expect(queue.getJob).toHaveBeenCalledWith(scanId);
  });

  it('returns aiSuggestions from database when persisted', async () => {
    const scanId = 'suggest-db-id';
    const ai = { items: [{ id: 'a2', title: 'DB', description: 'Stored', severity: 'Medium', category: 'cleanup', file: 'package.json' }], meta: { rateLimited: false }, rationale: [] };
    await Scan.create({ id: scanId, repoUrl: 'https://example.com/repo', status: 'done', progress: 100, aiSuggestions: ai });

    const res = await request(app)
      .get(`/api/scans/${scanId}/suggestions`)
      .expect(200);

    expect(res.body.aiSuggestions).toBeDefined();
    expect(res.body.aiSuggestions.items[0].id).toBe('a2');

    await Scan.deleteMany({ id: scanId });
  });

  it('falls back to job aiSuggestions when DB aiSuggestions is empty', async () => {
    const scanId = 'suggest-db-empty';
    await Scan.create({ id: scanId, repoUrl: 'https://example.com/repo', status: 'done', progress: 100, aiSuggestions: {} });
    const ai = { items: [{ id: 'a3', title: 'Job', description: 'From job', severity: 'High', category: 'refactor', file: 'index.js' }] };
    queue.getJob.mockResolvedValue({ id: scanId, status: 'done', result: { aiSuggestions: ai } });

    const res = await request(app)
      .get(`/api/scans/${scanId}/suggestions`)
      .expect(200);

    expect(res.body.aiSuggestions).toBeDefined();
    expect(res.body.aiSuggestions.items).toHaveLength(1);

    await Scan.deleteMany({ id: scanId });
  });

  it('falls back to legacy job suggestions array when aiSuggestions absent', async () => {
    const scanId = 'suggest-legacy';
    const legacy = [{ id: 'l1', title: 'Legacy', description: 'Old format', severity: 'Low', category: 'cleanup', file: 'README.md' }];
    queue.getJob.mockResolvedValue({ id: scanId, status: 'completed', result: { suggestions: legacy } });

    const res = await request(app)
      .get(`/api/scans/${scanId}/suggestions`)
      .expect(200);

    expect(res.body.aiSuggestions).toBeDefined();
    expect(Array.isArray(res.body.aiSuggestions.items)).toBe(true);
    expect(res.body.aiSuggestions.items).toHaveLength(1);
  });
});

describe('detectSecurityAndPerformance', () => {
  const testDir = path.join(__dirname, 'test-repo');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}'); // For npm audit
    fs.writeFileSync(path.join(testDir, '.npmrc'), 'sensitive content');
    fs.writeFileSync(path.join(testDir, 'large-file.js'), Buffer.alloc(1024 * 150)); // 150KB
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should detect sensitive files and large files', async () => {
    const results = await detectSecurityAndPerformance(testDir);

    expect(results.sensitiveFiles).toHaveLength(1);
    expect(results.sensitiveFiles[0]).toBe('.npmrc');
    expect(results.performanceBottlenecks).toHaveLength(1);
    expect(results.performanceBottlenecks[0].files).toHaveLength(1);
    expect(results.performanceBottlenecks[0].files[0].file).toBe('large-file.js');
  });
});