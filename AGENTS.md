# Notepad Live Mirror Doctrine

This repository follows SAN Repo OS 3.7 discipline.

Canonical surfaces:

- Doctrine surface: `AGENTS.md`
- Canonical control plane: `san/control-plane.md`
- Durable state surface: `san/state/durable-state.md`
- SAN preflight log: `san/preflight.md`
- SANLOCK log and scorecards: `san/sanlock.md`
- Machine-readable topology truth: `san/topology/notepad-topology.json`
- Stateful rehydration contract: `san/contracts/notepad-rehydration.md`

Operating priorities:

1. Preserve singular control-plane authority.
2. Treat the live running Notepad session as product truth.
3. Keep all sync, mapping, and write-back behavior explicit and reviewable.
4. Maintain bounded nodes and update topology truth when structure changes.
5. Prefer deterministic scripts and commands over manual multi-surface drift.

Execution entrypoints:

- `run-local.cmd`
- `scripts/dev.ps1`
- `npm test`
- `npm run smoke:live`
- `npm run inspect:notepad`

Verification rule:

Do not claim save correctness without re-reading the live Notepad tab and confirming exact text equality after write-back.
