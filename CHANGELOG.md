# Changelog

## [0.3.0] — 2026-04-17

### Added

* **Two installable flavours.** `npx grep-research-skills` now accepts `--api` (default) or `--cli`:
  - **`--api`** — raw-HTTP skills from `skills-api/`. No `brain` binary required. Works in sandboxed Claude Code environments (Claude.ai web, some cloud runners, locked-down laptops) where installing arbitrary binaries isn't allowed.
  - **`--cli`** — CLI-backed skills from `skills-cli/` + fetches the `brain` Rust binary. Faster UX + richer ergonomics, requires ability to drop a binary on PATH.
* **Sticky flavour preference.** First install writes `~/.grep-research-skills/.flavour`; subsequent `npx grep-research-skills` runs without a flag re-use that choice. Passing `--api` or `--cli` switches cleanly (opposite-flavour symlinks are cleaned up automatically).
* **Two new skills in both flavours** — powered by endpoints that landed on `feat/workspace-projects-browser`:
  - `/grep-defaults` — upload / list / delete per-user default context files (`POST/GET/DELETE /grep/user/defaults`). Files live in Pierre at `users/{uid}/defaults/` and are hydrated into every sandbox at `./defaults/`.
  - `/grep-inputs` — attach / delete per-job input files (`POST/DELETE /grep/jobs/{id}/inputs`). Files land at `jobs/{id}/input_files/` in Pierre; sandbox sees them at `./input_files/`. Limits: 100 MB / file, 500 MB / job.
* **New API-flavour-only skill** `/grep-api-reference` — canonical documentation for every HTTP call the API flavour makes: the `get_token` helper (shared across skills), session file format, endpoint inventory, multipart recipes, polling pattern.
* **`/research`, `/quick-research`, `/ultra-research`, `/grep-plan`, `/grep-skill-creator`** — now document the `--project <workspace/path>` flag (CLI flavour) / `"project"` body field (API flavour). Points the backend at a workspace directory whose `SOP.md` becomes the agent's system prompt.

### Changed

* **Default install flavour is API**, not CLI. Opens the plugin to environments that can't install binaries. Existing 0.2.x users on a machine with `brain` installed still get CLI by passing `--cli` or relying on the sticky file.
* `skills/` moved to `skills-cli/`; new `skills-api/` sits beside it.
* `bin/install.js` rewritten around flavour dispatch; `brainCliMinVersion` bumped to `0.2.0`.
* CI workflow now lints both flavours, runs two installer smoke tests (API + CLI), and verifies the flavour switch correctly swaps symlinks.

### Compatibility

* Sessions in `~/.grep/session.json` work unchanged between flavours.
* `~/.config/brain/config.toml` descope ID is seeded by both flavours, so switching from API to CLI later doesn't need reconfig.

## [0.2.0] — 2026-04-17

### Breaking

* **All skill HTTP calls move from Node to the [`brain` CLI](https://github.com/Parcha-ai/brain-cli).** The `scripts/` directory (`grep-api.js`, `auth.js`, `billing.js`) is removed. Every `SKILL.md` now invokes `brain <subcommand>` directly.
* **`@descope/node-sdk` dropped** as a runtime dep — Descope flows now live in the `brain` CLI.

### Added

* `bin/install.js` now:
  - Verifies `brain` is on `$PATH`; installs it via `curl -fsSL .../install.sh | sh` if missing (skip with `SKIP_BRAIN_INSTALL=1`).
  - Seeds `descope_project_id` into `~/.config/brain/config.toml` (one-time per machine).
  - Cleans up the legacy `~/.grep-research-skills/scripts/` directory.
* New `/brain-cli` skill (`skills/brain-cli/SKILL.md`) — a reference index of every `brain` subcommand, its flags, JSON shapes, and common recipes. Agents now know what the CLI can do.
* `.github/workflows/ci.yml` — lints skill frontmatter, fails the build if any skill still references the old Node scripts, and runs an installer smoke test with a stub `brain`.

### Compatibility

* Existing `~/.grep/session.json` sessions carry over automatically — no re-auth required.
* The installer auto-detects Claude Code and OpenClaw the same way.

## [0.1.0]

Initial release — Node-based skills calling Descope + Grep REST APIs directly.
