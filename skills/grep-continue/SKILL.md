---
name: grep-continue
description: Continue an existing Grep research job with a follow-up question, building on the prior job's findings without re-running the entire investigation. Use when the user says "follow up on that research", "continue the X investigation", "go deeper on the third finding", or references a previous job by id/slug ("continue grep.ai/research/foo-bar-baz with: ...").
---

# Continue an Existing Research Job

Submits a follow-up against a completed Grep job — re-runs inference at the user's chosen effort tier, but inherits the prior job's research context so it doesn't re-investigate the same ground. Cheaper and faster than starting fresh when the new question genuinely builds on the old one.

## When to use this skill vs the others

| User wants | Use |
|---|---|
| New, unrelated research | `/research`, `/quick-research`, `/grep-domain-expert` |
| **Follow-up on a previous job** | **`/grep-continue`** (you are here) |
| Multi-step end-to-end (orient → deep → build) | `/grep-research-workflow` (uses `--reference-jobs=` programmatically) |
| Build a different artifact from the same research | `/grep-continue <slug> "..." --output-type=...` (this skill, with output_type) |

Concrete signals: "follow up on that", "continue the X investigation", "go deeper on the third finding", "now make me a deck from that", "what about Y based on the previous research", "that report you just did, but for region Z". Especially when the user references a previous job by slug or URL.

## Auto-update check

```bash
node "$SCRIPTS_DIR/update-check.js" 2>/dev/null &
```

## Prerequisites

```bash
node "$SCRIPTS_DIR/auth.js" status
```

If `"authenticated": false`, **automatically invoke `/grep-login`**.

Continue costs the same as a fresh job at the same effort tier ($2 for medium, $10 for high, $2 for build). The savings come from inheritance — the model spends its budget on the new question instead of re-establishing context.

## Resolve script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Step 1: Resolve the parent job

The user can refer to the parent in three forms — extract the `id_or_slug` from any of them:

1. **UUID**: `b19421e9-1234-5678-9abc-def012345678`
2. **Slug**: `anthropic-revenue-strategy-2026`
3. **URL**: `https://grep.ai/research/anthropic-revenue-strategy-2026` — strip the path prefix

```bash
# Extract from URL or accept slug/UUID directly
PARENT="${1:-}"
PARENT="${PARENT##*/research/}"  # strip URL prefix if present
PARENT="${PARENT%%\?*}"            # strip query string
PARENT="${PARENT%%\#*}"            # strip URL fragment (e.g. #third-finding)
```

If the user didn't provide a slug/UUID, look at recent conversation. If still ambiguous, ask:

> Header: "Which job?"
> Question: "Which prior research job should I continue?"
> Options: list any slugs/UUIDs from recent conversation, plus "List my recent jobs" (which runs `node grep-api.js jobs`)

## Step 2: Verify the parent exists and is `complete`

```bash
STATUS=$(node "$SCRIPTS_DIR/grep-api.js" status "$PARENT" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.status||'')}")
case "$STATUS" in
  completed|complete)
    : # OK
    ;;
  running|pending|queued)
    echo "Job is still running. Wait for it to complete before continuing."
    exit 1
    ;;
  failed|cancelled)
    echo "Job is in '$STATUS' state — can't continue. Start a fresh job."
    exit 1
    ;;
  *)
    echo "Unexpected status: $STATUS"
    exit 1
    ;;
esac
```

The API will 422 on a `failed` or `cancelled` parent. Better to fail fast with a clear message than to surface a confusing API error.

## Step 3: Refine the follow-up question

The user's raw follow-up is often terse ("go deeper on the third finding"). Refine it:

- Reference the parent topic explicitly so the new job's report stands on its own
- Cite the specific finding/section/entity from the parent that the user is building on
- Mention any new constraints (different region, different time range, narrower scope)

Example:
- Raw: "go deeper on the third finding"
- Refined: "Deeper investigation on the third finding from the prior Anthropic enterprise strategy research — specifically, the SOC2 compliance signal as a moat against open-source competitors. Include enterprise customer adoption data, competitor compliance positioning, and forward-looking regulatory triggers."

## Step 4: Pick effort tier

