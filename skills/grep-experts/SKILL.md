---
name: grep-experts
description: Create and train custom GREP research experts. An "expert" is a named research persona with its own config (model, tools, behaviour) and an optional knowledge base ("brain") trained from documents. Use when the user wants to build a domain-specific research agent (e.g. medical-expert, patent-expert) and run jobs against it via --expert=<name>. Distinct from /grep-projects (which holds SOP-driven workflows); experts encapsulate persona + knowledge.
---

# GREP Custom Experts

Experts let you encode a research persona that can be reused across jobs. Each lives at `experts/{expert_name}/` in the workspace and can include a config.yml, prompt.md, and a "brain" (uploaded training documents that ground the expert's responses).

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Initialize an expert

```bash
node "$SCRIPTS_DIR/grep-api.js" expert:init <expert_name>
```

Creates a template `config.yml` at `experts/<expert_name>/`. Example:

```bash
node "$SCRIPTS_DIR/grep-api.js" expert:init medical-research-expert
```

## Save an expert config

```bash
node "$SCRIPTS_DIR/grep-api.js" expert:save <expert_name> <config_file>
```

The config file can be JSON or YAML. Example:

```bash
$EDITOR ./medical-config.yml   # tweak the template the init step seeded
node "$SCRIPTS_DIR/grep-api.js" expert:save medical-research-expert ./medical-config.yml
```

Returns `WorkspaceCommitResponse` with the commit sha.

## Train an expert (upload documents to its brain)

```bash
node "$SCRIPTS_DIR/grep-api.js" expert:train <expert_name> <document...>
```

Each document is added to the expert's knowledge base. Example:

```bash
node "$SCRIPTS_DIR/grep-api.js" expert:train medical-research-expert \
  ./pubmed-guides/clinical-trials-101.md \
  ./pubmed-guides/mesh-terms-glossary.md
```

## Submit research against an expert

```bash
node "$SCRIPTS_DIR/grep-api.js" run "your question" --expert=medical-research-expert --depth=deep
```

The backend resolves the expert by name (or registry ID for built-in experts).

## Typical workflow

```bash
# 1. Init template
node "$SCRIPTS_DIR/grep-api.js" expert:init legal-contracts-expert

# 2. Pull the template, customize locally
node "$SCRIPTS_DIR/grep-api.js" ws:cat experts/legal-contracts-expert/config.yml > ./legal.yml
$EDITOR ./legal.yml

# 3. Save edits back
node "$SCRIPTS_DIR/grep-api.js" expert:save legal-contracts-expert ./legal.yml

# 4. Train with reference materials
node "$SCRIPTS_DIR/grep-api.js" expert:train legal-contracts-expert \
  ./contract-templates/*.md ./case-law-summaries/*.pdf

# 5. Use it
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
