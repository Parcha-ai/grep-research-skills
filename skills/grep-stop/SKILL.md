---
name: grep-stop
description: Pause or cancel a running GREP check, or soft-delete a check result. Use when the user wants to halt an in-flight job (pause to resume later, or cancel entirely), or to clean up an unwanted check result entry.
---

# GREP Stop / Cancel / Delete

Three lifecycle controls for in-flight or completed checks.

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Pause a running check

```bash
node "$SCRIPTS_DIR/grep-api.js" stop <check_result_id> --action=pause
```

The check halts but stays in `paused` state. Use `/grep-resume <job_id>` to continue.

## Cancel a running check

```bash
node "$SCRIPTS_DIR/grep-api.js" stop <check_result_id> --action=cancel
```

The check stops permanently and the job moves to a terminal state. Cannot be resumed.

## Soft-delete a check result

```bash
node "$SCRIPTS_DIR/grep-api.js" check:delete <check_result_id>
```

Marks the check result as DELETED (soft delete; data isn't purged). The job's overall status may revert if this was the only running check.

## Where do I get a check_result_id?

Check IDs come from the job detail response. Run `/grep-status <job_id>` and look at `check_results[].id`.

## When to reach for this skill

- User says "stop that job", "pause that research", "cancel <id>".
- User wants to clean up an erroneous or stale check result entry.

## Anti-patterns

- Do NOT use `cancel` when `pause` is wanted. Cancel is irreversible.
- Do NOT delete a check result that's still running — pause or cancel first.
- check_result_id is **not** the same as job_id. They're different identifiers.

## Related

- Resume after pause: `/grep-resume`
- Inspect job state first: `/grep-status`
