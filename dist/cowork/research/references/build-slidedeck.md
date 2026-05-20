# Build Slidedeck

Routes to Grep's `app-builder` expert with `output_type=slidedeck`. Produces an HTML deck with arrow-key navigation + PDF export. **Effort=build, 10-15 minutes.**

## Step 1: Tell the user up front

> "Slidedeck build takes 10-15 minutes and counts against your subscription. I'll stream live updates — you can keep working."

## Step 2: Clarify (if vague)

If "make a deck about X" without an audience/depth signal, use **AskUserQuestion**:
- **Pitch** — 8-10 slides, exec summary tone
- **Technical deep dive** — 15-20 slides, detail-heavy
- **Training / education** — 10-15 slides, learning objectives
- **Other** — user describes

Skip clarification if the user gave specifics ("8-slide pitch for our seed round on Y").

## Step 3: Gather context

Apply the shared context pattern. For decks specifically, include:
- **Audience** — who will read this
- **Brand tone** — `CLAUDE.md` or design notes
- **Data sources** — if the deck must reference user data, attach via `with-context` flow first

## Step 4: Refine the prompt

- **Topic** — one sentence
- **Audience** — exec / engineer / investor / student
- **Number of slides** — 5-25
- **Specific sections** — if the user wants particular slides ("include a competitive landscape slide")

Example refined prompt: "10-slide investor pitch on x402, MPP, AP2 protocols for AI agent payments. Target audience: seed-stage VCs unfamiliar with the space. Include: problem (slide 2), market size (3), the 3 protocols compared (4-6), our edge (7), traction (8), team (9), ask (10)."

## Step 5: Submit (Monitor)

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/grep-api.js" run "<refined_prompt>" \
  --output-type=slidedeck --max-wait=1800 \
  --context-file="$CONTEXT_FILE" 2>&1
```

`--output-type=slidedeck` automatically sets `expert_id=app-builder` + `effort=build`.

Run with **Monitor** (`timeout_ms: 1800000`, `persistent: false`).

Clean up: `rm -f "$CONTEXT_FILE"` when complete.

## While building: DO NOT narrate status updates

Stay silent during the 10-15 min build. Present the URL when complete.

## Step 6: Present the deck

```bash
node "$SCRIPTS_DIR/grep-api.js" files <slug>
```

Find `index.html` (or `deck.html`). Print:

```
API_BASE="${GREP_API_BASE:-https://api.grep.ai}"
echo "$API_BASE/api/v2/research/<slug>/files/index.html"
```

Tell the user:

> "Your slidedeck is ready: `$API_BASE/api/v2/research/<slug>/files/index.html`. Use arrow keys to navigate. To export PDF: open in browser, Cmd+P → Save as PDF."

## Anti-patterns

- Do NOT pass `--effort=low` or `medium` — decks need build tier.
- Do NOT narrate Monitor events — wait for completion.
- Do NOT abandon a running build at 5 minutes — slides need the full duration.
- Do NOT use `/research` for deck requests — it produces a report, not slides.
