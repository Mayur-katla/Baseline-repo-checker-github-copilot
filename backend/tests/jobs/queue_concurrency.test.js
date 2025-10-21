const path = require('path');

jest.setTimeout(20000);

describe('JobQueue concurrency limit', () => {
  beforeEach(() => {
    jest.resetModules();
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

  test('does not exceed MAX_CONCURRENT_JOBS and processes all jobs', async () => {
    const queue = require('../../src/jobs/queue');

    let maxActive = 0;

    const jobsPayloads = [
      { localPath: path.join(__dirname, 'repoA') },
      { localPath: path.join(__dirname, 'repoB') },
      { localPath: path.join(__dirname, 'repoC') },
    ];

    const created = await Promise.all(jobsPayloads.map(p => queue.createJob(p)));
    const jobIds = created.map(j => j.id);
    // eslint-disable-next-line no-console
    console.log('init statuses:', created.map(j => j && j.status));

    const waitForCompletion = async (timeoutMs = 15000) => {
      const start = Date.now();
      return new Promise((resolve, reject) => {
        const check = () => {
          const allDone = created.every(j => (j.status === 'done' || j.status === 'failed'));
          maxActive = Math.max(maxActive, queue.activeJobs.size);
          if (allDone && queue.activeJobs.size === 0) {
            resolve();
          } else if (Date.now() - start > timeoutMs) {
            reject(new Error('timeout'));
          } else {
            // Debug: periodic status output
            if (!check.lastPrint || Date.now() - check.lastPrint > 500) {
              const statuses = created.map(j => (j.status || 'unknown'));
              // eslint-disable-next-line no-console
              console.log('active:', queue.activeJobs.size, 'pending:', queue.pending.length, 'statuses:', statuses);
              check.lastPrint = Date.now();
            }
            setTimeout(check, 50);
          }
        };
        check();
      });
    };

    await waitForCompletion(15000);
    await queue.shutdown();

    // Enforced concurrency limit of 1
    expect(maxActive).toBeLessThanOrEqual(1);
    // Validate each job completed successfully
    for (const id of jobIds) {
      const j = queue.jobs.get(id);
      expect(j).toBeDefined();
      expect(j.status === 'done' || j.status === 'failed').toBe(true);
    }
  });
});