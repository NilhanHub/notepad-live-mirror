import type {
  ApiDiagnosticsResponse,
  ApiMutationResult,
  ApiSavePayload,
  ApiSnapshot,
  ApiSnapshotDiagnostics,
  ApiTab,
  ApiWindow,
  BridgeInventorySnapshot,
  BridgeSavePayload,
  BridgeSaveResult,
  BridgeSnapshotResponse,
  BridgeUiWindow,
} from "./contracts.js";
import { runBridge } from "./bridge.js";
import {
  bumpMetric,
  getRuntimeDiagnostics,
  logEvent,
  nextRequestId,
  recordBridgeAction,
  sanitizeString,
  writeRunArtifact,
} from "./runtime.js";
import { searchSnapshot } from "./search.js";
import {
  type ParsedSessionState,
  type ParsedWindowState,
  parseNotepadSessionState,
} from "./sessionState.js";
import {
  applyDuplicateMetadata,
  buildWindowLabel,
  decodeBridgeText,
  normalizeBridgeTextToUi,
  normalizeUiTextToBridge,
  toApiTabBase,
} from "./text.js";

interface MatchedWindow {
  uiWindow: BridgeUiWindow;
  stateWindow: ParsedWindowState | null;
  score: number | null;
}

let operationQueue: Promise<void> = Promise.resolve();

function enqueueNotepadOperation<T>(
  kind: "snapshot" | "search" | "save",
  work: () => Promise<T>,
): Promise<T> {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const waitForTurn = operationQueue.catch(() => undefined);
  operationQueue = waitForTurn.then(() => gate);

  return waitForTurn.then(async () => {
    logEvent("notepad.operation.start", { kind });

    try {
      return await work();
    } finally {
      release();
      logEvent("notepad.operation.end", { kind });
    }
  });
}

function sanitizeInventory(inventory: BridgeInventorySnapshot) {
  return {
    capturedAt: inventory.capturedAt,
    foregroundWindowHandle: inventory.foregroundWindowHandle,
    processCount: inventory.processCount,
    windowCount: inventory.windowCount,
    processes: inventory.processes.map((process) => ({
      processId: process.processId,
      mainWindowTitle: sanitizeString(process.mainWindowTitle),
      startedAt: process.startedAt,
    })),
    windows: inventory.windows.map((window) => ({
      windowHandle: window.windowHandle,
      processId: window.processId,
      windowTitle: sanitizeString(window.windowTitle),
      bounds: window.bounds,
    })),
  };
}

function sanitizeProcessInventory(inventory: BridgeInventorySnapshot) {
  return {
    capturedAt: inventory.capturedAt,
    foregroundWindowHandle: inventory.foregroundWindowHandle,
    processCount: inventory.processCount,
    processes: sanitizeInventory(inventory).processes,
  };
}

function sanitizeWindowInventory(inventory: BridgeInventorySnapshot) {
  return {
    capturedAt: inventory.capturedAt,
    foregroundWindowHandle: inventory.foregroundWindowHandle,
    windowCount: inventory.windowCount,
    windows: sanitizeInventory(inventory).windows,
  };
}

function writeInventoryArtifacts(
  phase: "snapshot" | "save",
  requestId: string,
  before: BridgeInventorySnapshot,
  after: BridgeInventorySnapshot,
) {
  writeRunArtifact(
    `notepad/process-inventory-before-${phase}-${requestId}.json`,
    sanitizeProcessInventory(before),
  );
  writeRunArtifact(
    `notepad/process-inventory-after-${phase}-${requestId}.json`,
    sanitizeProcessInventory(after),
  );
  writeRunArtifact(
    `notepad/window-inventory-before-${phase}-${requestId}.json`,
    sanitizeWindowInventory(before),
  );
  writeRunArtifact(
    `notepad/window-inventory-after-${phase}-${requestId}.json`,
    sanitizeWindowInventory(after),
  );

  if (phase === "snapshot") {
    writeRunArtifact("notepad/process-inventory-before.json", sanitizeProcessInventory(before));
    writeRunArtifact("notepad/process-inventory-after.json", sanitizeProcessInventory(after));
    writeRunArtifact("notepad/window-inventory-before.json", sanitizeWindowInventory(before));
    writeRunArtifact("notepad/window-inventory-after.json", sanitizeWindowInventory(after));
  }
}

