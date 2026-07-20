import { getSnapshot } from "../notepadService.js";

const snapshot = await getSnapshot();

if (!snapshot.windows.length) {
  console.log("No visible Notepad windows found.");
  process.exit(0);
}

for (const window of snapshot.windows) {
  console.log("");
  console.log(
    `Window ${window.label} | Handle ${window.handle} | Tabs ${window.tabs.length}`,
  );

  for (const tab of window.tabs) {
    const marker = tab.selectedInWindow ? "*" : " ";
    const duplicate =
      tab.duplicateCount > 1
        ? ` duplicate=${tab.duplicateIndex}/${tab.duplicateCount}`
        : "";
    console.log(
      `  ${marker} state=${tab.stateId} runtime=${tab.runtimeId} order=${tab.order} chars=${tab.text.length}${duplicate} source=${tab.sourceKind}`,
    );
  }
}

console.log("");
console.log(
  JSON.stringify(
    {
      bridgeMode: snapshot.diagnostics.bridgeMode,
      sessionReadKind: snapshot.diagnostics.sessionReadKind,
      requestId: snapshot.diagnostics.requestId,
      bridgeActionId: snapshot.diagnostics.bridgeActionId,
      selectionActionsDuringSnapshot:
        snapshot.diagnostics.selectionActionsDuringSnapshot,
      focusChangedDuringSnapshot: snapshot.diagnostics.focusChangedDuringSnapshot,
      windowActivatedDuringSnapshot:
        snapshot.diagnostics.windowActivatedDuringSnapshot,
      newNotepadProcessCountDelta:
        snapshot.diagnostics.newNotepadProcessCountDelta,
      newNotepadWindowCountDelta:
        snapshot.diagnostics.newNotepadWindowCountDelta,
      warnings: snapshot.diagnostics.warnings,
    },
    null,
    2,
  ),
);
