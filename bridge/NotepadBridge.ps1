param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Snapshot", "Save", "Inspect", "Inventory")]
  [string]$Command
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
Set-StrictMode -Version Latest

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

if (-not ("NotepadBridgeNative" -as [type])) {
  Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class NotepadBridgeNative {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
}
'@
}

function Read-StdinJson {
  $raw = [Console]::In.ReadToEnd()

  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $null
  }

  return $raw | ConvertFrom-Json
}

function Write-JsonResult {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Value
  )

  $Value | ConvertTo-Json -Depth 20 -Compress
}

function Encode-TextBase64 {
  param(
    [AllowEmptyString()]
    [string]$Text
  )

  return [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($Text))
}

function Get-TextSha256 {
  param(
    [AllowEmptyString()]
    [string]$Text
  )

  $hash = [System.Security.Cryptography.SHA256]::Create()

  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    return ([BitConverter]::ToString($hash.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
  }
  finally {
    $hash.Dispose()
  }
}

function Get-ActionId {
  return [Guid]::NewGuid().ToString()
}

function Get-WindowTitle {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$Handle
  )

  $buffer = New-Object System.Text.StringBuilder 1024
  [NotepadBridgeNative]::GetWindowText($Handle, $buffer, $buffer.Capacity) | Out-Null
  return $buffer.ToString()
}

function Get-WindowClassName {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$Handle
  )

  $buffer = New-Object System.Text.StringBuilder 256
  [NotepadBridgeNative]::GetClassName($Handle, $buffer, $buffer.Capacity) | Out-Null
  return $buffer.ToString()
}

function Get-WindowBounds {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$Handle
  )

  $rect = New-Object NotepadBridgeNative+RECT
  [NotepadBridgeNative]::GetWindowRect($Handle, [ref]$rect) | Out-Null

  return [ordered]@{
    left   = $rect.Left
    top    = $rect.Top
    right  = $rect.Right
    bottom = $rect.Bottom
    width  = $rect.Right - $rect.Left
    height = $rect.Bottom - $rect.Top
  }
}

function Get-ForegroundWindowHandleString {
  $handle = [NotepadBridgeNative]::GetForegroundWindow()

  if ($handle -eq [IntPtr]::Zero) {
    return $null
  }

  return $handle.ToInt64().ToString()
}

function Get-NotepadProcessInventory {
  $processes = @(Get-Process notepad -ErrorAction SilentlyContinue | Sort-Object Id)

  return @(
    $processes | ForEach-Object {
      $startedAt = $null

      try {
        $startedAt = $_.StartTime.ToUniversalTime().ToString("o")
      }
      catch {
        $startedAt = $null
      }

      [ordered]@{
        processId       = [int]$_.Id
        mainWindowTitle = $_.MainWindowTitle
        startedAt       = $startedAt
      }
    }
  )
}

function Get-VisibleNotepadWindows {
  $processIds = @(Get-Process notepad -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)

  if ($processIds.Count -eq 0) {
    return @()
  }

  $windows = New-Object System.Collections.Generic.List[object]

  [NotepadBridgeNative]::EnumWindows({
      param($handle, $lParam)

      $processId = [uint32]0
      [NotepadBridgeNative]::GetWindowThreadProcessId($handle, [ref]$processId) | Out-Null

      if (-not ($processIds -contains [int]$processId)) {
        return $true
      }

      if (-not [NotepadBridgeNative]::IsWindowVisible($handle)) {
        return $true
      }

      if ((Get-WindowClassName -Handle $handle) -ne "Notepad") {
        return $true
      }

      $windows.Add([pscustomobject]@{
          HWnd      = $handle
          Handle    = $handle.ToInt64().ToString()
          ProcessId = [int]$processId
          Title     = Get-WindowTitle -Handle $handle
          Bounds    = Get-WindowBounds -Handle $handle
        }) | Out-Null

      return $true
    }, [IntPtr]::Zero) | Out-Null

  return $windows.ToArray()
}

