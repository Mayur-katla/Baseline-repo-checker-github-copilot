const fs = require('fs');
const path = require('path');

// Mock repoAnalyzer to avoid node-fetch and provide walkFiles for CI YAML
jest.mock(require.resolve('../../src/services/repoAnalyzer.js'), () => {
  const pathLocal = require('path');
  return {
    walkFiles: async (root, opts = {}) => {
      const files = [];
      const ymlRel = pathLocal.join('.github', 'workflows', 'ci.yml').replace(/\\/g, '/');
      if (!opts.extensions || opts.extensions.includes('.yml') || opts.extensions.includes('.yaml')) {
        files.push(ymlRel);
      }
      // For generic file scans, return empty to keep focus on CI workflow
      return files;
    },
  };
});

const { scanCiWorkflows } = require('../../src/services/ciScanner');

describe('CI workflow scanner', () => {
  const testDir = path.join(__dirname, '..', 'fixtures', 'ci-workflow-repo');

  beforeAll(() => {
    fs.mkdirSync(path.join(testDir, '.github', 'workflows'), { recursive: true });
    const yml = `
name: CI
on:
  pull_request_target:
    branches: [ main ]
jobs:
  build:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Install
        run: npm ci
`;
    fs.writeFileSync(path.join(testDir, '.github', 'workflows', 'ci.yml'), yml);
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');
  });

  afterAll(() => {
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
  });

  it('detects PR target, unpinned actions, missing permissions, and self-hosted runner', async () => {
    const findings = await scanCiWorkflows(testDir);
    const titles = findings.map(i => i.title);

    expect(titles).toEqual(expect.arrayContaining([
      'Workflow triggered by pull_request_target',
      'Unpinned action version',
      'Missing explicit permissions for GITHUB_TOKEN',
      'Self-hosted runner used',
      'Checkout persists credentials',
    ]));
  });
});