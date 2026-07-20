import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOracleCommand,
  createOracleManifest,
} from "./diagnostics/oracleManifest.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const packageJsonPath = resolve(repoRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
  version?: string;
};
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const runId = randomUUID().slice(0, 8);
const runDir = resolve(repoRoot, "artifacts", "runs", `${stamp}-server-${runId}`);
const latestDir = resolve(repoRoot, "artifacts", "latest");
const currentRunPath = resolve(latestDir, "current-run.txt");
const oracleCommandPath = resolve(latestDir, "oracle-bundle-command.txt");
const launcherStatusPath = resolve(latestDir, "launcher-status.json");
const verificationRunPath = resolve(latestDir, "verification-run.txt");
const knownGoodRunPath = resolve(latestDir, "known-good-run.txt");
const realAuditRunPath = resolve(latestDir, "real-user-audit.txt");
const appLogPath = resolve(runDir, "app.log.jsonl");
const eventsPath = resolve(runDir, "events.jsonl");
const summaryPath = resolve(runDir, "summary.md");
const metricsPath = resolve(runDir, "metrics.json");
const bundleManifestPath = resolve(runDir, "bundle-manifest.json");
const effectiveConfigPath = resolve(runDir, "effective-config.sanitized.json");
const inputsPath = resolve(runDir, "inputs.sanitized.json");
const stateBeforePath = resolve(runDir, "state-before.json");
const stateAfterPath = resolve(runDir, "state-after.json");
const tracePath = resolve(runDir, "trace.json");
const stdoutPath = resolve(runDir, "stdout.log");
const stderrPath = resolve(runDir, "stderr.log");
const networkHarPath = resolve(runDir, "network.har");

interface RuntimeState {
  actualPort: number | null;
  lastSnapshotRequestId: string | null;
  lastSaveRequestId: string | null;
  lastBridgeActionId: string | null;
  latestVerificationRunDir: string | null;
  latestKnownGoodRunDir: string | null;
  latestRealAuditDir: string | null;
}

const runtimeState: RuntimeState = {
  actualPort: null,
  lastSnapshotRequestId: null,
  lastSaveRequestId: null,
  lastBridgeActionId: null,
  latestVerificationRunDir: null,
  latestKnownGoodRunDir: null,
  latestRealAuditDir: null,
};

function ensureRunScaffold(): void {
  const directories = [
    runDir,
    latestDir,
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

  if (!existsSync(summaryPath)) {
    writeFileSync(
      summaryPath,
      [
        "# Run Summary",
        "",
        `- Run ID: ${runId}`,
        `- Started: ${new Date().toISOString()}`,
        "",
      ].join("\n"),
      "utf8",
    );
  }

  const initialFiles: Array<[string, string]> = [
    [
      bundleManifestPath,
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
    ],
    [metricsPath, JSON.stringify({ snapshots: 0, saves: 0, searches: 0 }, null, 2)],
    [effectiveConfigPath, JSON.stringify({ repoRoot }, null, 2)],
    [inputsPath, JSON.stringify([], null, 2)],
    [stateBeforePath, JSON.stringify({}, null, 2)],
    [stateAfterPath, JSON.stringify({}, null, 2)],
    [tracePath, JSON.stringify({ runId, traces: [] }, null, 2)],
    [stdoutPath, ""],
    [stderrPath, ""],
    [networkHarPath, JSON.stringify({ log: { entries: [] } }, null, 2)],
  ];

  for (const [filePath, value] of initialFiles) {
    if (!existsSync(filePath)) {
      writeFileSync(filePath, value, "utf8");
    }
  }

  writeFileSync(currentRunPath, runDir, "utf8");
  writeFileSync(oracleCommandPath, buildOracleCommand(), "utf8");
}

ensureRunScaffold();

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function readJsonFile<T>(filePath: string): T {
  const raw = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw) as T;
}

export function sanitizeString(value: string | null | undefined): unknown {
  if (value == null) {
    return null;
  }

  return {
    length: value.length,
    sha256: sha256(value),
  };
}

