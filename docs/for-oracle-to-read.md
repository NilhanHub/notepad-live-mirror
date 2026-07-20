# For Oracle to Read

## Objective

Prove a local-first mirror of the user's existing Windows 11 Notepad session without launching new Notepad instances, while keeping snapshot/search/query non-visual, exposing truthful diagnostics, and preserving SAN resumability.

## Current uncertainty

Snapshot/search/query are intended to be non-visual and instance-safe. Save remains a bounded UIA write-back path until a persistent-session-safe live write is re-proven under this pass with explicit evidence.

## Runtime values

- Public snapshot: sanitized example; live values are generated locally and remain untracked
- Run ID: `<runtime-generated>`
- Actual bound port: `<runtime-selected>`
- Latest artifacts folder: `artifacts/runs/<latest-server-run>` (machine-local, not included in the public source export)
- Latest verification run folder: `artifacts/runs/<latest-real-user-smoke>` (machine-local)
- Latest known-good run folder: `artifacts/runs/<latest-real-user-smoke>` (machine-local)
- Latest real-user audit folder: `artifacts/runs/<latest-real-user-audit>` (machine-local)
- Last snapshot request ID: `<runtime-generated>`
- Last save request ID: none
- Last bridge action ID: `<runtime-generated>`

## Canonical Oracle source

- Source manifest: `backend/src/diagnostics/oracleManifest.ts`
- Markdown doc: `docs/for-oracle-to-read.md`
- YAML doc: `docs/for-oracle-to-read.yaml`
- Command artifact: `artifacts/latest/oracle-bundle-command.txt` (generated locally)

## Include globs

- `AGENTS.md`
- `README.md`
- `docs/for-oracle-to-read.md`
- `docs/for-oracle-to-read.yaml`
- `san/**`
- `backend/src/**`
- `frontend/src/**`
- `bridge/**`
- `scripts/**`
- `artifacts/latest/oracle-bundle-command.txt`
- `artifacts/latest/oracle-surface-proof.json`
- `artifacts/latest/launcher-status.json`
- `artifacts/latest/desktop-shortcut.json`
- `artifacts/latest/desktop-shortcut-launch.json`
- `artifacts/latest/selector-inspection.sanitized.json`
- `artifacts/latest/verification-run.txt`
- `artifacts/latest/known-good-run.txt`
- `artifacts/latest/real-user-audit.txt`

## Exclude globs

- `node_modules/**`
- `frontend/dist/**`
- `backend/dist/**`
- `.git/**`
- `.env*`
- `artifacts/latest/snapshot-live.json`
- `artifacts/latest/selector-inspection.json`
- `artifacts/runs/**/files/raw/**`
- `artifacts/runs/**/snapshot*.json`

## Sanitization rules

- Prefer sanitized run artifacts over raw live Notepad text.
- Treat tab titles, tab bodies, file paths, and selected-document content as sensitive unless already redacted.
- Bundle hashes, counts, identities, request IDs, bridge mode, and bounded snippets instead of full live text whenever possible.
- If a bug requires quoting live content, quote the smallest useful excerpt and mark it as sensitive.

## Reproduction steps

1. Open the user's existing Windows 11 Notepad session. Do not launch a new Notepad instance.
2. Run run-local.cmd or scripts/dev.ps1 and confirm the launcher reports the actual bound localhost port.
3. Run npm run inspect:notepad to capture a non-visual live snapshot report for the current session.
4. Run npm run smoke:live to execute the no-new-instance, read-only real-user verification bundle.
5. Run npm run audit:real to emit a sanitized real-user audit bundle.
6. Run npm run verify:headless for browser-side proof of diagnostics, search/query, wrap, and empty-state UI.

## Evidence sufficient for diagnosis/fix/verification

- No packaged command increases the Notepad process count or visible Notepad window count.
- Snapshot/search/query runs record selectionActionsDuringSnapshot = 0, focusChangedDuringSnapshot = false, windowActivatedDuringSnapshot = false, and zero new Notepad deltas.
- The app binds to the actual runtime port shown by /api/health, scripts/dev.ps1, and the in-app diagnostics drawer.
- Oracle instructions match the generated markdown, YAML, API diagnostics, and artifacts/latest/oracle-bundle-command.txt.
- Save is only claimed when a live write-back is followed by an exact non-visual re-read equality check; otherwise it must remain bounded or unproven.

## Exact Oracle command

```powershell
npx -y @steipete/oracle --render --render-plain -p "Review the Notepad Live Mirror repo using docs/for-oracle-to-read.md. Focus on no-new-Notepad-instance compliance, non-visual snapshot/search/query proof, bounded save semantics, diagnostics truth, shortcut proof, and the latest sanitized artifacts." --file "AGENTS.md" --file "README.md" --file "docs/for-oracle-to-read.md" --file "docs/for-oracle-to-read.yaml" --file "san/**" --file "backend/src/**" --file "frontend/src/**" --file "bridge/**" --file "scripts/**" --file "artifacts/latest/oracle-bundle-command.txt" --file "artifacts/latest/oracle-surface-proof.json" --file "artifacts/latest/launcher-status.json" --file "artifacts/latest/desktop-shortcut.json" --file "artifacts/latest/desktop-shortcut-launch.json" --file "artifacts/latest/selector-inspection.sanitized.json" --file "artifacts/latest/verification-run.txt" --file "artifacts/latest/known-good-run.txt" --file "artifacts/latest/real-user-audit.txt" --file "!node_modules/**" --file "!frontend/dist/**" --file "!backend/dist/**" --file "!.git/**" --file "!.env*" --file "!artifacts/latest/snapshot-live.json" --file "!artifacts/latest/selector-inspection.json" --file "!artifacts/runs/**/files/raw/**" --file "!artifacts/runs/**/snapshot*.json"
```
