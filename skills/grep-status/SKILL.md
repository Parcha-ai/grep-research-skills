---
name: grep-status
description: Check GREP authentication status, view recent research jobs, or check on a specific job. Use when the user asks about their GREP account, wants to see past research, or check on a running job.
---

# GREP Status

Check authentication and job status.

## Prerequisite

`brain` on `$PATH`. Run `npx grep-research-skills` once if missing.

## Check Authentication

```bash
brain auth status
```

Reports whether the user is authenticated and session health. Add `--json` for scripting.

## Check a Specific Job

```bash
brain research get <job_id> --include-status-messages
# Or raw:
brain jobs <job_id> --json
```

If the job is complete, also run `brain report <job_id>` to print the full report.

## List Recent Jobs

```bash
brain jobs --limit 20
# Or JSON:
brain research list --json
```

## Present Status Clearly

- If not authenticated: suggest running `/grep-login`
- If session expired: suggest re-authenticating with `/grep-login`
- If checking a job: report status and results if completed
