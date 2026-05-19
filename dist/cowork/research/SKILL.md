---
name: research
description: Deep research powered by GREP — investigate APIs, libraries, companies, markets, and any topic with sourced citations. Use when you need to research something, fact-check a claim, plan an implementation with real docs, create a new skill, check GREP account status, or upgrade your plan. Trigger on: "research", "look up", "investigate", "fact check", "what's the best way to", "how does X work", "find out about", "GREP", or any task where knowing current facts would improve the outcome. Use proactively before writing code against unfamiliar APIs.
---

# GREP Research

One skill, multiple research modes. Routes to the right workflow based on what the user needs.

## Script path

Scripts are bundled directly in this skill directory:

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
```

## Auto-update check

On first use per session, silently check for updates (throttled to once per hour):

```bash
node "${CLAUDE_SKILL_DIR}/scripts/update-check.js" 2>/dev/null &
```

Run in background — must never delay the user.

## Auth gate

Before any operation, verify the user is authenticated:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/auth.js" status
```

If `"authenticated": false`, **do not tell the user to log in** — instead, read `${CLAUDE_SKILL_DIR}/references/login.md` and execute that workflow automatically. Resume the original request once authenticated.

## Intent routing

Determine what the user wants, then read the matching reference file for the detailed workflow. **Read exactly one reference file per invocation** — do not load them all.

### Route 1: Deep research (DEFAULT)

**Read:** `${CLAUDE_SKILL_DIR}/references/deep.md`

**When:** This is the default. Use for any research request that doesn't clearly match another route. "Research X", "look up X", "investigate X", "what's the deal with X", "how does X work". Roughly 5 minutes.

### Route 2: Quick fact check

**Read:** `${CLAUDE_SKILL_DIR}/references/quick.md`

**When:** The user wants a fast, simple answer — not a deep dive. Cues: "quick", "fast", "just check", "what version is", "is X still supported", simple factual questions. About 25 seconds.

### Route 3: Exhaustive investigation

**Read:** `${CLAUDE_SKILL_DIR}/references/ultra.md`

**When:** The user explicitly wants exhaustive coverage and is willing to wait up to an hour. Cues: "exhaustive", "thorough", "everything about", "security audit", "legal research", "full survey", "leave no stone unturned". Use sparingly.

### Route 4: Research-informed planning

**Read:** `${CLAUDE_SKILL_DIR}/references/plan.md`

**When:** The user wants to research before building — they need best practices, architecture patterns, or API docs to inform an implementation plan. Cues: "plan", "before I build", "best approach to", "how should I implement", "what's the right way to".

### Route 5: Create a new skill

**Read:** `${CLAUDE_SKILL_DIR}/references/skill-creator.md`

**When:** The user wants to build a new AI agent skill. Cues: "create a skill", "build a skill", "make a skill for X", "skill that does Y", "SKILL.md".

### Route 6: Account status / job check

**Read:** `${CLAUDE_SKILL_DIR}/references/status.md`

**When:** The user asks about their GREP account, recent jobs, or wants to check on a running research job. Cues: "status", "my account", "my jobs", "check on job", "recent research".

### Route 7: Upgrade / billing

**Read:** `${CLAUDE_SKILL_DIR}/references/upgrade.md`

**When:** The user wants to change their subscription, check pricing, or hit a quota limit. Cues: "upgrade", "plan", "pricing", "subscribe", "credits", "quota".

### Route 8: Login / auth

**Read:** `${CLAUDE_SKILL_DIR}/references/login.md`

**When:** The user explicitly asks to log in or authenticate. Also auto-triggered by the auth gate above on 401. Cues: "login", "authenticate", "connect my account", "API key".

## Shared: gathering codebase context

Routes 1, 4, and 5 benefit from sending codebase context alongside the research query. When the reference file calls for context gathering, use this pattern:

```bash
CONTEXT_FILE=$(mktemp /tmp/grep-research-context.XXXXXX)

# Project conventions
if [ -f CLAUDE.md ]; then
  echo "=== PROJECT CONVENTIONS (CLAUDE.md) ===" >> "$CONTEXT_FILE"
  head -60 CLAUDE.md >> "$CONTEXT_FILE"
  echo "" >> "$CONTEXT_FILE"
fi

# Package manifest (tells GREP what stack you're on)
for manifest in package.json pyproject.toml requirements.txt Cargo.toml go.mod; do
  if [ -f "$manifest" ]; then
    echo "=== $manifest ===" >> "$CONTEXT_FILE"
    head -40 "$manifest" >> "$CONTEXT_FILE"
    echo "" >> "$CONTEXT_FILE"
  fi
done
```

Additionally, read any files directly relevant to the research topic (existing integration code, config files, etc.) and append them to `$CONTEXT_FILE`. Use your judgement — if the user is researching "Stripe webhooks" and there's a `payments/` directory, include those files.

Always clean up after: `rm -f "$CONTEXT_FILE"`

## Shared: execution pattern

**Always use Monitor for research commands, never blocking Bash.** Research takes minutes. Blocking Bash ties up the agent, prevents interaction, and risks timeout. Monitor runs in the background and streams live updates.

- Deep research: Monitor with `timeout_ms: 560000`
- Quick research: Monitor with `timeout_ms: 80000`
- Ultra research: non-blocking submit, then `/loop` polling (see ultra.md)

When Monitor completes, **always read the output and present results to the user.** A research job that completes without presenting results is a failed mission.

## Presenting results

1. Lead with the key answer or insight
2. Organise by theme or relevance
3. Preserve source citations from the report
4. Note any conflicting information
5. When using research to inform code: extract concrete facts (endpoints, auth formats, required fields) before writing code — don't just dump the report

## Anti-patterns

- Do NOT load multiple reference files at once — route to exactly one
- Do NOT default to ultra research — start with deep, escalate only if genuinely needed
- Do NOT skip auth check — unauthenticated calls waste time with cryptic errors
- Do NOT use blocking Bash for research commands — always Monitor (or background submit for ultra)
- Do NOT re-submit a query if a previous job is still running — use status to retrieve it
