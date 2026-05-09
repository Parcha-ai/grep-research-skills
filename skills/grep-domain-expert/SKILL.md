---
name: grep-domain-expert
description: Route research to the right Grep public domain expert (legal, medical, patent, financial, real estate, supply chain, maritime, etc.). Use when the user mentions a specialised domain ("legal research", "patent landscape", "biotech clinical trials", "real estate due diligence", "supply chain mapping") OR says "use the X expert". The skill reads resources/experts.md (snapshot of GET /api/v2/experts), picks the best match by keyword + sample-question similarity, and submits a research job with explicit expert_id.
---

# Domain Expert Research

Routes a research question to one of Grep's 27 public domain experts. Each expert is tuned for a specific vertical (legal case law, clinical trials, patent prior art, vessel tracking, etc.) and returns sharper results than the generalist tier when the question fits.

## When to use this skill vs the others

| Trigger | Skill |
|---|---|
| Generalist research (no specific domain) | `/research` or `/quick-research` |
| **User names a domain** ("legal research on X", "patent landscape for Y") | **`/grep-domain-expert`** |
| **User asks for a deliverable** (slidedeck, spreadsheet, app) | `/grep-build-slidedeck`, `/grep-build-spreadsheet`, `/grep-build-app` |
| Multi-step: investigate then build | `/grep-research-workflow` |

If the user's intent is genuinely general ("what is Anthropic?", "summarise this paper"), fall back to `/research` — don't force an expert match.

## Auto-update check

On first use per session, silently check for updates (throttled to once per hour):

```bash
node "$SCRIPTS_DIR/update-check.js" 2>/dev/null &
```

Run in background — must never delay the research.

## Prerequisites

The user must be authenticated. Before running any API call, check auth status:

```bash
node "$SCRIPTS_DIR/auth.js" status
```

If `"authenticated": false`, **automatically invoke `/grep-login`** — don't just tell the user to do it. Run the login flow, then continue once authenticated.

## Resolve script + resources paths

