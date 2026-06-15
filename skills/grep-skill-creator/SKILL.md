---
name: grep-skill-creator
description: Create a high-quality SKILL.md for any AI agent skill, powered by GREP deep research. Use when the user wants to build a new skill, plugin, or tool integration for Claude Code, Cowork, or OpenClaw. Also use when the user says "create a skill", "make a skill for X", "turn this into a skill", "build a plugin", or when they've been working through a workflow and want to capture it as a reusable skill. Researches the target domain first, then generates a production-ready skill file.
---

# GREP Skill Creator

Create a new SKILL.md file for an AI agent skill, informed by deep research on the target domain. The process: capture intent → research the domain → write the skill → test it → iterate.

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Step 1: Capture intent

The user's initial input (`$ARGUMENTS`) is a rough description. Before researching, understand the skill well enough to write a targeted query.

**Check conversation context first.** If the user has been working through a workflow in this conversation and says "turn this into a skill", extract what you can from the conversation history: the tools used, the sequence of steps, corrections the user made, input/output formats observed. Present what you've gathered and confirm before proceeding — the user may need to fill gaps.

If there's no conversation context to draw from, use **AskUserQuestion** to clarify (combine into 1-2 questions, don't bombard):

**Question 1 — Scope and target:**
- Header: "Skill scope"
- Question: "What should this skill do? Help me understand the core workflow."
- Options based on common patterns:
  - "API integration" — "Connect to an external API (e.g., Stripe, Twilio, GitHub)"
  - "CLI tool wrapper" — "Wrap a command-line tool for the agent (e.g., terraform, kubectl, ffmpeg)"
  - "Workflow automation" — "Multi-step workflow like deploy, test, or data pipeline"

**Question 2 — Technical details:**
- Header: "Details"
- Question: "What are the key technical details? (Select all that apply)"
- multiSelect: true
- Options:
  - "Needs authentication" — "The skill requires API keys, OAuth, or login"
  - "Has async/long-running steps" — "Some operations take minutes (builds, deploys, research)"
  - "Needs user interaction" — "The skill should ask the user questions mid-flow"
  - "Produces output files" — "Generates files, reports, or artifacts"

If the user's initial description is already detailed and covers these aspects, skip the questions and proceed directly.

## Step 2: Gather context

### 2a: Read the skill writing guide

Read the reference file to understand what makes a good skill:

```bash
cat "${CLAUDE_SKILL_DIR}/references/skill-writing-guide.md"
```

### 2b: Read example skills

Read 2-3 existing skills to see the format in practice. Pick the examples most relevant to the type of skill being created:

```bash
# A research skill with Monitor and polling
cat "${CLAUDE_SKILL_DIR}/../research/SKILL.md"

# An interactive multi-step skill
cat "${CLAUDE_SKILL_DIR}/../grep-login/SKILL.md"

# A skill with plan selection
cat "${CLAUDE_SKILL_DIR}/../grep-upgrade/SKILL.md"
```

### 2c: Gather codebase context (if skill is for the current project)

If the skill relates to the user's project (not a generic standalone skill), collect project context:

```bash
CONTEXT_FILE=$(mktemp /tmp/grep-skill-context.XXXXXX)

echo "=== EXISTING SKILL EXAMPLES ===" >> "$CONTEXT_FILE"
# Include 1-2 of the example skills read above (pick the most relevant)

echo "=== USER REQUIREMENTS ===" >> "$CONTEXT_FILE"
# Write a summary of what the user wants based on Step 1

if [ -f CLAUDE.md ]; then
  echo "=== PROJECT CONVENTIONS (CLAUDE.md) ===" >> "$CONTEXT_FILE"
  head -80 CLAUDE.md >> "$CONTEXT_FILE"
fi

for manifest in package.json pyproject.toml requirements.txt Cargo.toml go.mod; do
  if [ -f "$manifest" ]; then
    echo "=== $manifest ===" >> "$CONTEXT_FILE"
    head -40 "$manifest" >> "$CONTEXT_FILE"
  fi
done
```

## Step 3: Research the domain

Compose a targeted research question based on the user's answers. The research should give you everything needed to write accurate, production-ready skill instructions.

**Research question template:**

> "Comprehensive implementation guide for [TOPIC]. I'm building an AI agent skill (a markdown instruction file) that will guide an LLM to perform this task step-by-step via bash commands and API calls. I need: (1) exact API endpoints, authentication methods, and request/response formats, (2) CLI commands with flags and expected output, (3) common error codes and how to handle them, (4) best practices and gotchas that a practitioner would know, (5) any rate limits or usage constraints, (6) what's out of scope or commonly confused with this task (so I can define clear boundaries). Focus on non-interactive, scriptable approaches — the agent cannot do interactive terminal prompts."

Adapt the template based on skill type:
- API integrations: emphasise auth, endpoints, webhooks, error codes
- CLI wrappers: emphasise command syntax, exit codes, output parsing
- Workflows: emphasise sequencing, failure recovery, status checking

Run the research:

