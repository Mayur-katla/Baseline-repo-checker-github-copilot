import React, { useEffect } from 'react';
import { useQuery, useIsFetching, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FiCode, FiGitMerge, FiZap, FiChevronRight } from 'react-icons/fi';
import client from '../api/client';
import { showToast } from '../hooks/useToast.jsx';
import { logError } from '../utils/logger.js';
import HistoryList from '../components/home/HistoryList.jsx';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket.js';

const FeatureCard = ({ icon, title, description, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-700/50 shadow-lg hover:shadow-2xl transition-all duration-300 h-full"
  >
    <div className="text-4xl text-indigo-400 mb-4">{icon}</div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-gray-300">{description}</p>
  </motion.div>
);

function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isFetching = useIsFetching();
  const queryClient = useQueryClient();

  const socket = useSocket(import.meta.env?.VITE_BACKEND_URL);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => console.log('Socket connected');
    const onProgress = (data) => {
      queryClient.setQueryData(['scans'], (oldData) => {
        if (!oldData) return [];
        return oldData.map(scan =>
          scan.id === data.id ? { ...scan, progress: data.progress, status: 'processing' } : scan
        );
      });
    };
    const onDone = (data) => {
      queryClient.setQueryData(['scans'], (oldData) => {
        if (!oldData) return [];
        return oldData.map(scan =>
          scan.id === data.id ? { ...scan, progress: 100, status: 'done' } : scan
        );
      });
      showToast({ message: `Scan ${data.id} completed!`, severity: 'success' });
    };
    const onFailed = (data) => {
      queryClient.setQueryData(['scans'], (oldData) => {
        if (!oldData) return [];
        return oldData.map(scan =>
          scan.id === data.id ? { ...scan, status: 'failed' } : scan
        );
      });
      showToast({ message: `Scan ${data.id} failed.`, severity: 'error' });
    };

    socket.on('connect', onConnect);
    socket.on('scan_progress', onProgress);
    socket.on('scan_done', onDone);
    socket.on('scan_failed', onFailed);

    return () => {
      socket.off('connect', onConnect);
      socket.off('scan_progress', onProgress);
      socket.off('scan_done', onDone);
      socket.off('scan_failed', onFailed);
    };
  }, [socket, queryClient]);

  const scansQuery = useQuery({
    queryKey: ['scans'],
    queryFn: async ({ signal }) => (await client.get('/scans', { signal })).data,
    retry: 2,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: location.pathname === '/',
    onError: (err) => {
      logError({
        module: 'HomePage',
        location: 'GET /scans',
        message: err?.message || 'Failed to load recent scans',
        context: {}
      }, err);
      showToast({ message: err?.message || 'Failed to load recent scans', severity: 'error' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => (await client.delete(`/scans/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries('scans');
      showToast({ message: 'Scan deleted successfully', severity: 'success' });
    },
    onError: (err) => {
      logError({
        module: 'HomePage',
        location: 'DELETE /scans/:id',
        message: err?.message || 'Failed to delete scan',
        context: {}
      }, err);
      showToast({ message: err?.message || 'Failed to delete scan', severity: 'error' });
    }
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center my-16"
        >
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
            Baseline Autopilot
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
            AI-powered toolkit to analyze and modernize your legacy web projects, effortlessly.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/scan')}
            className="mt-8 px-8 py-4 bg-indigo-600 text-white font-bold rounded-full shadow-lg hover:bg-indigo-700 transition-all duration-300 flex items-center mx-auto"
          >
            Start New Scan <FiChevronRight className="ml-2" />
          </motion.button>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 my-24">
          <FeatureCard 
            icon={<FiCode />} 
            title="Feature Detection"
            description="Automatically detect JavaScript and CSS features, including modern APIs, polyfills, and browser-specific code."
            delay={0.2}
          />
          <FeatureCard 
            icon={<FiGitMerge />} 
            title="Compatibility Analysis"
            description="Map detected features to browser compatibility data and identify modernization opportunities."
            delay={0.4}
          />
          <FeatureCard 
            icon={<FiZap />} 
            title="Modernization Suggestions"
            description="Get actionable suggestions to update legacy APIs, remove unnecessary polyfills, and add fallbacks."
            delay={0.6}
          />
        </div>

        <div className="mt-24">
          <h2 className="text-4xl font-bold text-center mb-12">Recent Scans</h2>
          {scansQuery.isLoading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-500"></div>
            </div>
          ) : scansQuery.error ? (
            <p className="text-center text-red-400">{scansQuery.error?.message || 'Failed to load recent scans.'}</p>
          ) : (
            <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700/50">
              <HistoryList 
                scans={scansQuery.data || []} 
                onViewDetails={(id) => navigate(`/scan/${id}`)} 
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HomePage;