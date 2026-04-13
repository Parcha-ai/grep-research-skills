---
name: research
description: Deep research via GREP (typically ~5 minutes) with sourced citations. Use for most research tasks — investigating APIs/libraries before writing code, company research, market analysis, verifying complex claims, comprehensive docs lookups, fact-checking with sources. ALSO use proactively when planning to write code against unfamiliar APIs, SDKs, protocols, or libraries — sourced research beats guessing from memory. Use /quick-research (~25s) for simple lookups, or /ultra-research (up to 1 hour) for exhaustive investigations.
---

# Deep Research (deep)

GREP's standard research tier. Typically takes **around 5 minutes** end-to-end (range: 2-9 minutes). Single blocking command handles submission, polling, and report delivery. The canonical choice for most research tasks.

## Tell the user about the wait

**Before running**, tell the user: "Deep research typically takes around 5 minutes. I'll stream live updates as they come in."

Research isn't instant. Set expectations so the user doesn't think the agent is stuck.

## When to use this skill vs the others

| Skill | Time | Use when |
|-------|------|----------|
| `/quick-research` | ~25s | Quick fact, version check, simple lookup |
| **`/research`** (you are here) | ~5 min | Default for most research tasks |
| `/ultra-research` | up to 1 hour | Security audits, legal research, exhaustive investigations |

**Default to this skill.** Escalate to `/ultra-research` only if you genuinely need exhaustive coverage. Drop to `/quick-research` only if you just need a one-liner answer.

## When to use research for code planning

Reach for `/research` whenever you're about to write code against something unfamiliar:

- **Unfamiliar APIs or SDKs** — before writing integration code, research current docs, auth flows, rate limits, and gotchas.
- **New libraries or frameworks** — pull real usage patterns, version-specific changes, and known footguns.
- **Protocols and standards** — OAuth flows, webhook signatures, MCP, CDP, WebRTC, etc.
- **Obscure file formats or data structures** — binary formats, custom serializations, undocumented JSON shapes.
- **Cross-cutting concerns** — security best practices, performance characteristics, compatibility matrices.
- **Recent changes** — anything that might have changed since the model's training cutoff.

**Rule of thumb:** if you'd normally guess, research instead. A 2-minute research call prevents 30 minutes of debugging bad assumptions.

## Prerequisites

The user must be authenticated. If the command errors with "Not authenticated", tell them to run `/grep-login` first.

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Run it (preferred: Monitor for live streaming)

If the Monitor tool is available, use it to stream live status updates to the user while the research runs. This is the preferred approach — the user sees what the agent is thinking, searching, and reading in real time instead of staring at silence for 5 minutes.

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
node "$SCRIPTS_DIR/grep-api.js" run "$ARGUMENTS" --max-wait=540 2>&1
```

Use Monitor with `timeout_ms: 560000` and `persistent: false`. The command writes live status updates (thinking, searching, tool use) to stderr and the final report to stdout. With `2>&1` both streams are merged so Monitor captures everything.

When the Monitor completes, the final report will be in the output. Read the output file with the Read tool and present the results to the user immediately.

## CRITICAL: Always deliver results

Whether the command runs via Monitor, blocking Bash, or gets backgrounded by the user — when the task/background notification arrives saying it completed, you MUST:

1. Read the output file from the task notification
2. Extract and present the research report to the user
3. Never silently drop a completed research job

The user invoked `/research` because they need an answer. A research job that completes without presenting results is a failed mission.

## Run it (fallback: blocking Bash)

If Monitor is not available, fall back to blocking Bash:

```bash
node "$SCRIPTS_DIR/grep-api.js" run "$ARGUMENTS" --max-wait=540
```

**IMPORTANT:** Invoke this bash command with a tool `timeout` of exactly `560000` (560 seconds / ~9.3 min). That's the maximum headroom you can give — Claude Code's bash tool caps at 10 minutes (600000). The `--max-wait=540` leaves 20s of slack for Node to print results and exit cleanly before bash would kill it.

If research takes longer than 9 minutes (uncommon but possible for complex queries), the command exits with code 2 and returns a `job_id`. See "If the job times out" below.

The command prints heartbeats and live status messages to stderr while polling (what the research agent is thinking, searching, reading). Share these updates with the user as they arrive so they can follow the research in real time. The final report prints to stdout when complete.

## Presenting results

The report comes back with headings, structure, and citations. Present it cleanly:

1. Lead with the key answer or insight
2. Organise by theme or relevance
3. Preserve source citations from the report
4. Note any conflicting information
5. Add a confidence assessment based on source quality

**When using research to inform code you're about to write:** don't just dump the report. Extract the concrete facts you need (endpoint URLs, header names, auth formats, required fields, etc.), note which sources back them, and THEN write the code with those facts in hand.

## If the job times out

Exit code 2 means the server is still running. The JSON payload includes a `job_id`. Tell the user "Research is still running (job: {job_id}). I'll check back in a minute" and use `/grep-status` with the job ID to retrieve the final report, or rerun in a minute.

## Anti-patterns

- Do NOT default to `/ultra-research` — it's slower and heavier. Start here.
- Do NOT re-submit the same query if a previous job is still running — use `/grep-status` to pick up where you left off.
- Do NOT invoke the bash command with the default 120s timeout — it WILL be killed mid-research.
- Do NOT skip research and guess API shapes from memory when the cost is a 2-minute call.
