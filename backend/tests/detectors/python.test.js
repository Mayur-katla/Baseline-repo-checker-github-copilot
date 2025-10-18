const fs = require('fs');
const path = require('path');
const { detectEnvironmentAndVersioning } = require('../../src/services/parser');

jest.mock('child_process', () => ({
  exec: (cmd, opts, cb) => cb(null, '{}'),
}));

describe('Python framework detection via requirements.txt', () => {
  const testDir = path.join(__dirname, '..', 'fixtures', 'python-repo');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    const requirements = [
      'flask==2.2.0',
      'fastapi==0.110.0',
      'django==4.2.0',
    ].join('\n');
    fs.writeFileSync(path.join(testDir, 'requirements.txt'), requirements);
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('detects Flask, FastAPI, and Django from requirements.txt', async () => {
    const env = await detectEnvironmentAndVersioning(testDir, null);
    expect(env.primaryFrameworks).toEqual(expect.arrayContaining(['Flask', 'FastAPI', 'Django']));
  });
});