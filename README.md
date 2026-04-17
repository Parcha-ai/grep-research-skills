# GREP Research Skills

Give your AI agent deep research superpowers. GREP Research Skills connects Claude Code, Cowork, and OpenClaw to [GREP](https://grep.ai) — driven by the [`brain`](https://github.com/Parcha-ai/brain-cli) Rust CLI.

## Install

```bash
npx grep-research-skills
```

The installer:

1. Downloads the `brain` CLI if it's not already on `$PATH` (or check with `brain --version`).
2. Seeds the Descope project ID into `~/.config/brain/config.toml`.
3. Copies skill definitions to `~/.grep-research-skills/` and symlinks them into `~/.claude/skills/` (and `~/.openclaw/skills/` if OpenClaw is installed).

**Requirements:** Node.js 18+ and curl (for fetching `brain`).

### Alternative: Claude Code Plugin Marketplace

```
/plugin marketplace add parcha-ai/grep-research-skills
```

### Alternative: Git Clone

```bash
git clone https://github.com/parcha-ai/grep-research-skills.git ~/.grep-research-skills && ~/.grep-research-skills/setup
```

## What You Get

| Skill | Time | Description |
|-------|------|-------------|
| `/quick-research <topic>` | ~25s | Fast fact check — version lookups, API endpoint checks, quick pre-code sanity checks |
| `/research <topic>` | ~5 min | **Default.** Deep research with sourced citations. Great for investigating APIs/libraries before writing code |
| `/ultra-research <topic>` | up to 1 hour | Exhaustive investigations — security audits, legal research, full ecosystem surveys |
| `/grep-plan <topic>` | ~5 min | Research-informed planning — investigates best practices with your codebase as context before you `/plan` |
| `/grep-skill-creator <description>` | ~5 min | Create a new SKILL.md for any agent skill, powered by deep research on the target domain |
| `/grep-login` | — | Authenticate with your GREP account (enchanted link, OTP, or API key) |
| `/grep-upgrade` | — | Choose or change your subscription plan (Free / Pro / Ultra / PAYG) |
| `/grep-status` | — | Check account status and recent jobs |
| `/brain-cli` | — | Reference for every `brain` subcommand — what the CLI can do, with recipes and JSON shapes |

## Getting Started

1. **Install** using `npx grep-research-skills`
2. **Authenticate** by running `/grep-login` in your AI agent
3. **Research** anything with `/research "your topic"`

**Pick the right tier.** `/quick-research` is for one-liner answers, `/research` is the default for most tasks, and `/ultra-research` is reserved for heavy investigations that genuinely need exhaustive coverage (and can take up to an hour).

## How It Works

Every skill calls the [`brain` CLI](https://github.com/Parcha-ai/brain-cli) (open source, Apache-2.0). The CLI handles:

* **Auth.** Descope enchanted link / OTP / long-lived API key. Sessions persist in `~/.grep/session.json` and are auto-refreshed.
* **Research.** `brain research submit … --wait` blocks with live status-message streaming until complete.
* **Billing, onboarding, waitlist, apps, workspace browsing, reports, commit logs** — every HTTP endpoint Grep exposes.

**`/quick-research` and `/research`** block on the result (20s initial wait, 15s poll interval, 540s cap). If a deep job overshoots, the CLI exits with a `job_id` for later retrieval.

**`/ultra-research` is different.** Ultra-deep jobs can run up to 1 hour, which exceeds every bash tool's 10-minute cap. The skill submits the job, returns the `job_id` immediately, and uses the `/loop` feature to poll every 5 minutes across agent turns.

## Authentication

The primary flow is the Descope **enchanted link** — click a link in your email and your terminal session is authenticated simultaneously.

OTP and long-lived API keys are also supported; see `/brain-cli` for the full reference.

```bash
brain auth login           # pick a method interactively
brain auth status          # check current session
brain auth token           # print bearer token (auto-refreshes)
```

Sessions live in `~/.grep/session.json` (Unix mode `0o600`).

## For OpenClaw Users

The installer auto-detects OpenClaw and creates symlinks in `~/.openclaw/skills/`.

## Project Structure

```
grep-research-skills/
├── .claude-plugin/
│   ├── plugin.json            # Claude Code plugin manifest
│   └── marketplace.json       # Claude Code marketplace listing
├── skills/
│   ├── research/SKILL.md      # Deep research (~5 min)
│   ├── quick-research/SKILL.md
│   ├── ultra-research/SKILL.md
│   ├── grep-plan/SKILL.md
│   ├── grep-skill-creator/SKILL.md
│   ├── grep-login/SKILL.md
│   ├── grep-upgrade/SKILL.md
│   ├── grep-status/SKILL.md
│   └── brain-cli/SKILL.md     # Reference for every `brain` subcommand
├── bin/
│   └── install.js             # npx installer (fetches `brain`, seeds config, symlinks)
├── setup                      # Shell installer (git clone fallback)
├── package.json
└── README.md
```

## Upgrading from 0.1.x

The skills no longer ship a Node `scripts/` directory or depend on `@descope/node-sdk`. Everything routes through the `brain` CLI. Re-running `npx grep-research-skills` deletes the legacy `scripts/` and installs the CLI. Existing `~/.grep/session.json` sessions carry over automatically — no re-auth required.

## License

MIT — Parcha Labs, Inc.
