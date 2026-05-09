---
name: grep-with-context
description: Research using user-supplied files as context — uploads PDFs, CSVs, text files, or images to Grep before submitting the research job, so the agent can analyse the user's documents alongside web research. Use when the user attaches files to the conversation, says "research using these documents", "fact-check this PDF", "summarise this report and find related work", or "use this CSV as input for research".
---

# Research with Attached Files

Uploads one or more user-supplied files (PDFs, CSVs, text, images) to Grep as `attachments`, then submits a research job that mounts them in the workspace alongside web research. Use when the user has documents that should be the *input* to the research, not just inline context.

## When to use this skill vs the others

| User wants | Use |
|---|---|
| Research a topic, model picks sources | `/research`, `/grep-domain-expert` |
| Pass small inline context (file contents pasted) | `/research --context-file=...` (existing inline path) |
| **Upload files as research inputs** (PDFs, CSVs, datasets, images) | **`/grep-with-context`** (you are here) |
| Continue an existing job with a follow-up | `/grep-continue` |

Concrete signals: "research using these documents", "fact-check this PDF", "summarise this report and find related work", "use this CSV as input", "analyse the attached spreadsheet". Especially when the user attached files in the Claude Code conversation, or named explicit file paths.

The difference from `--context-file=`: that path inlines the file contents into the research prompt (good for small text), while attachments are uploaded once and mounted in the workspace (better for PDFs, large CSVs, images, or files reused across multiple jobs).

## Auto-update check

```bash
node "$SCRIPTS_DIR/update-check.js" 2>/dev/null &
```

## Prerequisites

```bash
node "$SCRIPTS_DIR/auth.js" status
```

If `"authenticated": false`, **automatically invoke `/grep-login`**.

