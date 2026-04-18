---
name: grep-experts
description: Create and train custom GREP research experts. An "expert" is a named research persona with its own config (model, tools, behaviour) and an optional knowledge base ("brain") trained from documents. Use when the user wants to build a domain-specific research agent (e.g. medical-expert, patent-expert) and run jobs against it via --expert=<name>. Distinct from /grep-projects (which holds SOP-driven workflows); experts encapsulate persona + knowledge.
---

# GREP Custom Experts

Experts let you encode a research persona that can be reused across jobs. Each lives at `experts/{expert_name}/` in the workspace. The `init` step seeds a folder with template files (`SOP.md`, `form.json`, `schema.json`, `{name}.exe`); the `save` step overwrites a single file at a time; the `train` step ensures the expert has a brain session (idempotent — creates `brain.json` server-side if missing).

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Initialize an expert folder

```bash
node "$SCRIPTS_DIR/grep-api.js" expert:init <expert_name>
```

Creates `experts/<expert_name>/` with template `SOP.md`, `form.json`, `schema.json`, and `{name}.exe`. Example:

```bash
node "$SCRIPTS_DIR/grep-api.js" expert:init medical-research-expert
```

## Save a single expert file

```bash
node "$SCRIPTS_DIR/grep-api.js" expert:save <expert_name> <file_name> <local_file> [--message="..."]
```

Overwrites one file under `experts/<expert_name>/`. Pull the template with `ws:cat`, edit locally, then save it back. Example:

```bash
# Pull the seeded SOP, edit locally, save it back
node "$SCRIPTS_DIR/grep-api.js" ws:cat experts/medical-research-expert/SOP.md > ./SOP.md
$EDITOR ./SOP.md
node "$SCRIPTS_DIR/grep-api.js" expert:save medical-research-expert SOP.md ./SOP.md \
  --message="tighten clinical-trials methodology"
```

Returns `WorkspaceCommitResponse` with the commit sha.

## Ensure the expert's brain session

```bash
node "$SCRIPTS_DIR/grep-api.js" expert:train <expert_name>
```

Idempotent. The backend creates `experts/<expert_name>/brain.json` server-side if missing. Use this once after `expert:init` (or any time you want to confirm the brain session exists).

```bash
node "$SCRIPTS_DIR/grep-api.js" expert:train medical-research-expert
```

> **Note:** there is currently no document-upload endpoint for expert knowledge bases — `expert:train` only ensures the brain session metadata exists. To enrich an expert with reference materials, drop them into `experts/<expert_name>/` via `expert:save` (one file at a time) and reference them from the SOP.

## Submit research against an expert

```bash
node "$SCRIPTS_DIR/grep-api.js" run "your question" --expert=medical-research-expert --depth=deep
```

The backend resolves the expert by name (or registry ID for built-in experts).

## Typical workflow

```bash
# 1. Init template files
node "$SCRIPTS_DIR/grep-api.js" expert:init legal-contracts-expert

# 2. Ensure the brain session exists
node "$SCRIPTS_DIR/grep-api.js" expert:train legal-contracts-expert

# 3. Pull SOP, customize locally, save back
node "$SCRIPTS_DIR/grep-api.js" ws:cat experts/legal-contracts-expert/SOP.md > ./SOP.md
$EDITOR ./SOP.md
node "$SCRIPTS_DIR/grep-api.js" expert:save legal-contracts-expert SOP.md ./SOP.md

# 4. Use it
node "$SCRIPTS_DIR/grep-api.js" run "Review this NDA for unusual clauses" \
  --expert=legal-contracts-expert --context-file=./nda-draft.md
```

## When to reach for this skill

- User wants a reusable, domain-specific research persona.
- User wants to ground research in their own corpus of reference documents.
- User asks "can I make a custom expert for X?"

## Related skills

- List existing experts (built-in + user-defined): `/grep-workspace ws:tree experts`
- Read an expert's config: `/grep-workspace ws:cat experts/<name>/config.yml`
- For SOP-style workflows (not personas): `/grep-projects`
