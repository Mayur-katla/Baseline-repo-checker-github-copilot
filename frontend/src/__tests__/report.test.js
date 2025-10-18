import { describe, it, expect } from 'vitest';
import { buildMarkdownReport } from '../utils/report.js';
import { computeCompatibility, computeAnalytics } from '../utils/aggregators.js';

describe('report utils', () => {
  it('buildMarkdownReport composes sections with provided data', () => {
    const displayData = {
      repoDetails: { repoName: 'demo', owner: 'org', license: 'MIT', size: '100KB', lastUpdated: '2024-08-01' },
      projectFeatures: { detectedFeatures: ['fetch', 'async-await'] },
      architecture: { configFiles: ['.browserslistrc'] },
      environment: { frameworks: [{ name: 'React', version: '18' }], dependencies: [{ name: 'axios', version: '1.6.0', status: 'OK' }] },
      securityAndPerformance: { missingPolicies: [{ title: 'CSP', description: 'Missing CSP' }] },
      summaryLog: { duration: '10s', filesIgnored: 2, agentVersion: '0.1.0', scanDate: '2024-08-02' },
    };

    const compat = computeCompatibility(displayData);
    const analytics = computeAnalytics(displayData);
    const md = buildMarkdownReport({ displayData, compat, analytics });

    expect(md).toContain('# Baseline Scan Report');
    expect(md).toContain('## Analytics');
    expect(md).toContain('## Compatibility Report');
    expect(md).toContain('## Environment & Versioning');
    expect(md).toContain('## Security & Performance');
    expect(md).toContain('## Architecture');
    expect(md).toContain('## Health & Maintenance');
    expect(md).toContain('## Summary Log');
    expect(md).toContain('React 18');
    expect(md).toContain('axios 1.6.0');
  });
});