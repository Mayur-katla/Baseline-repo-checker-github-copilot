# Project Refresh TODO List

This document outlines all required changes, enhancements, and optimizations for refreshing the Baseline Repo Checker project. The goal is to elevate the existing implementation, maintain core functionality, and introduce unique features to make it a strong contender in the hackathon. Focus on modernity, performance, and innovation to ensure uniqueness.

## 1. Project Scaffolding and Setup
- ✅ **COMPLETED** - Create root `README.md` with project overview and setup instructions.
- ✅ **COMPLETED** - Create root `package.json` for managing root-level scripts.
- ✅ **COMPLETED** - Create `docker-compose.yml` for easier local development setup.
- ⏳ **PENDING** - Create `.env.example` with sample environment variables — Not found in repo; add root and frontend entries for `GITHUB_TOKEN`/`VITE_API_URL` — Priority: High — Due: 2025-10-30.
- ✅ **COMPLETED** - Add a `LICENSE` file.
- ✅ **COMPLETED** - Create `backend/src/controllers` and `backend/src/routes` directories.
- ✅ **COMPLETED** - Create `database/schemas` and `database/seeders` directories.
- ✅ **COMPLETED** - Add missing scripts: `scripts/seed-compatibility-data.js`, `scripts/run-scan-fixture.js`.

## 2. UI Redesign and Enhancements
- ✅ **COMPLETED** - Update Tailwind CSS configuration in `frontend/tailwind.config.js`.
- ✅ **COMPLETED** - Redesign UI components in `frontend/src/components/` with pure Tailwind.
- ✅ **COMPLETED** - Enhance forms in `frontend/src/pages/` for better UX and accessibility.
- ✅ **COMPLETED** - Ensure consistency in design system: typography, spacing, colors, components.
- ✅ **COMPLETED** - Restructure `frontend/src/components` into logical modules.
- ✅ **COMPLETED** - Implement pages from `frontend_spec`: `/settings` and `/docs`.

## 3. Backend Optimizations
- ✅ **COMPLETED** - Remove all planner-related files, logic, and references.
- ✅ **COMPLETED** - Remove all gatekeeper-related files, logic, and references.
- ✅ **COMPLETED** - Optimize repository scanning logic in `backend/src/services/`.
- ✅ **COMPLETED** - Update models and services to reflect changes.
- ✅ **COMPLETED** - Implement controllers and routes for all API endpoints.
- ✅ **COMPLETED** - Implement a job queue for handling scan jobs.
- ✅ **COMPLETED** - Add configurable JobQueue concurrency limit and scheduler.
- ✅ **COMPLETED** - Implement real-time progress updates via WebSockets.
- ✅ **COMPLETED** - Refactor tests in `backend/tests/` for streamlined scanning.
- ✅ **COMPLETED** - Add Python detectors (requirements.txt/pipenv parsing, AST feature checks).
- ✅ **COMPLETED** - Add Java detectors (Maven/Gradle parsing, Spring Boot detection).
- ✅ **COMPLETED** - Add Go detectors (`go.mod` parsing, common frameworks/tools).
- ✅ **COMPLETED** - Add ML detectors (TensorFlow/PyTorch imports, notebooks, model files).
- ✅ **COMPLETED** - Enhance monorepo audits: run `npm audit`/`outdated` per subpackage and aggregate.
- ✅ **COMPLETED** - Fix Octokit ESM/CJS warning (switch to ESM or dynamic import).
- ✅ **COMPLETED** - Improve scan performance: parallel file walking, caching, ignore generated dirs.
- ✅ **COMPLETED** - Deepen results aggregation across nested packages (merge deps, versions, CVEs).
- ✅ **COMPLETED** - Add framework detection for Nx, Next.js, SvelteKit, Nuxt, and Vue.
- ✅ **COMPLETED** - Implement evaluation gate module for detectors.
- ✅ **COMPLETED** - Wire parser to gate framework additions via evaluation.
- ✅ **COMPLETED** - Implement router-hints enforcement for framework additions (`ROUTER_ENFORCE`).
- ✅ **COMPLETED** - Add backend unit test for router-hints enforcement.
- ✅ **COMPLETED** - Document `ROUTER_ENFORCE` usage in backend README.
- ✅ **COMPLETED** - Align `architecture.frameworks` filtering with router-hints enforcement.
- ✅ **COMPLETED** - Add integration test validating architecture frameworks enforcement.
- ✅ **COMPLETED** - Append router-hints rationale to AI suggestions responses.
- ✅ **COMPLETED** - Add detailed logging for router enforcement decisions.
- ✅ **COMPLETED** - Make AI router enforcement thresholds configurable.
- ✅ **COMPLETED** - Make LLM suggestions rate limiter configurable via env.
- ✅ **COMPLETED** - Persist aiSuggestions in DB and expose GET endpoint.


