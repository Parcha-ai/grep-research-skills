---
name: grep-apps
description: List GREP app artifacts — slidedecks, podcasts, narratives, HTML exports — that the user has generated from research jobs. Use when the user asks "what apps have I made?", "show me my decks/podcasts", or wants to retrieve metadata (deployed URL, status) for a specific app artifact.
---

# GREP Apps

App artifacts include slidedecks, podcasts, narrative documents, and HTML exports generated from research reports.

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## List apps

```bash
node "$SCRIPTS_DIR/grep-api.js" apps [--limit=N] [--offset=N]
```

Default limit 50, max 100. Returns `{ items: [...], count }`.

## Get app detail

```bash
node "$SCRIPTS_DIR/grep-api.js" app <app_id>
```

Returns the app object with `id, type, status, app_type, content_format, deployed_url, created_at, job_id, title, description`.

## Present results clearly

- For `apps`: print a table with `STATUS | TYPE | CREATED | TITLE | ID` for each item.
- For `app <id>`: print key fields, especially `deployed_url` (open it for the user if possible).
- Filter client-side by `app_type` if the user asks for "just the slidedecks" etc.

## Anti-patterns

- Do NOT confuse `app_id` with `job_id`. The app's `job_id` field tells you which research it came from; use `/grep-status` on that to see the source job.
