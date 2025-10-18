const fs = require('fs');
const path = require('path');
const { detectEnvironmentAndVersioning } = require('../../src/services/parser');

jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => cb(null, '{}'),
}));

describe('Evaluation gate respects shouldDetect', () => {
  const testDir = path.join(__dirname, '..', 'fixtures', 'nuxt-repo-gated');
  const tmpEvalPath = path.join(__dirname, '..', 'fixtures', 'tech-evaluation.test.json');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'nuxt.config.ts'), 'export default defineNuxtConfig({})');
    const pkg = { name: 'nuxt-repo', private: true, dependencies: { nuxt: '3.12.0' }, scripts: { dev: 'nuxi dev' } };
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(pkg, null, 2));
    fs.mkdirSync(path.join(testDir, 'pages'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'pages', 'index.vue'), '<template><div>Home</div></template>');
    fs.writeFileSync(path.join(testDir, 'app.vue'), '<template><NuxtPage /></template>');

    // Create a gating file marking Nuxt inactive
    const evalConfig = {
      technologies: {
        Nuxt: { approved: false, status: 'inactive', testing_level: 'smoke' }
      }
    };
    fs.writeFileSync(tmpEvalPath, JSON.stringify(evalConfig, null, 2));

    // Point techEval to the temp config and enable enforcement
    process.env.EVAL_CONFIG_PATH = tmpEvalPath;
    process.env.EVAL_ENFORCE = 'true';
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    fs.rmSync(tmpEvalPath, { recursive: true, force: true });
    delete process.env.EVAL_CONFIG_PATH;
    delete process.env.EVAL_ENFORCE;
  });

  it('skips adding Nuxt when evaluation marks it inactive', async () => {
    const env = await detectEnvironmentAndVersioning(testDir, null);
    expect(env.primaryFrameworks).not.toEqual(expect.arrayContaining(['Nuxt']));
  });
});