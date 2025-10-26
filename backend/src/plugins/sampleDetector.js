const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'sample-detector',
  async detect({ root, files, result, log }) {
    // Example: mark repos using GitHub Actions
    try {
      const gha = path.join(root, '.github', 'workflows');
      if (fs.existsSync(gha)) {
        const features = new Set(Array.isArray(result?.projectFeatures?.detectedFeatures)
          ? result.projectFeatures.detectedFeatures
          : []);
        features.add('GitHub Actions');
        result.projectFeatures = Object.assign({}, result.projectFeatures, {
          detectedFeatures: Array.from(features)
        });
        log('Detected GitHub Actions via plugin');
      }
    } catch {}

    // Example: add architecture node for CI
    try {
      const cfgs = new Set(Array.isArray(result?.architecture?.configFiles)
        ? result.architecture.configFiles
        : []);
      if (cfgs.has('docker-compose.yml') || cfgs.has('Dockerfile')) {
        const frameworks = new Set(Array.isArray(result?.architecture?.frameworks)
          ? result.architecture.frameworks
          : []);
        frameworks.add('Docker');
        result.architecture = Object.assign({}, result.architecture, {
          frameworks: Array.from(frameworks)
        });
      }
    } catch {}

    return result;
  }
};
