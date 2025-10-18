const fs = require('fs');
const path = require('path');
const { detectEnvironmentAndVersioning } = require('../../src/services/parser');

jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => cb(null, '{}'),
}));

describe('Vue detection', () => {
  const testDir = path.join(__dirname, '..', 'fixtures', 'vue-repo');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    // Minimal vue.config.js
    fs.writeFileSync(path.join(testDir, 'vue.config.js'), 'module.exports = {}');
    // package.json with vue dep and vue-cli-service devDependency
    const pkg = {
      name: 'vue-repo',
      private: true,
      dependencies: { vue: '3.4.21' },
      devDependencies: { '@vue/cli-service': '5.0.8' },
      scripts: { serve: 'vue-cli-service serve' },
    };
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(pkg, null, 2));
    // src/main.js importing vue
    const srcDir = path.join(testDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'main.js'), "import { createApp } from 'vue';\ncreateApp({}).mount('#app');");
    // src/App.vue
    fs.writeFileSync(path.join(srcDir, 'App.vue'), '<template><div>App</div></template>');
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('detects Vue via vue.config, package.json, src/main and .vue files', async () => {
    const env = await detectEnvironmentAndVersioning(testDir, null);
    expect(env.primaryFrameworks).toEqual(expect.arrayContaining(['Vue']));
  });
});