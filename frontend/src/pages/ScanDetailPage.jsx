import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLoader, FiAlertTriangle, FiFile, FiCode, FiCheckCircle, FiXCircle, FiDownload, FiGithub } from 'react-icons/fi';
import apiClient, { poll } from '../api/client.js';
import { useSocket } from '../hooks/useSocket.js';
import ProgressBar from '../components/common/ProgressBar.jsx';
import AnalyticsStatistics from '../components/scan-details/AnalyticsStatistics.jsx';
import AnalyticsChart from '../components/scan-details/AnalyticsChart.jsx';
import CompatibilityStackedBar from '../components/scan-details/CompatibilityStackedBar.jsx';
import RepositoryOverview from '../components/scan-details/RepositoryOverview.jsx';
import EnvironmentAndVersioning from '../components/scan-details/EnvironmentAndVersioning.jsx';
import FeatureDetection from '../components/scan-details/FeatureDetection.jsx';
import ArchitectureAnalysis from '../components/scan-details/ArchitectureAnalysis.jsx';
import CompatibilityReport from '../components/scan-details/CompatibilityReport.jsx';
import SecurityAndPerformance from '../components/scan-details/SecurityAndPerformance.jsx';
import HealthAndMaintenance from '../components/scan-details/HealthAndMaintenance.jsx';
import AiSuggestions from '../components/scan-details/AiSuggestions.jsx';
import SummaryLog from '../components/scan-details/SummaryLog.jsx';
import VulnerabilityList from '../components/scan-details/VulnerabilityList.jsx';
import ExportOptions from '../components/scan-details/ExportOptions.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';
import { computeCompatibility, computeAnalytics, mergeSection } from '../utils/aggregators.js';
import { buildUnifiedDiff, downloadBlob } from '../utils/report.js';
import { getRepoOverview, getRepoStats } from '../api/github.js';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import RouterHintsPanel from '../components/router/RouterHintsPanel.jsx'
import SecurityHygiene from '../components/scan-details/SecurityHygiene.jsx';

const StatCard = ({ title, value, icon }) => (
  <div className="bg-gray-800/50 backdrop-blur-md rounded-xl p-4 flex items-center border border-gray-700/50">
    <div className="p-3 rounded-full bg-indigo-500/20 text-indigo-300 mr-4">{icon}</div>
    <div>
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  </div>
);

const DiffViewer = ({ original, modified, language }) => (
  <div className="bg-black/50 rounded-lg overflow-hidden border border-gray-700">
    <div className="p-2 bg-gray-800/50 text-xs text-gray-400 font-mono">{language}</div>
    <pre className="p-4 text-xs whitespace-pre-wrap font-mono">
      <code className="text-red-400">- {original}</code>
      <br />
      <code className="text-green-400">+ {modified}</code>
    </pre>
  </div>
);

