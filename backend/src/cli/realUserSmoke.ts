import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  ApiSnapshot,
  BridgeInventoryResponse,
  BridgeInventorySnapshot,
} from "../contracts.js";
import { runBridge } from "../bridge.js";
import { getDiagnostics, getSnapshot, searchLiveSnapshot } from "../notepadService.js";
import {
  getRepoRoot,
  markKnownGoodRun,
  markVerificationRun,
  sanitizeString,
} from "../runtime.js";

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

function sanitizeSnapshot(snapshot: ApiSnapshot) {
  return {
    refreshedAt: snapshot.refreshedAt,
    diagnostics: snapshot.diagnostics,
    windows: snapshot.windows.map((window) => ({
      handle: window.handle,
      processId: window.processId,
      label: window.label,
      windowTitle: sanitizeString(window.windowTitle),
      tabs: window.tabs.map((tab) => ({
        id: tab.id,
        stateId: tab.stateId,
        runtimeId: tab.runtimeId,
        order: tab.order,
        selectedInWindow: tab.selectedInWindow,
        title: sanitizeString(tab.title),
        accessibleName: sanitizeString(tab.accessibleName),
        text: sanitizeString(tab.text),
        duplicateIndex: tab.duplicateIndex,
        duplicateCount: tab.duplicateCount,
      })),
    })),
  };
}

function pickSearchToken(snapshot: ApiSnapshot): string {
  for (const window of snapshot.windows) {
    for (const tab of window.tabs) {
      const tokens = `${tab.title} ${tab.text}`
        .split(/[^\p{L}\p{N}_-]+/u)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3);

      if (tokens[0]) {
        return tokens[0];
      }
    }
  }

  return "notepad";
}

function ensureRunDir(root: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runId = randomUUID().slice(0, 8);
  const runDir = resolve(root, "artifacts", "runs", `${stamp}-real-user-smoke-${runId}`);

  const directories = [
    runDir,
    resolve(runDir, "ui"),
    resolve(runDir, "api"),
    resolve(runDir, "bridge"),
    resolve(runDir, "notepad"),
    resolve(runDir, "files"),
    resolve(runDir, "oracle"),
    resolve(runDir, "shortcut"),
  ];

  for (const directory of directories) {
    mkdirSync(directory, { recursive: true });
  }

  return { runDir, runId };
}

const repoRoot = getRepoRoot();
const { runDir, runId } = ensureRunDir(repoRoot);

const inventoryBeforeResponse = await runBridge<BridgeInventoryResponse>("Inventory");
const snapshot = await getSnapshot();
const diagnostics = getDiagnostics();
const searchToken = pickSearchToken(snapshot);
const searchResponse = await searchLiveSnapshot(searchToken, "search");
const queryResponse = await searchLiveSnapshot(searchToken, "query");
const inventoryAfterResponse = await runBridge<BridgeInventoryResponse>("Inventory");

const inventoryBefore = inventoryBeforeResponse.inventory;
const inventoryAfter = inventoryAfterResponse.inventory;
const totalProcessDelta = inventoryAfter.processCount - inventoryBefore.processCount;
const totalWindowDelta = inventoryAfter.windowCount - inventoryBefore.windowCount;

const compliant =
  totalProcessDelta === 0 &&
  totalWindowDelta === 0 &&
  snapshot.diagnostics.selectionActionsDuringSnapshot === 0 &&
  snapshot.diagnostics.focusChangedDuringSnapshot === false &&
  snapshot.diagnostics.windowActivatedDuringSnapshot === false;

const summary = [
  "# Real User Smoke",
  "",
  `- Run ID: ${runId}`,
  `- Snapshot request ID: ${snapshot.diagnostics.requestId}`,
  `- Bridge action ID: ${snapshot.diagnostics.bridgeActionId}`,
  `- Bridge mode: ${snapshot.diagnostics.bridgeMode}`,
  `- Session read kind: ${snapshot.diagnostics.sessionReadKind}`,
  `- Windows discovered: ${snapshot.windows.length}`,
  `- Tabs discovered: ${snapshot.windows.reduce((sum, window) => sum + window.tabs.length, 0)}`,
  `- Search results: ${searchResponse.resultCount}`,
  `- Query results: ${queryResponse.resultCount}`,
  `- Snapshot selection actions: ${snapshot.diagnostics.selectionActionsDuringSnapshot}`,
  `- Snapshot focus changed: ${snapshot.diagnostics.focusChangedDuringSnapshot}`,
  `- Snapshot window activated: ${snapshot.diagnostics.windowActivatedDuringSnapshot}`,
  `- Run-level Notepad process delta: ${totalProcessDelta}`,
  `- Run-level Notepad window delta: ${totalWindowDelta}`,
  `- Compliance verdict: ${compliant ? "pass" : "fail"}`,
  "",
].join("\n");

