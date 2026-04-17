# GREP Research Skills

Give your AI agent deep research superpowers. 11 skills connecting Claude Code, Cowork, and OpenClaw to [GREP](https://grep.ai) via raw HTTP — no binary required, works everywhere Node runs (including Claude.ai web and other sandboxed environments).

## Install

### Claude Code Plugin Marketplace (recommended)

```
/plugin marketplace add parcha-ai/grep-research-skills
```

### npm

```bash
npx grep-research-skills
```

### Git clone

```bash
git clone https://github.com/parcha-ai/grep-research-skills.git ~/.grep-research-skills && ~/.grep-research-skills/setup
```

That's it. The installer drops 11 skills into `~/.claude/skills/` (and `~/.openclaw/skills/` if OpenClaw is installed). No binary fetched, no PATH to configure.

**Requirements:** Node.js 18+ (already present in Claude Code).

## What you get

| Skill | Time | Description |
|-------|------|-------------|
| `/quick-research <topic>` | ~25s | Fast fact check — version lookups, API endpoint checks, quick pre-code sanity checks |
| `/research <topic>` | ~5 min | **Default research tier.** Deep research with sourced citations. Great for investigating APIs/libraries before writing code |
| `/ultra-research <topic>` | up to 1 hour | Exhaustive investigations — security audits, legal research, full ecosystem surveys |
| `/grep-plan <topic>` | ~5 min | Research-informed planning — investigates best practices with your codebase as context |
| `/grep-skill-creator <description>` | ~5 min | Create a new SKILL.md for any agent skill, powered by deep research |
| `/grep-login` | — | Authenticate with your GREP account (enchanted link, OTP, or API key) |
| `/grep-status` | — | Check account status and recent jobs |
| `/grep-upgrade` | — | Choose or change your subscription plan (Free / Pro / Ultra / PAYG) |
| `/grep-defaults` | — | Manage per-user default context files — uploaded once, hydrated into every research sandbox |
| `/grep-inputs` | — | Attach per-job input files (CSVs, PDFs, data) to a specific research job |
| `/grep-api-reference` | — | Reference for every raw HTTP call: `get_token` helper, endpoint inventory, multipart recipes |

## Getting started

1. **Install** using one of the methods above.
2. **Authenticate** by running `/grep-login`.
3. **Research** anything with `/research "your topic"`.

**Pick the right tier.** `/quick-research` is for one-liner answers, `/research` is the default for most tasks, `/ultra-research` is reserved for exhaustive investigations that genuinely need it (and can take up to an hour).

## How it works

Every skill speaks the GREP REST API directly via `curl` plus a small Node-based `get_token` helper that handles auth and JWT refresh. Sessions persist in `~/.grep/session.json`. No external dependencies beyond what Claude Code already ships.

`/quick-research` and `/research` block on the result (15–20s initial wait, 5–15s polling, up to 540s cap). If a deep job overshoots, the skill returns with a `job_id` for later retrieval via `/grep-status`.

`/ultra-research` is different: ultra-deep jobs can run up to an hour, exceeding any bash tool's 10-minute cap. The skill submits the job, returns the `job_id` immediately, and uses Claude Code's `/loop` feature to poll every 5 minutes across agent turns.

## Authentication

Three methods, all supported via raw HTTP from `/grep-login`:

- **Enchanted link** (recommended) — click a magic link in your email, terminal authenticates simultaneously.
- **OTP** — 6-digit code emailed to you, agent-friendly two-step flow.
- **API key** — long-lived; best for CI / headless environments.

Sessions live in `~/.grep/session.json` with mode `0o600`.

## For OpenClaw users

The installer auto-detects OpenClaw and creates symlinks in `~/.openclaw/skills/`.

## Power-user variant: speed-optimized via `brain` CLI

Most users should stick with this package. If you can install a Rust binary on your machine and want faster JWT refresh, cleaner multipart uploads, and a native CLI, install the speed-optimized variant instead:

- **npm:** `npx grep-research-skills-cli`
- **Marketplace:** `/plugin marketplace add parcha-ai/grep-research-skills-cli`

Both variants cover the same endpoints. Pick this default unless you have a specific reason to want the binary path.

## Project structure

```
grep-research-skills/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── skills/                # 11 SKILL.md directories — raw HTTP via curl
│   ├── research/SKILL.md
│   ├── quick-research/SKILL.md
│   ├── ultra-research/SKILL.md
│   ├── grep-login/SKILL.md
│   ├── grep-status/SKILL.md
│   ├── grep-upgrade/SKILL.md
│   ├── grep-plan/SKILL.md
│   ├── grep-skill-creator/SKILL.md
│   ├── grep-defaults/SKILL.md
│   ├── grep-inputs/SKILL.md
│   └── grep-api-reference/SKILL.md
├── bin/
│   └── install.js         # npx installer
├── setup                  # git-clone fallback installer
├── package.json
├── CHANGELOG.md
└── README.md
```

## Upgrading from 0.2.x

0.2.x routed every skill through the `brain` Rust CLI. 0.3.0 makes raw HTTP the default so the package works in environments that can't install binaries. Re-running `npx grep-research-skills` installs the new skills; existing `~/.grep/session.json` carries over unchanged. If you specifically want the CLI-backed variant, install the separate `grep-research-skills-cli` package.

## Upgrading from 0.1.x

The skills no longer ship a Node `scripts/` directory or depend on `@descope/node-sdk`. Re-running `npx grep-research-skills` cleans up legacy artifacts and installs the current skills.

## License

MIT — Parcha Labs, Inc.
