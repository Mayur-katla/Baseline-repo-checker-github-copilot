const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const queue = require('../../src/jobs/queue');

jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => cb(null, '{}'),
}));

jest.setTimeout(15000);

describe('Queue integration: framework gating under enforcement', () => {
  const testDir = path.join(__dirname, '..', 'fixtures', 'queue-fw-gate');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    const pkg = {
      name: 'queue-fw-gate',
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
    delete process.env.ROUTER_FW_THRESHOLD_PCT;
  });

  it('processes a zip job and gates frameworks to only the allowed top framework', async () => {
    process.env.ROUTER_ENFORCE = 'true';
    process.env.ROUTER_FW_THRESHOLD_PCT = '1';

    const zip = new AdmZip();
    zip.addLocalFolder(testDir);
    const buffer = zip.toBuffer();

    const job = await queue.createJob({ zipBuffer: buffer.toString('base64') });
    await queue.wait(job.id);
    const updated = await queue.getJob(job.id);

    expect(updated).toBeTruthy();
    expect(updated.result).toBeTruthy();

    const frameworks = updated.result?.architecture?.frameworks || [];
    expect(frameworks).toEqual(expect.arrayContaining(['Next.js']));
    expect(frameworks).not.toEqual(expect.arrayContaining(['Angular']));
  });
});