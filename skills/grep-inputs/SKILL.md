---
name: grep-inputs
description: Attach or remove per-job input files on a GREP research job via raw HTTP. Files live in Pierre at jobs/{id}/input_files/ and are hydrated into the job's sandbox at ./input_files/ at dispatch time. Use when the user wants to give a specific research job extra documents (data CSVs, PDFs, supporting materials) or remove ones they attached earlier. Different from /grep-defaults (which applies to every job); this is scoped to one job ID.
---

# GREP Job Inputs — API flavour

Attach local files to a specific job so the research agent can read them. Backend limits: 100 MB per file, 500 MB total per job.

## Prerequisite

Load the `get_token` helper from `/grep-api-reference`.

## Attach (one or more files)

```bash
: "${GREP_API_BASE:=https://api.grep.ai}"
TOKEN=$(get_token) || { echo "Not authenticated — run /grep-login" >&2; exit 1; }

curl -s -X POST "$GREP_API_BASE/grep/jobs/$JOB_ID/inputs" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@./data.csv" \
  -F "files=@./schema.json"
```

Returns `{ job_id, commit_sha, files: [{filename, size_bytes, mime_type, path}] }`. The `path` field is the full Pierre path (`jobs/<id>/input_files/<filename>`).

## Delete

```bash
curl -s -X DELETE "$GREP_API_BASE/grep/jobs/$JOB_ID/inputs/data.csv" \
  -H "Authorization: Bearer $TOKEN"
```

The trailing path is the filename (or nested path) exactly as it appears in the `files[].filename` of the attach response.

## Quick workflow

```bash
# 1. Submit research without waiting
BODY=$(node -e "console.log(JSON.stringify({question: 'analyze Acme 10-K', depth: 'deep'}))")
SUBMIT=$(curl -s -X POST "$GREP_API_BASE/api/v1/research" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$BODY")
JOB_ID=$(printf '%s' "$SUBMIT" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write((JSON.parse(s).job_id||JSON.parse(s).id)||''))")

# 2. Attach supporting data
curl -s -X POST "$GREP_API_BASE/grep/jobs/$JOB_ID/inputs" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@./acme-10k.pdf" \
  -F "files=@./revenue-model.xlsx"

# 3. Poll via /grep-status until complete.
```

## When to reach for this skill

- Right after submitting a job, the user wants to "add some more data" → attach.
- User wants to remove a wrong file → delete.
- During a long-running ultra-deep job, the user wants to supply extra context mid-flight → attach; the agent will see the new file on its next tool call.

## Common mistakes

- Do NOT use `/grep-defaults` for a one-off job. Defaults apply to every future job.
- Do NOT try to attach files to a job that has already completed — the sandbox is gone.
- Do NOT send anything but `multipart/form-data`; the backend rejects JSON bodies on these endpoints.

## Troubleshooting

- **413 Payload Too Large** → file exceeds 100 MB or job is at the 500 MB cap. Split or compress.
- **404 Not Found on delete** → filename is case-sensitive; match the attach response exactly.
- **401 Unauthorized** → auth expired, or the job belongs to a different user.
