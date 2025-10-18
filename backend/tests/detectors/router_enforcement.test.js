const fs = require('fs');
const path = require('path');
const { detectEnvironmentAndVersioning } = require('../../src/services/parser');

jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => cb(null, '{}'),
}));

describe('Router hints enforcement gates non-allowed frameworks', () => {
  const testDir = path.join(__dirname, '..', 'fixtures', 'router-enforce-next-angular');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    // Root package.json with Next.js
    const pkg = {
      name: 'router-enforce-next-angular',
      private: true,
      dependencies: { next: '14.2.3', react: '18.2.0', 'react-dom': '18.2.0' },
      scripts: { dev: 'next dev' }
    };
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(pkg, null, 2));
    // Next.js app structure
    fs.mkdirSync(path.join(testDir, 'app'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'app', 'page.tsx'), "export default function Page(){ return <div>Home</div>; }\n");
    // Angular config to trigger Angular detection
    fs.writeFileSync(path.join(testDir, 'angular.json'), JSON.stringify({ projects: {} }, null, 2));

    // Enable router enforcement
    process.env.ROUTER_ENFORCE = 'true';
  });

  afterAll(() => {
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
    delete process.env.ROUTER_ENFORCE;
  });

  it('includes Next.js but excludes Angular under enforcement', async () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(testDir, 'package.json'), 'utf8'));
    const env = await detectEnvironmentAndVersioning(testDir, pkg);

    expect(env.routerHints).toBeTruthy();
    expect(env.detectorPlan).toBeTruthy();
    expect(env.detectorPlan.allowFrameworks).toEqual(expect.arrayContaining(['Next.js']));

    // Under enforcement, Angular should be excluded from primary frameworks
    expect(env.primaryFrameworks).toEqual(expect.arrayContaining(['Next.js']));
    expect(env.primaryFrameworks).not.toEqual(expect.arrayContaining(['Angular']));
  });
});