function Get-NotepadInventory {
  $windows = @(Get-VisibleNotepadWindows)
  $processes = @(Get-NotepadProcessInventory)

  return [ordered]@{
    capturedAt             = [DateTimeOffset]::UtcNow.ToString("o")
    foregroundWindowHandle = Get-ForegroundWindowHandleString
    processCount           = $processes.Count
    windowCount            = $windows.Count
    processes              = @($processes)
    windows                = @(
      $windows |
        Sort-Object ProcessId, Handle |
        ForEach-Object {
          [ordered]@{
            windowHandle = $_.Handle
            processId    = $_.ProcessId
            windowTitle  = $_.Title
            bounds       = $_.Bounds
          }
        }
    )
  }
}

function Get-InventoryDelta {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Before,
    [Parameter(Mandatory = $true)]
    [object]$After
  )

  $activatedWindow = $false

  if (($Before.foregroundWindowHandle -ne $After.foregroundWindowHandle) -and $After.foregroundWindowHandle) {
    $afterHandles = @($After.windows | ForEach-Object { $_.windowHandle })
    $activatedWindow = $afterHandles -contains $After.foregroundWindowHandle
  }

  return [ordered]@{
    newNotepadProcessCountDelta = [int]$After.processCount - [int]$Before.processCount
    newNotepadWindowCountDelta  = [int]$After.windowCount - [int]$Before.windowCount
    windowActivated             = $activatedWindow
  }
}

function Get-RootElement {
  param(
    [Parameter(Mandatory = $true)]
    [IntPtr]$Handle
  )

  return [System.Windows.Automation.AutomationElement]::FromHandle($Handle)
}

function Find-DocumentElement {
  param(
    [Parameter(Mandatory = $true)]
    [System.Windows.Automation.AutomationElement]$Root
  )

  $documentCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Document
  )

  return $Root.FindFirst(
    [System.Windows.Automation.TreeScope]::Descendants,
    $documentCondition
  )
}

function Find-DocumentElementReady {
  param(
    [Parameter(Mandatory = $true)]
    [System.Windows.Automation.AutomationElement]$Root
  )

  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    $document = Find-DocumentElement -Root $Root

    if ($document) {
      return $document
    }

    Start-Sleep -Milliseconds 25
  }

  return $null
}

function Get-TabElements {
  param(
    [Parameter(Mandatory = $true)]
    [System.Windows.Automation.AutomationElement]$Root
  )

  $tabItemCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::TabItem
  )

  return ,($Root.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    $tabItemCondition
  ))
}

function Get-RuntimeIdString {
  param(
    [Parameter(Mandatory = $true)]
    [System.Windows.Automation.AutomationElement]$Element
  )

  return ($Element.GetRuntimeId() -join "-")
}

function Get-SelectedTabRuntimeId {
  param(
    [Parameter(Mandatory = $true)]
    [System.Windows.Automation.AutomationElementCollection]$Tabs
  )

  foreach ($tab in $Tabs) {
    $pattern = $null

    if ($tab.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pattern)) {
      if ($pattern.Current.IsSelected) {
        return Get-RuntimeIdString -Element $tab
      }
    }
  }

  return $null
}

function Find-TabByRuntimeId {
  param(
    [Parameter(Mandatory = $true)]
    [System.Windows.Automation.AutomationElementCollection]$Tabs,
    [Parameter(Mandatory = $true)]
    [string]$RuntimeId
  )

  foreach ($tab in $Tabs) {
    if ((Get-RuntimeIdString -Element $tab) -eq $RuntimeId) {
      return $tab
    }
  }

  return $null
}

function Select-TabElement {
  param(
    [Parameter(Mandatory = $true)]
    [System.Windows.Automation.AutomationElement]$Tab
  )

  $pattern = $null

  if (-not $Tab.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pattern)) {
    throw "The target Notepad tab does not expose SelectionItemPattern."
  }

  $pattern.Select()

  for ($attempt = 0; $attempt -lt 25; $attempt++) {
    if ($pattern.Current.IsSelected) {
      break
    }

    Start-Sleep -Milliseconds 30
  }

  Start-Sleep -Milliseconds 80
}

