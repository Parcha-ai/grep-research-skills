---
name: grep-build-spreadsheet
description: Build comparison spreadsheets via Grep with structured tabular data — vendor comparisons, market data tables, financial models, dataset analyses, competitive matrices, pricing tables. Use when the user asks for a spreadsheet, table, CSV, comparison matrix, or comparative data. Returns an HTML spreadsheet (with copyable cells / export-CSV button) in the job workspace. Routes to the app-builder expert with output_type=spreadsheet — v2 translates to expert_id=app-builder + effort=build + a "Build a spreadsheet of: " prefix (~$2.00, 10-15 min).
---

# Build a Spreadsheet

Routes a tabular-data request to Grep's app-builder expert with `output_type=spreadsheet` — sugar for `expert_id=app-builder + effort=build + "Build a spreadsheet of: " prefix`. The result is an HTML spreadsheet (typically `index.html` with copyable cells + export-CSV button) in the job's workspace.

## When to use this skill vs the others

| User wants | Use |
|---|---|
| **Spreadsheet / table / CSV / comparison matrix** | **`/grep-build-spreadsheet`** (you are here) |
| Slidedeck / presentation | `/grep-build-slidedeck` |
| Interactive HTML app | `/grep-build-app` |
| Plain research report (with maybe an inline table) | `/research` |

Concrete signals: "spreadsheet of", "table comparing", "CSV with", "compare X vs Y vs Z on dimensions A, B, C", "build me a financial model", "dataset of top N".

If the user just wants a one-off comparison table inside a written report (not interactive, no export), use `/research` instead — the build-mode tax (~$2, 10-15 min) isn't worth it for a single table you'd paste into markdown.

## Auto-update check

```bash
node "$SCRIPTS_DIR/update-check.js" 2>/dev/null &
```

## Prerequisites

Spreadsheet jobs run at `effort=build` (~$2.00 PAYG, 10-15 min).

```bash
node "$SCRIPTS_DIR/auth.js" status
```

If `"authenticated": false`, **automatically invoke `/grep-login`**.

## Resolve script + resources paths

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
RESOURCES_DIR="$(dirname "$SCRIPTS_DIR")/resources"
```

## Step 1: Tell the user up front

> "Spreadsheet jobs take 10-15 minutes and cost about $2 (PAYG) or count against your subscription. I'll submit now and stream live updates."

## Step 2: Clarify axes (if needed)

If the prompt names the axes ("compare Stripe, Adyen, Braintree on transaction fee, dispute fee, supported currencies"), skip clarification.

If axes aren't obvious, use **AskUserQuestion** with two questions:

- **Rows** — what are the entities being compared? (vendors / companies / time periods / regions / products / etc.)
- **Columns** — what dimensions? (price / features / latency / SLA / market share / etc.)

Skip if the prompt is already specific.

## Step 3: Decide whether to use a structured schema

If the user wants enforced column types (currency, percent, URL, etc.) or a citation policy per row, plan to pass `--json-schema-file="$RESOURCES_DIR/spreadsheet_schema.json"` to the submit command in Step 5 (do NOT submit yet — refine the prompt in Step 4 first).

The schema constrains output to `{title, description, columns: [{key, label, type, unit}], rows: [{values, citations}], footer_notes}`. Column types: `string | number | currency | percent | date | url | boolean`. Note: per-value type validation against the column types is left to the app-builder — the schema only enforces the shape (columns array, rows array, presence of required top-level fields).

For free-form spreadsheets (no enforced types), omit the schema flag.

**Don't submit here.** This step decides whether the schema flag will be added to Step 5's command. The actual submit happens once, in Step 5.

## Step 4: Refine the prompt

Refine the user's raw request into a spreadsheet brief:

- **Subject** (what the spreadsheet is about)
- **Rows** (specific entities, ideally count-bounded — "top 10", "5 named providers")
- **Columns** (specific dimensions with units — "transaction_fee_percent", "p99_latency_ms")
- **Sort / filter / interaction** (if any — sortable, "best value" highlight, region filter)
- **Citation policy** (every row's value cited, or just key cells)

Example:
- Raw: "compare LLM providers"
- Refined: "Spreadsheet comparing the top 5 LLM API providers (Anthropic, OpenAI, Google, Mistral, xAI) on: input cost ($/M tokens), output cost ($/M tokens), max context (tokens), p99 latency (ms), tool-use support (boolean), vision support (boolean). One row per provider, sortable columns, source URL on every cell. Include a footer note listing the date of the pricing snapshot."

## Step 5: Submit — use Monitor (background)

Submit ONCE here, using the refined prompt from Step 4. Append `--json-schema-file=...` only if Step 3 said to use the schema.

**Free-form (no schema):**

```bash
node "$SCRIPTS_DIR/grep-api.js" run "<refined>" \
  --output-type=spreadsheet --max-wait=1800 2>&1
