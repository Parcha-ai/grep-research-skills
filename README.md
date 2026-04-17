# GREP Research Skills

Give your AI agent deep research superpowers. Connects Claude Code, Cowork, and OpenClaw to [GREP](https://grep.ai) via two installable flavours.

## Install

```bash
# API flavour (default) — raw HTTP over curl. No binary needed.
npx grep-research-skills

# OR CLI flavour — fetches the brain Rust binary for a richer UX.
npx grep-research-skills --cli
```

The **API flavour** is the default because it works everywhere: sandboxed Claude Code environments, Claude.ai web, some cloud runners, locked-down laptops where installing arbitrary binaries isn't allowed. Every skill speaks the GREP REST API directly via `curl`. Only Node.js 18+ is required (already present in Claude Code).

The **CLI flavour** drops the [`brain`](https://github.com/Parcha-ai/brain-cli) Rust binary onto your `$PATH` and routes every skill through it. Faster token refresh, cleaner multipart uploads, single canonical reference point. Requires the ability to execute a downloaded binary.

Both flavours cover the **same endpoints** — pick whichever fits your environment.

### Sticky flavour

The installer remembers your last choice in `~/.grep-research-skills/.flavour`. Re-running `npx grep-research-skills` without a flag re-uses the prior flavour; pass `--api` or `--cli` to switch. Switching cleanly swaps the symlinks in `~/.claude/skills/` and `~/.openclaw/skills/` — no stale skills left behind.

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
| `/research <topic>` | ~5 min | **Default research tier.** Deep research with sourced citations. Great for investigating APIs/libraries before writing code |
| `/ultra-research <topic>` | up to 1 hour | Exhaustive investigations — security audits, legal research, full ecosystem surveys |
| `/grep-plan <topic>` | ~5 min | Research-informed planning — investigates best practices with your codebase as context before you `/plan` |
| `/grep-skill-creator <description>` | ~5 min | Create a new SKILL.md for any agent skill, powered by deep research on the target domain |
| `/grep-login` | — | Authenticate with your GREP account (enchanted link, OTP, or API key) |
| `/grep-upgrade` | — | Choose or change your subscription plan (Free / Pro / Ultra / PAYG) |
| `/grep-status` | — | Check account status and recent jobs |
| `/grep-defaults` | — | Manage per-user default context files — uploaded once, hydrated into every research sandbox at `./defaults/` |
| `/grep-inputs` | — | Attach per-job input files (CSVs, PDFs, data) to a specific research job; hydrated at `./input_files/` |
| `/brain-cli` *(CLI flavour)* | — | Reference for every `brain` subcommand — what the CLI can do, with recipes and JSON shapes |
| `/grep-api-reference` *(API flavour)* | — | Reference for every raw HTTP call — the canonical `get_token` helper, endpoint inventory, multipart recipes |

## Getting Started

1. **Install** using `npx grep-research-skills` (API flavour, the default) or `npx grep-research-skills --cli`.
2. **Authenticate** by running `/grep-login`.
3. **Research** anything with `/research "your topic"`.

**Pick the right tier.** `/quick-research` is for one-liner answers, `/research` is the default for most tasks, and `/ultra-research` is reserved for heavy investigations that genuinely need exhaustive coverage (and can take up to an hour).

## How It Works

Both flavours speak the same GREP REST API. The difference is only in how the curl is made:

* **API flavour skills** inline `curl` commands + a small `get_token` shell helper (copied from `/grep-api-reference`) that handles JWT refresh via Node.js. No external dependencies.
* **CLI flavour skills** shell out to `brain <subcommand>`, which is a Rust binary that does the same HTTP work with stronger ergonomics (auto-refresh, typed errors, multipart helpers).

Session state (`~/.grep/session.json`) is identical across flavours. Sessions authored by one flavour are recognized by the other.

**`/quick-research` and `/research`** block on the result (15–20s initial wait, 5–15s poll interval, up to 540s cap). If a deep job overshoots, the skill returns with a `job_id` for later retrieval.

**`/ultra-research` is different.** Ultra-deep jobs can run up to 1 hour, exceeding every bash tool's 10-minute cap. The skill submits the job, returns the `job_id` immediately, and uses the `/loop` feature to poll every 5 minutes across agent turns.

## Authentication

Three methods supported in both flavours:

* **Enchanted link** (recommended) — click a link in your email, terminal authenticates simultaneously.
* **OTP** — 6-digit code emailed to you, agent-friendly two-step flow.
* **API key** — long-lived; best for CI / headless environments.

```bash
# CLI flavour:
brain auth login
brain auth status
brain auth token
```

```bash
# API flavour — see /grep-api-reference for the full get_token helper and curl shapes.
```

Sessions live in `~/.grep/session.json` with mode `0o600`.

## For OpenClaw Users

The installer auto-detects OpenClaw and creates symlinks in `~/.openclaw/skills/`.

## Project Structure

```
grep-research-skills/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── skills-api/                # raw HTTP flavour (default)
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
├── skills-cli/                # brain CLI flavour
│   ├── (same 10 skills as API, rewritten to call brain)
│   └── brain-cli/SKILL.md
├── bin/
│   └── install.js             # --api | --cli | (defaults to --api)
├── setup                      # git-clone fallback installer
├── package.json
├── CHANGELOG.md
└── README.md
```

## Upgrading from 0.2.x

0.3.0 splits the single `skills/` directory into `skills-api/` and `skills-cli/`. If you were on 0.2.x (CLI-only), the installer re-uses your prior setup via the sticky `.flavour` file — re-running `npx grep-research-skills` stays on CLI. To switch to the more portable API flavour, run `npx grep-research-skills --api`.

## Upgrading from 0.1.x

The skills no longer ship a Node `scripts/` directory or depend on `@descope/node-sdk`. Re-running `npx grep-research-skills` deletes the legacy `scripts/` and installs the current flavour. Existing `~/.grep/session.json` sessions carry over automatically.

## License

MIT — Parcha Labs, Inc.