Attachment uploads cost 5¢ each on the gateway PAYG flow (counted against the user's subscription on v2).

## Resolve script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Step 1: Identify the files

Detect the files to upload from one of:

1. **Absolute paths in `$ARGUMENTS`** — the user typed `/grep-with-context /home/foo/report.pdf "summarise key claims"`
2. **Recent conversation context** — the user attached a file or referenced one ("the CSV I just shared", "that PDF you read earlier")
3. **AskUserQuestion** — if ambiguous

For an attached-file path, verify it exists before upload:

```bash
[ -f "$FILE" ] || { echo "File not found: $FILE"; exit 1; }
```

If the user named a file but didn't give a path, ask:

> Header: "Which file?"
> Question: "Which file should I attach for the research?"
> Options: list any file paths you've seen in the conversation, plus "Other (paste path)"

## Step 2: Tell the user up front

> "I'll upload <file count> file(s) to Grep, then submit research that uses them as input. Upload costs ~5¢/file (PAYG), then research costs depend on the effort tier (low / medium / high)."

## Step 3: Populate the FILES array, then upload each file

First, populate the `FILES` bash array from the file paths Step 1 identified. Two common patterns:

```bash
# Option A — single file from $ARGUMENTS (e.g. user invoked `/grep-with-context /path/to/report.pdf "summarise"`)
FILES=("$1")

# Option B — multiple files passed as positional args before the question
FILES=("$@")  # then capture the question separately, e.g. ARG_QUESTION="${@: -1}"

# Option C — paths the agent collected from conversation context
FILES=("/home/user/report.pdf" "/home/user/data.csv")
```

Pick whichever matches how the agent gathered the file list in Step 1. Verify each path exists before uploading:

```bash
for FILE in "${FILES[@]}"; do
  [ -f "$FILE" ] || { echo "File not found: $FILE"; exit 1; }
done
[ ${#FILES[@]} -eq 0 ] && { echo "No files to upload"; exit 1; }
```

Then upload each. The slug-extraction one-liner uses Node (no `jq` dependency, matching the rest of the repo):

```bash
ATTACHMENT_IDS=""
for FILE in "${FILES[@]}"; do
  RESPONSE=$(node "$SCRIPTS_DIR/grep-api.js" upload "$FILE")
  ATT_ID=$(echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.attachment_id||j.id||'')}")
  if [ -z "$ATT_ID" ]; then
    echo "Upload failed for $FILE: $RESPONSE"
    exit 1
  fi
  ATTACHMENT_IDS="${ATTACHMENT_IDS:+$ATTACHMENT_IDS,}$ATT_ID"
done
```

Each `upload` call returns `{attachment_id: "..."}`. Concatenate IDs with comma separators for the `--attachment-ids=` flag.

If a file fails to upload, **stop the workflow** — partial uploads waste money and produce a research job that can't see the missing context.

## Step 4: Refine the research query

Refine the user's request to reference the attached files explicitly:

- Raw: "summarise this PDF"
- Refined: "Summarise the attached file (annual_report_2025.pdf), extract the top 5 risk factors mentioned in the MD&A section, and find recent industry news that supports or contradicts each."

Mention the filenames in the prompt — the model uses them to address each attachment.

## Step 5: Submit — use Monitor (background)

```bash
node "$SCRIPTS_DIR/grep-api.js" run "<refined>" \
  --attachment-ids="$ATTACHMENT_IDS" \
  --effort=<low|medium> --max-wait=540 \
  [--output-type=<slidedeck|spreadsheet|html_app>] 2>&1
```

`--output-type=` is optional — include it when the user wants a deliverable (deck, spreadsheet, app) rather than a plain report.

Run with **Monitor** (`timeout_ms: 560000`, `persistent: false`). The 20s slack between `--max-wait=540` and `timeout_ms=560000` lets Node flush the report before bash kills the process. Same pattern `/research` uses.

Pick effort by the user's signal:
- "quick summary" → `low`
- (no signal) → `medium`
- "thorough", "fact-check every claim", "comprehensive" → `high` — use `/ultra-research`'s polling pattern (submit non-blocking with `research`, then `/loop` cron). Don't block-wait `effort=high` via `run` — it can take up to 1 hour.

## Step 6: Tell the user

> "<n> file(s) uploaded, research job `<slug>` started — I'll stream updates and post the results when complete."

## Step 7: Present results

When the Monitor notification fires:

1. Read the output file from the task notification
2. Lead with **the files used**: "I researched using <filename1>, <filename2> and pulled in web sources to back the findings:"
3. Present the report cleanly, preserving citations
4. Note any claims from the attachments that the web research **contradicted** — important for fact-check use cases

## CRITICAL: Always deliver results

When the Monitor notification fires, you MUST read the output file and present the report. A research job that completes without surfacing results is a failed mission — especially here where uploads have already been charged (5¢ each).

## Fallback: blocking Bash (only if Monitor is unavailable)

```bash
node "$SCRIPTS_DIR/grep-api.js" run "<refined>" \
  --attachment-ids="$ATTACHMENT_IDS" \
  --effort=<low|medium> --max-wait=540 2>&1
```

Set Bash `timeout` to `560000`. The `--max-wait=540` leaves 20s of slack for Node to print results before bash kills it. If the job times out (exit 2), the slug is in the output — reuse it with `result <slug>`.

## Step 8: Cleanup (optional)

If the files shouldn't persist (sensitive data, one-shot use):

```bash
for ID in $(echo "$ATTACHMENT_IDS" | tr ',' ' '); do
  node "$SCRIPTS_DIR/grep-api.js" delete-attachment "$ID"
done
```

Default TTL on attachments is 7 days. Reuse the `attachment_id` across multiple jobs within that window — re-uploading the same file is wasteful (extra 5¢/file each time).

## Reusing attachments across jobs

If the user does multiple research calls against the same documents (e.g. "summarise → then find related work → then build a deck"), capture the `attachment_id` once and pass it into each subsequent call:

```bash
# Upload once — extract attachment_id without jq
ATT_ID=$(node "$SCRIPTS_DIR/grep-api.js" upload report.pdf \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.attachment_id||j.id||'')}")

# Reuse across multiple research jobs
node "$SCRIPTS_DIR/grep-api.js" run "Summarise" --attachment-ids=$ATT_ID --effort=low
node "$SCRIPTS_DIR/grep-api.js" run "Find related work" --attachment-ids=$ATT_ID --effort=medium
node "$SCRIPTS_DIR/grep-api.js" run "Investor deck" --attachment-ids=$ATT_ID --output-type=slidedeck
```

Pair this with `/grep-research-workflow` for full chained context (`reference_jobs` for prior research findings + `attachment_ids` for source documents).

## Anti-patterns

- Do NOT re-upload the same file across jobs. Reuse the `attachment_id` until it expires (7-day TTL).
- Do NOT upload files larger than the v2 limit. Check `/openapi.json` for the current `_MAX_ATTACHMENT_TOTAL_BYTES`. If a file is too big, summarise it locally first and use `--context-file=<summary>` instead.
- Do NOT skip the upload-failure check. A research job submitted with a missing `attachment_id` will run but produce results that don't reference the missing file — wasted money.
- Do NOT delete attachments mid-research. The job needs them throughout. Delete only after the job's `result` returns.
- Do NOT use this skill when `--context-file=` is enough. Inline context is free (no upload cost, no TTL management). Reach for attachments when files are large, binary (PDF/image), or reused across jobs.
- Do NOT upload sensitive files without confirming with the user. Attachments persist for 7 days by default and travel through Grep's infrastructure.

## If a step fails

- **Upload fails**: don't proceed to research. Tell the user which file failed + why (file size? file type unsupported? auth?). Suggest they shrink the file or convert to a supported format.
- **Research fails after upload**: the attachments are already paid for — offer the user a retry that reuses the same `attachment_id` (no re-upload cost).
- **Research job times out** (exit 2): same as `/research` timeout handling — the slug is in the output, use `result <slug>` later or switch to `/loop` polling.
