---
name: grep-build-app
description: Build interactive HTML web apps via Grep — websites, dashboards, data explorers, calculators, comparison tools, charts, custom UIs. Use when the user asks for an interactive app, "build me a tool that does X", "make an interactive Y", or anything requiring a runnable HTML/JS deliverable beyond a static report. Routes to the app-builder expert with effort=build (~$2.00, 10-15 min). Returns an index.html in the job workspace; the skill prints the file URL when ready.
---

# Build an Interactive App

Routes a build request to Grep's `app-builder` expert, which produces a runnable HTML/JS deliverable (single-page app, dashboard, calculator, data explorer, etc.) — not just a written report. The job runs at `effort=build` and typically takes 10-15 minutes. The result is an `index.html` (often plus CSS/JS/data files) in the job's workspace; the skill returns the file URL so the user can open it in a browser.

## When to use this skill vs the others

| User wants | Use |
|---|---|
| A research **report** with citations | `/research`, `/quick-research`, `/ultra-research`, `/grep-domain-expert` |
| A **slidedeck** (presentation) | `/grep-build-slidedeck` |
| A **spreadsheet** (tabular data) | `/grep-build-spreadsheet` |
| **Interactive HTML/JS** (app, dashboard, tool, calculator) | **`/grep-build-app`** (you are here) |
| A **podcast / video** | `/grep-domain-expert` → `media-producer` |

Concrete signals you want this skill: "build me a", "make an interactive", "create a dashboard for", "I want to be able to click/sort/filter", "tool that lets me X".

## Resolve script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Auto-update check

```bash
node "$SCRIPTS_DIR/update-check.js" 2>/dev/null &
```

## Prerequisites

