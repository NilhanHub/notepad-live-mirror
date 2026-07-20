import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function captureEvidence(page: Page, testInfo: TestInfo, name: string) {
  const outputPath = testInfo.outputPath(name);
  try {
    await page.screenshot({ path: outputPath, fullPage: true, animations: "disabled" });
  } catch {
    // Chromium can occasionally reject a full-page capture on Windows even
    // after every UI assertion has passed. Preserve deterministic evidence by
    // retrying once with the current viewport; a second failure still fails.
    await page.waitForTimeout(250);
    await page.screenshot({ path: outputPath, animations: "disabled" });
  }
}

const diagnosticsPayload = {
  appVersion: "0.1.0",
  actualPort: 43117,
  runId: "run-headless",
  bridgeMode: "non_visual_session_state",
  latestArtifactsDir: "<project-root>\\artifacts\\runs\\headless",
  latestVerificationRunDir: "<project-root>\\artifacts\\runs\\verification",
  latestKnownGoodRunDir: "<project-root>\\artifacts\\runs\\known-good",
  latestRealAuditDir: "<project-root>\\artifacts\\runs\\real-user",
  oracleDocPath: "<project-root>\\docs\\for-oracle-to-read.md",
  oracleYamlPath: "<project-root>\\docs\\for-oracle-to-read.yaml",
  oracleSourcePath: "<project-root>\\backend\\src\\diagnostics\\oracleManifest.ts",
  oracleCommandPath: "<project-root>\\artifacts\\latest\\oracle-bundle-command.txt",
  oracleCommand: "npx -y @steipete/oracle --render --render-plain -p \"Review\"",
  includeGlobs: ["AGENTS.md", "backend/src/**", "frontend/src/**"],
  excludeGlobs: ["node_modules/**", ".env*"],
  sanitizationRules: ["Prefer sanitized artifacts."],
  currentObjective: "Prove a local-first mirror without launching new Notepad instances.",
  currentFailureOrUncertainty: "Save remains bounded until a persistent-session-safe write is re-proven.",
  reproductionSteps: ["Run run-local.cmd.", "Run npm run smoke:live."],
  evidenceSufficient: ["selectionActionsDuringSnapshot = 0", "zero Notepad deltas"],
  lastSnapshotRequestId: "snapshot-headless",
  lastSaveRequestId: "save-headless",
  lastBridgeActionId: "bridge-headless",
};

const baseSnapshot = {
  source: "live-notepad",
  refreshedAt: "2026-04-13T12:30:00.000Z",
  hasWindows: true,
  diagnostics: {
    bridgeMode: "non_visual_session_state",
    sessionReadKind: "uia_metadata_plus_session_state",
    requestId: "snapshot-headless",
    bridgeActionId: "bridge-headless",
    selectionActionsDuringSnapshot: 0,
    focusChangedDuringSnapshot: false,
    windowActivatedDuringSnapshot: false,
    foregroundWindowHandleBefore: null,
    foregroundWindowHandleAfter: null,
    newNotepadProcessCountDelta: 0,
    newNotepadWindowCountDelta: 0,
    stateRoot:
      "C:\\Users\\Example\\AppData\\Local\\Packages\\Microsoft.WindowsNotepad_8wekyb3d8bbwe\\LocalState",
    windowStateDir: "C:\\Users\\Example\\AppData\\Local\\Packages\\Microsoft.WindowsNotepad_8wekyb3d8bbwe\\LocalState\\WindowState",
    tabStateDir: "C:\\Users\\Example\\AppData\\Local\\Packages\\Microsoft.WindowsNotepad_8wekyb3d8bbwe\\LocalState\\TabState",
    matchedWindowStateCount: 1,
    unmatchedWindowCount: 0,
    selectedDocumentAgreementCount: 1,
    warnings: [],
  },
  windows: [
    {
      id: "window-1",
      handle: "window-1",
      processId: 100,
      label: "Live Notepad",
      windowTitle: "*Alpha Draft - Notepad",
      tabs: [
        {
          id: "window-1::tab-a",
          stateId: "tab-a",
          windowHandle: "window-1",
          runtimeId: "runtime-a",
          title: "Alpha Draft",
          accessibleName: "Alpha Draft. Modified.",
          windowTitle: "*Alpha Draft - Notepad",
          order: 0,
          selectedInWindow: true,
          modified: true,
          text: "A long warm line that should wrap naturally inside the editor surface without forcing horizontal scrolling for ordinary prose.",
          rawText:
            "A long warm line that should wrap naturally inside the editor surface without forcing horizontal scrolling for ordinary prose.",
          sourceKind: "unsaved-buffer",
          sourceFilePath: null,
          sourceFileExists: false,
          carriageReturnType: null,
          encodingType: null,
          duplicateIndex: 1,
          duplicateCount: 2,
        },
        {
          id: "window-1::tab-b",
          stateId: "tab-b",
          windowHandle: "window-1",
          runtimeId: "runtime-b",
          title: "Alpha Draft",
          accessibleName: "Alpha Draft. Modified.",
          windowTitle: "*Alpha Draft - Notepad",
          order: 1,
          selectedInWindow: false,
          modified: true,
          text: "Neighboring duplicate tab that must stay untouched.",
          rawText: "Neighboring duplicate tab that must stay untouched.",
          sourceKind: "unsaved-buffer",
          sourceFilePath: null,
          sourceFileExists: false,
          carriageReturnType: null,
          encodingType: null,
          duplicateIndex: 2,
          duplicateCount: 2,
        },
      ],
    },
  ],
};

