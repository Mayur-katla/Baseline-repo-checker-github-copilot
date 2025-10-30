# Setup and Configuration

## Prerequisites
- Node.js 18+
- npm 9+
- MongoDB (local or Docker)
- Optional: Redis (if enabling background queues), Docker, Kubernetes

## Environment Variables
Backend (`backend/.env` or environment):
- `PORT` — Backend HTTP port (default `3001`)
- `FRONTEND_URL` — Frontend origin for CORS (e.g., `http://localhost:5173`)
- `MONGODB_URI` — MongoDB connection string (e.g., `mongodb://localhost:27017/baseline-autopilot`)
- `REDIS_URL` — Redis connection string (optional)
- `NODE_ENV` — `development` or `production`
- `SCAN_TIMEOUT_MS` — Optional cancellation timeout in ms
- `SCAN_MAX_FILE_MB` — Optional per-file size cap in MB
- `SCAN_SKIP_LFS` — `true` to skip Git LFS files during walk
- `SCAN_USER_EXCLUDE_PATHS` — Comma/semicolon-separated paths to exclude (e.g., `node_modules,dist`)

Frontend (`frontend/.env` or environment):
- `VITE_API_URL` — Backend API base (default `http://localhost:3001/api`)
- `VITE_GITHUB_TOKEN` — Optional GitHub token for PR features

## Local Development
- Backend: `cd backend && npm install && npm run dev`
- Frontend: `cd frontend && npm install && npm run dev`

## Docker Compose
- `docker-compose up --build`
- Services: `frontend:5173`, `backend:3001`, `mongo:27017`

## Kubernetes (optional)
- Manifests in `k8s/` for dev clusters; adjust `FRONTEND_URL` and service names as needed.

## Persistence
- Scan results, including `summaryLog`, persist to MongoDB via `ScanModel`. Logs can be revisited after process termination.
