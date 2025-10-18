import { describe, it, expect } from 'vitest';
import { computeCompatibility, computeAnalytics } from '../utils/aggregators.js';

describe('aggregators', () => {
  it('computeCompatibility derives features, configs, and recommendations', () => {
    const displayData = {
      projectFeatures: { detectedFeatures: ['fetch', 'XMLHttpRequest', 'async-await'] },
      architecture: { configFiles: ['.browserslistrc'] },
      compatibility: {
        browserCompatibility: {
          fetch: { Chrome: 'supported' },
          'async-await': { Chrome: 'supported' },
          XMLHttpRequest: { Chrome: 'supported' },
        },
      },
      securityAndPerformance: { missingPolicies: [{ title: 'CSP', description: 'Missing CSP' }] },
    };

    const compat = computeCompatibility(displayData);
    expect(compat.supportedFeatures).toContain('fetch');
    expect(compat.supportedFeatures).toContain('async-await');
    expect(compat.partialFeatures).toEqual([]);
    expect(compat.unsupportedCode).toEqual([]);
    expect(compat.missingConfigs).toContain('postcss.config.js');
    expect(compat.missingConfigs).toContain('babel.config.js');
    expect(compat.recommendations).toContain('Use AbortController to cancel in-flight fetch requests');
    expect(compat.recommendations).toContain('Add Content Security Policy (CSP) via security middleware');
  });

  it('computeAnalytics summarises counts and dates', () => {
    const displayData = {
      projectFeatures: { detectedFeatures: ['fetch', 'XMLHttpRequest', 'async-await'] },
      architecture: { configFiles: ['.browserslistrc'] },
      compatibility: {
        browserCompatibility: {
          fetch: { Chrome: 'supported' },
          'async-await': { Chrome: 'supported' },
          XMLHttpRequest: { Chrome: 'supported' },
        },
      },
      securityAndPerformance: { missingPolicies: [{ title: 'CSP', description: 'Missing CSP' }] },
      repoDetails: { createdDate: '2023-07-01T12:00:00Z', lastUpdatedDate: '2024-08-01T12:00:00Z' },
    };

    const analytics = computeAnalytics(displayData);
    expect(analytics.counts.supported).toBe(3);
    expect(analytics.counts.partial).toBe(0);
    expect(analytics.counts.unsupported).toBe(0);
    expect(analytics.counts.suggested).toBe(2);
    expect(typeof analytics.dates.created).toBe('string');
    expect(typeof analytics.dates.updated).toBe('string');
  });
});