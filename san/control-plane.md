# Canonical Control Plane

Status: canonical

This file is the single write-authoritative control plane for operational truth in this repository.

## Active operating modes

- BOOTSTRAP
- MID_BUILD_ALIGNMENT

## Conditionally active doctrines

- stateful-system rehydration truth contract: active
- long-horizon resumability: active
- outward sharing: inactive by default

## Product authority

- Product truth: the live running stock Windows Notepad session
- Repo truth: the versioned repository surfaces named in `AGENTS.md`
- Website/editor state: ephemeral and secondary

## Implementation authority

- Preferred bridge shape from the mission remains a compiled .NET 8 UI Automation bridge
- Observed host constraint remains: .NET desktop runtime present, .NET SDK absent
- Current production adapter decision:
  - UIA metadata and write-back in `bridge/NotepadBridge.ps1`
  - non-visual session-state parsing in `backend/src/sessionState.ts`
  - merge, search, diagnostics, and verification in the TypeScript local API
- Normal snapshot/search/query mode is `non_visual_session_state`
- Save mode is `bounded_visual_writeback`

## Canonical entrypoints

- Local start: `run-local.cmd`
- PowerShell start: `scripts/dev.ps1`
- Automated tests: `npm test`
- Build: `npm run build`
- Headless verification: `npm run verify:headless`
- Oracle surface sync: `npm run sync:oracle`
- Read-only live inspection: `npm run inspect:notepad`
- UIA selector inspection artifact: `npm run inspect:tree`
- Read-only real-user smoke verification: `npm run smoke:live`
- Sanitized real-user audit: `npm run audit:real`
- Desktop shortcut creation: `npm run create:shortcut`

## Write-back invariants

1. Never identify a tab by visible title alone.
2. Snapshot identity must include the parent Notepad window handle plus the session-state tab id.
3. Runtime id is still required for write-back re-identification within the live window.
4. Save must compare the current non-visual raw text against the last fetched raw text before overwrite unless force was explicitly confirmed.
5. Save must restore the original selected tab when possible.
6. Save must re-read the live session non-visually and confirm equality with the website text before claiming success.
7. If identity confidence drops below exact window-handle + state-id + runtime-id agreement, require refresh instead of guessing.

## Query invariants

1. Search and query run over the current live snapshot only.
2. Query answers are retrieval-first and must cite source tab passages in the UI.
3. No cloud dependency is permitted for search/query.

## Actual implementation surfaces

- Frontend shell: `frontend/src/App.tsx`, `frontend/src/styles.css`
- Local API: `backend/src/server.ts`, `backend/src/notepadService.ts`
- Session-state parser: `backend/src/sessionState.ts`
- Search/query: `backend/src/search.ts`
- Runtime diagnostics/artifacts: `backend/src/runtime.ts`
- Canonical Oracle manifest: `backend/src/diagnostics/oracleManifest.ts`
- Bridge process adapter: `backend/src/bridge.ts`
- Windows UIA bridge: `bridge/NotepadBridge.ps1`
- Verification scripts: `scripts/smoke-live.ps1`, `scripts/inspect-notepad.ps1`, `scripts/inspect-notepad-tree.ps1`
- Verification CLIs: `backend/src/cli/realUserSmoke.ts`, `backend/src/cli/realUserAudit.ts`
- Oracle sync CLI: `backend/src/cli/syncOracleSurface.ts`
- Desktop shortcut: `scripts/create-desktop-shortcut.ps1`
- Oracle surfaces: `docs/for-oracle-to-read.md`, `docs/for-oracle-to-read.yaml`