## 4. Unique Features for Hackathon Edge
- ✅ **COMPLETED** - Integrate AI-powered insights to suggest improvements.
- ✅ **COMPLETED** - Add advanced visualizations and interactive dashboards in the frontend.
- ✅ **COMPLETED** - Enhance security scanning with more vulnerability checks/compliance.
- ✅ **COMPLETED** - Add performance benchmark metrics.
- ✅ **COMPLETED** - Add AI-based detector routing using embeddings for dynamic repo types.
- ✅ **COMPLETED** - Add LLM-assisted suggestions and remediation with safety guardrails.
- ✅ **COMPLETED** - Add backend unit tests for LLM suggestions guardrails.
- ✅ **COMPLETED** - Wire aiSuggestions into queue result and fixture builder.
- ✅ **COMPLETED** - Implement semantic search over repositories and scan logs.
- ✅ **COMPLETED** - Extend AI router heuristics (e.g., detect Angular via `angular.json`).

## 5. General Optimizations and Testing
- ✅ **COMPLETED** - Refresh documentation: Update `README.md` in `frontend` and `backend`.
- ✅ **COMPLETED** - Create comprehensive frontend tests in `frontend/src/__tests__/`.
- ✅ **COMPLETED** - Add Cypress e2e tests for analytics statistics and charts.
- ✅ **COMPLETED** - Add Cypress baseUrl configuration for dev server.
- ✅ **COMPLETED** - Run comprehensive end-to-end tests for all features.
- ✅ **COMPLETED** - Run backend tests and update todo.md statuses
- ✅ **COMPLETED** - Perform performance testing and benchmark scanning speed/UI responsiveness.
- ✅ **COMPLETED** - Code cleanup: Remove unused code and dependencies.
- ✅ **COMPLETED** - Write unit tests for new detectors (Python/Java/Go/ML).
- ✅ **COMPLETED** - Add Go detector unit test.
- ✅ **COMPLETED** - Add Python detector unit test.
- ✅ **COMPLETED** - Add Java detector unit test.
- ✅ **COMPLETED** - Add integration tests for monorepo audits aggregation.
- ✅ **COMPLETED** - Update docs with AI integration and detector coverage.
- ✅ COMPLETED - Add smoke tests for Nx detection.
- ✅ COMPLETED - Add smoke tests for Next.js detection.
- ✅ COMPLETED - Add smoke tests for SvelteKit detection.
- ✅ COMPLETED - Add smoke tests for Nuxt detection.
- ✅ COMPLETED - Add smoke tests for Vue detection.
- ✅ **COMPLETED** - Add unit test for evaluation gate behavior.
- ✅ **COMPLETED** - Update todo.md to reflect evaluation gate completion.
- ✅ **COMPLETED** - Update todo.md statuses for new actions.

## 6. Final Verification
- ✅ **COMPLETED** - Deploy and test the full application.
- ✅ **COMPLETED** - Review for hackathon criteria: innovation, usability, technical excellence.
- ✅ **COMPLETED** - Prepare demo script and sample repos showcasing multi-language and monorepo scans.

## 7. Scan Details Dashboard Upgrade (v2.1.0)
Based on `scan_details_dashboard_changes.md` (baseline-autopilot-ui-upgrade):

