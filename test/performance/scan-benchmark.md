# Scan Benchmark Results

Date: 2025-10-18
Command: `node scripts/run-scan-fixture.js`
Environment: Windows PowerShell 5, local dev servers running.

Result (Measure-Command):
- TotalMilliseconds: 115.487
- TotalSeconds: 0.115487
- Ticks: 1,154,870
- Minutes: 0
- Seconds: 0
- Milliseconds: 115

Notes:
- Single run via PowerShell `Measure-Command`; results vary with repo size and system load.
- For more stable averages, run 3–5 iterations and compute mean/median.