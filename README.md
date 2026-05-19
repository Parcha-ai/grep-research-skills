# GREP Research Skills

Give your AI agent deep research superpowers. GREP Research Skills connects Claude Code, Cowork, and OpenClaw to [GREP](https://grep.ai) — the #1 deep research engine.

> The wallet/PAYG gateway path (Stripe Link, Base USDC, `Receipt pi_xxx` auth, x402 funding) lives on the [`mpp-gateway-future`](https://github.com/Parcha-ai/grep-research-skills/tree/mpp-gateway-future) branch. It returns once the backend's MPP gateway is GA. Until then this repo targets the v2 API only — Descope JWT or `grp_*` API key.

## Install

```bash
npx grep-research-skills
```

That's it. Works with Claude Code, Cowork, and OpenClaw — the installer auto-detects your environment.

**Requirements:** Node.js 18+

### Alternative: Cowork

1. Download the latest zip from [Releases](https://github.com/parcha-ai/grep-research-skills/releases/latest)
2. In Cowork, go to **Settings → Plugins** and click **Add Plugin**
3. Upload `grep-research-skills-v0.2.0.zip`
4. The skills will appear in your org — all team members get access

**Required: Allow network access.** In your Cowork org settings under **Code execution → Allow network egress**, add these domains to the allowlist:

```
api.grep.ai
preview-api.grep.ai
api.descope.com
```

(Add `preview-api.grep.ai` only if you're testing against the preview deployment via `GREP_API_BASE`.)

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

| Skill | Triggers on | What it does |
|---|---|---|
| `/grep-login` | "log in to grep", "grep auth" | Authenticate via email OTP or API key |
| `/grep-status` | "grep status", "what plan am I on" | Account status + recent jobs |
| `/grep-upgrade` | "upgrade grep", "buy more credits" | Choose / change subscription plan (Free / Pro / Ultra / PAYG) |
| `/grep-skill-creator` | "make a grep skill" | Create a new SKILL.md for any agent skill, powered by deep research |
| `/grep-plan` | "plan a grep research", "research-informed plan" | Research best practices + your codebase context before you `/plan` |
| `/quick-research` | "fast research / lookup" | ~25s sourced one-liner — version checks, API endpoints, quick lookups |
| `/research` | "research X" (default tier) | ~5 min comprehensive report with citations — the default for most tasks |
| `/ultra-research` | "deep / exhaustive research on X" | Up to 1hr investigation — security audits, legal, ecosystem surveys |
| **`/grep-mcp`** | "install grep MCP", "grep as MCP server" | Wire Grep into `.mcp.json` as 4 native MCP tools |
| **`/grep-domain-expert`** | "use the legal/medical/patent/... expert" | Route to one of 27 public domain experts (legal, medical, financial, real estate, supply chain, maritime, etc.) |
| **`/grep-build-app`** | "build me an interactive app for X" | Interactive HTML web apps via the app-builder expert (effort=build, ~$2, 10-15min) |
| **`/grep-build-slidedeck`** | "make me a slidedeck about X" | Research-backed HTML slidedeck with arrow-key nav + PDF export |
| **`/grep-build-spreadsheet`** | "build a spreadsheet of X" | Sortable HTML spreadsheet with CSV export |
| **`/grep-research-workflow`** | "investigate X and then make Y" | Multi-step chain: orient → deep dive → optional build artifact |
| **`/grep-with-context`** | "research using these PDFs" | Upload files as research inputs (PDFs, CSVs, images) |
| **`/grep-continue`** | "follow up on that research" | Continue an existing job with a new question, inheriting prior research context |

**Bold rows are new in 0.2.0.**

## Getting Started

1. **Install** using `npx grep-research-skills`
2. **Authenticate** by running `/grep-login` in your AI agent
3. **Research** anything with `/research "your topic"`

**Pick the right tier.** `/quick-research` is for one-liner answers, `/research` is the default for most tasks, and `/ultra-research` is reserved for heavy investigations that genuinely need exhaustive coverage (and can take up to an hour).

For domain-specific work (legal, medical, patent, etc.), reach for `/grep-domain-expert`. For deliverables (decks, apps, spreadsheets), use the matching `/grep-build-*` skill. For multi-step research with a deliverable at the end, use `/grep-research-workflow`.

## Authentication (v2)

All requests use `Authorization: Bearer <token>` where `<token>` is either a Descope-managed session JWT or a long-lived `grp_*` API key. Both are stored in `~/.grep/session.json` (mode 0600) and read transparently by `scripts/grep-api.js`.

```bash
# Email OTP (interactive — best for human users)
/grep-login

# API key (headless / CI — best for agents and scripts)
node ~/.grep-research-skills/scripts/auth.js set-api-key grp_xxx
```

Sessions auto-refresh. Get a `grp_*` key at https://grep.ai/api-keys. Bills against your subscription tier (Free / Pro / Ultra / PAYG) — run `/grep-status` to see your current plan and remaining quota.

### Pointing at preview / staging

Set `GREP_API_BASE` to override the default `https://api.grep.ai`:

```bash
export GREP_API_BASE=https://preview-api.grep.ai   # early-access / staging
# OR
export GREP_API_BASE=https://api.grep.ai           # production (default)
```

The script auto-derives the matching UI host for printed report links (`api.grep.ai → grep.ai`, `preview-api.grep.ai → preview.grep.ai`). Override with `GREP_UI_BASE` if your deployment uses a different pattern.

## Direct CLI Use

```bash
node scripts/grep-api.js experts                            # 27-expert catalog (free, no auth)
node scripts/grep-api.js run "What is Anthropic?" --effort=low
node scripts/grep-api.js run "compare LLM costs" --output-type=spreadsheet --max-wait=1800
node scripts/grep-api.js files <slug>                       # workspace files for a job
node scripts/grep-api.js timeline <slug>                    # message timeline
node scripts/grep-api.js continue <slug> "follow-up"
node scripts/grep-api.js upload report.pdf                  # returns attachment_id
```

## Discovery

The v2 API publishes its contract via OpenAPI. Set `GREP_API_BASE` once and use it everywhere:

```bash
export GREP_API_BASE=https://api.grep.ai             # production
# OR
export GREP_API_BASE=https://preview-api.grep.ai     # preview / staging

curl "$GREP_API_BASE/openapi.json"                       # v2 OpenAPI
curl "$GREP_API_BASE/api/v2/experts"                     # 27-expert list (free, no auth)
curl "$GREP_API_BASE/.well-known/agent-onboarding.md"    # markdown agent guide
```

**Agents bootstrapping cold** should fetch `$GREP_API_BASE/.well-known/agent-onboarding.md` first — it describes the v2 surface end-to-end with copy-paste examples.

This repo also publishes a [skill manifest](.well-known/skill-manifest.json) for agent discovery.

## How It Works

GREP Research Skills uses headless email authentication (powered by Descope) — no browser needed. Works in terminals, SSH sessions, and headless environments.

**`/quick-research` and `/research`** are blocking: the skill submits the job, polls with backoff, and returns the finished report in a single call. Claude Code's bash tool caps at 10 minutes, so `/research` is bounded to a 9-minute server-side wait. If a deep job overshoots, the skill exits with a `slug` for later retrieval.

**`/ultra-research` is different.** Ultra-deep jobs can run up to 1 hour, which exceeds the bash 10-minute cap. The skill submits the job, returns the `slug` immediately, and polls on 5-minute intervals across multiple agent turns. You can keep working while it runs; the agent checks back periodically and presents the report when ready.

**`/grep-build-*` and `/grep-with-context`** use Monitor with longer timeouts (up to 30 min for build jobs).

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
│   ├── plugin.json                # Claude Code plugin manifest
│   └── marketplace.json           # Claude Code marketplace listing
├── .well-known/
│   └── skill-manifest.json        # Agent discovery manifest
├── .github/
│   └── workflows/
│       └── sync-experts.yml       # Nightly drift check vs live /api/v2/experts
├── skills/
│   ├── research/SKILL.md          # Deep research (effort=medium, ~5 min)
│   ├── quick-research/SKILL.md    # Fast fact check (effort=low, ~25s)
│   ├── ultra-research/SKILL.md    # Exhaustive research (effort=high, up to 1 hr)
│   ├── grep-plan/SKILL.md         # Research-informed planning
│   ├── grep-skill-creator/SKILL.md  # Research-powered skill generator
│   ├── grep-login/SKILL.md        # Authentication
│   ├── grep-upgrade/SKILL.md      # Plan selection & Stripe checkout
│   ├── grep-status/SKILL.md       # Status & job checking
│   ├── grep-mcp/SKILL.md          # Wire Grep into .mcp.json (NEW in 0.2.0)
│   ├── grep-domain-expert/SKILL.md  # Route to a public expert (NEW)
│   ├── grep-build-app/SKILL.md    # Interactive HTML apps (NEW)
│   ├── grep-build-slidedeck/SKILL.md  # HTML slidedecks (NEW)
│   ├── grep-build-spreadsheet/SKILL.md  # Sortable spreadsheets (NEW)
│   ├── grep-research-workflow/SKILL.md  # Multi-step chains (NEW)
│   ├── grep-with-context/SKILL.md   # Research with attached files (NEW)
│   └── grep-continue/SKILL.md     # Continue existing jobs (NEW)
├── resources/
│   ├── experts.md                 # 27-expert catalog (drift-tracked)
│   ├── intent_map.md              # Phrase → API fields lookup
│   ├── slidedeck_schema.json      # JSON Schema for structured deck output
│   ├── spreadsheet_schema.json    # JSON Schema for structured table output
│   └── chaining_examples.md       # Multi-step workflow recipes
├── scripts/
│   ├── auth.js                    # Descope OTP headless auth
│   ├── grep-api.js                # GREP API client (v2)
│   ├── billing.js                 # Billing & Stripe checkout client
│   └── update-check.js            # Plugin auto-update
├── bin/
│   └── install.js                 # npx installer
├── setup                          # Shell installer (git clone fallback)
├── package.json
└── README.md
```

## License

MIT — Parcha Labs, Inc.