async function mockCoreRoutes(page: import("@playwright/test").Page) {
  await page.route("**/api/notepad/snapshot", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(baseSnapshot),
    });
  });

  await page.route("**/api/diag/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(diagnosticsPayload),
    });
  });
}

test("wrap text, duplicate labels, search results, and diagnostics drawer render cleanly", async ({
  page,
}, testInfo) => {
  await mockCoreRoutes(page);
  await page.route("**/api/notepad/search?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "search",
        query: "neighbor",
        refreshedAt: baseSnapshot.refreshedAt,
        resultCount: 1,
        summary: "Found 1 matching passage.",
        results: [
          {
            id: "result-1",
            stateId: "tab-b",
            tabId: "window-1::tab-b",
            windowHandle: "window-1",
            tabTitle: "Alpha Draft",
            duplicateLabel: "Tab 2 of 2",
            score: 10,
            snippet: "Neighboring duplicate tab that must stay untouched.",
            matchStart: 0,
            matchEnd: 10,
          },
        ],
      }),
    });
  });

  await page.goto("/?diag=1");

  await expect(page.getByText("Alpha Draft")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: /Alpha Draft 1 of 2 modified/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Alpha Draft 2 of 2 modified/i }),
  ).toBeVisible();
  await expect(page.locator(".editor")).toHaveCSS("white-space", "pre-wrap");

  await page.getByLabel("Search the current live snapshot").fill("neighbor");
  await expect(page.getByText("Found 1 matching passage.")).toBeVisible();
  await expect(page.getByText("Neighboring duplicate tab that must stay untouched.")).toBeVisible();

  await expect(page.getByText("Bridge truth and Oracle handoff")).toBeVisible();
  await expect(page.getByText(String(diagnosticsPayload.actualPort))).toBeVisible();
  await expect(page.getByText(diagnosticsPayload.oracleDocPath)).toBeVisible();
  await expect(page.getByText(diagnosticsPayload.oracleSourcePath)).toBeVisible();
  await expect(page.getByText("npx -y @steipete/oracle")).toBeVisible();
  await expect(page.getByText("selectionActionsDuringSnapshot = 0")).toBeVisible();
  await expect(page.getByText("Window activated")).toBeVisible();

  await captureEvidence(page, testInfo, "wrap-search-diag.png");
});

test("conflict modal stays grounded and actionable", async ({ page }, testInfo) => {
  await mockCoreRoutes(page);
  await page.route("**/api/notepad/search?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "search",
        query: "",
        refreshedAt: baseSnapshot.refreshedAt,
        resultCount: 0,
        summary: "",
        results: [],
      }),
    });
  });
  await page.route("**/api/notepad/save", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "conflict",
        code: "live_changed",
        message: "The live Notepad tab changed after the last refresh.",
        tab: baseSnapshot.windows[0].tabs[0],
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Selected Notepad tab text").fill("Changed locally");
  await page.getByRole("button", { name: "Save into live Notepad" }).click();

  await expect(page.getByText("Live change detected")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload from Notepad" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Overwrite from website" })).toBeVisible();

  await captureEvidence(page, testInfo, "conflict.png");
});

test("empty state stays calm when Notepad is closed", async ({ page }, testInfo) => {
  await page.route("**/api/notepad/snapshot", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "live-notepad",
        refreshedAt: "2026-04-13T12:30:00.000Z",
        hasWindows: false,
        windows: [],
        diagnostics: {
          bridgeMode: "non_visual_session_state",
          sessionReadKind: "uia_metadata_plus_session_state",
          requestId: "snapshot-empty",
          bridgeActionId: "bridge-empty",
          selectionActionsDuringSnapshot: 0,
          focusChangedDuringSnapshot: false,
          windowActivatedDuringSnapshot: false,
          foregroundWindowHandleBefore: null,
          foregroundWindowHandleAfter: null,
          newNotepadProcessCountDelta: 0,
          newNotepadWindowCountDelta: 0,
          stateRoot: null,
          windowStateDir: null,
          tabStateDir: null,
          matchedWindowStateCount: 0,
          unmatchedWindowCount: 0,
          selectedDocumentAgreementCount: 0,
          warnings: [],
        },
      }),
    });
  });
  await page.route("**/api/diag/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(diagnosticsPayload),
    });
  });
  await page.route("**/api/notepad/search?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "search",
        query: "",
        refreshedAt: null,
        resultCount: 0,
        summary: "",
        results: [],
      }),
    });
  });

  await page.goto("/");

  await expect(page.getByText("Notepad is not open right now.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

  await captureEvidence(page, testInfo, "empty-state.png");
});
