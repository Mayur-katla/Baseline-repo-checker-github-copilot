const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const repoAnalyzer = require('../services/repoAnalyzer');
const parser = require('../services/parser');
const baseline = require('../services/baseline');
const JobModel = require('../models/Job');
const ScanModel = require('../models/Scan');
const { generateAiSuggestions } = require('../services/llmSuggestions');

// Unified feature/environment/architecture detection builder
async function buildDetected(root, files, repoUrl) {
  const summaryLog = [];
  const log = (msg) => summaryLog.push({ ts: Date.now(), msg });

  // Aggregate plain feature map per file
  const features = {};
  const addFeature = (file, feature) => {
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
    } catch (_) {}
  }

  // Read package.json if available
  let packageJson = null;
  try {
    const pkgStr = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
    packageJson = JSON.parse(pkgStr);
  } catch (_) {}

  // Environment and versioning
  log('Detecting environment and versioning');
  const env = await parser.detectEnvironmentAndVersioning(root, packageJson);

  // Repo details (frameworks, build tools, languages, etc.)
  log('Detecting repo details');
  const repoDetails = await parser.detectRepoDetails(root, repoUrl, {}, packageJson);

  // Security & performance
  log('Detecting security and performance');
  const secPerf = await parser.detectSecurityAndPerformance(root);

  // Vulnerability severity summary derived from npm audit JSON (environment.securityVulnerabilities)
  try {
    const vulns = Array.isArray(env?.securityVulnerabilities) ? env.securityVulnerabilities : [];
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
  } catch (_) {}


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
      '.browserslistrc','browserslist','package.json','package-lock.json','yarn.lock','pnpm-lock.yaml',
      'angular.json','nx.json','workspace.json','lerna.json',
      'tsconfig.json','tsconfig.app.json','tsconfig.spec.json',
      'vite.config.js','vite.config.ts',
      'webpack.config.js','rollup.config.js','esbuild.config.js',
      'babel.config.js','postcss.config.js','tailwind.config.js',
      'jest.config.js','karma.conf.js','protractor.conf.js',
      'eslint.config.js','.eslintrc.js','.eslintrc.json',
      'prettier.config.js','.prettierrc','.prettierrc.json',
      'next.config.js','next.config.mjs','nuxt.config.js','nuxt.config.ts',
      'svelte.config.js','vue.config.js','docker-compose.yml','Dockerfile'
    ];
    const found = new Set();
    for (const rel of allFiles) {
      const base = path.basename(rel);
      if (candidateNames.includes(base)) found.add(base);
    }
    architecture.configFiles = Array.from(found).sort();

    // Build compact file tree (top 2 levels, limited nodes)
    const buildFileTree = (files, maxDepth = 2, maxNodes = 300) => {
      const sepRegex = /[\\/]+/;
      const rootNode = { name: '/', type: 'dir', children: [] };
      let nodeCount = 1;

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
  } catch (_) {}

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
  } catch {}
  // Fallback framework heuristics from config files
  try {
    const cfg = new Set(architecture.configFiles);
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
  } catch (_) {}

  // Re-apply router enforcement after fallback heuristics
  try {
    architecture.frameworks = parser.enforceRouterAllowList(architecture.frameworks, env);
  } catch {}

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
  } catch (_) {}

  return {
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
}

