import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLoader, FiAlertTriangle, FiFile, FiCode, FiCheckCircle, FiXCircle, FiDownload, FiGithub } from 'react-icons/fi';
import apiClient, { poll } from '../api/client.js';
import { useSocket } from '../hooks/useSocket.js';
import ProgressBar from '../components/common/ProgressBar.jsx';
import SegmentedProgress from '../components/common/SegmentedProgress.jsx';
import AnalyticsStatistics from '../components/scan-details/AnalyticsStatistics.jsx';
import RepositoryOverview from '../components/scan-details/RepositoryOverview.jsx';
import EnvironmentAndVersioning from '../components/scan-details/EnvironmentAndVersioning.jsx';
import FeatureDetection from '../components/scan-details/FeatureDetection.jsx';
import ArchitectureAnalysis from '../components/scan-details/ArchitectureAnalysis.jsx';
import CompatibilityReport from '../components/scan-details/CompatibilityReport.jsx';
import HealthAndMaintenance from '../components/scan-details/HealthAndMaintenance.jsx';
import AiSuggestions from '../components/scan-details/AiSuggestions.jsx';
import SummaryLog from '../components/scan-details/SummaryLog.jsx';
import ExportOptions from '../components/scan-details/ExportOptions.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';
import { computeCompatibility, computeAnalytics, mergeSection } from '../utils/aggregators.js';
import { buildUnifiedDiff, downloadBlob, buildMarkdownReport } from '../utils/report.js';
import { getRepoOverview, getRepoStats } from '../api/github.js';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import RouterHintsPanel from '../components/router/RouterHintsPanel.jsx'
import SecurityHygiene from '../components/scan-details/SecurityHygiene.jsx';
import AiSummary from '../components/scan-details/AiSummary.jsx';
import ImpactHeatmap from '../components/scan-details/ImpactHeatmap.jsx';
import BadgeGenerator from '../components/scan-details/BadgeGenerator.jsx';
import VulnerabilitySummary from '../components/scan-details/VulnerabilitySummary.jsx'
import ImpactByBaseline from '../components/scan-details/ImpactByBaseline.jsx'
import FilterNotice from '../components/scan-details/FilterNotice.jsx';
import { countFilteredSections, shouldShowAnalytics, shouldShowCompatibility } from '../utils/visibility.js';

const AnalyticsChart = lazy(() => import('../components/scan-details/AnalyticsChart.jsx'));
const CompatibilityStackedBar = lazy(() => import('../components/scan-details/CompatibilityStackedBar.jsx'));
const ArchitectureFileTree = lazy(() => import('../components/scan-details/ArchitectureFileTree.jsx'));
const SecurityTabs = lazy(() => import('../components/scan-details/SecurityTabs.jsx'));
const VulnerabilityList = lazy(() => import('../components/scan-details/VulnerabilityList.jsx'));


