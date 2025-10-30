import React from 'react';
import { motion } from 'framer-motion';
import { FiLink } from 'react-icons/fi'

type HeadLevel = 'h2' | 'h3' | 'h4';
type AnchorHeadingProps = { id: string; level?: HeadLevel; children: React.ReactNode };
const AnchorHeading: React.FC<AnchorHeadingProps> = ({ id, level = 'h2', children }) => {
  const Tag = level as keyof JSX.IntrinsicElements;
  const size = level === 'h2' ? 'text-2xl' : level === 'h3' ? 'text-xl' : 'text-lg';
  return (
    <Tag id={id} className={`${size} font-semibold text-indigo-700 dark:text-indigo-300 mb-4 scroll-mt-24`}>
      <a href={`#${id}`} className="group inline-flex items-center gap-2">
        <span>{children}</span>
        <FiLink className="w-4 h-4 opacity-0 group-hover:opacity-100 text-indigo-500 dark:text-indigo-300" />
      </a>
    </Tag>
  );
};

const Code: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="bg-gray-100 text-gray-900 dark:bg-gray-900/60 dark:text-gray-200 px-2 py-1 rounded font-mono text-sm">{children}</code>
);

const DocsPage: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-4xl mx-auto p-4 text-gray-900 dark:text-white"
    >
      <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700 dark:from-indigo-400 dark:to-purple-500 mb-8">Documentation</h1>
      
      {/* Quick Overview & Features */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-md p-8 rounded-xl shadow-lg space-y-6 border border-gray-200 dark:border-gray-700/50">
        <section>
          <AnchorHeading id="quick-overview">Quick Overview</AnchorHeading>
          <p className="text-gray-700 dark:text-gray-300">
            Baseline Repo Checker helps you quickly assess a repository for modern web compatibility and best practices. Use it to understand what works across major browsers, spot risks (like vulnerable dependencies), and get clear guidance on how to modernize.
          </p>
        </section>

        {/* Why Use */}
        <section>
          <AnchorHeading id="why-use">Why Use Baseline Repo Checker?</AnchorHeading>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li>Validate browser compatibility for key features before shipping.</li>
            <li>Demonstrate modernization readiness for stakeholders.</li>
            <li>Reduce risk with automated vulnerability checks and summaries.</li>
            <li>Accelerate planning with actionable suggestions and exportable reports.</li>
          </ul>
        </section>

        <section>
          <AnchorHeading id="feature-highlights">Feature Highlights</AnchorHeading>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li>Scan sources: <Code>GitHub URL</Code>, <Code>ZIP upload</Code>, <Code>local</Code>, <Code>web URL</Code>.</li>
            <li>Choose target browsers to focus the analysis (<Code>GET /api/browsers</Code> powered).</li>
            <li>Real-time progress with clear steps and status messages.</li>
            <li>Security checks with severity labels and quick wins.</li>
            <li>Modernization suggestions you can review and export.</li>
          </ul>
        </section>

        {/* Quick Start (UI) */}
        <section>
          <AnchorHeading id="getting-started">Quick Start</AnchorHeading>
          <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li>Open the app and go to <Code>Start Scan</Code>.</li>
            <li>Select input type: paste a <Code>GitHub URL</Code> or upload a <Code>ZIP</Code>.</li>
            <li>Pick your target browsers (e.g., <Code>Chrome</Code>, <Code>Safari</Code>, <Code>Firefox</Code>, <Code>Edge</Code>).</li>
            <li>Optional: choose <Code>branch</Code> and add <Code>exclude paths</Code> like <Code>node_modules</Code>.</li>
            <li>Start the scan and watch progress. When finished, open the results.</li>
            <li>Review compatibility insights, vulnerabilities, and suggestions. Export as CSV or PDF.</li>
          </ol>
          <p className="text-sm text-gray-600 dark:text-gray-400">Tip: Public GitHub repos require no token. Private repos may require access.</p>
        </section>

        {/* Developer API (Optional) */}
        <section>
          <AnchorHeading id="api-overview">Developer API (Optional)</AnchorHeading>
          <p className="text-gray-700 dark:text-gray-300 mb-4">If you prefer integrating scans into your workflow or CI, you can use these endpoints.</p>
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">POST /api/scans</h3>
              <pre className="bg-gray-100 dark:bg-gray-900/40 p-4 rounded border border-gray-200 dark:border-gray-700/50 overflow-x-auto text-sm text-gray-800 dark:text-gray-200"><code className="language-bash">{`curl -X POST http://localhost:3001/api/scans \
  -H "Content-Type: application/json" \
  -d '{
    "inputType": "github",
    "repoUrl": "https://github.com/org/repo",
    "targetBrowsers": ["chrome","firefox","safari","edge"],
    "branch": "main",
    "excludePaths": ["node_modules","dist"]
  }'`}</code></pre>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">GET /api/scans/:id/status</h3>
              <pre className="bg-gray-100 dark:bg-gray-900/40 p-4 rounded border border-gray-200 dark:border-gray-700/50 overflow-x-auto text-sm text-gray-800 dark:text-gray-200"><code className="language-bash">{`curl http://localhost:3001/api/scans/SCN123/status`}</code></pre>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">GET /api/scans/:id/result</h3>
              <pre className="bg-gray-100 dark:bg-gray-900/40 p-4 rounded border border-gray-200 dark:border-gray-700/50 overflow-x-auto text-sm text-gray-800 dark:text-gray-200"><code className="language-bash">{`curl http://localhost:3001/api/scans/SCN123/result`}</code></pre>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">GET /api/scans/:id</h3>
              <pre className="bg-gray-100 dark:bg-gray-900/40 p-4 rounded border border-gray-200 dark:border-gray-700/50 overflow-x-auto text-sm text-gray-800 dark:text-gray-200"><code className="language-bash">{`curl http://localhost:3001/api/scans/SCN123`}</code></pre>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">GET /api/scans/compare</h3>
              <pre className="bg-gray-100 dark:bg-gray-900/40 p-4 rounded border border-gray-200 dark:border-gray-700/50 overflow-x-auto text-sm text-gray-800 dark:text-gray-200"><code className="language-bash">{`curl "http://localhost:3001/api/scans/compare?left=SCN123&right=SCN456"`}</code></pre>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">GET /api/scans/:id/impact</h3>
              <pre className="bg-gray-100 dark:bg-gray-900/40 p-4 rounded border border-gray-200 dark:border-gray-700/50 overflow-x-auto text-sm text-gray-800 dark:text-gray-200"><code className="language-bash">{`curl http://localhost:3001/api/scans/SCN123/impact`}</code></pre>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">GET /api/scans/:id/suggestions</h3>
              <pre className="bg-gray-100 dark:bg-gray-900/40 p-4 rounded border border-gray-200 dark:border-gray-700/50 overflow-x-auto text-sm text-gray-800 dark:text-gray-200"><code className="language-bash">{`curl http://localhost:3001/api/scans/SCN123/suggestions`}</code></pre>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">POST /api/scans/:id/apply</h3>
              <pre className="bg-gray-100 dark:bg-gray-900/40 p-4 rounded border border-gray-200 dark:border-gray-700/50 overflow-x-auto text-sm text-gray-800 dark:text-gray-200"><code className="language-bash">{`curl -X POST http://localhost:3001/api/scans/SCN123/apply \
  -H "Content-Type: application/json" \
  -d '{"action":"download"}'`}</code></pre>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">GET /api/browsers</h3>
              <pre className="bg-gray-100 dark:bg-gray-900/40 p-4 rounded border border-gray-200 dark:border-gray-700/50 overflow-x-auto text-sm text-gray-800 dark:text-gray-200"><code className="language-bash">{`curl http://localhost:3001/api/browsers`}</code></pre>
            </div>
          </div>
        </section>

        {/* Input & Validation (anchor-enabled) */}
        <section>
          <AnchorHeading id="input-validation">Input & Validation</AnchorHeading>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li><span className="font-semibold text-gray-900 dark:text-white">inputType</span> is required: one of <Code>github</Code>, <Code>local</Code>, <Code>url</Code>, <Code>zip</Code>.</li>
            <li><span className="font-semibold text-gray-900 dark:text-white">repoUrl</span> must be a valid <Code>http(s)</Code> URL for <Code>github</Code>/<Code>url</Code>.</li>
            <li><span className="font-semibold text-gray-900 dark:text-white">localPath</span> must be absolute for <Code>local</Code> scans (Windows or POSIX).</li>
            <li><span className="font-semibold text-gray-900 dark:text-white">zipBuffer</span> must be base64 for <Code>zip</Code> input; frontend enforces a 12MB limit.</li>
            <li><span className="font-semibold text-gray-900 dark:text-white">targetBrowsers</span> must be a non-empty array.</li>
            <li><span className="font-semibold text-gray-900 dark:text-white">branch</span> is optional; alphanumeric plus <Code>-</Code>, <Code>_</Code>, <Code>.</Code>; ≤100 chars.</li>
            <li><span className="font-semibold text-gray-900 dark:text-white">excludePaths</span> is optional; array of non-empty strings ≤150 chars each.</li>
          </ul>
        </section>

        {/* Scan Flow */}
        <section>
          <AnchorHeading id="scan-flow">What Happens During a Scan</AnchorHeading>
          <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li>Source prepared: clone repo, read local files, or unzip archive.</li>
            <li>Code examined: languages, dependencies, and features identified.</li>
            <li>Compatibility mapped against chosen target browsers.</li>
            <li>Security findings summarized with severity levels.</li>
            <li>Actionable suggestions listed with context and references.</li>
          </ol>
        </section>

        {/* How It Works (At a Glance) */}
        <section>
          <AnchorHeading id="architecture-stack">How It Works (At a Glance)</AnchorHeading>
          <p className="text-gray-700 dark:text-gray-300">Behind the scenes, the app analyzes your repository using standard parsing libraries and trusted data sources, then presents results in a clean, actionable dashboard.</p>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 mt-2">
            <li><span className="font-semibold text-gray-900 dark:text-white">Code parsing:</span> ASTs and file heuristics for JS/TS, CSS, and HTML.</li>
            <li><span className="font-semibold text-gray-900 dark:text-white">Compatibility data:</span> curated datasets from MDN/caniuse-lite.</li>
            <li><span className="font-semibold text-gray-900 dark:text-white">Security checks:</span> advisories and dependency health signals.</li>
          </ul>
        </section>

        {/* Scan Lifecycle (Optional Diagram) */}
        <section>
          <AnchorHeading id="architecture-flow">Scan Lifecycle (Optional Diagram)</AnchorHeading>
          <pre className="bg-gray-100 dark:bg-gray-900/40 p-4 rounded border border-gray-200 dark:border-gray-700/50 overflow-x-auto text-sm text-gray-800 dark:text-gray-200"><code className="language-mermaid">{`flowchart TD
A[Start Scan Form] --> B[POST /api/scans]
B --> C{Queue Job}
C -->|github| D[Clone Repo]
C -->|local| E[Read Files]
C -->|zip| F[Unzip Archive]
D --> G[Analysis]
E --> G[Analysis]
F --> G[Analysis]
G --> H[Compatibility + Security]
H --> I[Suggestions + Report]
I --> J[GET /api/scans/:id/result]
J --> K[UI: Scan Details Dashboard]
`}</code></pre>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">To render Mermaid, optionally install <Code>mermaid</Code> and hydrate this block. Otherwise, the source code is shown.</p>
        </section>

        {/* Use Cases */}
        <section>
          <AnchorHeading id="use-cases">Use Cases</AnchorHeading>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li>Pre‑release compatibility check for new features.</li>
            <li>Initial modernization audit for legacy projects.</li>
            <li>Monorepo overview: consolidate browser and security findings.</li>
            <li>Stakeholder reporting with exportable summaries.</li>
          </ul>
        </section>

        {/* Demo */}
        <section>
          <AnchorHeading id="demo">Demo</AnchorHeading>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li>Start a scan with any public repo (e.g., <Code>https://github.com/twbs/bootstrap</Code>).</li>
            <li>Pick target browsers, run the scan, and open the results.</li>
            <li>Export a summary to share with your team.</li>
          </ul>
        </section>

        {/* Self‑Hosting (Optional) */}
        <section>
          <AnchorHeading id="self-hosting">Self‑Hosting (Optional)</AnchorHeading>
          <p className="text-gray-700 dark:text-gray-300">You can run the app locally if needed. This is optional for most users.</p>
          <div className="space-y-3 text-gray-700 dark:text-gray-300">
            <p className="text-sm text-gray-600 dark:text-gray-400">Docker Compose</p>
            <pre className="bg-gray-100 dark:bg-gray-900/40 p-4 rounded border border-gray-200 dark:border-gray-700/50 overflow-x-auto text-sm text-gray-800 dark:text-gray-200"><code className="language-bash">{`docker-compose up --build`}</code></pre>
            <p className="text-sm text-gray-600 dark:text-gray-400">Manual</p>
            <pre className="bg-gray-100 dark:bg-gray-900/40 p-4 rounded border border-gray-200 dark:border-gray-700/50 overflow-x-auto text-sm text-gray-800 dark:text-gray-200"><code className="language-bash">{`# Terminal 1
cd backend
npm install
npm run dev

# Terminal 2
cd frontend
npm install
npm run dev`}</code></pre>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Open <Code>http://localhost:5173/</Code> and start a scan.</p>
        </section>

        {/* Demo */}
        <section>
          <AnchorHeading id="demo">Demo</AnchorHeading>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li>Script: <Code>scripts/run-scan-fixture.js</Code> to generate a sample scan.</li>
            <li>Walkthrough: open <Code>/scan</Code>, start a GitHub scan, monitor progress, view results.</li>
            <li>Optional: record a short video showcasing feature highlights and export options.</li>
          </ul>
        </section>
      </div>
    </motion.div>
  );
};

export default DocsPage;
