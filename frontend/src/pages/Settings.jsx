import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiSave, FiCheckCircle, FiMoon, FiSun } from 'react-icons/fi';

const SettingsInput = ({ label, type = 'text', value, onChange, helperText, placeholder, theme }) => (
  <div>
    <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-2`}>{label}</label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={theme === 'dark'
        ? 'w-full px-4 py-2 rounded-lg bg-gray-800/50 border-2 border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-300 shadow-sm text-white'
        : 'w-full px-4 py-2 rounded-lg bg-white border-2 border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-300 shadow-sm text-gray-900'}
    />
    {helperText && <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} mt-2`}>{helperText}</p>}
  </div>
);

const ThemeToggle = ({ theme, setTheme }) => (
  <div className="flex items-center justify-between">
    <label className="block text-sm font-medium text-gray-300">Theme</label>
    <div className="flex items-center bg-gray-800/50 border-2 border-gray-700/50 rounded-full p-1">
      <button 
        onClick={() => setTheme('light')} 
        className={`p-2 rounded-full transition-colors ${theme === 'light' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}>
        <FiSun className="text-white"/>
      </button>
      <button 
        onClick={() => setTheme('dark')} 
        className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}>
        <FiMoon className="text-white"/>
      </button>
    </div>
  </div>
);

function Settings() {
  const [githubToken, setGithubToken] = useState('');
  const [baselineYear, setBaselineYear] = useState('2025');
  const [featureThreshold, setFeatureThreshold] = useState('medium');
  const [theme, setTheme] = useState('dark');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('baseline-settings') || '{}');
    if (saved.githubToken) setGithubToken(saved.githubToken);
    if (saved.baselineYear) setBaselineYear(String(saved.baselineYear));
    if (saved.featureThreshold) setFeatureThreshold(saved.featureThreshold);
    if (saved.theme) setTheme(saved.theme);

    document.documentElement.classList.toggle('dark', saved.theme === 'dark');
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    const settings = JSON.parse(localStorage.getItem('baseline-settings') || '{}');
    settings.theme = theme;
    localStorage.setItem('baseline-settings', JSON.stringify(settings));
  }, [theme]);

  const handleSave = () => {
    const newSettings = { 
      githubToken, 
      baselineYear: Number(baselineYear), 
      featureThreshold, 
      theme 
    };
    localStorage.setItem('baseline-settings', JSON.stringify(newSettings));
    document.documentElement.classList.toggle('dark', theme === 'dark');
    setMessage('Settings saved successfully!');
    setTimeout(() => setMessage(''), 3000);
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
        <ThemeToggle theme={theme} setTheme={setTheme} />
        <SettingsInput
          label="GitHub Token"
          type="password"
          value={githubToken}
          onChange={(e) => setGithubToken(e.target.value)}
          placeholder="ghp_..."
          helperText="Used for creating pull requests. Stored securely in your browser."
          theme={theme}
        />
        <SettingsInput
          label="Target Baseline Year"
          type="number"
          value={baselineYear}
          onChange={(e) => setBaselineYear(e.target.value)}
          placeholder="e.g., 2025"
          helperText="The target year for modernization suggestions."
          theme={theme}
        />
        <SettingsInput
          label="Feature Threshold"
          value={featureThreshold}
          onChange={(e) => setFeatureThreshold(e.target.value)}
          placeholder="e.g., medium"
          helperText="Minimum impact level for suggestions (low, medium, high)."
          theme={theme}
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
              className="flex items-center space-x-2 text-green-400"
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