The skill dir is usually symlinked, so always resolve via the canonical SKILL.md location. `scripts/` and `resources/` sit next to `skills/` in the install layout:

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
RESOURCES_DIR="$(dirname "$SCRIPTS_DIR")/resources"
```

## Step 1: Read the expert catalog

Read `$RESOURCES_DIR/experts.md` to get the 27 expert IDs, their domains, and sample questions. The agent reads it directly — there's no script wrapper.

```bash
cat "$RESOURCES_DIR/experts.md"
```

This is the source of truth. The live `GET /api/v2/experts` endpoint is the canonical version; the markdown is a hand-maintained snapshot kept in drift-tracked sync (see `.github/workflows/sync-experts.yml`, lands in PR 10).

## Step 2: Match the user's intent to an expert

Two-step process:

1. **Keyword scan.** Read the user's request. For each row in the experts table, score by overlap with the expert's `domain` and the sample question. Top 1-3 candidates.
2. **Confidence check:**
   - **One strong match** (clear single winner — e.g. "patent landscape for transformers" → `patent-research-ip-expert`): proceed silently.
   - **Two or three close matches** (e.g. "research Sam Altman" could be `people-due-diligence-expert` or `corporate-due-diligence-expert` if Sam wears multiple hats): use **AskUserQuestion** with the candidates as options. Each option's description should be the expert's sample question so the user can recognise the right fit.
   - **No clear match** (the question is genuinely general): bail out and tell the user "I'd recommend `/research` for this — none of the domain experts fit cleanly." Don't force `general-expert` unless the user explicitly asked for it.

Heuristics for ambiguous cases:

- "due diligence on COMPANY" → `corporate-due-diligence-expert`
- "due diligence on PERSON" / "background check" → `people-due-diligence-expert`
- "AML / sanctions / KYB on a company" → `business-aml-compliance-expert`
- "AML / PEP / sanctions on a person" → `individual-aml-compliance-expert`
- "trending news / breaking" → `real-time-intelligence-expert`
- "podcast / video / news broadcast" → `media-producer` (with `--output-type=podcast|video|news_broadcast`)

## Step 3: Refine the query

Before submitting, refine the raw user question to match the chosen expert's sample-question style. Don't just pass `$ARGUMENTS` verbatim — make it specific.

Example:
- Raw: "patents for transformers"
- Refined: "Patent landscape for transformer architecture variations — focus on US/EP filings 2017-2025, key assignees, and notable claim language."

The refined query should include:
- The specific question (not just a topic)
- Any constraints the user mentioned (geography, time range, depth)
- Output expectations (table, comparison, summary, etc.)

## Step 4: Pick effort tier

Default by user signal:

- "quick" / "fast" / "just a check" → `--effort=low` (~25s, $0.40 PAYG)
- (no signal) → `--effort=medium` (~5min, $2.00 PAYG)
- "deep" / "thorough" / "comprehensive" / "investigation" → `--effort=high` (up to 1hr, $10.00 PAYG)

Note that `effort=high` runs up to an hour and **cannot be block-waited via `run`** — for high effort, use `/ultra-research` instead (it submits + polls across turns via `/loop`).

## Step 5: Submit — use Monitor (background), NOT blocking Bash

```bash
node "$SCRIPTS_DIR/grep-api.js" run "<refined_query>" --expert-id=<chosen-id> --effort=<low|medium> --max-wait=540 2>&1
```

Run with **Monitor** (`timeout_ms: 560000`, `persistent: false`). With `2>&1`, status updates and the final report stream as events.

Tell the user: "Routing to the **<Display Name>** expert. This takes about <time>."

### `effort=high` requires the async pattern, not `/ultra-research` delegation

`effort=high` jobs run up to an hour and must use the same submit-then-poll pattern `/ultra-research` uses. **Do not invoke `/ultra-research` with `$ARGUMENTS` containing `--expert-id=...`** — that skill quotes the entire argument string into the query and the flag is silently swallowed.

Instead, run the same two steps `/ultra-research` runs, but with `--expert-id` on the `research` call:

```bash
# 1. Submit non-blocking with the expert-id flag
SUBMIT=$(node "$SCRIPTS_DIR/grep-api.js" research "<refined>" \
  --expert-id=<chosen-id> --effort=high)
SLUG=$(echo "$SUBMIT" | jq -r '.slug // .job_id // .id')

# 2. Schedule a /loop cron (5-minute interval) that polls and self-terminates
#    on completion — mirrors the /ultra-research pattern verbatim.
```

Pass the captured `$SLUG` into the same `/loop` cron prompt `/ultra-research` uses (see `skills/ultra-research/SKILL.md` Step 3). The polling loop, presentation, and CronDelete-on-complete logic are identical — only the submit command differs.

## Step 6: Present results

When the Monitor notification arrives:

1. Read the output file from the task notification
2. Lead with **the expert that ran**: "I used the **Legal Research** expert for this:"
3. Present the report cleanly — preserve headings, citations, structure
4. If the user asked a follow-up, suggest `/grep-continue` instead of a fresh job (cheaper, builds on context)

## Anti-patterns

- Do NOT pick an expert if the user's question is genuinely general — fall through to `/research` and let v2 auto-select. Forcing `general-expert` when `/research` would do is wasted UX.
- Do NOT pass an expert ID that's not in the catalog — the API will 422. Always check the table.
- Do NOT pass `--effort=high` to `run` (the blocking command). High effort can take an hour and will hit the bash 10-min cap. Use `/ultra-research` for high effort.
- Do NOT skip the refine-query step. Passing `$ARGUMENTS` raw is the difference between a generic answer and an actionable one.
- Do NOT silently fall back to `general-expert` when matching is ambiguous — ask the user.
- Do NOT try to read `experts.md` from CWD or a hardcoded path. Always resolve via `$RESOURCES_DIR` because the skill is symlinked.

## Drift check (when you suspect the catalog is stale)

If a curl against `https://api.grep.ai/api/v2/experts` returns an ID that's not in `resources/experts.md` (or vice versa), the snapshot has drifted. Open an issue or PR to refresh — the `.github/workflows/sync-experts.yml` workflow (PR 10) automates this nightly.
