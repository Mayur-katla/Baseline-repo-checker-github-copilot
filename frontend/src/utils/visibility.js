// Efficient visibility utilities to decide if a section has meaningful data

const NULLISH = (v) => v === null || v === undefined;
const isUnknownText = (v) => typeof v === 'string' && /^(unknown|n\/a|na)$/i.test(v.trim());
const isZeroNumber = (v) => typeof v === 'number' && v === 0;

export function hasMeaningfulValue(v) {
  if (NULLISH(v)) return false;
  if (isUnknownText(v)) return false;
  if (isZeroNumber(v)) return false;
  if (Array.isArray(v)) return v.some((x) => hasMeaningfulValue(x));
  if (typeof v === 'object') {
    // Consider object meaningful if any nested value is meaningful
    return Object.values(v).some((x) => hasMeaningfulValue(x));
  }
  // non-empty string or non-zero number
  return String(v).trim().length > 0;
}

export function hasNonZeroCounts(counts = {}) {
  const { supported = 0, partial = 0, unsupported = 0, suggested = 0 } = counts || {};
  return (supported + partial + unsupported + suggested) > 0;
}

export function shouldShowAnalytics(analytics) {
  if (!analytics) return false;
  return hasNonZeroCounts(analytics.counts) || hasMeaningfulValue(analytics.supportedFeatures) || hasMeaningfulValue(analytics.partialFeatures) || hasMeaningfulValue(analytics.unsupportedCode) || hasMeaningfulValue(analytics.recommendations);
}

export function shouldShowCompatibility(compat) {
  if (!compat) return false;
  const { supportedFeatures = [], unsupportedCode = [], partialFeatures = [], recommendations = [], missingConfigs = [] } = compat || {};
  return [supportedFeatures, unsupportedCode, partialFeatures, recommendations, missingConfigs].some((arr) => Array.isArray(arr) && arr.length > 0);
}

export function shouldShowEnvironment(env) {
  if (!env) return false;
  const { frameworks = [], versionCompatibility = [], dependencies = [], vulnerabilities = [], runtimeVersions = {} } = env || {};
  return (
    (Array.isArray(frameworks) && frameworks.length > 0) ||
    (Array.isArray(versionCompatibility) && versionCompatibility.length > 0) ||
    (Array.isArray(dependencies) && dependencies.length > 0) ||
    (Array.isArray(vulnerabilities) && vulnerabilities.length > 0) ||
    hasMeaningfulValue(runtimeVersions)
  );
}

export function shouldShowHealth(health) {
  if (!health) return false;
  const { healthScore = 0, maintainabilityIndex = 0, testCoverage = 0, buildStatus = 'N/A', contributors = 0, commitFrequency = 'N/A' } = health || {};
  return (
    healthScore > 0 || maintainabilityIndex > 0 || testCoverage > 0 || contributors > 0 || !isUnknownText(buildStatus) || !isUnknownText(commitFrequency)
  );
}

export function shouldShowImpact(impact) {
  // Expect shape { topImpacted: [...] }
  const top = impact?.topImpacted || [];
  return Array.isArray(top) && top.length > 0;
}

export function countFilteredSections({ analytics, compat, env, health, impact }) {
  let filtered = 0;
  if (!shouldShowAnalytics(analytics)) filtered++;
  if (!shouldShowCompatibility(compat)) filtered++;
  if (!shouldShowEnvironment(env)) filtered++;
  if (!shouldShowHealth(health)) filtered++;
  if (!shouldShowImpact(impact)) filtered++;
  return filtered;
}
