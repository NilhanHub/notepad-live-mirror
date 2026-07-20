Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
  npx tsx backend/src/cli/realUserSmoke.ts
}
finally {
  Pop-Location
}
