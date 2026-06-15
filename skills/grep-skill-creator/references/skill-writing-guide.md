# Skill Writing Guide

Detailed patterns for writing high-quality SKILL.md files. Read this before generating a skill.

## The 6 Quality Patterns

These are reverse-engineered from the best-performing skills. Every generated skill should follow them.

### Pattern 1: Description tells Claude WHEN, not just WHAT

The description is the single most important field. Claude scans descriptions of all available skills before deciding which to load — it's the primary triggering mechanism. A description that only says what the skill does will rarely get invoked.

Claude currently tends to **undertrigger** — it won't use skills it could benefit from. Combat this by making descriptions slightly "pushy": include specific trigger phrases and contexts, not just a dry summary.

**Bad:** `description: Deployment tool`

**Good:** `description: Deploy the application to production. Use when the user says "deploy", "ship it", "push to prod", or after finishing a feature. Also use proactively when the user merges to main and hasn't deployed yet. Handles build, push, and health check steps.`

Rules for descriptions:
- Include at least 3 trigger keywords/phrases that a user would say
- Front-load the use case in the first 250 characters (Claude's context budget for skill selection)
- State both what the skill does AND when to use it — all "when to use" info belongs here, not in the body
- Descriptions under 50 characters get invoked 3-5x less often — aim for 100-250 characters
- Include edge cases: "even if they don't explicitly ask for X"

### Pattern 2: Be directive, not conversational

Skills are instructions for an AI agent, not chat. Use imperative verbs and numbered steps.

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

Every skill loads into Claude's context when invoked. A 2000-line skill eats 5000+ tokens before doing anything, and Claude loses focus on instructions near the bottom.

- Target: under 300 lines for the main SKILL.md
- Hard cap: 500 lines
- If approaching the limit, add a layer of hierarchy with reference files and clear pointers about when to read them

## Progressive Disclosure Architecture

Skills use a three-level loading system:

1. **Metadata** (name + description) — always in context (~100 words)
2. **SKILL.md body** — loaded whenever skill triggers (<500 lines ideal)
3. **Bundled resources** — loaded as needed (scripts can execute without loading into context)

```
skill-name/
├── SKILL.md (required, under 500 lines)
│   ├── YAML frontmatter (name, description)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/    - Executable code for deterministic/repetitive tasks
    ├── references/ - Docs loaded into context as needed
    └── assets/     - Files used in output (templates, icons, fonts)
```

**Domain organisation**: When a skill supports multiple variants, split by domain:
```
cloud-deploy/
├── SKILL.md (workflow + selection logic)
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```
Claude reads only the relevant reference file, keeping context lean.

For large reference files (>300 lines), include a table of contents at the top.

## Writing Style

**Explain the why.** Instead of heavy-handed MUSTs in all caps, explain the reasoning behind instructions. Today's LLMs are smart — they have good theory of mind and when given context about *why* something matters, they produce better results than when given rigid rules. If you find yourself writing ALWAYS or NEVER in all caps, reframe with reasoning instead.

**Be general, not overfitted.** Skills get used across thousands of prompts. Instructions that are too narrow to specific examples break on novel inputs. Write principles, not rigid templates.

**Keep it lean.** Remove instructions that aren't pulling their weight. If a test run shows the model wasting time on something unproductive, cut the instruction causing it rather than adding more instructions on top.

**Examples pattern:**
```markdown
## Commit message format
**Example 1:**
Input: Added user authentication with JWT tokens
Output: feat(auth): implement JWT-based authentication
```

## Structural Conventions

**Frontmatter:**
```yaml
---
name: <skill-name>
description: <description following Pattern 1 — 100-250 chars with trigger keywords>
---
```

Set `disable-model-invocation: true` only if the skill is purely mechanical (no judgement needed — rare).

**Body structure:**
1. **Title and overview** — what the skill does in 1-2 sentences
2. **Script path resolution** — if calling scripts:
   ```bash
   SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
   ```
3. **Steps** — numbered, with clear bash code blocks. Each step should:
   - Explain what it does and why (not just what)
   - Include the exact bash command
   - Describe expected output format
   - Handle errors (what to do if it fails)
4. **User interaction** — use AskUserQuestion for input needed mid-flow
5. **Out of scope** — what this skill does NOT do
6. **Anti-patterns** — common mistakes to avoid