function writeSnapshotProofArtifacts(
  requestId: string,
  snapshot: ApiSnapshot,
  bridge: BridgeSnapshotResponse,
  session: ParsedSessionState,
) {
  writeInventoryArtifacts(
    "snapshot",
    requestId,
    bridge.inventoryBefore,
    bridge.inventoryAfter,
  );

  writeRunArtifact("bridge/nonvisual-proof.json", {
    requestId,
    bridgeActionId: bridge.actionId,
    bridgeMode: bridge.bridgeMode,
    sessionReadKind: bridge.sessionReadKind,
    selectionActionsDuringSnapshot: bridge.selectionActionsDuringSnapshot,
    focusChangedDuringSnapshot: bridge.focusChangedDuringSnapshot,
    windowActivatedDuringSnapshot: bridge.windowActivatedDuringSnapshot,
    newNotepadProcessCountDelta: bridge.newNotepadProcessCountDelta,
    newNotepadWindowCountDelta: bridge.newNotepadWindowCountDelta,
    matchedWindowStateCount: snapshot.diagnostics.matchedWindowStateCount,
    unmatchedWindowCount: snapshot.diagnostics.unmatchedWindowCount,
    selectedDocumentAgreementCount: snapshot.diagnostics.selectedDocumentAgreementCount,
  });
  writeRunArtifact("bridge/selection-focus-telemetry.json", {
    requestId,
    bridgeActionId: bridge.actionId,
    foregroundWindowHandleBefore: bridge.foregroundWindowHandleBefore,
    foregroundWindowHandleAfter: bridge.foregroundWindowHandleAfter,
    focusChangedDuringSnapshot: bridge.focusChangedDuringSnapshot,
    windowActivatedDuringSnapshot: bridge.windowActivatedDuringSnapshot,
    selectionActionsDuringSnapshot: bridge.selectionActionsDuringSnapshot,
  });
  writeRunArtifact("bridge/session-source-report.json", {
    requestId,
    stateRoot: session.stateRoot,
    windowStateDir: session.windowStateDir,
    tabStateDir: session.tabStateDir,
    sessionWindowCount: session.windows.length,
    sessionTabCount: session.tabsById.size,
    warnings: session.warnings,
  });
  writeRunArtifact(
    "bridge/tab-identity-map.json",
    snapshot.windows.map((window) => ({
      handle: window.handle,
      processId: window.processId,
      windowTitle: sanitizeString(window.windowTitle),
      tabs: window.tabs.map((tab) => ({
        id: tab.id,
        stateId: tab.stateId,
        runtimeId: tab.runtimeId,
        order: tab.order,
        selectedInWindow: tab.selectedInWindow,
        title: sanitizeString(tab.title),
        duplicateIndex: tab.duplicateIndex,
        duplicateCount: tab.duplicateCount,
      })),
    })),
  );
}

function getSelectedTabOrder(window: BridgeUiWindow): number | null {
  const selected = window.tabs.find((tab) => tab.selectedInWindow);
  return selected?.order ?? null;
}

function scoreWindowMatch(
  uiWindow: BridgeUiWindow,
  stateWindow: ParsedWindowState,
): number {
  const tabCountPenalty =
    Math.abs(uiWindow.tabs.length - stateWindow.tabIds.length) * 100000;
  const selectedOrderPenalty =
    getSelectedTabOrder(uiWindow) === stateWindow.activeTab ? 0 : 5000;
  const boundsPenalty =
    Math.abs(uiWindow.bounds.left - stateWindow.bounds.left) +
    Math.abs(uiWindow.bounds.top - stateWindow.bounds.top) +
    Math.abs(uiWindow.bounds.right - stateWindow.bounds.right) +
    Math.abs(uiWindow.bounds.bottom - stateWindow.bounds.bottom);

  return tabCountPenalty + selectedOrderPenalty + boundsPenalty;
}

