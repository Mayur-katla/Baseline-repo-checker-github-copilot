import React from 'react';
import { motion } from 'framer-motion';

export default function ProgressBar({ progress = 0, label = 'Processing…', statusBadge }) {
  const pct = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : 0;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-300 flex items-center gap-3">
          <span>{label}</span>
          {statusBadge && (
            <span className={`text-xs px-2 py-1 rounded-full ${statusBadge.cls}`}>{statusBadge.text}</span>
          )}
        </span>
        <span className="text-sm text-gray-300">{pct}%</span>
      </div>
      <div className="w-full h-3 bg-gray-700 rounded overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22 }}
          className="h-full rounded"
          style={{
            backgroundImage:
              'linear-gradient(90deg, rgba(99,102,241,1) 0%, rgba(168,85,247,1) 100%),\n               repeating-linear-gradient(\n                 45deg,\n                 rgba(255,255,255,0.15) 0px,\n                 rgba(255,255,255,0.15) 8px,\n                 rgba(255,255,255,0.05) 8px,\n                 rgba(255,255,255,0.05) 16px\n               )',
            backgroundBlendMode: 'overlay',
            boxShadow: '0 0 16px rgba(99,102,241,0.45)',
            backgroundSize: '200% 100%, 24px 24px',
            animation: 'progress-stripes 1.2s linear infinite',
          }}
          aria-label="scan-progress"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      </div>
      <style>
        {`
        @keyframes progress-stripes {
          0% { background-position: 0% 0, 0 0; }
          100% { background-position: 200% 0, 24px 0; }
        }
        `}
      </style>
    </div>
  );
}