# Baseline Autopilot - Frontend

Single-page application with route-based views. A responsive header provides navigation links to Home, New Scan, Docs, and Settings.

Local run:

```powershell
cd frontend
npm install
npm run dev
```

Environment:

- `VITE_API_URL` can be set, defaults to `http://localhost:3001/api`.
- Axios client enforces a 15s timeout and provides enriched error metadata for debugging.

Charts:

- All statistical visuals use Chart.js via `react-chartjs-2` (Doughnut and Bar charts).

Docs:
- Docs page component: `src/pages/Docs.jsx`

## Suggestions Polling

- The detail page polls `GET /api/scans/:id/suggestions` until the backend returns `200 OK`.
- While the endpoint returns `202 Accepted`, the UI shows a small "Fetching AI suggestions…" badge.
- If polling times out, a toast appears with an error message.
- Successful responses merge `aiSuggestions` into live state, rendering the `AiSuggestions` panel.

## Scan Detail Page

Key features wired for real-time updates and analysis:

- Live progress bar with socket-driven step/status updates.
- GitHub enrichments for repository overview and health metrics.
- Environment & Versioning, Feature Detection, Architecture Analysis sections.
- Compatibility Report: computed from detected features and config files.
- Security & Performance, Health & Maintenance with merged live and enrichment data.
- Summary Log with persisted progress entries via `localStorage`.
- AI Suggestions / Autopilot: modernization, auto-PR, simplification, removals, auto-fix commands.

Actions:

- Export Options:
  - `PDF`: downloads a Markdown report (`scan-<id>.md`).
  - Other types: downloads a JSON report (`scan-<id>.json`).
- Download Patch: builds a unified diff from the selected or all suggestions (`patch-<id>.diff`).
- Re-scan Modules: starts a new scan for the same repo and navigates to the new detail page.
- Visualize: scrolls to the analytics section.

Analytics Visualization:

- `AnalyticsStatistics`: quick counts of supported, partial, unsupported, suggested.
- `AnalyticsChart`: Doughnut and Bar charts for the same counts.

Compatibility Heuristics:

- Uses `src/resources/feature-mapping.json` for support detection.
- Adds conditional missing configs (e.g., `tsconfig.json`, `eslint.config.js`, `webpack.config.js`).
- Recommendations include `AbortController` adoption and CSP guidance when missing policies are detected.

## Detector Coverage

- Frameworks: Nx, Next.js, SvelteKit, Nuxt, Vue.
- Languages: Python, Java, Go.
- ML: TensorFlow, PyTorch, notebooks, model files.

## Testing

Run unit tests:

```powershell
cd frontend
npm test
```

Implemented tests:

- `src/__tests__/App.test.jsx`: app renders header and routes.
- Additional tests added for utilities and charts.
- `src/__tests__/aggregators.test.js`: compatibility and analytics calculations.
- `src/__tests__/report.test.js`: Markdown report and unified diff generation.
- `src/__tests__/analytics-chart.test.jsx`: chart component renders.