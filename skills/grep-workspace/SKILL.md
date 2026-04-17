---
name: grep-workspace
description: Browse the user's GREP workspace (Pierre-backed git repo) — list directories, read files, view commit history, diff between commits. Use when the user asks "what's in my workspace?", "show me my SOP for project X", "what changed recently?", or wants to inspect any file/dir under the workspace tree (projects/, jobs/, experts/, apps/).
---

# GREP Workspace Browser

The workspace is a Pierre-backed git repo containing every project SOP, job artifact, expert config, and app output for the user. This skill is your read-only window into that tree.

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Tree (sections + listings)

```bash
# Sections overview (projects/jobs/experts/apps grouped)
node "$SCRIPTS_DIR/grep-api.js" ws:tree

# List a specific subdirectory
node "$SCRIPTS_DIR/grep-api.js" ws:tree projects/acme
node "$SCRIPTS_DIR/grep-api.js" ws:tree experts/medical-expert
```

Returns `WorkspaceTreeResponse{ path, entries[], total_files, total_size_bytes }`. Each entry has `path, name, is_directory, size_bytes, file_type, can_preview, modified_at`.

## Read a file

```bash
node "$SCRIPTS_DIR/grep-api.js" ws:cat <path>
```

Examples:

```bash
node "$SCRIPTS_DIR/grep-api.js" ws:cat projects/acme/SOP.md
node "$SCRIPTS_DIR/grep-api.js" ws:cat experts/medical-expert/config.yml
```

Streams raw bytes to stdout (with a trailing newline if missing).

## History

```bash
node "$SCRIPTS_DIR/grep-api.js" ws:log [--limit=N]
```

Returns `WorkspaceHistoryResponse{ commits: [{ sha, short_sha, message, author, timestamp, files_changed }] }`. Default limit 20, max 100.

## Diff between two commits

```bash
# Two ergonomic forms
node "$SCRIPTS_DIR/grep-api.js" ws:diff <to_sha> [<from_sha>]
node "$SCRIPTS_DIR/grep-api.js" ws:diff --from=<sha> --to=<sha>
```

Returns `WorkspaceDiffResponse{ from_sha, to_sha, stats, files }`.

## Present results clearly

- For `ws:tree` sections: group output by section name (projects, jobs, experts, apps); list subdir names + entry counts.
- For `ws:tree <path>`: print as a list with `name`, `(dir)` marker if directory, and human-readable size for files.
- For `ws:cat`: pass the file content through to the user; if it's markdown, preserve formatting.
- For `ws:log`: show short_sha, relative time, message, and file_count.
- For `ws:diff`: lead with stats summary, then list changed files.

## When to reach for this skill

- User asks to inspect a project SOP, expert config, or job artifact.
- User wants a high-level view of "what do I have on grep?" — start with `ws:tree`.
- User is debugging — `ws:log` then `ws:diff` to see what changed.

## Related skills

- Modify a project: `/grep-projects`
- Modify an expert: `/grep-experts`
- Read a specific job's report: `/grep-status` (or `ws:cat jobs/<job_id>/report.md`)
