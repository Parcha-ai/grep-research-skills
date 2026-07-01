# Install Grep as an MCP Server

Wires Grep into another agent's `.mcp.json` (Cursor, Cline, Continue, custom MCP host) as a native MCP server. Exposes 4 tools backed by Grep's v2 API.

## When to use

- "Install grep MCP"
- "Add grep as an MCP server to my Cursor / Cline / Continue config"
- "Grep as MCP"
- User wants Grep available to a *different* agent than the one running this skill

If the user just wants to research directly, use **deep research** (route 1) — they don't need MCP for that.

## The 4 tools

Mounting Grep at `/api/v2/mcp` exposes:

| Tool | Maps to |
|---|---|
| `research_create` | `POST /api/v2/research` |
| `research_get` | `GET /api/v2/research/<slug>` |
| `research_files_list` | `GET /api/v2/research/<slug>/files` |
| `research_file_read` | `GET /api/v2/research/<slug>/files/<path>` |

No `continue` MCP tool — host agents that need continuation should call the v2 API directly.

## Step 1: Confirm the user has an API key (parcha-xxx)

MCP authenticates via Bearer API key, not Descope JWT. Check:

```bash
cat ~/.grep/session.json 2>/dev/null | grep -o '"api_key": *"parcha-[^"]*"' | head -1
```

If they have one, capture it. If not:

> "Grep MCP needs an API key (starts with `parcha-`). Generate one at https://grep.ai/settings/api-keys, then paste it here."

Use **AskUserQuestion** to collect it.

**Anti-pattern guard:** do NOT paste an OTP JWT (eyJ...) as the MCP API key — those expire in minutes. MCP needs a long-lived `parcha-xxx` key from the Grep settings page.

## Step 2: Determine the target host's MCP config path

| Host | Path |
|---|---|
| Cursor | `~/.cursor/mcp.json` |
| Cline (VS Code) | `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` |
| Continue | `~/.continue/config.json` (servers under `experimental.modelContextProtocolServers`) |
| Custom | Ask the user where their MCP config lives. |

## Step 3: Add the Grep server block

```json
{
  "mcpServers": {
    "grep": {
      "url": "https://api.grep.ai/api/v2/mcp",
      "headers": {
        "Authorization": "Bearer parcha-xxxxxxxx"
      }
    }
  }
}
```

Override `url` with `$GREP_API_BASE/api/v2/mcp` if the user is on a preview deployment (e.g. `preview-api.grep.ai`).

If the file already has other `mcpServers` entries, merge — do not overwrite.

## Step 4: Tell the user how to restart

The MCP host needs a restart to pick up the new config:

- Cursor: Cmd+Shift+P → "Reload Window"
- Cline: reload VS Code window
- Continue: restart VS Code
- Custom: depends on the host

## Step 5: Verify

After restart, the user should see 4 new tools available: `research_create`, `research_get`, `research_files_list`, `research_file_read`.

Suggest a quick smoke test: have the host agent call `research_create` with a simple query like "What is Anthropic?" and `effort=low`.

## Anti-patterns

- Do NOT paste the user's OTP JWT in place of `parcha-xxx` — JWTs expire in minutes, MCP needs a long-lived key.
- Do NOT overwrite an existing `mcpServers` block — merge.
- Do NOT mount Grep MCP without an API key — anonymous requests get 401.
- Do NOT use this route for direct research — `grep-api.js run` is faster than going through MCP.
