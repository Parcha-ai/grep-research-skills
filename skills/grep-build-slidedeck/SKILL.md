---
name: grep-build-slidedeck
description: Create research-backed slidedecks via Grep. Use when the user asks for a presentation, pitch deck, slides, "deck about X", or "presentation on Y". Covers market research, competitive analysis, product pitches, technical overviews, sales enablement. Returns an HTML slidedeck (slides.html or deck.html) in the job workspace. Routes to the app-builder expert with output_type=slidedeck — v2 translates that to expert_id=app-builder + effort=build + a "Create a slidedeck about: " question prefix (~$2.00, 10-15 min).
---

# Build a Slidedeck

Routes a presentation request to Grep's app-builder expert with `output_type=slidedeck` — a sugar form that pins `expert_id=app-builder + effort=build + "Create a slidedeck about: " prefix`. The result is an HTML slidedeck (typically `slides.html` or `deck.html`) in the job's workspace, with arrow-key navigation and `?print-pdf` export support.

## When to use this skill vs the others

| User wants | Use |
|---|---|
| **Slides / presentation / pitch deck / deck** | **`/grep-build-slidedeck`** (you are here) |
| Interactive HTML app (dashboard, tool) | `/grep-build-app` |
| Spreadsheet / table / comparison matrix | `/grep-build-spreadsheet` |
| Plain research report | `/research`, `/grep-domain-expert` |

Concrete signals: "deck about", "presentation on", "pitch deck for", "slides covering", "investor presentation", "sales enablement deck".

## Auto-update check

```bash
node "$SCRIPTS_DIR/update-check.js" 2>/dev/null &
```

## Prerequisites

The user must be authenticated. Slidedeck jobs run at `effort=build` (~$2.00 PAYG, 10-15 min).

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

> "Slidedeck jobs take 10-15 minutes and cost about $2 (PAYG) or count against your subscription. I'll submit now and stream live updates."

## Step 2: Clarify scope (optional)

If the request is short/specific ("pitch deck for Anthropic Series E investors"), skip clarification.

If scope is fuzzy ("make me a deck about AI"), use **AskUserQuestion** with these options:

- **Audience** — executive / engineering / sales / investor / general
- **Length** — short (5-7 slides) / standard (10-12) / long (15-20)
- **Angle** — overview / pitch / competitive / technical-deep-dive / how-to

Skip if the answers are obvious from the prompt.

## Step 3: Decide whether to use a structured schema

If the user wants a specific deck structure (e.g. enforced sections, citation format, chart slots), plan to pass `--json-schema-file="$RESOURCES_DIR/slidedeck_schema.json"` to the submit command in Step 5 (do NOT submit yet — refine the prompt in Step 4 first).

The schema constrains slides to a structured form: title + subtitle + slides[], each with heading, body (string or bullet array), layout (title / bullets / two-column / image / chart / quote), optional chart spec, optional citations.

For free-form decks, omit the schema flag — the app-builder picks layout, styling, and length on its own.

**Don't submit here.** This step decides whether the schema flag will be added to Step 5's command. The actual submit happens once, in Step 5.

## Step 4: Refine the prompt

Refine the user's raw request into a deck brief:

- **Title + subtitle** (or let the model pick)
- **Audience** (who's reading the deck)
- **Slide count target** (10-12 default for general use)
- **Required sections** (problem / solution / traction / team / ask, for a pitch deck)
- **Tone** (serious / playful / data-heavy)
- **Citation policy** (every claim must have a source URL, or just key claims)

Example:
- Raw: "deck about agentic commerce"
- Refined: "12-slide investor-grade slidedeck on the state of agentic commerce in 2026. Cover: market definition, key protocols (x402, MPP, AP2), incumbents vs startups, adoption trajectory, regulatory headwinds, and a closing 'where it goes from here' slide. Audience: Series E enterprise investors. Tone: data-heavy with citations on every claim."

## Step 5: Submit — use Monitor (background)

Submit ONCE here, using the refined prompt from Step 4. Append `--json-schema-file=...` only if Step 3 said to use the schema.

**Free-form (no schema):**

```bash
node "$SCRIPTS_DIR/grep-api.js" run "<refined>" \
  --output-type=slidedeck --max-wait=1800 2>&1
```

**Schema-constrained:**

```bash
node "$SCRIPTS_DIR/grep-api.js" run "<refined>" \
  --output-type=slidedeck \
  --json-schema-file="$RESOURCES_DIR/slidedeck_schema.json" \
  --max-wait=1800 2>&1
```

`--output-type=slidedeck` is sugar for `--expert-id=app-builder --effort=build` with a "Create a slidedeck about: " prefix added server-side. You don't need both.

Run with **Monitor** (`timeout_ms: 1800000`, `persistent: false`). Only one submit per skill invocation — the build tier is ~$2 each, double-submitting is bad UX.

## Step 6: Tell the user

> "Slidedeck job `<slug>` started — 10-15 min. I'll stream updates and post the URL when ready."

## Step 7: List workspace + present URL

When the job completes:

```bash
node "$SCRIPTS_DIR/grep-api.js" files <slug>
```

Find the deck — typically:
- `slides.html` (most common)
- `deck.html`
- `index.html` (fallback)

Print the URL — use `$GREP_API_BASE` (or fall back to `https://api.grep.ai`) so staging / preview environments work too:

```bash
API_BASE="${GREP_API_BASE:-https://api.grep.ai}"
echo "$API_BASE/api/v2/research/<slug>/files/slides.html"
```

Tell the user how to view:

> "Your slidedeck is ready: `$API_BASE/api/v2/research/<slug>/files/slides.html`
>
> - **Navigate:** arrow keys (left/right) to step through slides
> - **Export PDF:** open the URL with `?print-pdf` appended, then your browser's Print → Save as PDF
> - **Local copy:** `curl -L "$API_BASE/api/v2/research/<slug>/files/slides.html" -H 'Authorization: Bearer <token>' > /tmp/deck.html && open /tmp/deck.html`"

The URL is auth-protected (workspace files require the user's session token).

## Step 8: Follow-ups

If the user wants tweaks (different palette, swap a section, add a slide), suggest `/grep-continue <slug> "<follow-up>"` — re-runs at the same effort tier and builds on the same workspace, cheaper than a fresh job.

## Anti-patterns

- Do NOT pass `--effort=low` or `--effort=medium` with `--output-type=slidedeck` — the sugar already pins `effort=build`. Mixing them is a contract violation; the API will pick the explicit `--effort` and produce a draft, not a deck.
- Do NOT use this skill for raw HTML apps (use `/grep-build-app` — slidedecks have a slide-template assumption baked into the prefix).
- Do NOT block on `--max-wait=540` — slidedeck builds need 10-15 min. Always `--max-wait=1800` + Monitor.
- Do NOT submit without telling the user the cost + duration. Build mode is the most expensive tier.
- Do NOT hand the user the raw URL without explaining authentication. Workspace files require the session token; a public link will 401.
- Do NOT use the JSON schema unless the user wants enforced structure. Free-form decks let the model pick the best layout.

## If the job times out

Exit code 2 means `--max-wait` elapsed but the job is still running server-side. Tell the user "Still building (job: <slug>). Checking back in 5 min." Then `result <slug>` once enough time passes, or switch to the `/ultra-research` polling pattern (`/loop` cron every 5 min).
