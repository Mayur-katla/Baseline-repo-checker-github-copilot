import React from 'react';
import { FiTrendingUp } from 'react-icons/fi';

function safeCount(arr) {
  return Array.isArray(arr) ? arr.length : 0;
}

function percentage(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

export default function AiSummary({ ai = {}, analytics = {}, securityData = {}, compat = {} }) {
  const items = Array.isArray(ai.items) ? ai.items : [];
  const uniqueFiles = Array.from(new Set(items.map((s) => s.file))).length;

  const categoryCounts = items.reduce(
    (acc, s) => {
      const c = (s.category || '').toLowerCase();
      if (c.includes('secure')) acc.security += 1;
      else if (c.includes('modernize')) acc.modernization += 1;
      else if (c.includes('performance')) acc.performance += 1;
      else acc.maintenance += 1; // default bucket
      return acc;
    },
    { security: 0, modernization: 0, performance: 0, maintenance: 0 }
  );

  const totalCompat = (analytics?.counts?.supported || 0) + (analytics?.counts?.partial || 0) + (analytics?.counts?.unsupported || 0);
  const baselineCompliance = percentage(analytics?.counts?.supported || 0, totalCompat || 0);

  const severityScore = items.reduce((sum, s) => {
    const sev = String(s.severity || '').toLowerCase();
    if (sev.startsWith('high')) return sum + 3;
    if (sev.startsWith('medium')) return sum + 2;
    if (sev) return sum + 1;
    return sum;
  }, 0);
  const estimatedImprovement = Math.min(40, Math.round(Math.sqrt(items.length) * 5 + severityScore * 2));

  const missingPolicies = safeCount(securityData?.missingPolicies);
  const insecureApiCalls = safeCount(securityData?.insecureApiCalls);
  const securityFindings = missingPolicies + insecureApiCalls;

  const modernizationText = `${categoryCounts.modernization} modernization`;
  const securityText = `${securityFindings} security`;
  const perfText = `${categoryCounts.performance} performance`;
  const maintText = `${categoryCounts.maintenance} maintenance`;

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-xl border border-gray-700/50 shadow-lg">
      <div className="p-6 flex items-start gap-4">
        <div className="p-3 rounded-full bg-indigo-500/20 text-indigo-300"><FiTrendingUp /></div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-2">AI Summary</h3>
          <p className="text-sm text-gray-300">
            {items.length} suggestions across {uniqueFiles} files — {modernizationText}, {securityText}, {perfText}, {maintText}.
            Baseline compliance is currently {baselineCompliance}%.
            Estimated modernization impact: +{estimatedImprovement}% compliance after applying recommended changes.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            This estimate uses a simple heuristic based on suggestion count and severity and may vary with code context.
          </p>
        </div>
      </div>
    </div>
  );
}