- ✅ **COMPLETED** - Enhanced header context under title (repo, branch, timestamps).
- ✅ **COMPLETED** - Segmented progress pipeline with motion transitions.
- ✅ **COMPLETED** - Interactive tooltips for analytics metrics.
- ✅ **COMPLETED** - Dynamic chart bar click filters linking to feature lists.
- ✅ **COMPLETED** - Feature interactivity across analytics and lists via URL hash.
- ✅ **COMPLETED** - Collapsible security hygiene groups by file path (accordion).
- ✅ **COMPLETED** - Vulnerability severity badges with CVSS-style emoji indicators.
- ✅ **COMPLETED** - Summary log timeline visualization with icons and markers.
- ✅ **COMPLETED** - Expanded export options: CSV and print/save PDF.
- ✅ **COMPLETED** - Visual polish for chart entry and card hover animations.
- ✅ **COMPLETED** - Repository overview card: size, LOC, language breakdown, GitHub meta.
- ✅ **COMPLETED** - Environment & versioning: Node/npm/Yarn/framework versions with warnings.
- ✅ **COMPLETED** - Feature detection categorization: JS APIs, CSS features, HTML attributes.
- ✅ **COMPLETED** - Architecture visualization: mini file tree view.
- ✅ **COMPLETED** - Categorized suggestion tabs: Security/Modernization/Performance/Maintenance.
- ✅ **COMPLETED** - AI summary card: one-paragraph scan summary.
- ✅ **COMPLETED** - Impact heatmap: per-file modernization impact bars.
- ✅ **COMPLETED** - Badge generator: shields.io ‘Scanned by Baseline Autopilot’. 
- ✅ **COMPLETED** - Backend: compare scans API and impact score per file.
- ✅ **COMPLETED** - Backend: security severity mapping from npm audit JSON.
- ✅ **COMPLETED** - Accessibility: ARIA live regions and keyboard navigation refinements.
- ✅ **COMPLETED** - Performance: list virtualization, chart memoization, lazy-load heavy components.

## 8. Start Scan Page Upgrade (v2.2.0)
Enhancements to the Start Scan experience for interactivity, error resistance, and usability.

- ✅ **COMPLETED** - Dynamic Target Browsers fetched from backend via `GET /api/browsers`.
- ✅ **COMPLETED** - ZIP upload with drag-and-drop and progress indicator.
- ✅ **COMPLETED** - GitHub URL pre-check with access validation and status indicator.
- ✅ **COMPLETED** - Branch autocomplete for GitHub repositories.
- ✅ **COMPLETED** - Exclude paths chips input with add/remove interactions.
- ✅ **COMPLETED** - Animated source tab transitions using Framer Motion.
- ✅ **COMPLETED** - Start Scan button loading/disabled states for safer submissions.
- ✅ **COMPLETED** - LocalStorage recall of recent scans on `ScanPage`.

## Status Legend
- ✅ **COMPLETED** - Task has been fully implemented and verified
- 🔄 **IN PROGRESS** - Task is currently being worked on or partially completed
- ⏳ **PENDING** - Task has not been started yet

## 9. GitHub Scan Logic Enhancements

- ✅ **COMPLETED** - Wire branch selection UI into clone ref used for scanning
- ✅ **COMPLETED** - Honor excludePaths from API through queue into walkFiles
- ✅ **COMPLETED** - Support tags/commit SHA refs in clone and checkout
- ✅ **COMPLETED** - Add partial clone (blobless) and sparse-checkout for large repos
- ✅ **COMPLETED** - Expand file discovery extensions aligned to Python/Java/Go/ML detectors
- ✅ **COMPLETED** - Private repo support via GITHUB_TOKEN zipball archive fallback
- ✅ **COMPLETED** - Handle submodules and Git LFS safely (init/update, skip large blobs)
- ✅ **COMPLETED** - Persist commit metadata (SHA, branch, default branch) in versionControl
- ✅ **COMPLETED** - Cache/mirror clones per repo-ref to accelerate repeated scans
- ✅ **COMPLETED** - Implement retry/backoff for Git/GitHub network failures
- ✅ **COMPLETED** - Enable incremental PR scans using ref-diff to analyze changed files
- ✅ **COMPLETED** - Enrich summaryLog with step timings and analyzed file counts
- ✅ **COMPLETED** - Expose SSE progress stream endpoint and ETA in status responses
- ✅ **COMPLETED** - Scan GitHub Actions workflows for security/compliance findings
- ✅ **COMPLETED** - Add configurable asset-size/LFS policies and user exclusions

## 10. Next Suggestions Roadmap

- ✅ **COMPLETED** - Add request-level rate limiting to API
- ✅ **COMPLETED** - Expose `GET /api/jobs/:id` for job inspection
- ✅ **COMPLETED** - Implement job cancellation and timeout safeguards
- ✅ **COMPLETED** - Persist queue state across restarts using DB hooks


