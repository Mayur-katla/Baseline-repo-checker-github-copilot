Param(
    [string]$Repo = 'https://github.com/Mayur-katla/Crowd-Funding',
    [string[]]$Browsers = @('chrome','firefox','safari','edge'),
    [string]$Api = 'http://localhost:3003'
)

# Compose JSON body
$bodyObject = @{
    inputType = 'github'
    repoUrl = $Repo
    localPath = $null
    targetBrowsers = $Browsers
}
$json = $bodyObject | ConvertTo-Json -Depth 5

Write-Host "Posting new scan request..."
$resp = Invoke-RestMethod -Uri "$Api/api/scans" -Method Post -ContentType 'application/json' -Body $json
$id = $resp.scanId
if (-not $id) { $id = $resp.id }
Write-Host "NewScanId=$id"

Write-Host "Polling scan status..."
for ($i=0; $i -lt 120; $i++) {
    try {
        $s = Invoke-RestMethod -Uri "$Api/api/scans/$id/status" -TimeoutSec 30
        Write-Host "Status=$($s.status) Progress=$($s.progress)"
        if ($s.status -eq 'done' -or $s.status -eq 'failed') { break }
    } catch {
        Write-Host "Status=unknown Progress=? (poll error: $($_.Exception.Message))"
    }
    Start-Sleep -Seconds 2
}

Write-Host "Downloading full scan document..."
Invoke-RestMethod -Uri "$Api/api/scans/$id" -OutFile "scan-$id.json"
Write-Host "Saved scan to scan-$id.json"

try {
    Get-Content "scan-$id.json" | ConvertFrom-Json | ConvertTo-Json -Depth 12 > "scan-$id.pretty.json"
    Write-Host "Saved pretty scan to scan-$id.pretty.json"
} catch {
    Write-Warning "Pretty print failed: $($_.Exception.Message)"
}