---
name: quick-research
description: Fast fact check via GREP (~25 seconds). Use for simple lookups where you need a sourced answer but don't need a deep investigation — API endpoint verification, version checks, "what's the current X" questions, quick pre-code sanity checks. Prefer this over /research when a 25-second answer beats a 2-minute answer. Use /research instead if you need comprehensive coverage, or /ultra-research for full investigations.
---

# Quick Research (ultra_fast) — API flavour

Fastest GREP tier. ~25 seconds end-to-end. This is the API-flavour version — calls the REST API directly via curl. No `brain` binary required.

## When to use this skill vs the others

| Skill | Time | Use when |
|-------|------|----------|
| **`/quick-research`** (you are here) | ~25s | Quick fact, version check, API endpoint lookup |
| `/research` | ~5 min | Most research tasks, comprehensive docs |
| `/ultra-research` | up to 1 hour | Security audits, legal research, full ecosystem surveys |

## Prerequisite

Load the `get_token` helper from `/grep-api-reference` into the same bash block — it handles auth resolution + JWT refresh. User must have run `/grep-login` first; if not, `get_token` exits 2 and you should tell them to run it.

## Run it

```bash
# <paste get_token() from /grep-api-reference here>

: "${GREP_API_BASE:=https://api.grep.ai}"
TOKEN=$(get_token) || { echo "Not authenticated — run /grep-login" >&2; exit 1; }

# 1. Submit
SUBMIT=$(curl -s -X POST "$GREP_API_BASE/api/v1/research" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data @- <<EOF
{"question": "$ARGUMENTS", "depth": "ultra_fast"}
EOF
)
JOB_ID=$(printf '%s' "$SUBMIT" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);process.stdout.write(j.job_id||j.id||'')}")
[ -z "$JOB_ID" ] && { echo "Submit failed: $SUBMIT" >&2; exit 1; }
>&2 echo "[research] Job $JOB_ID submitted (ultra_fast)"

# 2. Poll (initial 15s wait, 5s interval, 60s cap)
sleep 15
END=$(( $(date +%s) + 45 ))
while [ "$(date +%s)" -lt $END ]; do
  RESP=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$GREP_API_BASE/api/v1/research/$JOB_ID?include_status_messages=true")
  STATUS=$(printf '%s' "$RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).status||''))")
  case "$STATUS" in
    complete|completed)
      printf '%s' "$RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const m=(j.status_messages||[]).reverse().find(m=>m?.content?.content?.type==='text_block'&&m.content.content.text?.length>200);console.log(m?m.content.content.text:JSON.stringify(j,null,2))}"
      exit 0;;
    failed|error) echo "Job failed: $RESP" >&2; exit 1;;
  esac
  sleep 5
done
echo "Timed out after 60s. Resume with /grep-status $JOB_ID" >&2
exit 2
```

**IMPORTANT:** invoke this bash command with `timeout` of at least `80000` ms so the 60s server-side wait has headroom.

If JSON escaping in the `$ARGUMENTS` is risky (quotes, newlines, etc.), build the submit body via node instead of a heredoc:

```bash
BODY=$(node -e "console.log(JSON.stringify({question: process.argv[1], depth: 'ultra_fast'}))" -- "$ARGUMENTS")
SUBMIT=$(curl -s -X POST "$GREP_API_BASE/api/v1/research" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$BODY")
```

## Presenting results

Short output — a direct answer with 1–3 citations. Preserve citations. If the query has nuance this tier missed, suggest `/research` for deeper coverage.

## If the job times out

Exit code 2 means the server is still running. The job_id was printed to stderr. Use `/grep-status` with it to retrieve the report later.

## Anti-patterns

- Do NOT skip the `get_token` helper — raw curls won't refresh expired JWTs and will 401.
- Do NOT default-bash-timeout (120s) this command; always pass `timeout` at least `80000`.
- Do NOT use `/quick-research` for complex investigations.
