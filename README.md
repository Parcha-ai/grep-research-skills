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

| Skill | Time | Description |
|-------|------|-------------|
| `/quick-research <topic>` | ~25s | Fast fact check — version lookups, API endpoint checks, quick pre-code sanity checks |
| `/research <topic>` | ~5 min | **Default.** Deep research with sourced citations. Great for investigating APIs/libraries before writing code |
| `/ultra-research <topic>` | up to 1 hour | Exhaustive investigations — security audits, legal research, full ecosystem surveys |
| `/grep-login` | — | Authenticate with your GREP account (email OTP) |
| `/grep-status` | — | Check account status and recent jobs |

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
├── skills/
│   ├── research/SKILL.md         # Deep research (~5 min)
│   ├── quick-research/SKILL.md   # Fast fact check (~25s)
│   ├── ultra-research/SKILL.md   # Exhaustive research (up to 1 hr)
│   ├── grep-login/SKILL.md       # Authentication
│   └── grep-status/SKILL.md      # Status & job checking
├── scripts/
│   ├── auth.js                   # Descope OTP headless auth
│   └── grep-api.js               # GREP API client
├── bin/
│   └── install.js                # npx installer
├── setup                         # Shell installer (git clone fallback)
├── package.json
└── README.md
```

## License

MIT — Parcha Labs, Inc.
