const fs = require('fs');
const path = require('path');
const { searchFiles, searchLogs } = require('../src/services/semanticSearch');

describe('Semantic Search service', () => {
  const repoDir = path.join(__dirname, 'fixtures', 'semantic-repo');

  beforeAll(() => {
    if (!fs.existsSync(repoDir)) fs.mkdirSync(repoDir, { recursive: true });
    const file1 = [
      'export function get() {',
      '  const controller = new AbortController();',
      '  return fetch("/api", { signal: controller.signal });',
      '}',
    ].join('\n');
    fs.writeFileSync(path.join(repoDir, 'api.js'), file1);

    const file2 = [
      'function noop() {',
      '  // unrelated content',
      '}',
    ].join('\n');
    fs.writeFileSync(path.join(repoDir, 'misc.ts'), file2);
  });

  afterAll(() => {
    try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch {}
  });

  it('finds files matching query terms and returns snippets', async () => {
    const results = await searchFiles(repoDir, 'AbortController fetch', { maxResults: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].file).toEqual('api.js');
    expect(results[0].snippet).toBeTruthy();
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('scores logs with query tokens and returns top lines', async () => {
    const logs = [
      'Starting scan job',
      'Security check: missing CSP policy',
      'Modernization suggestion: adopt AbortController for fetch cancellations',
      'Scan complete',
    ];
    const results = searchLogs(logs, 'AbortController fetch');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].line).toMatch(/AbortController/);
  });
});