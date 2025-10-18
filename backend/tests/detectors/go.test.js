const fs = require('fs');
const path = require('path');
const { detectEnvironmentAndVersioning } = require('../../src/services/parser');

describe('Go detection via go.mod', () => {
  const testDir = path.join(__dirname, '..', 'fixtures', 'go-repo');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    const goMod = `module example.com/helloworld

go 1.21

require (
  github.com/gin-gonic/gin v1.9.1
  gorm.io/gorm v1.24.0
)
`;
    fs.writeFileSync(path.join(testDir, 'go.mod'), goMod);
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('detects Go frameworks and dependencies from go.mod', async () => {
    const env = await detectEnvironmentAndVersioning(testDir, null);
    expect(env.primaryFrameworks).toEqual(expect.arrayContaining(['Go (Gin)', 'GORM']));
    expect(env.dependencies).toEqual(expect.arrayContaining(['github.com/gin-gonic/gin', 'gorm.io/gorm']));
  });
});