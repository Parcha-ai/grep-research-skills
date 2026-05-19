# Multi-step research workflows

Used by the `grep-research-workflow` skill. Each example shows how to chain Grep jobs via `--reference-jobs=` so each step builds on the prior step's findings without re-running the investigation.

**Critical: each step must complete before the next is submitted.** `--reference-jobs` is resolved at submission time — if Step 1 hasn't produced findings yet, Step 2 inherits an empty context. Use `result <slug>` (which polls until complete) between submissions, not back-to-back `research` calls.

The slug-extraction one-liners below use Node (no `jq` dependency, matching the rest of the repo).

## Workflow 1 — Investigate then deck

User says: "Investigate Anthropic and then make me a slidedeck."

```bash
# Helper: extract slug from `research` JSON output without jq
extract_slug() {
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.slug||j.job_id||j.id||'')}"
}

# Step 1: orient (~30-90s, $0.40 PAYG)
JOB1=$(node "$SCRIPTS_DIR/grep-api.js" research \
  "Orientation pass on Anthropic — funding, products, leadership, recent news" \
  --effort=low | extract_slug)
node "$SCRIPTS_DIR/grep-api.js" result "$JOB1" >/dev/null  # block until complete

# Step 2: deep dive on the most interesting angle from Step 1 (~5-10min, $10 PAYG)
# effort=high → use the /loop pattern, or drop to effort=medium for synchronous
JOB2=$(node "$SCRIPTS_DIR/grep-api.js" research \
  "Deep dive on Anthropic's enterprise / API revenue strategy and competitive moat" \
  --effort=medium --reference-jobs="$JOB1" | extract_slug)
node "$SCRIPTS_DIR/grep-api.js" result "$JOB2" >/dev/null

# Step 3: materialise as slidedeck (~10-15min, $2 PAYG)
JOB3=$(node "$SCRIPTS_DIR/grep-api.js" research \
  "Investor-grade slidedeck on Anthropic's enterprise strategy" \
  --output-type=slidedeck --reference-jobs="$JOB2" | extract_slug)
node "$SCRIPTS_DIR/grep-api.js" result "$JOB3"
```

Each step's `--reference-jobs=$PRIOR_JOB` makes that step inherit the prior job's research context. The `result <slug>` between submissions is the synchronisation point — without it, Step 2 might start before Step 1 has produced any findings.

## Workflow 2 — Compare then build

User says: "Compare top 5 LLM providers and build me an interactive dashboard."

```bash
extract_slug() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.slug||j.job_id||j.id||'')}"; }

# effort=high → drop to medium for synchronous, or use /loop pattern for full high
JOB1=$(node "$SCRIPTS_DIR/grep-api.js" research \
  "Compare top 5 LLM providers on cost, context, features, latency" \
  --effort=medium | extract_slug)
node "$SCRIPTS_DIR/grep-api.js" result "$JOB1" >/dev/null

JOB2=$(node "$SCRIPTS_DIR/grep-api.js" research \
  "Interactive dashboard from this comparison" \
  --output-type=html_app --reference-jobs="$JOB1" | extract_slug)
node "$SCRIPTS_DIR/grep-api.js" result "$JOB2"
```

## Workflow 3 — Domain-route then summarise

User says: "Patent landscape for transformers, then a one-page exec summary."

```bash
extract_slug() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.slug||j.job_id||j.id||'')}"; }

# Step 1: effort=high — use the /loop pattern (this snippet shows synchronous medium for brevity)
JOB1=$(node "$SCRIPTS_DIR/grep-api.js" research \
  "Patent landscape for transformer architecture variations" \
  --expert-id=patent-research-ip-expert --effort=medium | extract_slug)
node "$SCRIPTS_DIR/grep-api.js" result "$JOB1" >/dev/null

JOB2=$(node "$SCRIPTS_DIR/grep-api.js" research \
  "One-page exec summary of the patent landscape" \
  --effort=low --reference-jobs="$JOB1" | extract_slug)
node "$SCRIPTS_DIR/grep-api.js" result "$JOB2"
```

The exec summary doesn't re-research the landscape — it inherits Step 1's findings and produces a condensed write-up.

### When you need `effort=high`

`effort=high` jobs run up to 1 hour and cannot be block-waited via `result` (the bash tool caps at 10 minutes). For high-effort steps, submit non-blocking and schedule a `/loop` cron that polls every 5 minutes and runs the next step on completion — same pattern `/ultra-research` uses. The synchronous `result` calls above only work for `effort=low|medium|build`.

## Anti-patterns

- **Don't pass ALL prior jobs into `reference_jobs`** — only the immediate parent. Grep inherits transitively if needed; passing the whole chain bloats the context window for no benefit.
- **Don't chain more than 3 steps** without a clear reason. The user loses the thread, costs add up, and Step 4+ rarely outperforms a single deeper Step 2.
- **Don't skip Step 1 (the orientation pass)** when the user's query is broad. The cheap `effort=low` orientation is what makes Step 2's deep dive efficient — it scopes the investigation.
- **Don't use `--reference-jobs` for unrelated topics.** If the follow-up isn't building on the prior research, start a fresh job — no `--reference-jobs`. Use `/grep-continue` for genuine continuations within the same topic.

## Quota usage

A 3-step workflow consumes one job per step against the user's v2 subscription tier:

| Step | Effort | What's billed |
|---|---|---|
| 1 (orient) | low | 1 × low-effort job |
| 2 (deep) | high | 1 × high-effort job |
| 3 (build) | build | 1 × build job |

Polls (`GET /api/v2/research/{id}`) and file reads are free for authenticated users. Run `/grep-status` to see the user's current plan and remaining quota before kicking off a 3-step chain.
