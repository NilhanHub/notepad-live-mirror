import { basename } from "node:path";
import type { ApiTab, ApiTabBase } from "./contracts.js";

const WINDOW_SUFFIX = " - Notepad";

export function makeTabId(windowHandle: string, stateId: string): string {
  return `${windowHandle}::${stateId}`;
}

export function decodeBridgeText(rawTextBase64: string): string {
  return Buffer.from(rawTextBase64, "base64").toString("utf8");
}

export function normalizeBridgeTextToUi(rawText: string): string {
  return rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function normalizeUiTextToBridge(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "\r");
}

export function trimAccessibleTabName(accessibleName: string): string {
  return accessibleName.replace(/\.\s(?:Modified|Unmodified)\.$/, "").trim();
}

export function stripNotepadWindowTitle(windowTitle: string): string {
  let value = windowTitle.endsWith(WINDOW_SUFFIX)
    ? windowTitle.slice(0, -WINDOW_SUFFIX.length)
    : windowTitle;

  if (value.startsWith("*")) {
    value = value.slice(1);
  }

  return value.trim();
}

export function deriveTabTitle(
  windowTitle: string,
  accessibleName: string,
  sourceFilePath: string | null,
  selectedInWindow: boolean,
): string {
  const fromPath = sourceFilePath ? basename(sourceFilePath) : "";

  if (fromPath.length > 0) {
    return fromPath;
  }

  const fromAccessible = trimAccessibleTabName(accessibleName);
  if (fromAccessible.length > 0) {
    return fromAccessible;
  }

  const fromWindow = stripNotepadWindowTitle(windowTitle);
  if (selectedInWindow && fromWindow.length > 0) {
    return fromWindow;
  }

  return fromWindow.length > 0 ? fromWindow : "Untitled";
}

export function buildWindowLabel(index: number, totalWindows: number): string {
  return totalWindows > 1 ? `Window ${index + 1}` : "Live Notepad";
}

export function toApiTabBase(tab: {
  stateId: string;
  windowHandle: string;
  runtimeId: string;
  accessibleName: string;
  windowTitle: string;
  order: number;
  selectedInWindow: boolean;
  modified: boolean;
  rawText: string;
  sourceKind: ApiTabBase["sourceKind"];
  sourceFilePath: string | null;
  sourceFileExists: boolean;
  carriageReturnType: number | null;
  encodingType: number | null;
}): ApiTabBase {
  return {
    id: makeTabId(tab.windowHandle, tab.stateId),
    stateId: tab.stateId,
    windowHandle: tab.windowHandle,
    runtimeId: tab.runtimeId,
    title: deriveTabTitle(
      tab.windowTitle,
      tab.accessibleName,
      tab.sourceFilePath,
      tab.selectedInWindow,
    ),
    accessibleName: tab.accessibleName,
    windowTitle: tab.windowTitle,
    order: tab.order,
    selectedInWindow: tab.selectedInWindow,
    modified: tab.modified,
    text: normalizeBridgeTextToUi(tab.rawText),
    rawText: tab.rawText,
    sourceKind: tab.sourceKind,
    sourceFilePath: tab.sourceFilePath,
    sourceFileExists: tab.sourceFileExists,
    carriageReturnType: tab.carriageReturnType,
    encodingType: tab.encodingType,
  };
}

export function applyDuplicateMetadata(tabs: ApiTabBase[]): ApiTab[] {
  const counts = new Map<string, number>();
  const offsets = new Map<string, number>();

  for (const tab of tabs) {
    counts.set(tab.title, (counts.get(tab.title) ?? 0) + 1);
  }

  return tabs.map((tab) => {
    const nextIndex = (offsets.get(tab.title) ?? 0) + 1;
    offsets.set(tab.title, nextIndex);

    return {
      ...tab,
      duplicateIndex: nextIndex,
      duplicateCount: counts.get(tab.title) ?? 1,
    };
  });
}
