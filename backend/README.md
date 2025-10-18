# Baseline Autopilot - Backend

This backend provides a simple API to scan code repositories and retrieve the results.

Run locally:

```powershell
cd backend
npm install
npm run dev
```

API endpoints:
- POST /api/scans -> { scanId, status }
- GET /api/scans/:id/status -> { scanId, status, progress }
- GET /api/scans/:id/result -> full result (when done)
- GET /api/scans/:id/suggestions -> { aiSuggestions } (200 when available; 202 if in progress)

Notes:
- Default server port is `3001` (configurable via `.env`).
- The backend uses a simple in-memory queue for processing scans.
- The frontend polls the status endpoint until the scan is complete.
- WebSockets are used for real-time progress updates.
- Suggestions endpoint prefers DB-persisted results, falling back to job cache.

Testing:
- `jest` and `supertest` are used for integration tests.

## Router Hints Enforcement

Set `ROUTER_ENFORCE=true` to restrict framework detection to the allow list produced by the AI router (`environment.detectorPlan.allowFrameworks`). When enabled, the parser only adds frameworks present in this allow list.

Examples (PowerShell):
- `$env:ROUTER_ENFORCE='true'; npm run dev`
- `$env:ROUTER_ENFORCE='true'; npm test`

Notes:
- The allow list and ranks are computed by `src/services/aiRouter.js`.
- Enforcement applies to `environment.primaryFrameworks` and `architecture.frameworks` via `enforceRouterAllowList`.
- See `tests/detectors/router_enforcement.test.js` and `tests/detectors/router_arch_enforcement.test.js` for coverage.

Router thresholds:
- `ROUTER_FW_THRESHOLD_PCT` — fraction of top framework score to allow (default `0.5`).
- `ROUTER_LANG_THRESHOLD_PCT` — fraction of top language score to allow (default `0.5`).

Examples (PowerShell):
- `$env:ROUTER_ENFORCE='true'; $env:ROUTER_FW_THRESHOLD_PCT='0.7'; $env:ROUTER_LANG_THRESHOLD_PCT='0.3'; npm test`

## LLM Suggestions Guardrails & Config

The suggestions service applies guardrails and supports environment-based configuration:

Env flags:
- `LLM_SUGGESTIONS_RATE_CAPACITY` — max suggestions generations per window (default `10`).
- `LLM_SUGGESTIONS_RATE_REFILL_MS` — window duration in ms (default `60000`).
- `LLM_SUGGESTIONS_RATE_DISABLE` — when `true`, bypasses rate limiting.
- `LLM_SUGGESTIONS_DISABLE` — when `true`, disables suggestion generation entirely.

Guardrails:
- Secrets redaction from inputs.
- Unsafe content filtering (e.g., exfiltration, dangerous shell commands).
- Rate limiting to avoid overload.

Examples (PowerShell):
- `$env:LLM_SUGGESTIONS_RATE_CAPACITY='20'; $env:LLM_SUGGESTIONS_RATE_REFILL_MS='30000'; npm test`
- `$env:LLM_SUGGESTIONS_RATE_DISABLE='true'; npm run dev`
- `$env:LLM_SUGGESTIONS_DISABLE='true'; npm run dev`

See:
- `src/services/llmSuggestions.js` for implementation.
- `tests/services/llmSuggestions_guardrails.test.js` for coverage.

