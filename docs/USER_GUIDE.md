# User Guide

## Overview
Baseline Repo Checker scans repositories to detect features, architecture, security/performance issues, and compatibility, then presents findings in an interactive UI with export options and AI-assisted suggestions.

## Starting a Scan
- By URL: Enter a repository URL on the Home page and start the scan.
- Local Path: Provide a local path in advanced options.
- ZIP Upload: Upload an archive for offline analysis.

Options:
- Exclude paths (comma/semicolon separated)
- Max file size in MB
- Skip LFS files

## Progress and Logs
- Real-time progress appears at the top.
- Timeline logs persist in local storage and the database.
- Summary Log shows duration, stats, resource usage, and warnings.

## Viewing Results
- Repository Overview: Owner, repo name, activity.
- Environment & Versioning: Languages, frameworks, dependencies.
- Feature Detection: Feature occurrences across files.
- Architecture Analysis: File tree, config presence.
- Compatibility Report: Supported/partial/unsupported features.
- Security & Performance: Vulnerabilities, policy hygiene, bottlenecks.
- Health & Maintenance: Health score, maintainability, contributors.
- AI Suggestions: Diff-like recommendations for modernization and fixes.

## Export & Reports
- Download JSON report (`/api/report/download?scanId=...`).
- Download bundle ZIP (`/api/report/bundle?scanId=...`) named after the repository.
- Export CSV for analytics and compatibility.
- Create PR: Uses GitHub token from Settings; runs preflight checks.

## Persistence
Findings and summary logs persist in MongoDB and can be revisited by reopening the scan.
