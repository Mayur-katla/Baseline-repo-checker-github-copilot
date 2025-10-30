# Features and Functionality

## Core Analysis
- Project features detection (UI frameworks, testing, API layers, CI/CD)
- Environment and dependencies aggregation
- Architecture hints and configuration fingerprints
- Compatibility classification (supported/partial/unsupported)

## Security & Performance
- Vulnerability summarization (Semgrep JSON parsers)
- Secrets detection (Trufflehog)
- Hygiene checks (policy, configuration)
- IaC misconfigurations

## Health & Maintenance
- Maintainability metrics, bus factor heuristics
- Activity and contributor summaries

## AI Suggestions
- Code modernization and remediation suggestions
- Prioritized recommendations with impact scores

## Reports & Export
- JSON, CSV, Markdown report generation
- Bundle ZIP export named after the repo

## Summary Log
- Structured fields: `duration`, `stats`, `resourceUsage`, `agentVersion`, `scanDate`, `warnings`, `logs`
- Millisecond precision timing and accurate numeric formatting
- Persisted to DB, viewable after termination
