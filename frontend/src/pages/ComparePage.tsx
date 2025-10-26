import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client.js';
import CodeViewer from '../components/CodeViewer';
import ArchitectureFlow from '../components/ArchitectureFlow';

function useScan(id: string | null) {
  return useQuery({
    queryKey: ['scanResult', id],
    queryFn: async ({ signal }) => {
      if (!id) return null;
      const res = await apiClient.get(`/scans/${id}`, { signal });
      return res.data;
    },
    enabled: !!id,
    staleTime: Infinity,
  });
}

function usePredictive(id: string | null) {
  return useQuery({
    queryKey: ['predictive', id],
    queryFn: async ({ signal }) => {
      if (!id) return null;
      const res = await apiClient.get(`/analytics/predictive`, { params: { scanId: id }, signal });
      return res.data;
    },
    enabled: !!id,
    staleTime: Infinity,
  });
}

function useCompliance(id: string | null) {
  return useQuery({
    queryKey: ['compliance', id],
    queryFn: async ({ signal }) => {
      if (!id) return null;
      const res = await apiClient.get(`/report/compliance`, { params: { scanId: id }, signal });
      return res.data;
    },
    enabled: !!id,
    staleTime: Infinity,
  });
}

export default function ComparePage() {
  const [leftId, setLeftId] = useState<string>('');
  const [rightId, setRightId] = useState<string>('');

  const { data: leftScan } = useScan(leftId || null);
  const { data: rightScan } = useScan(rightId || null);
  const { data: leftPred } = usePredictive(leftId || null);
  const { data: rightPred } = usePredictive(rightId || null);
  const { data: leftComp } = useCompliance(leftId || null);
  const { data: rightComp } = useCompliance(rightId || null);

  const leftFrameworks = useMemo(() => {
    const env = leftScan?.environment || {};
    const arch = leftScan?.architecture || {};
    const list = [
      ...(Array.isArray(env.primaryFrameworks) ? env.primaryFrameworks : []),
      ...(Array.isArray(arch.frameworks) ? arch.frameworks : []),
    ];
    return Array.from(new Set(list.map((x: any) => String(x)))).sort();
  }, [leftScan]);

  const rightFrameworks = useMemo(() => {
    const env = rightScan?.environment || {};
    const arch = rightScan?.architecture || {};
    const list = [
      ...(Array.isArray(env.primaryFrameworks) ? env.primaryFrameworks : []),
      ...(Array.isArray(arch.frameworks) ? arch.frameworks : []),
    ];
    return Array.from(new Set(list.map((x: any) => String(x)))).sort();
  }, [rightScan]);

  const uniqLeft = leftFrameworks.filter(f => !rightFrameworks.includes(f));
  const uniqRight = rightFrameworks.filter(f => !leftFrameworks.includes(f));
  const intersect = leftFrameworks.filter(f => rightFrameworks.includes(f));

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Compare Scans</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white/90 dark:bg-gray-800">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Left Scan ID</label>
          <input value={leftId} onChange={(e) => setLeftId(e.target.value)} placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000" className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white/90 dark:bg-gray-800">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Right Scan ID</label>
          <input value={rightId} onChange={(e) => setRightId(e.target.value)} placeholder="e.g. 123e4567-e89b-12d3-a456-426614174001" className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white/90 dark:bg-gray-800 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Frameworks</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Unique Left</div>
            <ul className="mt-1 space-y-1">
              {uniqLeft.map(f => (<li key={f} className="text-gray-800 dark:text-gray-200">{f}</li>))}
              {uniqLeft.length === 0 && <li className="text-gray-500 dark:text-gray-400">None</li>}
            </ul>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Intersection</div>
            <ul className="mt-1 space-y-1">
              {intersect.map(f => (<li key={f} className="text-gray-800 dark:text-gray-200">{f}</li>))}
              {intersect.length === 0 && <li className="text-gray-500 dark:text-gray-400">None</li>}
            </ul>
          </div>
          <div>
            <div className="text-sm font-medium text-pink-600 dark:text-pink-400">Unique Right</div>
            <ul className="mt-1 space-y-1">
              {uniqRight.map(f => (<li key={f} className="text-gray-800 dark:text-gray-200">{f}</li>))}
              {uniqRight.length === 0 && <li className="text-gray-500 dark:text-gray-400">None</li>}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white/90 dark:bg-gray-800 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Predictive Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-md bg-gray-50 dark:bg-gray-900/60">
            <div className="text-sm text-gray-600 dark:text-gray-300">Left</div>
            <div className="mt-1 text-gray-900 dark:text-gray-100">Risk: {leftPred?.riskScore ?? '—'}</div>
            <div className="text-gray-900 dark:text-gray-100">Trend: {leftPred?.trend ?? '—'}</div>
            <div className="text-gray-900 dark:text-gray-100">Debt: {leftPred?.projectedDebt ?? '—'}</div>
          </div>
          <div className="p-3 rounded-md bg-gray-50 dark:bg-gray-900/60">
            <div className="text-sm text-gray-600 dark:text-gray-300">Right</div>
            <div className="mt-1 text-gray-900 dark:text-gray-100">Risk: {rightPred?.riskScore ?? '—'}</div>
            <div className="text-gray-900 dark:text-gray-100">Trend: {rightPred?.trend ?? '—'}</div>
            <div className="text-gray-900 dark:text-gray-100">Debt: {rightPred?.projectedDebt ?? '—'}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white/90 dark:bg-gray-800 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Compliance Snapshot</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-md bg-gray-50 dark:bg-gray-900/60">
            <div className="text-sm text-gray-600 dark:text-gray-300">Left</div>
            <div className="mt-1 text-gray-900 dark:text-gray-100">Status: {leftComp?.sections?.SOC2?.status ?? '—'}</div>
          </div>
          <div className="p-3 rounded-md bg-gray-50 dark:bg-gray-900/60">
            <div className="text-sm text-gray-600 dark:text-gray-300">Right</div>
            <div className="mt-1 text-gray-900 dark:text-gray-100">Status: {rightComp?.sections?.SOC2?.status ?? '—'}</div>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white/90 dark:bg-gray-800 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Result JSON Preview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Left</div>
            <CodeViewer language="json" code={JSON.stringify(leftScan ?? {}, null, 2)} height="40vh" />
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Right</div>
            <CodeViewer language="json" code={JSON.stringify(rightScan ?? {}, null, 2)} height="40vh" />
          </div>
        </div>
      </div>

      {(() => {
        const graph = buildGraph(leftScan ?? rightScan ?? {});
        return (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white/90 dark:bg-gray-800 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Architecture Diagram</h2>
            <ArchitectureFlow nodes={graph.nodes} edges={graph.edges} height="40vh" />
          </div>
        );
      })()}
    </div>
  );
}

const buildGraph = (scan: any) => {
  const nodes = [] as { id: string; position: { x: number; y: number }; data: { label: string } }[];
  const edges = [] as { id: string; source: string; target: string }[];
  const has = (key: string) => Boolean(scan && (scan[key] || scan?.projectFeatures?.[key] || scan?.architecture?.[key]));
  const id = (s: string) => s.toLowerCase().replace(/\s+/g, '-');
  const baseNodes = ['Frontend', 'Backend', 'Redis', 'CI/CD', 'Docker'];
  baseNodes.forEach((label, idx) => nodes.push({ id: id(label), position: { x: 50 + idx * 140, y: 60 + (idx % 2) * 120 }, data: { label } }));
  edges.push({ id: 'frontend-backend', source: 'frontend', target: 'backend' });
  if (has('redis')) edges.push({ id: 'backend-redis', source: 'backend', target: 'redis' });
  if (has('docker') || has('container')) edges.push({ id: 'backend-docker', source: 'backend', target: 'docker' });
  if (has('ci') || has('githubActions')) edges.push({ id: 'pipeline', source: 'ci/cd', target: 'backend' });
  return { nodes, edges };
};