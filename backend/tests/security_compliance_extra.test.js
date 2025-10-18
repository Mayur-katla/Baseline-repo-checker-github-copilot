const fs = require('fs');
const path = require('path');
const { detectSecurityAndPerformance } = require('../src/services/parser');

jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => cb(null, '{}'),
}));

describe('Extended Security & Performance heuristics', () => {
  const testDir = path.join(__dirname, 'fixtures', 'sec-repo-extended');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    // Minimal package.json to satisfy any npm commands
    fs.writeFileSync(path.join(testDir, 'package.json'), '{}');

    const server = `
      const express = require('express');
      const cors = require('cors');
      const session = require('express-session');
      const app = express();

      // Permissive CORS with credentials and wildcard methods
      app.use(cors({ origin: '*', credentials: true, methods: '*' }));

      app.get('/cookie', (req, res) => {
        // Cookies missing flags
        res.cookie('token', 'abc');
        res.send('ok');
      });

      // Session missing secure/httpOnly flags
      app.use(session({ secret: 'x', resave: false, saveUninitialized: true, cookie: { sameSite: 'lax' } }));

      // Note: helmet, csurf, rate limiter, and disabling x-powered-by are absent

      app.get('/', (req, res) => res.send('ok'));
      app.listen(3000);
    `;
    fs.writeFileSync(path.join(testDir, 'server.js'), server);
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('detects expanded heuristics: CORS credentials, wildcard methods, cookies, CSRF, rate limit, X-Powered-By', async () => {
    const res = await detectSecurityAndPerformance(testDir);

    const mpTitles = (res.missingPolicies || []).map(i => i.title);
    expect(mpTitles).toEqual(expect.arrayContaining([
      'CSP',
      'CSRF',
      'Rate limiting',
      'X-Powered-By',
      'Permissive CORS with credentials',
      'Wildcard CORS headers/methods',
    ]));

    const insecureTitles = (res.insecureApiCalls || []).map(i => i.title);
    expect(insecureTitles).toEqual(expect.arrayContaining([
      'Cookie without httpOnly',
      'Cookie without secure',
    ]));
  });
});