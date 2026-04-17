---
name: grep-defaults
description: Manage per-user default context files on GREP. These live in Pierre at users/{uid}/defaults/ and get automatically hydrated into every research sandbox at ./defaults/ — perfect for project-wide rubrics, style guides, legal policies, or any context the agent should always see. Use when the user wants to upload/list/delete durable context files, or asks "what defaults am I using for research?".
---

# GREP User Defaults

Your account can hold a persistent set of context files that ride along with every research job automatically — no need to re-attach them per job. Backend stores them in Pierre at `users/{uid}/defaults/`; the sandbox mounts them at `./defaults/` at dispatch.

## Prerequisite

`brain --version` must work. If missing, run `npx grep-research-skills --cli` once.

## Upload default files

Preferred for single files with a chosen remote path:

```bash
brain defaults upload ./rubric.md --as legal/rubric.md --json
```

Bulk upload keeps each file's basename as the remote path (only the first file honours `--as`):

```bash
brain defaults upload ./rubric.md ./guide.md ./tone.md --json
```

Returns `{ total_uploaded, total_size_bytes, commit_sha }`. Print the short commit sha so the user sees the change landed.

## List default files

```bash
brain defaults list --json
```

Returns `{ files: [{ filename, size_bytes }], total }`.

Without `--json`, the skill prints a two-column `size  path` list.

## Delete a default file

```bash
brain defaults delete legal/rubric.md --json
```

The path is the remote path exactly as it appears in `list` output (may contain slashes — the CLI passes it through verbatim).

## When to reach for this skill

- User says "always include this rubric in my research" → upload it as a default.
- User asks "what context am I using?" → list.
- User is cleaning up → delete specific entries.

## Common mistakes to avoid

- Do NOT use `/grep-inputs` for this — that's per-job, these are per-user.
- Do NOT upload secrets or API keys to defaults. Anything here flows into every sandbox and surfaces to the agent.
- Remote paths are relative to `users/{uid}/defaults/`. Don't prefix with `/`.

## Troubleshooting

If `brain defaults ...` returns 401, run `/grep-status` to check auth. If 404 on delete, the file path is case-sensitive and must match `list` output exactly.
