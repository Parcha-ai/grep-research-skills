---
name: grep-plan
description: Research-informed planning via GREP (API flavour). Investigates best practices, architecture patterns, and implementation guides for the user's request using the GREP deep research API, gathers codebase context to make the research actionable, and delivers findings structured for planning. Use when the user is about to write code against something unfamiliar and would benefit from ~5 minutes of sourced research before committing to a plan.
---

# GREP Plan — API flavour

Deep-research-informed planning. Same shape as `/research` but:

1. Gathers project context first (CLAUDE.md, manifests, git history, topic-relevant files).
2. Composes a "best practices, architecture, pitfalls" framing around the user's request.
3. Submits with `context` populated so GREP's answer is actionable for *this* codebase.

## When to use

When the user says things like:

- "I need to add X — help me plan it"
- "Research Redis caching patterns for our setup, then we'll plan"
- "I'm about to integrate Stripe Connect — what should I know first?"

Reach for this before `/plan` / `/plan:write` when the topic touches unfamiliar APIs, libraries, or protocols.

## Prerequisite

Load the `get_token` helper from `/grep-api-reference`. User must be logged in via `/grep-login`.

## Step 1: Clarify

Apply the **99% rule** and use AskUserQuestion for 1-2 scope/constraints/output-preference questions if needed. Skip if the request is already specific.

## Step 2: Gather context

```bash
CONTEXT_FILE=$(mktemp /tmp/grep-plan-context.XXXXXX)

[ -f CLAUDE.md ] && { echo "=== PROJECT INSTRUCTIONS (CLAUDE.md) ===" >> "$CONTEXT_FILE"; head -100 CLAUDE.md >> "$CONTEXT_FILE"; echo "" >> "$CONTEXT_FILE"; }

echo "=== PROJECT STRUCTURE ===" >> "$CONTEXT_FILE"
find . -maxdepth 3 -type f \
  -not -path '*/node_modules/*' -not -path '*/.git/*' \
  -not -path '*/dist/*' -not -path '*/__pycache__/*' -not -path '*/.next/*' \
  | head -80 >> "$CONTEXT_FILE"
echo "" >> "$CONTEXT_FILE"

for manifest in package.json pyproject.toml requirements.txt Cargo.toml go.mod; do
  [ -f "$manifest" ] && { echo "=== $manifest ===" >> "$CONTEXT_FILE"; head -60 "$manifest" >> "$CONTEXT_FILE"; echo "" >> "$CONTEXT_FILE"; }
done

echo "=== RECENT GIT HISTORY ===" >> "$CONTEXT_FILE"
git log --oneline -15 2>/dev/null >> "$CONTEXT_FILE" || true
```

Additionally, if the user's topic names specific files or modules, read those and append them to `$CONTEXT_FILE` too.

## Step 3: Compose a planning-shaped question

**Template:**

> "Best practices, architecture patterns, and implementation guide for [TOPIC]. Include: recommended approaches, API endpoints and authentication, common pitfalls and how to avoid them, error handling patterns, and any recent breaking changes or deprecations. Focus on production-ready patterns, not toy examples."

Adapt for the specific topic (API integration → auth flows / rate limits / webhooks; library adoption → version-specific APIs / migration paths; architecture → trade-offs / scaling).

## Step 4: Submit + poll

Use the same submit+poll pattern as `/research`'s API-flavour skill, with `depth: "deep"` and `context` set to the contents of `$CONTEXT_FILE`. Optionally set `project` to an expert workspace path if the user has an SOP there.

Tell the user before starting: "Researching [topic] with your codebase as context. This typically takes around 5 minutes."

## Step 5: Clean up

```bash
rm -f "$CONTEXT_FILE"
```

## Step 6: Present findings and next steps

Structure the output for planning:

1. **Summary** of what GREP found
2. **Recommended approach** (pick one; explain why)
3. **Open questions** that need the user's input before the plan is actionable
4. **Suggested plan outline** — let the user refine or hand off to `/plan`

## Anti-patterns

- Do NOT skip the context-gathering step for code tasks. Sourced-but-generic is less useful than sourced-and-tailored.
- Do NOT block-wait longer than 9 minutes. If the job overshoots, return the `job_id` and tell the user you'll check back.
