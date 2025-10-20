import React, { useMemo, useState } from 'react';

function safeGet(obj, path, fallback = undefined) {
  try {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj) ?? fallback;
  } catch {
    return fallback;
  }
}

function computeCompliance(analytics) {
  const counts = analytics?.counts || {};
  const total = (counts.supported || 0) + (counts.unsupported || 0) + (counts.partial || 0);
  const supported = counts.supported || 0;
  const pct = total > 0 ? Math.round((supported / total) * 100) : 0;
  return { total, supported, pct };
}

function colorForCompliance(pct) {
  if (pct >= 80) return 'brightgreen';
  if (pct >= 60) return 'yellow';
  if (pct >= 40) return 'orange';
  return 'red';
}

function buildBadgeUrl(label, message, color) {
  const base = 'https://img.shields.io/badge/';
  const encLabel = encodeURIComponent(label).replace(/%20/g, '_');
  const encMessage = encodeURIComponent(message).replace(/%20/g, '_');
  return `${base}${encLabel}-${encMessage}-${color}?logo=github&style=flat`;
}

export default function BadgeGenerator({ analytics, displayData }) {
  const [customLabel, setCustomLabel] = useState('Baseline Autopilot');
  const repoOwner = safeGet(displayData, 'repoDetails.owner', '');
  const repoName = safeGet(displayData, 'repoDetails.name', safeGet(displayData, 'repoDetails.repo', 'Repository'));

  const compliance = useMemo(() => computeCompliance(analytics), [analytics]);

  const defaultMessage = useMemo(() => {
    return `Compliance ${compliance.pct}%`;
  }, [compliance]);

  const [customMessage, setCustomMessage] = useState(defaultMessage);

  // keep message synced with compliance when analytics change
  React.useEffect(() => {
    setCustomMessage(`Compliance ${compliance.pct}%`);
  }, [compliance.pct]);

  const badgeUrl = useMemo(() => {
    const color = colorForCompliance(compliance.pct);
    return buildBadgeUrl(customLabel, customMessage, color);
  }, [customLabel, customMessage, compliance.pct]);

  const markdown = useMemo(() => {
    const linkTarget = repoOwner && repoName ? `https://github.com/${repoOwner}/${repoName}` : 'https://github.com/';
    return `[![${customLabel}](${badgeUrl})](${linkTarget})`;
  }, [badgeUrl, customLabel, repoOwner, repoName]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
    } catch (err) {
      // Fallback: create a temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = markdown;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-xl border border-gray-700/50 shadow-lg p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Badge Generator</h3>
        <span className="text-xs text-gray-400">Shields.io</span>
      </div>
      <p className="text-sm text-gray-300 mb-4">
        Create a markdown badge for your repository README showing baseline compliance.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Label</label>
          <input
            type="text"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            className="w-full rounded-md bg-gray-900 border border-gray-700 px-3 py-2 text-sm"
            placeholder="Baseline Autopilot"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Message</label>
          <input
            type="text"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            className="w-full rounded-md bg-gray-900 border border-gray-700 px-3 py-2 text-sm"
            placeholder={`Compliance ${compliance.pct}%`}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <img src={badgeUrl} alt="Compliance badge" className="h-6" />
        <button
          onClick={copyToClipboard}
          className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-md"
        >
          Copy Markdown
        </button>
        <a
          href={badgeUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-indigo-300 hover:text-indigo-200"
        >
          Open Badge URL
        </a>
      </div>

      <div className="mt-3">
        <label className="block text-xs text-gray-400 mb-1">Markdown</label>
        <textarea
          readOnly
          value={markdown}
          className="w-full rounded-md bg-gray-900 border border-gray-700 px-3 py-2 text-xs"
          rows={2}
        />
      </div>

      <div className="mt-4 text-xs text-gray-400">
        <span>
          Repo: {repoOwner ? `${repoOwner}/` : ''}{repoName} · Supported {compliance.supported}/{compliance.total}
        </span>
      </div>
    </div>
  );
}