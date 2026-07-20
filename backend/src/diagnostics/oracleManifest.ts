import { resolve } from "node:path";

export interface OracleManifestContext {
  repoRoot: string;
  latestArtifactsDir: string;
  latestVerificationRunDir: string | null;
  latestKnownGoodRunDir: string | null;
  latestRealAuditDir: string | null;
  runId: string;
  actualPort: number;
  lastSnapshotRequestId: string | null;
  lastSaveRequestId: string | null;
  lastBridgeActionId: string | null;
}

export interface OracleManifest {
  title: string;
  repo: string;
  truthSource: string;
  bridgeMode: string;
  saveBridgeMode: string;
  currentObjective: string;
  currentFailureOrUncertainty: string;
  includeGlobs: string[];
  excludeGlobs: string[];
  sanitizationRules: string[];
  reproductionSteps: string[];
  evidenceSufficient: string[];
  oracleCommand: string;
  paths: {
    sourcePath: string;
    docPath: string;
    yamlPath: string;
    commandPath: string;
  };
  runtime: {
    runId: string;
    actualPort: number;
    latestArtifactsDir: string;
    latestVerificationRunDir: string | null;
    latestKnownGoodRunDir: string | null;
    latestRealAuditDir: string | null;
    lastSnapshotRequestId: string | null;
    lastSaveRequestId: string | null;
    lastBridgeActionId: string | null;
  };
}

const INCLUDE_GLOBS = [
  "AGENTS.md",
  "README.md",
  "docs/for-oracle-to-read.md",
  "docs/for-oracle-to-read.yaml",
  "san/**",
  "backend/src/**",
  "frontend/src/**",
  "bridge/**",
  "scripts/**",
  "artifacts/latest/oracle-bundle-command.txt",
  "artifacts/latest/oracle-surface-proof.json",
  "artifacts/latest/launcher-status.json",
  "artifacts/latest/desktop-shortcut.json",
  "artifacts/latest/desktop-shortcut-launch.json",
  "artifacts/latest/selector-inspection.sanitized.json",
  "artifacts/latest/verification-run.txt",
  "artifacts/latest/known-good-run.txt",
  "artifacts/latest/real-user-audit.txt",
];

const EXCLUDE_GLOBS = [
  "node_modules/**",
  "frontend/dist/**",
  "backend/dist/**",
  ".git/**",
  ".env*",
  "artifacts/latest/snapshot-live.json",
  "artifacts/latest/selector-inspection.json",
  "artifacts/runs/**/files/raw/**",
  "artifacts/runs/**/snapshot*.json",
];

const SANITIZATION_RULES = [
  "Prefer sanitized run artifacts over raw live Notepad text.",
  "Treat tab titles, tab bodies, file paths, and selected-document content as sensitive unless already redacted.",
  "Bundle hashes, counts, identities, request IDs, bridge mode, and bounded snippets instead of full live text whenever possible.",
  "If a bug requires quoting live content, quote the smallest useful excerpt and mark it as sensitive.",
];

const REPRODUCTION_STEPS = [
  "Open the user's existing Windows 11 Notepad session. Do not launch a new Notepad instance.",
  "Run run-local.cmd or scripts/dev.ps1 and confirm the launcher reports the actual bound localhost port.",
  "Run npm run inspect:notepad to capture a non-visual live snapshot report for the current session.",
  "Run npm run smoke:live to execute the no-new-instance, read-only real-user verification bundle.",
  "Run npm run audit:real to emit a sanitized real-user audit bundle.",
  "Run npm run verify:headless for browser-side proof of diagnostics, search/query, wrap, and empty-state UI.",
];

const EVIDENCE_SUFFICIENT = [
  "No packaged command increases the Notepad process count or visible Notepad window count.",
  "Snapshot/search/query runs record selectionActionsDuringSnapshot = 0, focusChangedDuringSnapshot = false, windowActivatedDuringSnapshot = false, and zero new Notepad deltas.",
  "The app binds to the actual runtime port shown by /api/health, scripts/dev.ps1, and the in-app diagnostics drawer.",
  "Oracle instructions match the generated markdown, YAML, API diagnostics, and artifacts/latest/oracle-bundle-command.txt.",
  "Save is only claimed when a live write-back is followed by an exact non-visual re-read equality check; otherwise it must remain bounded or unproven.",
];

