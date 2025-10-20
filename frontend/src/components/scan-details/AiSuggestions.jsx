import React, { useMemo, useState } from 'react';
import { FiCpu, FiShield, FiZap, FiSettings, FiGrid, FiFileText } from 'react-icons/fi';


const CategoryTabs = ({ active, setActive, counts }) => {
  const tabOrder = ['all', 'secure', 'modernize', 'performance', 'cleanup'];
  const onArrowNavigate = (currentIdx, e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const nextIdx = (currentIdx + delta + tabOrder.length) % tabOrder.length;
    setActive(tabOrder[nextIdx]);
  };

  const Tab = ({ id, label, icon, idx }) => (
    <button
      onClick={() => setActive(id)}
      onKeyDown={(e) => onArrowNavigate(idx, e)}
      role="tab"
      aria-selected={active === id}
      tabIndex={active === id ? 0 : -1}
      aria-label={`${label} suggestions (${counts[id] || 0})`}
      className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 ${
        active === id
          ? 'bg-indigo-600 text-white'
          : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {icon}
      {label}
      <span className="ml-1 text-xs opacity-80" aria-hidden="true">({counts[id] || 0})</span>
    </button>
  );
  return (
    <div className="flex gap-2 items-center" role="tablist" aria-label="Suggestion categories">
      <Tab id="all" label="All" icon={<FiGrid />} idx={0} />
      <Tab id="secure" label="Security" icon={<FiShield />} idx={1} />
      <Tab id="modernize" label="Modernization" icon={<FiCpu />} idx={2} />
      <Tab id="performance" label="Performance" icon={<FiZap />} idx={3} />
      <Tab id="cleanup" label="Maintenance" icon={<FiSettings />} idx={4} />
    </div>
  );
};

const SuggestionItem = ({ s }) => (
  <div className="p-4 rounded-lg border border-gray-700/50 bg-gray-800/40 hover:bg-gray-700/40 transition-colors">
    <div className="flex justify-between items-start">
      <div>
        <p className="font-semibold text-white flex items-center"><FiFileText className="mr-2" />{s.title}</p>
        <p className="text-xs text-gray-400 mt-1">{s.file}</p>
        <p className="text-sm text-gray-300 mt-2">{s.description}</p>
      </div>
      <div className={`text-xs px-2 py-1 rounded-full ${s.severity === 'High' ? 'bg-red-500/20 text-red-300' : (s.severity === 'Medium' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300')}`}>
        {s.severity}
      </div>
    </div>
    {s.hint && (<div className="mt-2 text-xs text-indigo-300">Hint: {s.hint}</div>)}
  </div>
);


const AiSuggestions = ({ data }) => {
  if (!data) return null;

  const items = Array.isArray(data.items) ? data.items : [];
  const [active, setActive] = useState('all');

  const categorized = useMemo(() => {
    const byCat = { all: items, secure: [], modernize: [], performance: [], cleanup: [] };
    for (const s of items) {
      const cat = ['secure','modernize','performance','cleanup'].includes(s.category) ? s.category : 'modernize';
      byCat[cat].push(s);
    }
    return byCat;
  }, [items]);

  const counts = useMemo(() => ({
    all: items.length,
    secure: categorized.secure.length,
    modernize: categorized.modernize.length,
    performance: categorized.performance.length,
    cleanup: categorized.cleanup.length,
  }), [items.length, categorized]);

  const visible = active === 'all' ? categorized.all : categorized[active] || [];

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 mt-8">
      <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
        <FiCpu className="mr-3 text-indigo-400" />
        AI Suggestions / Autopilot
      </h2>

      <div className="flex items-center justify-between mb-4">
        <CategoryTabs active={active} setActive={setActive} counts={counts} />
        {data?.meta?.rateLimited && (
          <span className="text-xs text-yellow-300">Rate limited; suggestions may be partial.</span>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="text-sm text-gray-300 italic">No suggestions in this category.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.map((s) => (
            <SuggestionItem key={s.id} s={s} />
          ))}
        </div>
      )}

      {Array.isArray(data?.rationale) && data.rationale.length > 0 && (
        <div className="mt-6 text-xs text-gray-400">
          <div className="font-semibold text-gray-300 mb-2">Rationale</div>
          <ul className="list-disc list-inside space-y-1">
            {data.rationale.slice(0, 6).map((r, idx) => (
              <li key={idx}><span className="text-gray-300">{r.label}:</span> {r.detail}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AiSuggestions;