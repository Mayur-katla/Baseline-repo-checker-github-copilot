import React from 'react';
import { FiLoader } from 'react-icons/fi';

const LoadingSpinner = ({ text }) => (
  <div className="flex flex-col items-center justify-center min-h-screen text-white bg-gray-900">
    <FiLoader className="animate-spin text-4xl text-indigo-500" />
    <p className="mt-4 text-lg">{text}</p>
    <p className="text-sm text-gray-400">This may take a few moments.</p>
  </div>
);

export default LoadingSpinner;