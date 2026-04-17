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

* `brain` CLI on `$PATH`. The installer drops it into `~/.local/bin/brain` — run `npx grep-research-skills` if `brain --version` is missing.
* The user must be authenticated. If the command errors with "Not authenticated", tell them to run `/grep-login` first.

## Run it (preferred: Monitor for live streaming)

If the Monitor tool is available, use it to stream live status updates:

```bash
brain research submit "$ARGUMENTS" --depth ultra_fast --wait --timeout 60 2>&1
```

Use Monitor with `timeout_ms: 80000` and `persistent: false`. With `2>&1`, status updates and the final report both stream as events.

## CRITICAL: Always deliver results

Whether the command runs via Monitor, blocking Bash, or gets backgrounded by the user — when the task/background notification arrives saying it completed, you MUST:

1. Read the output file from the task notification
2. Extract and present the research report to the user
3. Never silently drop a completed research job

## Run it (fallback: blocking Bash)

If Monitor is not available:

```bash
brain research submit "$ARGUMENTS" --depth ultra_fast --wait --timeout 60
```

**IMPORTANT:** Invoke this bash command with a tool `timeout` of at least `80000` (80 seconds) to give the CLI headroom over the 60s server-side wait.

The command prints heartbeats and live status messages to stderr while polling. Share these updates with the user as they arrive. The final report prints to stdout when complete.

## Presenting results

The output is typically short — a direct answer with 1-3 citations. Present it clearly:

1. Lead with the answer
2. Preserve citations
3. If the query has nuance the ultra_fast tier missed, suggest running `/research` for deeper coverage

## If the job times out

The CLI exits non-zero when `--timeout` elapses. The last-seen `job_id` is printed to stderr — use `/grep-status` with it to resume, or wait and rerun.

## Anti-patterns

- Do NOT use `/quick-research` for complex investigations. If the question has multiple sub-questions or needs cross-referencing, use `/research` instead.
- Do NOT invoke with the default 120s bash timeout without the `--timeout 60` cap — the CLI needs to exit before the bash tool kills it.
