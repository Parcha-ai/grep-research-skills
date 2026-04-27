---
name: grep-skill-creator
description: Create a high-quality SKILL.md for any AI agent skill, powered by GREP deep research. Use when the user wants to build a new skill, plugin, or tool integration for Claude Code, Cowork, or OpenClaw. Researches the target domain first, then generates a production-ready skill file.
---

# GREP Skill Creator

Create a new SKILL.md file for an AI agent skill, informed by deep research on the target domain. This skill gathers requirements from the user, researches the relevant APIs/tools/patterns, then generates a complete skill file following established conventions.

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Step 1: Understand what the user wants

The user's initial input (`$ARGUMENTS`) is a rough description. Before doing anything, you need to understand the skill well enough to research it properly.

Use **AskUserQuestion** to clarify these aspects (combine into 1-2 questions, don't bombard them):

**Question 1 — Scope and target:**
- Header: "Skill scope"
- Question: "What should this skill do? Help me understand the core workflow."
- Options based on common patterns:
  - "API integration" — "Connect to an external API (e.g., Stripe, Twilio, GitHub)"
  - "CLI tool wrapper" — "Wrap a command-line tool for the agent (e.g., terraform, kubectl, ffmpeg)"
  - "Workflow automation" — "Multi-step workflow like deploy, test, or data pipeline"
  - Let the user pick "Other" for custom descriptions

**Question 2 — Technical details:**
- Header: "Details"
- Question: "What are the key technical details? (Select all that apply)"
- multiSelect: true
- Options:
  - "Needs authentication" — "The skill requires API keys, OAuth, or login"
  - "Has async/long-running steps" — "Some operations take minutes (builds, deploys, research)"
  - "Needs user interaction" — "The skill should ask the user questions mid-flow"
  - "Produces output files" — "Generates files, reports, or artifacts"

If the user's initial description is already very detailed and covers these aspects, you may skip the questions and proceed directly. Use your judgement — a vague "make a Vercel deploy skill" needs clarification; a detailed paragraph about exactly what the skill should do may not.

## Step 2: Gather context

### 2a: Read example skills for reference

Read 2-3 existing skills to understand the format. Good examples:

```bash
# A simple blocking skill (research)
cat "${CLAUDE_SKILL_DIR}/../research/SKILL.md"

# An interactive multi-step skill (grep-login)
cat "${CLAUDE_SKILL_DIR}/../grep-login/SKILL.md"

# A skill with plan selection (grep-upgrade)
cat "${CLAUDE_SKILL_DIR}/../grep-upgrade/SKILL.md"
```

Pick the examples most relevant to the type of skill being created.

### 2b: Gather codebase context (if creating a skill for the current project)

If the skill is for the user's current project (not a generic standalone skill), collect project context:

```bash
CONTEXT_FILE=$(mktemp /tmp/grep-skill-context.XXXXXX)

echo "=== EXISTING SKILL EXAMPLES ===" >> "$CONTEXT_FILE"
# Include 1-2 of the example skills read above (pick the most relevant pattern)

echo "=== USER REQUIREMENTS ===" >> "$CONTEXT_FILE"
# Write a summary of what the user wants based on Step 1

if [ -f CLAUDE.md ]; then
  echo "=== PROJECT CONVENTIONS (CLAUDE.md) ===" >> "$CONTEXT_FILE"
  head -80 CLAUDE.md >> "$CONTEXT_FILE"
fi

# Package manifest for stack detection
for manifest in package.json pyproject.toml requirements.txt Cargo.toml go.mod; do
  if [ -f "$manifest" ]; then
    echo "=== $manifest ===" >> "$CONTEXT_FILE"
    head -40 "$manifest" >> "$CONTEXT_FILE"
  fi
done
```

## Step 3: Research the domain

Compose a targeted research question based on the user's answers. The research should give you everything you need to write accurate, production-ready skill instructions.

**Research question template:**

> "Comprehensive implementation guide for [TOPIC]. I'm building an AI agent skill (a markdown instruction file) that will guide an LLM to perform this task step-by-step via bash commands and API calls. I need: (1) exact API endpoints, authentication methods, and request/response formats, (2) CLI commands with flags and expected output, (3) common error codes and how to handle them, (4) best practices and gotchas that a practitioner would know, (5) any rate limits or usage constraints, (6) what's out of scope or commonly confused with this task (so I can define clear boundaries). Focus on non-interactive, scriptable approaches — the agent cannot do interactive terminal prompts."

Adapt the template based on the skill type:
- For API integrations: emphasize auth, endpoints, webhooks, error codes
- For CLI wrappers: emphasize command syntax, exit codes, output parsing
- For workflows: emphasize sequencing, failure recovery, status checking

Run the research:

```bash
node "${SCRIPTS_DIR}/grep-api.js" run "<research_question>" --depth=deep --max-wait=540 --context-file="$CONTEXT_FILE" 2>&1
```

Use Monitor with `timeout_ms: 560000` if available. Tell the user: "Researching [topic] to build an accurate skill. This takes about 5 minutes."

## Step 4: Clean up context file

```bash
rm -f "$CONTEXT_FILE"
```

## Step 5: Generate the SKILL.md

Using the research findings AND the example skill patterns, write a complete SKILL.md file.

**Every generated skill MUST follow the 6 quality patterns below.** These are reverse-engineered from the best-performing skills and are non-negotiable.

### Pattern 1: Description tells Claude WHEN, not just WHAT

The description is the single most important field. Claude scans descriptions of all available skills before deciding which to load. A description that only says what the skill does will rarely get invoked.

**Bad:** `description: Deployment tool`

**Good:** `description: Deploy the application to production. Use when the user says "deploy", "ship it", "push to prod", or after finishing a feature. Handles build, push, and health check steps.`

Rules for descriptions:
- Include at least 3 trigger keywords/phrases that a user would say
- Front-load the use case in the first 250 characters (that's Claude's context budget for skill selection)
- State both what the skill does AND when to use it
- Descriptions under 50 characters get invoked 3-5x less often — aim for 100-250 characters

### Pattern 2: Be directive, not conversational

Skills are instructions, not chat. Use imperative verbs and numbered steps.

**Weak:** `Could you please check the deployment status? Maybe verify the health endpoint?`

**Strong:**
```
Check deployment status:
1. Run `kubectl get pods` to verify all pods are running
2. Hit the /health endpoint and confirm 200 response
3. Output status as a checklist with pass/fail for each check
```

### Pattern 3: Specify the output format explicitly

Tell Claude exactly what the output should look like. Without this, output varies every run and the skill feels unreliable.

```
Output format:
## [Skill Name] Results

**Status:** [pass/fail]

| Check | Result | Details |
|-------|--------|---------|
| ...   | ...    | ...     |
```

### Pattern 4: Include a "read first" step

The best skills don't assume Claude knows the project. They tell Claude to look at the codebase first, then act.

Before generating or modifying anything:
1. Read the target files to understand existing patterns
2. Find existing examples in the project (tests, configs, similar code)
3. Identify the framework/tooling in use
4. Match the import style, naming conventions, and patterns already present

### Pattern 5: Define what the skill does NOT do

Explicitly list what's out of scope. This prevents Claude from trying and failing — it either picks a different skill or asks for clarification.

```
## Out of Scope

This skill does NOT:
- Handle X (use /other-skill instead)
- Process Y
- Modify Z
```

70% of high-quality skills include an out-of-scope section. Almost no low-quality skills do.

### Pattern 6: Keep it under 500 lines

Every skill loads into Claude's context when invoked. A 2000-line skill eats 5000+ tokens before doing anything, and Claude loses focus on instructions at the bottom.

- Target: under 300 lines for the main SKILL.md
- Hard cap: 500 lines
- If it's getting long, split into supporting files that get loaded on demand:

```
SKILL.md (under 200 lines, always loaded)
├── ADVANCED_PATTERNS.md (loaded only when needed)
├── REFERENCE.md (loaded only when referenced)
└── EXAMPLES.md (loaded only when Claude needs examples)
```

### Structural conventions

Follow these conventions observed from existing skills:

**Frontmatter:**
```yaml
---
name: <skill-name>
description: <description following Pattern 1 above — 100-250 chars with trigger keywords>
---
```

Set `disable-model-invocation: true` only if the skill is purely mechanical (no judgement needed — rare).

**Body structure:**
1. **Title and overview** — what the skill does in 1-2 sentences
2. **Script path resolution** — use the standard symlink-safe pattern if the skill calls scripts from this repo:
   ```bash
   SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
   ```
3. **Steps** — numbered steps with clear bash code blocks. Each step should:
   - Explain what it does and why (directive, not conversational)
   - Include the exact bash command
   - Describe the expected output format
   - Handle errors (what to do if it fails)
4. **User interaction** — use AskUserQuestion for any input needed mid-flow
5. **Out of scope** — what this skill does NOT do (Pattern 5)
6. **Anti-patterns** — common mistakes to avoid

### Key principles from research
- Use non-interactive commands (no stdin prompts)
- Include exact error messages and recovery steps
- Cite specific API versions, endpoints, and auth methods from the research
- Set realistic timeout expectations for any long-running operations

## Step 6: Present the skill and ask where to save it

Show the generated SKILL.md to the user. Then use **AskUserQuestion**:

- Header: "Save skill"
- Question: "Where should I save this skill?"
- Options:
  - "This project" — "Save to ./skills/<name>/SKILL.md in the current project"
  - "Claude Code skills" — "Save to ~/.claude/skills/<name>/SKILL.md (available globally)"
  - "Just show me" — "Don't save — I'll copy it myself"

If the user picks a save location, write the file there.

## Anti-patterns

- Do NOT skip the clarification questions — a vague brief produces a vague skill
- Do NOT generate a skill without researching first — the whole point is research-informed accuracy
- Do NOT invent API endpoints or CLI flags from memory — use what the research returns
- Do NOT create overly long skills — target under 300 lines, hard cap at 500
- Do NOT forget the script path resolution block if the skill uses scripts from this repo
- Do NOT write a description under 50 characters — short descriptions get invoked 3-5x less
- Do NOT use conversational tone in the skill body — use imperative verbs and numbered steps
- Do NOT omit the output format — unspecified format means inconsistent results every run
- Do NOT skip the "Out of Scope" section — it prevents Claude from trying and failing
- Do NOT skip the "read first" step — skills that don't inspect the project produce generic, broken output
