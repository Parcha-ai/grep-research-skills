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

Either:
- A Grep API key (`grp_xxx`) from https://grep.ai/api-keys — recommended for human users
- A funded wallet (`pi_xxx` receipt from `purl prepay`) — for accountless agents on the gateway PAYG flow

The skill asks which auth mode to use; both shapes are documented below.

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Step 1: Pick the auth mode

Use **AskUserQuestion** with two options:

- **API key (v2, recommended)** — paste a `grp_xxx` from https://grep.ai/api-keys. Routes to the canonical v2 surface. No per-call wallet debits.
- **Wallet receipt (gateway, PAYG)** — for agents with no Grep account. Pay-as-you-go via `Authorization: Receipt pi_xxx`. Each request debits from a prepaid balance.

If the user picks wallet but doesn't have a receipt yet, walk them through funding:

```bash
purl prepay https://api.grep.ai/mpp/v1 --amount 10
```

This signs an EIP-3009 envelope for $10 USDC, the verifier credits 1000 cents (`bonus_credits`) on their wallet, and returns a Stripe `pi_xxx` they keep as the bearer token.

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

### Wallet receipt (gateway) shape

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
- The wallet identity is implicit in the receipt — never add an `X-Wallet-Address` header alongside.
- The receipt is bare `pi_xxx`, no `tempo:` prefix, no quotes around it inside the header value.

## Step 4: Verify the server responds

`curl` the chosen MCP endpoint with a `tools/list` JSON-RPC call. Parse the response with Node (consistent with Step 3's "don't assume jq is installed" note).

First set the URL + auth header to match whichever path you took in Steps 1-3:

```bash
# API key (v2) path:
MCP_URL="https://api.grep.ai/api/v2/mcp"
AUTH_HEADER="Bearer grp_xxx_USER_PASTED_KEY"
MIN_TOOLS=4   # v2 surface omits wallet_balance (gateway-only tool)

# OR wallet receipt (gateway) path:
MCP_URL="https://api.grep.ai/mpp/v1/mcp"
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
- **401** — token wrong. API key path: re-check `grp_xxx`. Wallet path: receipt expired or invalid.
- **402** — wallet balance empty. Run `purl prepay --amount 10` again, replace the `pi_xxx` in `.mcp.json`.
- **404** — wrong URL. v2 = `/api/v2/mcp`, gateway = `/mpp/v1/mcp`. Don't mix them.
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
- **Wallet path: every tool call returns 402:** balance hit zero. Re-run `purl prepay --amount 10`, replace the `pi_xxx`, restart.

## Anti-patterns

- Do NOT paste the wallet address with a `tempo:` prefix. The auth header carries the `pi_xxx` receipt, not the wallet address.
- Do NOT mix surfaces. Either `Bearer grp_xxx` against `/api/v2/mcp`, or `Receipt pi_xxx` against `/mpp/v1/mcp`. Crossing them returns 401.
- Do NOT overwrite an existing `mcpServers.grep` entry without confirming — the user may have a custom config (different URL, custom headers, etc.).
- Do NOT commit `.mcp.json` with a real API key/receipt to a public repo. Add `.mcp.json` to `.gitignore` if the repo is public.
- Do NOT skip the verify step. A `.mcp.json` that points at the wrong URL or has a stale token wastes a restart cycle to discover.
