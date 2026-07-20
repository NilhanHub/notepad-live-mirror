Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
  npx tsx backend/src/cli/inspectNotepad.ts
}
finally {
  Pop-Location
}
