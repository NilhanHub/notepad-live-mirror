import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const bridgeScriptPath = resolve(repoRoot, "bridge", "NotepadBridge.ps1");

export class BridgeExecutionError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BridgeExecutionError";
    this.code = code;
  }
}

export async function runBridge<T>(
  command: "Snapshot" | "Save" | "Inspect" | "Inventory",
  payload?: unknown,
  attempt = 0,
): Promise<T> {
  return new Promise<T>((resolvePromise, rejectPromise) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        bridgeScriptPath,
        "-Command",
        command,
      ],
      {
        cwd: repoRoot,
        windowsHide: true,
      },
    );

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      rejectPromise(
        new BridgeExecutionError(
          "bridge_timeout",
          "The Notepad bridge timed out before returning.",
        ),
      );
    }, 15000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      rejectPromise(
        new BridgeExecutionError(
          "spawn_failed",
          error.message || "Failed to start the Notepad bridge.",
        ),
      );
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      if (exitCode !== 0) {
        const error = new BridgeExecutionError(
          "bridge_failed",
          stderr.trim() || stdout.trim() || "The Notepad bridge failed.",
        );

        if (attempt < 1 && command !== "Save") {
          setTimeout(() => {
            void runBridge<T>(command, payload, attempt + 1)
              .then(resolvePromise)
              .catch(rejectPromise);
          }, 150);
          return;
        }

        rejectPromise(error);
        return;
      }

      try {
        resolvePromise(JSON.parse(stdout) as T);
      } catch (error) {
        const parseError = new BridgeExecutionError(
          "bridge_parse_failed",
          error instanceof Error
            ? error.message
            : "The Notepad bridge returned invalid JSON.",
        );

        if (attempt < 1 && command !== "Save") {
          setTimeout(() => {
            void runBridge<T>(command, payload, attempt + 1)
              .then(resolvePromise)
              .catch(rejectPromise);
          }, 150);
          return;
        }

        rejectPromise(parseError);
      }
    });

    if (payload !== undefined) {
      child.stdin.write(JSON.stringify(payload));
    }

    child.stdin.end();
  });
}