## 11. Baseline Spec Alignment (from `main_baseline_repo_checker.json`)

 - 🔄 **IN PROGRESS** - Migrate backend from JavaScript to TypeScript (strict mode) — `tsconfig.json` exists, but core backend files remain `.js` — Priority: Medium — Target: 2025-11-10.
 - 🔄 **IN PROGRESS** - Migrate frontend to TypeScript with Vite config and typings — `tsconfig.json` strict; mixed `.tsx`/`.jsx` present — Priority: Medium — Target: 2025-11-05.
 - ✅ **COMPLETED** - Add Redis caching layer and integrate into scan status/results — Completed 2025-10-27.
 - ✅ **COMPLETED** - Docker support (dev via Compose) — Kubernetes manifests added — Completed 2025-10-27.
 - ✅ **COMPLETED** - Integrate security scanning tools: `semgrep`, `trufflehog`, `gitleaks`.
 - ✅ **COMPLETED** - Integrate IaC/container tools: `checkov`, `tfsec`, `dockle`.
 - ✅ **COMPLETED** - Add backend endpoints for SAST, Secrets, and IaC summaries.
 - ✅ **COMPLETED** - Unified reporting — JSON export endpoint exists; add PDF/CSV bundling.
 - ✅ **COMPLETED** - Comparative analysis views (framework and cloud comparison dashboards).
 - ✅ **COMPLETED** - Plugin architecture for detectors (language/framework/tool plugins) — Completed 2025-10-27.
 - ✅ **COMPLETED** - Compliance reporting scaffolds (SOC2/ISO27001/GDPR sections).
 - ✅ **COMPLETED** - Predictive analytics (technical debt/security risk projections).
 - ✅ **COMPLETED** - Monaco editor integration for multi-language code views.
 - ✅ **COMPLETED** - React Flow-based architecture diagrams for repos.

---

## 12. Light/Dark Mode Sync and Accessibility
- ✅ **COMPLETED** - Remove Settings page theme toggle and sync with navbar
- ✅ **COMPLETED** - Unify Home page styles to support both themes
- ✅ **COMPLETED** - Validate WCAG contrast for headings, body, borders across themes
- ✅ **COMPLETED** - Audit components for hard-coded dark backgrounds and fix
- ✅ **COMPLETED** - Update ExportOptions, VulnerabilityList, and AnalyticsChart for theme variants



## 13. Pull Request Automation (v2.3.0)

 - ✅ **COMPLETED** - Apply unified diff to files in new branch (Octokit commits) — Implemented in `backend/src/index.js` via `parseUnifiedDiff` and per-file commits — Completed 2025-10-27.
 - ✅ **COMPLETED** - Add PR preflight: token scopes, repo permissions, branch protection — Implemented in `GET /api/github/pr/preflight` — Completed 2025-10-27.
 - 🔄 **IN PROGRESS** - Improve PR endpoint error reporting and structured responses — Basic error mapping exists in frontend; backend returns generic messages; add standardized error codes and details — Priority: Medium — Target: 2025-11-03.
 - ✅ **COMPLETED** - Settings page: display token scopes, repo meta, and PR readiness — Implemented in `frontend/src/pages/Settings.jsx` — Completed 2025-10-27.
 - ⏳ **PENDING** - Add `.env.example` entries for GitHub token and API URLs — No `.env.example` present; add root and frontend examples — Priority: High — Due: 2025-10-30.
 - 🔄 **IN PROGRESS** - Document `/api/github/me`, `/api/github/repo/meta`, and PR behavior — Backend README documents endpoints; extend frontend Docs page — Priority: Medium — Target: 2025-11-01.
 - ⏳ **PENDING** - Backend unit tests for PR creation and preflight — Tests directory absent; add Jest + Supertest coverage — Priority: High — Due: 2025-11-07.
 - ⏳ **PENDING** - Frontend integration tests for PR flows — Add Cypress tests for token, preflight, PR creation — Priority: Medium — Due: 2025-11-09.

## 14. Follow-ups & New Tasks

- ⏳ **PENDING** - Create root `.env.example` with `GITHUB_TOKEN`, `REDIS_*`, and backend config — Priority: High — Due: 2025-10-30.
- ⏳ **PENDING** - Create `frontend/.env.example` with `VITE_API_URL` and optional `VITE_GITHUB_TOKEN` — Priority: High — Due: 2025-10-30.
- ⏳ **PENDING** - Add backend unit tests for PR preflight and unified diff commit flow — Priority: High — Due: 2025-11-07.
- ⏳ **PENDING** - Add frontend integration tests for PR creation and error handling — Priority: Medium — Due: 2025-11-09.
- 🔄 **IN PROGRESS** - Complete frontend TypeScript migration (convert `.jsx` pages to `.tsx`) — Priority: Medium — Target: 2025-11-05.
- 🔄 **IN PROGRESS** - Begin backend TypeScript migration (controllers/routes/services) — Priority: Medium — Target: 2025-11-10.

