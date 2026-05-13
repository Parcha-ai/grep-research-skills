# Deep Research

GREP's standard research tier. Typically takes **around 5 minutes** (range: 2-9 minutes). Single blocking command handles submission, polling, and report delivery. The canonical choice for most research tasks.

## Before starting

Tell the user: "Deep research typically takes around 5 minutes. I'll stream live updates as they come in."

## Step 1: Clarify (if needed)

Apply the **99% rule**: if 99 random people typed this exact query, would they all want the same research? If yes, proceed. If no, ask 1-2 clarification questions via **AskUserQuestion**.

**When to clarify:**
- Ambiguous entities: "research Conductor" — the npm library? The orchestration tool? The music role?
- Vague scope: "research authentication" — for what platform? What auth method? What threat model?
- Missing context: "research the API" — which API? What operations? What language/SDK?

**When to skip:**
- Specific queries: "research Stripe Connect Express account onboarding flow"
- Clear context: the conversation already established what they're working on
- Quick lookups: factual questions with obvious intent

**Question format:**
- Keep to 1-2 questions maximum
- Provide 2-4 concrete options based on likely interpretations

## Step 2: Gather context

Gather relevant codebase context using the shared context pattern from the router SKILL.md. Additionally, include:

**Relevant existing code** — if the user is researching how to do X and they already have code that does something related, include it. This tells GREP what patterns, libraries, and conventions are in play.

**Conversation context** — if the user has been discussing a specific problem, summarise the key constraints and decisions as free text at the top of the context file.

**How to decide what's relevant:** Ask yourself: "If a human researcher were doing this for me, what would I want them to know about my project to give the most useful answer?"

- Researching "Redis caching patterns" -> include existing cache code, config, and which Redis client is installed
- Researching "Stripe webhook verification" -> include existing Stripe integration code and middleware patterns
- Researching "history of the Roman Empire" -> skip context, it's not code-related

## Step 3: Refine the query

Don't pass the user's raw query verbatim — enrich it based on context and any clarification answers.

Example:
- Raw: "Descope CLI auth bridging"
- Refined: "How to bridge Descope web browser authentication with a CLI terminal session. Specifically: does Descope support OAuth device flow (RFC 8628), enchanted links for cross-device auth, or session token transfer? We currently use Descope OTP with raw fetch to api.descope.com. Need REST API endpoints, not SDK-only solutions."

The refined query should include:
- The specific question (not just a topic)
- What form of answer is most useful (endpoints, code patterns, comparisons, etc.)
- Any constraints (language, framework, existing patterns to match)

## Step 4: Run the research

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/grep-api.js" run "<refined_query>" --max-wait=540 --context-file="$CONTEXT_FILE" 2>&1
```

Run with **Monitor** (`timeout_ms: 560000`, `persistent: false`). The command writes live status updates to stderr and the final report to stdout. With `2>&1` both streams merge so Monitor captures everything.

Tell the user: "Research submitted — I'll stream updates as they come in. This takes about 5 minutes."

Clean up after: `rm -f "$CONTEXT_FILE"`

## Step 5: Present results

When Monitor completes, **you MUST read and present the report.** Never silently drop a completed research job.

1. Lead with the key answer or insight
2. Organise by theme or relevance
3. Preserve source citations from the report
4. Note any conflicting information
5. Add a confidence assessment based on source quality

**When using research to inform code:** don't just dump the report. Extract the concrete facts you need (endpoint URLs, header names, auth formats, required fields, etc.), note which sources back them, and THEN write the code.

## Fallback: blocking Bash

Only if Monitor is genuinely unavailable:

```bash
node "$SCRIPTS_DIR/grep-api.js" run "<refined_query>" --max-wait=540 --context-file="$CONTEXT_FILE"
```

Set Bash `timeout` to `560000`. The `--max-wait=540` leaves 20s of slack.

## If the job times out

Exit code 2 means the server is still running. The JSON payload includes a `job_id`. Tell the user "Research is still running (job: {job_id}). I'll check back in a minute" and use the status workflow to retrieve the final report.

## Anti-patterns

- Do NOT default to ultra research — it's slower and heavier. Start here.
- Do NOT re-submit the same query if a previous job is still running — use status to check.
- Do NOT invoke Bash with the default 120s timeout — it WILL be killed mid-research.
- Do NOT skip research and guess API shapes from memory when the cost is a 2-minute call.
