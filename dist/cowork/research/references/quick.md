# Quick Research

Fastest GREP tier. ~25 seconds end-to-end. Single command, returns the report.

## When to use

Use for quick facts where you need a sourced answer but not a deep investigation:
- API endpoint verification
- Version checks
- "What's the current X" questions
- Quick pre-code sanity checks

**Rule of thumb:** if you'd be happy with a single well-sourced paragraph, use quick. If you need structured coverage of multiple angles, use deep research instead.

## Run it

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/grep-api.js" run "$ARGUMENTS" --depth=ultra_fast --max-wait=60 2>&1
```

Run with **Monitor** (`timeout_ms: 80000`, `persistent: false`). With `2>&1`, status updates and the final report both stream as events.

## Present results

The output is typically short — a direct answer with 1-3 citations. Present it clearly:

1. Lead with the answer
2. Preserve citations
3. If the query has nuance the ultra_fast tier missed, suggest running deep research for broader coverage

## Fallback: blocking Bash

Only if Monitor is unavailable:

```bash
node "$SCRIPTS_DIR/grep-api.js" run "$ARGUMENTS" --depth=ultra_fast --max-wait=60
```

Set Bash `timeout` to at least `80000`.

## If the job times out

Exit code 2 means the server is still working. The JSON payload includes a `job_id`. Use the status workflow to retrieve the result.

## Anti-patterns

- Do NOT use quick research for complex investigations — if the question has multiple sub-questions or needs cross-referencing, use deep research instead.
- Do NOT invoke with the default 120s bash timeout without `--max-wait=60` — Node needs to exit before bash kills it.
