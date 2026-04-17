---
name: research
description: Deep research via GREP (typically ~5 minutes) with sourced citations. Use for most research tasks — investigating APIs/libraries before writing code, company research, market analysis, verifying complex claims, comprehensive docs lookups, fact-checking with sources. ALSO use proactively when planning to write code against unfamiliar APIs, SDKs, protocols, or libraries — sourced research beats guessing from memory. Use /quick-research (~25s) for simple lookups, or /ultra-research (up to 1 hour) for exhaustive investigations.
---

# Deep Research (deep) — API flavour

GREP's standard research tier, ~5 minutes end-to-end. This is the API-flavour version — calls the REST API directly via curl.

**Before running**, tell the user: "Deep research typically takes around 5 minutes. I'll stream live updates as they come in."

## When to use this skill vs the others

| Skill | Time | Use when |
|-------|------|----------|
| `/quick-research` | ~25s | Quick fact, version check, simple lookup |
| **`/research`** (you are here) | ~5 min | Default for most research tasks |
| `/ultra-research` | up to 1 hour | Security audits, legal research, exhaustive investigations |

## When to use research for code planning

Reach for `/research` whenever you're about to write code against something unfamiliar:

- **Unfamiliar APIs or SDKs** — before writing integration code, research current docs, auth flows, rate limits, and gotchas.
- **New libraries or frameworks** — pull real usage patterns, version-specific changes, and known footguns.
- **Protocols and standards** — OAuth flows, webhook signatures, MCP, CDP, WebRTC, etc.
- **Recent changes** — anything that might have changed since the model's training cutoff.

**Rule of thumb:** if you'd normally guess, research instead.

## Clarify before researching

Apply the **99% rule**: if 99 random people typed this exact query, would they all want the same research? If no, ask 1-2 clarification questions using **AskUserQuestion** (header: "Research scope", 2-4 concrete options).

## Gather context (makes research 10x more actionable)

Before submitting, gather relevant context and send it alongside the query via the `context` field. **Always gather context for code/implementation research.** Skip for pure factual lookups.

```bash
CONTEXT_FILE=$(mktemp /tmp/grep-research-context.XXXXXX)

# Relevant existing code
[ -f CLAUDE.md ] && { echo "=== PROJECT INSTRUCTIONS ===" >> "$CONTEXT_FILE"; head -100 CLAUDE.md >> "$CONTEXT_FILE"; echo "" >> "$CONTEXT_FILE"; }

for manifest in package.json pyproject.toml requirements.txt Cargo.toml go.mod; do
  if [ -f "$manifest" ]; then
    echo "=== $manifest ===" >> "$CONTEXT_FILE"
    head -40 "$manifest" >> "$CONTEXT_FILE"
    echo "" >> "$CONTEXT_FILE"
  fi
done
```

## Optional: SOP-driven project

If the user's workflow has a named project (e.g. `experts/flutterwave_mcc`) with an `SOP.md`, set `PROJECT=<path>` and the submit body includes `"project": "$PROJECT"`. The backend uses that SOP as the agent's system prompt.

## Prerequisite

Load the `get_token` helper from `/grep-api-reference` into the same bash block. User must be logged in via `/grep-login` first.

## Run it

```bash
# <paste get_token() from /grep-api-reference here>

: "${GREP_API_BASE:=https://api.grep.ai}"
TOKEN=$(get_token) || { echo "Not authenticated — run /grep-login" >&2; exit 1; }

QUESTION="<refined query>"
PROJECT=""        # optional: "experts/flutterwave_mcc" for SOP-driven jobs
CTX=$(cat "$CONTEXT_FILE" 2>/dev/null || true)

BODY=$(node -e '
  const q=process.argv[1], ctx=process.argv[2], proj=process.argv[3];
  const b={question:q, depth:"deep"};
  if (ctx) b.context = ctx;
  if (proj) b.project = proj;
  console.log(JSON.stringify(b));
' -- "$QUESTION" "$CTX" "$PROJECT")

SUBMIT=$(curl -s -X POST "$GREP_API_BASE/api/v1/research" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$BODY")
JOB_ID=$(printf '%s' "$SUBMIT" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);process.stdout.write(j.job_id||j.id||'')}")
[ -z "$JOB_ID" ] && { echo "Submit failed: $SUBMIT" >&2; exit 1; }
>&2 echo "[research] Job $JOB_ID submitted (deep)"

# Poll: 20s initial, 15s interval, 540s cap
sleep 20
END=$(( $(date +%s) + 520 ))
SEEN=0
while [ "$(date +%s)" -lt $END ]; do
  RESP=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$GREP_API_BASE/api/v1/research/$JOB_ID?include_status_messages=true")
  # Stream new status messages to stderr so the user sees progress.
  printf '%s' "$RESP" | node -e "
    let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
      const j=JSON.parse(s); const msgs=j.status_messages||[];
      const seen=parseInt(process.env.SEEN,10)||0;
      for (let i=seen;i<msgs.length;i++){
        const t=msgs[i]?.content?.status || msgs[i]?.content?.text || '';
        if (t) process.stderr.write('[research] > ' + t.slice(0,300) + '\n');
      }
      process.stdout.write(String(msgs.length));
    });
  " SEEN="$SEEN" > /tmp/seen.txt
  SEEN=$(cat /tmp/seen.txt)
  STATUS=$(printf '%s' "$RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).status||''))")
  case "$STATUS" in
    complete|completed)
      printf '%s' "$RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const m=(j.status_messages||[]).reverse().find(m=>m?.content?.content?.type==='text_block'&&m.content.content.text?.length>500);console.log('Status: complete\n\n'+(m?m.content.content.text:JSON.stringify(j,null,2))+'\n\n---\n[View full report on GREP](https://grep.ai/research/'+process.env.JOB_ID+')')}"
      rm -f "$CONTEXT_FILE"
      exit 0;;
    failed|error) echo "Job failed: $RESP" >&2; rm -f "$CONTEXT_FILE"; exit 1;;
  esac
  sleep 15
done
echo "Timed out. Resume with /grep-status $JOB_ID" >&2
rm -f "$CONTEXT_FILE"
exit 2
```

**IMPORTANT:** invoke this bash command with a tool `timeout` of `560000` ms (560 seconds). Claude Code's bash caps at 10 min; `540s` server wait + 20s slack = 560s.

If Monitor is available, run with `2>&1` so status messages stream as events alongside the final report.

## CRITICAL: Always deliver results

Whether the command runs via Monitor, blocking Bash, or gets backgrounded — when completion fires, you MUST read the output, extract, and present the research report. Never silently drop a completed job.

## If the job times out

Exit code 2 means the server is still running. The `job_id` was printed to stderr. Tell the user "Research is still running (job: {job_id}). I'll check back in a minute" and use `/grep-status` to retrieve the final report.

## Anti-patterns

- Do NOT default to `/ultra-research`. Start here.
- Do NOT re-submit the same query if a previous job is running — use `/grep-status`.
- Do NOT use the default 120s bash timeout.
- Do NOT skip `get_token` — expired JWTs will 401 without refresh.
