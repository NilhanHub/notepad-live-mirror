export interface BridgeBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface BridgeProcessInventoryItem {
  processId: number;
  mainWindowTitle: string | null;
  startedAt: string | null;
}

export interface BridgeWindowInventoryItem {
  windowHandle: string;
  processId: number;
  windowTitle: string;
  bounds: BridgeBounds;
}

export interface BridgeInventorySnapshot {
  capturedAt: string;
  foregroundWindowHandle: string | null;
  processCount: number;
  windowCount: number;
  processes: BridgeProcessInventoryItem[];
  windows: BridgeWindowInventoryItem[];
}

export interface BridgeDocumentDescriptor {
  name: string;
  controlType: string;
  isOffscreen: boolean;
  supportsTextPattern: boolean;
  supportsValuePattern: boolean;
}

export interface BridgeUiTab {
  runtimeId: string;
  accessibleName: string;
  order: number;
  selectedInWindow: boolean;
  supportsSelectionItemPattern: boolean;
}

export interface BridgeUiWindow {
  windowHandle: string;
  processId: number;
  windowTitle: string;
  order: number;
  bounds: BridgeBounds;
  selectedRuntimeId: string | null;
  selectedDocumentRawTextBase64: string | null;
  selectedDocumentTextLength: number | null;
  selectedDocumentTextSha256: string | null;
  document: BridgeDocumentDescriptor | null;
  tabs: BridgeUiTab[];
}

export interface BridgeSnapshotResponse {
  source: "live-notepad";
  bridgeMode: "uia_metadata_only";
  sessionReadKind: "uia_metadata_plus_session_state";
  actionId: string;
  refreshedAt: string;
  foregroundWindowHandleBefore: string | null;
  foregroundWindowHandleAfter: string | null;
  focusChangedDuringSnapshot: boolean;
  windowActivatedDuringSnapshot: boolean;
  selectionActionsDuringSnapshot: number;
  newNotepadProcessCountDelta: number;
  newNotepadWindowCountDelta: number;
  inventoryBefore: BridgeInventorySnapshot;
  inventoryAfter: BridgeInventorySnapshot;
  windows: BridgeUiWindow[];
}

export interface BridgeInventoryResponse {
  source: "live-notepad";
  bridgeMode: "inventory_only";
  actionId: string;
  refreshedAt: string;
  inventory: BridgeInventorySnapshot;
}

export interface BridgeSavePayload {
  windowHandle: string;
  runtimeId: string;
  text: string;
}

export interface BridgeSaveSuccess {
  kind: "success";
  bridgeMode: "bounded_visual_writeback";
  actionId: string;
  windowHandle: string;
  runtimeId: string;
  verifiedRawTextBase64: string;
  selectionActionsDuringSave: number;
  focusChangedDuringSave: boolean;
  windowActivatedDuringSave: boolean;
  foregroundWindowHandleBefore: string | null;
  foregroundWindowHandleAfter: string | null;
  restoredOriginalSelection: boolean;
  newNotepadProcessCountDelta: number;
  newNotepadWindowCountDelta: number;
  inventoryBefore: BridgeInventorySnapshot;
  inventoryAfter: BridgeInventorySnapshot;
}

export interface BridgeSaveError {
  kind: "error";
  code: string;
  message: string;
}

export type BridgeSaveResult = BridgeSaveSuccess | BridgeSaveError;

export interface ApiSnapshotDiagnostics {
  bridgeMode: string;
  sessionReadKind: string;
  requestId: string;
  bridgeActionId: string;
  selectionActionsDuringSnapshot: number;
  focusChangedDuringSnapshot: boolean;
  windowActivatedDuringSnapshot: boolean;
  foregroundWindowHandleBefore: string | null;
  foregroundWindowHandleAfter: string | null;
  newNotepadProcessCountDelta: number;
  newNotepadWindowCountDelta: number;
  stateRoot: string | null;
  windowStateDir: string | null;
  tabStateDir: string | null;
  matchedWindowStateCount: number;
  unmatchedWindowCount: number;
  selectedDocumentAgreementCount: number;
  warnings: string[];
}

export interface ApiTabBase {
  id: string;
  stateId: string;
  windowHandle: string;
  runtimeId: string;
  title: string;
  accessibleName: string;
  windowTitle: string;
  order: number;
  selectedInWindow: boolean;
  modified: boolean;
  text: string;
  rawText: string;
  sourceKind:
    | "unsaved-buffer"
    | "disk-file"
    | "inline-fallback"
    | "missing-file"
    | "state-file";
  sourceFilePath: string | null;
  sourceFileExists: boolean;
  carriageReturnType: number | null;
  encodingType: number | null;
}

export interface ApiTab extends ApiTabBase {
  duplicateIndex: number;
  duplicateCount: number;
}

export interface ApiWindow {
  id: string;
  handle: string;
  processId: number;
  label: string;
  windowTitle: string;
  tabs: ApiTab[];
}

export interface ApiSnapshot {
  source: "live-notepad";
  refreshedAt: string;
  hasWindows: boolean;
  windows: ApiWindow[];
  diagnostics: ApiSnapshotDiagnostics;
}

export interface ApiSavePayload {
  windowHandle: string;
  runtimeId: string;
  stateId: string;
  expectedRawText: string;
  text: string;
  force?: boolean;
}

export interface ApiMutationSuccess {
  kind: "success";
  message: string;
  tab: ApiTabBase;
  diagnostics: {
    requestId: string;
    bridgeActionId: string;
    bridgeMode: string;
    selectionActionsDuringSave: number;
    focusChangedDuringSave: boolean;
    windowActivatedDuringSave: boolean;
    newNotepadProcessCountDelta: number;
    newNotepadWindowCountDelta: number;
    restoredOriginalSelection: boolean;
  };
}

export interface ApiMutationConflict {
  kind: "conflict";
  code: "live_changed";
  message: string;
  tab: ApiTabBase;
}

export interface ApiMutationError {
  kind: "error";
  code: string;
  message: string;
}

export type ApiMutationResult =
  | ApiMutationSuccess
  | ApiMutationConflict
  | ApiMutationError;

export interface SearchResult {
  id: string;
  stateId: string;
  tabId: string;
  windowHandle: string;
  tabTitle: string;
  duplicateLabel: string | null;
  score: number;
  snippet: string;
  matchStart: number;
  matchEnd: number;
}

export interface ApiSearchResponse {
  mode: "search" | "query";
  query: string;
  refreshedAt: string | null;
  resultCount: number;
  summary: string;
  results: SearchResult[];
}

export interface ApiDiagnosticsResponse {
  appVersion: string;
  actualPort: number;
  runId: string;
  bridgeMode: string;
  latestArtifactsDir: string;
  latestVerificationRunDir: string | null;
  latestKnownGoodRunDir: string | null;
  latestRealAuditDir: string | null;
  oracleDocPath: string;
  oracleYamlPath: string;
  oracleSourcePath: string;
  oracleCommandPath: string;
  oracleCommand: string;
  includeGlobs: string[];
  excludeGlobs: string[];
  sanitizationRules: string[];
  currentObjective: string;
  currentFailureOrUncertainty: string;
  reproductionSteps: string[];
  evidenceSufficient: string[];
  lastSnapshotRequestId: string | null;
  lastSaveRequestId: string | null;
  lastBridgeActionId: string | null;
}