function matchWindows(
  uiWindows: BridgeUiWindow[],
  stateWindows: ParsedWindowState[],
): MatchedWindow[] {
  if (uiWindows.length === 1 && stateWindows.length === 1) {
    const uiWindow = uiWindows[0];
    const stateWindow = stateWindows[0];

    if (!uiWindow || !stateWindow) {
      return [];
    }

    return [
      {
        uiWindow,
        stateWindow,
        score: scoreWindowMatch(uiWindow, stateWindow),
      },
    ];
  }

  const scoredPairs = uiWindows.flatMap((uiWindow) =>
    stateWindows.map((stateWindow) => ({
      uiWindow,
      stateWindow,
      score: scoreWindowMatch(uiWindow, stateWindow),
    })),
  );

  scoredPairs.sort((left, right) => left.score - right.score);

  const matchedUiHandles = new Set<string>();
  const matchedStateIds = new Set<string>();
  const matches: MatchedWindow[] = [];

  for (const pair of scoredPairs) {
    if (
      matchedUiHandles.has(pair.uiWindow.windowHandle) ||
      matchedStateIds.has(pair.stateWindow.stateId)
    ) {
      continue;
    }

    matchedUiHandles.add(pair.uiWindow.windowHandle);
    matchedStateIds.add(pair.stateWindow.stateId);
    matches.push(pair);
  }

  for (const uiWindow of uiWindows) {
    if (!matchedUiHandles.has(uiWindow.windowHandle)) {
      matches.push({
        uiWindow,
        stateWindow: null,
        score: null,
      });
    }
  }

  matches.sort((left, right) => left.uiWindow.order - right.uiWindow.order);
  return matches;
}

function sanitizeSnapshot(snapshot: ApiSnapshot) {
  return {
    refreshedAt: snapshot.refreshedAt,
    diagnostics: snapshot.diagnostics,
    windows: snapshot.windows.map((window) => ({
      handle: window.handle,
      processId: window.processId,
      tabCount: window.tabs.length,
      windowTitle: sanitizeString(window.windowTitle),
      tabs: window.tabs.map((tab) => ({
        id: tab.id,
        stateId: tab.stateId,
        runtimeId: tab.runtimeId,
        title: sanitizeString(tab.title),
        accessibleName: sanitizeString(tab.accessibleName),
        text: sanitizeString(tab.text),
        sourceKind: tab.sourceKind,
        order: tab.order,
        selectedInWindow: tab.selectedInWindow,
      })),
    })),
  };
}

function findTabByIdentity(
  snapshot: ApiSnapshot,
  windowHandle: string,
  stateId: string,
): ApiTab | null {
  for (const window of snapshot.windows) {
    if (window.handle !== windowHandle) {
      continue;
    }

    const match = window.tabs.find((tab) => tab.stateId === stateId);
    if (match) {
      return match;
    }
  }

  return null;
}

