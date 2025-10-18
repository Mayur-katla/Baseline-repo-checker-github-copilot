const fs = require('fs');
const path = require('path');
const { detectEnvironmentAndVersioning } = require('../../src/services/parser');

jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => cb(null, '{}'),
}));

describe('Nuxt detection', () => {
  const testDir = path.join(__dirname, '..', 'fixtures', 'nuxt-repo');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    // Minimal nuxt.config.ts
    fs.writeFileSync(path.join(testDir, 'nuxt.config.ts'), 'export default defineNuxtConfig({})');
    // package.json with nuxt dep and nuxi dev script
    const pkg = {
      name: 'nuxt-repo',
      private: true,
      dependencies: { nuxt: '3.12.0' },
      scripts: { dev: 'nuxi dev' },
    };
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(pkg, null, 2));
    // pages/index.vue
    const pagesDir = path.join(testDir, 'pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(path.join(pagesDir, 'index.vue'), '<template><div>Home</div></template>');
    // app.vue (Nuxt 3)
    fs.writeFileSync(path.join(testDir, 'app.vue'), '<template><NuxtPage /></template>');
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('detects Nuxt via config, package.json, and pages/app.vue', async () => {
    const env = await detectEnvironmentAndVersioning(testDir, null);
    expect(env.primaryFrameworks).toEqual(expect.arrayContaining(['Nuxt']));
  });
});