const { generateAiSuggestions } = require('../../src/services/llmSuggestions');

describe('LLM Suggestions Guardrails', () => {
  test('generates modernization suggestions from detected features', async () => {
    const detected = {
      projectFeatures: {
        detectedFeatures: ['XMLHttpRequest']
      },
      architecture: { configFiles: [], frameworks: [] },
      securityAndPerformance: { missingPolicies: [] },
      environment: {}
    };

    const res = await generateAiSuggestions(detected);
    const titles = res.items.map(i => i.title);

    expect(titles).toContain('Migrate XHR to fetch');
    // Items are sanitized and limited length
    res.items.forEach(i => {
      expect(i.description.length).toBeLessThanOrEqual(400);
      expect(['Low','Medium','High']).toContain(i.severity);
      expect(['modernize','secure','performance','cleanup']).toContain(i.category);
      expect(i.id).toBeDefined();
    });
  });

  test('redacts secrets from input and reports meta', async () => {
    const detected = {
      projectFeatures: { detectedFeatures: ['fetch'] },
      architecture: { configFiles: [], frameworks: [] },
      securityAndPerformance: {},
      environment: { GITHUB_TOKEN: 'ghp_ABCDEF0123456789ABCDEF' }
    };

    const res = await generateAiSuggestions(detected);
    expect(res.meta).toBeDefined();
    expect(res.meta.redactions).toBeGreaterThan(0);
    expect(res.meta.redactedInputSample).toContain('[REDACTED]');
  });

  test('suggests AbortController when fetch is used without cancellation', async () => {
    const detected = {
      projectFeatures: { detectedFeatures: ['fetch'] },
      architecture: { configFiles: [], frameworks: [] },
      securityAndPerformance: {},
      environment: {}
    };

    const res = await generateAiSuggestions(detected);
    const titles = res.items.map(i => i.title);
    expect(titles).toContain('Enable AbortController');
  });

  test('suggests next.config.js for Next.js apps missing config', async () => {
    const detected = {
      projectFeatures: { detectedFeatures: [] },
      architecture: { configFiles: [], frameworks: ['Next.js'] },
      securityAndPerformance: {},
      environment: {}
    };

    const res = await generateAiSuggestions(detected);
    const titles = res.items.map(i => i.title);
    expect(titles).toContain('Add next.config.js');
  });

  test('suggests CSP via helmet when policies are missing', async () => {
    const detected = {
      projectFeatures: { detectedFeatures: [] },
      architecture: { configFiles: [], frameworks: [] },
      securityAndPerformance: { missingPolicies: ['csp'] },
      environment: {}
    };

    const res = await generateAiSuggestions(detected);
    const titles = res.items.map(i => i.title);
    expect(titles).toContain('Add CSP via helmet');
  });

  test('guards against unsafe content in suggestions', async () => {
    const detected = {
      projectFeatures: { detectedFeatures: ['XMLHttpRequest'] },
      architecture: { configFiles: [], frameworks: [] },
      securityAndPerformance: {},
      environment: {}
    };

    const res = await generateAiSuggestions(detected);
    res.items.forEach(i => {
      const text = `${i.title} ${i.description}`;
      expect(text).not.toMatch(/rm\s+-rf/i);
      expect(text).not.toMatch(/exfiltrate/i);
    });
  });
});