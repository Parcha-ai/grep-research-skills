# Build Spreadsheet

Routes to Grep's `app-builder` expert with `output_type=spreadsheet`. Produces a sortable HTML table with CSV export. **Effort=build, 10-15 minutes.**

## Step 1: Tell the user up front

> "Spreadsheet build takes 10-15 minutes and counts against your subscription. I'll stream live updates — you can keep working."

## Step 2: Clarify (if vague)

If "make a spreadsheet of X" without column signals, use **AskUserQuestion**:
- What columns are required?
- How many rows? (top 10, top 50, exhaustive)
- Any filters? (e.g. "only US-based companies")

Skip clarification if the user gave specifics ("top 50 YC W24 companies with name, sector, funding raised, founder LinkedIn URLs").

## Step 3: Gather context

Apply the shared context pattern. For spreadsheets, include any seed data or schema the user has.

## Step 4: Refine the prompt

- **Subject** — what each row represents
- **Columns** — explicit list with types
- **Sort default** — by which column, ascending/descending
- **Row count target** — top N or "as many as you can find"
- **Filters** — narrowing criteria

Example refined prompt: "Sortable HTML spreadsheet of the top 25 LLM provider models as of 2026. Columns: Provider, Model name, Context window (tokens), Input cost ($/1M tokens), Output cost ($/1M tokens), Open weights (yes/no), Release date. Default sort: Input cost ascending. Include cost source citations."

## Step 5: Submit (Monitor)

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/grep-api.js" run "<refined_prompt>" \
  --output-type=spreadsheet --max-wait=1800 \
  --context-file="$CONTEXT_FILE" 2>&1
```

`--output-type=spreadsheet` sets `expert_id=app-builder` + `effort=build`.

Run with **Monitor** (`timeout_ms: 1800000`, `persistent: false`).

Clean up: `rm -f "$CONTEXT_FILE"` when complete.

## While building: DO NOT narrate status updates

Stay silent during the 10-15 min build.

## Step 6: Present the spreadsheet

```bash
node "$SCRIPTS_DIR/grep-api.js" files <slug>
```

Find `index.html` (or `spreadsheet.html`). Print:

```
API_BASE="${GREP_API_BASE:-https://api.grep.ai}"
echo "$API_BASE/api/v2/research/<slug>/files/index.html"
```

Tell the user:

> "Your spreadsheet is ready: `$API_BASE/api/v2/research/<slug>/files/index.html`. Click column headers to sort. There's an Export CSV button in the toolbar."

If the builder produced a separate `data.csv` or `data.json`, mention it — useful for downstream tools.

## Anti-patterns

- Do NOT pass `--effort=low` or `medium` — spreadsheets need build tier.
- Do NOT request "all rows" without bounds — set a realistic top-N to avoid timeouts.
- Do NOT narrate Monitor events.
- Do NOT abandon a running build at 5 minutes.
- Do NOT use `/research` — it produces a report, not a table.
