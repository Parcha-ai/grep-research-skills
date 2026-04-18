# Changelog

All notable changes to `grep-research-skills` are documented here.

## [0.2.0] — 2026-04-17

Wraps every new endpoint family that landed on `feat/workspace-projects-browser`. **Additive** — nothing from v0.1 is removed; existing skills continue to work unchanged.

### Added

**10 new skills:**

- `/grep-search` — search past jobs by status / question substring (client-side filter over `/api/v1/research`).
- `/grep-inputs` — attach / remove per-job input files (`POST/DELETE /grep/jobs/{id}/inputs`, multipart). Files hydrate into the job's sandbox at `./input_files/`. Limits: 100 MB / file, 500 MB / job.
- `/grep-defaults` — manage per-user default context files (`GET/POST/DELETE /grep/user/defaults`, multipart). Files hydrate into every research sandbox at `./defaults/`.
- `/grep-workspace` — browse the user's Pierre-backed workspace tree (`GET /grep/code-storage/workspace[/tree|/file|/history|/diff]`). Read files, view commit history, diff between commits.
- `/grep-projects` — manage workspace projects (`POST/DELETE /grep/code-storage/workspace/projects/*`). Upload SOPs and reference files into `projects/{name}/`, then submit research with `--project=projects/<name>` to use that SOP as the agent's system prompt.
- `/grep-experts` — initialize, save, and train custom research experts (`POST /grep/code-storage/workspace/experts/*`). Each expert is a named persona with a config and an optional knowledge base trained from documents.
- `/grep-resume` — resume a paused job, optionally with a steering message (`POST /grep/research/{id}/resume`).
- `/grep-stop` — pause or cancel a running check, soft-delete a check result (`POST /grep/stopGrepCheck`, `DELETE /grep/check-result/{id}`).
- `/grep-apps` — list app artifacts (slidedecks, podcasts, narratives, HTML exports) generated from research jobs (`GET /api/v1/apps`, `/apps/{id}`).
- `/grep-jobs` — quick listing of recent jobs (lighter sibling of `/grep-status`).

**`scripts/grep-api.js` extensions:**

- `apiMultipart()` helper for multipart uploads.
- 20+ new helper functions and CLI subcommands wrapping every new endpoint (see `node scripts/grep-api.js help` for the full list).
- `searchJobs(filter)` — client-side filter over the existing `/api/v1/research` listing endpoint, since the backend has no full-text search yet.
- `submitResearch` / `runResearch` extended to accept all new optional fields on `ResearchJobInput`: `--project`, `--expert`, `--language`, `--from-date`, `--to-date`, `--additional-thesis`, `--website`, `--custom-skills`, `--custom-mcp-tools`, `--skip-clarification`, `--action-mode`, `--output-type`.

**Existing skill updates (light):**

- `/research`, `/quick-research`, `/ultra-research` — added an "Advanced flags" section documenting the new optional research-submit fields. The existing happy path is unchanged.
- `/grep-status` — added a one-liner pointing at `/grep-search` for filtered listings.
- `/grep-skill-creator` — added a note about the `--custom-skills` field on research submit.

### Unchanged

- `scripts/auth.js`, `scripts/billing.js`, the existing 8 skills, and `bin/install.js` are untouched. Sessions in `~/.grep/session.json` continue to work.

## [0.1.0]

Initial release — Node-based skills calling Descope + Grep REST APIs directly.
