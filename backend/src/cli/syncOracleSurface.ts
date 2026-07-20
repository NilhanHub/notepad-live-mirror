import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  createOracleManifest,
  renderOracleMarkdown,
  renderOracleYaml,
} from "../diagnostics/oracleManifest.js";
import { getRepoRoot, getRuntimeDiagnostics, writeRunArtifact } from "../runtime.js";

async function lookupLiveDiagnostics(preferredPort: number): Promise<ReturnType<typeof getRuntimeDiagnostics> | null> {
  const ports = Array.from(
    new Set([preferredPort, ...Array.from({ length: 50 }, (_, index) => 43117 + index)]),
  ).filter((port) => port > 0);

  for (const port of ports) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/diag/status`);
      if (!response.ok) {
        continue;
      }

      return (await response.json()) as ReturnType<typeof getRuntimeDiagnostics>;
    } catch {
      // Keep probing localhost until a healthy diagnostics surface answers.
    }
  }

  return null;
}

const repoRoot = getRepoRoot();
const runtime = getRuntimeDiagnostics();
const effectiveRuntime = (await lookupLiveDiagnostics(runtime.actualPort)) ?? runtime;
const manifest = createOracleManifest({
  repoRoot,
  latestArtifactsDir: effectiveRuntime.latestArtifactsDir,
  latestVerificationRunDir: effectiveRuntime.latestVerificationRunDir,
  latestKnownGoodRunDir: effectiveRuntime.latestKnownGoodRunDir,
  latestRealAuditDir: effectiveRuntime.latestRealAuditDir,
  runId: effectiveRuntime.runId,
  actualPort: effectiveRuntime.actualPort,
  lastSnapshotRequestId: effectiveRuntime.lastSnapshotRequestId,
  lastSaveRequestId: effectiveRuntime.lastSaveRequestId,
  lastBridgeActionId: effectiveRuntime.lastBridgeActionId,
});

mkdirSync(dirname(manifest.paths.docPath), { recursive: true });
mkdirSync(dirname(manifest.paths.yamlPath), { recursive: true });
mkdirSync(dirname(manifest.paths.commandPath), { recursive: true });

const latestProofPath = resolve(repoRoot, "artifacts", "latest", "oracle-surface-proof.json");
mkdirSync(dirname(latestProofPath), { recursive: true });

writeFileSync(manifest.paths.docPath, renderOracleMarkdown(manifest), "utf8");
writeFileSync(manifest.paths.yamlPath, renderOracleYaml(manifest), "utf8");
writeFileSync(manifest.paths.commandPath, `${manifest.oracleCommand}\n`, "utf8");

const proof = {
  generatedAt: new Date().toISOString(),
  sourcePath: manifest.paths.sourcePath,
  docPath: manifest.paths.docPath,
  yamlPath: manifest.paths.yamlPath,
  commandPath: manifest.paths.commandPath,
  includeGlobs: manifest.includeGlobs,
  excludeGlobs: manifest.excludeGlobs,
  sanitizationRules: manifest.sanitizationRules,
  reproductionSteps: manifest.reproductionSteps,
  evidenceSufficient: manifest.evidenceSufficient,
};

writeFileSync(latestProofPath, JSON.stringify(proof, null, 2), "utf8");

writeRunArtifact("oracle/oracle-surface-proof.json", proof);

console.log(JSON.stringify({
  docPath: manifest.paths.docPath,
  yamlPath: manifest.paths.yamlPath,
  commandPath: manifest.paths.commandPath,
}, null, 2));
