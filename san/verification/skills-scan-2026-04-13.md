# Skills Scan

Date: 2026-04-13
Status: completed for the current superseding pass

## Scope

The pass required a D-drive-first capability search before any external research or downloads.

## What was scanned

Broad recursive scans were attempted over `D:\` for:

- directories with `skill` or `skills` in the name
- `SKILL.md`
- `skills.sh`
- `search_skills.sh`
- `AGENTS.md`
- `D:\select_skills2`

Those broad scans timed out because `D:\` contains very large imported skill archives. The scan was then narrowed to the discovered active roots that matter for this machine:

- `D:\select_skills2`
- `D:\codex_skills`
- A machine-local curated skills workspace
- A machine-local governance mirror used for comparison

The machine-readable inventory is in `artifacts/skills/d-drive-skills-inventory.json`.

## Active local skill-policy findings

1. `D:\select_skills2\AGENTS.md` is the primary D-drive skill-root policy file.
2. `D:\select_skills2\skills-manifest\SKILL.md` is the linked operating procedure for the library.
3. `D:\select_skills2\codex-skills-channel\SKILL.md` says Codex agents must inspect `D:\select_skills2` first, then `D:\codex_skills`.
4. `D:\codex_skills\AGENTS.md` confirms `D:\codex_skills` is a Codex-specific overlay, not a replacement for `D:\select_skills2`.

## Relevant skills found for this pass

| Skill | Path | Classification | Applicable | Used | Why |
| --- | --- | --- | --- | --- | --- |
| `codex-skills-channel` | `D:\select_skills2\codex-skills-channel\SKILL.md` | routing | yes | yes | It defines the required D-drive-first search order for Codex agents. |
| `skills-manifest` | `D:\select_skills2\skills-manifest\SKILL.md` | library governance | yes | yes | It governs how the local skill library is inspected and selected. |
| `systematic-debugging` | `D:\select_skills2\systematic-debugging\SKILL.md` | debugging | yes | yes | It matches the root-cause-first investigation required here. |
| `verification-before-completion` | `D:\select_skills2\verification-before-completion\SKILL.md` | verification | yes | yes | It matches the evidence gate required by the pass. |
| `playwright` | `D:\codex_skills\playwright\SKILL.md` | browser automation | yes | yes | It gives Codex-specific guidance for CLI-driven browser verification. |
| `dogfood` | `D:\select_skills2\dogfood\SKILL.md` | evidence packaging | partially | no | Relevant to UI evidence, but the repo already has a custom run-artifact contract and Playwright tests. |
| `playwright-interactive` | `D:\codex_skills\playwright-interactive\SKILL.md` | interactive browser debugging | no | no | This pass requires headless-by-default proof, so an interactive headed session is not the default. |

## Skills not adopted as primary workflows

- `project-understanding`
- `filesystem-context`
- `codebase-exploration`
- `codebase-search`

These are relevant in the abstract, but the repo already has a strong local doctrine/control-plane surface and the current need is not discovery breadth. The tighter fit is root-cause debugging plus verification gating.

## Decision

This pass will explicitly follow:

1. `systematic-debugging`
2. `verification-before-completion`
3. Codex-side Playwright guidance for headless browser proof

## External search status

No external skill or tool discovery was needed before this local D-drive scan completed.