function Read-DocumentRawText {
  param(
    [Parameter(Mandatory = $true)]
    [System.Windows.Automation.AutomationElement]$Root
  )

  $document = Find-DocumentElementReady -Root $Root

  if (-not $document) {
    throw "No Notepad document surface was found."
  }

  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    $textPattern = $null

    if ($document.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$textPattern)) {
      return $textPattern.DocumentRange.GetText(-1)
    }

    $valuePattern = $null

    if ($document.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)) {
      return $valuePattern.Current.Value
    }

    Start-Sleep -Milliseconds 20
  }

  throw "The Notepad document surface does not expose a readable text pattern."
}

function Set-DocumentRawText {
  param(
    [Parameter(Mandatory = $true)]
    [System.Windows.Automation.AutomationElement]$Root,
    [Parameter(Mandatory = $true)]
    [string]$Text
  )

  $document = Find-DocumentElementReady -Root $Root

  if (-not $document) {
    throw "No Notepad document surface was found."
  }

  $valuePattern = $null

  if (-not $document.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)) {
    throw "The Notepad document surface does not expose ValuePattern."
  }

  $valuePattern.SetValue($Text)
}

function Restore-OriginalTab {
  param(
    [Parameter(Mandatory = $true)]
    [System.Windows.Automation.AutomationElementCollection]$Tabs,
    [string]$OriginalRuntimeId
  )

  if ([string]::IsNullOrWhiteSpace($OriginalRuntimeId)) {
    return $false
  }

  foreach ($tab in $Tabs) {
    if ((Get-RuntimeIdString -Element $tab) -eq $OriginalRuntimeId) {
      Select-TabElement -Tab $tab
      return $true
    }
  }

  return $false
}

function Get-DocumentDescriptor {
  param(
    [Parameter(Mandatory = $true)]
    [System.Windows.Automation.AutomationElement]$Root
  )

  $document = Find-DocumentElementReady -Root $Root

  if (-not $document) {
    return $null
  }

  $textPattern = $null
  $valuePattern = $null

  return [ordered]@{
    name               = $document.Current.Name
    controlType        = $document.Current.ControlType.ProgrammaticName
    isOffscreen        = $document.Current.IsOffscreen
    supportsTextPattern = $document.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$textPattern)
    supportsValuePattern = $document.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)
  }
}

function New-UiTabSnapshot {
  param(
    [Parameter(Mandatory = $true)]
    [System.Windows.Automation.AutomationElement]$Tab,
    [Parameter(Mandatory = $true)]
    [int]$Order
  )

  $selectionPattern = $null
  $supportsSelection = $Tab.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$selectionPattern)
  $isSelected = $false

  if ($supportsSelection) {
    $isSelected = $selectionPattern.Current.IsSelected
  }

  return [ordered]@{
    runtimeId                    = Get-RuntimeIdString -Element $Tab
    accessibleName               = $Tab.Current.Name
    order                        = $Order
    selectedInWindow             = $isSelected
    supportsSelectionItemPattern = $supportsSelection
  }
}

