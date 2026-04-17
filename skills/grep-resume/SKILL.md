---
name: grep-resume
description: Resume a paused GREP research job, optionally with a steering message that nudges the agent in a new direction. Use when the user previously paused a job (via /grep-stop), or when a job hit a clarification checkpoint and the user wants to push it forward with extra guidance.
---

# GREP Resume

Resume a paused job; optionally pass a steering message the agent will read before continuing.

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Resume

```bash
# Plain resume
node "$SCRIPTS_DIR/grep-api.js" resume <job_id>

# Resume with steering
node "$SCRIPTS_DIR/grep-api.js" resume <job_id> --message="focus on EU regulations specifically"
```

Returns `{ status, job_id, ... }`. Print confirmation with the job_id.

## When to reach for this skill

- User says "continue that paused research", "pick up the job from earlier", "resume <id>".
- User wants to redirect a paused job mid-flight ("now look into X instead").

## Related

- Pause / cancel: `/grep-stop`
- Inspect status before resuming: `/grep-status` with the job_id

## Anti-patterns

- Do NOT resume a completed or failed job — `resume` is only for paused state.
- Do NOT use this to "retry" a failed job; submit a new one with `/research`.
