---
name: ultra-research
description: Exhaustive deep investigation via GREP (CAN TAKE UP TO 1 HOUR). Use for the most demanding research tasks — security audits, legal research, regulatory analysis, full ecosystem surveys, multi-source synthesis. Submits the job then schedules a /loop cron that polls every 5 minutes until complete. Use sparingly.
---

# Ultra Research (ultra_deep) — API flavour

GREP's most thorough tier. **Takes up to 1 hour.** Cannot be block-waited — this skill submits the job, returns the `job_id` immediately, and uses `/loop` to check back every 5 minutes across agent turns. This is the API-flavour version — calls the REST API directly via curl.

## CRITICAL: Tell the user up front

> "Ultra-deep research can take anywhere from 10 minutes to a full hour. I'll submit the job now and set up a recurring check every 5 minutes — results will appear automatically when ready. You can keep working on other things while it runs."

## When to use this skill vs the others

| Skill | Time | Use when |
|-------|------|----------|
| `/quick-research` | ~25s | Quick fact, version check, simple lookup |
| `/research` | ~5 min | Most research tasks |
| **`/ultra-research`** (you are here) | **up to 1 hour** | Security audits, legal research, exhaustive investigations |

## Prerequisite

Load the `get_token` helper from `/grep-api-reference`. User must have run `/grep-login`.

## Step 1: Submit the job (non-blocking)

```bash
# <paste get_token() from /grep-api-reference here>

: "${GREP_API_BASE:=https://api.grep.ai}"
TOKEN=$(get_token) || { echo "Not authenticated — run /grep-login" >&2; exit 1; }

BODY=$(node -e "console.log(JSON.stringify({question: process.argv[1], depth: 'ultra_deep'}))" -- "$ARGUMENTS")
SUBMIT=$(curl -s -X POST "$GREP_API_BASE/api/v1/research" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$BODY")
echo "$SUBMIT"
JOB_ID=$(printf '%s' "$SUBMIT" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);process.stdout.write(j.job_id||j.id||'')}")
[ -z "$JOB_ID" ] && { echo "Submit failed" >&2; exit 1; }
echo "JOB_ID=$JOB_ID"
```

Capture `JOB_ID` from the output.

## Step 2: Tell the user

> "Ultra-deep research submitted. Job ID: `<job_id>`. I'll set up an automatic check every 5 minutes — the report will appear here when GREP finishes. You can keep working."

## Step 3: Schedule a recurring check via /loop

Invoke `/loop` with a 5-minute interval and the prompt below (substitute the real `job_id`):

```
5m Check GREP ultra-research job <job_id>. Run this exact command:

  # <paste get_token() from /grep-api-reference here>
  : "${GREP_API_BASE:=https://api.grep.ai}"
  TOKEN=$(get_token)
  curl -s -H "Authorization: Bearer $TOKEN" \
    "$GREP_API_BASE/api/v1/research/<job_id>?include_status_messages=true" \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const st=j.status||'';console.log('Status:',st);if(st==='complete'||st==='completed'){const m=(j.status_messages||[]).reverse().find(m=>m?.content?.content?.type==='text_block'&&m.content.content.text?.length>500);console.log('\n'+(m?m.content.content.text:JSON.stringify(j,null,2)))}})"

Then:
- If the output says "Status: complete" or contains a full report (## headings, citations), present the FULL report to the user (TL;DR, key sections, sources, caveats). Then run CronList, find the cron job whose prompt contains "Check GREP ultra-research job <job_id>", and call CronDelete with its id to stop polling.
- If status is "running"/"pending", briefly tell the user "Still running (<elapsed>)". Do NOT present partial results. Do NOT delete the cron.
- If status is "failed", report the error and call CronDelete to stop polling.
```

## Why /loop?

Makes polling durable across turns — the cron keeps firing even if the user steps away or starts a new conversation. The report shows up automatically.

## Presenting results

Ultra-deep reports are dense. Structure the presentation:

1. **TL;DR** — 2–3 sentences with the headline finding
2. **Key sections** — organised by theme or question dimension
3. **Sources** — preserve citations
4. **Conflicts / caveats** — call out contradictions or confidence issues

## Anti-patterns

- Do NOT block-wait on `ultra_deep` — it'll hit the bash 10-min cap.
- Do NOT default to `/ultra-research`. Start with `/research`.
- Do NOT set the loop interval below 5m.
- Do NOT forget to call `CronDelete` in the completion branch.
