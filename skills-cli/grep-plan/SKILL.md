---
name: grep-plan
description: Research-informed planning. Uses GREP deep research to investigate best practices, API docs, and architectural patterns before you plan an implementation. Use when planning a new feature, API integration, refactoring, or any non-trivial implementation where research would improve the plan.
---

# GREP Plan — Research Before You Build

Run deep research on a topic with your codebase as context, so the subsequent plan is informed by real documentation, best practices, and known gotchas — not just what the model remembers from training.

## When to use this

Use `/grep-plan` instead of jumping straight into `/plan` when:
- Integrating an unfamiliar API or SDK
- Adopting a new library or framework
- Designing auth flows, payment systems, or security-sensitive features
- Working with protocols you haven't used recently (WebSockets, gRPC, OAuth2, etc.)
- Any task where guessing wrong means hours of debugging

## Prerequisite

`brain` CLI on `$PATH`. Run `npx grep-research-skills` once if missing.

## Step 1: Clarify the request

Before researching, make sure you understand what the user actually needs. Apply the **99% rule**: if 99 random developers gave this same instruction, would they all mean the same thing? If yes, skip to Step 2. If no, ask clarification questions.

Use **AskUserQuestion** with 1-2 focused questions. Common clarifications:

**Scope:** "What specific aspect should I focus the research on?"
- Example for "add caching": Options might be "Redis/Memcached patterns", "HTTP cache headers", "Database query caching", "CDN/edge caching"

**Constraints:** "Are there any constraints I should know about?"
- Example: "Must use existing infrastructure", "Needs to work with our current auth", "Has to support offline mode"

**Output preference:** "What kind of research output would be most useful for your plan?"
- "Architecture and design patterns" — high-level system design
- "Step-by-step implementation guide" — concrete code-level instructions
- "Comparison of approaches" — trade-off analysis between options

**Skip clarification when:**
- The user's request is already very specific (e.g., "integrate Stripe Connect with Express accounts using OAuth")
- The topic is unambiguous and the scope is clear
- The user has provided detailed requirements in their message

Incorporate the user's answers into the research question you'll compose in Step 3.

## Step 2: Gather codebase context

Before calling the API, collect context about the user's project so GREP can tailor its research. Write everything to a temp file:

```bash
CONTEXT_FILE=$(mktemp /tmp/grep-plan-context.XXXXXX)
```

Collect these (skip any that don't exist — not every project has all of them):

```bash
# Project instructions and conventions
if [ -f CLAUDE.md ]; then
  echo "=== PROJECT INSTRUCTIONS (CLAUDE.md) ===" >> "$CONTEXT_FILE"
  head -100 CLAUDE.md >> "$CONTEXT_FILE"
  echo "" >> "$CONTEXT_FILE"
fi

# Project structure (top-level overview)
echo "=== PROJECT STRUCTURE ===" >> "$CONTEXT_FILE"
find . -maxdepth 3 -type f \
  -not -path '*/node_modules/*' \
  -not -path '*/.git/*' \
  -not -path '*/dist/*' \
  -not -path '*/__pycache__/*' \
  -not -path '*/.next/*' \
  | head -80 >> "$CONTEXT_FILE"
echo "" >> "$CONTEXT_FILE"

# Package manifest (dependencies tell GREP what stack you're on)
for manifest in package.json pyproject.toml requirements.txt Cargo.toml go.mod; do
  if [ -f "$manifest" ]; then
    echo "=== $manifest ===" >> "$CONTEXT_FILE"
    head -60 "$manifest" >> "$CONTEXT_FILE"
    echo "" >> "$CONTEXT_FILE"
  fi
done

# Recent git activity (what's been changing)
echo "=== RECENT GIT HISTORY ===" >> "$CONTEXT_FILE"
git log --oneline -15 2>/dev/null >> "$CONTEXT_FILE" || true
echo "" >> "$CONTEXT_FILE"
```

**Additionally**, if the user's topic mentions specific files, modules, or areas of the codebase, read those files and append them to `$CONTEXT_FILE` too. The more relevant context GREP has, the better the research.

Use your judgement — if the user says "integrate Stripe webhooks" and there's already a `payments/` directory, read those files. If they say "add Redis caching" and there's a `cache.py`, include it.

## Step 3: Compose the research question

Build a research question that will produce actionable findings for planning. The question should be specific and include what the user needs to know to make good implementation decisions.

**Template:**

> "Best practices, architecture patterns, and implementation guide for [TOPIC]. Include: recommended approaches, API endpoints and authentication, common pitfalls and how to avoid them, error handling patterns, and any recent breaking changes or deprecations. Focus on production-ready patterns, not toy examples."

Adapt the template to the specific topic. For example:
- API integration: emphasize auth flows, rate limits, webhook handling, error codes
- Library adoption: emphasize version-specific APIs, migration paths, known issues
- Architecture: emphasize trade-offs, scaling considerations, data model design

## Step 4: Run the research

```bash
brain research submit "<research_question>" --depth deep --wait --timeout 540 --context-file "$CONTEXT_FILE" 2>&1
```

Use Monitor with `timeout_ms: 560000` if available, otherwise fall back to blocking Bash with `timeout: 560000`.

Tell the user before starting: "Researching [topic] with your codebase as context. This typically takes around 5 minutes."

## Step 5: Clean up

```bash
rm -f "$CONTEXT_FILE"
```

## Step 6: Present findings and suggest next steps

Once the research completes:

1. **Lead with the key findings** — what the user most needs to know for planning
2. **Highlight gotchas** — anything that would change the implementation approach
3. **Note version-specific details** — exact API versions, required headers, auth formats
4. **Preserve citations** — keep source URLs so the user can verify

Then tell the user:

> "Research complete. You can now run `/plan` to design your implementation — the findings above should inform your approach. Key things to keep in mind: [2-3 bullet points from the research]."

## Anti-patterns

- Do NOT skip the context gathering — sending codebase context is the whole point of this skill vs plain `/research`
- Do NOT use `/grep-plan` for quick factual lookups — use `/quick-research` for those
- Do NOT enter plan mode automatically — present the research and let the user decide when to plan
- Do NOT truncate the research output — the user needs the full findings to plan well
