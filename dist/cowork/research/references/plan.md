# Research-Informed Planning

Run deep research on a topic with your codebase as context, so the subsequent plan is informed by real documentation, best practices, and known gotchas — not just model memory.

## When to use

Use instead of jumping straight into planning when:
- Integrating an unfamiliar API or SDK
- Adopting a new library or framework
- Designing auth flows, payment systems, or security-sensitive features
- Working with protocols you haven't used recently (WebSockets, gRPC, OAuth2, etc.)
- Any task where guessing wrong means hours of debugging

## Step 1: Clarify the request

Apply the **99% rule**: if 99 random developers gave this same instruction, would they all mean the same thing? If yes, skip to Step 2. If no, ask 1-2 clarification questions via **AskUserQuestion**.

Common clarifications:

**Scope:** "What specific aspect should I focus the research on?"
- Example for "add caching": Options might be "Redis/Memcached patterns", "HTTP cache headers", "Database query caching", "CDN/edge caching"

**Constraints:** "Are there any constraints I should know about?"
- Example: "Must use existing infrastructure", "Needs to work with our current auth"

**Output preference:** "What kind of research output would be most useful for your plan?"
- "Architecture and design patterns" — high-level system design
- "Step-by-step implementation guide" — concrete code-level instructions
- "Comparison of approaches" — trade-off analysis between options

Skip clarification when the request is already very specific or the user has provided detailed requirements.

## Step 2: Gather codebase context

Use the shared context pattern from the router SKILL.md, plus these additional signals:

```bash
CONTEXT_FILE=$(mktemp /tmp/grep-plan-context.XXXXXX)

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

# Recent git activity
echo "=== RECENT GIT HISTORY ===" >> "$CONTEXT_FILE"
git log --oneline -15 2>/dev/null >> "$CONTEXT_FILE" || true
echo "" >> "$CONTEXT_FILE"
```

Additionally, if the user's topic mentions specific files or modules, read those and append them to `$CONTEXT_FILE`. The more relevant context GREP has, the better the research.

## Step 3: Compose the research question

Build a question that will produce actionable findings for planning:

> "Best practices, architecture patterns, and implementation guide for [TOPIC]. Include: recommended approaches, API endpoints and authentication, common pitfalls and how to avoid them, error handling patterns, and any recent breaking changes or deprecations. Focus on production-ready patterns, not toy examples."

Adapt based on the topic:
- API integration: emphasise auth flows, rate limits, webhook handling, error codes
- Library adoption: emphasise version-specific APIs, migration paths, known issues
- Architecture: emphasise trade-offs, scaling considerations, data model design

## Step 4: Run the research

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/grep-api.js" run "<research_question>" --depth=deep --max-wait=540 --context-file="$CONTEXT_FILE" 2>&1
```

Run with **Monitor** (`timeout_ms: 560000`, `persistent: false`). Tell the user: "Researching [topic] with your codebase as context. This typically takes around 5 minutes."

Clean up after: `rm -f "$CONTEXT_FILE"`

## Step 5: Present findings and suggest next steps

1. **Lead with key findings** — what the user most needs to know for planning
2. **Highlight gotchas** — anything that would change the implementation approach
3. **Note version-specific details** — exact API versions, required headers, auth formats
4. **Preserve citations** — keep source URLs so the user can verify

Then tell the user:

> "Research complete. You can now run `/plan` to design your implementation — the findings above should inform your approach. Key things to keep in mind: [2-3 bullet points from the research]."

## Anti-patterns

- Do NOT skip context gathering — sending codebase context is the whole point of this workflow vs plain deep research
- Do NOT use this for quick factual lookups — use quick research for those
- Do NOT enter plan mode automatically — present the research and let the user decide when to plan
- Do NOT truncate the research output — the user needs the full findings to plan well
