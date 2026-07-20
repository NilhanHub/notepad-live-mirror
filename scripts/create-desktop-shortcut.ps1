param(
  [switch]$Launch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Net.Http

$repoRoot = Split-Path -Parent $PSScriptRoot
$bridgePath = Join-Path $repoRoot "bridge\NotepadBridge.ps1"
$artifactDir = Join-Path $repoRoot "artifacts\latest"
$createLogPath = Join-Path $artifactDir "desktop-shortcut.json"
$launchLogPath = Join-Path $artifactDir "desktop-shortcut-launch.json"
$targetPath = Join-Path $repoRoot "run-local.cmd"
$iconPath = "$env:SystemRoot\System32\notepad.exe"

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
      }
    }
  }

  return $null
}

function Wait-ForHealthyApp {
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    $healthy = Find-HealthyApp
    if ($healthy) {
      return $healthy
    }

    Start-Sleep -Milliseconds 500
  }

  throw "The app did not report a healthy localhost endpoint after launching the desktop shortcut."
}

New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

$shell = New-Object -ComObject WScript.Shell
$desktop = $shell.SpecialFolders.Item("Desktop")
$shortcutPath = Join-Path $desktop "Notepad Live Mirror.lnk"
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetPath
$shortcut.WorkingDirectory = $repoRoot
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = "Launch the local Notepad Live Mirror app."
$shortcut.Save()

$resolvedShortcut = $shell.CreateShortcut($shortcutPath)
$exists = Test-Path $shortcutPath

$createProof = [ordered]@{
  resolvedDesktopPath = $desktop
  shortcutPath = $shortcutPath
  targetPath = $resolvedShortcut.TargetPath
  arguments = $resolvedShortcut.Arguments
  workingDirectory = $resolvedShortcut.WorkingDirectory
  iconLocation = $resolvedShortcut.IconLocation
  exists = $exists
  updatedAt = (Get-Date).ToString("o")
}

$createProof | ConvertTo-Json -Depth 6 | Set-Content -Path $createLogPath -Encoding UTF8

if (-not $exists) {
  throw "Desktop shortcut creation did not produce $shortcutPath"
}

if ($Launch) {
  $inventoryBefore = Invoke-BridgeInventory
  Start-Process $shortcutPath | Out-Null
  $healthy = Wait-ForHealthyApp
  $inventoryAfter = Invoke-BridgeInventory

  $processDelta = [int]$inventoryAfter.inventory.processCount - [int]$inventoryBefore.inventory.processCount
  $windowDelta = [int]$inventoryAfter.inventory.windowCount - [int]$inventoryBefore.inventory.windowCount

  $launchProof = [ordered]@{
    launchedAt = (Get-Date).ToString("o")
    shortcutPath = $shortcutPath
    targetUrl = $healthy.url
    actualPort = [int]$healthy.port
    newNotepadProcessCountDelta = $processDelta
    newNotepadWindowCountDelta = $windowDelta
  }

  $launchProof | ConvertTo-Json -Depth 6 | Set-Content -Path $launchLogPath -Encoding UTF8

  if ($processDelta -ne 0 -or $windowDelta -ne 0) {
    throw "Launching the desktop shortcut changed the Notepad process/window inventory. See $launchLogPath"
  }
}

Write-Host "Created desktop shortcut at $shortcutPath"
