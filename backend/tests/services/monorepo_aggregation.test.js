const fs = require('fs');
const path = require('path');
const { detectEnvironmentAndVersioning } = require('../../src/services/parser');

// Mock child_process.exec to return different outputs depending on cwd and command
jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => {
    const cwd = (opts && opts.cwd) || '';
    const norm = String(cwd).replace(/\\/g, '/');

    if (/^npm\s+outdated\s+--json/.test(cmd)) {
      let out = {};
      if (norm.includes('/fixtures/monorepo-repo/packages/a')) {
        out = { 'dep-a': { current: '0.5.0', latest: '1.0.0' } };
      } else if (norm.includes('/fixtures/monorepo-repo/packages/b')) {
        out = { 'dep-b': { current: '3.1.0', latest: '4.0.0' } };
      } else if (norm.includes('/fixtures/monorepo-repo')) {
        out = { 'dep-root': { current: '1.0.0', latest: '2.0.0' } };
      }
      return cb(null, JSON.stringify(out));
    }

    if (/^npm\s+audit\s+--json/.test(cmd)) {
      let out = {};
      if (norm.includes('/fixtures/monorepo-repo/packages/a')) {
        out = { vulnerabilities: { v2: { severity: 'moderate', module_name: 'dep-a' } } };
      } else if (norm.includes('/fixtures/monorepo-repo/packages/b')) {
        out = { vulnerabilities: { v3: { severity: 'low', module_name: 'dep-b' } } };
      } else if (norm.includes('/fixtures/monorepo-repo')) {
        out = { vulnerabilities: { v1: { severity: 'high', module_name: 'dep-root' } } };
      }
      return cb(null, JSON.stringify(out));
    }

    // Default: empty JSON
    return cb(null, '{}');
  },
}));

describe('Monorepo audits/outdated aggregation', () => {
  const testDir = path.join(__dirname, '..', 'fixtures', 'monorepo-repo');

  beforeAll(() => {
    // Create monorepo structure: root + packages/a + packages/b
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

    const rootPkg = {
      name: 'monorepo-root',
      private: true,
      version: '1.0.0',
      dependencies: { 'dep-root': '1.0.0' },
      devDependencies: {},
      workspaces: ['packages/*']
    };
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(rootPkg, null, 2));

    const aDir = path.join(testDir, 'packages', 'a');
    const bDir = path.join(testDir, 'packages', 'b');
    fs.mkdirSync(aDir, { recursive: true });
    fs.mkdirSync(bDir, { recursive: true });

    const aPkg = {
      name: 'pkg-a',
      version: '0.5.0',
      private: true,
      dependencies: { 'dep-a': '0.5.0' },
      devDependencies: {}
    };
    const bPkg = {
      name: 'pkg-b',
      version: '3.1.0',
      private: true,
      dependencies: { 'dep-b': '3.1.0' },
      devDependencies: {}
    };
    fs.writeFileSync(path.join(aDir, 'package.json'), JSON.stringify(aPkg, null, 2));
    fs.writeFileSync(path.join(bDir, 'package.json'), JSON.stringify(bPkg, null, 2));
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('aggregates npm outdated and audit results across nested packages', async () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(testDir, 'package.json'), 'utf8'));
    const env = await detectEnvironmentAndVersioning(testDir, packageJson);

    // Outdated aggregation: merged across root + a + b
    expect(env.versionCompatibility).toBeTruthy();
    expect(Object.keys(env.versionCompatibility)).toEqual(
      expect.arrayContaining(['dep-root', 'dep-a', 'dep-b'])
    );

    // Deprecated packages mirrors keys of versionCompatibility
    expect(env.deprecatedPackages).toEqual(
      expect.arrayContaining(['dep-root', 'dep-a', 'dep-b'])
    );

    // Recommended upgrades include entries for all packages
    expect(env.recommendedUpgrades.length).toBeGreaterThanOrEqual(3);
    const names = env.recommendedUpgrades.map(r => r.package);
    expect(names).toEqual(expect.arrayContaining(['dep-root', 'dep-a', 'dep-b']));

    // Audit aggregation: flatten vulnerabilities from all package dirs
    expect(Array.isArray(env.securityVulnerabilities)).toBe(true);
    expect(env.securityVulnerabilities.length).toBeGreaterThanOrEqual(3);
    const sev = env.securityVulnerabilities.map(v => v.severity);
    expect(sev).toEqual(expect.arrayContaining(['high', 'moderate', 'low']));
  });
});