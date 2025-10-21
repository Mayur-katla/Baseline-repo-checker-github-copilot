import featureMapping from '../resources/feature-mapping.json';

export function computeCompatibility(displayData) {
  // Normalize features into an array of strings regardless of source shape
  const rawFeatures =
    displayData?.projectFeatures?.detectedFeatures ??
    displayData?.features ??
    displayData?.detectedFeatures?.features;
  let features = [];
  if (Array.isArray(rawFeatures)) {
    // Elements may be strings or objects with a 'name' field
    features = rawFeatures
      .map((f) => (typeof f === 'string' ? f : (f && typeof f.name === 'string' ? f.name : null)))
      .filter((f) => typeof f === 'string');
  } else if (rawFeatures && typeof rawFeatures === 'object') {
    // If detectedFeatures is an object map (file -> [features]), flatten values
    const vals = Object.values(rawFeatures);
    const flat = Array.isArray(vals) ? vals.flat() : [];
    features = flat.filter((f) => typeof f === 'string');
  } else {
    features = [];
  }
  // Ensure uniqueness and stable ordering
  features = Array.from(new Set(features)).sort();

  const rawConfigFiles = displayData?.architecture?.configFiles;
  const configFiles = Array.isArray(rawConfigFiles) ? rawConfigFiles : [];
  const supportedFeatures = [];
  const unsupportedCode = [];
  const partialFeatures = [];
  // Prefer compatibility.browserCompatibility if available, else fallback to static featureMapping
  const compatibilitySupport = (displayData?.compatibility && displayData.compatibility.browserCompatibility) || {};
  const deriveStatus = (support) => {
    if (!support || typeof support !== 'object') return null;
    const vals = Object.values(support).map(String);
    if (vals.some(v => /unsupported|no|n/i.test(v))) return 'unsupported';
    if (vals.some(v => /partial|a/i.test(v))) return 'partial';
    if (vals.some(v => /supported|yes|y/i.test(v))) return 'supported';
    return 'unknown';
  };

  features.forEach((f) => {
    const status = deriveStatus(compatibilitySupport[f]) || featureMapping[f] || 'unknown';
    if (status === 'supported') supportedFeatures.push(f);
    else if (status === 'partial') partialFeatures.push(f);
    else if (status === 'unsupported') unsupportedCode.push(f);
  });

  const baseExpectedConfigs = ['.browserslistrc', 'postcss.config.js', 'babel.config.js'];
  const conditionalConfigs = [];
  if (features.includes('TypeScript')) conditionalConfigs.push('tsconfig.json');
  if (features.includes('eslint')) conditionalConfigs.push('eslint.config.js');
  if (features.includes('webpack')) conditionalConfigs.push('webpack.config.js');
  const expectedConfigs = [...baseExpectedConfigs, ...conditionalConfigs];
  const missingConfigs = expectedConfigs.filter(cfg => !configFiles.includes(cfg));

  const recommendations = [];
  // Simple heuristics for recommendations
  if (features.includes('XMLHttpRequest') && !features.includes('fetch')) {
    recommendations.push('Migrate XMLHttpRequest calls to fetch API');
  }
  // Suggest removing core-js polyfills if modern features supported
  if (features.includes('core-js/features/promise') && supportedFeatures.includes('async-await')) {
    recommendations.push('Remove Promise polyfill; async/await is supported');
  }
  // Suggest enabling AbortController for fetch-heavy apps
  if (features.includes('fetch') && !features.includes('AbortController')) {
    recommendations.push('Use AbortController to cancel in-flight fetch requests');
  }
  // Suggest adding CSP if security issues present
  const missingPolicies = Array.isArray(displayData?.securityAndPerformance?.missingPolicies)
    ? displayData.securityAndPerformance.missingPolicies
    : [];
  if (missingPolicies.length > 0 && !configFiles.includes('helmet.config.js')) {
    recommendations.push('Add Content Security Policy (CSP) via security middleware');
  }
  // New security hygiene recommendations based on backend heuristics
  const insecureApiCalls = Array.isArray(displayData?.securityAndPerformance?.insecureApiCalls)
    ? displayData.securityAndPerformance.insecureApiCalls
    : [];
  const titles = missingPolicies.map(p => String(p?.title || ''));
  const insecureTitles = insecureApiCalls.map(p => String(p?.title || ''));
  if (titles.includes('Rate limiting')) {
    recommendations.push('Enable express-rate-limit to throttle abusive traffic');
  }
  if (titles.includes('CSRF')) {
    recommendations.push('Add csurf middleware to protect against CSRF attacks');
  }
  if (titles.includes('X-Powered-By')) {
    recommendations.push("Disable 'X-Powered-By' header via app.disable('x-powered-by')");
  }
  if (titles.includes('Permissive CORS') || titles.includes('Permissive CORS with credentials') || titles.includes('Wildcard CORS headers/methods')) {
    recommendations.push('Restrict CORS origin to known domains and avoid credentials with wildcard');
  }
  if (insecureTitles.includes('Cookie without httpOnly') || insecureTitles.includes('Cookie without secure')) {
    recommendations.push('Set httpOnly and secure flags on cookies (prefer secure in production)');
  }

  return {
    supportedFeatures,
    unsupportedCode,
    missingConfigs,
    recommendations,
    partialFeatures,
  };
}