writeFileSync(resolve(runDir, "summary.md"), summary, "utf8");
writeFileSync(
  resolve(runDir, "bundle-manifest.json"),
  JSON.stringify(
    {
      runId,
      files: [
        "summary.md",
        "bundle-manifest.json",
        "app.log.jsonl",
        "events.jsonl",
        "trace.json",
        "metrics.json",
        "inputs.sanitized.json",
        "effective-config.sanitized.json",
        "state-before.json",
        "state-after.json",
        "stdout.log",
        "stderr.log",
        "network.har",
        "ui/",
        "api/",
        "bridge/",
        "notepad/",
        "files/",
        "oracle/",
        "shortcut/",
      ],
    },
    null,
    2,
  ),
  "utf8",
);
writeFileSync(resolve(runDir, "app.log.jsonl"), "", "utf8");
writeFileSync(resolve(runDir, "events.jsonl"), "", "utf8");
writeFileSync(
  resolve(runDir, "trace.json"),
  JSON.stringify(
    {
      runId,
      traces: [
        {
          snapshotRequestId: snapshot.diagnostics.requestId,
          bridgeActionId: snapshot.diagnostics.bridgeActionId,
        },
      ],
    },
    null,
    2,
  ),
  "utf8",
);
writeFileSync(
  resolve(runDir, "metrics.json"),
  JSON.stringify(
    {
      searchResultCount: searchResponse.resultCount,
      queryResultCount: queryResponse.resultCount,
      totalProcessDelta,
      totalWindowDelta,
    },
    null,
    2,
  ),
  "utf8",
);
writeFileSync(
  resolve(runDir, "inputs.sanitized.json"),
  JSON.stringify(
    {
      searchToken: sanitizeString(searchToken),
      searchMode: "search",
      queryMode: "query",
    },
    null,
    2,
  ),
  "utf8",
);
writeFileSync(
  resolve(runDir, "effective-config.sanitized.json"),
  JSON.stringify(
    {
      bridgeMode: diagnostics.bridgeMode,
      actualPort: diagnostics.actualPort,
      noNewNotepadRequired: true,
      saveVerificationInScope: false,
    },
    null,
    2,
  ),
  "utf8",
);
writeFileSync(resolve(runDir, "state-before.json"), JSON.stringify(sanitizeInventory(inventoryBefore), null, 2), "utf8");
writeFileSync(resolve(runDir, "state-after.json"), JSON.stringify(sanitizeInventory(inventoryAfter), null, 2), "utf8");
writeFileSync(resolve(runDir, "stdout.log"), "", "utf8");
writeFileSync(resolve(runDir, "stderr.log"), "", "utf8");
writeFileSync(resolve(runDir, "network.har"), JSON.stringify({ log: { entries: [] } }, null, 2), "utf8");

writeFileSync(resolve(runDir, "api", "snapshot.sanitized.json"), JSON.stringify(sanitizeSnapshot(snapshot), null, 2), "utf8");
writeFileSync(
  resolve(runDir, "api", "search.sanitized.json"),
  JSON.stringify(
    {
      query: sanitizeString(searchToken),
      summary: searchResponse.summary,
      resultCount: searchResponse.resultCount,
      results: searchResponse.results.map((result) => ({
        ...result,
        tabTitle: sanitizeString(result.tabTitle),
        snippet: sanitizeString(result.snippet),
      })),
    },
    null,
    2,
  ),
  "utf8",
);
writeFileSync(
  resolve(runDir, "api", "query.sanitized.json"),
  JSON.stringify(
    {
      query: sanitizeString(searchToken),
      summary: queryResponse.summary,
      resultCount: queryResponse.resultCount,
      results: queryResponse.results.map((result) => ({
        ...result,
        tabTitle: sanitizeString(result.tabTitle),
        snippet: sanitizeString(result.snippet),
      })),
    },
    null,
    2,
  ),
  "utf8",
);