async function createSnapshot(
  requestId: string,
): Promise<{ snapshot: ApiSnapshot; bridge: BridgeSnapshotResponse; session: ParsedSessionState }> {
  const bridge = await runBridge<BridgeSnapshotResponse>("Snapshot");
  recordBridgeAction(bridge.actionId);
  const session = parseNotepadSessionState();
  const matches = matchWindows(bridge.windows, session.windows);
  const warnings: string[] = [];
  let matchedWindowStateCount = 0;
  let selectedDocumentAgreementCount = 0;

  const windows: ApiWindow[] = matches
    .map((match, index) => {
      const { uiWindow, stateWindow } = match;

      if (!stateWindow) {
        warnings.push(
          `No WindowState file matched Notepad window ${uiWindow.windowHandle}.`,
        );
        return null;
      }

      matchedWindowStateCount += 1;

      if (stateWindow.tabIds.length !== uiWindow.tabs.length) {
        warnings.push(
          `Window ${uiWindow.windowHandle} tab count differs between UIA (${uiWindow.tabs.length}) and WindowState (${stateWindow.tabIds.length}).`,
        );
      }

      const tabs = uiWindow.tabs
        .map((uiTab) => {
          const stateId = stateWindow.tabIds[uiTab.order];

          if (!stateId) {
            warnings.push(
              `Window ${uiWindow.windowHandle} is missing a state id for tab order ${uiTab.order}.`,
            );
            return null;
          }

          const stateTab = session.tabsById.get(stateId);

          if (!stateTab) {
            warnings.push(
              `TabState ${stateId} could not be read for window ${uiWindow.windowHandle}.`,
            );
            return null;
          }

          const modified =
            uiWindow.windowTitle.startsWith("*") ||
            /\. Modified\.$/.test(uiTab.accessibleName);

          return toApiTabBase({
            stateId,
            windowHandle: uiWindow.windowHandle,
            runtimeId: uiTab.runtimeId,
            accessibleName: uiTab.accessibleName,
            windowTitle: uiWindow.windowTitle,
            order: uiTab.order,
            selectedInWindow: uiTab.selectedInWindow,
            modified,
            rawText: stateTab.rawText,
            sourceKind: stateTab.sourceKind,
            sourceFilePath: stateTab.sourceFilePath,
            sourceFileExists: stateTab.sourceFileExists,
            carriageReturnType: stateTab.carriageReturnType,
            encodingType: stateTab.encodingType,
          });
        })
        .filter((tab): tab is NonNullable<typeof tab> => tab !== null);

      const activeStateId = stateWindow.tabIds[stateWindow.activeTab];
      const activeTab = activeStateId
        ? tabs.find((tab) => tab.stateId === activeStateId) ?? null
        : null;

      if (activeTab && uiWindow.selectedDocumentRawTextBase64) {
        const selectedDocumentRawText = decodeBridgeText(
          uiWindow.selectedDocumentRawTextBase64,
        );

        if (
          normalizeBridgeTextToUi(selectedDocumentRawText) === activeTab.text
        ) {
          selectedDocumentAgreementCount += 1;
        } else {
          warnings.push(
            `Selected document text did not match parsed session text for window ${uiWindow.windowHandle}.`,
          );
        }
      }

      return {
        id: uiWindow.windowHandle,
        handle: uiWindow.windowHandle,
        processId: uiWindow.processId,
        label: buildWindowLabel(index, matches.length),
        windowTitle: uiWindow.windowTitle,
        tabs: applyDuplicateMetadata(tabs),
      } satisfies ApiWindow;
    })
    .filter((window): window is ApiWindow => window !== null);

  if (bridge.windows.length > 0 && windows.length === 0) {
    throw new Error(
      "Visible Notepad windows were found, but their live session state could not be mapped non-visually.",
    );
  }

  const diagnostics: ApiSnapshotDiagnostics = {
    bridgeMode: "non_visual_session_state",
    sessionReadKind: bridge.sessionReadKind,
    requestId,
    bridgeActionId: bridge.actionId,
    selectionActionsDuringSnapshot: bridge.selectionActionsDuringSnapshot,
    focusChangedDuringSnapshot: bridge.focusChangedDuringSnapshot,
    windowActivatedDuringSnapshot: bridge.windowActivatedDuringSnapshot,
    foregroundWindowHandleBefore: bridge.foregroundWindowHandleBefore,
    foregroundWindowHandleAfter: bridge.foregroundWindowHandleAfter,
    newNotepadProcessCountDelta: bridge.newNotepadProcessCountDelta,
    newNotepadWindowCountDelta: bridge.newNotepadWindowCountDelta,
    stateRoot: session.stateRoot,
    windowStateDir: session.windowStateDir,
    tabStateDir: session.tabStateDir,
    matchedWindowStateCount,
    unmatchedWindowCount: bridge.windows.length - matchedWindowStateCount,
    selectedDocumentAgreementCount,
    warnings: [...session.warnings, ...warnings],
  };

  const snapshot: ApiSnapshot = {
    source: bridge.source,
    refreshedAt: bridge.refreshedAt,
    hasWindows: windows.some((window) => window.tabs.length > 0),
    windows,
    diagnostics,
  };

  writeRunArtifact(`api/snapshot-${requestId}.json`, sanitizeSnapshot(snapshot));
  writeRunArtifact(
    `bridge/snapshot-${requestId}.json`,
    {
      bridgeMode: bridge.bridgeMode,
      sessionReadKind: bridge.sessionReadKind,
      actionId: bridge.actionId,
      focusChangedDuringSnapshot: bridge.focusChangedDuringSnapshot,
      windowActivatedDuringSnapshot: bridge.windowActivatedDuringSnapshot,
      selectionActionsDuringSnapshot: bridge.selectionActionsDuringSnapshot,
      newNotepadProcessCountDelta: bridge.newNotepadProcessCountDelta,
      newNotepadWindowCountDelta: bridge.newNotepadWindowCountDelta,
      windowCount: bridge.windows.length,
    },
  );
  writeRunArtifact(
    `notepad/session-${requestId}.json`,
    {
      windowCount: session.windows.length,
      tabCount: session.tabsById.size,
      windowStateDir: session.windowStateDir,
      tabStateDir: session.tabStateDir,
    },
  );
  writeSnapshotProofArtifacts(requestId, snapshot, bridge, session);
  logEvent("snapshot.complete", {
    requestId,
    bridgeActionId: bridge.actionId,
    windowCount: snapshot.windows.length,
    warnings: diagnostics.warnings.length,
  });

  return { snapshot, bridge, session };
}

