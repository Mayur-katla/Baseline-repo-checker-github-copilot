const fs = require('fs');
const path = require('path');
const { detectEnvironmentAndVersioning, enforceRouterAllowList } = require('../../src/services/parser');

jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => cb(null, '{}'),
}));

describe('Scan architecture frameworks gating via router allow-list', () => {
  const testDir = path.join(__dirname, '..', 'fixtures', 'scan-arch-gate');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    const pkg = {
      name: 'scan-arch-gate',
      private: true,
      dependencies: { next: '14.2.3', react: '18.2.0', 'react-dom': '18.2.0' },
      devDependencies: { '@angular/core': '17.0.0' },
      scripts: { dev: 'next dev' }
    };
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(pkg, null, 2));
    fs.writeFileSync(path.join(testDir, 'angular.json'), JSON.stringify({ version: 1, projects: {} }, null, 2));
    const pagesDir = path.join(testDir, 'pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(path.join(pagesDir, 'index.tsx'), 'export default function Home(){ return <div>Home</div>; }\n');
  });

  afterAll(() => {
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
    delete process.env.ROUTER_ENFORCE;
  });

  it('filters architecture.frameworks to only allowed frameworks under enforcement', async () => {
    process.env.ROUTER_ENFORCE = 'true';
    process.env.ROUTER_FW_THRESHOLD_PCT = '1';
    const pkg = JSON.parse(fs.readFileSync(path.join(testDir, 'package.json'), 'utf8'));
    const env = await detectEnvironmentAndVersioning(testDir, pkg);

    expect(env.detectorPlan).toBeTruthy();
    expect(env.detectorPlan.allowFrameworks.size || env.detectorPlan.allowFrameworks.length).toBeGreaterThan(0);

    const initialFrameworks = ['Next.js', 'Angular'];
    const gated = enforceRouterAllowList(initialFrameworks, env);
    expect(gated).toEqual(expect.arrayContaining(['Next.js']));
    expect(gated).not.toEqual(expect.arrayContaining(['Angular']));
  });
});