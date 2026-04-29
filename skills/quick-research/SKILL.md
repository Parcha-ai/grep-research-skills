---
name: quick-research
description: Fast fact check via GREP (~25 seconds). Use for simple lookups where you need a sourced answer but don't need a deep investigation — API endpoint verification, version checks, "what's the current X" questions, quick pre-code sanity checks. Prefer this over /research when a 25-second answer beats a 2-minute answer. Use /research instead if you need comprehensive coverage, or /ultra-research for full investigations.
---

# Quick Research (ultra_fast)

Fastest GREP tier. ~25 seconds end-to-end. Single command, single blocking call, returns the report.

## When to use this skill vs the others

| Skill | Time | Use when |
|-------|------|----------|
| **`/quick-research`** (you are here) | ~25s | Quick fact, version check, API endpoint lookup, "what's new in X" |
| `/research` | ~5 min | Most research tasks, comprehensive docs, library investigation |
| `/ultra-research` | up to 1 hour | Security audits, legal research, full ecosystem surveys |

**Rule of thumb:** if you'd be happy with a single well-sourced paragraph, use this. If you need structured coverage of multiple angles, use `/research`. If you need exhaustive multi-source synthesis, use `/ultra-research`.

## Prerequisites

The user must be authenticated. Before running any API call, check auth status:

```bash
node "$SCRIPTS_DIR/auth.js" status
```

If the result shows `"authenticated": false`, **automatically invoke `/grep-login`** — don't just tell the user to do it. Run the login flow, then continue with the research once authenticated.

## Resolve the script path

The skill dir is usually symlinked, so always resolve:

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Run it — use Monitor (background), NOT blocking Bash

**IMPORTANT: Always run research as a background Monitor task, never as a blocking Bash call.** Even though quick-research only takes ~25 seconds, Monitor keeps the agent responsive and streams live updates.

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
node "$SCRIPTS_DIR/grep-api.js" run "$ARGUMENTS" --depth=ultra_fast --max-wait=60 2>&1
```

Run this with **Monitor** (`timeout_ms: 80000`, `persistent: false`). With `2>&1`, status updates and the final report both stream as events.

## CRITICAL: Always deliver results

When the Monitor notification arrives saying the task completed, you MUST:

1. Read the output file from the task notification
2. Extract and present the research report to the user
3. Never silently drop a completed research job

## Fallback: blocking Bash (only if Monitor is unavailable)

Only use blocking Bash if the Monitor tool is genuinely not available:

```bash
node "$SCRIPTS_DIR/grep-api.js" run "$ARGUMENTS" --depth=ultra_fast --max-wait=60
```

Set the Bash tool `timeout` to at least `80000` (80 seconds).

## Presenting results

The output is typically short — a direct answer with 1-3 citations. Present it clearly:

1. Lead with the answer
2. Preserve citations
3. If the query has nuance the ultra_fast tier missed, suggest running `/research` for deeper coverage

## If the job times out

Exit code 2 means the server is still working. The JSON payload will include a `job_id`. Use `/grep-status` with the job ID to resume, or wait and rerun.

## Anti-patterns

- Do NOT use `/quick-research` for complex investigations. If the question has multiple sub-questions or needs cross-referencing, use `/research` instead.
- Do NOT invoke with the default 120s bash timeout without the `--max-wait=60` cap — Node needs to exit before the bash tool kills it.