writeFileSync(
  resolve(runDir, "bridge", "nonvisual-proof.json"),
  JSON.stringify(
    {
      requestId: snapshot.diagnostics.requestId,
      bridgeActionId: snapshot.diagnostics.bridgeActionId,
      selectionActionsDuringSnapshot: snapshot.diagnostics.selectionActionsDuringSnapshot,
      focusChangedDuringSnapshot: snapshot.diagnostics.focusChangedDuringSnapshot,
      windowActivatedDuringSnapshot: snapshot.diagnostics.windowActivatedDuringSnapshot,
      newNotepadProcessCountDelta: snapshot.diagnostics.newNotepadProcessCountDelta,
      newNotepadWindowCountDelta: snapshot.diagnostics.newNotepadWindowCountDelta,
      runLevelProcessDelta: totalProcessDelta,
      runLevelWindowDelta: totalWindowDelta,
    },
    null,
    2,
  ),
  "utf8",
);
writeFileSync(
  resolve(runDir, "bridge", "selection-focus-telemetry.json"),
  JSON.stringify(
    {
      requestId: snapshot.diagnostics.requestId,
      foregroundWindowHandleBefore: snapshot.diagnostics.foregroundWindowHandleBefore,
      foregroundWindowHandleAfter: snapshot.diagnostics.foregroundWindowHandleAfter,
      focusChangedDuringSnapshot: snapshot.diagnostics.focusChangedDuringSnapshot,
      windowActivatedDuringSnapshot: snapshot.diagnostics.windowActivatedDuringSnapshot,
    },
    null,
    2,
  ),
  "utf8",
);
writeFileSync(
  resolve(runDir, "bridge", "session-source-report.json"),
  JSON.stringify(
    {
      stateRoot: snapshot.diagnostics.stateRoot,
      windowStateDir: snapshot.diagnostics.windowStateDir,
      tabStateDir: snapshot.diagnostics.tabStateDir,
      matchedWindowStateCount: snapshot.diagnostics.matchedWindowStateCount,
      unmatchedWindowCount: snapshot.diagnostics.unmatchedWindowCount,
      selectedDocumentAgreementCount: snapshot.diagnostics.selectedDocumentAgreementCount,
      warnings: snapshot.diagnostics.warnings,
    },
    null,
    2,
  ),
  "utf8",
);
writeFileSync(
  resolve(runDir, "bridge", "tab-identity-map.json"),
  JSON.stringify(
    snapshot.windows.map((window) => ({
      handle: window.handle,
      processId: window.processId,
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
    null,
    2,
  ),
  "utf8",
);

writeFileSync(resolve(runDir, "notepad", "process-inventory-before.json"), JSON.stringify(sanitizeInventory(inventoryBefore), null, 2), "utf8");
writeFileSync(resolve(runDir, "notepad", "process-inventory-after.json"), JSON.stringify(sanitizeInventory(inventoryAfter), null, 2), "utf8");
writeFileSync(resolve(runDir, "notepad", "window-inventory-before.json"), JSON.stringify(sanitizeInventory(inventoryBefore), null, 2), "utf8");
writeFileSync(resolve(runDir, "notepad", "window-inventory-after.json"), JSON.stringify(sanitizeInventory(inventoryAfter), null, 2), "utf8");

writeFileSync(
  resolve(runDir, "oracle", "oracle-surface-proof.json"),
  JSON.stringify(
    {
      runId: diagnostics.runId,
      actualPort: diagnostics.actualPort,
      oracleDocPath: diagnostics.oracleDocPath,
      oracleYamlPath: diagnostics.oracleYamlPath,
      oracleSourcePath: diagnostics.oracleSourcePath,
      oracleCommandPath: diagnostics.oracleCommandPath,
      oracleCommand: diagnostics.oracleCommand,
      includeGlobs: diagnostics.includeGlobs,
      excludeGlobs: diagnostics.excludeGlobs,
      sanitizationRules: diagnostics.sanitizationRules,
      currentObjective: diagnostics.currentObjective,
      currentFailureOrUncertainty: diagnostics.currentFailureOrUncertainty,
      evidenceSufficient: diagnostics.evidenceSufficient,
    },
    null,
    2,
  ),
  "utf8",
);

markVerificationRun(runDir);
if (compliant) {
  markKnownGoodRun(runDir);
}

if (!compliant) {
  writeFileSync(
    resolve(runDir, "exception.json"),
    JSON.stringify(
      {
        message: "Real-user smoke detected a no-new-instance or non-visual invariant failure.",
        totalProcessDelta,
        totalWindowDelta,
        snapshotDiagnostics: snapshot.diagnostics,
      },
      null,
      2,
    ),
    "utf8",
  );
  throw new Error(`Real-user smoke failed. Artifacts: ${runDir}`);
}

console.log(runDir);
