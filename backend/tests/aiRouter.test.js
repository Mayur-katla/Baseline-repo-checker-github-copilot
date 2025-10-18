const fs = require('fs');
const path = require('path');
const { routeDetectors } = require('../src/services/aiRouter');

describe('AI Router - detector routing hints', () => {
  const nextRepo = path.join(__dirname, 'fixtures', 'airouter-next');
  const pyRepo = path.join(__dirname, 'fixtures', 'airouter-py');

  beforeAll(() => {
    // Next.js fixture
    if (!fs.existsSync(nextRepo)) fs.mkdirSync(nextRepo, { recursive: true });
    const pkg = {
      name: 'airouter-next',
      private: true,
      dependencies: { next: '14.2.3', react: '18.2.0', 'react-dom': '18.2.0', typescript: '5.4.0' }
    };
    fs.writeFileSync(path.join(nextRepo, 'package.json'), JSON.stringify(pkg, null, 2));
    const pagesDir = path.join(nextRepo, 'pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(path.join(pagesDir, 'index.tsx'), "export default function Home(){ return <div>Home</div> }\n");

    // Python ML fixture
    if (!fs.existsSync(pyRepo)) fs.mkdirSync(pyRepo, { recursive: true });
    fs.writeFileSync(path.join(pyRepo, 'model.py'), [
      'import torch',
      'from tensorflow import keras',
      'import sklearn'
    ].join('\n'));
  });

  afterAll(() => {
    try { fs.rmSync(nextRepo, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(pyRepo, { recursive: true, force: true }); } catch {}
  });

  it('ranks Next.js highly and allows it when present', async () => {
    const hints = await routeDetectors(nextRepo);
    const fwNames = hints.rankedFrameworks.map(x => x.name);
    expect(fwNames).toEqual(expect.arrayContaining(['Next.js']));
    expect(hints.allowFrameworks.has('Next.js')).toBe(true);
    // TypeScript should be detected from .tsx and dependency
    const langNames = hints.rankedLanguages.map(x => x.name);
    expect(langNames).toEqual(expect.arrayContaining(['TypeScript', 'JavaScript']));
  });

  it('detects ML libraries from Python imports', async () => {
    const hints = await routeDetectors(pyRepo);
    const mlNames = hints.rankedMl.map(x => x.name);
    expect(mlNames).toEqual(expect.arrayContaining(['PyTorch', 'TensorFlow', 'Scikit-learn']));
  });
});