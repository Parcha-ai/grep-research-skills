---
name: research
description: Deep research via GREP (typically ~5 minutes) with sourced citations. Use for most research tasks — investigating APIs/libraries before writing code, company research, market analysis, verifying complex claims, comprehensive docs lookups, fact-checking with sources. ALSO use proactively when planning to write code against unfamiliar APIs, SDKs, protocols, or libraries — sourced research beats guessing from memory. Use /quick-research (~25s) for simple lookups, or /ultra-research (up to 1 hour) for exhaustive investigations.
---

# Deep Research (deep)

GREP's standard research tier. Typically takes **around 5 minutes** end-to-end (range: 2-9 minutes). Single blocking command handles submission, polling, and report delivery. The canonical choice for most research tasks.

## Tell the user about the wait

**Before running**, tell the user: "Deep research typically takes around 5 minutes. I'll stream live updates as they come in."

Research isn't instant. Set expectations so the user doesn't think the agent is stuck.

## When to use this skill vs the others

| Skill | Time | Use when |
|-------|------|----------|
| `/quick-research` | ~25s | Quick fact, version check, simple lookup |
| **`/research`** (you are here) | ~5 min | Default for most research tasks |
| `/ultra-research` | up to 1 hour | Security audits, legal research, exhaustive investigations |

**Default to this skill.** Escalate to `/ultra-research` only if you genuinely need exhaustive coverage. Drop to `/quick-research` only if you just need a one-liner answer.

## When to use research for code planning

Reach for `/research` whenever you're about to write code against something unfamiliar:

- **Unfamiliar APIs or SDKs** — before writing integration code, research current docs, auth flows, rate limits, and gotchas.
- **New libraries or frameworks** — pull real usage patterns, version-specific changes, and known footguns.
- **Protocols and standards** — OAuth flows, webhook signatures, MCP, CDP, WebRTC, etc.
- **Obscure file formats or data structures** — binary formats, custom serializations, undocumented JSON shapes.
- **Cross-cutting concerns** — security best practices, performance characteristics, compatibility matrices.
- **Recent changes** — anything that might have changed since the model's training cutoff.

**Rule of thumb:** if you'd normally guess, research instead. A 2-minute research call prevents 30 minutes of debugging bad assumptions.

## Clarify before researching

Before submitting the query, apply the **99% rule**: if 99 random people typed this exact query, would they all want the same research? If yes, proceed directly. If no, ask 1-2 clarification questions using **AskUserQuestion**.

**When to clarify:**
- Ambiguous entities: "research Conductor" — the npm library? The orchestration tool? The music role?
- Vague scope: "research authentication" — for what platform? What auth method? What threat model?
- Missing context: "research the API" — which API? What operations? What language/SDK?

**When to skip clarification:**
- Specific queries: "research Stripe Connect Express account onboarding flow"
- Clear context: the conversation already established what they're working on
- Quick lookups: factual questions with obvious intent

**Question format:**
- Header: "Research scope" (or "Clarification")
- Keep to 1-2 questions maximum — don't interrogate
- Provide 2-4 concrete options based on likely interpretations, plus "Other" (automatic)
- If the user's query is ambiguous in multiple ways, combine into a single multi-aspect question rather than asking serially

Incorporate the user's answers into the query you pass to the research command.

## Gather context (makes research 10x more actionable)

Before submitting, gather relevant context from the codebase and conversation to send alongside the query. The GREP API accepts a `context` field — this is the difference between getting a generic blog-post answer vs. getting implementation-ready specifics tailored to the user's stack.

**Always gather context when the research is for code/implementation.** Skip context only for pure factual lookups (e.g., "what year was React released?").

```bash
CONTEXT_FILE=$(mktemp /tmp/grep-research-context.XXXXXX)
```

### What to include:

**1. Relevant existing code** — if the user is researching how to do X and they already have code that does something related, include it. This tells GREP what patterns, libraries, and conventions are in play.

Example: researching "Descope device flow for CLI auth" → include the existing `auth.js` that already does Descope OTP. GREP will return endpoints and code that match the existing implementation style.

```bash
# Read files directly related to the research topic
cat path/to/relevant/file.js >> "$CONTEXT_FILE"
```

**2. Project stack** — dependencies and manifest so GREP knows what language/framework/versions to target.

```bash
for manifest in package.json pyproject.toml requirements.txt Cargo.toml go.mod; do
  if [ -f "$manifest" ]; then
    echo "=== $manifest ===" >> "$CONTEXT_FILE"
    head -40 "$manifest" >> "$CONTEXT_FILE"
    echo "" >> "$CONTEXT_FILE"
  fi
done
```

**3. Project conventions** — CLAUDE.md or similar config files.

```bash
if [ -f CLAUDE.md ]; then
  echo "=== PROJECT CONVENTIONS ===" >> "$CONTEXT_FILE"
  head -60 CLAUDE.md >> "$CONTEXT_FILE"
  echo "" >> "$CONTEXT_FILE"
fi
```

**4. Conversation context** — if the user has been discussing a specific problem, summarise the key constraints, decisions, and relevant details as free text at the top of the context file.

### How to decide what's relevant:

Use your judgement. Ask yourself: "If a human researcher were doing this research for me, what would I want them to know about my project to give me the most useful answer?"

- Researching "Redis caching patterns" → include existing cache code, config, and which Redis client is installed
- Researching "Stripe webhook verification" → include existing Stripe integration code, webhook handler, and Express/Fastify middleware patterns
- Researching "best testing framework for Vue 3" → include package.json and existing test files
- Researching "history of the Roman Empire" → skip context, it's not code-related

