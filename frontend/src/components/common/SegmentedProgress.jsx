import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { FiCheckCircle } from 'react-icons/fi';

function normalizeStepName(step = '') {
  const s = String(step || '').toLowerCase();
  if (!s) return '';
  if (s.includes('clone')) return 'Clone';
  if (s.includes('analy') || s.includes('parse')) return 'Analyze';
  if (s.includes('modern') || s.includes('migrate') || s.includes('suggest')) return 'Modernize';
  if (s.includes('report') || s.includes('final') || s.includes('result')) return 'Report';
  return '';
}

function SegmentedProgress({
  currentStep,
  progress = 0,
  isComplete = false,
  steps = ['Clone', 'Analyze', 'Modernize', 'Report'],
}) {
  const pct = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : 0;
  const activeName = useMemo(() => normalizeStepName(currentStep), [currentStep]);
  const activeIndex = useMemo(() => {
    const idx = steps.findIndex(s => s === activeName);
    if (idx >= 0) return idx;
    // Fallback: infer from percentage (quarters)
    if (isComplete) return steps.length - 1;
    if (pct >= 75) return 3;
    if (pct >= 50) return 2;
    if (pct >= 25) return 1;
    return 0;
  }, [steps, activeName, pct, isComplete]);

  return (
    <div className="mb-6" role="group" aria-label="Pipeline progress">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-300">Pipeline</span>
        <span className="text-sm text-gray-300" id="pipeline-status" aria-live="polite">
          {isComplete ? 'Completed' : (currentStep || 'Processing…')} ({pct}%)
        </span>
      </div>
      <div className="grid grid-cols-4 gap-3" role="list" aria-describedby="pipeline-status">
        {steps.map((label, idx) => {
          const state = isComplete ? 'completed' : (idx < activeIndex ? 'completed' : (idx === activeIndex ? 'active' : 'pending'));
          const bg = state === 'completed' ? 'bg-green-600/20 border-green-500/50' : state === 'active' ? 'bg-indigo-600/20 border-indigo-500/50' : 'bg-gray-700/40 border-gray-600/50';
          const text = state === 'completed' ? 'text-green-300' : state === 'active' ? 'text-indigo-300' : 'text-gray-300';
          const shadow = state === 'active' ? 'shadow-[0_0_16px_rgba(99,102,241,0.35)]' : '';
          return (
            <div
              key={label}
              className={`relative rounded-xl border p-3 ${bg} ${shadow}`}
              role="listitem"
              aria-current={state === 'active' ? 'step' : undefined}
              aria-label={`Step ${idx + 1}: ${label} — ${state}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${text}`}>{label}</span>
                {state === 'completed' && <FiCheckCircle className="text-green-400" />}
              </div>
              <div className="mt-2 h-2 bg-black/20 rounded overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: state === 'completed' ? '100%' : state === 'active' ? '60%' : '0%' }}
                  transition={{ type: 'spring', stiffness: 160, damping: 24 }}
                  className="h-full rounded"
                  style={{
                    backgroundImage:
                      state === 'completed'
                        ? 'linear-gradient(90deg, rgba(34,197,94,1) 0%, rgba(16,185,129,1) 100%)'
                        : state === 'active'
                          ? 'linear-gradient(90deg, rgba(99,102,241,1) 0%, rgba(168,85,247,1) 100%)'
                          : 'linear-gradient(90deg, rgba(75,85,99,1) 0%, rgba(55,65,81,1) 100%)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {/* Screen reader summary */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Pipeline status: {isComplete ? 'Completed' : (currentStep || 'Processing…')}. Overall progress {pct}%.
      </div>
    </div>
  );
}

export default React.memo(SegmentedProgress);