function Get-WindowUiSnapshot {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Window,
    [Parameter(Mandatory = $true)]
    [int]$Order,
    [switch]$IncludeSelectedDocumentRawText
  )

  $root = Get-RootElement -Handle $Window.HWnd
  $tabs = Get-TabElements -Root $root
  $tabSnapshots = New-Object System.Collections.Generic.List[object]

  for ($index = 0; $index -lt $tabs.Count; $index++) {
    $tabSnapshots.Add((New-UiTabSnapshot -Tab $tabs[$index] -Order $index)) | Out-Null
  }

  $selectedDocumentRawTextBase64 = $null
  $selectedDocumentTextLength = $null
  $selectedDocumentTextSha256 = $null

  try {
    $selectedDocumentRawText = Read-DocumentRawText -Root $root
    $selectedDocumentTextLength = $selectedDocumentRawText.Length
    $selectedDocumentTextSha256 = Get-TextSha256 -Text $selectedDocumentRawText

    if ($IncludeSelectedDocumentRawText) {
      $selectedDocumentRawTextBase64 = Encode-TextBase64 $selectedDocumentRawText
    }
  }
  catch {
    $selectedDocumentRawTextBase64 = $null
    $selectedDocumentTextLength = $null
    $selectedDocumentTextSha256 = $null
  }

  return [ordered]@{
    windowHandle                = $Window.Handle
    processId                   = $Window.ProcessId
    windowTitle                 = Get-WindowTitle -Handle $Window.HWnd
    order                       = $Order
    bounds                      = $Window.Bounds
    selectedRuntimeId           = Get-SelectedTabRuntimeId -Tabs $tabs
    selectedDocumentRawTextBase64 = $selectedDocumentRawTextBase64
    selectedDocumentTextLength  = $selectedDocumentTextLength
    selectedDocumentTextSha256  = $selectedDocumentTextSha256
    document                    = Get-DocumentDescriptor -Root $root
    tabs                        = $tabSnapshots.ToArray()
  }
}

function Find-WindowByHandle {
  param(
    [Parameter(Mandatory = $true)]
    [string]$WindowHandle
  )

  return Get-VisibleNotepadWindows | Where-Object { $_.Handle -eq $WindowHandle } | Select-Object -First 1
}

function Invoke-Snapshot {
  $actionId = Get-ActionId
  $inventoryBefore = Get-NotepadInventory
  $foregroundBefore = $inventoryBefore.foregroundWindowHandle
  $windows = @(Get-VisibleNotepadWindows)
  $snapshots = New-Object System.Collections.Generic.List[object]

  for ($index = 0; $index -lt $windows.Count; $index++) {
    $snapshots.Add((Get-WindowUiSnapshot -Window $windows[$index] -Order $index -IncludeSelectedDocumentRawText)) | Out-Null
  }

  $inventoryAfter = Get-NotepadInventory
  $foregroundAfter = $inventoryAfter.foregroundWindowHandle
  $inventoryDelta = Get-InventoryDelta -Before $inventoryBefore -After $inventoryAfter

  return [ordered]@{
    source                          = "live-notepad"
    bridgeMode                      = "uia_metadata_only"
    sessionReadKind                 = "uia_metadata_plus_session_state"
    actionId                        = $actionId
    refreshedAt                     = [DateTimeOffset]::UtcNow.ToString("o")
    foregroundWindowHandleBefore    = $foregroundBefore
    foregroundWindowHandleAfter     = $foregroundAfter
    focusChangedDuringSnapshot      = ($foregroundBefore -ne $foregroundAfter)
    windowActivatedDuringSnapshot   = $inventoryDelta.windowActivated
    selectionActionsDuringSnapshot  = 0
    newNotepadProcessCountDelta     = $inventoryDelta.newNotepadProcessCountDelta
    newNotepadWindowCountDelta      = $inventoryDelta.newNotepadWindowCountDelta
    inventoryBefore                 = $inventoryBefore
    inventoryAfter                  = $inventoryAfter
    windows                         = $snapshots.ToArray()
  }
}

function Invoke-Inspect {
  $snapshot = Invoke-Snapshot

  foreach ($window in @($snapshot.windows)) {
    $window.selectedDocumentRawTextBase64 = $null
  }

  return $snapshot
}

function Invoke-Inventory {
  return [ordered]@{
    source      = "live-notepad"
    bridgeMode  = "inventory_only"
    actionId    = Get-ActionId
    refreshedAt = [DateTimeOffset]::UtcNow.ToString("o")
    inventory   = Get-NotepadInventory
  }
}

