# Perfect App Gap Ledger

Date: 2026-04-13
Status: active superseding-pass ledger

This is the first written artifact for the current pass.

## Scope

This ledger enumerates the gaps blocking:

- no-new-Notepad-instance compliance
- non-visual all-tab reading
- non-visual search/query
- correct desktop shortcut placement
- code-backed Oracle instructions
- fully accurate runtime reporting
- robust save correctness
- SAN conformance
- exact "works vs not working" reporting

## Current inspected inputs

- Repo doctrine and SAN surfaces in the project root
- Current code and scripts in `backend/`, `bridge/`, `frontend/`, `scripts/`, `tests/`
- A machine-local Oracle bundle was generated and extraction-verified; the archive is not included in this public source export.
- Accountability and SAN docs were independently reviewed from a machine-local handoff folder.
- Current live user Notepad process inventory

## Input-source note

- `Pasted text(5).txt` was requested but was not found in the searched user locations (`Downloads`, `Desktop`, `Documents`, `OneDrive`) during initial inspection. This remains an explicit missing input until found elsewhere.

## Gaps

| Gap ID | Exact blocked claim | Current observed behavior | Missing evidence | Likely owning files | Required instrumentation | Likely fix path | Blocks | SAN action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PA-001 | "No script or helper opens a new Notepad instance" | `scripts/smoke-live.ps1` still runs `Start-Process notepad.exe`; README, package scripts, control-plane, durable state, topology, and Oracle docs still advertise it as a normal verification path | No current pass artifact proving that all packaged commands are instance-safe | `scripts/smoke-live.ps1`, `package.json`, `README.md`, `san/control-plane.md`, `san/state/durable-state.md`, `san/topology/notepad-topology.json`, `docs/for-oracle-to-read.*` | Repo-wide launch-path audit and per-command process/window delta proof | Remove launch behavior from packaged flows, quarantine or replace synthetic smoke, then re-verify | correctness, verification, SAN alignment | HARDEN |
| PA-002 | "Snapshot/search/query/refresh are fully non-visual in the default product flow" | Core read path is non-visual in code, but proof is incomplete and artifacts still include selector/raw-text dumps that can be mistaken for canonical proof; no explicit `windowActivatedDuringSnapshot` or process/window delta field yet | No per-run `nonvisual-proof.json`, no explicit window activation metric, no fresh real-user pass under current superseding rules | `bridge/NotepadBridge.ps1`, `backend/src/contracts.ts`, `backend/src/notepadService.ts`, `backend/src/runtime.ts`, `backend/src/cli/realUserAudit.ts` | Before/after Notepad inventories, `windowActivatedDuringSnapshot`, process/window deltas, session-source report, identity-map report | Extend bridge payload and audit artifacts; prove zero-selection, zero-focus-change, zero-new-instance on the user session | correctness, verification | HARDEN |
| PA-003 | "Current verification paths are compliant with the real-user-session-only rule" | Existing `npm run smoke:live` is synthetic and existing headless tests are mocked; current real-user audit is read-only and does not cover save | No compliant end-to-end verification bundle separating read-only real-user evidence from any write proof | `package.json`, `scripts/smoke-live.ps1`, `backend/src/cli/realUserAudit.ts`, `tests/headless/app.spec.ts`, `san/sanlock.md`, `README.md` | Run-class labeling, compliance flags, real-user-only artifact bundle | Replace packaged smoke semantics with real-user-safe verification and report save as bounded/unproven unless safely exercised | verification, SAN alignment | HARDEN |
| PA-004 | "Desktop shortcut proof is complete and current" | Shortcut creation exists, but it uses `[Environment]::GetFolderPath("Desktop")`, writes only creation proof, and does not emit launch proof or shell-resolved target details | No `desktop-shortcut-launch.json`, no shell-folder resolution artifact, no proof that launch brought the app up on the actual bound port | `scripts/create-desktop-shortcut.ps1`, `scripts/dev.ps1`, `run-local.cmd`, `artifacts/latest/desktop-shortcut.json` | Resolved shell desktop path, `.lnk` inspection details, launch result, resulting health/port proof | Use the shell special-folder path, inspect the `.lnk`, launch through it, capture health result | usability, verification | HARDEN |
| PA-005 | "Oracle instructions are code-backed and singular" | Oracle truth is duplicated across `docs/for-oracle-to-read.md`, `docs/for-oracle-to-read.yaml`, runtime diagnostics string literals, and `artifacts/latest/oracle-bundle-command.txt` | No typed canonical manifest or command-first sync path; current surfaces can drift | `backend/src/notepadService.ts`, `backend/src/runtime.ts`, `docs/for-oracle-to-read.md`, `docs/for-oracle-to-read.yaml`, frontend diagnostics UI | Canonical typed manifest plus generation/sync outputs and proof artifact | Create a typed Oracle manifest source, drive API/docs/artifact/app from it, and record sync proof | verification, SAN alignment | HARDEN |
| PA-006 | "Runtime reporting is 100% accurate" | `/api/diag/oracle` just mirrors `/api/diag/status`; diagnostics do not surface launch-path compliance, latest known-good run, shortcut launch proof, or operation-specific Notepad deltas; tests hardcode `43117` | No artifact-backed contradiction ledger for `43117` vs dynamic binding, no launch-compliance reporting, no latest-known-good field | `backend/src/server.ts`, `backend/src/notepadService.ts`, `backend/src/runtime.ts`, `frontend/src/App.tsx`, `tests/headless/app.spec.ts` | Bound-port proof, latest-known-good pointer, per-operation telemetry, contradiction log | Add explicit diagnostics contract and update headless tests to read real surfaced values instead of fixed assumptions | usability, verification, SAN alignment | HARDEN |
| PA-007 | "Save correctness is proven on the user's persistent session" | Save code is still `bounded_visual_writeback`; it restores selection and re-reads non-visually, but the current real-user audit is read-only and no safe write target has been established in the existing user session | No real-user write telemetry, no safe-scratch determination, no proof that no wrong tab was touched on the persistent session | `bridge/NotepadBridge.ps1`, `backend/src/notepadService.ts`, `backend/src/cli/realUserAudit.ts`, frontend conflict flow | Save telemetry, before/after inventory, selected-tab restore proof, safe-target declaration | Harden telemetry; prove only if a clearly safe tab exists, otherwise report bounded/unproven honestly | correctness, verification | HARDEN |
| PA-008 | "All current artifacts are safe and aligned with the current doctrine" | `artifacts/latest/snapshot-live.json` and `artifacts/latest/selector-inspection.json` still contain raw live-session text; Oracle bundle already excluded them, but repo surfaces still publish them as latest artifacts | No sanitization boundary in the latest-artifact contract, no safer replacement for operator inspection | `artifacts/latest/*`, `scripts/inspect-notepad-tree.ps1`, `backend/src/runtime.ts`, `docs/for-oracle-to-read.md`, `README.md` | Safe/unsafe artifact classification and sanitized replacements | Move raw artifacts out of `latest` or classify them explicitly; add sanitized latest proof files | verification, SAN alignment | HARDEN |
| PA-009 | "Headless verification covers the superseding pass requirements" | Playwright tests cover mocked UI states, but they do not verify shortcut launch, real bound-port truth, or diagnostics backed by the current runtime contract | No fresh headless run tied to current run IDs and new diagnostics payload | `tests/headless/app.spec.ts`, `playwright.config.ts`, `backend/src/server.ts`, frontend diagnostics UI | Correlated run IDs, dynamic diagnostics expectations, shortcut-launch validation where feasible | Expand headless tests after diagnostics contract is corrected | verification | HARDEN |
| PA-010 | "SAN surfaces are current and singular" | SAN docs still describe and endorse synthetic smoke; topology still includes `synthetic-verification`; durable state and README still claim stronger proof than the superseding rules allow | No updated SAN scorecard for this stricter doctrine, no post-change topology reflecting the new verification model | `README.md`, `san/control-plane.md`, `san/state/durable-state.md`, `san/sanlock.md`, `san/topology/notepad-topology.json`, `san/contracts/notepad-rehydration.md` | Updated topology, control-plane, durable state, SANLOCK, verification pointers | Refresh all touched SAN surfaces after code and verification changes settle | SAN alignment, verification | HARDEN |
| PA-011 | "The app can explain exactly what works vs. not working right now" | Repo claims "working" in several places, but current code still has forbidden packaged launch paths and save on the user session is not proven | No brutally honest status surface separating proven, broken, bounded, and unproven states | `README.md`, frontend diagnostics/oracle UI, final audit/report artifacts | Status-classification fields and explicit evidence links | Add explicit truth sections in diagnostics, Oracle manifest, audit summaries, and final report | verification, SAN alignment | HARDEN |
| PA-012 | "All required inputs for this pass were fully available and reconciled" | The accountability/SAN docs were found under unsuffixed filenames; `Pasted text(5).txt` was not found in initial searched user locations | No durable substitution note for found-vs-requested filenames | `san/state/durable-state.md`, verification surfaces | Input-source inventory and substitution note | Record exact located inputs and exact missing inputs in durable truth | verification, SAN alignment | REFINE |

## Immediate decisions from this ledger

1. Remove or quarantine every packaged Notepad-launch path before any stronger success claim.
2. Make no-new-instance proof a first-class artifact, not an implied property.
3. Treat save on the persistent user session as bounded until a safe real-user write is actually evidenced.
4. Replace drifting Oracle strings with a canonical typed manifest and synced surfaces.
5. Refresh SAN surfaces only after the code, scripts, and verification contract are updated to match the stricter rules.
