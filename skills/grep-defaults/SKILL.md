---
name: grep-defaults
description: Manage per-user default context files on GREP. These live in Pierre at users/{uid}/defaults/ and get automatically hydrated into every research sandbox at ./defaults/ — perfect for project-wide rubrics, style guides, legal policies, or any context the agent should always see. Use when the user wants to upload/list/delete persistent context files that apply across all future jobs. Different from /grep-inputs (per-job); this is per-user.
---

# GREP User Defaults

Persistent default context that rides along with every research job automatically.

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Upload defaults

Each argument is a `<local_path>=<remote_path>` pair (the remote path is relative to `users/{uid}/defaults/`). If you omit the `=remote`, the file's basename is used.

```bash
node "$SCRIPTS_DIR/grep-api.js" defaults:upload <local=remote> [<local=remote>...]
```

Examples:

```bash
# Single file with explicit remote path
node "$SCRIPTS_DIR/grep-api.js" defaults:upload ./rubric.md=legal/rubric.md

# Multiple files; first uses remote path, others use basename
node "$SCRIPTS_DIR/grep-api.js" defaults:upload \
  ./rubric.md=legal/rubric.md \
  ./style-guide.md=writing/style.md \
  ./tone.txt
```

Returns `{ files: [...], total_uploaded, total_size_bytes, commit_sha }`. Print the count + short commit sha.

## List defaults

```bash
node "$SCRIPTS_DIR/grep-api.js" defaults:list
```

Returns `{ files: [{ filename, size_bytes }], total }`.

## Delete a default

```bash
node "$SCRIPTS_DIR/grep-api.js" defaults:delete <remote_path>
```

The path is the remote path exactly as it appears in `list` (may contain slashes; pass through verbatim).

## When to reach for this skill

- User says "always include this rubric in research" → upload as a default.
- User asks "what default context am I using?" → list.
- User cleans up → delete specific entries.

## Anti-patterns

- Do NOT use this for one-off jobs — that's `/grep-inputs`.
- Do NOT upload secrets / API keys. Anything here flows into every sandbox.
- Do NOT prefix remote paths with `/`. Paths are relative to `users/{uid}/defaults/`.

## Troubleshooting

- **401** → run `/grep-status` to check auth.
- **404 on delete** → case-sensitive; match `defaults:list` output exactly.
