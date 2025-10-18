const fs = require('fs');
const path = require('path');
const { detectEnvironmentAndVersioning } = require('../../src/services/parser');

jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => cb(null, '{}'),
}));

describe('SvelteKit detection', () => {
  const testDir = path.join(__dirname, '..', 'fixtures', 'sveltekit-repo');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    // Minimal svelte.config.js
    fs.writeFileSync(path.join(testDir, 'svelte.config.js'), 'export default {}');
    // package.json with @sveltejs/kit and svelte dependencies
    const pkg = { name: 'sveltekit-repo', private: true, dependencies: { '@sveltejs/kit': '1.30.0', svelte: '4.2.0' }, scripts: { dev: 'vite' } };
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(pkg, null, 2));
    // src/routes with +page.svelte
    const routesDir = path.join(testDir, 'src', 'routes');
    fs.mkdirSync(routesDir, { recursive: true });
    fs.writeFileSync(path.join(routesDir, '+page.svelte'), '<script>export let data;</script><h1>Hello SvelteKit</h1>');
    // Additional .svelte file to ensure svelte detection fallback
    fs.writeFileSync(path.join(testDir, 'Component.svelte'), '<script>let x=1;</script><div>{x}</div>');
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('detects SvelteKit via config, package.json, and routes', async () => {
    const env = await detectEnvironmentAndVersioning(testDir, null);
    expect(env.primaryFrameworks).toEqual(expect.arrayContaining(['SvelteKit']));
  });
});