```bash
node "${SCRIPTS_DIR}/grep-api.js" run "<research_question>" --depth=deep --max-wait=540 --context-file="$CONTEXT_FILE" 2>&1
```

**Always use Monitor** (`timeout_ms: 560000`, `persistent: false`). Only fall back to blocking Bash if Monitor is genuinely unavailable.

Tell the user: "Researching [topic] to build an accurate skill. This takes about 5 minutes."

Clean up after: `rm -f "$CONTEXT_FILE"`

## Step 4: Generate the SKILL.md

Using the research findings, the writing guide, and the example skills, write a complete SKILL.md.

Before writing, re-read the skill writing guide's 6 quality patterns (Pattern 1-6) and structural conventions. Every generated skill should follow them. Pay particular attention to:

- **Description** — 100-250 characters, with trigger keywords and "when to use" context. Be slightly pushy about triggering — Claude undertriggers by default.
- **Explain the why** — instead of rigid MUSTs in all caps, explain the reasoning. The model using this skill is smart; it produces better results when it understands context rather than following rote instructions.
- **Be general, not overfitted** — write principles that work across many prompts, not rules tuned to one example.
- **Progressive disclosure** — if the skill needs >300 lines, split into SKILL.md + reference files with clear pointers about when to read each one.

### Key principles from research

- Use non-interactive commands (no stdin prompts)
- Include exact error messages and recovery steps
- Cite specific API versions, endpoints, and auth methods from the research
- Set realistic timeout expectations for long-running operations

## Step 5: Test the skill

Before presenting the final skill, validate it by thinking through 2-3 realistic test prompts — the kind of thing a real user would actually say, not abstract "test cases". Include some that are casual, some specific, some with edge cases.

Share them with the user: "Here are a few test prompts I'd like to walk through to check the skill. Do these look right, or would you add any?"

For each test prompt, mentally trace the skill's instructions:
1. Would the description trigger correctly for this prompt?
2. Do the steps produce the right outcome?
3. Are there any missing error handlers or edge cases?
4. Would a baseline (no skill) handle this just as well? If so, the skill isn't adding value.

If issues surface, revise the skill before presenting.

## Step 6: Optimise the description

The description determines whether the skill gets invoked. After the skill content is solid, review the description against these tests:

**Should-trigger prompts** — write 3-4 realistic user messages that should invoke this skill. Include casual phrasings ("just deploy it"), indirect references ("we're done, ship it"), and edge cases where the skill competes with others but should win.

**Should-not-trigger prompts** — write 2-3 near-miss queries that share keywords but actually need something different. These should be genuinely tricky, not obviously irrelevant. A negative test of "write a fibonacci function" for a deploy skill tests nothing useful.

Walk through each prompt: would the current description cause the skill to be selected? If not, adjust the description — add trigger phrases, broaden the context, or clarify the boundary.

Understanding triggering: Claude only consults skills for tasks it can't easily handle on its own. Simple one-step queries may not trigger a skill even if the description matches perfectly. Design descriptions for substantive, multi-step tasks where a skill genuinely adds value.

## Step 7: Present and save

Show the generated SKILL.md to the user. Then use **AskUserQuestion**:

- Header: "Save skill"
- Question: "Where should I save this skill?"
- Options:
  - "This project" — "Save to ./skills/<name>/SKILL.md in the current project"
  - "Claude Code skills" — "Save to ~/.claude/skills/<name>/SKILL.md (available globally)"
  - "Just show me" — "Don't save — I'll copy it myself"

If the user picks a save location, write the file there.

## Iterating on an existing skill

If the user already has a skill and wants to improve it, skip the research step and go straight to understanding what's wrong:

1. Read the existing skill
2. Ask what's not working — specific failures, triggers that miss, output that's wrong
3. **Generalise from feedback** — don't overfit to the specific failing example. If the skill needs to handle a broader range of inputs, expand the principles rather than adding narrow rules.
4. **Look for repeated work** — if test runs show the agent independently writing the same helper script every time, that script should be bundled with the skill.
5. Revise, test mentally, present the diff

## Anti-patterns

- Do NOT skip the clarification questions — a vague brief produces a vague skill
- Do NOT generate a skill without researching first — the whole point is research-informed accuracy
- Do NOT invent API endpoints or CLI flags from memory — use what the research returns
- Do NOT create overly long skills — target under 300 lines, hard cap at 500, use reference files for overflow
- Do NOT forget the script path resolution block if the skill uses scripts from this repo
- Do NOT write a description under 50 characters — short descriptions get invoked 3-5x less
- Do NOT use conversational tone in the skill body — use imperative verbs and numbered steps
- Do NOT omit the output format — unspecified format means inconsistent results every run
- Do NOT skip the "Out of Scope" section — it prevents Claude from trying and failing
- Do NOT skip the "read first" step — skills that don't inspect the project produce generic, broken output
- Do NOT overfit to test examples — write general principles, not narrow rules for specific cases
- Do NOT use heavy-handed ALWAYS/NEVER/MUST when explaining the reasoning would be more effective
