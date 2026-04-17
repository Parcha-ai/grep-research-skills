---
name: grep-skill-creator
description: Create a high-quality SKILL.md for any AI agent skill (Claude Code, Cowork, OpenClaw), powered by GREP deep research. Use when the user wants to build a new skill, plugin, or tool integration. Researches the target domain first, then generates a production-ready skill file.
---

# GREP Skill Creator — API flavour

Create a new SKILL.md for an AI agent skill, informed by deep research on the target domain.

## Prerequisite

Load the `get_token` helper from `/grep-api-reference`. User must be logged in via `/grep-login`.

## Step 1: Understand what the user wants

Use **AskUserQuestion** to clarify (combine into 1-2 questions, don't bombard):

- Which tool/API/workflow should the skill wrap?
- What does the skill need to do (inventory of actions)?
- Who's the target agent (Claude Code, Cowork, OpenClaw)?
- What's the authentication model (if any)?

## Step 2: Research the target domain

Use `/research`-shaped submission (depth `deep`). Compose the research question to cover:

- Core concepts and terminology
- Authentication flows (OAuth, API keys, headers)
- Primary endpoints/methods and their shapes
- Error surface (status codes, rate limits)
- Known pitfalls and best practices

See `/research` (API flavour) for the submit + poll pattern; call it with `depth: "deep"` and `context` set to any existing example skills the user has.

## Step 3: Generate the SKILL.md

Using the research findings, write a SKILL.md following the conventions observed in this repo's skills:

### Frontmatter

```yaml
---
name: <skill-name>
description: <one-line description of when to use this skill>
---
```

Add `disable-model-invocation: true` only for purely mechanical skills (rare).

### Structure

1. **Title + overview** — 1-2 sentences.
2. **Prerequisite** — required tools / env vars / auth.
3. **Numbered steps** — explicit bash + node one-liners. Each step says *what* it does before *how*.
4. **Common workflows** — compact worked examples.
5. **Anti-patterns** — things the agent should NOT do, with reasons.
6. **Troubleshooting** — common error codes + resolutions.

### Key conventions

- Frontmatter `description` explains *when* to use the skill, not what it does (the name does that).
- Every curl example is copy-pasteable.
- JSON parsing goes through `node -e "..."`, not `jq` (Claude Code envs may lack jq).
- Long-running commands are wrapped in `/loop` patterns, not bare `while` loops.

## Step 4: Review with the user

Present the draft. Ask:

- Does the frontmatter description match when they'd want this skill to fire?
- Any recipes they want added?
- Any anti-patterns missing?

## Step 5: Drop the file

Write to `skills-api/<skill-name>/SKILL.md` in the user's chosen repo (or wherever their plugin lives). Chmod not needed for `.md` files.

## Anti-patterns

- Do NOT ship a skill that calls `brain` — this is the API flavour, everything is curl.
- Do NOT hardcode tokens in skill bodies. Always resolve via `get_token` or env vars.
- Do NOT copy the full `get_token` helper into every skill; reference `/grep-api-reference` and paste as needed.
