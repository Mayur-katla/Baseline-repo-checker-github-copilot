# Baseline Autopilot

AI-assisted repository analysis and modernization toolkit.

Scan any codebase to report languages, dependencies, features, security issues, and browser compatibility, with actionable upgrade suggestions and unified diff patches.

## Quick Start

- Docker Compose:
  ```sh
  docker-compose up --build
  ```
  - Frontend: `http://localhost:5173` (auto-increments if busy)
  - Backend: `http://localhost:3001`

- Local Dev:
  ```powershell
  cd frontend && npm install && npm run dev
  cd ../backend && npm install && npm run dev
  ```

## Scan Submission & Validation

- Input types: `github | local | url | zip`
- Required fields:
  - `inputType` — one of the above
  - `repoUrl` — valid `http(s)` when `inputType` is `github` or `url`
  - `localPath` — absolute path when `inputType` is `local` (Windows or POSIX)
  - `zipBuffer` — base64 string when `inputType` is `zip` (frontend enforces 12MB)
  - `targetBrowsers` — non-empty array of browser ids

Frontend enforces client-side validation in `RepoInputForm`. Backend uses `express-validator` in `/api/scans` route.

## API Endpoints

- `POST /api/scans` → `{ scanId, status }`
- `GET /api/scans/:id/status` → `{ scanId, status, progress, logs }`
- `GET /api/scans/:id/result` → full analysis report and suggestions
- `POST /api/scans/:id/apply` → `{ action: 'download' | 'create_pr' }`

Example request:
```json
{
  "inputType": "github",
  "repoUrl": "https://github.com/org/repo",
  "localPath": "",
  "zipBuffer": "",
  "targetBrowsers": ["chrome", "firefox", "safari", "edge"]
}
```

## Architecture

- Express API + in-memory FIFO job queue (hackathon mode)
- Real-time progress over WebSockets; step names reflect source operation (clone, local read, unzip)
- Analysis tools: `@babel/parser`, `@babel/traverse`, `postcss`, `css-tree`, `htmlparser2`, `es-module-lexer`
- Repo ops: `simple-git`, `multer`, `jszip`; logging via `winston`

## Environment

- Frontend: `VITE_API_URL` (default `http://localhost:3001/api`)
- Backend: `PORT`, `FRONTEND_URL`, `MONGODB_URI`, `CACHE_MAX_MB`, `CACHE_TTL_DAYS`
- See `docker-compose.yml` for defaults

## Pull Requests & GitHub Token

Create a PR directly from the Scan Detail page. The system needs a GitHub token to authenticate against the repository:

- Frontend (recommended): Open `Settings` and paste a Personal Access Token (PAT) into `GitHub Token`. This token is stored in your browser (`localStorage`) and automatically sent as a `Bearer` token on PR creation.
  - Classic PAT: grant `repo` scope.
  - Fine‑grained PAT: grant `Contents: Read & Write` and `Pull requests: Read & Write` on the target repo.
- Frontend (optional): Set `VITE_GITHUB_TOKEN` to enable GitHub API calls used for repo overview checks.
- Backend: Accepts tokens via `Authorization: Bearer <token>` header, or `token` in the request body. If neither is provided, it falls back to `process.env.GITHUB_TOKEN`.

Notes:
- A new branch named `baseline-modernization-<scanId>` is created off the default branch. The generated unified diff is committed as `patches/<scanId>.diff`, and a Pull Request is opened.
- Ensure the token has write permissions on the target repository (org/private repos may require elevated access).

## Documentation & Roadmap

- In-app docs: navigate to `/docs` for Getting Started, API, validation, architecture, security, accessibility, performance, and roadmap.
- Project spec and todos are tracked in `main_baseline_repo_checker.json`.

## Testing

- Frontend (Vitest):
  ```powershell
  cd frontend
  npm test
  ```
- Backend (Jest):
  ```powershell
  cd backend
  npm test
  ```

## Features

- Live progress, actionable suggestions, unified diff patches
- Detector coverage: Nx, Next.js, SvelteKit, Nuxt, Vue, Python, Java, Go, ML
- Compatibility and security insights; exportable reports