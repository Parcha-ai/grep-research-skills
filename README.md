# GREP Skills

Give your AI agent deep research superpowers. GREP Skills connects Claude Code, OpenClaw, and other AI coding agents to [GREP](https://grep.ai) - the #1 deep research engine.

## Install (One Command)

```bash
git clone https://github.com/parcha-ai/grep-skills.git ~/.claude/skills/grep && ~/.claude/skills/grep/setup
```

**Requirements:** Node.js 18+, Claude Code or OpenClaw

## What You Get

| Skill | Description |
|-------|-------------|
| `/grep-research <topic>` | Run deep research on any topic with sourced citations |
| `/grep-login` | Authenticate with your GREP account |
| `/grep-status` | Check account status and recent jobs |

## Getting Started

1. **Install** using the one-liner above
2. **Authenticate** by running `/grep-login` in Claude Code
3. **Research** anything with `/grep-research "your topic"`

## How It Works

GREP Skills uses headless email authentication (powered by Descope) - no browser needed. Works in terminals, SSH sessions, and headless environments.

Research jobs are async:
1. You submit a query
2. GREP researches across multiple sources
3. Results come back with citations and confidence scores

Your AI agent handles the submit-poll-present cycle automatically.

## Authentication

GREP uses email-based OTP for authentication:

```bash
# Authenticate (sends code to your email)
node ~/.claude/skills/grep/scripts/auth.js login you@email.com

# Check status
node ~/.claude/skills/grep/scripts/auth.js status

# Get token (for scripting)
node ~/.claude/skills/grep/scripts/auth.js token
```

Sessions are stored in `~/.grep/session.json` and auto-refresh.

## For OpenClaw Users

The setup script auto-detects OpenClaw and creates symlinks:

```bash
~/.openclaw/skills/grep-research/
~/.openclaw/skills/grep-login/
~/.openclaw/skills/grep-status/
```

## Project Structure

```
grep-skills/
├── .claude-plugin/plugin.json     # Claude Code plugin manifest
├── skills/
│   ├── grep-research/SKILL.md     # Deep research skill
│   ├── grep-login/SKILL.md        # Authentication skill
│   └── grep-status/SKILL.md       # Status & job checking
├── scripts/
│   ├── auth.js                    # Descope OTP headless auth
│   └── grep-api.js                # GREP API client
├── setup                          # One-command installer
└── README.md
```

## License

MIT - Parcha Labs, Inc.
