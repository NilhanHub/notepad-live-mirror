# SANLOCK

Date: 2026-04-13

## Before superseding pass

| Dimension | Score / 10 | Notes | Action |
| --- | --- | --- | --- |
| Control-plane authority | 8 | Canonical surfaces existed but did not reflect the non-visual requirement | HARDEN |
| Versioned change stewardship | 8 | Git checkpoints existed | MAINTAIN |
| Durable state freshness | 5 | Durable state still described visual tab-stepping | HARDEN |
| Topology graph freshness | 5 | Graph was truthful for the first build but missing new bounded nodes | HARDEN |
| Node-budget health | 7 | Major surfaces were split, but diagnostics/search/evidence nodes were implicit | REFINE |
| Declared vs observed topology drift | 4 | Snapshot path in docs contradicted the required non-visual target | HARDEN |
| Dispersion readiness of touched nodes | 7 | Code was localizable but runtime evidence surfaces were thin | HARDEN |
| Resume / handoff quality | 7 | SAN scaffold existed but Oracle/runtime guidance was incomplete | HARDEN |
| Verification integrity | 5 | Synthetic proof existed, real-user proof and headless proof were missing | HARDEN |
| Command determinism | 7 | Start/build/test/smoke existed, but shortcut/audit/headless paths did not | HARDEN |
| Stateful rehydration contract coverage | 5 | Contract still described visual stepping and pre-save bridge-side conflict checks | HARDEN |

## Superseding-pass decisions

- Move normal snapshot/search/query authority to `non_visual_session_state`
- Keep save bounded and instrumented instead of pretending it is fully non-visual
- Add diagnostics, Oracle surfaces, and artifact output before claiming robustness
- Replace packaged synthetic verification with read-only real-user verification

## After superseding pass

| Dimension | Score / 10 | Notes | Action |
| --- | --- | --- | --- |
| Control-plane authority | 9 | Control plane now states real bridge modes, entrypoints, and invariants | MAINTAIN |
| Versioned change stewardship | 9 | Work remained reviewable and surfaced through scripts/docs/artifacts | MAINTAIN |
| Durable state freshness | 9 | Durable state reflects the non-visual bridge, diagnostics, and evidence paths | MAINTAIN |
| Topology graph freshness | 8 | Graph now includes non-visual bridge, query, diagnostics, Oracle, shortcut, and headless nodes | MAINTAIN |
| Node-budget health | 8 | Bridge, parser, search, diagnostics, UI, and verification remain bounded | MAINTAIN |
| Declared vs observed topology drift | 8 | Declared surfaces now match the implemented runtime shape | MAINTAIN |
| Dispersion readiness of touched nodes | 8 | Search, diagnostics, evidence, and shortcut logic are explicit and separable | MAINTAIN |
| Resume / handoff quality | 9 | README, SAN surfaces, Oracle doc, and in-app diagnostics are aligned | MAINTAIN |
| Verification integrity | 8 | Unit, build, headless UI, read-only real-user smoke, selector inspection, and real-user audit exist; persistent-session save proof remains bounded | HARDEN |
| Command determinism | 9 | Start/build/test/headless/inspect/audit/shortcut paths are packaged | MAINTAIN |
| Stateful rehydration contract coverage | 9 | Contract now describes the real non-visual sync/read/write semantics | MAINTAIN |

## Post-pass findings

- A single-item PowerShell collection bug was only the first failure; the deeper product issue was that the original snapshot path still visibly selected tabs.
- UIA alone is insufficient for inactive-tab text in modern Notepad; session-state parsing is required for a normal non-visual read path.
- Save can stay reliable without moving to direct session-state mutation as long as it is re-verified through a fresh non-visual read.
- Transiently incomplete `WindowState` files can appear during live state churn; skipping invalid candidates is safer than aborting the whole snapshot.
