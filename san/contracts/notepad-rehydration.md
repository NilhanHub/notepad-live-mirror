# Notepad Rehydration Truth Contract

Status: canonical conditional doctrine surface

This contract is active because the product mirrors and writes user-visible state across a live external desktop-app boundary.

## Startup truth source

- The live running Notepad session is the only product truth.
- The site performs one immediate snapshot on first load.
- After the first load, refresh remains manual only.

## Authority precedence

1. Live Notepad tab identity and text
2. Fresh non-visual snapshot from the local API
3. Ephemeral website editor state

## Sync phases

1. Enumerate visible Notepad windows and tab items through UIA without tab selection
2. Read Notepad `WindowState` and `TabState` from `LocalState`
3. Match visible windows to window-state records by geometry and active-tab parity
4. Map ordered session-state tab ids onto ordered UIA tabs
5. Materialize tab text from `TabState`, disk-backed files, and unsaved buffer chunks
6. Compare the mapped active tab with the currently selected document read through UIA
7. Normalize raw text to UI text only at the API/UI boundary

## Readiness semantics

- The UI is ready after the first snapshot request completes, even if it returns an empty state.
- Search and query operate over the current snapshot only.
- Diagnostics are meaningful only when a request id and bridge action id exist.
- Verification claims are meaningful only when the corresponding run artifacts show zero new Notepad process/window deltas for the operation in scope.

## Stale-read guards

- Each tab carries:
  - window handle
  - session-state tab id
  - UIA runtime id
  - order index
  - resolved title metadata
  - raw text
- Save compares the current non-visual raw text against the previously fetched raw text before overwrite unless force was explicitly confirmed.
- If the target cannot be re-identified by window handle + state id, save stops and requires refresh.

## Write-back semantics

1. Refresh the current live snapshot
2. Re-identify the target tab by window handle + state id
3. If overwrite was not confirmed and raw text drifted, stop with conflict data
4. Use UIA to select the exact target runtime id and write via `ValuePattern.SetValue(...)`
5. Restore the original selected tab when possible
6. Re-read the live session non-visually
7. Confirm the verified tab text matches the website text before returning success

## Conflict behavior

- On live drift, the UI must offer:
  - overwrite from website
  - reload from Notepad
  - cancel

## Failure recovery

- If Notepad is closed, return an empty snapshot and a calm retry path
- If a state file is transiently incomplete, skip it, keep warnings visible, and keep going where mapping remains trustworthy
- If a window or tab disappears during save, stop and require refresh
- If post-save verification fails, report the mismatch and do not claim success
- If a launcher, shortcut, or verification script increases the Notepad process/window inventory, fail that run and treat the path as non-compliant

## Identity mapping

- Window identity: visible Notepad window handle, cross-checked against `WindowState` bounds
- Session tab identity: ordered `TabState` GUID from `WindowState`
- Write-back locator: session tab identity plus UIA runtime id inside the same window
- Secondary metadata: accessible tab name, source file path when present, modified flag, order index

## Meaning of status language

- `In sync`: the current website text matches the last verified snapshot text for the selected tab
- `Edited locally`: the website text differs from the last verified snapshot text
- `non_visual_session_state`: the current snapshot/search/query path used UIA metadata plus Notepad session-state files without tab-stepping
- `bounded_visual_writeback`: the current save path may select the target tab to write and then restores selection
