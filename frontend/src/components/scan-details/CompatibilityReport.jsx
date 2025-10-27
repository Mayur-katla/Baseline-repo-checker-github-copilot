import React from 'react';
import { hasMeaningfulValue } from '../../utils/visibility.js';

export default function CompatibilityReport({ compatibility }) {
  const { supportedFeatures = [], unsupportedCode = [], missingConfigs = [], recommendations = [] } = compatibility || {};

  // Hide if all key lists are empty or not meaningful
  const show = [supportedFeatures, unsupportedCode, missingConfigs, recommendations].some((arr) => Array.isArray(arr) && arr.length > 0);
  if (!show) return null;

  return (
    <div className="space-y-3 transition-all duration-300">
      {Array.isArray(supportedFeatures) && supportedFeatures.length > 0 && (
        <div className="p-3 rounded-lg bg-white/80 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50">
          <p className="font-semibold text-green-600">Supported Features ({supportedFeatures.length})</p>
          <ul className="mt-2 list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
            {supportedFeatures.map((f, i) => (<li key={i}>{f}</li>))}
          </ul>
        </div>
      )}

      {Array.isArray(unsupportedCode) && unsupportedCode.length > 0 && (
        <div className="p-3 rounded-lg bg-white/80 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50">
          <p className="font-semibold text-red-600">Unsupported Code ({unsupportedCode.length})</p>
          <ul className="mt-2 list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
            {unsupportedCode.map((u, i) => (<li key={i}>{u}</li>))}
          </ul>
        </div>
      )}

      {Array.isArray(missingConfigs) && missingConfigs.length > 0 && (
        <div className="p-3 rounded-lg bg-white/80 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50">
          <p className="font-semibold text-yellow-600">Missing Configurations ({missingConfigs.length})</p>
          <ul className="mt-2 list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
            {missingConfigs.map((m, i) => (<li key={i}>{m}</li>))}
          </ul>
        </div>
      )}

      {Array.isArray(recommendations) && recommendations.length > 0 && (
        <div className="p-3 rounded-lg bg-white/80 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50">
          <p className="font-semibold text-indigo-600">Recommendations ({recommendations.length})</p>
          <ul className="mt-2 list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
            {recommendations.map((r, i) => (<li key={i}>{r}</li>))}
          </ul>
        </div>
      )}
    </div>
  );
}