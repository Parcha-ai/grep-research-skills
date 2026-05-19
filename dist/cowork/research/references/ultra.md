# Ultra Research

GREP's most thorough tier. **Takes up to 1 hour.** Cannot be block-waited (bash tool caps at 10 minutes), so this workflow uses `/loop` to schedule automatic recurring status checks until the job completes.

## Before starting

Tell the user exactly this:

> "Ultra-deep research can take anywhere from 10 minutes to a full hour. I'll submit the job now and set up a recurring check every 5 minutes — results will appear automatically when ready. You can keep working on other things while it runs."

## When to use

Only for genuinely exhaustive investigations:
- Security audits
- Legal research and regulatory analysis
- Full ecosystem surveys
- Multi-source synthesis
- Adversarial threat modelling

**Use sparingly.** For most pre-code research, deep research (~5 min) is the right tool.

## Step 1: Submit the job (non-blocking)

Use `research` (not `run`) so submission returns immediately with a job ID:

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/grep-api.js" research "$ARGUMENTS" --depth=ultra_deep
```

The output is JSON with a `job_id` field. Capture that value.

## Step 2: Confirm submission

Tell the user:

> "Ultra-deep research submitted. Job ID: `<job_id>`. I'll check every 5 minutes — the report will appear here when GREP finishes (up to 1 hour). You can keep working in the meantime."

## Step 3: Schedule recurring check via /loop

Invoke the `/loop` skill with a 5-minute interval and a prompt that checks job status and self-terminates when complete. Use the Skill tool to call `loop` with this argument (substituting real `job_id` and `SCRIPTS_DIR` values):

```
5m Check GREP ultra-research job <job_id>. Run this exact command:

  node "<SCRIPTS_DIR>/grep-api.js" result <job_id>

Then:
- If the output's top line says "Status: completed" or contains a full report (## headings, citations), present the FULL report to the user in a cleanly structured way (TL;DR, key sections, sources, caveats). Then run CronList, find the cron job whose prompt contains "Check GREP ultra-research job <job_id>", and call CronDelete with its id to stop polling.
- If status is "running", "pending", or similar, briefly tell the user "Still running (<elapsed>)". Do NOT present partial results. Do NOT delete the cron.
- If status is "failed", report the error and call CronDelete to stop polling.
```

## Presenting results

Ultra-deep reports are dense. Structure the presentation:

1. **TL;DR** — 2-3 sentences with the headline finding
2. **Key sections** — organised by theme or question dimension
3. **Sources** — preserve citations
4. **Conflicts / caveats** — call out contradictions or confidence issues
5. **Next steps** — if the user is planning code, extract concrete facts before writing code

## Edge cases

- **User starts a new conversation:** the cron keeps running and will present the report when it fires.
- **Job fails:** the loop prompt handles this — report error, delete cron.
- **User manually cancels:** run `CronList` to find the cron and `CronDelete` to stop it.

## Anti-patterns

- Do NOT use `run` (blocking) for ultra_deep — it will hit the bash 10-min cap and fail.
- Do NOT default to ultra research — start with deep and escalate only if needed.
- Do NOT set the loop interval below 5m — aggressive polling wastes cron fires.
- Do NOT forget to call `CronDelete` in the completion branch — otherwise the cron fires for 7 days.
- Do NOT re-submit a query if a previous job is still running — the existing loop will pick up the result.
