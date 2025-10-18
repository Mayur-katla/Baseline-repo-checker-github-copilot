const fs = require('fs');
const path = require('path');
const { routeDetectors } = require('../../src/services/aiRouter');

jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => cb(null, '{}'),
}));

describe('Router thresholds configuration via env', () => {
  const testDir = path.join(__dirname, '..', 'fixtures', 'router-thresholds-next-angular');

  beforeAll(async () => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    // Root package.json with Next.js and Angular
    const pkg = {
      name: 'router-thresholds-next-angular',
      private: true,
      dependencies: { next: '14.2.3', react: '18.2.0', 'react-dom': '18.2.0' },
      devDependencies: { '@angular/core': '17.0.0' },
      scripts: { dev: 'next dev' }
    };
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(pkg, null, 2));
    // Create Next.js pages to bump Next score and language scores
    fs.mkdirSync(path.join(testDir, 'pages'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'pages', 'index.tsx'), "export default function Page(){ return <div>TS Home</div>; }\n");
    fs.writeFileSync(path.join(testDir, 'pages', 'admin.jsx'), "export default function Admin(){ return <div>JS Admin</div>; }\n");
  });

  afterAll(() => {
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
    delete process.env.ROUTER_FW_THRESHOLD_PCT;
    delete process.env.ROUTER_LANG_THRESHOLD_PCT;
  });

  it('Framework allow list honors ROUTER_FW_THRESHOLD_PCT=1 (only top framework)', async () => {
    process.env.ROUTER_FW_THRESHOLD_PCT = '1';

    const hints = await routeDetectors(testDir);
    expect(hints.rankedFrameworks.length).toBeGreaterThan(0);
    const names = hints.rankedFrameworks.map(x => x.name);
    expect(names).toEqual(expect.arrayContaining(['Next.js']));

    const allowed = Array.from(hints.allowFrameworks);
    expect(allowed).toEqual(expect.arrayContaining(['Next.js']));
    expect(allowed).not.toEqual(expect.arrayContaining(['Angular']));
  });

  it('Language allow list honors ROUTER_LANG_THRESHOLD_PCT=1 (only dominant language)', async () => {
    process.env.ROUTER_LANG_THRESHOLD_PCT = '1';

    const hints = await routeDetectors(testDir);
    expect(hints.rankedLanguages.length).toBeGreaterThan(0);
    const allowedLangs = Array.from(hints.allowLanguages);
    expect(allowedLangs).toEqual(expect.arrayContaining(['JavaScript']));
    expect(allowedLangs).not.toEqual(expect.arrayContaining(['TypeScript']));
  });
});