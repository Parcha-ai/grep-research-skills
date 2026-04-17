# Changelog

## [0.3.0] — 2026-04-17

### Changed

* **Default install is now raw HTTP, not the `brain` Rust CLI.** Every skill speaks the GREP REST API directly via `curl` plus a small Node-based `get_token` helper. No external binary is fetched. The package now works in sandboxed Claude Code environments (Claude.ai web, some cloud runners, locked-down laptops) where 0.2.x failed to install `brain`.
* The repo is now a valid Claude Code marketplace plugin: `/plugin marketplace add parcha-ai/grep-research-skills` discovers + installs all 11 skills.

### Added

* **Two new skills** — wrap endpoints that landed on `feat/workspace-projects-browser`:
  - `/grep-defaults` — manage per-user default context files (`POST/GET/DELETE /grep/user/defaults`). Files live in Pierre at `users/{uid}/defaults/` and hydrate into every research sandbox at `./defaults/`.
  - `/grep-inputs` — attach / remove per-job input files (`POST/DELETE /grep/jobs/{id}/inputs`). Files land at `jobs/{id}/input_files/` in Pierre; sandbox sees them at `./input_files/`. Limits: 100 MB / file, 500 MB / job.
* **`/grep-api-reference`** — canonical documentation skill: the full `get_token` helper (shared verbatim across skills), session shape, endpoint inventory, multipart recipes, polling pattern. Every other skill references this for the auth helper.
* **`project` body field** on research submit (`POST /api/v1/research`). Surfaced in `/research`, `/quick-research`, `/ultra-research`, `/grep-plan`, `/grep-skill-creator` via an "Optional: SOP-driven project" section. Backend reads `SOP.md` from the named workspace directory and uses it as the agent's system prompt.

### Removed

* The `--api`/`--cli` flag from `bin/install.js`. There's only one flavour now.
* `findBrain()` / `installBrain()` / `brainCliMinVersion` enforcement.
* `~/.grep-research-skills/.flavour` sticky preference (cleaned up automatically on re-install).
* The `brain-cli` reference skill (lived in 0.2.x; documents the binary which this package no longer requires).

### Companion package

A separate `grep-research-skills-cli` package will publish the speed-optimized variant that routes through the `brain` Rust CLI for users who can install binaries. Both packages cover the same endpoints; the API flavour shipped here is the recommended default.

### Compatibility

* `~/.grep/session.json` from 0.1.x and 0.2.x carries over unchanged — no re-auth required.
* `~/.config/brain/config.toml` is still seeded with `descope_project_id` so a future install of `grep-research-skills-cli` doesn't need a separate setup step.
* Legacy `~/.grep-research-skills/scripts/` directory (0.1.x) and `.flavour` file (0.2.x) are cleaned up automatically.

## [0.2.0] — 2026-04-17

### Breaking

* **All skill HTTP calls move from Node to the [`brain` CLI](https://github.com/Parcha-ai/brain-cli).** The `scripts/` directory (`grep-api.js`, `auth.js`, `billing.js`) is removed. Every `SKILL.md` now invokes `brain <subcommand>` directly.
* **`@descope/node-sdk` dropped** as a runtime dep — Descope flows now live in the `brain` CLI.

### Added

* `bin/install.js` now:
  - Verifies `brain` is on `$PATH`; installs it via `curl -fsSL .../install.sh | sh` if missing (skip with `SKIP_BRAIN_INSTALL=1`).
  - Seeds `descope_project_id` into `~/.config/brain/config.toml` (one-time per machine).
  - Cleans up the legacy `~/.grep-research-skills/scripts/` directory.
* New `/brain-cli` skill — a reference index of every `brain` subcommand, its flags, JSON shapes, and common recipes.
* `.github/workflows/ci.yml` — lints skill frontmatter, fails the build if any skill still references the old Node scripts, and runs an installer smoke test with a stub `brain`.

### Compatibility

* Existing `~/.grep/session.json` sessions carry over automatically — no re-auth required.
* The installer auto-detects Claude Code and OpenClaw the same way.

## [0.1.0]

Initial release — Node-based skills calling Descope + Grep REST APIs directly.
