# Usage Examples

## Start a Scan via API
```bash
curl -X POST http://localhost:3001/api/scans \
  -H 'Content-Type: application/json' \
  -d '{"repoUrl":"https://github.com/example/repo","excludePaths":"node_modules,dist"}'
```

## Poll for Result
```bash
curl http://localhost:3001/api/scans/<SCAN_ID>
```

## Read Summary Log
- Field: `result.summaryLog`
- Example:
```json
{
  "duration": "42.387s",
  "filesIgnored": 13,
  "agentVersion": "1.8.0",
  "scanDate": "2025-10-30T12:34:56.789Z",
  "stats": { "filesScanned": 1724, "issuesFound": 12 },
  "resourceUsage": { "memoryRSSMB": 512, "heapUsedMB": 220, "cpuUserMs": 5800, "cpuSystemMs": 1200 },
  "warnings": ["Large binary files skipped"],
  "logs": ["[12:34:12.401Z] Scan started", "[12:34:54.788Z] Scan completed"]
}
```

## Export JSON Report
```bash
curl -L "http://localhost:3001/api/report/download?scanId=<SCAN_ID>" -o scan.json
```

## Export Bundle ZIP
```bash
curl -L "http://localhost:3001/api/report/bundle?scanId=<SCAN_ID>" -o report.zip
```
