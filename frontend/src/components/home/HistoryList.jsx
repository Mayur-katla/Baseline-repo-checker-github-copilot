import React from 'react';
import { motion } from 'framer-motion';
import { FiChevronRight, FiAlertCircle, FiCheckCircle, FiLoader } from 'react-icons/fi';

const StatusIndicator = ({ status }) => {
  if (status === 'done') {
    return <span className="flex items-center text-green-400"><FiCheckCircle className="mr-2" /> Completed</span>;
  }
  if (status === 'failed') {
    return <span className="flex items-center text-red-400"><FiAlertCircle className="mr-2" /> Failed</span>;
  }
  return <span className="flex items-center text-blue-400 animate-pulse"><FiLoader className="mr-2 animate-spin" /> In Progress</span>;
};

const HistoryList = ({ scans = [], onViewDetails = () => {}, onDelete = () => {} }) => {
  if (!scans.length) {
    return <p className="text-center text-gray-400">No scans found. Start a new scan to see results here.</p>;
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left table-auto">
        <thead>
          <tr className="border-b border-white/20">
            <th className="p-4">Repository</th>
            <th className="p-4">Status</th>
            <th className="p-4">Progress</th>
            <th className="p-4">Created</th>
            <th className="p-4"></th>
            <th className="p-4"></th>
          </tr>
        </thead>
        <tbody>
          {scans.map((scan, index) => (
            <motion.tr 
              key={scan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="border-b border-white/10 hover:bg-white/5 transition-colors duration-200"
            >
              <td className="p-4 font-mono">{scan.repoUrl}</td>
              <td className="p-4"><StatusIndicator status={scan.status} /></td>
              <td className="p-4">
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                  <div className="bg-primary-500 h-2.5 rounded-full" style={{ width: `${scan.progress}%` }}></div>
                </div>
              </td>
              <td className="p-4">{formatDate(scan.createdAt)}</td>
              <td className="p-4 text-right">
                <button 
                  onClick={() => onViewDetails(scan.id)}
                  className="bg-primary-500/50 text-white px-4 py-2 rounded-full hover:bg-primary-500 transition-all duration-300 flex items-center"
                >
                  View Details <FiChevronRight className="ml-1" />
                </button>
              </td>
              <td className="p-4 text-right">
                <button 
                  onClick={() => onDelete(scan.id)}
                  className="bg-red-500/50 text-white px-4 py-2 rounded-full hover:bg-red-500 transition-all duration-300 flex items-center"
                >
                  Delete
                </button>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HistoryList;