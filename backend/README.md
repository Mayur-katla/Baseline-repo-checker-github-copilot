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

## Job Queue & Progress

- In-memory FIFO queue (hackathon mode) in `src/jobs/queue.js`
- Progress steps:
  - Source preparation (name reflects operation: clone, local read, unzip)
  - Analysis (languages, dependencies, features)
  - Compatibility & security checks
  - Suggestions & report build
- Real-time updates via WebSockets (`socket.io`)

## Environment & CORS

- `PORT`: backend server port
- `FRONTEND_URL`: comma-separated allowed origins for CORS
- `MONGODB_URI`: optional persistence

## Testing

- Integration tests via `jest` + `supertest`:
```powershell
npm test
```

## Router Hints Enforcement

Set `ROUTER_ENFORCE=true` to restrict framework detection to the allow list produced by the AI router. Enforcement applies to `environment.primaryFrameworks` and `architecture.frameworks`.

