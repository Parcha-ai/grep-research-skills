# GREP Research Skills

Give your AI agent deep research superpowers. GREP Research Skills connects Claude Code, Cowork, and OpenClaw to [GREP](https://grep.ai) — the #1 deep research engine.

## Quick start (no Grep account, no API key) — Stripe Link rail

Cold-start an agent against the gateway in 5 commands:

```bash
# 1. Pick the deployment (preview for early access, prod for general availability)
export GREP_API_BASE=https://preview-api.grep.ai   # or https://api.grep.ai

# 2. Discover the gateway — see enabled rails, experts, examples (free, no auth)
curl "$GREP_API_BASE/mpp/v1/.well-known/agent-onboarding.md"

# 3. Install these skills
git clone https://github.com/Parcha-ai/grep-research-skills ~/.grep-research-skills
~/.grep-research-skills/setup

# 4. Install the funding client — Stripe Link is the recommended path for accountless agents
npm install -g @stripe/link-cli      # push notification → user approves $10 on phone
#   ↳ fallback: brew install stripe/purl/purl  # USDC on Base via x402 signing

# 5. Fund $10 once. Stripe Link sends a push to the user's phone — they tap "Approve $10.00".
link-cli mpp pay "$GREP_API_BASE/mpp/v1/api/research" --amount 1000
#   ↳ emits pi_xxx — capture it
export GREP_SURFACE=gateway GREP_RECEIPT=pi_xxxxxxxxxxxxxxxx

# 6. Run a job
node ~/.grep-research-skills/scripts/grep-api.js run \
  "What does Anthropic do?" --effort=low
```

First 3 `low` jobs are at **2¢ promo** (1¢ request + 1¢ retrieval; inference comped). After that: low=40¢, medium=$2, high=$10, build=$2. Reads always 1¢. Empty balance → 402 with both rails advertised again — pick one, top up, retry.

Both rails return the same `pi_xxx` token. The agent doesn't care which rail funded the wallet — `Authorization: Receipt pi_xxx` works the same way.

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
| **`/grep-mcp`** | "install grep MCP", "grep as MCP server" | Wire Grep into `.mcp.json` as 5 native MCP tools |
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

## Auth surfaces (three options)

The script supports three authentication paths. Pick whichever matches your situation.

### 1. Stripe Link wallet (gateway, push-to-phone) — RECOMMENDED for accountless agents

The Quick start above. Funds via push notification to the user's phone — they tap "Approve $10.00" in the Link app on their phone, agent gets back a `pi_xxx` token, all subsequent requests authenticate with `Authorization: Receipt pi_xxx`.

```bash
npm install -g @stripe/link-cli
link-cli mpp pay "$GREP_API_BASE/mpp/v1/api/research" --amount 1000
# → emits pi_xxx
export GREP_SURFACE=gateway GREP_RECEIPT=pi_xxx
```

Identity is keyed by the user's Link card fingerprint (Stripe Customer `cus_xxx`). Same Link card across sessions = same Customer = balances accumulate, promo doesn't reset.

#### Sandbox vs live mode (Link rail only)

Stripe's test mode (sk_test_* keys, no real money) and live mode are parallel, non-intersecting universes. `link-cli` doesn't auto-detect which mode the backend is in — the agent has to pass `--test` when signing against a sandbox backend.

The 402 challenge surfaces the backend's mode via `accepts[?(@.network=="stripe")].extra.livemode`:

| `GREP_API_BASE` | `extra.livemode` | `link-cli` invocation |
|---|---|---|
| `https://preview-api.grep.ai` (preview, sk_test_*) | `false` | `link-cli mpp pay … --amount 1000 --test` |
| `https://api.grep.ai` (production, sk_live_*) | `true` | `link-cli mpp pay … --amount 1000` |
| (any deployment, field missing) | absent | default to no `--test` (assume live); cross-check the host |

The script's 402 handler reads `extra.livemode` and bakes the right `--test` flag into the printed `client_hint`, so agents reading exit-3 output get the correct invocation. To probe explicitly:

```bash
LIVEMODE=$(curl -s -X POST "$GREP_API_BASE/mpp/v1/api/research" \
  -H 'Content-Type: application/json' -d '{"question":"x","effort":"low"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const s=(j.accepts||[]).find(a=>a.network==='stripe');process.stdout.write(String(s?.extra?.livemode))})")

# Then:
if [ "$LIVEMODE" = "false" ]; then
  link-cli mpp pay "$GREP_API_BASE/mpp/v1/api/research" --amount 1000 --test
else
  link-cli mpp pay "$GREP_API_BASE/mpp/v1/api/research" --amount 1000
fi
```

**Why `--test` matters:** without it on a sandbox backend, `link-cli` either gets an opaque verifier rejection — or, worst case, your live Link card signs an SPT against a backend that thinks it credited test cents. Real money out, test cents in. The 402 challenge also surfaces `extra.stripe_account_id` so future versions of `link-cli` can refuse to sign when logged into the wrong Stripe account.

### 2. Base USDC wallet (gateway, crypto) — fallback when Stripe Link is unavailable

Sign an EIP-3009 envelope for $10 USDC on Base via [purl](https://github.com/stripe/purl):

```bash
brew install stripe/purl/purl
purl prepay "$GREP_API_BASE/mpp/v1" --amount 10
# → emits pi_xxx
export GREP_SURFACE=gateway GREP_RECEIPT=pi_xxx
```

Identity is keyed by the recovered Ethereum address. Same wallet across sessions = same identity = balances accumulate.

### 3. API key (v2, paid plans) — for users with a Grep account

```bash
# Email OTP (interactive)
/grep-login

# API key (headless, CI)
node ~/.grep-research-skills/scripts/auth.js set-api-key grp_xxx
```

Sessions are stored in `~/.grep/session.json` and auto-refresh. Bills against your subscription tier (Free / Pro / Ultra / PAYG).

### Which rails are enabled?

Run `node scripts/grep-api.js discovery` — the response's `payment_rails[]` array lists which rails the deployment supports. Stripe Link is gated server-side on `MPP_GATEWAY_LINK_RAIL_ENABLED=true`; if your deployment hasn't enabled it, only Base USDC will be advertised.

## Direct CLI Use

```bash
node scripts/grep-api.js experts                            # 27-expert catalog (free, no auth)
node scripts/grep-api.js run "What is Anthropic?" --effort=low
node scripts/grep-api.js run "compare LLM costs" --output-type=spreadsheet --max-wait=1800
node scripts/grep-api.js files <slug>                       # workspace files for a job
node scripts/grep-api.js timeline <slug>                    # message timeline
node scripts/grep-api.js continue <slug> "follow-up"
node scripts/grep-api.js upload report.pdf                  # returns attachment_id
node scripts/grep-api.js wallet 0xabc...                    # gateway balance check (free)
```

## Discovery

Both API surfaces publish their contracts. Set `GREP_API_BASE` once and use it everywhere:

```bash
export GREP_API_BASE=https://api.grep.ai             # production
# OR
export GREP_API_BASE=https://preview-api.grep.ai     # preview / staging

curl "$GREP_API_BASE/openapi.json"                       # v2 OpenAPI
curl "$GREP_API_BASE/api/v2/experts"                     # 27-expert list
curl "$GREP_API_BASE/.well-known/agent-onboarding.md"    # markdown agent guide

curl "$GREP_API_BASE/mpp/v1/api"                         # gateway discovery — lists payment_rails, free_tier, examples
curl "$GREP_API_BASE/mpp/v1/api/experts"                 # same 27-expert list
curl "$GREP_API_BASE/mpp/v1/.well-known/agent-onboarding.md"  # canonical funding bootstrap
```

**Agents bootstrapping cold** should fetch `$GREP_API_BASE/mpp/v1/api` (free, no auth) for the live experts list, enabled payment rails, free-tier rules, and 8 example research bodies. The `payment_rails[]` array tells you whether Stripe Link is enabled on this deployment.

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
│   ├── grep-api.js                # GREP API client (v2 + gateway PAYG)
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
