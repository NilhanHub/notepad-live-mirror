Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$bridgePath = Join-Path $repoRoot "bridge\NotepadBridge.ps1"
$artifactDir = Join-Path $repoRoot "artifacts\latest"
$artifactPath = Join-Path $artifactDir "selector-inspection.sanitized.json"

New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

$snapshot = & $bridgePath -Command Inspect | ConvertFrom-Json
$snapshot | ConvertTo-Json -Depth 20 | Set-Content -Path $artifactPath -Encoding UTF8

Write-Host "Selector inspection written to $artifactPath"
