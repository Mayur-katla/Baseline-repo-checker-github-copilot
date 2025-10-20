import React from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client.js';
import { FiActivity, FiFile } from 'react-icons/fi';

export default function ImpactByBaseline({ scanId }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['impact', scanId],
    queryFn: async () => {
      const res = await apiClient.get(`/scans/${scanId}/impact`);
      return res.data;
    },
    enabled: !!scanId,
  });

  const top = data?.topImpacted || [];

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-xl border border-gray-700/50 shadow-lg mt-6 transition-transform transition-shadow duration-200 hover:scale-[1.01] hover:shadow-xl hover:border-indigo-500/40">
      <div className="p-6">
        <div className="flex items-start gap-3 mb-2">
          <div className="p-3 rounded-full bg-indigo-500/20 text-indigo-300"><FiActivity /></div>
          <div>
            <h3 className="text-lg font-semibold text-white">Impact by Baseline</h3>
            <p className="text-xs text-gray-400">Top files weighted by unsupported and partial features.</p>
          </div>
        </div>
        {isLoading && <p className="text-sm text-gray-400">Loading impact…</p>}
        {isError && <p className="text-sm text-red-400">{error?.message || 'Failed to load impact'}</p>}
        {!isLoading && !isError && top.length === 0 && (
          <p className="text-sm text-gray-400">No impact data available.</p>
        )}
        {!isLoading && !isError && top.length > 0 && (
          <div className="space-y-3">
            {top.map((item) => (
              <div key={item.file} className="">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center text-sm text-white"><FiFile className="mr-2" />{item.file}</div>
                  <div className="text-xs text-gray-400">score {item.score} • unsupported {item.unsupported} • partial {item.partial}</div>
                </div>
                <div className="h-3 bg-gray-700/50 rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                    style={{ width: `${Math.min(100, Math.max(5, Math.round((item.score / (top[0]?.score || 1)) * 100)))}%` }}
                    title={`Impact score ${item.score}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}