export async function getSnapshot(): Promise<ApiSnapshot> {
  return enqueueNotepadOperation("snapshot", async () => {
    const requestId = nextRequestId("snapshot");
    bumpMetric("snapshots");
    return (await createSnapshot(requestId)).snapshot;
  });
}

export async function searchLiveSnapshot(
  query: string,
  mode: "search" | "query",
) {
  return enqueueNotepadOperation("search", async () => {
    const requestId = nextRequestId("search");
    bumpMetric("searches");
    const snapshot = (await createSnapshot(requestId)).snapshot;
    const result = searchSnapshot(snapshot, query, mode);

    writeRunArtifact(`api/search-${requestId}.json`, {
      query: sanitizeString(query),
      mode,
      resultCount: result.resultCount,
      refreshedAt: result.refreshedAt,
    });
    logEvent("search.complete", {
      requestId,
      mode,
      resultCount: result.resultCount,
    });

    return result;
  });
}

export async function saveTab(
  payload: ApiSavePayload,
): Promise<ApiMutationResult> {
  return enqueueNotepadOperation("save", async () => {
    const requestId = nextRequestId("save");
    bumpMetric("saves");
    const currentSnapshot = (await createSnapshot(requestId)).snapshot;
    const targetTab = findTabByIdentity(
      currentSnapshot,
      payload.windowHandle,
      payload.stateId,
    );

    if (!targetTab) {
      return {
        kind: "error",
        code: "identity_lost",
        message:
          "The target Notepad tab could not be re-identified from the current live session. Refresh is required.",
      };
    }

    if (!payload.force && targetTab.rawText !== payload.expectedRawText) {
      return {
        kind: "conflict",
        code: "live_changed",
        message: "The live Notepad tab changed after the last refresh.",
        tab: targetTab,
      };
    }

    const bridgePayload: BridgeSavePayload = {
      windowHandle: payload.windowHandle,
      runtimeId: payload.runtimeId,
      text: normalizeUiTextToBridge(payload.text),
    };

    const result = await runBridge<BridgeSaveResult>("Save", bridgePayload);
    recordBridgeAction(
      result.kind === "success"
        ? result.actionId
        : currentSnapshot.diagnostics.bridgeActionId,
    );

    if (result.kind === "error") {
      return {
        kind: "error",
        code: result.code,
        message: result.message,
      };
    }

    const verifiedSnapshot = (await createSnapshot(requestId)).snapshot;
    const verifiedTab = findTabByIdentity(
      verifiedSnapshot,
      payload.windowHandle,
      payload.stateId,
    );

    if (!verifiedTab) {
      return {
        kind: "error",
        code: "verification_missing",
        message: "The tab disappeared before post-save verification completed.",
      };
    }

    if (verifiedTab.text !== payload.text) {
      return {
        kind: "error",
        code: "verification_failed",
        message: "Post-write verification did not match the intended website text.",
      };
    }

    writeInventoryArtifacts(
      "save",
      requestId,
      result.inventoryBefore,
      result.inventoryAfter,
    );
    writeRunArtifact("bridge/save-telemetry.json", {
      requestId,
      bridgeActionId: result.actionId,
      bridgeMode: result.bridgeMode,
      selectionActionsDuringSave: result.selectionActionsDuringSave,
      focusChangedDuringSave: result.focusChangedDuringSave,
      windowActivatedDuringSave: result.windowActivatedDuringSave,
      newNotepadProcessCountDelta: result.newNotepadProcessCountDelta,
      newNotepadWindowCountDelta: result.newNotepadWindowCountDelta,
      restoredOriginalSelection: result.restoredOriginalSelection,
      foregroundWindowHandleBefore: result.foregroundWindowHandleBefore,
      foregroundWindowHandleAfter: result.foregroundWindowHandleAfter,
    });
    writeRunArtifact(`api/save-${requestId}.json`, {
      requestId,
      bridgeActionId: result.actionId,
      target: {
        windowHandle: payload.windowHandle,
        stateId: payload.stateId,
        runtimeId: payload.runtimeId,
      },
      text: sanitizeString(payload.text),
      selectionActionsDuringSave: result.selectionActionsDuringSave,
      focusChangedDuringSave: result.focusChangedDuringSave,
      windowActivatedDuringSave: result.windowActivatedDuringSave,
      newNotepadProcessCountDelta: result.newNotepadProcessCountDelta,
      newNotepadWindowCountDelta: result.newNotepadWindowCountDelta,
      restoredOriginalSelection: result.restoredOriginalSelection,
    });
    logEvent("save.complete", {
      requestId,
      bridgeActionId: result.actionId,
      selectionActionsDuringSave: result.selectionActionsDuringSave,
      focusChangedDuringSave: result.focusChangedDuringSave,
      windowActivatedDuringSave: result.windowActivatedDuringSave,
      newNotepadProcessCountDelta: result.newNotepadProcessCountDelta,
      newNotepadWindowCountDelta: result.newNotepadWindowCountDelta,
    });

    return {
      kind: "success",
      message: "The live Notepad tab was updated and verified.",
      tab: verifiedTab,
      diagnostics: {
        requestId,
        bridgeActionId: result.actionId,
        bridgeMode: result.bridgeMode,
        selectionActionsDuringSave: result.selectionActionsDuringSave,
        focusChangedDuringSave: result.focusChangedDuringSave,
        windowActivatedDuringSave: result.windowActivatedDuringSave,
        newNotepadProcessCountDelta: result.newNotepadProcessCountDelta,
        newNotepadWindowCountDelta: result.newNotepadWindowCountDelta,
        restoredOriginalSelection: result.restoredOriginalSelection,
      },
    };
  });
}

export function getDiagnostics(): ApiDiagnosticsResponse {
  const runtime = getRuntimeDiagnostics();

  return {
    ...runtime,
    bridgeMode: "non_visual_session_state",
  };
}
