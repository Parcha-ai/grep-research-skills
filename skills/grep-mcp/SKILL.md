---
name: grep-mcp
description: Attach a Grep MCP server to .mcp.json so Claude has 4–5 native research tools without writing curl. API key (v2) users get 4 tools (research_create, research_get, research_files_list, research_file_read); wallet/gateway users also get wallet_balance. Use when the user wants Grep available as MCP tools, says "install Grep MCP", "set up Grep MCP server", or wants to research via MCP instead of HTTP. Reads the existing .mcp.json (or creates one), merges the grep entry, and verifies the server responds to tools/list.
---

# Grep MCP Server Setup

Adds a `grep` entry to `.mcp.json` (in the current working directory) so Claude Code can call Grep research natively as MCP tools. After setup + restart, the agent gets 5 tools that wrap the same `/research` endpoints `scripts/grep-api.js` calls — but accessible directly from the model without shell-out.

## When to use this skill vs the others

| Want | Use |
|---|---|
| One-off research from a Claude Code conversation | `/research`, `/quick-research`, `/ultra-research` (existing skills, no MCP setup) |
| **MCP tools available natively** so the model can call them in any future turn | **`/grep-mcp`** (you are here) |
| Programmatic access from a non-Claude agent | `node scripts/grep-api.js run ...` directly |

If the user's request is "do this one piece of research now," skip MCP setup — just call `/research`. Reach for `/grep-mcp` when the user wants a permanent integration.

## Prerequisites

One of three auth modes:

