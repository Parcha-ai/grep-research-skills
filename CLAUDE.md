# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

GREP Research Skills is a plugin for Claude Code, Cowork, and OpenClaw that connects AI agents to [GREP](https://grep.ai) deep research. It provides three research tiers (`/quick-research`, `/research`, `/ultra-research`) plus auth and status skills, all powered by headless Descope OTP authentication. Distributed via npm as `grep-research-skills`.

## Architecture

Two Node.js scripts do all the work — skills are just SKILL.md instruction files that tell Claude Code how to invoke them:

- **`scripts/auth.js`** — Descope OTP authentication. Two-step flow (`send-code` + `verify`) for AI agents, one-step (`login`) for terminals. Sessions stored in `~/.grep/session.json`. Handles JWT refresh via `Bearer <projectId>:<refreshJwt>` format.
- **`scripts/grep-api.js`** — GREP API client. `run` command does blocking submit+poll (used by `/research` and `/quick-research`). `research` command does non-blocking submit (used by `/ultra-research`). Polls with backoff, extracts reports from `status_messages[].content.content.text` (text_block type).
- **`skills/*/SKILL.md`** — Instruction files that Claude Code loads as skills. Each resolves its script path via symlink resolution: `$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts`.

## Key Design Decisions

- **Three install methods**: `npx grep-research-skills` (primary — copies to `~/.grep-research-skills/` then symlinks), Claude Code marketplace (`/plugin marketplace add parcha-ai/grep-research-skills`), or `git clone + setup` (fallback). All create per-skill symlinks in `~/.claude/skills/` because Claude Code only discovers skills at the top level.
- **Two-step auth for agents**: Skills use `send-code` + `verify` (non-interactive) rather than `login` (which blocks on stdin). The skill uses `AskUserQuestion` between steps.
- **Blocking vs non-blocking research**: `/quick-research` (60s max) and `/research` (540s max) use `grep-api.js run` which blocks until completion. `/ultra-research` uses `grep-api.js research` (non-blocking submit) + `/loop` cron polling every 5 minutes because ultra-deep jobs can take up to 1 hour, exceeding the bash 10-min cap.
- **Report extraction**: Reports are found by walking `status_messages` backwards looking for `text_block` entries with markdown headings or >500 chars. The relevant field is `content.content.text` (nested), not `content.text`.

## Common Commands

```bash
# Install
npx grep-research-skills                         # Primary install method
./setup                                          # Fallback for git clone installs

# Auth
node scripts/auth.js send-code <email>          # Send OTP (non-interactive)
node scripts/auth.js verify <email> <code>       # Verify OTP, save session
node scripts/auth.js login [email]               # Interactive terminal login
node scripts/auth.js status                      # Check session health
node scripts/auth.js token                       # Print raw JWT to stdout

# Research
node scripts/grep-api.js run "query"                          # Blocking: submit + poll + print report
node scripts/grep-api.js run "query" --depth=ultra_fast       # Quick research (~25s)
node scripts/grep-api.js run "query" --depth=deep --max-wait=540  # Deep research (default)
node scripts/grep-api.js research "query" --depth=ultra_deep  # Non-blocking submit only
node scripts/grep-api.js status <job_id>                      # Check job status
node scripts/grep-api.js result <job_id>                      # Get job report
node scripts/grep-api.js jobs                                 # List recent jobs
```

## Environment

- **Runtime**: Node.js 18+ (no npm dependencies — uses native `fetch`)
- **API base**: `https://api.grep.ai` (overridable via `GREP_API_BASE` env var)
- **Auth provider**: Descope (project ID `P35S8vZ7BYoDSOJVaYbIDRZObJq6`)
- **Session storage**: `~/.grep/session.json` (mode 0600)
- **Plugin manifest**: `.claude-plugin/plugin.json`

## Gotchas

- The `grep-api.js` `isExpired()` uses a 30-second buffer (refreshes proactively before actual expiry), while `auth.js` `isExpired()` does not. This is intentional — the API client refreshes mid-flight during long polls.
- Bash timeout for `/research` must be set to 560000ms (not the default 120000ms) to avoid killing the process mid-research.
- Each `send-code` call invalidates the previous OTP. Never send two codes in a row without verifying the first.
