const path = require('path');
const request = require('supertest');

jest.setTimeout(20000);

describe('GET /api/jobs/:id', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.MAX_CONCURRENT_JOBS = '1';

    // Mock services to avoid external dependencies and speed up processing
    jest.mock('../../src/services/repoAnalyzer', () => ({
      walkFiles: jest.fn(async () => Array.from({ length: 10 }, (_, i) => `src/file${i}.js`)),
      cleanup: jest.fn(async () => {}),
      getCommitMetadata: jest.fn(async () => ({ commitSha: 'abc123', defaultBranch: 'main' })),
    }), { virtual: true });

    jest.mock('../../src/services/parser', () => ({
      detectJsFeatures: jest.fn(async () => []),
      detectCssFeatures: jest.fn(async () => []),
      detectEnvironmentAndVersioning: jest.fn(async () => ({ primaryFrameworks: [], securityVulnerabilities: [] })),
      detectRepoDetails: jest.fn(async () => ({ frameworks: [], buildTools: [] })),
      detectSecurityAndPerformance: jest.fn(async () => ({ ciWorkflows: [], ciSummary: { high: 0, medium: 0, low: 0 } })),
      enforceRouterAllowList: jest.fn(frameworks => frameworks),
    }), { virtual: true });

    jest.mock('../../src/services/llmSuggestions', () => ({
      generateAiSuggestions: jest.fn(async () => ({ items: [] })),
    }), { virtual: true });

    jest.mock('../../src/services/baseline', () => ({
      lookup: jest.fn(() => 'baseline'),
    }), { virtual: true });
  });

  test('returns job status and eventually completes', async () => {
    const { app } = require('../../src/index');
    const queue = require('../../src/jobs/queue');

    const job = await queue.createJob({ localPath: path.join(__dirname, '../fixtures/sample-repo') });

    // Poll the endpoint until job completes
    const waitForCompletion = async (timeoutMs = 15000) => {
      const start = Date.now();
      while (true) {
        const res = await request(app).get(`/api/jobs/${job.id}`).expect(200);
        const { id, status, progress } = res.body || {};
        expect(id).toBe(job.id);
        expect(typeof progress).toBe('number');
        expect(['queued', 'processing', 'done', 'failed']).toContain(status);
        if (status === 'done' || status === 'failed') return;
        if (Date.now() - start > timeoutMs) throw new Error('timeout');
        await new Promise(r => setTimeout(r, 50));
      }
    };

    await waitForCompletion(15000);
  });

  test('404 for unknown job id', async () => {
    const { app } = require('../../src/index');
    await request(app).get('/api/jobs/does-not-exist').expect(404);
  });
});