const StatCard = ({ title, value, icon }) => (
  <div className="bg-gray-800/50 backdrop-blur-md rounded-xl p-4 flex items-center border border-gray-700/50 transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg hover:border-indigo-500/50">
    <div className="mr-4 text-indigo-400">{icon}</div>
    <div>
      <div className="text-sm text-gray-400">{title}</div>
      <div className="text-xl font-semibold text-white">{value}</div>
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
    queryFn: ({ signal }) => apiClient.get(`/scans/${scanId}/result`, { signal }).then(r => r.data),
    enabled: !!scanId && (isScanComplete || liveData?.status === 'done' || !!liveData?.result),
    staleTime: Infinity,
    onSuccess: (data) => {
      if ((data?.result || data)?.repoUrl) {
        const repoUrl = (data?.result || data).repoUrl;
        fetch(repoUrl).then(res => { if (!res.ok) setIsRepoAccessible(false); }).catch(() => setIsRepoAccessible(false));
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
    if (scanData) {
      return scanData.result ? scanData.result : scanData;
    }
    if (liveData && liveData.result) return liveData.result;
    return liveData || {};
  }, [scanData, liveData]);
  const analytics = useMemo(() => computeAnalytics(displayData), [displayData]);
  const compat = useMemo(() => computeCompatibility(displayData), [displayData]);

  const hasLiveResults = liveData && liveData.id === scanId && Object.keys(liveData).length > 0;

  // Loading is handled inline via ProgressBar; render header immediately for UX and tests

  // Inline error flag (do not early-return; keep header visible)
  const showErrorBanner = resultError || isScanFailed;
  const notFound = (resultError?.status === 404) || (resultError?.response?.status === 404);
  // Removed early error-screen return; header and inline banner render in main return
    /* Removed early error-screen return; banner renders inline in main body */

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen w-full px-4 py-8 bg-gray-900 text-white">
      <ToastContainer />
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">Scan Results</h1>
          <p className="text-gray-400 font-mono">Scan ID: {scanId}</p>
          {(() => {
            const repo = displayData?.repoDetails || {};
            const ownerRepo = [repo.owner, repo.repoName].filter(Boolean).join('/');
            const branch = scanData?.branch || statusData?.branch || displayData?.branch;
            const createdAt = statusData?.createdAt || scanData?.createdAt;
            const completedAt = statusData?.completedAt || scanData?.completedAt || (isScanComplete ? new Date().toISOString() : null);
            const durationText = createdAt && completedAt ? (() => { const d = (new Date(completedAt) - new Date(createdAt)) / 1000; const mins = Math.floor(d/60); const secs = Math.floor(d%60); return `${mins}m ${secs}s`; })() : null;
            return (
              <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-4">
                {ownerRepo && <span>Repo: <span className="font-mono text-white/90">{ownerRepo}</span></span>}
                {branch && <span>Branch: <span className="font-mono text-white/90">{branch}</span></span>}
                {createdAt && <span>Started: <span className="font-mono">{new Date(createdAt).toLocaleString()}</span></span>}
                {completedAt && <span>Completed: <span className="font-mono">{new Date(completedAt).toLocaleString()}</span></span>}
                {durationText && <span>Duration: <span className="font-mono">{durationText}</span></span>}
              </div>
            );
          })()}
        </div>

        {showErrorBanner && (
          <div className="mb-6 bg-red-500/20 text-red-200 p-4 rounded-lg border border-red-500/50">
            <p className="font-semibold">{notFound ? 'Scan not found' : (isScanFailed ? 'Scan Failed' : 'Error Loading Scan')}</p>
            <p className="text-sm text-red-100">
              {notFound
                ? `We couldn’t find a scan with id ${scanId}. It may have expired or never existed.`
                : (resultError?.message || statusData?.message || 'Unexpected error while loading scan results.')}
            </p>
          </div>
        )}

        {isScanComplete && !isScanFailed && (
          <div className="mb-6 bg-green-500/20 text-green-200 p-4 rounded-lg border border-green-500/50 flex items-center justify-between">
            <div>
              <p className="font-semibold">Scan Completed</p>
              <p className="text-sm">Your baseline analysis finished successfully.</p>
            </div>
            <button
              onClick={() => analyticsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow hover:bg-indigo-700 transition-colors"
            >
              View Highlights
            </button>
          </div>
        )}

        {/* Segmented pipeline */}
        <SegmentedProgress
          currentStep={currentStep || liveData?.step}
          progress={typeof (statusData?.progress ?? liveData?.progress) === 'number' ? (statusData?.progress ?? liveData?.progress) : 0}
          isComplete={isScanComplete && !isScanFailed}
        />

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
        {/* AI Summary */}
        {(() => {
          const ai = mergeSection(displayData, 'aiSuggestions') || {};
          const sec = mergeSection(displayData, 'securityAndPerformance') || {};
          return <div className="mb-8"><AiSummary ai={ai} analytics={analytics} securityData={sec} compat={compat} /></div>;
        })()}
        {/* Impact Heatmap */}
        {(() => {
          const ai = mergeSection(displayData, 'aiSuggestions') || {};
          return <div className="mb-8"><ImpactHeatmap ai={ai} /></div>;
        })()}
        {/* Impact by Baseline */}
        {(() => {
          return <ImpactByBaseline scanId={scanId} />;
        })()}

        {/* Charts */}
        <div ref={analyticsSectionRef} className="mb-8">
          {(() => {
            const hidden = (!shouldShowAnalytics(analytics) ? 1 : 0) + (!shouldShowCompatibility(compat) ? 1 : 0);
            return <FilterNotice hiddenCount={hidden} />;
          })()}
          <AnalyticsStatistics counts={analytics.counts} />
          <div className="mt-6">
            <Suspense fallback={<LoadingSpinner />}>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
                <AnalyticsChart analytics={analytics} />
              </motion.div>
            </Suspense>
          </div>
          <div className="mt-6">
            <Suspense fallback={<LoadingSpinner />}>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
                <CompatibilityStackedBar analytics={analytics} />
              </motion.div>
            </Suspense>
          </div>
        </div>

        {/* Suggestions + Diff */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <VirtualizedSuggestionList
            suggestions={(displayData?.suggestions || [])}
            selectedSuggestion={selectedSuggestion}
            onSelect={setSelectedSuggestion}
          />
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
                        if (!Array.isArray(diffs) || diffs.length === 0) {
                          toast.error('No suggestions available to create a PR');
                          setIsGeneratingPR(false);
                          return;
                        }
                        const patch = buildUnifiedDiff(diffs);
                        if (!patch || patch.trim().length < 40) {
                          toast.error('Patch is empty; nothing to commit');
                          setIsGeneratingPR(false);
                          return;
                        }
                        const settingsRaw = typeof window !== 'undefined' ? localStorage.getItem('baseline-settings') : null;
                        const token = settingsRaw ? (() => { try { return JSON.parse(settingsRaw)?.githubToken; } catch { return null; } })() : null;
                        if (!token && !(import.meta?.env?.VITE_GITHUB_TOKEN)) {
                          toast.error('Add a GitHub token in Settings to create a PR');
                          setIsGeneratingPR(false);
                          return;
                        }
                        const title = `Baseline Modernization - Scan ${scanId}`;
                        const description = `Automated PR generated from baseline scan.\n\nCounts: supported=${analytics.counts.supported}, partial=${analytics.counts.partial}, unsupported=${analytics.counts.unsupported}.`;
                        const res = await apiClient.post(`/scans/${scanId}/pull-request`, { title, description, patch });
                        const { prUrl, mode, message, tokenDetected } = res.data || {};
                        if (prUrl) {
                          toast.success('Pull Request created');
                          window.open(prUrl, '_blank');
                        } else {
                          const msg = String(message || '').toLowerCase();
                          if (mode === 'stub' || msg.includes('stub') || msg.includes('demo mode')) {
                            toast.info('Demo mode: PR created locally. No remote changes.');
                            if (!tokenDetected) {
                              toast.info('Add a GitHub token in Settings to enable real PRs.');
                            }
                          } else {
                            toast.info(message || 'PR created');
                          }
                        }
                      } catch (err) {
                        const status = err?.status || err?.response?.status;
                        let message = err?.response?.data?.error || err?.message || 'Failed to create PR';
                        if (status === 401) message = 'GitHub authentication failed: check token in Settings.';
                        else if (status === 403) message = 'Permission denied: token lacks repo write access.';
                        else if (status === 404) message = 'Repository or branch not found; verify scan repo URL.';
                        toast.error(message);
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
        // Wrap ArchitectureFileTree in Suspense for lazy-load
        <Suspense fallback={<LoadingSpinner />}>
          <ArchitectureFileTree data={mergeSection(displayData, 'architecture')} />
        </Suspense>
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
          return hasInsights ? null : null;
        })()}
        {(() => {
          const sec = mergeSection(displayData, 'securityAndPerformance') || {};
          const vulns = Array.isArray(sec.securityVulnerabilities) ? sec.securityVulnerabilities : [];
          // Wrap VulnerabilityList ternary result in Suspense
          return (
            <>
              <VulnerabilitySummary data={sec} />
              {vulns.length > 0 ? (
                <Suspense fallback={<LoadingSpinner />}>
                  <VulnerabilityList data={{ securityAndPerformance: sec }} />
                </Suspense>
              ) : null}
            </>
          );
        })()}
        {(() => {
          const sec = mergeSection(displayData, 'securityAndPerformance') || {};
          const recs = compat?.recommendations || [];
          const hasHygiene = (sec.missingPolicies?.length || 0) + (sec.insecureApiCalls?.length || 0) + (recs.length || 0) > 0;
          return hasHygiene ? (
            <Suspense fallback={<LoadingSpinner />}>
              <SecurityTabs securityData={sec} recommendations={recs} scanId={scanId} />
            </Suspense>
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
              if (!Array.isArray(diffs) || diffs.length === 0) {
                toast.error('No suggestions available to create a PR');
                setIsGeneratingPR(false);
                return;
              }
              const patch = buildUnifiedDiff(diffs);
              if (!patch || patch.trim().length < 40) {
                toast.error('Patch is empty; nothing to commit');
                setIsGeneratingPR(false);
                return;
              }
              const settingsRaw = typeof window !== 'undefined' ? localStorage.getItem('baseline-settings') : null;
              const token = settingsRaw ? (() => { try { return JSON.parse(settingsRaw)?.githubToken; } catch { return null; } })() : null;
              if (!token && !(import.meta?.env?.VITE_GITHUB_TOKEN)) {
                toast.error('Missing GitHub token');
                setIsGeneratingPR(false);
                return;
              }
              const authHeaderToken = token || import.meta?.env?.VITE_GITHUB_TOKEN;
              const repo = displayData?.repoDetails || {};
              const ownerRepo = [repo.owner, repo.repoName].filter(Boolean).join('/');
              const branch = scanData?.branch || statusData?.branch || displayData?.branch || '';
              const createdAt = statusData?.createdAt || scanData?.createdAt || '';
              const completedAt = statusData?.completedAt || scanData?.completedAt || '';
              const res = await apiClient.post(`/scans/${scanId}/pull-request`, { title: `Baseline Modernization - ${ownerRepo}`, description: `Automated PR created from baseline scan.\n\nBranch: ${branch}\nStarted: ${createdAt}\nCompleted: ${completedAt}`, patch }, { headers: { Authorization: `Bearer ${authHeaderToken}` } });
              const { prUrl, mode, message, tokenDetected } = res.data || {};
              if (prUrl) {
                toast.success(`PR created: ${prUrl}`);
              } else {
                const msg = String(message || '').toLowerCase();
                if (mode === 'stub' || msg.includes('stub') || msg.includes('demo mode')) {
                  toast.info('Demo mode: PR created locally. No remote changes.');
                  if (!tokenDetected) {
                    toast.info('Add a GitHub token in Settings to enable real PRs.');
                  }
                } else {
                  toast.success('PR created');
                }
              }
            } catch (err) {
              const status = err?.response?.status;
              let message = err?.response?.data?.error || 'Failed to create PR';
              if (status === 400) message = 'Invalid PR request payload.';
              else if (status === 401) message = 'Unauthorized; invalid or missing GitHub token.';
              else if (status === 403) message = 'Insufficient permissions to create PR on repository.';
              else if (status === 404) message = 'Repository or branch not found; verify scan repo URL.';
              toast.error(message);
            } finally {
              setIsGeneratingPR(false);
            }
          }}
          onExportCSV={() => {
            try {
              const analytics = displayData?.analytics || {};
              const compat = displayData?.compatibility || {};
              const repo = displayData?.repoDetails || {};
              const ownerRepo = [repo.owner, repo.repoName].filter(Boolean).join('/');
              const status = statusData || {};
              const branch = status?.branch || displayData?.branch || '';
              const createdAt = status?.createdAt || '';
              const completedAt = status?.completedAt || (isScanComplete ? new Date().toISOString() : '');
              const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
              const lines = [];
              lines.push(['Meta','Repo', ownerRepo].map(esc).join(','));
              lines.push(['Meta','Branch', branch].map(esc).join(','));
              lines.push(['Meta','Started', createdAt].map(esc).join(','));
              lines.push(['Meta','Completed', completedAt].map(esc).join(','));
              lines.push(['Analytics','Supported', (analytics.counts?.supported || 0)].map(esc).join(','));
              lines.push(['Analytics','Partial', (analytics.counts?.partial || 0)].map(esc).join(','));
              lines.push(['Analytics','Unsupported', (analytics.counts?.unsupported || 0)].map(esc).join(','));
              lines.push(['Analytics','Suggested', (analytics.counts?.suggested || 0)].map(esc).join(','));
              (compat.supportedFeatures || []).forEach(f => lines.push(['Supported','Feature', f].map(esc).join(',')));
              (compat.partialFeatures || []).forEach(f => lines.push(['Partial','Feature', f].map(esc).join(',')));
              (compat.unsupportedCode || []).forEach(i => lines.push(['Unsupported','Item', i].map(esc).join(',')));
              (compat.missingConfigs || []).forEach(i => lines.push(['MissingConfig','File', i].map(esc).join(',')));
              (compat.recommendations || []).forEach(i => lines.push(['Recommendation','Action', i].map(esc).join(',')));
              const csv = lines.join('\n');
              downloadBlob(`scan-${scanId}-summary.csv`, csv, 'text/csv');
              toast.success('CSV exported');
            } catch (e) {
              toast.error('Failed to export CSV');
            }
          }}
          onExportPDF={() => {
            try {
              const md = buildMarkdownReport(displayData || {});
              const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>Scan Report</title></head><body><pre>${md.replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre></body></html>`;
              downloadBlob(`scan-${scanId}-report.html`, html, 'text/html');
              toast.success('Open the HTML file then print to PDF');
            } catch (e) {
              toast.error('Failed to export PDF');
            }
          }}
          onBundleZip={async () => {
            try {
              const res = await apiClient.get('/report/bundle', { params: { scanId }, responseType: 'blob' });
              const blob = res.data;
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `scan-${scanId}-bundle.zip`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              window.URL.revokeObjectURL(url);
              toast.success('Bundle ZIP downloaded');
            } catch (e) {
              toast.error('Failed to download bundle');
            }
          }}
        />
        {/* Badge generator */}
        <div className="mt-6">
          <BadgeGenerator analytics={analytics} displayData={displayData} />
        </div>
      </div>
    </motion.div>
  );
}

export default ScanDetailPage;

// Virtualized suggestions list to render only visible items for performance
function VirtualizedSuggestionList({ suggestions, selectedSuggestion, onSelect }) {
  const containerRef = useRef(null);
  const rowHeight = 72; // approx height per suggestion card
  const buffer = 5; // render extra rows above/below for smoothness
  const [scrollTop, setScrollTop] = useState(0);

  const total = suggestions.length;
  const containerHeight = 0; // will be measured via CSS (h-[70vh])

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const startIndex = Math.max(Math.floor(scrollTop / rowHeight) - buffer, 0);
  const endIndex = Math.min(startIndex + Math.ceil((containerRef.current?.clientHeight || 0) / rowHeight) + buffer * 2, total - 1);
  const items = suggestions.slice(startIndex, endIndex + 1);

  const offsetTop = startIndex * rowHeight;

  return (
    <div className="lg:col-span-1 flex flex-col gap-4 h-[70vh] overflow-y-auto pr-2 relative" ref={containerRef} role="list" aria-label="AI suggestions list">
      <div style={{ height: total * rowHeight }}>
        <div style={{ transform: `translateY(${offsetTop}px)` }}>
          {items.map(s => (
            <div key={s.id} role="listitem" className="mb-2">
              <SuggestionItem
                suggestion={s}
                isSelected={selectedSuggestion?.id === s.id}
                onSelect={() => onSelect(s)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


