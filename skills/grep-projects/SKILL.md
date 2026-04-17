---
name: grep-projects
description: Manage GREP workspace projects — upload files into projects/{name}/, create directories, delete files. A "project" is an SOP-driven research workflow: dropping an SOP.md into projects/<name>/ and then submitting research with --project=<name> tells GREP to use that SOP as the agent's system prompt. Use when the user is setting up a recurring research workflow, organizing files into a project directory, or modifying an existing project's contents.
---

# GREP Projects

Workspace projects live at `projects/{project_name}/` in Pierre. They typically contain an `SOP.md` (read by `/research --project=...` as the agent's system prompt) plus any reference files the agent should always have access to inside that project.

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Upload files to a project

```bash
node "$SCRIPTS_DIR/grep-api.js" project:upload <project_name> <file...>
```

Examples:

```bash
# Bootstrap a new project with its SOP
node "$SCRIPTS_DIR/grep-api.js" project:upload acme-onboarding ./SOP.md

# Add a few reference docs to an existing project
node "$SCRIPTS_DIR/grep-api.js" project:upload acme-onboarding \
  ./reference/policy.pdf ./reference/brand-guide.md
```

Returns `WorkspaceCommitResponse{ success, commit_sha, message, files }`. Print the short sha + count.

## Create a directory inside a project

```bash
node "$SCRIPTS_DIR/grep-api.js" project:mkdir <project_name> <dir_path>
```

Used to organize a project (e.g. `project:mkdir acme-onboarding reference/`).

## Delete a file from a project

```bash
node "$SCRIPTS_DIR/grep-api.js" project:delete <project_name> <file_path>
```

`file_path` is relative to `projects/<project_name>/`.

## Submitting research against a project

Once `projects/<name>/SOP.md` exists, run:

```bash
node "$SCRIPTS_DIR/grep-api.js" run "your question" --project=projects/<name> --depth=deep
```

The backend reads `SOP.md` and uses it as the agent's system prompt. Without `SOP.md`, the project still exists as a directory but `--project=...` won't have anything to load.

## Typical workflow

```bash
# 1. Author an SOP locally
$EDITOR ./SOP.md

# 2. Push it
node "$SCRIPTS_DIR/grep-api.js" project:upload mcc-classification ./SOP.md

# 3. Run research that uses it
node "$SCRIPTS_DIR/grep-api.js" run "Classify Acme's MCC code" --project=projects/mcc-classification
```

## When to reach for this skill

- User wants to set up a recurring/templated research workflow.
- User wants to swap or update an existing SOP.
- User wants to add reference files (policy docs, taxonomies, prompts) that a project should always include.

## Related skills

- Browse what's already in a project: `/grep-workspace ws:tree projects/<name>`
- Read an existing SOP: `/grep-workspace ws:cat projects/<name>/SOP.md`
- Manage custom experts (similar but for personas, not workflows): `/grep-experts`
