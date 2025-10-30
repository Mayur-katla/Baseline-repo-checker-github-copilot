import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import RepoInputForm from '../components/home/RepoInputForm.jsx';
import apiClient from '../api/client.js';

const ScanPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (formData: any): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      console.log('Submitting scan with data:', formData);
      const response = await apiClient.post('/scans', formData);
      console.log('Scan submitted successfully:', response.data);
      const { scanId } = response.data as { scanId: string | number };
      navigate(`/scan/${scanId}`);
    } catch (err: any) {
      console.error('Error submitting scan:', err);
      const errorMessage: string = err?.response?.data?.errors?.[0]?.msg || err?.response?.data?.error || 'An unexpected error occurred.';
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen w-full px-4 py-8 bg-white text-gray-900 dark:bg-gray-900 dark:text-white"
    >
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">Start a New Scan</h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Analyze your repository to identify modernization opportunities and ensure Baseline compatibility.
          </p>
        </div>

        <RepoInputForm onSubmit={handleScan} loading={loading} error={error} />

        <div className="mt-12 bg-gray-50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 dark:border-gray-700/50">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">How It Works</h3>
          <ol className="relative border-l border-gray-200 dark:border-gray-700">
            <li className="mb-10 ml-6">
              <span className="absolute flex items-center justify-center w-6 h-6 bg-indigo-100 dark:bg-indigo-900 rounded-full -left-3 ring-8 ring-indigo-200/40 dark:ring-indigo-900/20">
                <span className="text-indigo-600 dark:text-indigo-300 font-bold">1</span>
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white">Configure Repository</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Choose your repository source (GitHub, local, or Git URL) and select target browsers.</p>
            </li>
            <li className="mb-10 ml-6">
              <span className="absolute flex items-center justify-center w-6 h-6 bg-indigo-100 dark:bg-indigo-900 rounded-full -left-3 ring-8 ring-indigo-200/40 dark:ring-indigo-900/20">
                <span className="text-indigo-600 dark:text-indigo-300 font-bold">2</span>
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white">Code Analysis</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Our engine scans your codebase, detecting JavaScript and CSS features.</p>
            </li>
            <li className="mb-10 ml-6">
              <span className="absolute flex items-center justify-center w-6 h-6 bg-indigo-100 dark:bg-indigo-900 rounded-full -left-3 ring-8 ring-indigo-200/40 dark:ring-indigo-900/20">
                <span className="text-indigo-600 dark:text-indigo-300 font-bold">3</span>
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white">Compatibility Check</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">We map detected features against Baseline data for your selected browsers.</p>
            </li>
            <li className="ml-6">
              <span className="absolute flex items-center justify-center w-6 h-6 bg-indigo-100 dark:bg-indigo-900 rounded-full -left-3 ring-8 ring-indigo-200/40 dark:ring-indigo-900/20">
                <span className="text-indigo-600 dark:text-indigo-300 font-bold">4</span>
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white">Get Results</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Receive a detailed report with actionable modernization suggestions.</p>
            </li>
          </ol>
        </div>
      </div>
    </motion.div>
  );
};

export default ScanPage;
