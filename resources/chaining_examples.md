# Multi-step research workflows

Used by the `grep-research-workflow` skill. Each example shows how to chain Grep jobs via `--reference-jobs=` so each step builds on the prior step's findings without re-running the investigation.

## Workflow 1 — Investigate then deck

User says: "Investigate Anthropic and then make me a slidedeck."

```bash
# Step 1: orient (~30-90s, $0.40 PAYG)
JOB1=$(node "$SCRIPTS_DIR/grep-api.js" research \
  "Orientation pass on Anthropic — funding, products, leadership, recent news" \
  --effort=low | jq -r '.job_id // .id')

# Step 2: deep dive on the most interesting angle from Step 1 (~5-10min, $10 PAYG)
JOB2=$(node "$SCRIPTS_DIR/grep-api.js" research \
  "Deep dive on Anthropic's enterprise / API revenue strategy and competitive moat" \
  --effort=high --reference-jobs=$JOB1 | jq -r '.job_id // .id')

# Step 3: materialise as slidedeck (~10-15min, $2 PAYG)
JOB3=$(node "$SCRIPTS_DIR/grep-api.js" research \
  "Investor-grade slidedeck on Anthropic's enterprise strategy" \
  --output-type=slidedeck --reference-jobs=$JOB2 | jq -r '.job_id // .id')
```

Each step's `--reference-jobs=$PRIOR_JOB` makes that step inherit the prior job's research context — the slidedeck doesn't re-investigate Anthropic, it builds the deck from Step 2's findings.

## Workflow 2 — Compare then build

User says: "Compare top 5 LLM providers and build me an interactive dashboard."

```bash
JOB1=$(node "$SCRIPTS_DIR/grep-api.js" research \
  "Compare top 5 LLM providers on cost, context, features, latency" \
  --effort=high | jq -r '.job_id // .id')

JOB2=$(node "$SCRIPTS_DIR/grep-api.js" research \
  "Interactive dashboard from this comparison" \
  --output-type=html_app --reference-jobs=$JOB1 | jq -r '.job_id // .id')
```

## Workflow 3 — Domain-route then summarise

User says: "Patent landscape for transformers, then a one-page exec summary."

```bash
JOB1=$(node "$SCRIPTS_DIR/grep-api.js" research \
  "Patent landscape for transformer architecture variations" \
  --expert-id=patent-research-ip-expert --effort=high | jq -r '.job_id // .id')

JOB2=$(node "$SCRIPTS_DIR/grep-api.js" research \
  "One-page exec summary of the patent landscape" \
  --effort=low --reference-jobs=$JOB1 | jq -r '.job_id // .id')
```

The exec summary doesn't re-research the landscape — it inherits Step 1's findings and produces a condensed write-up.

## Anti-patterns

- **Don't pass ALL prior jobs into `reference_jobs`** — only the immediate parent. Grep inherits transitively if needed; passing the whole chain bloats the context window for no benefit.
- **Don't chain more than 3 steps** without a clear reason. The user loses the thread, costs add up, and Step 4+ rarely outperforms a single deeper Step 2.
- **Don't skip Step 1 (the orientation pass)** when the user's query is broad. The cheap `effort=low` orientation is what makes Step 2's deep dive efficient — it scopes the investigation.
- **Don't use `--reference-jobs` for unrelated topics.** If the follow-up isn't building on the prior research, start a fresh job — no `--reference-jobs`. Use `/grep-continue` for genuine continuations within the same topic.

## Cost reference (PAYG / gateway)

A 3-step workflow's typical cost on the gateway:

| Step | Effort | Cost |
|---|---|---|
| 1 (orient) | low | $0.40 + ~3 polls × 1¢ = ~$0.43 |
| 2 (deep) | high | $10.00 + ~12 polls × 1¢ = ~$10.12 |
| 3 (build) | build | $2.00 + ~60 polls × 1¢ = ~$2.60 |
| **Total** |   | **~$13.15** |

On v2 (Descope/API-key auth), polls are free — only the writes count. The user's subscription absorbs the per-call cost.
