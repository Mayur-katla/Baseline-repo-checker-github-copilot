const fs = require('fs');
const path = require('path');
const { detectEnvironmentAndVersioning } = require('../../src/services/parser');

jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => cb(null, '{}'),
}));

describe('Next.js detection', () => {
  const testDir = path.join(__dirname, '..', 'fixtures', 'next-repo');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    // Minimal next.config.js
    fs.writeFileSync(path.join(testDir, 'next.config.js'), 'module.exports = {}');
    // package.json with next dependency and script
    const pkg = { name: 'next-repo', private: true, scripts: { dev: 'next dev' }, dependencies: { next: '14.2.3', react: '18.2.0', 'react-dom': '18.2.0' } };
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(pkg, null, 2));
    // pages directory
    const pagesDir = path.join(testDir, 'pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(path.join(pagesDir, 'index.jsx'), "import Link from 'next/link'; export default function Home(){ return <div>Home</div> }");
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('detects Next.js via config, dependency, scripts, and pages structure', async () => {
    const env = await detectEnvironmentAndVersioning(testDir, null);
    expect(env.primaryFrameworks).toEqual(expect.arrayContaining(['Next.js']));
  });
});