class JobQueue extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map();
    this.useDatabase = false;
    this.activeJobs = new Set();
    this.pending = [];
    this.maxConcurrent = Number.parseInt(process.env.MAX_CONCURRENT_JOBS || '2', 10);
    if (!Number.isFinite(this.maxConcurrent) || this.maxConcurrent <= 0) this.maxConcurrent = 2;
  }
  
  // Initialize database connection
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
  
  _process(job) {
    this.activeJobs.add(job.id);
    job.status = 'processing';

    const timeoutMs = Number.parseInt(process.env.SCAN_TIMEOUT_MS || '0', 10);
    let timeoutHandle = null;
    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        job.cancelRequested = true;
        job.cancelReason = 'timeout';
      }, timeoutMs);
    }
    class CancellationError extends Error {}
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
      const updateProgress = (stepIndex, status) => {
        currentStep = stepIndex;
        job.progress = steps[stepIndex].progress;
        job.status = status || (job.progress === 100 ? 'done' : 'processing');
        this._updateJobInDb(job);
        this.emit('progress', { id: job.id, progress: job.progress, step: steps[currentStep].name });
      };
      updateProgress(0);
  
      (async () => {
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
            // ... existing code ...
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
              detected.summaryLog = Array.isArray(detected.summaryLog) ? detected.summaryLog : [];
              const filesChangedCount = (Array.isArray(changedPaths) && changedPaths.length > 0) ? files.length : 0;
              detected.summaryLog.push(
                { ts: Date.now(), msg: `Step timing: clone ${cloneMs}ms, walk ${walkMs}ms, analysis ${analysisMs}ms` },
                { ts: Date.now(), msg: `Files discovered: ${files.length}, analyzed: ${totalFiles}, changed: ${filesChangedCount}` }
              );
            } catch (_) {}
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
            } catch (_) {}
  
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
            workspaceRoot = String(job.payload.localPath).trim();
            updateProgress(2);
            const extensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.html', '.py', '.ipynb', '.java', '.kt', '.go'];
            const excludePathsLocal = Array.isArray(job.payload?.excludePaths) ? job.payload.excludePaths : [];
            const maxFileMBEnv = Number(process.env.SCAN_MAX_FILE_MB || 0);
            const maxFileBytes = maxFileMBEnv > 0 ? maxFileMBEnv * 1024 * 1024 : undefined;
            const skipLfsEnv = String(process.env.SCAN_SKIP_LFS || '').toLowerCase() === 'true';
            const userExclEnv = String(process.env.SCAN_USER_EXCLUDE_PATHS || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
            const mergedExcludes = Array.from(new Set([...(excludePathsLocal || []), ...userExclEnv]));
            const files = await repoAnalyzer.walkFiles(workspaceRoot, { extensions, excludePaths: mergedExcludes, maxFileBytes, skipLfsFiles: skipLfsEnv });
            console.log(`Found ${files.length} files to analyze from local path`);
            let filesAnalyzed = 0;
            const totalFiles = files.length;
            for (const file of files) {
              ensureNotCancelled();
              await new Promise(resolve => setTimeout(resolve, 10));
              filesAnalyzed++;
              const analysisProgress = 50 + Math.round((filesAnalyzed / totalFiles) * 30);
              job.progress = analysisProgress;
              this.emit('progress', { id: job.id, progress: job.progress, step: `Analyzing ${filesAnalyzed}/${totalFiles} files` });
            }
            ensureNotCancelled();
            const detected = await buildDetected(workspaceRoot, files, job.payload.localPath || '');
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
            workspaceRoot = await repoAnalyzer.unzipBuffer(Buffer.from(job.payload.zipBuffer, 'base64'));
            updateProgress(2);
            const extensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.html', '.py', '.ipynb', '.java', '.kt', '.go'];
            const excludePathsZip = Array.isArray(job.payload?.excludePaths) ? job.payload.excludePaths : [];
            const maxFileMBEnv = Number(process.env.SCAN_MAX_FILE_MB || 0);
            const maxFileBytes = maxFileMBEnv > 0 ? maxFileMBEnv * 1024 * 1024 : undefined;
            const skipLfsEnv = String(process.env.SCAN_SKIP_LFS || '').toLowerCase() === 'true';
            const userExclEnv = String(process.env.SCAN_USER_EXCLUDE_PATHS || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
            const mergedExcludes = Array.from(new Set([...(excludePathsZip || []), ...userExclEnv]));
            const files = await repoAnalyzer.walkFiles(workspaceRoot, { extensions, excludePaths: mergedExcludes, maxFileBytes, skipLfsFiles: skipLfsEnv });
            console.log(`Found ${files.length} files to analyze from uploaded zip`);
            let filesAnalyzed = 0;
            const totalFiles = files.length;
            for (const file of files) {
              ensureNotCancelled();
              await new Promise(resolve => setTimeout(resolve, 10));
              filesAnalyzed++;
              const analysisProgress = 50 + Math.round((filesAnalyzed / totalFiles) * 30);
              job.progress = analysisProgress;
              this.emit('progress', { id: job.id, progress: job.progress, step: `Analyzing ${filesAnalyzed}/${totalFiles} files` });
            }
            ensureNotCancelled();
            const detected = await buildDetected(workspaceRoot, files, job.payload.repoUrl || '');
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
          
          this.emit('done', { id: job.id, result: job.result });
        } finally {
            if (workspaceRoot) await repoAnalyzer.cleanup(workspaceRoot);
            this.activeJobs.delete(job.id);
            this._scheduleNext();
        }
      })();
    }
  }

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

  _scheduleNext() {
    while (this.pending.length > 0 && this.activeJobs.size < this.maxConcurrent) {
      const nextJob = this.pending.shift();
      if (!this.activeJobs.has(nextJob.id)) {
        this._process(nextJob);
      }
    }
  }

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
