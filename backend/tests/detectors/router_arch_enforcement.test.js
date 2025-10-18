const fs = require('fs');
const path = require('path');
const { detectEnvironmentAndVersioning, enforceRouterAllowList } = require('../../src/services/parser');

jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => cb(null, '{}'),
}));

describe('Architecture-level enforcement via router hints helper', () => {
  const testDir = path.join(__dirname, '..', 'fixtures', 'router-arch-enforce');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    const pkg = {
      name: 'router-arch-enforce',
      private: true,
      dependencies: { next: '14.2.3', react: '18.2.0', 'react-dom': '18.2.0' },
      scripts: { dev: 'next dev' }
    };
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(pkg, null, 2));
    fs.mkdirSync(path.join(testDir, 'app'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'app', 'page.tsx'), "export default function Page(){ return <div>Home</div>; }\n");
    // Angular presence to seed non-allowed framework
    fs.writeFileSync(path.join(testDir, 'angular.json'), JSON.stringify({ projects: {} }, null, 2));

    process.env.ROUTER_ENFORCE = 'true';
  });

  afterAll(() => {
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
    delete process.env.ROUTER_ENFORCE;
  });

  it('filters non-allowed frameworks from architecture list', async () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(testDir, 'package.json'), 'utf8'));
    const env = await detectEnvironmentAndVersioning(testDir, pkg);

    expect(env.detectorPlan.allowFrameworks).toEqual(expect.arrayContaining(['Next.js']));

    const initial = ['Next.js', 'Angular'];
    const filtered = enforceRouterAllowList(initial, env);

    expect(filtered).toEqual(expect.arrayContaining(['Next.js']));
    expect(filtered).not.toEqual(expect.arrayContaining(['Angular']));
  });
});