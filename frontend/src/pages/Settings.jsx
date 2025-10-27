import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiSave, FiCheckCircle, FiAlertTriangle, FiGithub } from 'react-icons/fi';
import apiClient from '../api/client.js';

const SettingsInput = ({ label, type = 'text', value, onChange, helperText, placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-800/50 border-2 border-gray-300 dark:border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-300 shadow-sm text-gray-900 dark:text-white"
    />
    {helperText && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{helperText}</p>}
  </div>
);

function Settings() {
  const [githubToken, setGithubToken] = useState('');
  const [baselineYear, setBaselineYear] = useState('2025');
  const [featureThreshold, setFeatureThreshold] = useState('medium');
  const [message, setMessage] = useState('');
  const [tokenStatus, setTokenStatus] = useState('idle'); // idle | checking | valid | invalid
  const [tokenUser, setTokenUser] = useState(null);
  const [repoInput, setRepoInput] = useState('');
  const [preflight, setPreflight] = useState(null);
  const [preflightStatus, setPreflightStatus] = useState('idle'); // idle | checking | ready | not_ready | error

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('baseline-settings') || '{}');
    if (saved.githubToken) setGithubToken(saved.githubToken);
    if (saved.baselineYear) setBaselineYear(String(saved.baselineYear));
    if (saved.featureThreshold) setFeatureThreshold(saved.featureThreshold);
    const token = saved.githubToken || (import.meta?.env?.VITE_GITHUB_TOKEN);
    if (token) {
      validateToken();
    }
  }, []);

  const validateToken = async () => {
    try {
      setTokenStatus('checking');
      setTokenUser(null);
      const res = await apiClient.get('/github/me');
      if (res?.data?.authenticated) {
        setTokenStatus('valid');
        setTokenUser(res.data.user || null);
      } else {
        setTokenStatus('invalid');
        setTokenUser(null);
      }
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if (status === 401 || status === 403) {
        setTokenStatus('invalid');
      } else {
        setTokenStatus('invalid');
      }
      setTokenUser(null);
    }
  };

  const checkPreflight = async () => {
    if (!repoInput || repoInput.trim().length === 0) {
      setPreflight(null);
      setPreflightStatus('error');
      return;
    }
    try {
      setPreflightStatus('checking');
      setPreflight(null);
      // Accept either full URL or owner/repo; prefer sending url param to backend
      const params = { url: repoInput };
      // If input looks like owner/repo without scheme, still send as url for unified parsing
      const res = await apiClient.get('/github/pr/preflight', { params });
      const data = res?.data || {};
      setPreflight(data);
      setPreflightStatus(data.ready ? 'ready' : 'not_ready');
    } catch (err) {
      setPreflightStatus('error');
      setPreflight({ error: err?.message || 'Preflight failed' });
    }
  };

  const handleSave = () => {
    const prev = JSON.parse(localStorage.getItem('baseline-settings') || '{}');
    const newSettings = {
      githubToken,
      baselineYear: Number(baselineYear),
      featureThreshold,
      // theme is controlled via navbar toggle; do not persist here
    };
    localStorage.setItem('baseline-settings', JSON.stringify({ ...prev, ...newSettings, theme: prev.theme }));
    setMessage('Settings saved successfully!');
    setTimeout(() => setMessage(''), 3000);
    // Trigger validation after save when token present
    if (githubToken && String(githubToken).trim().length > 0) {
      validateToken();
    } else {
      setTokenStatus('idle');
      setTokenUser(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-2xl mx-auto p-4"
    >
      <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500 mb-8">Settings</h1>
      <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-md p-8 rounded-xl shadow-lg space-y-6 border border-gray-200 dark:border-gray-700/50">
        <SettingsInput
          label="GitHub Token"
          type="password"
          value={githubToken}
          onChange={(e) => setGithubToken(e.target.value)}
          placeholder="ghp_..."
          helperText="Used for creating pull requests. Stored securely in your browser."
        />
        <div className="text-sm mt-1">
          {tokenStatus === 'checking' && (
            <span className="inline-flex items-center text-indigo-400"><FiGithub className="mr-2"/>Validating token…</span>
          )}
          {tokenStatus === 'valid' && (
            <span className="inline-flex items-center text-green-400"><FiCheckCircle className="mr-2"/>Connected to GitHub as {tokenUser?.login || 'unknown'}</span>
          )}
          {tokenStatus === 'invalid' && (
            <span className="inline-flex items-center text-red-400"><FiAlertTriangle className="mr-2"/>Invalid token. PR creation is disabled.</span>
          )}
          {tokenStatus === 'idle' && (!githubToken || githubToken.length === 0) && (
            <span className="inline-flex items-center text-gray-400"><FiAlertTriangle className="mr-2"/>No token set. PR creation is disabled.</span>
          )}
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700/50">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">PR Readiness Check</h2>
          <SettingsInput
            label="Repository (URL or owner/repo)"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="e.g., https://github.com/ORG/REPO or ORG/REPO"
            helperText="Checks token scopes, repo permissions, and branch protection (if accessible)."
          />
          <div className="flex items-center justify-between mt-3">
            <motion.button
              onClick={checkPreflight}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-purple-600 text-white font-semibold shadow-lg hover:bg-purple-700 transition-all duration-300"
            >
              <FiGithub />
              Check PR Readiness
            </motion.button>
            {preflightStatus === 'checking' && (
              <span className="text-sm text-indigo-400">Checking…</span>
            )}
            {preflightStatus === 'ready' && (
              <span className="inline-flex items-center text-green-500"><FiCheckCircle className="mr-2"/>Ready</span>
            )}
            {preflightStatus === 'not_ready' && (
              <span className="inline-flex items-center text-red-500"><FiAlertTriangle className="mr-2"/>Not Ready</span>
            )}
            {preflightStatus === 'error' && (
              <span className="inline-flex items-center text-red-400"><FiAlertTriangle className="mr-2"/>Preflight error</span>
            )}
          </div>
          {preflight && (
            <div className="mt-4 text-sm text-gray-800 dark:text-gray-200">
              {preflight.error && (
                <div className="text-red-400 mb-2">Error: {preflight.error}</div>
              )}
              {!preflight.error && (
                <div className="space-y-2">
                  <div>Repo: <span className="font-mono">{preflight.owner}/{preflight.repo}</span></div>
                  <div>Default Branch: <span className="font-mono">{preflight.defaultBranch}</span></div>
                  <div>Private: <span className="font-mono">{String(preflight.private)}</span></div>
                  <div>Permissions: <span className="font-mono">push={String(preflight.permissions?.push)} pull={String(preflight.permissions?.pull)}</span></div>
                  <div>Scopes: <span className="font-mono">{Array.isArray(preflight.scopes) ? preflight.scopes.join(', ') : ''}</span></div>
                  {preflight.protection?.accessible ? (
                    <div>
                      Branch Protection: approvals={preflight.protection.requiredApprovals} strictChecks={String(preflight.protection.strictStatusChecks)}
                      {Array.isArray(preflight.protection.requiredContexts) && preflight.protection.requiredContexts.length > 0 && (
                        <div className="mt-1">Required Checks: <span className="font-mono">{preflight.protection.requiredContexts.join(', ')}</span></div>
                      )}
                    </div>
                  ) : (
                    <div>Branch Protection: <span className="font-mono">not accessible</span></div>
                  )}
                  {Array.isArray(preflight.reasons) && preflight.reasons.length > 0 && (
                    <div className="mt-2">
                      Reasons:
                      <ul className="list-disc ml-5 mt-1">
                        {preflight.reasons.map((r, idx) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <SettingsInput
          label="Target Baseline Year"
          type="number"
          value={baselineYear}
          onChange={(e) => setBaselineYear(e.target.value)}
          placeholder="e.g., 2025"
          helperText="The target year for modernization suggestions."
        />
        <SettingsInput
          label="Feature Threshold"
          value={featureThreshold}
          onChange={(e) => setFeatureThreshold(e.target.value)}
          placeholder="e.g., medium"
          helperText="Minimum impact level for suggestions (low, medium, high)."
        />
        <div className="flex items-center justify-between pt-4">
          <motion.button
            onClick={handleSave}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-indigo-600 text-white font-semibold shadow-lg hover:bg-indigo-700 transition-all duration-300"
          >
            <FiSave />
            Save Settings
          </motion.button>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center space-x-2 text-green-600 dark:text-green-400"
            >
              <FiCheckCircle size={20} />
              <span>{message}</span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default Settings;
