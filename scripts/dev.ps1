Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Net.Http

$repoRoot = Split-Path -Parent $PSScriptRoot
$bridgePath = Join-Path $repoRoot "bridge\NotepadBridge.ps1"
$latestDir = Join-Path $repoRoot "artifacts\latest"
$launcherStatusPath = Join-Path $latestDir "launcher-status.json"

function Get-FreePort {
  param(
    [int]$PreferredPort
  )

  for ($port = $PreferredPort; $port -lt ($PreferredPort + 50); $port++) {
    try {
      $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
      $listener.Start()
      $listener.Stop()
      return $port
    }
    catch {
    }
  }

  throw "No free localhost port was found near $PreferredPort."
}

function Invoke-BridgeInventory {
  return (& $bridgePath -Command Inventory | ConvertFrom-Json)
}

function Get-HealthResponse {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $handler = [System.Net.Http.HttpClientHandler]::new()
  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromMilliseconds(250)

  try {
    $json = $client.GetStringAsync("http://127.0.0.1:$Port/api/health").GetAwaiter().GetResult()
    return $json | ConvertFrom-Json
  }
  catch {
    return $null
  }
  finally {
    $client.Dispose()
    $handler.Dispose()
  }
}

function Find-HealthyApp {
  for ($port = 43117; $port -lt 43167; $port++) {
    $response = Get-HealthResponse -Port $port
    if ($response -and $response.ok -eq $true) {
      return [pscustomobject]@{
        port = [int]$response.actualPort
        url = "http://127.0.0.1:$($response.actualPort)"
        response = $response
      }
    }
  }

  return $null
}

function Wait-ForHealth {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
      $response = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 1
      if ($response.ok -eq $true) {
        return [pscustomobject]@{
          port = [int]$response.actualPort
          url = "http://127.0.0.1:$($response.actualPort)"
          response = $response
        }
      }
    }
    catch {
    }

    Start-Sleep -Milliseconds 500
  }

  throw "The local app did not become healthy on http://127.0.0.1:$Port in time."
}

Push-Location $repoRoot

try {
  New-Item -ItemType Directory -Force -Path $latestDir | Out-Null
  $inventoryBefore = Invoke-BridgeInventory

  if (-not (Test-Path (Join-Path $repoRoot "node_modules"))) {
    npm install
  }

  npm run build

  $healthy = Find-HealthyApp
  $startedNewServer = $false

  if (-not $healthy) {
    $port = Get-FreePort -PreferredPort 43117
    $command = "`$env:PORT='$port'; Set-Location '$repoRoot'; npm start"

    Start-Process powershell.exe -WorkingDirectory $repoRoot -ArgumentList @(
      "-NoExit",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      $command
    ) | Out-Null

    $healthy = Wait-ForHealth -Port $port
    $startedNewServer = $true
  }

  Start-Process $healthy.url | Out-Null
  $inventoryAfter = Invoke-BridgeInventory

  $processDelta = [int]$inventoryAfter.inventory.processCount - [int]$inventoryBefore.inventory.processCount
  $windowDelta = [int]$inventoryAfter.inventory.windowCount - [int]$inventoryBefore.inventory.windowCount

  $status = [ordered]@{
    launchedAt = (Get-Date).ToString("o")
    targetUrl = $healthy.url
    actualPort = [int]$healthy.port
    startedNewServer = $startedNewServer
    notepadProcessCountBefore = [int]$inventoryBefore.inventory.processCount
    notepadProcessCountAfter = [int]$inventoryAfter.inventory.processCount
    notepadWindowCountBefore = [int]$inventoryBefore.inventory.windowCount
    notepadWindowCountAfter = [int]$inventoryAfter.inventory.windowCount
    newNotepadProcessCountDelta = $processDelta
    newNotepadWindowCountDelta = $windowDelta
  }

  $status | ConvertTo-Json -Depth 8 | Set-Content -Path $launcherStatusPath -Encoding UTF8

  if ($processDelta -ne 0 -or $windowDelta -ne 0) {
    throw "Launcher changed the Notepad process/window inventory. See $launcherStatusPath"
  }

  Write-Host "Notepad Live Mirror is available at $($healthy.url)"
}
finally {
  Pop-Location
}
