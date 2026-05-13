# GREP Research Skills

Give your AI agent deep research superpowers. GREP Research Skills connects Claude Code, Cowork, and OpenClaw to [GREP](https://grep.ai) — the #1 deep research engine.

## Install

```bash
npx grep-research-skills
```

That's it. Works with Claude Code, Cowork, and OpenClaw — the installer auto-detects your environment.

**Requirements:** Node.js 18+

### Alternative: Cowork / Claude.ai

For Cowork and Claude.ai, GREP is packaged as a **single `/research` skill** (instead of 8 individual skills). One router skill handles everything — it reads the right reference file based on your intent.

1. Download the latest zip from [Releases](https://github.com/parcha-ai/grep-research-skills/releases/latest)
2. In Cowork, go to **Settings → Plugins** and click **Add Plugin**
3. Upload `grep-research-skills-v0.1.0.zip`
4. The `/research` skill appears in your org — all team members get access

**Why one skill?** Claude Code discovers skills as individual symlinks, so 8 skills = better auto-triggering. Cowork/Claude.ai loads skills from a zip, where a single well-described router skill with reference files is more practical and avoids cluttering the skill list.

**Building the zip from source:**

```bash
node bin/build-cowork-zip.js
# → dist/grep-research-skills-v0.1.0.zip
```

**Required: Allow network access.** In your Cowork org settings under **Code execution → Allow network egress**, add these domains to the allowlist:

```
api.grep.ai
api.descope.com
```

Without this, the sandbox can't reach the GREP API or authenticate via Descope.

### Alternative: Claude Code Plugin Marketplace

```
/install-plugin parcha-ai/grep-research-skills
```

### Alternative: Git Clone

```bash
git clone https://github.com/parcha-ai/grep-research-skills.git ~/.grep-research-skills && ~/.grep-research-skills/setup
```

## What You Get

### Claude Code (8 individual skills)

| Skill | Time | Description |
|-------|------|-------------|
| `/quick-research <topic>` | ~25s | Fast fact check — version lookups, API endpoint checks, quick pre-code sanity checks |
| `/research <topic>` | ~5 min | **Default.** Deep research with sourced citations. Great for investigating APIs/libraries before writing code |
| `/ultra-research <topic>` | up to 1 hour | Exhaustive investigations — security audits, legal research, full ecosystem surveys |
| `/grep-plan <topic>` | ~5 min | Research-informed planning — investigates best practices with your codebase as context before you `/plan` |
| `/grep-skill-creator <description>` | ~5 min | Create a new SKILL.md for any agent skill, powered by deep research on the target domain |
| `/grep-login` | — | Authenticate with your GREP account (email OTP) |
| `/grep-upgrade` | — | Choose or change your subscription plan (Free / Pro / Ultra / PAYG) |
| `/grep-status` | — | Check account status and recent jobs |

### Cowork / Claude.ai (single consolidated skill)

| Skill | Description |
|-------|-------------|
| `/research` | All features in one skill — routes to the right workflow (deep, quick, ultra, plan, skill-creator, login, upgrade, status) based on what you ask for |

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
├── skills/                       # Claude Code: 8 individual skills
│   ├── research/SKILL.md         # Deep research (~5 min)
│   ├── quick-research/SKILL.md   # Fast fact check (~25s)
│   ├── ultra-research/SKILL.md   # Exhaustive research (up to 1 hr)
│   ├── grep-plan/SKILL.md        # Research-informed planning
│   ├── grep-skill-creator/SKILL.md # Research-powered skill generator
│   ├── grep-login/SKILL.md       # Authentication
│   ├── grep-upgrade/SKILL.md     # Plan selection & Stripe checkout
│   └── grep-status/SKILL.md      # Status & job checking
├── dist/cowork/                  # Cowork/Claude.ai: single consolidated skill
│   └── research/
│       ├── SKILL.md              # Router — routes intent to reference files
│       ├── references/           # Workflow details for each intent
│       │   ├── deep.md
│       │   ├── quick.md
│       │   ├── ultra.md
│       │   ├── plan.md
│       │   ├── skill-creator.md
│       │   ├── login.md
│       │   ├── upgrade.md
│       │   └── status.md
│       └── scripts/              # Bundled at build time by build-cowork-zip.js
├── scripts/
│   ├── auth.js                   # Descope OTP headless auth
│   ├── grep-api.js               # GREP API client
│   ├── billing.js                # Billing & Stripe checkout client
│   └── update-check.js           # Auto-update checker
├── bin/
│   ├── install.js                # npx installer
│   └── build-cowork-zip.js       # Builds the Cowork/Claude.ai zip release
├── setup                         # Shell installer (git clone fallback)
├── package.json
└── README.md
```

## License

MIT — Parcha Labs, Inc.
