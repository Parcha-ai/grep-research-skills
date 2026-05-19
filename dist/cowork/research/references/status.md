# GREP Status

Check authentication status, view recent research jobs, or check on a specific job.

## Check authentication

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/auth.js" status
```

Reports whether the user is authenticated and session health.

If not authenticated or session expired: **automatically run the login workflow** from `${CLAUDE_SKILL_DIR}/references/login.md` — don't just suggest it. Then continue with the status check.

## Check a specific job

If the user provides a job ID:

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/grep-api.js" status <job_id>
```

If the job is completed, also fetch and present the full report:

```bash
node "$SCRIPTS_DIR/grep-api.js" result <job_id>
```

## List recent jobs

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/grep-api.js" jobs
```

## Present status clearly

- **Authenticated + no job query:** Show auth status and recent jobs summary
- **Checking a specific job:** Report status, and present full results if completed
- **Not authenticated:** Run the login flow automatically, then show status
