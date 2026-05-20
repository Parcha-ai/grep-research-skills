# Build Interactive HTML App

Routes to Grep's `app-builder` expert. Produces a runnable HTML/JS deliverable (single-page app, dashboard, calculator, data explorer) — not a written report. **Effort=build, 10-15 minutes.**

## Step 1: Tell the user up front

> "Build jobs take 10-15 minutes and count against your subscription. I'll submit now and stream live updates — you can keep working while it runs."

Set expectations clearly. Build mode is the most expensive tier — never silently submit.

## Step 2: Clarify (if vague)

If "build me a tool" — use **AskUserQuestion** to narrow:
- Dashboard (multi-metric, charts, filters)
- Data explorer (sortable table, search, drill-down)
- Calculator (inputs + computed outputs)
- Quiz/form (interactive prompts with result)

If specific ("mortgage calculator with amortization schedule") — skip.

## Step 3: Gather context

Apply the shared context pattern from the router SKILL.md. Add app-specific inputs:
- **Existing data** — CSV/JSON the app should display
- **Project stack** — `package.json` etc. for styling conventions
- **Brand / styling** — `CLAUDE.md` for tone, design tokens
- **Reference URLs** — if mimicking an existing tool

Skip if the app is self-contained ("standalone mortgage calculator").

## Step 4: Refine the prompt

App-builder produces better output with a precise spec:
- **What it does** (one sentence)
- **Key interactions** (clicks/types/drags)
- **Inputs** (data sources, defaults)
- **Outputs** (what the user sees)
- **Constraints** (single-page HTML, no external CDN, etc.)

Example:
- Raw: "compare LLM providers"
- Refined: "Interactive single-page HTML dashboard comparing the top 5 LLM providers on cost-per-million-tokens, max context window, and supported features. User can sort columns, filter by feature, and toggle a 'best value' view. Use Tailwind, no external dependencies."

## Step 5: Submit (Monitor, not blocking Bash)

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/grep-api.js" run "<refined_prompt>" \
  --expert-id=app-builder --effort=build --max-wait=1800 \
  --context-file="$CONTEXT_FILE" 2>&1
```

`--output-type=html_app` is sugar for `--expert-id=app-builder --effort=build`.

Run with **Monitor** (`timeout_ms: 1800000`, `persistent: false`). Build jobs run 10-15 min — over Bash's 10-min cap.

Clean up: `rm -f "$CONTEXT_FILE"` when complete.

## While building: DO NOT narrate status updates

Monitor will emit polling events for 10-15 minutes. **Stay silent.** No "almost there", no "the builder is working on the layout". When the job completes, present the URL.

## Step 6: List + present the URL

When complete:

```bash
node "$SCRIPTS_DIR/grep-api.js" files <slug>
```

Find the entrypoint (usually `index.html`). Print:

```
API_BASE="${GREP_API_BASE:-https://api.grep.ai}"
echo "$API_BASE/api/v2/research/<slug>/files/index.html"
```

Tell the user:

> "Your app is ready: `$API_BASE/api/v2/research/<slug>/files/index.html`. The URL requires your auth token. To preview locally: download the workspace files and open `index.html`."

If the builder produced companion files (CSS, JS, data), mention them — they're referenced by relative path within the workspace.

## Anti-patterns

- Do NOT pass `--effort=low` or `medium` for app-builder. Low produces a draft, not a runnable app.
- Do NOT skip the file listing — the app-builder may create multiple files.
- Do NOT block on `--max-wait=540` — build jobs need 10-15 minutes.
- Do NOT submit without warning the user of the cost + duration.
- Do NOT narrate Monitor events — wait for completion.
- Do NOT abandon a running build because 10 minutes feels long. That's the normal duration.
