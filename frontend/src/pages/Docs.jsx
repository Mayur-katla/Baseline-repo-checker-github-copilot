import React from 'react';
import { motion } from 'framer-motion';

const DocsPage = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-4xl mx-auto p-4 text-white"
    >
      <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500 mb-8">Documentation</h1>
      
      <div className="bg-gray-800/50 backdrop-blur-md p-8 rounded-xl shadow-lg space-y-6 border border-gray-700/50">
        <section>
          <h2 className="text-2xl font-semibold text-indigo-400 mb-4">Introduction</h2>
          <p className="text-gray-300">
            Baseline Autopilot is an AI-powered toolkit designed to help you analyze and modernize your legacy web projects. It automatically detects outdated JavaScript and CSS, analyzes browser compatibility, and provides actionable suggestions for improvement.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-indigo-400 mb-4">How It Works</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li><span className="font-semibold text-white">Input Your Repository:</span> Provide a GitHub URL, a local path, or a generic Git URL to your project.</li>
            <li><span className="font-semibold text-white">Select Target Browsers:</span> Choose the browsers you want to ensure compatibility with.</li>
            <li><span className="font-semibold text-white">Analyze and Review:</span> The tool scans your codebase, identifies modernization opportunities, and presents them as actionable suggestions.</li>
            <li><span className="font-semibold text-white">Apply Changes:</span> Review the suggested code differences and apply them to your project by creating a pull request or downloading a patch.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-indigo-400 mb-4">Settings</h2>
          <p className="text-gray-300">
            The settings page allows you to configure the following:
          </p>
          <ul className="list-disc list-inside space-y-2 mt-2 text-gray-300">
            <li><span className="font-semibold text-white">GitHub Token:</span> Required for creating pull requests directly from the application.</li>
            <li><span className="font-semibold text-white">Target Baseline Year:</span> The target year for modernization suggestions (e.g., 2025).</li>
            <li><span className="font-semibold text-white">Feature Threshold:</span> The minimum impact level for suggestions (low, medium, high).</li>
            <li><span className="font-semibold text-white">Theme:</span> Switch between light and dark modes.</li>
          </ul>
        </section>
      </div>
    </motion.div>
  );
};

export default DocsPage;