const fs = require('fs');
const path = require('path');
const { detectEnvironmentAndVersioning } = require('../../src/services/parser');

jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => cb(null, '{}'),
}));

describe('Router hints prioritization of framework detectors', () => {
  const testDir = path.join(__dirname, '..', 'fixtures', 'router-prioritize');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    // package.json with Next.js dependency and TS page
    const pkg = {
      name: 'router-prioritize',
      private: true,
      dependencies: { next: '14.2.3', react: '18.2.0', 'react-dom': '18.2.0' },
      devDependencies: { typescript: '5.4.0' },
      scripts: { dev: 'next dev' }
    };
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(pkg, null, 2));
    const appDir = path.join(testDir, 'app');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'page.tsx'), 'export default function Home(){ return <div>Home</div> }');

    // Angular heuristic: presence of angular.json
    fs.writeFileSync(path.join(testDir, 'angular.json'), JSON.stringify({ version: 1, projects: {} }, null, 2));
  });

  afterAll(() => {
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
  });

  it('computes detectorPlan and orders primaryFrameworks using router hints', async () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(testDir, 'package.json'), 'utf8'));
    const env = await detectEnvironmentAndVersioning(testDir, pkg);
    expect(env.routerHints).toBeTruthy();
    expect(env.detectorPlan).toBeTruthy();
    expect(env.detectorPlan.frameworks).toEqual(expect.arrayContaining(['Next.js']));
    expect(env.detectorPlan.allowFrameworks).toEqual(expect.arrayContaining(['Next.js']));
    expect(env.detectorPlan.languages.length).toBeGreaterThan(0);

    // Order validation
    expect(env.primaryFrameworks.length).toBeGreaterThan(0);
    expect(env.detectorPlan.frameworks[0]).toBe('Next.js');
    // Both Next.js and Angular should be present; Next.js should come first
    expect(env.primaryFrameworks).toEqual(expect.arrayContaining(['Next.js', 'Angular']));
    expect(env.primaryFrameworks[0]).toBe('Next.js');
  });
});