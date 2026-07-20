import { describe, expect, it } from "vitest";
import { extractApiErrorMessage } from "../../frontend/src/api.js";

describe("extractApiErrorMessage", () => {
  it("prefers a structured API message when present", () => {
    expect(
      extractApiErrorMessage(
        "Internal Server Error",
        JSON.stringify({
          kind: "error",
          code: "bridge_failed",
          message: "Bridge failed with a specific reason.",
        }),
        "Failed to refresh the live Notepad session.",
      ),
    ).toBe("Bridge failed with a specific reason.");
  });

  it("falls back to the HTTP status text when the body is not JSON", () => {
    expect(
      extractApiErrorMessage(
        "Internal Server Error",
        "plain-text failure",
        "Failed to refresh the live Notepad session.",
      ),
    ).toBe("Internal Server Error");
  });
});