export function appendJsonl(filePath: string, value: unknown): void {
  appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

export function logEvent(kind: string, detail: Record<string, unknown>): void {
  const event = {
    at: new Date().toISOString(),
    kind,
    ...detail,
  };

  appendJsonl(appLogPath, event);
  appendJsonl(eventsPath, event);
}

export function writeRunArtifact(relativePath: string, value: unknown): string {
  const artifactPath = resolve(runDir, relativePath);
  mkdirSync(dirname(artifactPath), { recursive: true });
  writeFileSync(
    artifactPath,
    typeof value === "string" ? value : JSON.stringify(value, null, 2),
    "utf8",
  );
  return artifactPath;
}

export function nextRequestId(kind: "snapshot" | "save" | "search"): string {
  const requestId = `${kind}-${randomUUID().slice(0, 8)}`;

  if (kind === "snapshot") {
    runtimeState.lastSnapshotRequestId = requestId;
  } else if (kind === "save") {
    runtimeState.lastSaveRequestId = requestId;
  }

  return requestId;
}

export function recordBridgeAction(actionId: string | null | undefined): void {
  if (actionId) {
    runtimeState.lastBridgeActionId = actionId;
  }
}

export function setActualPort(port: number): void {
  runtimeState.actualPort = port;
  logEvent("server.listen", { port });
}

export function bumpMetric(metric: "snapshots" | "saves" | "searches"): void {
  const metrics = JSON.parse(readFileSync(metricsPath, "utf8")) as Record<string, number>;
  metrics[metric] = (metrics[metric] ?? 0) + 1;
  writeFileSync(metricsPath, JSON.stringify(metrics, null, 2), "utf8");
}

export function markVerificationRun(directory: string): void {
  runtimeState.latestVerificationRunDir = directory;
  writeFileSync(verificationRunPath, directory, "utf8");
}

export function markKnownGoodRun(directory: string): void {
  runtimeState.latestKnownGoodRunDir = directory;
  writeFileSync(knownGoodRunPath, directory, "utf8");
}

export function markRealAuditRun(directory: string): void {
  runtimeState.latestRealAuditDir = directory;
  writeFileSync(realAuditRunPath, directory, "utf8");
}

export function getRuntimeDiagnostics() {
  const launcherStatus =
    existsSync(launcherStatusPath)
      ? (readJsonFile(launcherStatusPath) as {
          actualPort?: number;
        })
      : null;
  const latestVerificationRunDir =
    runtimeState.latestVerificationRunDir ??
    (existsSync(verificationRunPath)
      ? readFileSync(verificationRunPath, "utf8").trim()
      : null);
  const latestKnownGoodRunDir =
    runtimeState.latestKnownGoodRunDir ??
    (existsSync(knownGoodRunPath)
      ? readFileSync(knownGoodRunPath, "utf8").trim()
      : null);
  const latestRealAuditDir =
    runtimeState.latestRealAuditDir ??
    (existsSync(realAuditRunPath) ? readFileSync(realAuditRunPath, "utf8").trim() : null);

  const manifest = createOracleManifest({
    repoRoot,
    latestArtifactsDir: runDir,
    latestVerificationRunDir,
    latestKnownGoodRunDir,
    latestRealAuditDir,
    runId,
    actualPort: runtimeState.actualPort ?? launcherStatus?.actualPort ?? 0,
    lastSnapshotRequestId: runtimeState.lastSnapshotRequestId,
    lastSaveRequestId: runtimeState.lastSaveRequestId,
    lastBridgeActionId: runtimeState.lastBridgeActionId,
  });

  return {
    appVersion: packageJson.version ?? "0.0.0",
    actualPort: runtimeState.actualPort ?? launcherStatus?.actualPort ?? 0,
    runId,
    latestArtifactsDir: runDir,
    latestVerificationRunDir,
    latestKnownGoodRunDir,
    latestRealAuditDir,
    lastSnapshotRequestId: runtimeState.lastSnapshotRequestId,
    lastSaveRequestId: runtimeState.lastSaveRequestId,
    lastBridgeActionId: runtimeState.lastBridgeActionId,
    oracleDocPath: manifest.paths.docPath,
    oracleYamlPath: manifest.paths.yamlPath,
    oracleSourcePath: manifest.paths.sourcePath,
    oracleCommandPath: manifest.paths.commandPath,
    oracleCommand: manifest.oracleCommand,
    includeGlobs: manifest.includeGlobs,
    excludeGlobs: manifest.excludeGlobs,
    sanitizationRules: manifest.sanitizationRules,
    currentObjective: manifest.currentObjective,
    currentFailureOrUncertainty: manifest.currentFailureOrUncertainty,
    reproductionSteps: manifest.reproductionSteps,
    evidenceSufficient: manifest.evidenceSufficient,
  };
}

export function getRunDir(): string {
  return runDir;
}

export function getRepoRoot(): string {
  return repoRoot;
}
