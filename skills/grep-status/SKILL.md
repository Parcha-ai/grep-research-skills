---
name: grep-status
description: Check GREP authentication status, view recent research jobs, or check on a specific job. Use when the user asks about their GREP account, wants to see past research, or check on a running job.
---

# GREP Status

Check authentication and job status.

## Check Authentication

```bash
node ${CLAUDE_SKILL_DIR}/../scripts/auth.js status
```

Reports whether the user is authenticated and session health.

## Check a Specific Job

```bash
node ${CLAUDE_SKILL_DIR}/../scripts/grep-api.js status <job_id>
```

## List Recent Jobs

```bash
node ${CLAUDE_SKILL_DIR}/../scripts/grep-api.js jobs
```

## Present Status Clearly

- If not authenticated: suggest running `/grep-login`
- If session expired: suggest re-authenticating with `/grep-login`
- If checking a job: report status and results if completed
