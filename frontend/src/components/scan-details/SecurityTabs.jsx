import React, { useState } from 'react';
import { FiShield, FiSliders } from 'react-icons/fi';
import SecurityHygiene from './SecurityHygiene.jsx';
import SecurityAndPerformance from './SecurityAndPerformance.jsx';

export default function SecurityTabs({ securityData = {}, recommendations = [], scanId }) {
  const [active, setActive] = useState('insights'); // 'insights' | 'hygiene'

  const TabButton = ({ id, label }) => (
    <button
      onClick={() => setActive(id)}
      className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
        active === id
          ? 'bg-indigo-600 text-white'
          : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-white/60 dark:bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-200 dark:border-gray-700 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <FiShield className="mr-3 text-indigo-600 dark:text-indigo-400" />
          Security
        </h2>
        <div className="flex gap-2 items-center">
          <TabButton id="insights" label="Insights" />
          <TabButton id="hygiene" label="Hygiene" />
        </div>
      </div>

      {active === 'insights' ? (
        <SecurityAndPerformance data={securityData} />
      ) : (
        <SecurityHygiene data={securityData} recommendations={recommendations} scanId={scanId} />
      )}

      <div className="mt-4 text-xs text-gray-600 dark:text-gray-500 flex items-center gap-2">
        <FiSliders /> Switch tabs to focus on insights vs concrete hygiene items.
      </div>
    </div>
  );
}