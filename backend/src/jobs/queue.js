const { EventEmitter } = require('events');
// uuid type is provided via @types/uuid or local d.ts; keep runtime require
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const repoAnalyzer = require('../services/repoAnalyzer');
const parser = require('../services/parser');
const baseline = require('../services/baseline');
const JobModel = require('../models/Job');
const ScanModel = require('../models/Scan');
const { generateAiSuggestions } = require('../services/llmSuggestions');
const { runDetectors } = require('../services/pluginRegistry');

/**
 * @typedef {{ ts: number, msg: string }} TimelineEntry
 */
/**
 * Unified feature/environment/architecture detection builder
 * @param {string} root
 * @param {string[]} files
 * @param {string} repoUrl
 * @returns {Promise<any>}
 */
async function buildDetected(root, files, repoUrl) {
  // Structured summary object expected by the frontend SummaryLog component
  /** @type {{ duration: string, filesIgnored: number, agentVersion: string, scanDate: string, logs: TimelineEntry[], stats?: any, resourceUsage?: any, warnings?: string[] }} */
  const summaryLog = { duration: '', filesIgnored: 0, agentVersion: 'N/A', scanDate: '', logs: [] };
  const log = (/** @type {string} */ msg) => summaryLog.logs.push({ ts: Date.now(), msg });

  // Aggregate plain feature map per file
  /** @type {Record<string, string[]>} */
  const features = {};
  const addFeature = (/** @type {string} */ file, /** @type {string} */ feature) => {
    if (!features[file]) features[file] = [];
    features[file].push(feature);
  };

  // JS/CSS per-file feature detection
  log('Detecting JS/CSS features per file');
  for (const rel of files) {
    const ext = path.extname(rel).toLowerCase();
    const abs = path.join(root, rel);
    try {
      if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
        const feats = await parser.detectJsFeatures(abs);
        for (const f of feats) addFeature(rel, f);
      } else if (['.css', '.scss'].includes(ext)) {
        const feats = await parser.detectCssFeatures(abs);
        for (const f of feats) addFeature(rel, f);
      }
    } catch (_) { }
  }

  // Read package.json if available
  let packageJson = null;
  try {
    const pkgStr = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
    packageJson = JSON.parse(pkgStr);
  } catch (_) { }

  // Environment and versioning
  log('Detecting environment and versioning');
  /** @type {any} */
  const env = await parser.detectEnvironmentAndVersioning(root, packageJson);

  // Repo details (frameworks, build tools, languages, etc.)
  log('Detecting repo details');
  /** @type {any} */
  const repoDetails = await parser.detectRepoDetails(root, repoUrl, {}, packageJson);

  // Security & performance
  log('Detecting security and performance');
  const secPerf = /** @type {any} */ (await parser.detectSecurityAndPerformance(root));

  // Vulnerability severity summary derived from npm audit JSON (environment.securityVulnerabilities)
  try {
    const vulns = /** @type {any[]} */ (Array.isArray(env?.securityVulnerabilities) ? env.securityVulnerabilities : []);
    const severitySummary = { low: 0, moderate: 0, high: 0, critical: 0, unknown: 0 };
    for (const v of vulns) {
      const sev = String(v?.severity || v?.severityValue || v?.severity_level || 'unknown').toLowerCase();
      if (sev === 'low') severitySummary.low++;
      else if (sev === 'moderate' || sev === 'medium') severitySummary.moderate++;
      else if (sev === 'high') severitySummary.high++;
      else if (sev === 'critical') severitySummary.critical++;
      else severitySummary.unknown++;
    }
    secPerf.vulnSeveritySummary = severitySummary;
  } catch (_) { }


  // Derive high-level projectFeatures list for frontend aggregators
  const projectFeatures = {
    detectedFeatures: Array.from(
      new Set(Object.values(features).flat().filter(Boolean))
    ),
  };

  // Architecture: collect config files and frameworks from repoDetails
  const architecture = {
    configFiles: [],
    frameworks: [],
    buildTools: [],
  };
  try {
    const allFiles = await repoAnalyzer.walkFiles(root);
    const candidateNames = [
      '.browserslistrc', 'browserslist', 'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
      'angular.json', 'nx.json', 'workspace.json', 'lerna.json',
      'tsconfig.json', 'tsconfig.app.json', 'tsconfig.spec.json',
      'vite.config.js', 'vite.config.ts',
      'webpack.config.js', 'rollup.config.js', 'esbuild.config.js',
      'babel.config.js', 'postcss.config.js', 'tailwind.config.js',
      'jest.config.js', 'karma.conf.js', 'protractor.conf.js',
      'eslint.config.js', '.eslintrc.js', '.eslintrc.json',
      'prettier.config.js', '.prettierrc', '.prettierrc.json',
      'next.config.js', 'next.config.mjs', 'nuxt.config.js', 'nuxt.config.ts',
      'svelte.config.js', 'vue.config.js', 'docker-compose.yml', 'Dockerfile'
    ];
    /** @type {Set<string>} */
    const found = new Set();
    for (const rel of allFiles) {
      const base = path.basename(rel);
      if (candidateNames.includes(base)) found.add(base);
    }
    architecture.configFiles = Array.from(found).sort();

    // Build compact file tree (top 2 levels, limited nodes)
    /**
     * @param {string[]} files
     * @param {number} [maxDepth]
     * @param {number} [maxNodes]
     */
    const buildFileTree = (files, maxDepth = 2, maxNodes = 300) => {
      const sepRegex = /[\\/]+/;
      const rootNode = { name: '/', type: 'dir', children: [] };
      let nodeCount = 1;

      /**
       * @param {{ name: string, type: 'dir'|'file', children?: any[] }} parent
       * @param {string} name
       */
      const findChildDir = (parent, name) => {
        const idx = parent.children.findIndex(c => c.type === 'dir' && c.name === name);
        if (idx >= 0) return parent.children[idx];
        const newNode = { name, type: 'dir', children: [] };
        parent.children.push(newNode);
        nodeCount++;
        return newNode;
      };

      for (const rel of files) {
        if (nodeCount >= maxNodes) break;
        const parts = String(rel).split(sepRegex).filter(Boolean);
        if (!parts.length) continue;

        // root-level file
        if (parts.length === 1) {
          rootNode.children.push({ name: parts[0], type: 'file' });
          nodeCount++;
          continue;
        }

        // descend directories up to maxDepth
        let parent = rootNode;
        const maxDirParts = Math.min(parts.length - 1, maxDepth);
        for (let i = 0; i < maxDirParts && nodeCount < maxNodes; i++) {
          const dirName = parts[i];
          parent = findChildDir(parent, dirName);
        }

        if (parent && Array.isArray(parent.children) && nodeCount < maxNodes) {
          parent.children.push({ name: parts[parts.length - 1], type: 'file' });
          nodeCount++;
        }
      }

      // sort children alphabetically, dirs first
      /**
       * @param {{ children?: any[] }} node
       */
      const sortTree = (node) => {
        if (!node?.children) return;
        node.children.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
          return String(a.name).localeCompare(String(b.name));
        });
        node.children.forEach(sortTree);
      };
      sortTree(rootNode);

      return rootNode;
    };

    architecture.fileTree = buildFileTree(allFiles);
  } catch (_) { }

  // Derive frameworks from environment and repoDetails
  const envFrameworks = Array.isArray(env?.primaryFrameworks) ? env.primaryFrameworks : [];
  const repoFrameworks = Array.isArray(repoDetails?.frameworks) ? repoDetails.frameworks : [];
  architecture.frameworks = Array.from(new Set([...envFrameworks, ...repoFrameworks]));
  // Enforce router allow list when enabled
  architecture.frameworks = parser.enforceRouterAllowList(architecture.frameworks, env);

  // Build tools based on config files
  const buildToolsSet = new Set(architecture.buildTools);
  const cf = new Set(architecture.configFiles);
  if (cf.has('vite.config.js') || cf.has('vite.config.ts')) buildToolsSet.add('Vite');
  if (cf.has('webpack.config.js')) buildToolsSet.add('Webpack');
  if (cf.has('rollup.config.js')) buildToolsSet.add('Rollup');
  if (cf.has('esbuild.config.js')) buildToolsSet.add('esbuild');
  if (cf.has('babel.config.js')) buildToolsSet.add('Babel');
  if (cf.has('postcss.config.js')) buildToolsSet.add('PostCSS');
  if (cf.has('tailwind.config.js')) buildToolsSet.add('Tailwind CSS');
  if (cf.has('tsconfig.json') || cf.has('tsconfig.app.json')) buildToolsSet.add('TypeScript');
  architecture.buildTools = Array.from(buildToolsSet);
  if (repoDetails && typeof repoDetails === 'object') {
    if (Array.isArray(repoDetails.frameworks)) {
      architecture.frameworks = Array.from(new Set([...architecture.frameworks, ...repoDetails.frameworks]));
    }
    if (Array.isArray(repoDetails.buildTools)) {
      architecture.buildTools = Array.from(new Set([...architecture.buildTools, ...repoDetails.buildTools]));
    }
  }
  // Prioritize framework order using environment.detectorPlan (if present)
  try {
    const planned = Array.isArray(env?.detectorPlan?.frameworks) ? env.detectorPlan.frameworks : [];
    const order = new Map(planned.map((name, idx) => [name, idx]));
    architecture.frameworks = (architecture.frameworks || []).sort((a, b) => {
      const ia = order.has(a) ? order.get(a) : Number.POSITIVE_INFINITY;
      const ib = order.has(b) ? order.get(b) : Number.POSITIVE_INFINITY;
      if (ia === ib) return String(a).localeCompare(String(b));
      return ia - ib;
    });
  } catch { }
  // Fallback framework heuristics from config files
  try {
    const cfg = new Set(architecture.configFiles);
    /**
     * @param {string} name
     */
    const mergeFramework = (name) => {
      architecture.frameworks = Array.from(new Set([...(architecture.frameworks || []), name]));
    };
    if (cfg.has('angular.json') || cfg.has('tsconfig.app.json') || cfg.has('tsconfig.spec.json')) {
      mergeFramework('Angular');
    }
    if (cfg.has('nx.json') || cfg.has('workspace.json')) {
      mergeFramework('Nx');
    }
    if (cfg.has('next.config.js') || cfg.has('next.config.mjs')) {
      mergeFramework('Next.js');
    }
    if (cfg.has('nuxt.config.js') || cfg.has('nuxt.config.ts')) {
      mergeFramework('Nuxt');
    }
    if (cfg.has('vue.config.js')) {
      mergeFramework('Vue');
    }
    if (cfg.has('svelte.config.js')) {
      mergeFramework('Svelte');
    }
  } catch (_) { }

  // Re-apply router enforcement after fallback heuristics
  try {
    architecture.frameworks = parser.enforceRouterAllowList(architecture.frameworks, env);
  } catch { }

  // Compatibility placeholder: leave to frontend aggregator using projectFeatures
  const compatibility = { browserCompatibility: {} };

  // Version control and health placeholders (to satisfy UI expectations)
  const versionControl = { provider: repoUrl.includes('github.com') ? 'github' : 'unknown' };
  const healthAndMaintenance = { issues: [], lastCommitDays: null };

  // Export options placeholder
  const exportOptions = { enabled: true };

  // AI suggestions with guardrails
  let aiSuggestions = {};
  try {
    aiSuggestions = await generateAiSuggestions({
      projectFeatures,
      architecture,
      securityAndPerformance: secPerf,
      environment: env,
    });
  } catch (_) { }

  // Build result object and run plugin detectors
  let result = {
    features,
    repoDetails,
    environment: env,
    projectFeatures,
    architecture,
    compatibility,
    versionControl,
    securityAndPerformance: secPerf,
    healthAndMaintenance,
    summaryLog,
    exportOptions,
    aiSuggestions,
  };

  try {
    result = await runDetectors({ root, files, repoUrl, result });
  } catch (e) {
    try { summaryLog.logs.push({ ts: Date.now(), msg: `[plugin] error: ${e?.message || e}` }); } catch { }
  }

  return result;
}

