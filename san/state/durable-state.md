# Durable State

Status: canonical durable state surface

## Mission

Build and harden a local-first app that mirrors the live multi-tab Windows 11 Notepad session, supports safe edit/save/refresh behavior, exposes diagnostics and Oracle handoff instructions, and remains SAN-legible for the next cold-start agent.

## Observed environment

- Workspace is now versioned under local Git
- Node.js and npm are present
- `.NET SDKs installed: none`
- `.NET desktop runtime available`
- Stock Notepad package observed at `Microsoft.WindowsNotepad_11.2512.26.0_x64__8wekyb3d8bbwe`
- The user’s live Notepad session is present and readable without opening a new Notepad instance

## Proven live facts

- Visible Notepad windows expose top-level class `Notepad`
- Tab items expose `SelectionItemPattern`
- The active document exposes `TextPattern` and `ValuePattern`
- Inactive tab text is not directly exposed through UIA document surfaces
- Notepad `LocalState\WindowState` files provide ordered tab ids per window
- Notepad `LocalState\TabState` files provide reconstructable live tab text, including unsaved buffers
- Session-state snapshot can be performed with `selectionActionsDuringSnapshot = 0`
- Selected-document agreement can be checked against the active tab through UIA without tab-stepping

## Current bounded work surface

- Keep the normal snapshot/search/query path non-visual
- Keep save bounded, instrumented, and re-verified
- Preserve duplicate-title and untitled-tab safety
- Maintain runtime artifacts and diagnostics
- Keep packaged verification and launcher paths no-new-instance compliant
- Keep SAN docs and topology aligned with the real code

## Implemented surfaces

- `backend/src/server.ts`
- `backend/src/notepadService.ts`
- `backend/src/diagnostics/oracleManifest.ts`
- `backend/src/sessionState.ts`
- `backend/src/search.ts`
- `backend/src/runtime.ts`
- `backend/src/cli/realUserSmoke.ts`
- `backend/src/cli/realUserAudit.ts`
- `backend/src/cli/syncOracleSurface.ts`
- `backend/src/bridge.ts`
- `bridge/NotepadBridge.ps1`
- `frontend/src/App.tsx`
- `frontend/src/model.ts`
- `frontend/src/api.ts`
- `frontend/src/styles.css`
- `scripts/dev.ps1`
- `scripts/smoke-live.ps1`
- `scripts/inspect-notepad.ps1`
- `scripts/inspect-notepad-tree.ps1`
- `scripts/create-desktop-shortcut.ps1`
- `docs/for-oracle-to-read.md`
- `docs/for-oracle-to-read.yaml`
- `run-local.cmd`

## Verification evidence summary

- `npm test` passes
- `npm run build` passes
- `npm run verify:headless` passes
- `npm run inspect:notepad` proves a non-visual live snapshot on the current user session
- `npm run inspect:tree` emits sanitized selector proof into `artifacts/latest/selector-inspection.sanitized.json`
- `npm run audit:real` emits a sanitized real-user audit run
- `npm run smoke:live` passes as a read-only real-user verification run with zero Notepad process/window deltas
- Desktop shortcut creation and launch proof succeeded for the current Windows user.

## Known bounded risks

- Save still uses a bounded UIA write path, so a focus/selection disturbance is possible and must stay instrumented
- This pass did not safely exercise a real-user persistent-session write-back, so save remains bounded rather than fully re-proven
- Multi-window matching currently relies on window geometry plus active-tab parity; it is materially stronger than title matching but still deserves future hardening
- ANSI file decoding currently assumes Windows-1252
- The parser skips transiently incomplete state files instead of blocking the whole snapshot; warnings must remain visible in diagnostics when this happens