### Refine the query

Based on the context you've gathered and any clarification answers, **refine the raw query** into a more specific research question. Don't just pass through `$ARGUMENTS` verbatim — enrich it.

Example:
- Raw: "Descope CLI auth bridging"
- Refined: "How to bridge Descope web browser authentication with a CLI terminal session. Specifically: does Descope support OAuth device flow (RFC 8628), enchanted links for cross-device auth, or session token transfer? We currently use Descope OTP (project ID P38Xct9AhA95T0MU5T8g7o9V9886) with raw fetch to api.descope.com. Need REST API endpoints, not SDK-only solutions."

The refined query should include:
- The specific question (not just a topic)
- What form of answer is most useful (endpoints, code patterns, comparisons, etc.)
- Any constraints (language, framework, existing patterns to match)

## Advanced flags (use only when the user explicitly asks)

`grep-api.js run` accepts these optional flags to shape the research:

| Flag | Effect |
|---|---|
| `--project=projects/<name>` | Run under an SOP-driven project (`SOP.md` becomes the agent's system prompt). See `/grep-projects`. |
| `--expert=<expert_id>` | Use a built-in or custom expert persona. See `/grep-experts`. |
| `--language=<en\|es\|fr\|...>` | Response language (ISO 639-1). |
| `--from-date=YYYY-MM-DD --to-date=YYYY-MM-DD` | Constrain content by date range. |
| `--additional-thesis="<text>"` | Extra thesis to explore alongside the main question. |
| `--website=<url>` | Anchor research around a specific website. |
| `--custom-skills=skill1,skill2` | Inject user-defined skills into the research pipeline. |
| `--custom-mcp-tools=tool1,tool2` | Inject custom MCP tools. |
| `--skip-clarification` | Bypass clarification questions (use only for fully-specified queries). |

Most queries don't need any of these — only reach for them when the user's intent clearly calls for them (e.g. they say "use my medical-expert", "limit to 2024", "respond in Spanish", etc.).

## Prerequisites

The user must be authenticated. If the command errors with "Not authenticated", tell them to run `/grep-login` first.

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Run it (preferred: Monitor for live streaming)

If the Monitor tool is available, use it to stream live status updates to the user while the research runs. This is the preferred approach — the user sees what the agent is thinking, searching, and reading in real time instead of staring at silence for 5 minutes.

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
node "$SCRIPTS_DIR/grep-api.js" run "<refined_query>" --max-wait=540 --context-file="$CONTEXT_FILE" 2>&1
```

**Clean up after the research completes:**
```bash
rm -f "$CONTEXT_FILE"
```

Use Monitor with `timeout_ms: 560000` and `persistent: false`. The command writes live status updates (thinking, searching, tool use) to stderr and the final report to stdout. With `2>&1` both streams are merged so Monitor captures everything.

When the Monitor completes, the final report will be in the output. Read the output file with the Read tool and present the results to the user immediately.

## CRITICAL: Always deliver results

Whether the command runs via Monitor, blocking Bash, or gets backgrounded by the user — when the task/background notification arrives saying it completed, you MUST:

1. Read the output file from the task notification
2. Extract and present the research report to the user
3. Never silently drop a completed research job

The user invoked `/research` because they need an answer. A research job that completes without presenting results is a failed mission.

## Run it (fallback: blocking Bash)

If Monitor is not available, fall back to blocking Bash:

```bash
node "$SCRIPTS_DIR/grep-api.js" run "<refined_query>" --max-wait=540 --context-file="$CONTEXT_FILE"
```

Clean up after: `rm -f "$CONTEXT_FILE"`

**IMPORTANT:** Invoke this bash command with a tool `timeout` of exactly `560000` (560 seconds / ~9.3 min). That's the maximum headroom you can give — Claude Code's bash tool caps at 10 minutes (600000). The `--max-wait=540` leaves 20s of slack for Node to print results and exit cleanly before bash would kill it.

If research takes longer than 9 minutes (uncommon but possible for complex queries), the command exits with code 2 and returns a `job_id`. See "If the job times out" below.

The command prints heartbeats and live status messages to stderr while polling (what the research agent is thinking, searching, reading). Share these updates with the user as they arrive so they can follow the research in real time. The final report prints to stdout when complete.

## Presenting results

The report comes back with headings, structure, and citations. Present it cleanly:

1. Lead with the key answer or insight
2. Organise by theme or relevance
3. Preserve source citations from the report
4. Note any conflicting information
5. Add a confidence assessment based on source quality

**When using research to inform code you're about to write:** don't just dump the report. Extract the concrete facts you need (endpoint URLs, header names, auth formats, required fields, etc.), note which sources back them, and THEN write the code with those facts in hand.

## If the job times out

Exit code 2 means the server is still running. The JSON payload includes a `job_id`. Tell the user "Research is still running (job: {job_id}). I'll check back in a minute" and use `/grep-status` with the job ID to retrieve the final report, or rerun in a minute.

## Anti-patterns

- Do NOT default to `/ultra-research` — it's slower and heavier. Start here.
- Do NOT re-submit the same query if a previous job is still running — use `/grep-status` to pick up where you left off.
- Do NOT invoke the bash command with the default 120s timeout — it WILL be killed mid-research.
- Do NOT skip research and guess API shapes from memory when the cost is a 2-minute call.
