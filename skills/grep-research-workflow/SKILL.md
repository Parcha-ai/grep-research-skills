---
name: grep-research-workflow
description: Multi-step research workflow — chains a quick orientation pass, then a deep investigation, then optional ultra-research, then an optional build artifact (slidedeck / app / spreadsheet). Use when the user wants thorough end-to-end research with a deliverable, says "do a full investigation on X", "research and then make me a presentation about X", or "comprehensive analysis of Y with a writeup". Threads job_ids through reference_jobs so each step builds on the prior step's findings without re-running them.
---

# Multi-Step Research Workflow

Chains 2-3 Grep jobs together: a cheap orientation pass to scope the topic, then a deep investigation on the most interesting angle, then optionally a build artifact (slidedeck / app / spreadsheet) materialising the findings. Each step inherits the prior step's research context via `--reference-jobs=`, so later steps don't re-investigate the same ground.

## When to use this skill vs the others

| User wants | Use |
|---|---|
| One-shot research report | `/research`, `/quick-research`, `/ultra-research` |
| One-shot deliverable (deck, app, spreadsheet) | `/grep-build-slidedeck`, `/grep-build-app`, `/grep-build-spreadsheet` |
| **End-to-end: investigate AND deliver** | **`/grep-research-workflow`** (you are here) |
| Domain-specific single research call | `/grep-domain-expert` |

Concrete signals: "investigate X and then make me a deck", "do a full investigation with a presentation", "comprehensive analysis of Y with a writeup", "research X and then build me a tool", "deep dive then summarise".

If the user only wants a single research output, use the one-shot skill. The workflow's value is in the **chained context** — the deck or app builds on real research findings, not a fresh investigation.

## Auto-update check

```bash
node "$SCRIPTS_DIR/update-check.js" 2>/dev/null &
```

## Prerequisites

```bash
node "$SCRIPTS_DIR/auth.js" status
```

If `"authenticated": false`, **automatically invoke `/grep-login`**.

A 3-step workflow can cost ~$13 on the gateway PAYG (low orientation + high deep-dive + build artifact). Tell the user the total cost up front before submitting.

## Resolve script + resources paths

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
RESOURCES_DIR="$(dirname "$SCRIPTS_DIR")/resources"
```

## Step 1: Plan the workflow

The default 3-step sequence:

1. **Orient** — `--effort=low` (~30-90s, $0.40 PAYG). Cheap pass that establishes scope, names key entities, surfaces unknowns.
2. **Deep dive** — `--effort=high` (5-10 min, $10 PAYG). Takes the most interesting angle from Step 1 and investigates it thoroughly, passing `--reference-jobs=<step1>` so the inheritance kicks in.
3. **Materialise** (optional) — `--output-type=slidedeck|spreadsheet|html_app` (10-15 min, $2 PAYG). Builds the deliverable from Step 2's findings, passing `--reference-jobs=<step2>`.

Variants:

- **2-step (skip the build)**: orient → deep-dive. Use when the user just wants a comprehensive written report.
- **2-step (skip the orient)**: deep-dive → materialise. Use when the user already gave a precise scope ("here are the 5 vendors I want compared, build the spreadsheet").
- **3-step with domain routing**: orient → `--expert-id=<X>` deep-dive → materialise. Use when Step 2 should run on a specific domain expert (legal, medical, patent, etc.).

`resources/chaining_examples.md` has 3 worked examples — read it for patterns.

## Step 2: Confirm the plan with the user

Use **AskUserQuestion** to confirm the workflow before kicking off. Show the plan + total estimated cost + duration. Options should let the user:

- Confirm the default plan
- Change the artifact type (slidedeck → spreadsheet, etc.)
- Drop the build step (orient + deep-dive only)
- Add a specific domain expert to Step 2

Example question:

> "Workflow plan: (1) cheap orientation pass on Anthropic, (2) high-effort deep dive on the most interesting angle, (3) investor slidedeck. Total ~$13 PAYG, ~25 min. Does that match what you want?"
>
> Options: **Confirm**, Change artifact (deck → app / spreadsheet), Drop the build step, Other

Skip this step only if the user's request is unambiguous AND they explicitly said "just go".

## Step 3: Submit Step 1 (orient)

```bash
JOB1_OUT=$(node "$SCRIPTS_DIR/grep-api.js" run \
  "<orientation question>" \
  --effort=low --max-wait=120 2>&1)
```

Use **Monitor** (`timeout_ms: 150000`, `persistent: false`). When it completes, capture the `slug` from the result. The submit response includes `job_id` and `slug` — the slug is preferred for downstream `--reference-jobs=` (more readable in logs, accepted by the API).

Tell the user briefly: "Step 1/3 (orientation) done. Moving to deep dive."

## Step 4: Submit Step 2 (deep dive) with `--reference-jobs=<step1_slug>`

```bash
JOB2_OUT=$(node "$SCRIPTS_DIR/grep-api.js" run \
  "<deep-dive question, refined based on Step 1's findings>" \
  --effort=high --reference-jobs=$JOB1_SLUG --max-wait=540 2>&1)
