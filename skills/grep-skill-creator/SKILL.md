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

> "Comprehensive implementation guide for [TOPIC]. I'm building an AI agent skill (instruction file) that will guide an LLM to perform this task step-by-step via bash commands and API calls. I need: (1) exact API endpoints, authentication methods, and request/response formats, (2) CLI commands with flags and expected output, (3) common error codes and how to handle them, (4) best practices and gotchas, (5) any rate limits or usage constraints. Focus on non-interactive, scriptable approaches — the agent cannot do interactive terminal prompts."

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

Using the research findings AND the example skill patterns, write a complete SKILL.md file. Follow these conventions observed from existing skills:

### Frontmatter
```yaml
---
name: <skill-name>
description: <one-line description of when to use this skill>
---
```

Set `disable-model-invocation: true` only if the skill is purely mechanical (no judgement needed — rare).

### Structure
1. **Title and overview** — what the skill does in 1-2 sentences
2. **Script path resolution** — use the standard symlink-safe pattern:
   ```bash
   SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
   ```
   Only include this if the skill calls scripts from this repo. If it's a standalone skill using external tools, skip it.
3. **Steps** — numbered steps with clear bash code blocks. Each step should:
   - Explain what it does and why
   - Include the exact bash command
   - Describe the expected output
   - Handle errors (what to do if it fails)
4. **User interaction** — use AskUserQuestion for any input needed mid-flow
5. **Anti-patterns** — list common mistakes to avoid

### Key principles from research
- Use non-interactive commands (no stdin prompts)
- Include exact error messages and recovery steps
- Cite specific API versions, endpoints, and auth methods from the research
- Set realistic timeout expectations for any long-running operations

### Wiring the skill into GREP research jobs

If the new skill should be available to research jobs as a "custom skill" (rather than a Claude Code slash command), the user can pass it via `--custom-skills=skill1,skill2` on `/research` (see that skill's "Advanced flags" section). Custom skills are user-defined research personas that the agent picks up at job dispatch.

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
- Do NOT create overly long skills — keep each step focused and actionable
- Do NOT forget the script path resolution block if the skill uses scripts from this repo
