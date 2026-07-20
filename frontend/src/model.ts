import type { ApiSnapshot, ApiTab, ApiTabBase, ApiWindow } from "./types.js";

function toTabWithDuplicates(tabs: ApiTabBase[]): ApiTab[] {
  const counts = new Map<string, number>();
  const offsets = new Map<string, number>();

  for (const tab of tabs) {
    counts.set(tab.title, (counts.get(tab.title) ?? 0) + 1);
  }

  return tabs.map((tab) => {
    const duplicateIndex = (offsets.get(tab.title) ?? 0) + 1;
    offsets.set(tab.title, duplicateIndex);

    return {
      ...tab,
      duplicateIndex,
      duplicateCount: counts.get(tab.title) ?? 1,
    };
  });
}

function stripDuplicateMetadata(tab: ApiTab): ApiTabBase {
  const { duplicateCount: _duplicateCount, duplicateIndex: _duplicateIndex, ...base } =
    tab;
  return base;
}

export function findTabById(
  snapshot: ApiSnapshot | null,
  tabId: string | null,
): ApiTab | null {
  if (!snapshot || !tabId) {
    return null;
  }

  for (const window of snapshot.windows) {
    const match = window.tabs.find((tab) => tab.id === tabId);
    if (match) {
      return match;
    }
  }

  return null;
}

export function chooseSelectedTabId(
  snapshot: ApiSnapshot,
  preferredTabId: string | null,
): string | null {
  if (preferredTabId && findTabById(snapshot, preferredTabId)) {
    return preferredTabId;
  }

  for (const window of snapshot.windows) {
    const selected = window.tabs.find((tab) => tab.selectedInWindow);

    if (selected) {
      return selected.id;
    }
  }

  return snapshot.windows.flatMap((window) => window.tabs)[0]?.id ?? null;
}

export function mergeTabIntoSnapshot(
  snapshot: ApiSnapshot | null,
  updatedTab: ApiTabBase,
): ApiSnapshot | null {
  if (!snapshot) {
    return null;
  }

  const windows = snapshot.windows.map((window) => {
    if (!window.tabs.some((tab) => tab.id === updatedTab.id)) {
      return window;
    }

    const nextTabs = window.tabs.map((tab) =>
      tab.id === updatedTab.id ? updatedTab : stripDuplicateMetadata(tab),
    );

    return {
      ...window,
      windowTitle:
        window.handle === updatedTab.windowHandle
          ? updatedTab.windowTitle
          : window.windowTitle,
      tabs: toTabWithDuplicates(nextTabs),
    } satisfies ApiWindow;
  });

  return {
    ...snapshot,
    windows,
  };
}