```

`--effort=high` runs up to 1 hour and **cannot be block-waited** via `run` — the bash 10-min cap or even the script's 540s default will time out. Two options:

- **Use `/ultra-research`'s polling pattern** for Step 2 — submit non-blocking with `research`, then `/loop` cron every 5 min until complete. Workflow becomes async.
- **Cap Step 2 at `--effort=medium`** (5 min, $2 PAYG) if the user is OK with less depth. This keeps the workflow synchronous and cheaper.

Pick based on the user's time budget. If they said "comprehensive" / "thorough" / "exhaustive" → use the `/loop` pattern with `--effort=high`. Otherwise → `--effort=medium` and stay synchronous.

Tell the user: "Step 2/3 (deep dive) running. This takes <5 min / up to 1 hour>."

## Step 5: Submit Step 3 (build artifact) with `--reference-jobs=<step2_slug>`

If the user opted into a build step:

```bash
JOB3_OUT=$(node "$SCRIPTS_DIR/grep-api.js" run \
  "<artifact request, referencing Step 2's findings>" \
  --output-type=<slidedeck|spreadsheet|html_app> \
  --reference-jobs=$JOB2_SLUG --max-wait=1800 2>&1)
```

Use **Monitor** (`timeout_ms: 1800000`).

Tell the user: "Step 3/3 (building <artifact>) running. ~10-15 min."

## Step 6: Present the chain

Once all steps complete, present:

1. **The deep-dive report** (Step 2's output) — this is the substantive content
2. **The artifact URL** (Step 3's `index.html` / `slides.html`) — link with viewing instructions
3. **Job links to all 3 steps** so the user can drill into the orientation pass or re-run Step 3 with a different artifact type via `/grep-continue`

Example presentation:

> "**Done.** Here's what I found and built:
>
> **Investigation** (job: <step2-slug>):
> [executive summary from Step 2's report]
>
> **Slidedeck** (job: <step3-slug>):
> https://api.grep.ai/api/v2/research/<step3-slug>/files/slides.html
> Arrow keys to navigate, `?print-pdf` for PDF export.
>
> **Trace:**
> - Orient: https://grep.ai/research/<step1-slug>
> - Deep dive: https://grep.ai/research/<step2-slug>
> - Slidedeck: https://grep.ai/research/<step3-slug>"

## Step 7: Suggest follow-ups

Common follow-ups:

- "Make a different artifact from the same research" → `/grep-continue <step2-slug> "Now build a spreadsheet of the findings" --output-type=spreadsheet`
- "Go deeper on one finding" → `/grep-continue <step2-slug> "Deep dive on [finding X]"`
- "Same workflow, different topic" → re-invoke `/grep-research-workflow` with the new topic

## Anti-patterns

- **Don't skip Step 1** when the user's query is broad. The cheap orient pass is what makes Step 2's deep dive efficient. Skipping it costs more (Step 2 wastes effort scoping) and produces worse results.
- **Don't pass ALL prior jobs** into `reference_jobs` — only the immediate parent. Grep inherits transitively if needed.
- **Don't exceed 3 steps** without a clear reason. The user loses the thread; costs balloon; Step 4+ rarely outperforms a deeper Step 2.
- **Don't use `--reference-jobs` for unrelated questions.** Start a fresh job. Use `/grep-continue` only for genuine continuations within the same topic.
- **Don't block-wait `--effort=high` via `run`** — use the `/ultra-research` polling pattern (research + `/loop` cron) or drop to `--effort=medium`.
- **Don't submit without confirming the plan + total cost** when the workflow exceeds $5 estimated. The user should be aware that a 3-step chain with effort=high in Step 2 costs ~$13 PAYG.
- **Don't present partial results.** Wait until all steps complete (or fail explicitly) before responding. The value of this skill is the chain — partial output looks like a regular `/research` call that didn't materialise.

## If a step fails

- **Step 1 fails:** retry once. If still failing, fall back to `/research` for the user's original question — don't drag them through a broken workflow.
- **Step 2 fails:** Step 1's output is still useful. Present Step 1's report, tell the user "Step 2 (deep dive) failed: <reason>. Want me to retry, or pivot to /research with the orientation as context?"
- **Step 3 fails:** Steps 1 + 2 are still useful. Present the deep-dive report, tell the user "Step 3 (building <artifact>) failed: <reason>. The investigation is complete — want me to retry the build with /grep-build-<X>?"

## Cost reference

See `resources/chaining_examples.md` for worked-out cost tables. Quick gist on the gateway PAYG:

- Pure 2-step research (orient + deep): ~$10.55
- 3-step with build: ~$13.15
- 2-step shortcut (skip orient): ~$12.12

On v2 (Descope/API-key auth), polls are free — only the writes count against the user's subscription.
