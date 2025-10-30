# API Reference

Base URL: `http://localhost:3001/api`

## Scans
- `POST /scans` — Start a scan
  - Body: `{ repoUrl?, localPath?, zipBuffer?, branch?, ref?, excludePaths? }`
  - Response: `{ id, status, progress }`
- `GET /scans/:id` — Get scan result
  - Response: `{ id, status, progress, result }` where `result.summaryLog` is a structured object with `duration`, `filesIgnored`, `agentVersion`, `scanDate`, `stats`, `resourceUsage`, `warnings`, and `logs`.
- `POST /scans/:id/cancel` — Cancel a running scan
- `POST /scans/:id/pull-request` — Create PR
  - Body: `{ title, description, patch }`

## Reports
- `GET /report/download?scanId=...` — JSON report of findings.
- `GET /report/bundle?scanId=...` — ZIP bundle (JSON, CSV, PDF) named after repo.

## GitHub Utilities
- `GET /github/pr/preflight?url=...` or `?owner=...&repo=...`
- `GET /github/user` — Identify authenticated user (requires token).

## Security Checks
- `POST /security/scan` — Run external tools (e.g., Semgrep, Trufflehog) when enabled.

## Status Events
- Socket.io namespace `/` emits `{ id, progress, step }` and `result` payloads for live UI updates.
