import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';



const RibbonPopup = ({ open, onClose, autoCloseMs = 5000, onViewHighlights }) => {
  useEffect(() => {
    if (!open || !autoCloseMs) return;
    const t = setTimeout(() => onClose?.(), autoCloseMs);
    return () => clearTimeout(t);
  }, [open, autoCloseMs, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onClose?.()}
          />


          {/* Modal card */}
          <motion.div
            role="dialog"
            aria-modal="true"
            className="absolute inset-0 flex items-center justify-center p-4"
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <div className="relative w-full max-w-md rounded-2xl border border-gray-700/50 bg-gray-900/80 shadow-2xl">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white shadow">
                Completed
              </div>
              <div className="p-6">
                <h2 className="text-2xl font-bold text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">Scan Complete!</h2>
                <p className="text-sm text-gray-300 mb-5">Your baseline analysis finished successfully. Explore the insights and modernization suggestions now.</p>
                <div className="flex items-center justify-end gap-3">
                  {onViewHighlights && (
                    <button
                      onClick={() => { onViewHighlights(); onClose?.(); }}
                      className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow hover:bg-indigo-700 transition-colors"
                    >
                      View Highlights
                    </button>
                  )}
                  <button
                    onClick={() => onClose?.()}
                    className="px-4 py-2 text-sm font-semibold text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RibbonPopup;