function Invoke-Save {
  $payload = Read-StdinJson

  if (-not $payload) {
    return [ordered]@{
      kind    = "error"
      code    = "invalid_request"
      message = "Save payload is required."
    }
  }

  $actionId = Get-ActionId
  $inventoryBefore = Get-NotepadInventory
  $foregroundBefore = $inventoryBefore.foregroundWindowHandle
  $windowsBefore = @(Get-VisibleNotepadWindows)
  $window = $windowsBefore | Where-Object { $_.Handle -eq [string]$payload.windowHandle } | Select-Object -First 1

  if (-not $window) {
    return [ordered]@{
      kind    = "error"
      code    = "window_missing"
      message = "The target Notepad window is no longer available."
    }
  }

  $root = Get-RootElement -Handle $window.HWnd
  $tabs = Get-TabElements -Root $root
  $originalRuntimeId = Get-SelectedTabRuntimeId -Tabs $tabs
  $targetTab = Find-TabByRuntimeId -Tabs $tabs -RuntimeId ([string]$payload.runtimeId)
  $selectionActions = 0

  if (-not $targetTab) {
    return [ordered]@{
      kind    = "error"
      code    = "identity_lost"
      message = "The target Notepad tab could not be re-identified. Refresh is required."
    }
  }

  if ((Get-RuntimeIdString -Element $targetTab) -ne $originalRuntimeId) {
    Select-TabElement -Tab $targetTab
    $selectionActions += 1
  }

  Set-DocumentRawText -Root $root -Text ([string]$payload.text)
  Start-Sleep -Milliseconds 80

  $verifiedRawText = Read-DocumentRawText -Root $root
  $restoredOriginalSelection = $false

  if (($originalRuntimeId) -and ($originalRuntimeId -ne (Get-RuntimeIdString -Element $targetTab))) {
    $restoredOriginalSelection = Restore-OriginalTab -Tabs $tabs -OriginalRuntimeId $originalRuntimeId

    if ($restoredOriginalSelection) {
      $selectionActions += 1
    }
  }

  $inventoryAfter = Get-NotepadInventory
  $foregroundAfter = $inventoryAfter.foregroundWindowHandle
  $inventoryDelta = Get-InventoryDelta -Before $inventoryBefore -After $inventoryAfter

  return [ordered]@{
    kind                         = "success"
    bridgeMode                   = "bounded_visual_writeback"
    actionId                     = $actionId
    windowHandle                 = [string]$payload.windowHandle
    runtimeId                    = [string]$payload.runtimeId
    verifiedRawTextBase64        = Encode-TextBase64 $verifiedRawText
    selectionActionsDuringSave   = $selectionActions
    focusChangedDuringSave       = ($foregroundBefore -ne $foregroundAfter)
    windowActivatedDuringSave    = $inventoryDelta.windowActivated
    foregroundWindowHandleBefore = $foregroundBefore
    foregroundWindowHandleAfter  = $foregroundAfter
    restoredOriginalSelection    = $restoredOriginalSelection
    newNotepadProcessCountDelta  = $inventoryDelta.newNotepadProcessCountDelta
    newNotepadWindowCountDelta   = $inventoryDelta.newNotepadWindowCountDelta
    inventoryBefore              = $inventoryBefore
    inventoryAfter               = $inventoryAfter
  }
}

try {
  switch ($Command) {
    "Snapshot" {
      Write-JsonResult -Value (Invoke-Snapshot)
      break
    }
    "Inspect" {
      Write-JsonResult -Value (Invoke-Inspect)
      break
    }
    "Inventory" {
      Write-JsonResult -Value (Invoke-Inventory)
      break
    }
    "Save" {
      Write-JsonResult -Value (Invoke-Save)
      break
    }
    default {
      throw "Unsupported bridge command."
    }
  }
}
catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  if ($_.InvocationInfo) {
    [Console]::Error.WriteLine($_.InvocationInfo.PositionMessage)
  }
  if ($_.ScriptStackTrace) {
    [Console]::Error.WriteLine($_.ScriptStackTrace)
  }
  exit 1
}
