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
            Baseline Autopilot is an AI-powered toolkit designed to help you analyze and modernize codebases. It detects languages, dependencies, features, browser compatibility, and security issues, then surfaces actionable suggestions.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-indigo-400 mb-4">How It Works</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li><span className="font-semibold text-white">Input Your Repository:</span> Provide a GitHub URL, a local path, a generic Git URL, or upload a ZIP.</li>
            <li><span className="font-semibold text-white">Select Target Browsers:</span> Choose the browsers to check compatibility against.</li>
            <li><span className="font-semibold text-white">Analyze and Review:</span> The backend scans, detects features/issues, and generates suggestions.</li>
            <li><span className="font-semibold text-white">Apply Changes:</span> Review unified diffs and download patches or create a PR.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-indigo-400 mb-4">Getting Started</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>Node.js 18+ and optional Docker Compose.</li>
            <li>Local dev: <code className="bg-gray-900/50 px-2 py-0.5 rounded">cd frontend && npm install && npm run dev</code> and <code className="bg-gray-900/50 px-2 py-0.5 rounded">cd backend && npm install && npm run dev</code>.</li>
            <li>Env vars: <code>VITE_API_URL</code> (frontend), <code>PORT</code>, <code>FRONTEND_URL</code>, <code>MONGODB_URI</code> (backend). See <code>docker-compose.yml</code>.</li>
            <li>Run both via Docker: <code className="bg-gray-900/50 px-2 py-0.5 rounded">docker-compose up --build</code>.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-indigo-400 mb-4">API Overview</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li><code>POST /api/scans</code>: start a scan, returns <code>{`{ scanId, status }`}</code>.</li>
            <li><code>GET /api/scans/:id/status</code>: progress and logs.</li>
            <li><code>GET /api/scans/:id/result</code>: final report, suggestions.</li>
            <li><code>POST /api/scans/:id/apply</code>: <code>{`{ action: 'download' | 'create_pr' }`}</code>.</li>
          </ul>
          <div className="mt-3 bg-gray-900/40 p-4 rounded border border-gray-700/50">
            <p className="text-sm text-gray-400 mb-2">Example request</p>
            <pre className="text-xs whitespace-pre-wrap text-gray-200"><code>{`POST /api/scans
{
  "inputType": "github", // github | local | url | zip
  "repoUrl": "https://github.com/org/repo",
  "localPath": "",
  "zipBuffer": "",
  "targetBrowsers": ["chrome", "firefox", "safari", "edge"],
  "branch": "develop", // optional
  "excludePaths": ["node_modules", "dist", "build"] // optional
}`}</code></pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-indigo-400 mb-4">Input & Validation</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li><span className="font-semibold text-white">inputType</span> is required: one of <code>github</code>, <code>local</code>, <code>url</code>, <code>zip</code>.</li>
            <li><span className="font-semibold text-white">repoUrl</span> must be a valid <code>http(s)</code> URL for <code>github</code>/<code>url</code>.</li>
            <li><span className="font-semibold text-white">localPath</span> must be absolute for <code>local</code> scans (Windows or POSIX).</li>
            <li><span className="font-semibold text-white">zipBuffer</span> must be base64 for <code>zip</code> input; frontend enforces a 12MB limit.</li>
            <li><span className="font-semibold text-white">targetBrowsers</span> must be a non-empty array.</li>
            <li><span className="font-semibold text-white">branch</span> is optional; alphanumeric plus <code>-</code>, <code>_</code>, <code>.</code>; ≤100 chars.</li>
            <li><span className="font-semibold text-white">excludePaths</span> is optional; array of non-empty strings ≤150 chars each.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-indigo-400 mb-4">Scan Flow</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Job queued and <span className="font-semibold text-white">source prepared</span> (clone, local read, or unzip).</li>
            <li>Language, dependency, and feature detection using ASTs and file heuristics.</li>
            <li>Compatibility mapping via <code>caniuse-lite</code> and browserslist.</li>
            <li>Security checks via <code>npm audit</code> and advisories.</li>
            <li>Suggestions generation, unified diff patches, and report build.</li>
          </ol>
          <p className="text-gray-400 text-sm mt-2">Progress step names reflect the actual source operation (e.g., "Cloning repository", "Reading local files", "Unzipping archive").</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-indigo-400 mb-4">Architecture</h2>
          <p className="text-gray-300">Express API + in-memory FIFO job queue (hackathon mode), with WebSockets for real-time progress. MongoDB suggested for persistence. Analysis uses:</p>
          <ul className="list-disc list-inside space-y-2 text-gray-300 mt-2">
            <li><span className="font-semibold text-white">JS/TS:</span> <code>@babel/parser</code>, <code>@babel/traverse</code>, <code>es-module-lexer</code>.</li>
            <li><span className="font-semibold text-white">CSS/HTML:</span> <code>postcss</code>, <code>css-tree</code>, <code>htmlparser2</code>.</li>
            <li><span className="font-semibold text-white">Repo ops:</span> <code>simple-git</code>, <code>multer</code>, <code>jszip</code>.</li>
            <li><span className="font-semibold text-white">Diagnostics:</span> <code>winston</code> logging, <code>dotenv</code> config.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-indigo-400 mb-4">Security & Safety</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>No code execution from scanned repos; static analysis only.</li>
            <li>Sandboxed and ephemeral workdirs; sanitized inputs and timeouts.</li>
            <li>Encrypt sensitive tokens; avoid storing secrets in plain text.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-indigo-400 mb-4">Accessibility & Performance</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>High contrast, keyboard navigation, ARIA live regions for status.</li>
            <li>Code-split heavy components (Monaco, charts); cache results.</li>
            <li>Virtualize long lists, debounce heavy operations, prefer memoization.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-indigo-400 mb-4">Roadmap & Metrics</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>Phases: Initialization → Repo Handling → Analysis → UI → Integration → Testing & Polish.</li>
            <li>Success: scan in ~60s, ≥3 suggestions, detect ≥5 vulnerabilities.</li>
            <li>Product todos tracked in <code>main_baseline_repo_checker.json</code>.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-indigo-400 mb-4">Data Sources</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>Vulnerability: NVD/NIST CVE, npm advisories.</li>
            <li>Compatibility: caniuse-lite, MDN Web Docs API.</li>
            <li>Docs references: MDN, StackOverflow.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-indigo-400 mb-4">Settings</h2>
          <p className="text-gray-300">Configure tokens, thresholds, and theme under Settings.</p>
          <ul className="list-disc list-inside space-y-2 mt-2 text-gray-300">
            <li><span className="font-semibold text-white">GitHub Token:</span> for PR creation.</li>
            <li><span className="font-semibold text-white">Baseline Year & Thresholds:</span> control modernization strictness.</li>
            <li><span className="font-semibold text-white">Theme:</span> light/dark, dual-theme UI.</li>
          </ul>
        </section>
      </div>
    </motion.div>
  );
};

export default DocsPage;