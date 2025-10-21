# Baseline Autopilot - Backend

Express API for starting repository scans, tracking progress, and retrieving results.

## Run Locally

```powershell
cd backend
npm install
npm run dev
```

Default port: `3001` (configurable via `.env` or environment).

## API Endpoints

- `POST /api/scans` → `{ scanId, status }`
- `GET /api/scans/:id/status` → `{ scanId, status, progress, logs }`
- `GET /api/scans/:id/result` → full report (once done)
- `POST /api/scans/:id/apply` → `{ action: 'download' | 'create_pr' }`

### Request Contract & Validation

`POST /api/scans` accepts different inputs, validated via `express-validator` in `src/routes/scans.js`:

- `inputType` required: `github | local | url | zip`
- When `github` or `url`: `repoUrl` must be a valid `http(s)` URL
- When `local`: `localPath` must be an absolute path (Windows or POSIX)
- When `zip`: `zipBuffer` must be base64 (frontend enforces ~12MB upload)
- `targetBrowsers`: non-empty array of browser identifiers

Invalid inputs return `400 Bad Request` with an `errors` array.

## Job Queue & Concurrency

- In-memory FIFO queue in `src/jobs/queue.js` with a scheduler enforcing a configurable concurrency limit.
- Concurrency limit: set `MAX_CONCURRENT_JOBS` (env), default `2`. The scheduler starts pending jobs when active jobs drop below the limit.
- Job lifecycle: statuses `queued`, `processing`, `done`, `failed`; `progress` emitted via `progress` events and stored when DB is enabled.
- Sources: `repoUrl`, `localPath`, or `zipBuffer` determine the preparation step shown.
- Shutdown: `queue.shutdown()` waits for `activeJobs` to reach `0` before resolving.
- Persistence: if `MONGODB_URI` is configured and initialized, jobs and scans are persisted.
- Tests: `tests/jobs/queue_concurrency.test.js` validates the concurrency limit.

## Environment & CORS

- `PORT`: backend server port
- `FRONTEND_URL`: comma-separated allowed origins for CORS
- `MONGODB_URI`: optional persistence

## Testing

- Integration tests via `jest` + `supertest`:
```powershell
npm test
```

## CI Workflow Scanning

Scans `.github/workflows/*.yml` for common security/compliance issues. Findings are included under `securityAndPerformance.ciWorkflows` and summarized in `securityAndPerformance.ciSummary`.

Checks:
- `pull_request_target` usage (High): elevated permissions on PRs from forks; prefer `pull_request`.
- Unpinned `uses:` actions (Medium): not pinned to commit SHA.
- Missing `permissions:` (Medium): define explicit token permissions at workflow/job level.
- `runs-on: self-hosted` (Medium): ensure trusted/hardened self-hosted runners.
- `actions/checkout` without `persist-credentials: false` (Medium): disable credential persistence.

The scanner is implemented in `src/services/ciScanner.js` and integrated into overall security analysis.

## Router Hints Enforcement

Set `ROUTER_ENFORCE=true` to restrict framework detection to the allow list produced by the AI router. Enforcement applies to `environment.primaryFrameworks` and `architecture.frameworks`.

