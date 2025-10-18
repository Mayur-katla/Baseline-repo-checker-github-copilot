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

export function mergeSection(displayData, section, fallback = {}) {
  return {
    ...(displayData?.[section] || {}),
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