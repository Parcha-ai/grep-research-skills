---
name: grep-inputs
description: Attach or remove per-job input files on a GREP research job. Files live in Pierre at jobs/{id}/input_files/ and are hydrated into the job's sandbox at ./input_files/ at dispatch time. Use when the user wants to give a specific research job extra documents (data CSVs, PDFs, supporting materials) or remove ones they attached earlier. Different from /grep-defaults (which applies to every job); this is scoped to one job ID.
---

# GREP Job Inputs

Attach local files to a specific job so the research agent can read them. The backend caps uploads at 100 MB per file, 500 MB total per job.

## Prerequisite

`brain --version` must work. If missing, run `npx grep-research-skills --cli` once.

## Attach files

```bash
brain inputs attach "$JOB_ID" ./data.csv ./schema.json --json
```

Returns `{ job_id, commit_sha, files: [{ filename, size_bytes, mime_type, path }] }`. The `path` field is the full Pierre path (`jobs/<id>/input_files/<filename>`). Print the short commit sha + file count.

Filenames keep their basename as the remote name. If the user has two local files with the same basename, rename one of them before upload — the second would overwrite the first server-side.

## Remove a file

```bash
brain inputs delete "$JOB_ID" data.csv --json
```

The `REMOTE_PATH` argument is the basename (or nested path) exactly as it appears in the `files[].filename` of the attach response.

## When to reach for this skill

- Right after submitting a job, the user wants to "add some more data" → attach.
- User says "remove that upload, wrong file" → delete.
- During a long-running ultra-deep job, the user wants to supply extra context mid-flight → attach; the agent will see the new file on its next tool call.

## Quick workflow

```bash
# 1. Submit research without waiting
JOB_ID=$(brain research submit "analyze Acme's 10-K" --depth deep --json | jq -r '.job_id // .id')

# 2. Attach supporting data
brain inputs attach "$JOB_ID" ./acme-10k.pdf ./revenue-model.xlsx

# 3. Let the job run, poll as usual
brain research get "$JOB_ID" --include-status-messages
```

## Common mistakes to avoid

- Do NOT use `/grep-defaults` for a one-off job. Defaults apply to every future job.
- Do NOT try to attach files to a job that has already completed — the sandbox is gone.
- Do NOT pipe a binary through stdin. `brain inputs attach` only takes paths to files on disk.

## Troubleshooting

- **413 Payload Too Large** → file exceeds 100 MB or the job is already at the 500 MB cap. Split or compress.
- **404 Not Found on delete** → the filename is case-sensitive. Use the exact value from the attach response.
- **401 Unauthorized** → auth expired or the job belongs to a different user. Run `/grep-status`.
