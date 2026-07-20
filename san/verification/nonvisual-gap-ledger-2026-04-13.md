# Non-Visual Gap Ledger

Date: 2026-04-13
Status: active working ledger for the superseding non-visual hardening pass

This ledger records the exact gaps blocking truthful claims about:
- non-visual snapshot
- non-visual search/query
- stronger failure resistance
- readable wrap text
- desktop shortcut creation
- Oracle-legible diagnostics
- headless verification

## Reality and contradiction ledger

1. Current bridge snapshot still selects each tab in sequence during refresh.
2. Current SAN truth surfaces already admit that refresh visibly walks tabs.
3. The app does not currently expose actual bound port, run ID, bridge mode, request IDs, or artifact folder paths.
4. `scripts/dev.ps1` can float the port, but the repo and UI do not surface that runtime truth consistently.
5. No desktop shortcut creation path exists.
6. No `docs/for-oracle-to-read.md` file exists yet.
7. No in-app diagnostics or Oracle bundle surface exists.
8. No headless browser verification path exists.
9. Search/query across all live tabs does not exist.
10. Editor text currently uses `white-space: pre`, so wrap text is explicitly off.

## Gap entries

| Gap ID | Exact blocked claim | Current behavior | Missing evidence | Code paths involved | Required instrumentation | Likely fix path | Action | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NV-001 | "Snapshot is non-visual in normal mode" | `Invoke-Snapshot` calls `Get-WindowSnapshot`, which selects every tab through `SelectionItemPattern.Select()` before reading text | No per-snapshot proof of selection changes, focus changes, or foreground changes | `bridge/NotepadBridge.ps1`, `san/state/durable-state.md`, `san/contracts/notepad-rehydration.md` | Per-action bridge events, selected-tab-before/after, focus inventory, bridge mode reporting, snapshot method reporting | Replace text read path with `WindowState` + `TabState` parsing; keep UIA for inventory only | HARDEN | correctness, verification |
| NV-002 | "Search/query works without touring Notepad" | No search/query feature exists; any future full-tab read would currently depend on visual snapshot | No API, no ranking, no evidence that results come from current snapshot only | `frontend/src/App.tsx`, `backend/src/server.ts`, `backend/src/notepadService.ts` | Snapshot correlation ID, search/query request IDs, retrieval result manifest, source passage citations | Add snapshot-backed lexical retrieval and grounded query endpoint over current non-visual snapshot | HARDEN | usability, verification |
| NV-003 | "Current snapshot proof is trustworthy" | Existing smoke proof is synthetic and snapshot proof was built on visible tab stepping | No real-user sanitized audit artifact, no explicit claim ledger separating synthetic from real-user evidence | `scripts/smoke-live.ps1`, `scripts/inspect-notepad.ps1`, `README.md`, `san/` surfaces | Real-user audit run folder, sanitized snapshot export, synthetic/real run labels | Add artifacted real-user audit path and separate synthetic verification path | HARDEN | verification |
| NV-004 | "Bound port truth is clear" | `scripts/dev.ps1` finds a free port starting at `43117`, but the UI and repo do not report the actual chosen port | No diagnostic endpoint or runtime status surface | `scripts/dev.ps1`, `backend/src/server.ts`, frontend shell | Runtime status endpoint, persisted launcher status, current bound port in diagnostics | Add startup status file + `/api/diag/status` + in-app diagnostics drawer | HARDEN | usability, verification |
| NV-005 | "Save path is bounded and observable" | Save still re-selects the target tab and restores the original selection, but nothing logs the disturbance or restoration | No save action trail, no before/after process inventory, no exact disturbance record | `bridge/NotepadBridge.ps1`, `backend/src/bridge.ts`, `backend/src/notepadService.ts` | Save request IDs, save disturbance flags, selected-tab restore result, post-save exact-match proof, process/window inventory | Keep save as bounded exception if needed, but instrument it heavily and surface the mode honestly | HARDEN | correctness, verification |
| NV-006 | "Wrap text works" | Main editor explicitly uses `white-space: pre`, tab rows and snippets truncate, and no search snippet surface exists | No wrap-text UI proof or CSS assertion | `frontend/src/styles.css`, `frontend/src/App.tsx` | UI state screenshots, DOM assertions, diagnostics value for wrap mode | Change editor/snippet presentation to wrapped view while preserving raw text on save | HARDEN | usability, verification |
| NV-007 | "Desktop shortcut exists and is reproducible" | No shortcut script or verification exists | No shortcut artifact, no idempotent path, no success/failure logs | `scripts/` and launch docs | Shortcut creation log, artifact entry, launcher path proof | Add `scripts/create-desktop-shortcut.ps1`, run it, verify Desktop `.lnk`, log result | HARDEN | usability, verification |
| NV-008 | "Oracle can be told exactly what to bundle from repo and app" | Only ad hoc Oracle bundle artifacts exist; repo docs and app do not expose a canonical current recipe | No canonical Oracle instructions file, no in-app copy surface, no latest artifact pointer | `oracle-bundles/`, `README.md`, frontend shell, backend diag surface | Oracle recipe endpoint/file, latest artifact folder pointer, copyable command surface | Create `docs/for-oracle-to-read.md`, add app diagnostics/Oracle panel, emit latest command into artifacts | HARDEN | verification |
| NV-009 | "Runs are diagnosable offline" | No stable per-run artifact contract exists for app/API/bridge/browser/audit operations | No run folders, no structured logs, no correlation IDs, no summary manifests | Entire backend/bridge/startup/verification surface | Run ID, request ID, bridge action ID, JSONL logs, metrics, trace summary, artifact index | Add run-scoped artifact writer and structured event logging across API + bridge + verification | HARDEN | correctness, verification |
| NV-010 | "Headless verification exists" | Browser verification is manual and bridge verification is limited to scripts/stdout | No Playwright suite, no HAR/trace/screenshots, no UI-state capture | `package.json`, verification scripts, frontend | Playwright traces, screenshots, HAR, DOM snapshots, run IDs carried into test outputs | Add Playwright-based headless verification with artifact output | HARDEN | verification |
| NV-011 | "Multi-window behavior is understood" | UI groups by window, but current bridge/session-state mapping has not been proven against multiple real windows | No selector report tying visible windows to `WindowState` files or selected-tab mapping | `bridge/NotepadBridge.ps1`, future selector report surfaces | Window inventory, window-state mapping report, selected-tab mapping evidence | Add selector report and window-to-state matching logic; keep architecture multi-window-ready | REFINE | correctness, verification |
| NV-012 | "External directive inputs were fully present" | User referenced `Pasted text(3).txt`, `no-excuses-app-accountability-protocol(1).md`, `no-excuses-app-accountability-protocol(3).md`, and `notepad-live-mirror-oracle-package(1).zip`, but those exact filenames were not present on disk during inspection | No durable note that those exact artifacts were absent and which actual surrogates were used | `san/verification/`, future Oracle instructions | Input-source inventory and substitution note | Record exact missing filenames and the actual found files used for this pass | REFINE | verification |

## Current accepted evidence anchors

- Visible-step snapshot implementation is real and currently lives in `bridge/NotepadBridge.ps1`.
- Current selected Notepad session is visible through UIA and a single user-owned Notepad window is present.
- `LocalState\\WindowState` contains an ordered GUID list for currently open tabs.
- `LocalState\\TabState` contains readable non-visual backing data for open tabs:
  - unsaved tabs expose inline UTF-16 text after an `NP` header
  - file-backed tabs expose a UTF-16 file path after an `NP` header
- The existing repo does not yet turn those facts into a production non-visual bridge.

## Immediate slice priorities

1. Build selector/state investigation proof and a contradiction-resolving diagnostic report.
2. Replace normal snapshot/search/query with the non-visual session-state path.
3. Leave save as a bounded exception path only if non-visual write-back cannot be proven safely.
4. Add run artifacts, diagnostics surfaces, and Oracle instructions before making stronger claims.
