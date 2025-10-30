import React from 'react';
import { FiClock, FiFile, FiAlertCircle, FiCpu, FiCalendar, FiCheckCircle } from 'react-icons/fi';

const LogItem = ({ icon, label, value }) => (
  <div className="flex justify-between items-center py-2 border-b border-gray-700/50 text-sm">
    <div className="flex items-center text-gray-300">
      {icon}
      <span className="ml-3">{label}</span>
    </div>
    <span className="font-mono text-white">{value}</span>
  </div>
);

const SummaryLog = ({ data }) => {
  if (!data) return null;

  const {
    duration = '0s',
    filesIgnored = 0,
    errorLogs = [],
    agentVersion = 'N/A',
    scanDate = new Date().toISOString(),
    stats = {},
    resourceUsage = {},
    warnings = [],
  } = data;

  const colorFor = (text = '') => {
    const t = String(text).toLowerCase();
    if (t.includes('error') || t.includes('fail')) return 'bg-red-500';
    if (t.includes('warn')) return 'bg-yellow-500';
    if (t.includes('done') || t.includes('complete') || t.includes('success')) return 'bg-green-500';
    return 'bg-indigo-500';
  };
  const iconFor = (text = '') => {
    const t = String(text).toLowerCase();
    if (t.includes('error') || t.includes('fail')) return <FiAlertCircle className="text-red-400"/>;
    if (t.includes('done') || t.includes('complete') || t.includes('success')) return <FiCheckCircle className="text-green-400"/>;
    return <FiClock className="text-indigo-400"/>;
  };

  const normalizeLog = (l) => {
    if (typeof l === 'string') return l;
    try {
      if (l && typeof l === 'object') return String(l.msg || l.message || JSON.stringify(l));
    } catch {}
    return String(l);
  };
  const timeline = Array.isArray(errorLogs) ? errorLogs.map(normalizeLog) : [];

  return (
    <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-200 dark:border-gray-700/50 mt-8">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <FiFile className="mr-3 text-indigo-400" />
        Summary Log
      </h2>

      <div className="space-y-2 mb-6">
        <LogItem icon={<FiClock />} label="Scan Duration" value={duration} />
        <LogItem icon={<FiFile />} label="Files Skipped" value={filesIgnored} />
        <LogItem icon={<FiCpu />} label="Agent Version" value={agentVersion} />
        <LogItem icon={<FiCalendar />} label="Scan Date" value={new Date(scanDate).toLocaleString()} />
        {stats && (typeof stats.filesScanned === 'number') ? (
          <LogItem icon={<FiFile />} label="Files Scanned" value={stats.filesScanned} />
        ) : null}
        {stats && (typeof stats.issuesFound === 'number') ? (
          <LogItem icon={<FiAlertCircle />} label="Issues Found" value={stats.issuesFound} />
        ) : null}
        {resourceUsage && (resourceUsage.memoryRSSMB || resourceUsage.heapUsedMB) ? (
          <LogItem icon={<FiCpu />} label="Resource Usage" value={`RSS ${resourceUsage.memoryRSSMB ?? '0'} MB; Heap ${resourceUsage.heapUsedMB ?? '0'} MB; CPU user ${resourceUsage.cpuUserMs ?? 0}ms / sys ${resourceUsage.cpuSystemMs ?? 0}ms`} />
        ) : null}
        {(Array.isArray(warnings) && warnings.length > 0) ? (
          <LogItem icon={<FiAlertCircle />} label="Warnings" value={warnings.join('; ')} />
        ) : null}
      </div>

      <div>
        <h3 className="font-semibold text-white mb-3 flex items-center">
          <FiAlertCircle className="mr-2 text-red-400"/> Error Logs
        </h3>
        <div className="bg-gray-100 dark:bg-black/30 rounded-lg p-4 max-h-40 overflow-y-auto font-mono text-xs text-red-600 dark:text-red-300 border border-gray-300 dark:border-gray-700/50">
          {timeline.length > 0 ? (
            timeline.map((log, index) => <p key={index}>- {log}</p>)
          ) : (
            <p className="text-gray-400 italic">No errors reported.</p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold text-white mb-3 flex items-center">
          <FiClock className="mr-2 text-indigo-400"/> Scan Timeline
        </h3>
        <div className="relative pl-6">
          <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-700/50" />
          {(timeline || []).map((log, index) => (
            <div key={index} className="relative mb-3">
              <span className={`absolute left-0 top-1 w-3 h-3 rounded-full ${colorFor(log)}`} />
              <div className="flex items-center gap-2 text-xs text-gray-300">
                {iconFor(log)}
                <span className="font-mono break-words">{log}</span>
              </div>
            </div>
          ))}
          {(!timeline || timeline.length === 0) && (
            <p className="text-xs text-gray-400 italic">No timeline entries captured.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SummaryLog;
