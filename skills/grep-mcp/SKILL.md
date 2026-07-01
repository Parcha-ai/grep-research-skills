---
name: grep-mcp
description: Attach a Grep MCP server to .mcp.json so Claude has 4 native research tools (research_create, research_get, research_files_list, research_file_read) without writing curl. Use when the user wants Grep available as MCP tools, says "install Grep MCP", "set up Grep MCP server", or wants to research via MCP instead of HTTP. Reads the existing .mcp.json (or creates one), merges the grep entry, and verifies the server responds to tools/list.
---

# Grep MCP Server Setup

Adds a `grep` entry to `.mcp.json` (in the current working directory) so Claude Code can call Grep research natively as MCP tools. After setup + restart, the agent gets 4 tools that wrap the same `/research` endpoints `scripts/grep-api.js` calls — but accessible directly from the model without shell-out.

## When to use this skill vs the others

| Want | Use |
|---|---|
| One-off research from a Claude Code conversation | `/research`, `/quick-research`, `/ultra-research` (existing skills, no MCP setup) |
| **MCP tools available natively** so the model can call them in any future turn | **`/grep-mcp`** (you are here) |
| Programmatic access from a non-Claude agent | `node scripts/grep-api.js run ...` directly |

If the user's request is "do this one piece of research now," skip MCP setup — just call `/research`. Reach for `/grep-mcp` when the user wants a permanent integration.

## Prerequisites

A Grep account with either:
- a Descope session (created by `/grep-login`), or
- a `parcha-xxx` API key from https://grep.ai/api-keys

Both produce a `Bearer` token. If the user has neither, walk them through `/grep-login` first.

## Resolve the script path + API base

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
# Pick the deployment — preview for early-access, prod for general availability
export GREP_API_BASE="${GREP_API_BASE:-https://api.grep.ai}"
```

## Step 1: Confirm or capture the API key

Check whether the user already has credentials:

```bash
HAS_SESSION=0
HAS_API_KEY=0
if [ -f "$HOME/.grep/session.json" ]; then
  HAS_SESSION=1
  if node -e "const s=JSON.parse(require('fs').readFileSync('$HOME/.grep/session.json','utf8'));process.exit(s.apiKey?0:1)" 2>/dev/null; then
    HAS_API_KEY=1
  fi
fi
```

Decision:

- `HAS_API_KEY=1` → read the key from `~/.grep/session.json` and use it in Step 3 below.
- `HAS_SESSION=1` (OTP session, no API key on file) → ask the user to mint a `parcha-xxx` at https://grep.ai/api-keys and paste it. API keys are long-lived; OTP-derived JWTs rotate every ~30 minutes and would break MCP requests once they expire.
- Neither → run `/grep-login` first to set up the session, then come back.

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

Use Read + Write (not raw shell `jq`, which may not be installed). Read the file, parse, splice in the new entry, write back. Substitute `$GREP_API_BASE` with the actual host (e.g. `https://api.grep.ai` for prod, `https://preview-api.grep.ai` for preview), not the literal `$GREP_API_BASE` string.

```json
{
  "mcpServers": {
    "grep": {
      "transport": "http",
      "url": "https://api.grep.ai/api/v2/mcp",
      "headers": {
        "Authorization": "Bearer parcha-xxx-USER-PASTED-KEY"
      }
    }
  }
}
```

## Step 4: Verify the server responds

`curl` the MCP endpoint with a `tools/list` JSON-RPC call. Parse the response with Node (not jq — which may not be installed):

```bash
MCP_URL="$GREP_API_BASE/api/v2/mcp"
AUTH_HEADER="Bearer parcha-xxx-USER-PASTED-KEY"

curl -s "$MCP_URL" \
  -H "Authorization: $AUTH_HEADER" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const t=JSON.parse(d).result?.tools??[];console.log(t.length>=4?'ok ('+t.length+' tools)':'only '+t.length+' tools, expected 4 — verification failed');process.exit(t.length>=4?0:1)}catch(e){console.error('parse error:',e.message);process.exit(1)}})"
```

Expected response: 4 tools — `research_create`, `research_get`, `research_files_list`, `research_file_read`.

If the curl returns:
- **401** — token wrong. Re-check `parcha-xxx` or re-issue at https://grep.ai/api-keys.
- **402** — subscription quota exceeded. Run `/grep-upgrade` to top up.
- **404** — wrong URL. v2 MCP lives at `/api/v2/mcp`. Also check `$GREP_API_BASE` is the right deployment.
- **5xx** — backend issue, not config. Wait + retry.

## Step 5: Tell the user to restart

MCP servers are loaded at Claude Code startup. After editing `.mcp.json`:

> "Restart Claude Code, then run `/mcp` in the new session to confirm the `grep` server is listed. You'll see 4 tools (`research_create`, `research_get`, `research_files_list`, `research_file_read`) attached to your conversation."

## Tool reference (what the agent gets after setup)

| MCP tool | Wraps | Use for |
|---|---|---|
| `research_create` | `POST /api/v2/research` | Submit a research job. Accepts `question`, `effort`, `expert_id`, `output_type`, `reference_jobs`, `attachment_ids`, etc. |
| `research_get` | `GET /api/v2/research/{id_or_slug}` | Poll a job's status + retrieve the report when complete |
| `research_files_list` | `GET /api/v2/research/{id_or_slug}/files` | List artifacts in a completed job's workspace (slides.html, index.html, report.md, etc.) |
| `research_file_read` | `GET /api/v2/research/{id_or_slug}/files/{path}` | Read one artifact |

These compose with the other Grep skills naturally: an agent can use the MCP tools to keep state across turns and only fall back to the bash-shelled `scripts/grep-api.js` for things the MCP surface doesn't expose (e.g. `cancel`, `continue`, attachment uploads — those land in subsequent MCP tool releases).

## Troubleshooting

- **`/mcp` shows `grep` but `tools/list` is empty:** transport mismatch. Confirm `"transport": "http"` exactly (not `"stream"`, not `"sse"`).
- **`grep` not listed in `/mcp` after restart:** `.mcp.json` not loaded. Check it's in `$PWD` (the project root, not `~`).
- **Tool calls return 401 mid-conversation:** API key revoked, rotated, or you put an OTP JWT in there instead of a long-lived `parcha-xxx`. Re-issue at https://grep.ai/api-keys, replace in `.mcp.json`, restart.
- **Tool calls return 402:** subscription quota exceeded. Run `/grep-upgrade`.

## Anti-patterns

- Do NOT paste a short-lived OTP `sessionJwt` in place of a `parcha-xxx` API key. OTP JWTs rotate every ~30 minutes; MCP requests start failing once the cache stales.
- Do NOT overwrite an existing `mcpServers.grep` entry without confirming — the user may have a custom config (different URL, custom headers, etc.).
- Do NOT commit `.mcp.json` with a real API key to a public repo. Add `.mcp.json` to `.gitignore` if the repo is public.
- Do NOT skip the verify step. A `.mcp.json` that points at the wrong URL or has a stale token wastes a restart cycle to discover.
