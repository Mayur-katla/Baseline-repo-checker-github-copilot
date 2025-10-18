const request = require('supertest');
const { app, server } = require('../../src/index');
const { connectDB } = require('../../src/config/database');
const mongoose = require('mongoose');
const Scan = require('../../src/models/Scan');
const queue = require('../../src/jobs/queue');

jest.mock('../../src/jobs/queue', () => ({
  createJob: jest.fn(),
  getJob: jest.fn(),
  removeJob: jest.fn(),
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

beforeEach(async () => {
  jest.clearAllMocks();
  await Scan.deleteMany({});
});

describe('GET /api/scans/:id', () => {
  it('returns a scan document by id', async () => {
    await Scan.create({ id: 'scan-1', repoUrl: 'https://github.com/a/b', status: 'done', progress: 100 });

    const res = await request(app)
      .get('/api/scans/scan-1')
      .expect(200);

    expect(res.body.id).toBe('scan-1');
    expect(res.body.repoUrl).toBe('https://github.com/a/b');
  });

  it('returns 404 when scan does not exist', async () => {
    await request(app)
      .get('/api/scans/missing')
      .expect(404);
  });
});

describe('DELETE /api/scans/:id', () => {
  it('deletes scan and returns 204', async () => {
    await Scan.create({ id: 'scan-del', repoUrl: 'https://github.com/x/y', status: 'done', progress: 100 });

    await request(app)
      .delete('/api/scans/scan-del')
      .expect(204);

    const remaining = await Scan.countDocuments({ id: 'scan-del' });
    expect(remaining).toBe(0);
    expect(queue.removeJob).toHaveBeenCalledWith('scan-del');
  });

  it('returns 404 when scan does not exist', async () => {
    await request(app)
      .delete('/api/scans/not-found')
      .expect(404);
  });
});

describe('POST /api/scans/:id/pull-request (stubbed)', () => {
  it('creates stubbed PR and returns 201', async () => {
    await Scan.create({ id: 'scan-pr', repoUrl: 'https://github.com/test-owner/test-repo', status: 'done', progress: 100 });

    const res = await request(app)
      .post('/api/scans/scan-pr/pull-request')
      .send({ title: 'Test PR', description: 'Demo', patch: 'diff --git a/b b/b' })
      .expect(201);

    expect(res.body.provider).toBe('github');
    expect(res.body.branch).toBe('baseline-modernization-scan-pr');
    expect(res.body.prUrl).toMatch(/https:\/\/github\.com\/test-owner\/test-repo\/pull\/[0-9]+/);
  });

  it('validates body types and returns 400 for invalid title', async () => {
    await Scan.create({ id: 'scan-pr-invalid', repoUrl: 'https://github.com/test-owner/test-repo', status: 'done', progress: 100 });

    const res = await request(app)
      .post('/api/scans/scan-pr-invalid/pull-request')
      .send({ title: 123, patch: 'diff --git a/b b/b' })
      .expect(400);

    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('returns 404 when scan is not found', async () => {
    await request(app)
      .post('/api/scans/unknown/pull-request')
      .send({ title: 'X', patch: 'diff --git a/b b/b' })
      .expect(404);
  });
});

describe('GET /api/report/download', () => {
  it('returns 400 when scanId is missing', async () => {
    await request(app)
      .get('/api/report/download')
      .expect(400);
  });

  it('returns 404 when scan not found', async () => {
    await request(app)
      .get('/api/report/download?scanId=missing')
      .expect(404);
  });

  it('downloads report JSON with attachment headers', async () => {
    await Scan.create({ id: 'rep-42', repoUrl: 'https://github.com/org/repo', status: 'done', progress: 100, projectFeatures: { detectedFeatures: ['fetch'] } });

    const res = await request(app)
      .get('/api/report/download?scanId=rep-42')
      .expect(200);

    expect(res.headers['content-disposition']).toContain('scan-rep-42-report.json');
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.id).toBe('rep-42');
    expect(res.body.repoUrl).toBe('https://github.com/org/repo');
    expect(res.body.generatedAt).toBeDefined();
    expect(res.body.projectFeatures.detectedFeatures).toContain('fetch');
  });
});

describe('POST /api/github/pr (unified route)', () => {
  it('returns 400 when scanId is missing', async () => {
    const res = await request(app)
      .post('/api/github/pr')
      .send({})
      .expect(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('returns 404 when scan not found', async () => {
    await request(app)
      .post('/api/github/pr')
      .send({ scanId: 'missing', title: 'X' })
      .expect(404);
  });

  it('returns 400 when unable to derive owner/repo from repoUrl', async () => {
    await Scan.create({ id: 'pr-bad', repoUrl: 'https://example.com/no-github', status: 'done', progress: 100 });

    const res = await request(app)
      .post('/api/github/pr')
      .send({ scanId: 'pr-bad', patch: 'diff --git a/b b/b' })
      .expect(400);

    expect(res.body.error).toMatch(/Could not determine repository owner/);
  });
});