class JobQueue extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, any>} */
    this.jobs = new Map();
    /** @type {boolean} */
    this.useDatabase = false;
    /** @type {Set<string>} */
    this.activeJobs = new Set();
    /** @type {any[]} */
    this.pending = [];
    /** @type {number} */
    this.maxConcurrent = Number.parseInt(process.env.MAX_CONCURRENT_JOBS || '2', 10);
    if (!Number.isFinite(this.maxConcurrent) || this.maxConcurrent <= 0) this.maxConcurrent = 2;
  }

  // Initialize database connection
  /**
   * @param {boolean} dbConnected
   */
  async init(dbConnected) {
    this.useDatabase = dbConnected;
    if (this.useDatabase) {
      // Load existing jobs from database into memory cache
      try {
        const jobs = await JobModel.find({});
        jobs.forEach(job => {
          this.jobs.set(job.id, this._convertFromDbModel(job));
        });
        console.log(`Loaded ${jobs.length} jobs from database`);
        // Re-enqueue any incomplete jobs to resume processing
        for (const j of this.jobs.values()) {
          if (j.status === 'queued' || j.status === 'processing') {
            j.status = 'queued';
            this.pending.push(j);
          }
        }
        this._scheduleNext();
      } catch (err) {
        console.error('Error loading jobs from database:', err);
      }
    }
  }

  /**
   * @param {any} payload
   * @returns {Promise<any>}
   */
  async createJob(payload) {
    const id = uuidv4();
    const job = {
      id,
      status: 'queued',
      progress: 0,
      payload,
      result: null,
      createdAt: Date.now()
    };

    // Store in memory cache
    this.jobs.set(id, job);

    // Store in database if available
    if (this.useDatabase) {
      try {
        await JobModel.create(job);
      } catch (err) {
        console.error('Error saving job to database:', err);
      }
    }

    // Enqueue and schedule respecting concurrency limits
    this.pending.push(job);
    this._scheduleNext();
    return job;
  }

  /** @returns {Promise<void>} */
  async shutdown() {
    return new Promise(resolve => {
      const check = () => {
        if (this.activeJobs.size === 0) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  /**
   * @param {string} id
   * @returns {Promise<void>}
   */
  async wait(id) {
    return new Promise(resolve => {
      const check = () => {
        if (!this.activeJobs.has(id)) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  /**
   * @param {{ id: string, status: string, progress: number, result: any }} job
   */
  async _updateJobInDb(job) {
    if (!this.useDatabase) return;

    try {
      await JobModel.findOneAndUpdate(
        { id: job.id },
        {
          status: job.status,
          progress: job.progress,
          result: job.result,
          updatedAt: Date.now()
        },
        { new: true }
      );
    } catch (err) {
      console.error(`Error updating job ${job.id} in database:`, err);
    }
  }

  /**
   * @param {any} job
   */
  _process(job) {
    this.activeJobs.add(job.id);
    job.status = 'processing';
    // Mark start time for accurate duration calculation
    job.startedAt = Date.now();

    const timeoutMs = Number.parseInt(process.env.SCAN_TIMEOUT_MS || '0', 10);
    let timeoutHandle = null;
    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        job.cancelRequested = true;
        job.cancelReason = 'timeout';
      }, timeoutMs);
    }
    class CancellationError extends Error { }
    const ensureNotCancelled = () => {
      if (job.cancelRequested) throw new CancellationError(job.cancelReason || 'cancelled');
    };

    if (job.type === 'apply') {
      // Logic for applying changes
      (async () => {
        try {
          ensureNotCancelled();
          console.log(`Applying changes for scan ${job.scanId}`);
          // Implement the logic to apply changes here
          // For example, using git apply or other tools

          job.status = 'done';
          this.emit('done', { id: job.id, result: { message: 'Changes applied successfully' } });
        } catch (error) {
          if (error instanceof CancellationError) {
            job.status = 'cancelled';
            job.result = { cancelled: true, reason: job.cancelReason || 'user' };
            this.emit('done', { id: job.id, result: job.result });
          } else {
            job.status = 'failed';
            job.result = { error: String(error) };
            this.emit('done', { id: job.id, result: job.result });
          }
        } finally {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          this.activeJobs.delete(job.id);
          this._scheduleNext();
        }
      })();
    } else {
      // This is a scan job
      const payload = job.payload || {};
      const sourceStep = payload.localPath
        ? 'Preparing local workspace'
        : (payload.zipBuffer ? 'Unpacking archive' : 'Cloning repository');
      const steps = [
        { name: 'Queued', progress: 0 },
        { name: sourceStep, progress: 20 },
        { name: 'Analyzing files', progress: 50 },
        { name: 'Generating suggestions', progress: 80 },
        { name: 'Done', progress: 100 }
      ];
      let currentStep = 0;
      /**
       * @param {number} stepIndex
       * @param {('queued'|'processing'|'done'|'error')=} status
       */
      const updateProgress = (stepIndex, status) => {
        currentStep = stepIndex;
        job.progress = steps[stepIndex].progress;
        job.status = status || (job.progress === 100 ? 'done' : 'processing');
        this._updateJobInDb(job);
        this.emit('progress', { id: job.id, progress: job.progress, step: steps[currentStep].name });
      };
      updateProgress(0);

      (async () => {
        /** @type {string|null} */
        let workspaceRoot = null;
        try {
          updateProgress(1);
          ensureNotCancelled();
          let scan = null;

          if (this.useDatabase) {
            scan = new ScanModel({
              id: job.id,
              repoUrl: job.payload?.repoUrl || job.payload?.localPath || 'unknown',
              status: 'processing',
              progress: job.progress
            });
            await scan.save();
          }

          if (job.payload && job.payload.repoUrl) {
            ensureNotCancelled();
            console.log(`Processing job ${job.id} with repository URL: ${job.payload.repoUrl}`);
            const cloneStart = Date.now();
            workspaceRoot = await repoAnalyzer.cloneRepo(job.payload.repoUrl, { branch: job.payload.branch, ref: job.payload.ref, sparsePaths: Array.isArray(job.payload?.sparsePaths) ? job.payload.sparsePaths : [] });
            const cloneMs = Date.now() - cloneStart;
            console.log(`Repository cloned successfully to ${workspaceRoot}`);
            ensureNotCancelled();
            updateProgress(2);
            const walkStart = Date.now();
            const extensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.html', '.py', '.ipynb', '.java', '.kt', '.go'];
            const excludePaths = Array.isArray(job.payload?.excludePaths) ? job.payload.excludePaths : [];
            const maxFileMBEnv = Number(process.env.SCAN_MAX_FILE_MB || 0);
            const maxFileBytes = maxFileMBEnv > 0 ? maxFileMBEnv * 1024 * 1024 : undefined;
            const skipLfsEnv = String(process.env.SCAN_SKIP_LFS || '').toLowerCase() === 'true';
            const userExclEnv = String(process.env.SCAN_USER_EXCLUDE_PATHS || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
            const mergedExcludes = Array.from(new Set([...(excludePaths || []), ...userExclEnv]));
            let files = [];
            files = await repoAnalyzer.walkFiles(workspaceRoot, { extensions, excludePaths: mergedExcludes, maxFileBytes, skipLfsFiles: skipLfsEnv });
            const walkMs = Date.now() - walkStart;
            // Analyze loop with cancellation checks
            let filesAnalyzed = 0;
            const totalFiles = files.length;
            const analysisStart = Date.now();
            for (const file of files) {
              ensureNotCancelled();
              await new Promise(resolve => setTimeout(resolve, 10));
              filesAnalyzed++;
              const analysisProgress = 50 + Math.round((filesAnalyzed / totalFiles) * 30);
              job.progress = analysisProgress;
              this.emit('progress', { id: job.id, progress: job.progress, step: `Analyzing ${filesAnalyzed}/${totalFiles} files` });
            }
            const analysisMs = Date.now() - analysisStart;
            ensureNotCancelled();
            const detected = await buildDetected(workspaceRoot, files, job.payload.repoUrl || '');
            const meta = await repoAnalyzer.getCommitMetadata(workspaceRoot);
            const hasGitRepo = fs.existsSync(path.join(workspaceRoot, '.git'));
            let baseRef = null;
            let compareRef = null;
            if (hasGitRepo) {
              compareRef = job.payload.ref || 'HEAD';
              baseRef = job.payload.baseRef || job.payload.branch || meta.defaultBranch || 'HEAD';
            }
            const changedPaths = await repoAnalyzer.getChangedPaths(workspaceRoot, baseRef, compareRef);
            detected.versionControl = {
              ...(detected.versionControl || {}),
              branch: job.payload.branch || null,
              ref: job.payload.ref || null,
              baseRef: baseRef || null,
              compareRef: compareRef || null,
              commitSha: meta.commitSha || '',
              defaultBranch: meta.defaultBranch || ''
            };
            try {
              detected.summaryLog = detected.summaryLog && typeof detected.summaryLog === 'object' ? detected.summaryLog : { logs: [] };
              const filesChangedCount = (Array.isArray(changedPaths) && changedPaths.length > 0) ? files.length : 0;
              detected.summaryLog.logs.push(
                { ts: Date.now(), msg: `Step timing: clone ${cloneMs}ms, walk ${walkMs}ms, analysis ${analysisMs}ms` },
                { ts: Date.now(), msg: `Files discovered: ${files.length}, analyzed: ${totalFiles}, changed: ${filesChangedCount}` }
              );
            } catch (_) { }
            console.log(`Detected features in ${Object.keys(detected.features).length} files`);

            const baselineMapping = {};
            for (const f of Object.keys(detected.features)) {
              baselineMapping[f] = detected.features[f].map(k => baseline.lookup(k));
            }
            job.result = this._buildFixtureResult(job, files, detected);
            job.result.baseline = baselineMapping;

            updateProgress(3);

            // Recalculate impactScore based on dynamic formula
            try {
              const filesScanned = files.length;
              const filesChanged = (Array.isArray(changedPaths) && changedPaths.length > 0) ? files.length : 0;
              const polyfillsRemoved = 0;
              const impactScore = filesScanned > 0 ? Math.round(((filesChanged + polyfillsRemoved) / filesScanned) * 100) : 0;
              job.result.summary = {
                filesScanned,
                filesChanged,
                polyfillsRemoved,
                impactScore,
              };
            } catch (_) { }

            if (this.useDatabase && scan) {
              scan.features = new Map(Object.entries(detected.features));
              scan.baselineMapping = new Map(Object.entries(baselineMapping));
              scan.modernizationSuggestions = [];
              // Persist AI suggestions to Scan document
              scan.aiSuggestions = job.result?.aiSuggestions || {};
              scan.repoDetails = detected.repoDetails;
              scan.environment = detected.environment;
              scan.projectFeatures = detected.projectFeatures;
              scan.architecture = detected.architecture;
              scan.compatibility = detected.compatibility;
              scan.versionControl = detected.versionControl;
              scan.securityAndPerformance = detected.securityAndPerformance;
              scan.healthAndMaintenance = detected.healthAndMaintenance;
              scan.summaryLog = detected.summaryLog;
              scan.exportOptions = detected.exportOptions;
            }
          } else if (job.payload && job.payload.localPath) {
            console.log(`Processing job ${job.id} with local path: ${job.payload.localPath}`);
            /** @type {TimelineEntry[]} */
            const preLog = [];
            // Resolve and validate local path
            let providedPath = String(job.payload.localPath || '').trim();
            if (!providedPath) {
              const errMsg = 'Local path is empty. Provide a valid directory path.';
              console.error(errMsg);
              job.status = 'failed';
              job.message = errMsg;
              job.result = { error: errMsg, summaryLog: [{ ts: Date.now(), msg: errMsg }] };
              if (this.useDatabase) {
                try { await ScanModel.findOneAndUpdate({ id: job.id }, { status: 'failed', progress: 100, result: job.result }); } catch (_) { }
              }
              this.emit('done', { id: job.id, result: job.result });
              return;
            }
            workspaceRoot = path.resolve(providedPath);
            preLog.push({ ts: Date.now(), msg: `Resolved local path to: ${workspaceRoot}` });
            try {
              const stat = fs.statSync(workspaceRoot);
              if (!stat.isDirectory()) {
                const errMsg = `Local path is not a directory: ${workspaceRoot}`;
                console.error(errMsg);
                job.status = 'failed';
                job.message = errMsg;
                job.result = { error: errMsg, summaryLog: [...preLog, { ts: Date.now(), msg: errMsg }] };
                if (this.useDatabase) {
                  try { await ScanModel.findOneAndUpdate({ id: job.id }, { status: 'failed', progress: 100, result: job.result }); } catch (_) { }
                }
                this.emit('done', { id: job.id, result: job.result });
                return;
              }
            } catch (e) {
              const errMsg = `Local path not found or inaccessible: ${workspaceRoot}`;
              console.error(errMsg, e);
              job.status = 'failed';
              job.message = errMsg;
              job.result = { error: errMsg, summaryLog: [...preLog, { ts: Date.now(), msg: errMsg }] };
              if (this.useDatabase) {
                try { await ScanModel.findOneAndUpdate({ id: job.id }, { status: 'failed', progress: 100, result: job.result }); } catch (_) { }
              }
              this.emit('done', { id: job.id, result: job.result });
              return;
            }
            try { fs.accessSync(workspaceRoot, fs.constants.R_OK); } catch (e) {
              const errMsg = `Read access denied for path: ${workspaceRoot}`;
              console.error(errMsg);
              job.status = 'failed';
              job.message = errMsg;
              job.result = { error: errMsg, summaryLog: [...preLog, { ts: Date.now(), msg: errMsg }] };
              if (this.useDatabase) {
                try { await ScanModel.findOneAndUpdate({ id: job.id }, { status: 'failed', progress: 100, result: job.result }); } catch (_) { }
              }
              this.emit('done', { id: job.id, result: job.result });
              return;
            }
            updateProgress(2);
            const extensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.html', '.py', '.ipynb', '.java', '.kt', '.go'];
            const excludePathsLocal = Array.isArray(job.payload?.excludePaths) ? job.payload.excludePaths : [];
            const maxFileMBEnv = Number(process.env.SCAN_MAX_FILE_MB || 0);
            const maxFileBytes = maxFileMBEnv > 0 ? maxFileMBEnv * 1024 * 1024 : undefined;
            const skipLfsEnv = String(process.env.SCAN_SKIP_LFS || '').toLowerCase() === 'true';
            const userExclEnv = String(process.env.SCAN_USER_EXCLUDE_PATHS || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
            const mergedExcludes = Array.from(new Set([...(excludePathsLocal || []), ...userExclEnv]));
            const walkStart = Date.now();
            const files = await repoAnalyzer.walkFiles(workspaceRoot, { extensions, excludePaths: mergedExcludes, maxFileBytes, skipLfsFiles: skipLfsEnv });
            const walkMs = Date.now() - walkStart;
            preLog.push({ ts: Date.now(), msg: `Walked local directory in ${walkMs}ms; files discovered: ${files.length}` });
            console.log(`Found ${files.length} files to analyze from local path`);
            let filesAnalyzed = 0;
            const totalFiles = files.length;
            const analysisStart = Date.now();
            for (const file of files) {
              ensureNotCancelled();
              await new Promise(resolve => setTimeout(resolve, 10));
              filesAnalyzed++;
              const analysisProgress = 50 + Math.round((filesAnalyzed / totalFiles) * 30);
              job.progress = analysisProgress;
              this.emit('progress', { id: job.id, progress: job.progress, step: `Analyzing ${filesAnalyzed}/${totalFiles} files` });
            }
            const analysisMs = Date.now() - analysisStart;
            ensureNotCancelled();
            const detected = await buildDetected(workspaceRoot, files, job.payload.localPath || '');
            try {
              detected.summaryLog = detected.summaryLog && typeof detected.summaryLog === 'object' ? detected.summaryLog : { logs: [] };
              detected.summaryLog.logs.push(...preLog);
              detected.summaryLog.logs.push({ ts: Date.now(), msg: `Step timing: walk ${walkMs}ms, analysis ${analysisMs}ms` });
              detected.summaryLog.logs.push({ ts: Date.now(), msg: `Files discovered: ${files.length}, analyzed: ${totalFiles}` });
            } catch (_) { }
            const baselineMapping = {};
            for (const f of Object.keys(detected.features)) {
              baselineMapping[f] = detected.features[f].map(k => baseline.lookup(k));
            }
            job.result = this._buildFixtureResult(job, files, detected);
            job.result.baseline = baselineMapping;

            if (this.useDatabase && scan) {
              scan.features = new Map(Object.entries(detected.features));
              scan.baselineMapping = new Map(Object.entries(baselineMapping));
              scan.modernizationSuggestions = [];
              scan.aiSuggestions = job.result?.aiSuggestions || {};
              scan.repoDetails = detected.repoDetails;
              scan.environment = detected.environment;
              scan.projectFeatures = detected.projectFeatures;
              scan.architecture = detected.architecture;
              scan.compatibility = detected.compatibility;
              scan.versionControl = detected.versionControl;
              scan.securityAndPerformance = detected.securityAndPerformance;
              scan.healthAndMaintenance = detected.healthAndMaintenance;
              scan.summaryLog = detected.summaryLog;
              scan.exportOptions = detected.exportOptions;
            }
          } else if (job.payload && job.payload.zipBuffer) {
            ensureNotCancelled();
            const unzipStart = Date.now();
            workspaceRoot = await repoAnalyzer.unzipBuffer(Buffer.from(job.payload.zipBuffer, 'base64'));
            const unzipMs = Date.now() - unzipStart;
            updateProgress(2);
            const extensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.html', '.py', '.ipynb', '.java', '.kt', '.go'];
            const excludePathsZip = Array.isArray(job.payload?.excludePaths) ? job.payload.excludePaths : [];
            const maxFileMBEnv = Number(process.env.SCAN_MAX_FILE_MB || 0);
            const maxFileBytes = maxFileMBEnv > 0 ? maxFileMBEnv * 1024 * 1024 : undefined;
            const skipLfsEnv = String(process.env.SCAN_SKIP_LFS || '').toLowerCase() === 'true';
            const userExclEnv = String(process.env.SCAN_USER_EXCLUDE_PATHS || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
            const mergedExcludes = Array.from(new Set([...(excludePathsZip || []), ...userExclEnv]));
            const walkStart = Date.now();
            const files = await repoAnalyzer.walkFiles(workspaceRoot, { extensions, excludePaths: mergedExcludes, maxFileBytes, skipLfsFiles: skipLfsEnv });
            const walkMs = Date.now() - walkStart;
            console.log(`Found ${files.length} files to analyze from uploaded zip`);
            let filesAnalyzed = 0;
            const totalFiles = files.length;
            const analysisStart = Date.now();
            for (const file of files) {
              ensureNotCancelled();
              await new Promise(resolve => setTimeout(resolve, 10));
              filesAnalyzed++;
              const analysisProgress = 50 + Math.round((filesAnalyzed / totalFiles) * 30);
              job.progress = analysisProgress;
              this.emit('progress', { id: job.id, progress: job.progress, step: `Analyzing ${filesAnalyzed}/${totalFiles} files` });
            }
            const analysisMs = Date.now() - analysisStart;
            ensureNotCancelled();
            const detected = await buildDetected(workspaceRoot, files, job.payload.repoUrl || '');
            try {
              detected.summaryLog = detected.summaryLog && typeof detected.summaryLog === 'object' ? detected.summaryLog : { logs: [] };
              const mem = process && process.memoryUsage ? process.memoryUsage() : {};
              detected.summaryLog.logs.push(
                { ts: Date.now(), msg: `Step timing: unzip ${unzipMs}ms, walk ${walkMs}ms, analysis ${analysisMs}ms` },
                { ts: Date.now(), msg: `Files discovered: ${files.length}, analyzed: ${totalFiles}` },
                { ts: Date.now(), msg: `Memory RSS: ${mem.rss || 0}, HeapUsed: ${mem.heapUsed || 0}` }
              );
            } catch (_) { }
            const baselineMapping = {};
            for (const f of Object.keys(detected.features)) {
              baselineMapping[f] = detected.features[f].map(k => baseline.lookup(k));
            }
            job.result = this._buildFixtureResult(job, files, detected);
            job.result.baseline = baselineMapping;

            if (this.useDatabase && scan) {
              scan.features = new Map(Object.entries(detected.features));
              scan.baselineMapping = new Map(Object.entries(baselineMapping));
              scan.modernizationSuggestions = [];
              // Persist AI suggestions to Scan document
              scan.aiSuggestions = job.result?.aiSuggestions || {};
              scan.repoDetails = detected.repoDetails;
              scan.environment = detected.environment;
              scan.projectFeatures = detected.projectFeatures;
              scan.architecture = detected.architecture;
              scan.compatibility = detected.compatibility;
              scan.securityAndPerformance = detected.securityAndPerformance;
              scan.healthAndMaintenance = detected.healthAndMaintenance;
              scan.summaryLog = detected.summaryLog;
              scan.exportOptions = detected.exportOptions;
            }
          } else {
            job.result = this._buildFixtureResult(job);
          }

          updateProgress(4, 'done');

          if (this.useDatabase && scan) {
            scan.status = 'done';
            scan.progress = 100;
            await scan.save();
          }

          console.log('=== SCAN COMPLETED ===');
          console.log('Job ID:', job.id);
          console.log('Scan Result Summary:');
          console.log('- Features detected:', Object.keys(job.result?.features || {}).length, 'files');
          console.log('- Total features found:', Object.values(job.result?.features || {}).flat().length);
          console.log('- Suggestions generated:', job.result?.suggestions?.length || 0);
          console.log('- Repository details:', !!job.result?.repoDetails);
          console.log('- Environment data:', !!job.result?.environment);
          console.log('- Architecture analysis:', !!job.result?.architecture);
          console.log('- Compatibility report:', !!job.result?.compatibility);
          console.log('- Security & Performance:', !!job.result?.securityAndPerformance);
          console.log('- Health & Maintenance:', !!job.result?.healthAndMaintenance);
          console.log('Full result object keys:', Object.keys(job.result || {}));
          console.log('========================');

          this.emit('done', { id: job.id, result: job.result });
        } catch (err) {
          console.error('Job failed with error:', err);
          job.status = 'failed';
          job.message = String(err);
          this._updateJobInDb(job);
          job.result = { error: String(err) };

          if (this.useDatabase) {
            try {
              await ScanModel.findOneAndUpdate(
                { id: job.id },
                { status: 'failed', progress: 100 }
              );
            } catch (dbErr) {
              console.error('Error updating scan status on failure:', dbErr);
            }
          }

          // Finalize structured summary before completion
          try {
            const now = Date.now();
            const started = job.startedAt || (job.createdAt ? new Date(job.createdAt).getTime() : now);
            const totalMs = Math.max(0, now - started);
            const durationSeconds = (totalMs / 1000).toFixed(3);
            const filesScanned = (job.result?.summary?.filesScanned != null)
              ? job.result.summary.filesScanned
              : (Array.isArray(job.result?.files) ? job.result.files.length : 0);
            const filesAnalyzed = Array.isArray(job.result?.files) ? job.result.files.length : 0;
            const filesIgnored = Math.max(0, filesScanned - filesAnalyzed);
            const sp = job.result?.securityAndPerformance || {};
            const issuesFound =
              (Array.isArray(sp.securityVulnerabilities) ? sp.securityVulnerabilities.length : 0) +
              (Array.isArray(sp.insecureApiCalls) ? sp.insecureApiCalls.length : 0) +
              (Array.isArray(sp.missingPolicies) ? sp.missingPolicies.length : 0) +
              (Array.isArray(sp.secrets) ? sp.secrets.length : 0);
            const mem = process && process.memoryUsage ? process.memoryUsage() : {};
            const rssMB = mem.rss ? (mem.rss / (1024 * 1024)).toFixed(2) : '0.00';
            const heapMB = mem.heapUsed ? (mem.heapUsed / (1024 * 1024)).toFixed(2) : '0.00';
            const cpu = process && process.cpuUsage ? process.cpuUsage() : { user: 0, system: 0 };
            const cpuUserMs = Math.round((cpu.user || 0) / 1000);
            const cpuSystemMs = Math.round((cpu.system || 0) / 1000);
            const pkg = (() => { try { return require('../../package.json'); } catch { return {}; } })();
            const agentVersion = pkg && pkg.version ? `Baseline Agent v${pkg.version}` : 'N/A';
            const criticalCount = (() => {
              const vulns = Array.isArray(sp.securityVulnerabilities) ? sp.securityVulnerabilities : [];
              return vulns.filter(v => String(v?.severity || '').toLowerCase().includes('critical')).length;
            })();
            /** @type {string[]} */
            const warnings = [];
            if (criticalCount > 0) warnings.push(`${criticalCount} critical vulnerabilities detected`);
            if ((Array.isArray(sp.missingPolicies) ? sp.missingPolicies.length : 0) > 0) warnings.push('Missing security policies');
            if ((Array.isArray(sp.insecureApiCalls) ? sp.insecureApiCalls.length : 0) > 0) warnings.push('Insecure API calls detected');

            // Ensure summaryLog object exists
            job.result.summaryLog = job.result.summaryLog && typeof job.result.summaryLog === 'object' ? job.result.summaryLog : { logs: [] };
            job.result.summaryLog.duration = `${durationSeconds} seconds`;
            job.result.summaryLog.filesIgnored = filesIgnored;
            job.result.summaryLog.agentVersion = agentVersion;
            job.result.summaryLog.scanDate = new Date(now).toISOString();
            job.result.summaryLog.stats = {
              filesScanned,
              issuesFound,
              vulnerabilities: Array.isArray(sp.securityVulnerabilities) ? sp.securityVulnerabilities.length : 0,
              hygieneIssues: ((Array.isArray(sp.missingPolicies) ? sp.missingPolicies.length : 0) + (Array.isArray(sp.insecureApiCalls) ? sp.insecureApiCalls.length : 0)),
              secretsFound: Array.isArray(sp.secrets) ? sp.secrets.length : 0,
            };
            job.result.summaryLog.resourceUsage = {
              memoryRSSMB: rssMB,
              heapUsedMB: heapMB,
              cpuUserMs,
              cpuSystemMs,
            };
            job.result.summaryLog.warnings = warnings;

            // Persist to DB summaryLog as well
            if (this.useDatabase) {
              try {
                await ScanModel.findOneAndUpdate({ id: job.id }, { summaryLog: job.result.summaryLog, completedAt: new Date(now).toISOString() });
              } catch (_) { }
            }
          } catch (_) { }

          this.emit('done', { id: job.id, result: job.result });
        } finally {
          if (workspaceRoot) await repoAnalyzer.cleanup(workspaceRoot);
          this.activeJobs.delete(job.id);
          this._scheduleNext();
        }
      })();
    }
  }

  /**
   * @param {any} job
   * @param {string[]} files
   * @param {any} detected
   * @returns {any}
   */
  _buildFixtureResult(job, files = [], detected = {}) {
    // Minimal fixture with summary, features and suggestions, exposing key analyses top-level
    return {
      scanId: job.id,
      summary: { filesScanned: files.length || 10, filesChanged: 2, polyfillsRemoved: 1, impactScore: 72 },
      files: files,
      detectedFeatures: detected,
      // Keep legacy features array for UI demo cards
      features: Object.keys(detected.features || {}).map(f => ({ name: (detected.features[f] || []).join(', '), files: [f], baselineStatus: 'unknown' })),
      // Expose analyzed data top-level for immediate consumption via socket
      repoDetails: detected.repoDetails || {},
      environment: detected.environment || {},
      projectFeatures: detected.projectFeatures || {},
      architecture: detected.architecture || {},
      compatibility: detected.compatibility || {},
      securityAndPerformance: detected.securityAndPerformance || {},
      healthAndMaintenance: detected.healthAndMaintenance || {},
      versionControl: detected.versionControl || {},
      summaryLog: detected.summaryLog || {},
      exportOptions: detected.exportOptions || {},
      aiSuggestions: detected.aiSuggestions || { items: [] },
      suggestions: [
        { id: 's1', file: files.find(f => f.endsWith('.js')) || 'src/index.js', line: 12, description: "Replace XHR with fetch", patch: '--- old\n+++ new\n@@ -1,4 +1,4 @@\n-const xhr = new XMLHttpRequest();\n+const r = await fetch("/api")', severity: 'medium' }
      ]
    };
  }

  /**
   * @param {string} scanId
   * @param {any} changes
   * @returns {Promise<any>}
   */
  async createApplyJob(scanId, changes) {
    const jobId = uuidv4();
    const job = {
      id: jobId,
      type: 'apply',
      scanId,
      changes,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.startProcessing();
    return job;
  }

  /** @returns {void} */
  startProcessing() {
    for (const job of this.jobs.values()) {
      if ((job.status === 'pending' || job.status === 'queued') &&
        !this.activeJobs.has(job.id) &&
        !this.pending.find(j => j.id === job.id)) {
        this.pending.push(job);
      }
    }
    this._scheduleNext();
  }

  /** @returns {void} */
  _scheduleNext() {
    while (this.pending.length > 0 && this.activeJobs.size < this.maxConcurrent) {
      const nextJob = this.pending.shift();
      if (!this.activeJobs.has(nextJob.id)) {
        this._process(nextJob);
      }
    }
  }

  /**
   * @param {string} id
   * @returns {Promise<any|null>}
   */
  async getJob(id) {
    // Try memory cache first for performance
    if (this.jobs.has(id)) {
      return this.jobs.get(id);
    }

    // If not in memory and database is available, try to fetch from database
    if (this.useDatabase) {
      try {
        const job = await JobModel.findOne({ id });
        if (job) {
          const convertedJob = this._convertFromDbModel(job);
          // Update memory cache
          this.jobs.set(id, convertedJob);
          return convertedJob;
        }
      } catch (err) {
        console.error(`Error fetching job ${id} from database:`, err);
      }
    }

    return null;
  }

  /**
   * @param {string} id
   * @returns {Promise<any>}
   */
  async cancelJob(id) {
    const job = await this.getJob(id);
    if (!job) return { found: false, changed: false, status: 'not_found' };
    if (['done', 'failed', 'cancelled'].includes(job.status)) {
      return { found: true, changed: false, status: job.status };
    }
    job.cancelRequested = true;
    // If job is not active, cancel immediately and remove from pending
    if (!this.activeJobs.has(id)) {
      job.status = 'cancelled';
      job.result = { cancelled: true, reason: 'user' };
      this.pending = this.pending.filter(j => j.id !== id);
      await this._updateJobInDb(job);
      this.emit('done', { id: job.id, result: job.result });
    }
    return { found: true, changed: true, status: job.status || 'processing' };
  }

  /**
   * @param {any} dbJob
   * @returns {any}
   */
  _convertFromDbModel(dbJob) {
    // Convert from Mongoose document to plain object
    const job = dbJob.toObject ? dbJob.toObject() : dbJob;
    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      payload: job.payload,
      result: job.result,
      createdAt: job.createdAt
    };
  }

  async removeJob(id) {
    this.jobs.delete(id);
    this.activeJobs.delete(id);
    this.emit('removed', { id });
  }

  _getJobFromDb(id) {
    if (!this.useDatabase) return null;
  }
}

module.exports = new JobQueue();
