import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiGithub, FiFolder, FiLink, FiArchive, FiChrome, FiFrown, FiMoreHorizontal, FiCheck } from 'react-icons/fi';

const browserOptions = [
  { id: 'chrome', label: 'Chrome', icon: <FiChrome className="w-5 h-5" /> },
  { id: 'firefox', label: 'Firefox', icon: <FiFrown className="w-5 h-5" /> },
  { id: 'safari', label: 'Safari', icon: <FiMoreHorizontal className="w-5 h-5" /> },
  { id: 'edge', label: 'Edge', icon: <FiMoreHorizontal className="w-5 h-5" /> },
  { id: 'ie', label: 'IE11', icon: <FiMoreHorizontal className="w-5 h-5" /> },
];

const RepoInputForm = ({ onSubmit, loading, error }) => {
  const [inputType, setInputType] = useState('github');
  const [repoUrl, setRepoUrl] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [zipBase64, setZipBase64] = useState('');
  const [targetBrowsers, setTargetBrowsers] = useState(['chrome', 'firefox', 'safari', 'edge']);
  // Advanced options
  const [branch, setBranch] = useState('');
  const [excludeText, setExcludeText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = {
      inputType,
      repoUrl: inputType === 'github' || inputType === 'url' ? repoUrl : '',
      localPath: inputType === 'local' ? localPath : '',
      zipBuffer: inputType === 'zip' ? zipBase64 : '',
      targetBrowsers,
    };

    // Attach advanced options if provided
    const trimmedBranch = (branch || '').trim();
    if (trimmedBranch) formData.branch = trimmedBranch;
    const excludePaths = (excludeText || '')
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (excludePaths.length > 0) formData.excludePaths = excludePaths;

    if (inputType === 'local' && !localPath) return;
    if (inputType === 'zip' && !zipBase64) return;
    onSubmit(formData);
  };

  const handleBrowserToggle = (browser) => {
    setTargetBrowsers(prev => 
      prev.includes(browser) 
        ? prev.filter(b => b !== browser)
        : [...prev, browser]
    );
  };

  const handleZipFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) { setZipBase64(''); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === 'string') {
        const base64 = dataUrl.split(',')[1] || '';
        setZipBase64(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl p-8 border border-gray-700/50 shadow-2xl">
      <h2 className="text-3xl font-bold text-white mb-8">Configure Your Scan</h2>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/20 text-red-200 p-4 rounded-lg mb-6 border border-red-500/50"
        >
          {error}
        </motion.div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-400 mb-3">Repository Source</label>
          <div className="grid grid-cols-4 gap-2 rounded-lg bg-gray-900/50 p-1">
            <button type="button" onClick={() => setInputType('github')} className={`relative px-4 py-2 text-sm font-semibold rounded-md transition-colors ${inputType === 'github' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700/50'}`}><FiGithub className="inline mr-2"/>GitHub</button>
            <button type="button" onClick={() => setInputType('local')} className={`relative px-4 py-2 text-sm font-semibold rounded-md transition-colors ${inputType === 'local' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700/50'}`}><FiFolder className="inline mr-2"/>Local</button>
            <button type="button" onClick={() => setInputType('url')} className={`relative px-4 py-2 text-sm font-semibold rounded-md transition-colors ${inputType === 'url' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700/50'}`}><FiLink className="inline mr-2"/>Git URL</button>
            <button type="button" onClick={() => setInputType('zip')} className={`relative px-4 py-2 text-sm font-semibold rounded-md transition-colors ${inputType === 'zip' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700/50'}`}><FiArchive className="inline mr-2"/>ZIP Upload</button>
          </div>
        </div>

        <div className="mb-8 h-28">
          {inputType === 'github' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
              <FiGithub className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input id="repoUrl" type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/username/repo" disabled={loading} className="w-full bg-gray-900/50 border-2 border-gray-700/50 rounded-lg pl-12 pr-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all" />
              <p className="text-xs text-gray-500 mt-2">Enter the URL of a public GitHub repository.</p>
            </motion.div>
          )}
          {inputType === 'local' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
              <FiFolder className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input id="localPath" type="text" value={localPath} onChange={(e) => setLocalPath(e.target.value)} placeholder="C:\\path\\to\\your\\project" required disabled={loading} className="w-full bg-gray-900/50 border-2 border-gray-700/50 rounded-lg pl-12 pr-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all" />
              <p className="text-xs text-gray-500 mt-2">Enter the absolute path to your local project directory.</p>
            </motion.div>
          )}
          {inputType === 'url' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
              <FiLink className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input id="gitUrl" type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://gitlab.com/username/repo.git" disabled={loading} className="w-full bg-gray-900/50 border-2 border-gray-700/50 rounded-lg pl-12 pr-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all" />
              <p className="text-xs text-gray-500 mt-2">Enter any Git repository URL (GitLab, Bitbucket, etc.).</p>
            </motion.div>
          )}
          {inputType === 'zip' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
              <FiArchive className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input id="zipFile" type="file" accept=".zip" onChange={handleZipFileChange} disabled={loading} className="w-full bg-gray-900/50 border-2 border-gray-700/50 rounded-lg pl-12 pr-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all" />
              <p className="text-xs text-gray-500 mt-2">Upload a ZIP archive of your project. We only perform static analysis.</p>
            </motion.div>
          )}
        </div>

        <div className="mb-10">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Target Browsers</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {browserOptions.map((browser) => {
              const isSelected = targetBrowsers.includes(browser.id);
              return (
                <motion.button
                  type="button"
                  key={browser.id}
                  onClick={() => handleBrowserToggle(browser.id)}
                  className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-lg transition-all duration-200 border-2 ${isSelected ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-gray-900/50 border-gray-700/50 text-gray-400 hover:border-gray-500'}`}
                  aria-pressed={isSelected}
                  whileTap={{ scale: 0.95 }}
                >
                  {isSelected && <FiCheck className="absolute top-2 right-2 w-4 h-4 text-indigo-400" />}
                  {browser.icon}
                  <span className="text-xs font-semibold">{browser.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Advanced Options */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Advanced Options (optional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label htmlFor="branch" className="sr-only">Branch</label>
              <input
                id="branch"
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="Branch (e.g., main, develop)"
                disabled={loading}
                className="w-full bg-gray-900/50 border-2 border-gray-700/50 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
              />
              <p className="text-xs text-gray-500 mt-2">Specify a branch to scan. Leave blank to use default.</p>
            </div>
            <div className="relative">
              <label htmlFor="excludePaths" className="sr-only">Exclude Paths</label>
              <textarea
                id="excludePaths"
                value={excludeText}
                onChange={(e) => setExcludeText(e.target.value)}
                placeholder={"Exclude paths (comma or newline separated)\nExamples: node_modules, dist, build"}
                rows={3}
                disabled={loading}
                className="w-full bg-gray-900/50 border-2 border-gray-700/50 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
              />
              <p className="text-xs text-gray-500 mt-2">We skip these paths during analysis.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 border-t border-gray-700/50 pt-6">
          <button type="button" onClick={() => { setRepoUrl(''); setLocalPath(''); setZipBase64(''); setBranch(''); setExcludeText(''); }} disabled={loading} className="px-6 py-2 text-sm font-semibold text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors">Reset</button>
          <motion.button 
            type="submit" 
            disabled={loading || targetBrowsers.length === 0}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-3 text-sm font-bold text-white bg-indigo-600 rounded-lg shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Scanning...' : 'Start Scan'}
          </motion.button>
        </div>
      </form>
    </div>
  );
};

export default RepoInputForm;