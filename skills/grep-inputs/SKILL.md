---
name: grep-inputs
description: Attach or remove per-job input files on a GREP research job. Files land in Pierre at jobs/{id}/input_files/ and hydrate into the job's sandbox at ./input_files/ at dispatch — the agent reads them as if they were local. Use when the user wants to give a specific research job extra documents (data CSVs, PDFs, supporting materials) or remove ones they uploaded earlier. Different from /grep-defaults (which applies to every job); this is scoped to one job_id.
---

# GREP Job Inputs

Per-job input files. Backend caps: 100 MB per file, 500 MB per job.

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Attach files to a job

```bash
node "$SCRIPTS_DIR/grep-api.js" inputs:attach <job_id> <file...> 
```

Examples:

```bash
node "$SCRIPTS_DIR/grep-api.js" inputs:attach 01J8R4...  ./data.csv ./schema.json
node "$SCRIPTS_DIR/grep-api.js" inputs:attach $JOB_ID  /tmp/report-draft.pdf
```

Returns `{ job_id, commit_sha, files: [{ filename, size_bytes, mime_type, path }] }`. Print the short commit sha and the count of files attached.

Filenames are kept as basenames in the sandbox. If two local files share a basename, rename one before upload — the second would overwrite the first server-side.

## Delete an attached file

```bash
node "$SCRIPTS_DIR/grep-api.js" inputs:delete <job_id> <remote_path>
```

The remote path is whatever appears in `files[].filename` of the attach response (basename, or nested if the agent added subdirs).

## Quick workflow

```bash
# 1. Submit research without waiting
JOB_ID=$(node "$SCRIPTS_DIR/grep-api.js" research "analyze Acme's 10-K" --depth=deep \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);process.stdout.write(j.job_id||j.id||'')}")

# 2. Attach supporting data
node "$SCRIPTS_DIR/grep-api.js" inputs:attach "$JOB_ID" ./acme-10k.pdf ./revenue-model.xlsx

# 3. The agent will see the files at ./input_files/acme-10k.pdf etc.
node "$SCRIPTS_DIR/grep-api.js" status "$JOB_ID"
```

## When to reach for this skill

- Right after submitting a job, the user wants to "attach some extra data".
- During a long-running ultra-deep job, the user wants to supply extra context mid-flight — the agent will see the new file on its next tool call.
- The user wants to remove an upload they made earlier on a specific job.

## Anti-patterns

- Do NOT use `/grep-defaults` when the file should only apply to ONE job.
- Do NOT try to attach files to a completed job — the sandbox is gone.
- Do NOT pipe binary data through stdin. `inputs:attach` only takes file paths.

## Troubleshooting

- **413 Payload Too Large** → file exceeds 100 MB or job is at the 500 MB cap. Split or compress.
- **404 on delete** → filename is case-sensitive; match the attach response exactly.
- **401** → run `/grep-status` to verify auth, or `/grep-login` if expired.
