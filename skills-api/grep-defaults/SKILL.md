---
name: grep-defaults
description: Manage per-user default context files on GREP via raw HTTP. These live in Pierre at users/{uid}/defaults/ and get automatically hydrated into every research sandbox at ./defaults/ — perfect for project-wide rubrics, style guides, legal policies, or any context the agent should always see. Use when the user wants to upload/list/delete durable context files.
---

# GREP User Defaults — API flavour

Per-user default context files. Backend stores them in Pierre at `users/{uid}/defaults/`; every sandbox hydrates them at `./defaults/` at dispatch.

## Prerequisite

Load the `get_token` helper from `/grep-api-reference`.

## List

```bash
: "${GREP_API_BASE:=https://api.grep.ai}"
TOKEN=$(get_token) || { echo "Not authenticated — run /grep-login" >&2; exit 1; }
curl -s -H "Authorization: Bearer $TOKEN" "$GREP_API_BASE/grep/user/defaults"
```

Returns `{ files: [{filename, size_bytes}], total }`.

## Upload (single file)

```bash
TOKEN=$(get_token)
curl -s -X POST "$GREP_API_BASE/grep/user/defaults" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@./rubric.md" \
  -F "paths=legal/rubric.md"
```

## Upload (multiple files — each `-F files=` paired with a matching `-F paths=` in order)

```bash
curl -s -X POST "$GREP_API_BASE/grep/user/defaults" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@./rubric.md"  -F "paths=legal/rubric.md" \
  -F "files=@./tone.md"    -F "paths=style/tone.md" \
  -F "files=@./context.md" -F "paths=context.md"
```

Returns `{ files: [...], total_uploaded, total_size_bytes, commit_sha }`. Print the short commit sha.

## Delete

```bash
curl -s -X DELETE "$GREP_API_BASE/grep/user/defaults/legal/rubric.md" \
  -H "Authorization: Bearer $TOKEN"
```

The path is the remote path exactly as it appears in `list` output (may contain slashes — pass through verbatim, don't URL-encode slashes).

## When to reach for this skill

- User says "always include this rubric in my research" → upload it as a default.
- User asks "what context am I using?" → list.
- User cleaning up → delete specific entries.

## Common mistakes

- Do NOT use `/grep-inputs` for this — that's per-job, these are per-user.
- Do NOT upload secrets / API keys. Anything here flows into every sandbox.
- Do NOT prefix remote paths with `/`. Paths are relative to `users/{uid}/defaults/`.

## Troubleshooting

- **401** → run `/grep-status` to check auth.
- **404 on delete** → filename is case-sensitive; match `list` output exactly.
