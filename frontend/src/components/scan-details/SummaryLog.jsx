import React from 'react';
import { FiClock, FiFile, FiAlertCircle, FiCpu, FiCalendar } from 'react-icons/fi';

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
  } = data;

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 mt-8">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <FiFile className="mr-3 text-indigo-400" />
        Summary Log
      </h2>

      <div className="space-y-2 mb-6">
        <LogItem icon={<FiClock />} label="Scan Duration" value={duration} />
        <LogItem icon={<FiFile />} label="Files Skipped" value={filesIgnored} />
        <LogItem icon={<FiCpu />} label="Agent Version" value={agentVersion} />
        <LogItem icon={<FiCalendar />} label="Scan Date" value={new Date(scanDate).toLocaleString()} />
      </div>

      <div>
        <h3 className="font-semibold text-white mb-3 flex items-center">
          <FiAlertCircle className="mr-2 text-red-400"/> Error Logs
        </h3>
        <div className="bg-black/30 rounded-lg p-4 max-h-40 overflow-y-auto font-mono text-xs text-red-300">
          {errorLogs.length > 0 ? (
            errorLogs.map((log, index) => <p key={index}>- {log}</p>)
          ) : (
            <p className="text-gray-400 italic">No errors reported.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SummaryLog;