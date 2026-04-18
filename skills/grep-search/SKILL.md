---
name: grep-search
description: Search past GREP research jobs by status and/or question text. Use when the user asks "have I researched X?", "what jobs failed?", "find that report about Y", or wants to filter their job history. The backend has no full-text search yet — this filters the most recent N jobs client-side, so increase --limit if older jobs need to be considered.
---

# GREP Search Jobs

Filter your recent research jobs by status (`complete`, `running`, `failed`, etc.) and/or substring match on the question text.

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Search

```bash
node "$SCRIPTS_DIR/grep-api.js" search [--status=<status>] [--query=<substring>] [--limit=<N>] [--offset=<N>]
```

Examples:

```bash
# Find every completed job mentioning "parcha" (case-insensitive substring)
node "$SCRIPTS_DIR/grep-api.js" search --status=complete --query=parcha --limit=100

# Just the most recent 20 failed jobs
node "$SCRIPTS_DIR/grep-api.js" search --status=failed --limit=20

# Search a deeper page (older jobs)
node "$SCRIPTS_DIR/grep-api.js" search --query=stripe --limit=50 --offset=50
```

Output JSON shape:

```json
{
  "total_matched": 3,
  "total_in_page": 50,
  "limit": 50,
  "offset": 0,
  "items": [ { "id": "...", "status": "complete", "question": "...", ... } ]
}
```

## Present results clearly

- Lead with **how many matched** out of how many were searched.
- If `total_matched` is 0 and `total_in_page == limit`, suggest re-running with a higher `--limit` or a different `--offset` — older jobs may have matched.
- For each matched job, show: short id (first 8 chars), status, created_at (relative time if available), and a one-line excerpt of the question.
- If the user wants the full report for a hit, hand off to `/grep-status` with the full job_id.

## Anti-patterns

- Do NOT promise full-text search across all-time history. The backend doesn't expose that yet; this is a windowed scan over `/api/v1/research`.
- Do NOT use this when the user has a specific job_id — `/grep-status` is direct and cheaper.
