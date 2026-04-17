# GREP Research Skills

Give your AI agent deep research superpowers. GREP Research Skills connects Claude Code, Cowork, and OpenClaw to [GREP](https://grep.ai) — the #1 deep research engine.

## Install

```bash
npx grep-research-skills
```

That's it. Works with Claude Code, Cowork, and OpenClaw — the installer auto-detects your environment.

**Requirements:** Node.js 18+

### Alternative: Claude Code Plugin Marketplace

```
/plugin marketplace add parcha-ai/grep-research-skills
```

### Alternative: Git Clone

```bash
git clone https://github.com/parcha-ai/grep-research-skills.git ~/.grep-research-skills && ~/.grep-research-skills/setup
```

## What You Get

### Research

| Skill | Time | Description |
|-------|------|-------------|
| `/quick-research <topic>` | ~25s | Fast fact check — version lookups, API endpoint checks, quick pre-code sanity checks |
| `/research <topic>` | ~5 min | **Default.** Deep research with sourced citations. Great for investigating APIs/libraries before writing code |
| `/ultra-research <topic>` | up to 1 hour | Exhaustive investigations — security audits, legal research, full ecosystem surveys |
| `/grep-plan <topic>` | ~5 min | Research-informed planning — investigates best practices with your codebase as context before you `/plan` |
| `/grep-skill-creator <description>` | ~5 min | Create a new SKILL.md for any agent skill, powered by deep research on the target domain |

### Account

| Skill | Description |
|-------|-------------|
| `/grep-login` | Authenticate with your GREP account (email OTP, enchanted link, or API key) |
| `/grep-upgrade` | Choose or change your subscription plan (Free / Pro / Ultra / PAYG) |
| `/grep-status` | Check account status and recent jobs |

### Job management *(new in 0.2)*

| Skill | Description |
|-------|-------------|
| `/grep-jobs` | List recent jobs (lighter than `/grep-status`) |
| `/grep-search` | Search past jobs by status / question text |
| `/grep-resume` | Resume a paused job, optionally with a steering message |
| `/grep-stop` | Pause or cancel a running check, soft-delete a check result |
| `/grep-apps` | List app artifacts (slidedecks, podcasts, narratives, HTML exports) |

### Context + workspace *(new in 0.2)*

| Skill | Description |
|-------|-------------|
| `/grep-inputs` | Attach per-job input files (CSVs, PDFs, data) to a specific research job |
| `/grep-defaults` | Manage per-user default context files — uploaded once, hydrated into every research sandbox |
| `/grep-workspace` | Browse the Pierre-backed workspace tree, read files, view commit history & diffs |
| `/grep-projects` | Create + manage SOP-driven projects (research workflows with a templated system prompt) |
| `/grep-experts` | Build + train custom research experts (named personas with their own config + knowledge base) |

## Getting Started

1. **Install** using `npx grep-research-skills`
2. **Authenticate** by running `/grep-login` in your AI agent
3. **Research** anything with `/research "your topic"`

**Pick the right tier.** `/quick-research` is for one-liner answers, `/research` is the default for most tasks, and `/ultra-research` is reserved for heavy investigations that genuinely need exhaustive coverage (and can take up to an hour).

## How It Works

GREP Research Skills uses headless email authentication (powered by Descope) — no browser needed. Works in terminals, SSH sessions, and headless environments.

**`/quick-research` and `/research`** are blocking: the skill submits the job, polls with backoff, and returns the finished report in a single call. Claude Code's bash tool caps at 10 minutes, so `/research` is bounded to a 9-minute server-side wait. If a deep job overshoots, the skill exits with a `job_id` for later retrieval.

**`/ultra-research` is different.** Ultra-deep jobs can run up to 1 hour, which exceeds the bash 10-minute cap. The skill submits the job, returns the `job_id` immediately, and polls on 5-minute intervals across multiple agent turns. You can keep working while it runs; the agent checks back periodically and presents the report when ready.

## Authentication

```bash
# Authenticate (sends code to your email)
node ~/.grep-research-skills/scripts/auth.js login you@email.com

# Check status
node ~/.grep-research-skills/scripts/auth.js status

# Get token (for scripting)
node ~/.grep-research-skills/scripts/auth.js token
```

Sessions are stored in `~/.grep/session.json` and auto-refresh.

## For OpenClaw Users

The installer auto-detects OpenClaw and creates symlinks in `~/.openclaw/skills/`.

You can also publish to ClawHub or install skills manually:

```bash
# Drop into OpenClaw's skill directory
cp -r ~/.grep-research-skills/skills/* ~/.openclaw/skills/
```

## Project Structure

```
grep-research-skills/
├── .claude-plugin/
│   ├── plugin.json               # Claude Code plugin manifest
│   └── marketplace.json          # Claude Code marketplace listing
├── skills/                       # 18 skills total
│   ├── research/                 # — Research —
│   ├── quick-research/
│   ├── ultra-research/
│   ├── grep-plan/
│   ├── grep-skill-creator/
│   ├── grep-login/               # — Account —
│   ├── grep-upgrade/
│   ├── grep-status/
│   ├── grep-jobs/                # — Job management (new) —
│   ├── grep-search/
│   ├── grep-resume/
│   ├── grep-stop/
│   ├── grep-apps/
│   ├── grep-inputs/              # — Context + workspace (new) —
│   ├── grep-defaults/
│   ├── grep-workspace/
│   ├── grep-projects/
│   └── grep-experts/
├── scripts/
│   ├── auth.js                   # Descope OTP headless auth
│   ├── grep-api.js               # GREP API client (research, search, inputs,
│   │                             #   defaults, workspace, projects, experts,
│   │                             #   lifecycle, apps)
│   └── billing.js                # Billing & Stripe checkout client
├── bin/
│   └── install.js                # npx installer
├── setup                         # Shell installer (git clone fallback)
├── package.json
├── CHANGELOG.md
└── README.md
```

## License

MIT — Parcha Labs, Inc.