const SuggestionItem = ({ suggestion, onSelect, isSelected }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    onClick={onSelect}
    className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${isSelected ? 'bg-indigo-600/20 border-indigo-500' : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50'}`}
  >
    <div className="flex justify-between items-start">
      <div>
        <p className="font-semibold text-white flex items-center"><FiFile className="mr-2" />{suggestion.file}</p>
        <p className="text-sm text-gray-300 mt-1">{suggestion.description}</p>
      </div>
      <div className={`text-xs px-2 py-1 rounded-full ${suggestion.severity === 'High' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
        {suggestion.severity}
      </div>
    </div>
  </motion.div>
);

function ScanDetailPage() {
  const params = useParams();
  const scanId = params?.scanId || params?.id || '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState('Initializing...');
  const [liveData, setLiveData] = useState({});
  const [isGeneratingPR, setIsGeneratingPR] = useState(false);
  const [isRepoAccessible, setIsRepoAccessible] = useState(true);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const analyticsSectionRef = useRef(null);

  // Socket setup (proxied by Vite to backend)
  const socket = useSocket('/');

  // Persist and hydrate logs for resilience across reloads
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`scanLogs:${scanId}`);
      if (saved) {
        const logs = JSON.parse(saved);
        if (Array.isArray(logs) && logs.length) {
          setLiveData(prev => ({ ...prev, logs }));
        }
      }
    } catch {}
  }, [scanId]);

  useEffect(() => {
    try {
      if (Array.isArray(liveData?.logs)) {
        localStorage.setItem(`scanLogs:${scanId}`, JSON.stringify(liveData.logs));
      }
    } catch {}
  }, [liveData?.logs, scanId]);

  // Live events from backend
  useEffect(() => {
    if (!socket) return;

    const handleProgress = (data) => {
      if (data.id === scanId) {
        queryClient.setQueryData(['scanStatus', scanId], (old) => ({ ...old, ...data }));
        setCurrentStep(data.step || 'Processing...');
        setLiveData(prev => ({
          ...prev,
          status: data.status,
          progress: data.progress,
          step: data.step,
          logs: data.message ? [ ...(prev.logs || []), data.message ] : (prev.logs || []),
        }));
      }
    };

    const handleDone = (data) => {
      if (data.id === scanId) {
        queryClient.invalidateQueries({ queryKey: ['scanStatus', scanId] });
        queryClient.invalidateQueries({ queryKey: ['scanResult', scanId] });
        toast.success('Scan completed successfully!');
        // Merge the job result shape at top-level so charts can consume immediately
        const result = data && data.result ? data.result : {};
        setLiveData(prev => ({
          ...prev,
          id: data.id,
          status: 'done',
          ...(result || {}),
        }));
      }
    };

    const handleFailed = (data) => {
      if (data.id === scanId) {
        queryClient.invalidateQueries({ queryKey: ['scanStatus', scanId] });
        toast.error('Scan failed');
      }
    };

    socket.on('scan_progress', handleProgress);
    socket.on('scan_done', handleDone);
    socket.on('scan_failed', handleFailed);

    return () => {
      socket.off('scan_progress', handleProgress);
      socket.off('scan_done', handleDone);
      socket.off('scan_failed', handleFailed);
      setLiveData({});
    };
  }, [socket, scanId, queryClient]);

  // Status polling
  const { data: statusData, isLoading: statusLoading, error: statusError } = useQuery({
    queryKey: ['scanStatus', scanId],
    queryFn: ({ signal }) => apiClient.get(`/scans/${scanId}/status`, { signal }).then(r => r.data),
    enabled: !!scanId,
    retry: 1,
    onError: (err) => {
      if (err?.response?.status === 404) {
        toast.error('Scan not found. It may have been deleted or never existed.');
      }
    }
  });

  const isScanComplete = statusData?.status === 'done' || statusData?.status === 'completed';
  const isScanFailed = statusData?.status === 'failed';
  const statusBadge = (() => {
    const s = statusData?.status || liveData?.status;
    if (s === 'failed') return { text: 'Failed', cls: 'bg-red-500/20 text-red-300' };
    if (s === 'done' || s === 'completed') return { text: 'Completed', cls: 'bg-green-500/20 text-green-300' };
    return { text: 'In Progress', cls: 'bg-indigo-500/20 text-indigo-300' };
  })();

  // Result fetch (gated on completion)
  const { data: scanData, isLoading: resultLoading, error: resultError } = useQuery({
    queryKey: ['scanResult', scanId],
    queryFn: ({ signal }) => apiClient.get(`/scans/${scanId}`, { signal }).then(r => r.data),
    enabled: !!scanId && isScanComplete,
    staleTime: Infinity,
    onSuccess: (data) => {
      if (data && data.repoUrl) {
        fetch(data.repoUrl).then(res => { if (!res.ok) setIsRepoAccessible(false); }).catch(() => setIsRepoAccessible(false));
      }
    }
  });

  // Fetch AI suggestions independently (polls until available; safe to run alongside)
  const { data: suggestionsData, isFetching: suggestionsLoading, isError: suggestionsError, error: suggestionsErr } = useQuery({
    queryKey: ['scanSuggestions', scanId],
    queryFn: async () => {
      const res = await poll(() => apiClient.get(`/scans/${scanId}/suggestions`), { interval: 2000, timeout: 60000 });
      return res?.data;
    },
    enabled: !!scanId && !isScanFailed,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 0,
    onSuccess: (data) => {
      if (data && data.aiSuggestions) {
        setLiveData(prev => ({ ...prev, aiSuggestions: data.aiSuggestions }));
      }
    },
    onError: (err) => {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('timeout')) {
        toast.error('AI suggestions fetching timed out');
      } else {
        toast.error(err?.message || 'Failed to fetch AI suggestions');
      }
    }
  });

  // Prefer fetched scanData; otherwise use live socket result (flattened above)
  const displayData = useMemo(() => {
    if (scanData) return scanData;
    if (liveData && liveData.result) return liveData.result;
    return liveData || {};
  }, [scanData, liveData]);
  const analytics = useMemo(() => computeAnalytics(displayData), [displayData]);
  const compat = useMemo(() => computeCompatibility(displayData), [displayData]);

  const hasLiveResults = liveData && liveData.id === scanId && Object.keys(liveData).length > 0;

  // Loading screen
  if (statusLoading || (resultLoading && !isScanComplete && !hasLiveResults)) {
    return <LoadingSpinner text={currentStep} />;
  }

  // Error screen
  if (resultError || isScanFailed) {
    const notFound = (resultError?.status === 404) || (resultError?.response?.status === 404);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-white bg-gray-900">
        <FiAlertTriangle className="text-4xl text-yellow-400" />
        <p className="mt-4 text-lg">{notFound ? 'Scan not found' : (isScanFailed ? 'Scan Failed' : 'Error Loading Scan')}</p>
        <p className="text-sm text-gray-300 text-center max-w-xl">
          {notFound
            ? `We couldn’t find a scan with id ${scanId}. It may have expired or never existed.`
            : (resultError?.message || statusData?.message || 'Unexpected error while loading scan results.')}
        </p>
        <div className="mt-4 flex gap-3">
          <a href="/" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">Go to Home</a>
          <a href="/scan" className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">Start a New Scan</a>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen w-full px-4 py-8 bg-gray-900 text-white">
      <ToastContainer />
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">Scan Results</h1>
          <p className="text-gray-400 font-mono">Scan ID: {scanId}</p>
        </div>

        {/* Live progress bar */}
        <ProgressBar
          progress={typeof (statusData?.progress ?? liveData?.progress) === 'number' ? (statusData?.progress ?? liveData?.progress) : 0}
          label={currentStep || liveData?.step || 'Processing...'}
          statusBadge={statusBadge}
        />

        {!isRepoAccessible && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline"> The repository at the specified URL is not accessible.</span>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Suggestions" value={(() => { const ai = mergeSection(displayData, 'aiSuggestions') || {}; return Array.isArray(ai.items) ? ai.items.length : (displayData?.suggestions || []).length; })()} icon={<FiCode />} />
          <StatCard title="Supported" value={analytics.counts.supported} icon={<FiCheckCircle />} />
          <StatCard title="Partial" value={analytics.counts.partial} icon={<FiAlertTriangle />} />
          <StatCard title="Unsupported" value={analytics.counts.unsupported} icon={<FiXCircle />} />
        </div>

        {/* Charts */}
        <div ref={analyticsSectionRef} className="mb-8">
          <AnalyticsStatistics counts={analytics.counts} />
          <div className="mt-6"><AnalyticsChart analytics={analytics} /></div>
          <div className="mt-6"><CompatibilityStackedBar analytics={analytics} /></div>
        </div>

        {/* Suggestions + Diff */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 flex flex-col gap-4 h-[70vh] overflow-y-auto pr-2">
            <AnimatePresence>
              {(displayData?.suggestions || []).map(s => (
                <SuggestionItem
                  key={s.id}
                  suggestion={s}
                  onSelect={() => setSelectedSuggestion(s)}
                  isSelected={selectedSuggestion?.id === s.id}
                />
              ))}
            </AnimatePresence>
          </div>

          <div className="lg:col-span-2">
            <div className="sticky top-8">
              <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl border border-gray-700/50 shadow-lg">
                <div className="p-6">
                  <h2 className="text-xl font-bold text-white mb-4">Code Difference</h2>
                  {selectedSuggestion ? (
                    <DiffViewer
                      original={selectedSuggestion.original}
                      modified={selectedSuggestion.modified}
                      language={selectedSuggestion.file.endsWith('.css') ? 'css' : 'javascript'}
                    />
                  ) : (
                    <div className="text-center py-12 text-gray-400">Select a suggestion to see the diff.</div>
                  )}
                </div>
                <div className="border-t border-gray-700/50 px-6 py-4 flex justify-end gap-4">
                  <button
                    onClick={() => {
                      try {
                        const diffs = selectedSuggestion ? [selectedSuggestion] : (displayData?.suggestions || []);
                        const content = buildUnifiedDiff(diffs);
                        downloadBlob(`patch-${scanId}.diff`, content, 'text/x-diff');
                        toast.success('Patch downloaded');
                      } catch (e) {
                        toast.error('Failed to build patch');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors"
                  >
                    <FiDownload /> Download Patch
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        setIsGeneratingPR(true);
                        const diffs = selectedSuggestion ? [selectedSuggestion] : (displayData?.suggestions || []);
                        const patch = buildUnifiedDiff(diffs);
                        const title = `Baseline Modernization - Scan ${scanId}`;
                        const description = `Automated PR generated from baseline scan.\n\nCounts: supported=${analytics.counts.supported}, partial=${analytics.counts.partial}, unsupported=${analytics.counts.unsupported}.`;
                        const res = await apiClient.post(`/github/pr`, { scanId, title, description, patch });
                        const prUrl = res.data?.prUrl;
                        if (prUrl) {
                          toast.success('Pull Request created');
                          window.open(prUrl, '_blank');
                        } else {
                          toast.info(res.data?.message || 'PR created (stub)');
                        }
                      } catch (err) {
                        toast.error(err?.response?.data?.error || err?.message || 'Failed to create PR');
                      } finally {
                        setIsGeneratingPR(false);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-lg hover:bg-indigo-700 transition-colors"
                  ><FiGithub /> {isGeneratingPR ? 'Creating…' : 'Create Pull Request'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed sections (merge live + result) */}
        {(() => {
          const repoOverviewData = { ...(displayData?.repoDetails || {}), ...(getRepoOverview && {}) };
          return <RepositoryOverview data={repoOverviewData} />;
        })()}
        <EnvironmentAndVersioning data={mergeSection(displayData, 'environment')} />
        {(() => {
          const env = mergeSection(displayData, 'environment') || {};
          const hints = env && env.routerHints ? env.routerHints : null;
          return hints ? <RouterHintsPanel hints={hints} /> : null;
        })()}
        <FeatureDetection data={mergeSection(displayData, 'projectFeatures')} />
        <ArchitectureAnalysis data={mergeSection(displayData, 'architecture')} />
        <CompatibilityReport data={{
          ...mergeSection(displayData, 'compatibility'),
          supportedFeatures: compat.supportedFeatures,
          unsupportedCode: compat.unsupportedCode,
          missingConfigs: compat.missingConfigs,
          recommendations: compat.recommendations,
        }} />
        {(() => {
          const sec = mergeSection(displayData, 'securityAndPerformance') || {};
          const hasInsights = [
            ...(sec.insecureApiCalls || []),
            ...(sec.missingPolicies || []),
            ...(sec.inefficientCode || []),
            ...(sec.largeAssets || []),
            ...(sec.bottlenecks || []),
          ].length > 0;
          return hasInsights ? <SecurityAndPerformance data={sec} /> : null;
        })()}
        {(() => {
          const sec = mergeSection(displayData, 'securityAndPerformance') || {};
          const vulns = Array.isArray(sec.securityVulnerabilities) ? sec.securityVulnerabilities : [];
          return vulns.length > 0 ? <VulnerabilityList data={{ securityAndPerformance: sec }} /> : null;
        })()}
        {(() => {
          const sec = securityAndPerformance;
          const recs = compat?.recommendations || [];
          const hasHygiene = (sec.missingPolicies?.length || 0) + (sec.insecureApiCalls?.length || 0) + (recs.length || 0) > 0;
          return hasHygiene ? (
            <SecurityHygiene data={sec} recommendations={recs} scanId={scanId} />
          ) : null;
        })()}
        {(() => {
          const healthData = { ...(mergeSection(displayData, 'healthAndMaintenance') || {}) };
          const hasMetrics = Object.values(healthData || {}).some(v => (typeof v === 'number' && v > 0) || (typeof v === 'string' && v && v !== 'N/A'));
          return hasMetrics ? <HealthAndMaintenance data={healthData} /> : null;
        })()}
        {(() => {
          const ai = mergeSection(displayData, 'aiSuggestions');
          const items = (ai && Array.isArray(ai.items)) ? ai.items : [];
          if (!items.length && suggestionsLoading) {
            return <div className="mt-4 text-sm text-gray-300 flex items-center"><FiLoader className="mr-2 animate-spin" />Fetching AI suggestions…</div>;
          }
          return items.length > 0 ? <AiSuggestions data={ai} /> : null;
        })()}
        <SummaryLog data={{ ...(mergeSection(displayData, 'summaryLog') || {}), errorLogs: displayData?.logs || [] }} />

        {/* Export options */}
        <ExportOptions
          onDownloadReport={async () => {
            try {
              const res = await apiClient.get('/report/download', { params: { scanId }, responseType: 'blob' });
              const blob = res.data;
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `scan-${scanId}-report.json`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              window.URL.revokeObjectURL(url);
              toast.success('Report downloaded');
            } catch (e) {
              toast.error('Failed to download report');
            }
          }}
          onGeneratePR={async () => {
            try {
              setIsGeneratingPR(true);
              const diffs = selectedSuggestion ? [selectedSuggestion] : (displayData?.suggestions || []);
              const patch = buildUnifiedDiff(diffs);
              const title = `Baseline Modernization - Scan ${scanId}`;
              const description = `Automated PR generated from baseline scan.\n\nCounts: supported=${analytics.counts.supported}, partial=${analytics.counts.partial}, unsupported=${analytics.counts.unsupported}.`;
              const res = await apiClient.post(`/github/pr`, { scanId, title, description, patch });
              const prUrl = res.data?.prUrl;
              if (prUrl) {
                toast.success('Pull Request created');
                window.open(prUrl, '_blank');
              } else {
                toast.info(res.data?.message || 'PR created (stub)');
              }
            } catch (err) {
              toast.error(err?.response?.data?.error || err?.message || 'Failed to create PR');
            } finally {
              setIsGeneratingPR(false);
            }
          }}
          isGeneratingPR={isGeneratingPR}
        />
      </div>
    </motion.div>
  );
}

export default ScanDetailPage;