```

**Schema-constrained:**

```bash
node "$SCRIPTS_DIR/grep-api.js" run "<refined>" \
  --output-type=spreadsheet \
  --json-schema-file="$RESOURCES_DIR/spreadsheet_schema.json" \
  --max-wait=1800 2>&1
```

`--output-type=spreadsheet` is sugar for `--expert-id=app-builder --effort=build`. Don't pass both.

Run with **Monitor** (`timeout_ms: 1800000`, `persistent: false`). Only one submit per skill invocation — the build tier is ~$2 each.

## Step 6: Tell the user

> "Spreadsheet job `<slug>` started — 10-15 min. I'll stream updates and post the URL when ready."

## Step 7: List workspace + present URL

When the job completes:

```bash
node "$SCRIPTS_DIR/grep-api.js" files <slug>
```

Find the spreadsheet — typically `index.html` (sometimes with companion `data.csv` or `data.json`). Print the URL using `$GREP_API_BASE` (or fall back to `https://api.grep.ai`) so staging / preview environments work too:

```bash
API_BASE="${GREP_API_BASE:-https://api.grep.ai}"
echo "$API_BASE/api/v2/research/<slug>/files/index.html"
```

Tell the user how to use it:

> "Your spreadsheet is ready: `$API_BASE/api/v2/research/<slug>/files/index.html`
>
> - **Sort** any column by clicking the header
> - **Export CSV** — most templates include a 'Download CSV' button. If not, copy cells directly into Excel/Sheets.
> - **Local copy:** `curl -L \"$API_BASE/api/v2/research/<slug>/files/index.html\" -H 'Authorization: Bearer <token>' > /tmp/spreadsheet.html && open /tmp/spreadsheet.html`"

If a `data.csv` or `data.json` is in the workspace, mention it — those are easier to pipe into other tools than scraping the HTML.

## Step 8: Follow-ups

If the user wants more rows, different columns, or a re-rank, use `/grep-continue <slug> "<follow-up>"` instead of a fresh job. The existing workspace + research context get reused — cheaper.

## Anti-patterns

- Do NOT use this skill for static reports with embedded tables. Use `/research` and let it write a markdown table inline. Build mode is only worth it for interactive spreadsheets the user will sort / filter / export.
- Do NOT pass `--effort=low` or `--effort=medium` with `--output-type=spreadsheet` — sugar already pins `effort=build`.
- Do NOT pass `--expert-id=app-builder` alongside `--output-type=spreadsheet` — redundant; sugar already does that.
- Do NOT block on `--max-wait=540` — spreadsheet builds need 10-15 min. `--max-wait=1800` + Monitor.
- Do NOT submit without telling the user the cost + duration.
- Do NOT skip column-type enforcement when types matter (currency, percent, dates) — load the JSON schema. Free-form output may pick string types for everything, which breaks downstream sort/filter.
- Do NOT trust the URL is publicly accessible — workspace files require auth.

## If the job times out

Exit code 2 means `--max-wait` elapsed but the job is still running server-side. Tell the user "Still building (job: <slug>). Checking back." Use `result <slug>` once enough time passes, or invoke the `/ultra-research` polling pattern.
