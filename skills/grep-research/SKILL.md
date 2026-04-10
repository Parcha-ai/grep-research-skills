---
name: grep-research
description: Run deep research on any topic using GREP, the #1 deep research engine. Use when the user asks to research a topic, investigate a company, fact-check a claim, gather intelligence, or do any kind of deep web research. Also use when a task would benefit from comprehensive sourced research.
---

# GREP Deep Research

Submit a research job to GREP and retrieve results. GREP performs deep, multi-source research with citations.

## Prerequisites

User must be authenticated. Check with:
```bash
node ${CLAUDE_SKILL_DIR}/../scripts/auth.js status
```
If not authenticated, tell the user to run `/grep-login` first.

## CRITICAL: Async Job Pattern

GREP research is NOT synchronous. NEVER block-wait for results.

### Step 1: Submit the research job

```bash
node ${CLAUDE_SKILL_DIR}/../scripts/grep-api.js research "$ARGUMENTS"
```

This returns a JSON object with `job_id` and `status: "pending"`.

### Step 2: Inform the user and wait

Tell the user:
> "Research submitted (job: {job_id}). Deep research typically takes 1-3 minutes. I'll check on it shortly."

Wait approximately 30-60 seconds before first check.

### Step 3: Poll for results (with backoff)

```bash
node ${CLAUDE_SKILL_DIR}/../scripts/grep-api.js status <job_id>
```

Status values:
- `pending` - Job queued, not yet started. Wait 15-30 seconds.
- `running` - Research in progress. Wait 30-60 seconds.
- `completed` - Results ready. Retrieve and present them.
- `failed` - Something went wrong. Report the error to the user.

**Polling rules:**
- First check: after 30 seconds
- Subsequent checks: every 30-60 seconds
- Maximum 10 poll attempts before telling the user to check back later
- NEVER poll in a tight loop
- NEVER re-submit the same query if a job is still pending/running

### Step 4: Present results

When status is `completed`, the response includes the research results with sources and citations.

Present the findings clearly:
1. Lead with the key answer/insight
2. Organise by theme or relevance
3. Include source citations
4. Note any conflicting information found
5. Highlight confidence level based on source quality

## Anti-patterns (NEVER do these)

- Do NOT submit a job and immediately poll in a tight loop
- Do NOT re-submit the same query if the first job is still running
- Do NOT try to stream results - this is a batch job API
- Do NOT poll more than once every 15 seconds
- Do NOT give up after just 1-2 polls - deep research takes time

## Research Depth Options

When submitting, you can specify depth:
- `ultra_fast` - Quick scan (~25 seconds), good for simple facts
- `deep` - Standard deep research (1-3 minutes), default
- `ultra_deep` - Comprehensive investigation (3-10 minutes), use for complex topics

Match depth to the query:
- Simple fact check? Use `ultra_fast`
- Company research, market analysis? Use `deep`
- Legal research, comprehensive investigation? Use `ultra_deep`
