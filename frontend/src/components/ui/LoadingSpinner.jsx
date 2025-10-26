import React from 'react';
import { FiLoader } from 'react-icons/fi';

const LoadingSpinner = ({ text }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-white">
    <FiLoader className="animate-spin text-4xl text-indigo-500" />
    <p className="mt-4 text-lg">{text}</p>
    <p className="text-sm text-gray-500 dark:text-gray-400">This may take a few moments.</p>
  </div>
);

export default LoadingSpinner;