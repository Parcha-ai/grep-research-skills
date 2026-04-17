# Changelog

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
