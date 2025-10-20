import React, { useMemo, useState } from 'react';
import { FiActivity, FiFile } from 'react-icons/fi';

function weightForSeverity(sevRaw) {
  const sev = String(sevRaw || '').toLowerCase();
  if (sev.startsWith('high')) return 3;
  if (sev.startsWith('medium')) return 2;
  if (sev) return 1;
  return 1;
}

function multiplierForCategory(catRaw) {
  const cat = String(catRaw || '').toLowerCase();
  if (cat.includes('secure')) return 1.3; // emphasize security
  if (cat.includes('performance')) return 1.2;
  if (cat.includes('modernize')) return 1.1;
  return 1.0; // cleanup / maintenance
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

export default function ImpactHeatmap({ ai = {}, maxItems = 20 }) {
  const items = Array.isArray(ai.items) ? ai.items : [];
  const [showAll, setShowAll] = useState(false);

  const fileStats = useMemo(() => {
    const map = new Map();
    items.forEach((s) => {
      const file = s.file || 'unknown';
      const base = weightForSeverity(s.severity);
      const mult = multiplierForCategory(s.category);
      const score = base * mult;
      const prev = map.get(file) || { file, count: 0, score: 0, cats: new Set() };
      prev.count += 1;
      prev.score += score;
      if (s.category) prev.cats.add(String(s.category));
      map.set(file, prev);
    });
    const list = Array.from(map.values()).map((e) => ({ ...e, categories: Array.from(e.cats) }));
    // Scale to percentage-like impact, capped at 100
    const maxScore = list.reduce((m, e) => Math.max(m, e.score), 0) || 1;
    return list
      .map((e) => ({ ...e, pct: clamp(Math.round((e.score / maxScore) * 100), 1, 100) }))
      .sort((a, b) => b.pct - a.pct);
  }, [items]);

  const visible = showAll ? fileStats : fileStats.slice(0, maxItems);

  if (!items.length) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-md rounded-xl border border-gray-700/50 shadow-lg">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Impact Heatmap</h3>
          <p className="text-sm text-gray-400">No AI suggestions available to compute impact.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-xl border border-gray-700/50 shadow-lg">
      <div className="p-6">
        <div className="flex items-start gap-3 mb-2">
          <div className="p-3 rounded-full bg-indigo-500/20 text-indigo-300"><FiActivity /></div>
          <div>
            <h3 className="text-lg font-semibold text-white">Impact Heatmap</h3>
            <p className="text-xs text-gray-400">Per-file impact based on suggestion count and severity. Higher bars indicate higher expected modernization gain.</p>
          </div>
        </div>
        <div className="space-y-3">
          {visible.map((fs) => (
            <div key={fs.file} className="">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center text-sm text-white"><FiFile className="mr-2" />{fs.file}</div>
                <div className="text-xs text-gray-400">{fs.count} suggestions</div>
              </div>
              <div className="h-4 bg-gray-700/50 rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                  style={{ width: `${fs.pct}%` }}
                  title={`${fs.pct}% impact`}
                />
              </div>
              {fs.categories.length > 0 && (
                <div className="text-xs text-gray-400 mt-1">{fs.categories.join(', ')}</div>
              )}
            </div>
          ))}
        </div>
        {fileStats.length > maxItems && (
          <div className="mt-4">
            <button
              onClick={() => setShowAll((v) => !v)}
              className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >{showAll ? 'Show Top' : 'Show All'}</button>
          </div>
        )}
      </div>
    </div>
  );
}