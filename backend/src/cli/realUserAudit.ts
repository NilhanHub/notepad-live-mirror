import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSnapshot } from "../notepadService.js";
import { getRepoRoot, markRealAuditRun, sanitizeString } from "../runtime.js";

const snapshot = await getSnapshot();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const runId = randomUUID().slice(0, 8);
const auditDir = resolve(
  getRepoRoot(),
  "artifacts",
  "runs",
  `${stamp}-real-user-audit-${runId}`,
);

mkdirSync(auditDir, { recursive: true });

const sanitized = {
  refreshedAt: snapshot.refreshedAt,
  diagnostics: snapshot.diagnostics,
  windows: snapshot.windows.map((window) => ({
    handle: window.handle,
    processId: window.processId,
    label: window.label,
    tabCount: window.tabs.length,
    windowTitle: sanitizeString(window.windowTitle),
    tabs: window.tabs.map((tab) => ({
      stateId: tab.stateId,
      runtimeId: tab.runtimeId,
      title: sanitizeString(tab.title),
      sourceKind: tab.sourceKind,
      sourceFilePath: sanitizeString(tab.sourceFilePath ?? null),
      text: sanitizeString(tab.text),
      selectedInWindow: tab.selectedInWindow,
      duplicateIndex: tab.duplicateIndex,
      duplicateCount: tab.duplicateCount,
    })),
  })),
};

writeFileSync(
  resolve(auditDir, "summary.md"),
  [
    "# Real User Audit",
    "",
    `- Run ID: ${runId}`,
    `- Refreshed at: ${snapshot.refreshedAt}`,
    `- Bridge mode: ${snapshot.diagnostics.bridgeMode}`,
    `- Windows: ${snapshot.windows.length}`,
    `- Tabs: ${snapshot.windows.reduce((sum, window) => sum + window.tabs.length, 0)}`,
    `- Selection actions during snapshot: ${snapshot.diagnostics.selectionActionsDuringSnapshot}`,
    `- Focus changed during snapshot: ${snapshot.diagnostics.focusChangedDuringSnapshot}`,
    "",
  ].join("\n"),
  "utf8",
);
writeFileSync(
  resolve(auditDir, "snapshot.sanitized.json"),
  JSON.stringify(sanitized, null, 2),
  "utf8",
);
writeFileSync(
  resolve(auditDir, "proof.json"),
  JSON.stringify(
    {
      requestId: snapshot.diagnostics.requestId,
      bridgeActionId: snapshot.diagnostics.bridgeActionId,
      matchedWindowStateCount: snapshot.diagnostics.matchedWindowStateCount,
      unmatchedWindowCount: snapshot.diagnostics.unmatchedWindowCount,
      selectedDocumentAgreementCount:
        snapshot.diagnostics.selectedDocumentAgreementCount,
      warnings: snapshot.diagnostics.warnings,
    },
    null,
    2,
  ),
  "utf8",
);

markRealAuditRun(auditDir);
console.log(auditDir);