export function computeAnalytics(displayData) {
  const {
    supportedFeatures = [],
    unsupportedCode = [],
    partialFeatures = [],
    recommendations = [],
  } = computeCompatibility(displayData);

  return {
    counts: {
      supported: supportedFeatures.length,
      unsupported: unsupportedCode.length,
      partial: partialFeatures.length,
      suggested: recommendations.length,
    },
    supportedFeatures,
    unsupportedCode,
    partialFeatures,
    recommendations,
    dates: {
      created: formatDate(displayData?.repoDetails?.createdDate),
      updated: formatDate(displayData?.repoDetails?.lastUpdatedDate),
    },
  };
}

export function deriveFeatureDetectionFallbacks(displayData) {
  const env = displayData?.environment || {};
  const arch = displayData?.architecture || {};
  const depsObj = env?.dependencies || {};
  const depInventory = Array.isArray(env?.dependencyInventory) ? env.dependencyInventory.map((d) => d?.name).filter(Boolean) : [];
  const dependencies = depInventory.length ? depInventory : Object.keys(depsObj || {});
  const frameworksCandidates = [
    ...(Array.isArray(env?.primaryFrameworks) ? env.primaryFrameworks : []),
    ...(Array.isArray(arch?.frameworks) ? arch.frameworks : []),
  ].map((f) => String(f)).filter(Boolean);
  const uiFrameworks = Array.from(new Set(frameworksCandidates.filter((f) => /react|angular|vue|svelte|next|nuxt|ember|solid|preact/i.test(f))));

  const configFiles = Array.isArray(arch?.configFiles) ? arch.configFiles : [];
  const testingCandidates = new Set();
  dependencies.forEach((d) => {
    const name = String(d);
    if (/jest/i.test(name)) testingCandidates.add('Jest');
    if (/mocha/i.test(name)) testingCandidates.add('Mocha');
    if (/vitest/i.test(name)) testingCandidates.add('Vitest');
    if (/karma/i.test(name)) testingCandidates.add('Karma');
    if (/jasmine/i.test(name)) testingCandidates.add('Jasmine');
    if (/ava/i.test(name)) testingCandidates.add('AVA');
    if (/cypress/i.test(name)) testingCandidates.add('Cypress');
    if (/playwright/i.test(name)) testingCandidates.add('Playwright');
  });
  configFiles.forEach((f) => {
    if (/jest\.config\.js/i.test(f)) testingCandidates.add('Jest');
    if (/karma\.conf\.js/i.test(f)) testingCandidates.add('Karma');
    if (/protractor\.conf\.js/i.test(f)) testingCandidates.add('Protractor');
  });

  const apiLayer = Array.from(new Set(
    dependencies
      .map((d) => String(d))
      .map((name) => {
        if (/express/i.test(name)) return 'Express';
        if (/koa/i.test(name)) return 'Koa';
        if (/fastify/i.test(name)) return 'Fastify';
        if (/flask/i.test(name)) return 'Flask';
        if (/fastapi/i.test(name)) return 'FastAPI';
        if (/django/i.test(name)) return 'Django';
        if (/spring|spring-boot/i.test(name)) return 'Spring Boot';
        if (/hibernate/i.test(name)) return 'Hibernate';
        if (/gin/i.test(name)) return 'Gin';
        if (/fiber/i.test(name)) return 'Fiber';
        if (/rails/i.test(name)) return 'Rails';
        if (/laravel/i.test(name)) return 'Laravel';
        return null;
      })
      .filter(Boolean)
  ));

  const cicd = [];
  configFiles.forEach((f) => {
    if (/\.github\/workflows\/.+\.ya?ml$/i.test(f)) cicd.push('GitHub Actions');
    if (/\.gitlab-ci\.ya?ml/i.test(f)) cicd.push('GitLab CI');
    if (/azure-pipelines\.ya?ml/i.test(f)) cicd.push('Azure Pipelines');
    if (/circleci\/config\.ya?ml/i.test(f)) cicd.push('CircleCI');
  });

  return {
    uiFrameworks,
    testingFrameworks: Array.from(testingCandidates),
    apiLayer,
    cicd: Array.from(new Set(cicd)),
  };
}

export function mergeSection(displayData, section, fallback = {}) {
  const base = { ...(displayData?.[section] || {}) };
  if (section === 'projectFeatures') {
    const derived = deriveFeatureDetectionFallbacks(displayData);
    const pick = (arr, fb) => (Array.isArray(arr) && arr.length ? arr : (Array.isArray(fb) ? fb : []));
    return {
      ...base,
      uiFrameworks: pick(base.uiFrameworks, derived.uiFrameworks),
      testingFrameworks: pick(base.testingFrameworks, derived.testingFrameworks),
      apiLayer: pick(base.apiLayer, derived.apiLayer),
      cicd: pick(base.cicd, derived.cicd),
      ...fallback,
    };
  }
  return {
    ...base,
    ...fallback,
  };
}

function formatDate(input) {
  if (!input) return '';
  try {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return String(input);
    return d.toLocaleString();
  } catch (_) {
    return String(input);
  }
}