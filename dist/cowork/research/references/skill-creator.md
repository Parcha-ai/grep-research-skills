# Skill Creator

Create a new SKILL.md file for an AI agent skill, informed by deep research on the target domain. Gathers requirements, researches the relevant APIs/tools/patterns, then generates a complete skill file.

## Step 1: Understand what the user wants

The user's initial input is a rough description. Clarify with **AskUserQuestion** (combine into 1-2 questions):

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

Using the research findings AND the reference file patterns, write a complete SKILL.md following these 6 quality patterns:

### Pattern 1: Description tells Claude WHEN, not just WHAT

Include at least 3 trigger keywords/phrases. Front-load the use case in the first 250 characters. State both what the skill does AND when to use it. Aim for 100-250 characters.

### Pattern 2: Be directive, not conversational

Use imperative verbs and numbered steps. Skills are instructions, not chat.

### Pattern 3: Specify the output format explicitly

Tell Claude exactly what the output should look like. Without this, output varies every run.

### Pattern 4: Include a "read first" step

Before generating or modifying anything:
1. Read the target files to understand existing patterns
2. Find existing examples in the project
3. Identify the framework/tooling in use
4. Match import style, naming conventions, and patterns

### Pattern 5: Define what the skill does NOT do

Explicitly list what's out of scope. This prevents Claude from trying and failing.

### Pattern 6: Keep it under 500 lines

Target under 300 lines. Hard cap at 500. If it's getting long, split into supporting files loaded on demand.

### Structural conventions

- Frontmatter with `name` and `description` (following Pattern 1)
- Title and overview (1-2 sentences)
- Numbered steps with bash code blocks
- User interaction via AskUserQuestion
- Out of scope section
- Anti-patterns section

## Step 5: Present and ask where to save

Show the generated SKILL.md, then use **AskUserQuestion**:

- Header: "Save skill"
- Question: "Where should I save this skill?"
- Options:
  - "This project" — "Save to ./skills/<name>/SKILL.md"
  - "Claude Code skills" — "Save to ~/.claude/skills/<name>/SKILL.md (available globally)"
  - "Just show me" — "Don't save, I'll copy it myself"

## Anti-patterns

- Do NOT skip clarification — a vague brief produces a vague skill
- Do NOT generate a skill without researching first — the whole point is research-informed accuracy
- Do NOT invent API endpoints or CLI flags from memory — use what the research returns
- Do NOT create skills over 500 lines — target under 300
- Do NOT write descriptions under 50 characters — short descriptions get invoked 3-5x less
- Do NOT use conversational tone in the skill body — use imperative verbs and numbered steps
- Do NOT skip the "Out of Scope" section — it prevents Claude from trying and failing
