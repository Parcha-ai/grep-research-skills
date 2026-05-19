# Continue / Follow Up on a Prior Job

Inherits prior research context. Use when the user wants to extend an existing job rather than start fresh — the new job sees the prior report + cited sources and can build on them.

## When to use

- "Follow up on that research with X"
- "Go deeper on the Y you found earlier"
- "Continue job <slug>"
- "Ask a follow-up about Z based on what we found"

If the user wants research on a new topic, use **deep research** (route 1) instead — `continue` is for extending an existing investigation.

## Step 1: Resolve the prior job slug

If the user mentioned a slug, use it directly. Otherwise:

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/grep-api.js" jobs
```

Show the user a short list of recent jobs and use **AskUserQuestion** to pick. Or, if the conversation makes it obvious (we just finished a job 2 minutes ago), use that slug without asking.

## Step 2: Tell the user

> "Continuing job `<slug>` — new question inherits the prior research as context. ~5 min at medium effort."

## Step 3: Refine the follow-up question

The follow-up should be a focused question, not a duplicate of the original. Examples:

- Prior: "Research the top 10 LLM providers"
- Follow-up: "Of those 10, which support function calling with strict JSON schema?"

The continue job is much faster when the question is *narrow and specific* relative to the prior research.

## Step 4: Submit (Monitor)

```bash
node "$SCRIPTS_DIR/grep-api.js" continue <slug> "<follow_up_question>" \
  --effort=medium --max-wait=540 2>&1
```

Run with **Monitor** (`timeout_ms: 560000`, `persistent: false`).

`continue` doesn't take a `--context-file` — the prior job's context is inherited automatically. Don't double-attach.

## While running: DO NOT narrate

Stay silent until the job completes.

## Step 5: Present results

The new job has its own slug. Present:

1. The follow-up answer (lead).
2. How it relates to the original finding (1-2 sentences).
3. New citations vs. citations reused from the prior job.

If the user wants to chain a third question, repeat with `continue <new_slug>` so each follow-up inherits the most recent context.

## Anti-patterns

- Do NOT use `continue` for unrelated questions — the inherited context costs prompt tokens for nothing.
- Do NOT re-state the entire prior research in the follow-up prompt — that's what `continue` inherits automatically.
- Do NOT chain `continue` indefinitely on a stale job — after a few follow-ups, start a fresh `/research` if the conversation has drifted.
- Do NOT narrate Monitor events.
- Do NOT abandon a running continue job — 3-7 min is normal.
