---
name: ultra-research
description: Exhaustive deep investigation via GREP (CAN TAKE UP TO 1 HOUR). Use for the most demanding research tasks — security audits, legal research, regulatory analysis, full ecosystem surveys, multi-source synthesis, adversarial threat modeling, or any query where completeness matters more than speed. Use sparingly; this tier is slow and cannot be block-waited in a single call. The skill submits the job then schedules a /loop cron that polls every 5 minutes until complete. Use /research (~5 min) for most tasks, or /quick-research (~25s) for simple lookups.
---

# Ultra Research (ultra_deep)

GREP's most thorough tier. **Takes up to 1 hour.** Cannot be block-waited (Claude Code's bash tool caps at 10 minutes), so this skill uses the `/loop` feature to schedule an automatic recurring status check until the job completes.

## CRITICAL: Tell the user up front

**Before submitting, tell the user exactly this:**

> "Ultra-deep research can take anywhere from 10 minutes to a full hour. I'll submit the job now and set up a recurring check every 5 minutes — results will appear automatically when ready. You can keep working on other things while it runs."

Set expectations clearly.

## When to use this skill vs the others

| Skill | Time | Use when |
|-------|------|----------|
| `/quick-research` | ~25s | Quick fact, version check, simple lookup |
| `/research` | ~5 min | Most research tasks |
| **`/ultra-research`** (you are here) | **up to 1 hour** | Security audits, legal research, full ecosystem surveys, exhaustive investigations |

**Use sparingly.** Only reach for this tier when the question genuinely warrants exhaustive coverage AND the user has time to wait. For most pre-code research, `/research` is the right tool.

## Prerequisites

The user must be authenticated. If the command errors with "Not authenticated", tell them to run `/grep-login` first.

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Step 1: Submit the job (non-blocking)

Use the `research` subcommand (not `run`) so submission returns immediately with a job ID:

```bash
node "$SCRIPTS_DIR/grep-api.js" research "$ARGUMENTS" --depth=ultra_deep
```

The output is a JSON object with a `job_id` field. Capture that value — you'll need it for the loop.

## Step 2: Tell the user

After capturing the job_id, send a message like:

> "Ultra-deep research submitted. Job ID: `<job_id>`. I'll set up an automatic check every 5 minutes — the report will appear here when GREP finishes (up to 1 hour). You can keep working in the meantime."

## Step 3: Schedule a recurring check via /loop

Invoke the `/loop` skill with a 5-minute interval and a prompt that checks the job status and self-terminates when complete. Use the Skill tool to call `loop` with this argument (substituting the real `job_id` and `SCRIPTS_DIR` values):

```
5m Check GREP ultra-research job <job_id>. Run this exact command:

  node "<SCRIPTS_DIR>/grep-api.js" result <job_id>

Then:
- If the output's top line says "Status: completed" or contains a full report (## headings, citations), present the FULL report to the user in a cleanly structured way (TL;DR, key sections, sources, caveats). Then run CronList, find the cron job whose prompt contains "Check GREP ultra-research job <job_id>", and call CronDelete with its id to stop polling.
- If status is "running", "pending", or similar, briefly tell the user "Still running (<elapsed>)". Do NOT present partial results. Do NOT delete the cron.
- If status is "failed", report the error and call CronDelete to stop polling.
```

`/loop` will:
1. Create a recurring cron at `*/5 * * * *`
2. Run the prompt immediately for the first check (it'll report "still running" since we just submitted)
3. Fire again every 5 minutes
4. The prompt handles presentation + self-termination once the job completes

## Why /loop?

Previous versions of this skill required the agent to manually remember to poll across turns, which was fragile. `/loop` makes polling durable: the cron keeps firing even if the user steps away, starts a new conversation, or does other work. The report shows up automatically when ready.

## Presenting results (when the loop fires and sees completion)

Ultra-deep reports are dense. Structure the presentation:

1. **TL;DR** — 2-3 sentences with the headline finding
2. **Key sections** — organised by theme or question dimension
3. **Sources** — preserve citations
4. **Conflicts / caveats** — call out contradictions or confidence issues
5. **Next steps** — if the user is planning code, extract concrete facts (endpoints, auth patterns, compliance requirements) before writing code

## Handling edge cases

- **User starts a new conversation before the job completes:** the cron keeps running. When it fires and the job is done, the agent in that cron turn presents the report.
- **Job fails:** the loop's prompt handles this — report the error, delete the cron.
- **User manually cancels:** they can run `CronList` to find the cron and `CronDelete` to stop it.
- **Job runs longer than an hour:** unusual, but the cron will keep firing (auto-expires after 7 days). The user or agent can manually cancel.

## Anti-patterns

- Do NOT use `run` (the blocking command) for ultra_deep — it will hit the bash 10-min cap and fail before the job completes.
- Do NOT default to `/ultra-research`. Start with `/research` and escalate only if needed.
- Do NOT set the loop interval below 5m. Ultra-deep jobs don't benefit from aggressive polling — it just wastes cron fires.
- Do NOT forget to call `CronDelete` in the prompt's completion branch. Otherwise the cron will keep firing for 7 days.
- Do NOT re-submit a query if a previous job is still running — the existing loop will pick up the result.