Default by user signal:
- "quick clarification" → `low`
- (no signal, default for follow-ups) → `medium`
- "thorough deep-dive" → `high` (use `/ultra-research`'s polling pattern)

If the follow-up is asking for an **artifact** (deck, spreadsheet, app), pass `--output-type=...` instead of just `--effort=`. The sugar pins effort=build automatically.

## Step 5: Submit

`continue` POSTs to `/research/{id_or_slug}/continue` with `{question, effort?, context?}`. The response shape is the same as a fresh `POST /research` — returns `{job_id, slug, status}` for the new continuation job. The submit command differs by effort tier — pick the matching block:

**Low / medium effort (synchronous via Monitor):**

```bash
node "$SCRIPTS_DIR/grep-api.js" continue "$PARENT" "<refined follow-up>" \
  --effort=<low|medium> 2>&1
```

Run with **Monitor** (`timeout_ms: 560000`, `persistent: false`). 20s slack between `--max-wait=540` and `timeout_ms` so Node can flush the report.

**Build effort / artifact follow-up (synchronous, longer):**

```bash
node "$SCRIPTS_DIR/grep-api.js" continue "$PARENT" "Build me a slidedeck from these findings" \
  --output-type=slidedeck 2>&1
```

Run with **Monitor** (`timeout_ms: 1800000`, `persistent: false`). Build jobs take 10-15 min.

**High effort (async — cannot block-wait):**

`effort=high` runs up to 1 hour, exceeding the bash 10-min cap and any reasonable Monitor budget. Use the `/ultra-research` polling pattern: submit non-blocking, then schedule a `/loop` cron that polls every 5 min and presents results when complete.

```bash
# Non-blocking submit — returns {job_id, slug, status} JSON
SUBMIT=$(node "$SCRIPTS_DIR/grep-api.js" continue "$PARENT" "<refined follow-up>" --effort=high)
NEW_SLUG=$(echo "$SUBMIT" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.slug||j.job_id||j.id||'')}")
[ -z "$NEW_SLUG" ] && { echo "Continue submit failed: $SUBMIT"; exit 1; }
```

Then schedule the same `/loop` cron that `/ultra-research` uses (5-min interval, polls `result <NEW_SLUG>`, presents on completion, calls `CronDelete` to stop).

| Effort | Monitor `timeout_ms` | Pattern |
|---|---|---|
| `low` | 560000 (~9 min) | synchronous via Monitor |
| `medium` | 560000 (~9 min) | synchronous via Monitor |
| `build` (with `--output-type=`) | 1800000 (30 min) | synchronous via Monitor |
| `high` | n/a | async via `/loop` cron, same as `/ultra-research` |

## Step 6: Tell the user

> "Follow-up job `<new-slug>` started, building on `<parent-slug>`. ~5 min."

## Step 7: Present results

When the Monitor notification fires:

1. Lead with **the chain**: "I built on the prior <topic> research:"
2. Present the new report cleanly
3. Link both jobs at the bottom:

   > **Trace:**
   > - Prior research: https://grep.ai/research/<parent-slug>
   > - This continuation: https://grep.ai/research/<new-slug>

This makes the lineage obvious for future follow-ups.

## Step 8: Suggest further follow-ups

If the user might want to keep going, suggest:

- "Want a different angle?" → `/grep-continue <new-slug> "<another follow-up>"`
- "Want to materialise this as a deck/app/spreadsheet?" → `/grep-continue <new-slug> "Build a <X>" --output-type=<X>`
- "Want a fresh investigation on the side topic?" → `/research` (no continue — start clean)

Don't continue indefinitely. After 3-4 levels of nesting, the user usually wants either a fresh investigation or a build artifact — suggest those instead.

## Anti-patterns

- **Don't use this skill for unrelated questions.** If the new question doesn't genuinely build on the parent's research, start a fresh job. Continue costs the same as a fresh job at the same effort tier — the savings are zero when the inheritance isn't useful.
- **Don't continue a `failed` or `cancelled` job.** The API will 422. Verify status before submitting.
- **Don't pass `--reference-jobs=`** alongside `continue` — `continue` already sets the parent reference internally. Adding extra `reference_jobs` is allowed (chains additional context) but rarely needed.
- **Don't chain more than 3-4 continues** without a clear reason. Each level adds context the model has to reconcile; eventually the inheritance gets noisy and a fresh investigation produces sharper results.
- **Don't continue from someone else's job slug.** The continue endpoint requires auth scope on the parent — only the original submitter (or their team, on v2) can continue.
- **Don't strip slug suffixes by accident** — slugs can contain hyphens and numbers (`anthropic-revenue-strategy-2026`). Only strip URL prefixes and query strings; never split on `-`.

## If the parent isn't yours

If the user wants to "continue" research they didn't submit (e.g. a public Grep example URL someone shared), the API will 403 / 404. Tell the user:

> "I can only continue jobs you submitted yourself. If you want to investigate this topic, I can start a fresh `/research` job and reference the public report's findings as context."

Then offer to run `/research` with the public URL pasted into `--context-file=` so the new job has the same starting point — without trying to use the unauthorized continue endpoint.

## If the new job times out

Same pattern as `/research`: exit 2 + slug returned. Use `result <slug>` later, or switch to `/loop` polling for very long continuations.
