---
name: grep-status
description: Check GREP authentication status, view recent research jobs, or check on a specific job via raw HTTP. Use when the user asks about their GREP account, wants to see past research, or check on a running job.
---

# GREP Status — API flavour

Check authentication and job status via curl.

## Prerequisite

Load the `get_token` helper from `/grep-api-reference` into the same bash block.

## Check authentication

```bash
# paste get_token() from /grep-api-reference
if TOKEN=$(get_token 2>/dev/null); then
  [ -f "$HOME/.grep/session.json" ] && cat "$HOME/.grep/session.json" \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(JSON.stringify({authenticated:true, email:j.email||null, authMethod:j.authMethod||'descope', authenticatedAt:j.authenticatedAt||null}, null, 2))}"
else
  echo '{"authenticated": false}'
fi
```

## Check a specific job

```bash
: "${GREP_API_BASE:=https://api.grep.ai}"
TOKEN=$(get_token)
curl -s -H "Authorization: Bearer $TOKEN" \
  "$GREP_API_BASE/api/v1/research/$JOB_ID?include_status_messages=true"
```

If complete, walk `status_messages[]` in reverse and find a `text_block` whose `content.content.text` looks like a report (contains `##` or >500 chars). That's the final report.

## List recent jobs

```bash
: "${GREP_API_BASE:=https://api.grep.ai}"
TOKEN=$(get_token)
curl -s -H "Authorization: Bearer $TOKEN" "$GREP_API_BASE/api/v1/research?limit=20"
```

## Waitlist / onboarding

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$GREP_API_BASE/grep/researchWaitlistStatus"
curl -s -H "Authorization: Bearer $TOKEN" "$GREP_API_BASE/grep/onboarding/status"
```

## Present status clearly

- If not authenticated: suggest running `/grep-login`.
- If session expired: suggest re-authenticating via `/grep-login`.
- If checking a job: report status and the report (if completed).
