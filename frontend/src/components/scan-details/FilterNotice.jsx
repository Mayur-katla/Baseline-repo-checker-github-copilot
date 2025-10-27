import React from 'react';

export default function FilterNotice({ hiddenCount = 0 }) {
  if (!hiddenCount || hiddenCount <= 0) return null;
  return (
    <div className="flex items-center gap-2 text-xs md:text-sm text-gray-700 dark:text-gray-300 bg-yellow-100/60 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg px-3 py-2">
      <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
      <span>{hiddenCount} section{hiddenCount > 1 ? 's' : ''} hidden due to low/unknown data. Toggle filters in settings.</span>
    </div>
  );
}
