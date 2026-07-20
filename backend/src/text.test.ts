import { describe, expect, it } from "vitest";
import {
  applyDuplicateMetadata,
  deriveTabTitle,
  normalizeBridgeTextToUi,
  normalizeUiTextToBridge,
} from "./text.js";

describe("text normalization", () => {
  it("maps bridge carriage returns into editor newlines", () => {
    expect(normalizeBridgeTextToUi("alpha\rbeta\r\rgamma\t  \r")).toBe(
      "alpha\nbeta\n\ngamma\t  \n",
    );
  });

  it("maps editor newlines back into bridge carriage returns", () => {
    expect(normalizeUiTextToBridge("alpha\nbeta\n\ngamma\t  \n")).toBe(
      "alpha\rbeta\r\rgamma\t  \r",
    );
  });
});

describe("title derivation", () => {
  it("prefers the live window title when available", () => {
    expect(
      deriveTabTitle(
        "*Video Ads.txt - Notepad",
        "Video Ads.txt. Modified.",
        null,
        true,
      ),
    ).toBe("Video Ads.txt");
  });

  it("falls back to accessible names for untitled tabs", () => {
    expect(deriveTabTitle("", "Untitled. Modified.", null, false)).toBe("Untitled");
  });

  it("prefers a source file basename when the tab comes from disk", () => {
    expect(
      deriveTabTitle(
        "*Current tab - Notepad",
        "Current tab. Unmodified.",
        "C:\\Users\\Example\\Desktop\\Notes.txt",
        false,
      ),
    ).toBe("Notes.txt");
  });
});

describe("duplicate metadata", () => {
  it("indexes duplicate titles without touching unique ones", () => {
    const result = applyDuplicateMetadata([
      {
        id: "1",
        stateId: "s1",
        windowHandle: "w",
        runtimeId: "a",
        title: "Untitled",
        accessibleName: "Untitled. Modified.",
        windowTitle: "*Untitled - Notepad",
        order: 0,
        selectedInWindow: true,
        modified: true,
        text: "a",
        rawText: "a",
        sourceKind: "unsaved-buffer",
        sourceFilePath: null,
        sourceFileExists: false,
        carriageReturnType: null,
        encodingType: null,
      },
      {
        id: "2",
        stateId: "s2",
        windowHandle: "w",
        runtimeId: "b",
        title: "Untitled",
        accessibleName: "Untitled. Modified.",
        windowTitle: "*Untitled - Notepad",
        order: 1,
        selectedInWindow: false,
        modified: true,
        text: "b",
        rawText: "b",
        sourceKind: "unsaved-buffer",
        sourceFilePath: null,
        sourceFileExists: false,
        carriageReturnType: null,
        encodingType: null,
      },
      {
        id: "3",
        stateId: "s3",
        windowHandle: "w",
        runtimeId: "c",
        title: "Notes",
        accessibleName: "Notes. Modified.",
        windowTitle: "*Notes - Notepad",
        order: 2,
        selectedInWindow: false,
        modified: true,
        text: "c",
        rawText: "c",
        sourceKind: "unsaved-buffer",
        sourceFilePath: null,
        sourceFileExists: false,
        carriageReturnType: null,
        encodingType: null,
      },
    ]);

    expect(result.map((tab) => [tab.title, tab.duplicateIndex, tab.duplicateCount])).toEqual([
      ["Untitled", 1, 2],
      ["Untitled", 2, 2],
      ["Notes", 1, 1],
    ]);
  });
});
