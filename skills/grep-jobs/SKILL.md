---
name: grep-jobs
description: List recent GREP research jobs — lighter than /grep-status (which also handles auth + specific-job inspection). Use when the user just wants a quick "show me my recent jobs" without filters. For filtering by status or question text, use /grep-search instead.
---

# GREP Jobs (List)

Quick listing of recent research jobs.

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## List

```bash
node "$SCRIPTS_DIR/grep-api.js" jobs [--limit=N]
```

Returns `{ items: [...], count }`. Default backend page size applies if `--limit` is omitted.

## Present results clearly

For each job, show: short id (first 8 chars), status (color-coded if possible — green for complete, yellow for running, red for failed), relative timestamp, one-line excerpt of the question.

## When to reach for this skill

- User says "show my recent research", "what jobs do I have", "list my last 10 jobs".

## Related

- For filtering by status / search text → `/grep-search`
- For one specific job's status + report → `/grep-status <job_id>`
- For retrieving the report → `node $SCRIPTS_DIR/grep-api.js result <job_id>`
