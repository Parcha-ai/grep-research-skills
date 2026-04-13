---
name: grep-status
description: Check GREP authentication status, view recent research jobs, or check on a specific job. Use when the user asks about their GREP account, wants to see past research, or check on a running job.
---

# GREP Status

Check authentication and job status.

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Check Authentication

```bash
node "$SCRIPTS_DIR/auth.js" status
```

Reports whether the user is authenticated and session health.

## Check a Specific Job

```bash
node "$SCRIPTS_DIR/grep-api.js" status <job_id>
```

## List Recent Jobs

```bash
node "$SCRIPTS_DIR/grep-api.js" jobs
```

## Present Status Clearly

- If not authenticated: suggest running `/grep-login`
- If session expired: suggest re-authenticating with `/grep-login`
- If checking a job: report status and results if completed
