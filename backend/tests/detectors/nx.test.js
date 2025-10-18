const fs = require('fs');
const path = require('path');
const { detectEnvironmentAndVersioning } = require('../../src/services/parser');

jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => cb(null, '{}'),
}));

describe('Nx monorepo detection', () => {
  const testDir = path.join(__dirname, '..', 'fixtures', 'nx-repo');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    // Minimal nx.json presence
    const nxJson = JSON.stringify({ npmScope: 'demo', affected: { defaultBase: 'main' } }, null, 2);
    fs.writeFileSync(path.join(testDir, 'nx.json'), nxJson);
    // Optional project.json under apps/
    const appDir = path.join(testDir, 'apps', 'web');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'project.json'), JSON.stringify({ projectType: 'application', sourceRoot: 'apps/web/src', targets: {} }, null, 2));
    // package.json with nx devDependency
    const pkg = { name: 'nx-repo', private: true, devDependencies: { nx: '18.0.0' } };
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(pkg, null, 2));
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('detects Nx monorepo via nx.json/project.json and devDependencies', async () => {
    const env = await detectEnvironmentAndVersioning(testDir, null);
    expect(env.primaryFrameworks).toEqual(expect.arrayContaining(['Nx']));
  });
});