function quoteForPrompt(value: string): string {
  return value.replace(/"/g, '\\"');
}

export function getOraclePaths(repoRoot: string) {
  return {
    sourcePath: resolve(repoRoot, "backend", "src", "diagnostics", "oracleManifest.ts"),
    docPath: resolve(repoRoot, "docs", "for-oracle-to-read.md"),
    yamlPath: resolve(repoRoot, "docs", "for-oracle-to-read.yaml"),
    commandPath: resolve(repoRoot, "artifacts", "latest", "oracle-bundle-command.txt"),
  };
}

export function buildOracleCommand(): string {
  const prompt =
    "Review the Notepad Live Mirror repo using docs/for-oracle-to-read.md. Focus on no-new-Notepad-instance compliance, non-visual snapshot/search/query proof, bounded save semantics, diagnostics truth, shortcut proof, and the latest sanitized artifacts.";

  const includeArgs = INCLUDE_GLOBS.map((glob) => `--file "${glob}"`).join(" ");
  const excludeArgs = EXCLUDE_GLOBS.map((glob) => `--file "!${glob}"`).join(" ");
  return `npx -y @steipete/oracle --render --render-plain -p "${quoteForPrompt(prompt)}" ${includeArgs} ${excludeArgs}`.trim();
}

export function createOracleManifest(context: OracleManifestContext): OracleManifest {
  return {
    title: "For Oracle to Read",
    repo: "Notepad Live Mirror",
    truthSource: "live-running-notepad-session",
    bridgeMode: "non_visual_session_state",
    saveBridgeMode: "bounded_visual_writeback",
    currentObjective:
      "Prove a local-first mirror of the user's existing Windows 11 Notepad session without launching new Notepad instances, while keeping snapshot/search/query non-visual, exposing truthful diagnostics, and preserving SAN resumability.",
    currentFailureOrUncertainty:
      "Snapshot/search/query are intended to be non-visual and instance-safe. Save remains a bounded UIA write-back path until a persistent-session-safe live write is re-proven under this pass with explicit evidence.",
    includeGlobs: [...INCLUDE_GLOBS],
    excludeGlobs: [...EXCLUDE_GLOBS],
    sanitizationRules: [...SANITIZATION_RULES],
    reproductionSteps: [...REPRODUCTION_STEPS],
    evidenceSufficient: [...EVIDENCE_SUFFICIENT],
    oracleCommand: buildOracleCommand(),
    paths: getOraclePaths(context.repoRoot),
    runtime: {
      runId: context.runId,
      actualPort: context.actualPort,
      latestArtifactsDir: context.latestArtifactsDir,
      latestVerificationRunDir: context.latestVerificationRunDir,
      latestKnownGoodRunDir: context.latestKnownGoodRunDir,
      latestRealAuditDir: context.latestRealAuditDir,
      lastSnapshotRequestId: context.lastSnapshotRequestId,
      lastSaveRequestId: context.lastSaveRequestId,
      lastBridgeActionId: context.lastBridgeActionId,
    },
  };
}

export function renderOracleMarkdown(manifest: OracleManifest): string {
  const lines = [
    "# For Oracle to Read",
    "",
    "## Objective",
    "",
    manifest.currentObjective,
    "",
    "## Current uncertainty",
    "",
    manifest.currentFailureOrUncertainty,
    "",
    "## Runtime values",
    "",
    `- Run ID: ${manifest.runtime.runId}`,
    `- Actual bound port: ${manifest.runtime.actualPort}`,
    `- Latest artifacts folder: ${manifest.runtime.latestArtifactsDir}`,
    `- Latest verification run folder: ${manifest.runtime.latestVerificationRunDir ?? "not yet recorded"}`,
    `- Latest known-good run folder: ${manifest.runtime.latestKnownGoodRunDir ?? "not yet recorded"}`,
    `- Latest real-user audit folder: ${manifest.runtime.latestRealAuditDir ?? "not yet recorded"}`,
    `- Last snapshot request ID: ${manifest.runtime.lastSnapshotRequestId ?? "none"}`,
    `- Last save request ID: ${manifest.runtime.lastSaveRequestId ?? "none"}`,
    `- Last bridge action ID: ${manifest.runtime.lastBridgeActionId ?? "none"}`,
    "",
    "## Canonical Oracle source",
    "",
    `- Source manifest: \`${manifest.paths.sourcePath}\``,
    `- Markdown doc: \`${manifest.paths.docPath}\``,
    `- YAML doc: \`${manifest.paths.yamlPath}\``,
    `- Command artifact: \`${manifest.paths.commandPath}\``,
    "",
    "## Include globs",
    "",
    ...manifest.includeGlobs.map((item) => `- \`${item}\``),
    "",
    "## Exclude globs",
    "",
    ...manifest.excludeGlobs.map((item) => `- \`${item}\``),
    "",
    "## Sanitization rules",
    "",
    ...manifest.sanitizationRules.map((item) => `- ${item}`),
    "",
    "## Reproduction steps",
    "",
    ...manifest.reproductionSteps.map((item, index) => `${index + 1}. ${item}`),
    "",
    "## Evidence sufficient for diagnosis/fix/verification",
    "",
    ...manifest.evidenceSufficient.map((item) => `- ${item}`),
    "",
    "## Exact Oracle command",
    "",
    "```powershell",
    manifest.oracleCommand,
    "```",
    "",
  ];

  return lines.join("\n");
}

function renderYamlList(items: string[], indent = "  "): string[] {
  return items.map((item) => `${indent}- ${JSON.stringify(item)}`);
}

export function renderOracleYaml(manifest: OracleManifest): string {
  const lines = [
    `title: ${JSON.stringify(manifest.title)}`,
    `repo: ${JSON.stringify(manifest.repo)}`,
    `truth_source: ${JSON.stringify(manifest.truthSource)}`,
    `normal_bridge_mode: ${JSON.stringify(manifest.bridgeMode)}`,
    `save_bridge_mode: ${JSON.stringify(manifest.saveBridgeMode)}`,
    `current_objective: ${JSON.stringify(manifest.currentObjective)}`,
    `current_failure_or_uncertainty: ${JSON.stringify(manifest.currentFailureOrUncertainty)}`,
    "include:",
    ...renderYamlList(manifest.includeGlobs),
    "exclude:",
    ...renderYamlList(manifest.excludeGlobs),
    "sanitize:",
    ...renderYamlList(manifest.sanitizationRules),
    "reproduction_steps:",
    ...renderYamlList(manifest.reproductionSteps),
    "evidence_sufficient:",
    ...renderYamlList(manifest.evidenceSufficient),
    `oracle_command: ${JSON.stringify(manifest.oracleCommand)}`,
    "paths:",
    `  source: ${JSON.stringify(manifest.paths.sourcePath)}`,
    `  doc: ${JSON.stringify(manifest.paths.docPath)}`,
    `  yaml: ${JSON.stringify(manifest.paths.yamlPath)}`,
    `  command: ${JSON.stringify(manifest.paths.commandPath)}`,
    "runtime:",
    `  run_id: ${JSON.stringify(manifest.runtime.runId)}`,
    `  actual_port: ${manifest.runtime.actualPort}`,
    `  latest_artifacts_dir: ${JSON.stringify(manifest.runtime.latestArtifactsDir)}`,
    `  latest_verification_run_dir: ${JSON.stringify(manifest.runtime.latestVerificationRunDir)}`,
    `  latest_known_good_run_dir: ${JSON.stringify(manifest.runtime.latestKnownGoodRunDir)}`,
    `  latest_real_audit_dir: ${JSON.stringify(manifest.runtime.latestRealAuditDir)}`,
    `  last_snapshot_request_id: ${JSON.stringify(manifest.runtime.lastSnapshotRequestId)}`,
    `  last_save_request_id: ${JSON.stringify(manifest.runtime.lastSaveRequestId)}`,
    `  last_bridge_action_id: ${JSON.stringify(manifest.runtime.lastBridgeActionId)}`,
  ];

  return `${lines.join("\n")}\n`;
}
