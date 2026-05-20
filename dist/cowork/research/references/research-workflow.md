# Multi-Step Research Workflow

Chains multiple Grep jobs into a coordinated workflow: orient → deep dive → optional build artifact. Use when the user wants research AND a deliverable, or when one job's output should inform the next.

## When to use this vs. a single skill

- "Research X and make a deck about it" → workflow (research first, then deck with research as context)
- "Investigate X" alone → use **deep research** instead (route 1)
- "Make a deck about X" alone → use **build-slidedeck** instead (route 11)

The workflow's value is the chaining — passing research findings as `--context-file` to the build step so the deck/app/spreadsheet is grounded in cited research.

## Step 1: Tell the user up front

> "I'll chain N jobs: first research (~5 min), then build the deliverable (~10-15 min). Total ~20 min, counts against your subscription tier accordingly. Streaming live updates."

## Step 2: Plan the chain

Identify each step before starting:

1. **Orient** (optional, `effort=low`, ~25s) — quick scan of the topic to surface key entities/angles. Skip if the topic is well-defined.
2. **Deep dive** (`effort=medium` or `high`) — the main research job. Use a domain expert if applicable.
3. **Build** (optional, `effort=build`) — deck, app, or spreadsheet, with deep-dive report as context.

## Step 3: Gather codebase context (once, for all steps)

Apply the shared context pattern. The same context file gets reused across steps.

## Step 4: Run step 1 (orient) — optional

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/grep-api.js" run "Quick orientation: what are the key dimensions of <topic>?" \
  --effort=low --max-wait=80 2>&1
```

Monitor with `timeout_ms: 80000`. The output informs the deep-dive prompt.

## Step 5: Run step 2 (deep dive)

Use the orient findings (or skip directly here) to write a precise deep-dive prompt. Optionally pass an `--expert-id`.

```bash
node "$SCRIPTS_DIR/grep-api.js" run "<refined_deep_dive_prompt>" \
  --effort=medium --max-wait=540 \
  --context-file="$CONTEXT_FILE" 2>&1
```

Monitor with `timeout_ms: 560000`.

**Capture the report path** — `grep-api.js run` writes the final report to stdout. Save it:

```bash
REPORT_FILE=$(mktemp /tmp/grep-deep-report.XXXXXX.md)
# (Monitor will surface the output; copy it into $REPORT_FILE for step 6)
```

## Step 6: Run step 3 (build) — optional

Combine the original context + research report as the new context for the build:

```bash
BUILD_CONTEXT=$(mktemp /tmp/grep-build-context.XXXXXX)
cat "$CONTEXT_FILE" > "$BUILD_CONTEXT"
echo "" >> "$BUILD_CONTEXT"
echo "=== PRIOR RESEARCH REPORT ===" >> "$BUILD_CONTEXT"
cat "$REPORT_FILE" >> "$BUILD_CONTEXT"

node "$SCRIPTS_DIR/grep-api.js" run "<build_prompt>" \
  --output-type=slidedeck --max-wait=1800 \
  --context-file="$BUILD_CONTEXT" 2>&1
```

Substitute `--output-type=html_app` or `--output-type=spreadsheet` as appropriate.

Monitor with `timeout_ms: 1800000`.

Clean up after: `rm -f "$CONTEXT_FILE" "$REPORT_FILE" "$BUILD_CONTEXT"`.

## While each step runs: DO NOT narrate

Each step is its own Monitor invocation. Stay silent within a step until it completes. Between steps, give a single-sentence transition: "Research done — starting the deck build now (~10-15 min)."

## Step 7: Present results

After the final step:

1. Lead with the deliverable URL (deck/app/spreadsheet).
2. Summarize the research findings in 3-5 bullets.
3. Provide source citations from the research report.

```
API_BASE="${GREP_API_BASE:-https://api.grep.ai}"
echo "Deck: $API_BASE/api/v2/research/<build_slug>/files/index.html"
echo "Underlying research: $API_BASE/research/<research_slug>"
```

## Anti-patterns

- Do NOT run all steps in parallel — they depend on each other (research output feeds build input).
- Do NOT skip the deep-dive context-attach when running the build step — that's the whole point of chaining.
- Do NOT narrate Monitor events within a step.
- Do NOT abandon mid-chain — if step 2 takes 7 minutes, that's fine, wait for it before triggering step 3.
- Do NOT use this for simple research — single-step `/research` is cheaper and faster.
