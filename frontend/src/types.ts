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
  code?: string;
  message?: string;
}

export type ApiMutationResult =
  | ApiMutationSuccess
  | ApiMutationConflict
  | ApiMutationError;

export interface SaveTabPayload {
  windowHandle: string;
  runtimeId: string;
  stateId: string;
  expectedRawText: string;
  text: string;
  force?: boolean;
}

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