The user must be authenticated. Build jobs are paid (~$2.00 on the gateway PAYG flow, or counted against the user's v2 subscription). Check auth status:

```bash
node "$SCRIPTS_DIR/auth.js" status
```

If `"authenticated": false`, **automatically invoke `/grep-login`** and continue once authenticated.

## Step 1: Tell the user up front

**Before submitting**, tell the user:

> "Build jobs take 10-15 minutes and cost about $2 (PAYG) or count against your subscription. I'll submit now and stream live updates — you can keep working while it runs."

Set expectations clearly. Build mode is the most expensive tier — never silently submit.

## Step 2: Clarify scope (if needed)

If the request is specific ("build me a mortgage calculator with amortization schedule"), skip clarification.

If the request is vague ("build me a tool"), use **AskUserQuestion** with these options:

- **Dashboard** — multi-metric view, charts, filters
- **Data explorer** — sortable table, search, drill-down
- **Calculator** — inputs + computed outputs (mortgage, conversion, etc.)
- **Quiz / form** — interactive prompts with computed result
- **Other** — user describes

Use the answer to refine the prompt before submitting.

## Step 3: Gather context (makes the app 10x more useful)

If the app should reference existing code, data, or conventions, gather context. Mirror `/research`'s "Gather context" step.

```bash
CONTEXT_FILE=$(mktemp /tmp/grep-build-app-context.XXXXXX)
```

What to include:

- **Existing data** — if the app should display the user's data (CSV, JSON, API responses), include it or its schema.
- **Project stack** — `package.json`, `pyproject.toml` etc. if the app should match conventions.
- **Brand / styling** — `CLAUDE.md` for tone, design tokens, or existing CSS the app should match.
- **Reference URLs** — if the user wants the app to mimic an existing tool, paste the URL + a description.

Skip context gathering if the app is fully self-contained ("standalone mortgage calculator").

## Step 4: Refine the prompt

The app-builder expert produces better output when given a precise spec. Refine the user's request into something close to a product brief:

- **What it does** (one sentence)
- **Key interactions** (what the user clicks/types/drags)
- **Inputs** (data sources, defaults)
- **Outputs** (what the user sees)
- **Constraints** (single-page HTML, no external CDN, must work offline, etc. — if any)

Example:
- Raw: "compare LLM providers"
- Refined: "Interactive single-page HTML dashboard comparing the top 5 LLM providers (Anthropic, OpenAI, Google, Mistral, xAI) on cost-per-million-tokens, max context window, and supported features. User can sort columns, filter by feature, and toggle a 'best value' view that highlights the cheapest provider meeting their context requirement. Use Tailwind for styling, no external dependencies beyond the CDN."

## Step 5: Submit — use Monitor (background), NOT blocking Bash

```bash
node "$SCRIPTS_DIR/grep-api.js" run "<refined_prompt>" \
  --expert-id=app-builder --effort=build --max-wait=1800 \
  --context-file="$CONTEXT_FILE" 2>&1
```

Run with **Monitor** (`timeout_ms: 1800000`, `persistent: false`). Build jobs run 10-15 minutes — well over Bash's 10-min cap.

`output_type=html_app` is an alternative shorthand that sets `expert_id=app-builder` + `effort=build` automatically. Either form works:

```bash
# Equivalent
node "$SCRIPTS_DIR/grep-api.js" run "<refined>" --output-type=html_app --max-wait=1800
```

Use the explicit `--expert-id=app-builder --effort=build` form when you want to be unambiguous.

**Clean up after:** `rm -f "$CONTEXT_FILE"` once the Monitor task completes.

## Step 6: Tell the user

After capturing the `slug` from the submit response:

> "Build job `<slug>` started — I'll stream live updates and post the file URL when it's done (~10-15 min)."

## Step 7: List the workspace + present the URL

When the Monitor notification arrives saying the job completed:

1. **List workspace files** — the app-builder may produce multiple files:

   ```bash
   node "$SCRIPTS_DIR/grep-api.js" files <slug>
   ```

2. **Find the entrypoint** — usually `index.html`, sometimes `app.html` or `<topic>.html`.

3. **Print the URL** — use the v2 file path:

   ```
   https://api.grep.ai/api/v2/research/<slug>/files/index.html
   ```

   (Gateway equivalent: `https://api.grep.ai/mpp/v1/api/research/<slug>/files/index.html`.)

4. **Tell the user how to view:**

   > "Your app is ready: https://api.grep.ai/api/v2/research/<slug>/files/index.html
   >
   > To preview locally:
   > ```
   > curl -L 'https://api.grep.ai/api/v2/research/<slug>/files/index.html' \
   >   -H 'Authorization: Bearer <token>' \
   >   > /tmp/app.html && open /tmp/app.html
   > ```"

   Note that the URL is auth-protected — the user needs their session token to view it. If they want a public link, they should download the HTML and host it themselves (or open via authenticated curl + local file).

5. **List companion files** — if the app-builder also produced `style.css`, `data.json`, etc., mention them too. The `index.html` references them by relative path within the workspace, so they need to be downloaded together for a fully-functional local preview.

## Step 8: Optionally fetch artifacts locally

If the user wants the app on disk (to commit, host, or modify), download every workspace file. The loop uses Node (no jq dependency) and creates parent directories per file, so nested paths like `js/app.js` work:

```bash
SLUG=<slug>
DEST=/tmp/grep-app-$SLUG
mkdir -p "$DEST"

# Read the file list, then download each — using Node so we don't depend on jq
node "$SCRIPTS_DIR/grep-api.js" files "$SLUG" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);(j.files||j).forEach(f=>console.log(f.path||f))})" \
  | while read -r f; do
      mkdir -p "$DEST/$(dirname "$f")"
      node "$SCRIPTS_DIR/grep-api.js" file "$SLUG" "$f" > "$DEST/$f"
    done

open "$DEST/index.html"
```

## Anti-patterns

- Do NOT pass `--effort=low` (or `medium`) for app-builder. Low effort produces a draft, not a runnable app. Always `--effort=build`.
- Do NOT skip the file listing — the app-builder may create multiple files (CSS, JS, data) the user needs to fully preview the app.
- Do NOT block on `--max-wait=540` — build jobs typically need 10-15 minutes. Use `--max-wait=1800` and Monitor.
- Do NOT submit without telling the user the cost + duration up front. Build mode is the most expensive tier (~$2 on PAYG); silent submission is bad UX.
- Do NOT use this skill for static deliverables. Reports → `/research`. Slides → `/grep-build-slidedeck`. Tables → `/grep-build-spreadsheet`.
- Do NOT trust the URL is publicly accessible — workspace files require auth. Tell the user how to fetch with their token.

## If the job times out

Exit code 2 means the script's `--max-wait` elapsed but the job is still running server-side. The output JSON includes a `slug`. Tell the user "Still building (job: <slug>). I'll check back in 5 minutes." Then either rerun, or invoke `/grep-status <slug>`, or use the `result` command:

```bash
node "$SCRIPTS_DIR/grep-api.js" result <slug>
```

For very long builds (rare), consider switching to the `/ultra-research` polling pattern (submit once + `/loop` cron every 5 minutes).
