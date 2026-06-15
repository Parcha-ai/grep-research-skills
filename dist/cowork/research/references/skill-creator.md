# Skill Creator

Create a new SKILL.md file for an AI agent skill, informed by deep research on the target domain. The process: capture intent → research the domain → write the skill → test it → iterate.

## Step 1: Capture intent

The user's initial input is a rough description. Before researching, understand the skill well enough to write a targeted query.

**Check conversation context first.** If the user has been working through a workflow in this conversation and says "turn this into a skill", extract what you can from the conversation history: the tools used, the sequence of steps, corrections the user made, input/output formats observed. Present what you've gathered and confirm before proceeding.

If there's no conversation context to draw from, use **AskUserQuestion** to clarify (combine into 1-2 questions):

**Question 1 — Scope and target:**
- Header: "Skill scope"
- Question: "What should this skill do? Help me understand the core workflow."
- Options:
  - "API integration" — "Connect to an external API (e.g., Stripe, Twilio, GitHub)"
  - "CLI tool wrapper" — "Wrap a command-line tool for the agent (e.g., terraform, kubectl, ffmpeg)"
  - "Workflow automation" — "Multi-step workflow like deploy, test, or data pipeline"

**Question 2 — Technical details:**
- Header: "Details"
- Question: "What are the key technical details?"
- multiSelect: true
- Options:
  - "Needs authentication"
  - "Has async/long-running steps"
  - "Needs user interaction"
  - "Produces output files"

Skip questions if the user's description is already detailed enough.

## Step 2: Gather context

### 2a: Read example skills for reference

Read the router SKILL.md and 1-2 reference files from this skill to understand the format conventions.

### 2b: Gather codebase context (if for the current project)

Use the shared context pattern from the router, plus:

```bash
CONTEXT_FILE=$(mktemp /tmp/grep-skill-context.XXXXXX)

echo "=== USER REQUIREMENTS ===" >> "$CONTEXT_FILE"
# Write a summary of what the user wants based on Step 1

if [ -f CLAUDE.md ]; then
  echo "=== PROJECT CONVENTIONS (CLAUDE.md) ===" >> "$CONTEXT_FILE"
  head -80 CLAUDE.md >> "$CONTEXT_FILE"
fi
```

## Step 3: Research the domain

Compose a targeted research question:

> "Comprehensive implementation guide for [TOPIC]. I'm building an AI agent skill (a markdown instruction file) that will guide an LLM to perform this task step-by-step via bash commands and API calls. I need: (1) exact API endpoints, authentication methods, and request/response formats, (2) CLI commands with flags and expected output, (3) common error codes and how to handle them, (4) best practices and gotchas, (5) rate limits or usage constraints, (6) what's out of scope or commonly confused. Focus on non-interactive, scriptable approaches."

Run the research:

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/grep-api.js" run "<research_question>" --depth=deep --max-wait=540 --context-file="$CONTEXT_FILE" 2>&1
```

Run with **Monitor** (`timeout_ms: 560000`, `persistent: false`). Tell the user: "Researching [topic] to build an accurate skill. This takes about 5 minutes."

Clean up after: `rm -f "$CONTEXT_FILE"`

## Step 4: Generate the SKILL.md

Using the research findings AND the reference file patterns, write a complete SKILL.md. Follow these quality patterns:

### Description: tell Claude WHEN, not just WHAT

The description is the primary triggering mechanism. Claude tends to undertrigger — it won't use skills it could benefit from. Combat this by being slightly "pushy": include trigger keywords, specific contexts, and edge cases ("even if they don't explicitly ask for X").

- Include at least 3 trigger keywords/phrases a user would say
- Front-load the use case in the first 250 characters
- State both what the skill does AND when to use it
- Aim for 100-250 characters (under 50 gets invoked 3-5x less)

### Writing style

- **Be directive** — imperative verbs and numbered steps, not conversational
- **Explain the why** — instead of heavy-handed MUSTs in all caps, explain the reasoning. The model using this skill is smart; it produces better results when it understands context.
- **Be general, not overfitted** — write principles that work across many prompts, not rules tuned to one example
- **Specify output format** — tell Claude exactly what output should look like
- **Include a "read first" step** — read target files before generating or modifying anything
- **Define what's out of scope** — prevent Claude from trying and failing

### Progressive disclosure

- Target under 300 lines for the main SKILL.md, hard cap at 500
- If approaching the limit, split into SKILL.md + reference files with clear pointers
- For large reference files (>300 lines), include a table of contents

### Structural conventions

- Frontmatter with `name` and `description`
- Title and overview (1-2 sentences)
- Numbered steps with bash code blocks
- User interaction via AskUserQuestion
- Out of scope section
- Anti-patterns section

## Step 5: Test the skill

Before presenting, validate by thinking through 2-3 realistic test prompts — the kind of thing a real user would say. For each, mentally trace the skill's instructions:

1. Would the description trigger correctly?
2. Do the steps produce the right outcome?
3. Are there missing error handlers or edge cases?
4. Would a baseline (no skill) handle this just as well?

If issues surface, revise before presenting.

## Step 6: Optimise the description

Review the description against should-trigger and should-not-trigger prompts:

- **Should-trigger** (3-4 prompts): casual phrasings, indirect references, edge cases where this skill competes with others
- **Should-not-trigger** (2-3 prompts): near-miss queries that share keywords but need something different — genuinely tricky, not obviously irrelevant

Adjust the description if any prompt would be misrouted.

## Step 7: Present and ask where to save

Show the generated SKILL.md, then use **AskUserQuestion**:

- Header: "Save skill"
- Question: "Where should I save this skill?"
- Options:
  - "This project" — "Save to ./skills/<name>/SKILL.md"
  - "Claude Code skills" — "Save to ~/.claude/skills/<name>/SKILL.md (available globally)"
  - "Just show me" — "Don't save, I'll copy it myself"

## Iterating on an existing skill

If the user already has a skill and wants to improve it:

1. Read the existing skill
2. Ask what's not working — specific failures, missed triggers, wrong output
3. **Generalise from feedback** — don't overfit to the specific failing example
4. **Look for repeated work** — if test runs show the agent writing the same helper script every time, bundle it with the skill
5. Revise, test mentally, present the diff

## Anti-patterns

- Do NOT skip clarification — a vague brief produces a vague skill
- Do NOT generate a skill without researching first — the whole point is research-informed accuracy
- Do NOT invent API endpoints or CLI flags from memory — use what the research returns
- Do NOT create skills over 500 lines — target under 300, use reference files for overflow
- Do NOT write descriptions under 50 characters — short descriptions get invoked 3-5x less
- Do NOT use conversational tone in the skill body — use imperative verbs and numbered steps
- Do NOT skip the "Out of Scope" section — it prevents Claude from trying and failing
- Do NOT overfit to test examples — write general principles, not narrow rules
- Do NOT use heavy-handed ALWAYS/NEVER/MUST when explaining the reasoning would be more effective