- **Stripe Link wallet** (`pi_xxx` from `link-cli mpp pay`) — push notification → user approves $10 on phone. **RECOMMENDED for accountless agents.**
- **Base USDC wallet** (`pi_xxx` from `purl prepay`) — fallback for agents that already have a Base USDC wallet, or when Stripe Link is unavailable.
- **Grep API key** (`grp_xxx` from https://grep.ai/api-keys) — for users on a paid plan.

The skill asks which auth mode to use; all three shapes are documented below.

## Resolve the script path + API base

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
# Pick the deployment — preview for early-access, prod for general availability
export GREP_API_BASE="${GREP_API_BASE:-https://api.grep.ai}"
```

## Step 1: Pick the auth mode

Use **AskUserQuestion** with three options, **Link first** (it's the demo path):

- **Stripe Link wallet (RECOMMENDED for accountless agents)** — push notification → user approves $10 on phone. Run `npm i -g @stripe/link-cli` then `link-cli mpp pay $GREP_API_BASE/mpp/v1/api/research --amount 1000` to fund. Emits `pi_xxx`. **Identity stable across sessions** via Stripe Customer keyed by Link card fingerprint.
- **Base USDC wallet (fallback)** — for agents that already have a Base USDC wallet or where Stripe Link isn't available. Run `brew install stripe/purl/purl` then `purl prepay $GREP_API_BASE/mpp/v1 --amount 10`. Emits `pi_xxx`. Identity = recovered Ethereum address.
- **Grep API key (paid plans)** — paste a `grp_xxx` from https://grep.ai/api-keys. Routes to the canonical v2 surface. Bills against the user's subscription tier (no per-call wallet debits).

### Step 1a: Check which gateway rails are enabled

Before recommending Stripe Link, verify the deployment supports it. Stripe Link is gated server-side on `MPP_GATEWAY_LINK_RAIL_ENABLED=true`:

```bash
curl -s "$GREP_API_BASE/mpp/v1/api" \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);console.log("Rails enabled:",(j.payment_rails||[]).map(r=>r.name).join(", ")||"none")})'
```

If the output includes "Stripe Link", offer it as the recommended option. If only "MPP" / "tempo-pathusd", fall back to recommending the Base USDC path. If the user says "I have a Grep account", skip both and use the API key.

### Step 1b: Detect sandbox vs live mode (Stripe Link only)

**Stripe has two parallel, non-intersecting universes:** test mode (sk_test_* keys, test cards like 4242…, no real money) and live mode. An SPT minted in one won't charge in the other. `link-cli` doesn't auto-detect which mode the backend is in — the agent must pass `--test` when signing against a sandbox backend.

The backend's 402 challenge surfaces this via `accepts[?(@.network=="stripe")].extra.livemode` (per Parcha-ai/parcha #6192):

- `livemode: false` → sandbox backend (preview deployments, sk_test_* key). **MUST pass `--test`** to `link-cli mpp pay`.
- `livemode: true` → live backend (production, sk_live_* key). Pay normally; no `--test`.
- Field missing → backend predates #6192. Default to NOT passing `--test` (assume live), but cross-check `$GREP_API_BASE` (preview-api.grep.ai → likely sandbox; api.grep.ai → likely live).

The script's `grep-api.js` 402 handler reads this and pre-baked the right flag into the printed `client_hint`, so an agent reading exit-3 output gets the correct invocation. For agents calling `link-cli` directly without going through the script, probe it explicitly:

```bash
LIVEMODE=$(curl -s -X POST "$GREP_API_BASE/mpp/v1/api/research" \
  -H 'Content-Type: application/json' -d '{"question":"x","effort":"low"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const s=(j.accepts||[]).find(a=>a.network==='stripe');process.stdout.write(String(s?.extra?.livemode))})")
```

`LIVEMODE` will be `"true"`, `"false"`, or `"undefined"`.

### Step 1c: Walk through funding (only if user picked Stripe Link or Base USDC)

**Stripe Link path:**

```bash
npm install -g @stripe/link-cli

# Pick the right invocation based on Step 1b's $LIVEMODE
if [ "$LIVEMODE" = "false" ]; then
  link-cli mpp pay "$GREP_API_BASE/mpp/v1/api/research" --amount 1000 --test
else
  link-cli mpp pay "$GREP_API_BASE/mpp/v1/api/research" --amount 1000
fi

# Phone gets a push from Link — user taps "Approve $10.00".
# (In sandbox mode, the push approves a test charge using Stripe's test card universe.)
# CLI prints the response JSON containing `payment_intent_id: pi_link_spt_xxx`.
# Capture it:
export GREP_RECEIPT=pi_link_spt_xxxxxxxxxxxxxxxxx
```

> **Why `--test` matters:** without it, a sandbox-mode backend will either reject the SPT verifier (opaque error) or — worst case — your live Link card signs an SPT against a backend that thinks it credited test cents. Real money out, test cents in. Always pass `--test` when `livemode=false`.

**Base USDC path:**

```bash
brew install stripe/purl/purl
purl prepay "$GREP_API_BASE/mpp/v1" --amount 10
# Signs an EIP-3009 envelope, server credits 1000 cents (`bonus_credits`),
# returns Stripe pi_xxx in the response.
export GREP_RECEIPT=pi_xxxxxxxxxxxxxxxxx
```

(The Base USDC path doesn't need a `--test` toggle — Base Sepolia is its own test network, distinct from Base mainnet, and the gateway picks which contract to use based on the deployment's `STRIPE_SECRET_KEY` prefix.)

Either path: subsequent requests use `Authorization: Receipt $GREP_RECEIPT`. First 3 `low` jobs are at 2¢ promo, then full PAYG (low=40¢, medium=$2, high=$10, build=$2).

## Step 2: Locate or create `.mcp.json`

Claude Code reads `.mcp.json` from the project root (`$PWD`). Look for it; if missing, start with `{ "mcpServers": {} }`.

```bash
MCP_FILE="$PWD/.mcp.json"
if [ -f "$MCP_FILE" ]; then
  cat "$MCP_FILE"
else
  echo '{ "mcpServers": {} }' > "$MCP_FILE"
fi
```

If `.mcp.json` already has an `mcpServers.grep` entry, **AskUserQuestion** before overwriting — the user may have a custom config.

## Step 3: Merge the `grep` entry

Use Read + Write (not raw shell `jq`, which may not be installed). Read the file, parse, splice in the new entry, write back.

All three shapes use the deployment's `$GREP_API_BASE` for the URL — make sure to substitute the actual host (e.g. `https://api.grep.ai` for prod, `https://preview-api.grep.ai` for preview), not the literal `$GREP_API_BASE` string.

### API key (v2) shape

```json
{
  "mcpServers": {
    "grep": {
      "transport": "http",
      "url": "https://api.grep.ai/api/v2/mcp",
      "headers": {
        "Authorization": "Bearer grp_xxx_USER_PASTED_KEY"
      }
    }
  }
}
```

### Stripe Link or Base USDC wallet receipt (gateway) shape

Both rails produce a `pi_xxx` token used the same way:

```json
{
  "mcpServers": {
    "grep": {
      "transport": "http",
      "url": "https://api.grep.ai/mpp/v1/mcp",
      "headers": {
        "Authorization": "Receipt pi_xxx_USER_PASTED_RECEIPT"
      }
    }
  }
}
```

**Critical rules for the wallet shape:**
- The wallet identity is implicit in the receipt — never add an `X-Wallet-Address` header alongside (the legacy self-claim path was removed in backend PR #6191 for security).
- The receipt is bare `pi_xxx`, no `tempo:` prefix, no quotes around it inside the header value.
- Stripe Link `pi_xxx` and Base USDC `pi_xxx` are interchangeable from the agent's perspective — same wire format, same auth scope.

## Step 4: Verify the server responds

`curl` the chosen MCP endpoint with a `tools/list` JSON-RPC call. Parse the response with Node (consistent with Step 3's "don't assume jq is installed" note).

First set the URL + auth header to match whichever path you took in Steps 1-3 (substitute `$GREP_API_BASE` with the actual host):

```bash
# API key (v2) path:
MCP_URL="$GREP_API_BASE/api/v2/mcp"
AUTH_HEADER="Bearer grp_xxx_USER_PASTED_KEY"
MIN_TOOLS=4   # v2 surface omits wallet_balance (gateway-only tool)

# OR wallet receipt (gateway) path — same shape for Stripe Link AND Base USDC:
MCP_URL="$GREP_API_BASE/mpp/v1/mcp"
AUTH_HEADER="Receipt pi_xxx_USER_PASTED_RECEIPT"
MIN_TOOLS=5   # gateway exposes all 5 tools including wallet_balance
```

Then verify:

```bash
curl -s "$MCP_URL" \
  -H "Authorization: $AUTH_HEADER" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  MIN=$MIN_TOOLS node -e "const m=+process.env.MIN;let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const t=JSON.parse(d).result?.tools??[];console.log(t.length>=m?'ok ('+t.length+' tools)':'only '+t.length+' tools, expected '+m+' — verification failed');process.exit(t.length>=m?0:1)}catch(e){console.error('parse error:',e.message);process.exit(1)}})"
```

Expected tool list:
- **v2 (`/api/v2/mcp`)** — 4 tools: `research_create`, `research_get`, `research_files_list`, `research_file_read`
- **Gateway (`/mpp/v1/mcp`)** — 5 tools: the four above + `wallet_balance` (gateway-only, since wallet credits don't apply on v2)

If the curl returns:
- **401** — token wrong. API key path: re-check `grp_xxx`. Wallet path: receipt expired or invalid (Redis cache evicts after 90 days; if the response body says `wallet_identity_not_recovered`, re-fund and replace the `pi_xxx`).
- **402** — wallet balance empty. Re-fund:
  - Stripe Link: `link-cli mpp pay $GREP_API_BASE/mpp/v1/api/research --amount 1000`
  - Base USDC: `purl prepay $GREP_API_BASE/mpp/v1 --amount 10`
  Either way, replace the `pi_xxx` in `.mcp.json`.
- **404** — wrong URL. v2 = `/api/v2/mcp`, gateway = `/mpp/v1/mcp`. Don't mix them. Also check `$GREP_API_BASE` is the right deployment (api.grep.ai vs preview-api.grep.ai).
- **5xx** — backend issue, not config. Wait + retry.

## Step 5: Tell the user to restart

MCP servers are loaded at Claude Code startup. After editing `.mcp.json`:

> "Restart Claude Code, then run `/mcp` in the new session to confirm the `grep` server is listed. You'll see the research tools (`research_create`, `research_get`, `research_files_list`, `research_file_read`) attached to your conversation. Wallet users get an additional `wallet_balance` tool (gateway-only)."

## Tool reference (what the agent gets after setup)

| MCP tool | Wraps | Use for |
|---|---|---|
| `research_create` | `POST /research` (v2 or gateway) | Submit a research job. Accepts `question`, `effort`, `expert_id`, `output_type`, `reference_jobs`, `attachment_ids`, etc. |
| `research_get` | `GET /research/{id_or_slug}` | Poll a job's status + retrieve the report when complete |
| `research_files_list` | `GET /research/{id_or_slug}/files` | List artifacts in a completed job's workspace (slides.html, index.html, report.md, etc.) |
| `research_file_read` | `GET /research/{id_or_slug}/files/{path}` | Read one artifact |
| `wallet_balance` | `GET /mpp/v1/api/wallet/{addr}` (gateway only) | Check `bonus_credits_cents` before another paid call. The MCP server resolves `{addr}` from the receipt server-side — the agent doesn't need to know its own wallet address; just call `wallet_balance` with no args. |

These compose with the other Grep skills naturally: an agent can use the MCP tools to keep state across turns and only fall back to the bash-shelled `scripts/grep-api.js` for things the MCP surface doesn't expose (e.g. `cancel`, `continue`, attachment uploads — those land in subsequent MCP tool releases).

## Troubleshooting

- **`/mcp` shows `grep` but `tools/list` is empty:** transport mismatch. Confirm `"transport": "http"` exactly (not `"stream"`, not `"sse"`).
- **`grep` not listed in `/mcp` after restart:** `.mcp.json` not loaded. Check it's in `$PWD` (the project root, not `~`).
- **Tool calls return 401 mid-conversation:** API key revoked or rotated. Re-issue at https://grep.ai/api-keys, replace in `.mcp.json`, restart.
- **Wallet path: every tool call returns 402 with `wallet_identity_not_recovered`:** the `pi_xxx` was once valid but the gateway's Redis cache evicted it (90-day TTL) and Stripe metadata lookup failed. Re-fund (`link-cli mpp pay ...` or `purl prepay ...`), replace the `pi_xxx`, restart.
- **Wallet path: every tool call returns 402 with `insufficient_credits`:** balance hit zero. Re-fund:
  - Stripe Link: `link-cli mpp pay $GREP_API_BASE/mpp/v1/api/research --amount 1000`
  - Base USDC: `purl prepay $GREP_API_BASE/mpp/v1 --amount 10`
  Replace the `pi_xxx` in `.mcp.json`, restart.

## Anti-patterns

- Do NOT paste the wallet address with a `tempo:` prefix. The auth header carries the `pi_xxx` receipt, not the wallet address.
- Do NOT mix surfaces. Either `Bearer grp_xxx` against `/api/v2/mcp`, or `Receipt pi_xxx` against `/mpp/v1/mcp`. Crossing them returns 401.
- Do NOT overwrite an existing `mcpServers.grep` entry without confirming — the user may have a custom config (different URL, custom headers, etc.).
- Do NOT commit `.mcp.json` with a real API key/receipt to a public repo. Add `.mcp.json` to `.gitignore` if the repo is public.
- Do NOT skip the verify step. A `.mcp.json` that points at the wrong URL or has a stale token wastes a restart cycle to discover.
