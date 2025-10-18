const fs = require('fs');
const path = require('path');
const { detectSecurityAndPerformance } = require('../src/services/parser');

jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => cb(null, '{}'),
}));

describe('Security & Performance static compliance', () => {
  const testDir = path.join(__dirname, 'fixtures', 'sec-repo');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    // Minimal package.json to satisfy any npm commands
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');

    const server = `
      const express = require('express');
      const cors = require('cors');
      const app = express();
      app.use(cors());
      // Insecure HTTP
      fetch('http://example.com');
      // Risky construct
      eval('2+2');
      // Blocking I/O
      const fs = require('fs');
      fs.readFileSync('./foo.txt');
      app.get('/', (req, res) => res.send('ok'));
      app.listen(3000);
    `;
    fs.writeFileSync(path.join(testDir, 'server.js'), server);

    // Large asset
    fs.writeFileSync(path.join(testDir, 'large-asset.bin'), Buffer.alloc(120 * 1024));

    // Sensitive file
    fs.writeFileSync(path.join(testDir, '.env'), 'SECRET=abc');
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('detects missing policies, insecure calls, inefficiencies, and large assets', async () => {
    const res = await detectSecurityAndPerformance(testDir);

    // Missing policies should include CSP at least
    const mpTitles = (res.missingPolicies || []).map(i => i.title);
    expect(mpTitles).toEqual(expect.arrayContaining(['CSP']));

    // Insecure calls detected
    expect((res.insecureApiCalls || []).length).toBeGreaterThan(0);

    // Inefficient code detected (blocking I/O or eval)
    expect((res.inefficientCode || []).length).toBeGreaterThan(0);

    // Large assets detected in both structures
    const pb = (res.performanceBottlenecks || []).find(b => b.type === 'Large Assets');
    expect(pb).toBeTruthy();
    expect((res.largeAssets || []).length).toBeGreaterThan(0);

    // Sensitive files include .env
    expect((res.sensitiveFiles || [])).toEqual(expect.arrayContaining(['.env']));
  });
});