# Research with Attached Files

Uploads files (PDFs, CSVs, images, text docs) to Grep, then submits research that references them via `attachment_ids`. Use when the user has source documents the research should incorporate.

## When to use

- "Summarize this report.pdf"
- "Compare these two contracts"
- "Extract insights from this CSV"
- "Research the company described in this deck and tell me about their competitors"

If the user just wants research on a topic with no files, use **deep research** (route 1) instead.

## Step 1: Tell the user

> "Uploading <N> files, then running research. Upload is quick; the research itself takes ~5 min at medium effort."

## Step 2: Resolve file paths

Confirm the user has provided actual file paths. If they've described files conceptually ("the contract I sent you"), ask for the path.

## Step 3: Upload each file

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"

declare -a ATTACHMENT_IDS
for path in "$file1" "$file2"; do
  ID=$(node "$SCRIPTS_DIR/grep-api.js" upload "$path" | node -e \
    'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{console.log(JSON.parse(d).id)})')
  ATTACHMENT_IDS+=("$ID")
done

ATTACH_CSV=$(IFS=, ; echo "${ATTACHMENT_IDS[*]}")
```

Each upload returns `{ "id": "att_xxx", "filename": "...", ... }`. Capture the IDs.

Supported formats: PDF, CSV, TXT, MD, PNG, JPG, JSON. Up to ~50MB per file.

## Step 4: Refine the prompt

The prompt should explicitly reference what the user wants extracted from the files:

- Vague: "tell me about these"
- Refined: "Summarize the three uploaded vendor contracts. For each: vendor name, contract length, total value, key liability clauses, termination terms. Compare them in a markdown table."

## Step 5: Submit (Monitor)

```bash
node "$SCRIPTS_DIR/grep-api.js" run "<refined_prompt>" \
  --attachment-ids="$ATTACH_CSV" \
  --effort=medium --max-wait=540 \
  --context-file="$CONTEXT_FILE" 2>&1
```

Run with **Monitor** (`timeout_ms: 560000`, `persistent: false`).

For larger investigations (full audit of a 50-page contract), use `--effort=high --max-wait=3600` with the non-blocking `research` command + `/loop` polling.

Clean up: `rm -f "$CONTEXT_FILE"`.

## While research runs: DO NOT narrate

Stay silent until the job completes.

## Step 6: Present results

When Monitor completes, present the findings. **Cite which uploaded file each insight came from** — that's the whole point of attaching files.

## Anti-patterns

- Do NOT paste large file contents into the prompt — upload via the attachment flow so the file lives in Grep's storage and can be re-referenced.
- Do NOT upload files that are already publicly indexable (Wikipedia pages, public PDFs) — Grep can fetch those itself; uploads count against your subscription quota.
- Do NOT forget the `--attachment-ids` flag — without it, the uploaded files aren't actually used.
- Do NOT narrate Monitor events.
- Do NOT abandon a running job — file-attached research can legitimately take 5-10 min.
