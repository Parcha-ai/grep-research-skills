# Domain Expert Routing

Grep has 27 public domain experts. Pick the right `expert_id` and the research uses that specialist's tool set + prompt instead of the general agent.

## Step 1: Pick the expert

The 27 expert IDs:

| expert_id | Domain | Use for |
|---|---|---|
| `general-expert` | General | Default if no domain mentioned |
| `legal-research-case-law-expert` | Legal / case law | Precedent, court opinions, statutory analysis |
| `medical-research-clinical-trials-expert` | Medical / trials | Clinical trials, drug pipelines, treatment efficacy |
| `patent-research-ip-expert` | Patent / IP | Prior art, patent landscape, IP licensing |
| `financial-markets-expert` | Financial markets | Equities, earnings, market analysis |
| `crypto-market-analyst` | Crypto | Token research, on-chain analysis |
| `business-aml-compliance-expert` | KYB / AML | Business sanctions, UBO, adverse media screening |
| `individual-aml-compliance-expert` | KYC / AML | Person sanctions, PEP, adverse media |
| `corporate-due-diligence-expert` | Corporate DD | Company due diligence, funding, leadership |
| `people-due-diligence-expert` | People DD | Background research on individuals |
| `real-estate-property-expert` | Real estate | Property valuation, rental yield, comparable sales |
| `supply-chain-global-trade-expert` | Supply chain | HS-codes, global trade, supplier mapping |
| `maritime-intelligence-expert` | Maritime | Vessel tracking, port activity |
| `vehicle-research-vin-expert` | Vehicle / VIN | VIN decoding, recalls, automotive history |
| `insurance-industry-expert` | Insurance | Underwriting trends, policy analysis |
| `gtm-strategy-expert` | GTM | Account-based prospecting, market entry |
| `marketing-competitive-intelligence-expert` | Marketing / brand | Brand health, competitive analysis |
| `government-research-compliance-expert` | Government / compliance | Federal contracts, regulation |
| `us-government-policy-expert` | U.S. policy | Federal policy, CFIUS, regulatory changes |
| `space-science-research-expert` | Space science | NASA, academic astronomy |
| `technology-intelligence-expert` | Tech intel | Architectures, AI infrastructure |
| `real-time-intelligence-expert` | Real-time / breaking news | Trending topics, breaking events |
| `travel-hospitality-expert` | Travel | Itineraries, flights, hotels |
| `youtube-expert` | YouTube | Video search, transcript extraction |
| `northflank-platform-expert` | Northflank | DevOps on Northflank |
| `app-builder` | App builder | Use the `build-app` / `build-slidedeck` / `build-spreadsheet` routes instead |
| `media-producer` | Media / podcasts / video | Podcasts, video, news broadcasts |

If the user's domain matches multiple, pick the one most central to their intent.

## Step 2: Tell the user up front

> "Routing to the `<expert>` expert — this typically takes 5-10 minutes at `medium` effort. I'll stream live updates."

## Step 3: Run it

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/grep-api.js" run "<refined_query>" \
  --expert-id=<expert_id> --effort=medium --max-wait=540 2>&1
```

Use `--effort=low` for quick lookups (~25s, e.g. "is this VIN valid?"). Use `--effort=high` (up to 1 hr) for exhaustive expert investigations — submit non-blocking via the `research` command and poll separately.

Run with **Monitor** (`timeout_ms: 560000`, `persistent: false`). Never blocking Bash.

## While research is running: DO NOT narrate status updates

Monitor will emit progress events ("in progress (180s elapsed, poll 12)…", "Searching…"). **Stay silent until the job completes.** No "still running", no "the expert is now looking at X". If the user asks a question while research runs, answer it — you're not blocked.

## Step 4: Present results

When Monitor completes, read the output and present the report. Lead with the key finding, preserve citations, flag conflicting sources.

## Anti-patterns

- Do NOT use `general-expert` when a domain-specific expert exists — the specialist has better tools and prompts.
- Do NOT pick an expert just because the keyword matches — match the user's actual *intent*. "Patent law" could be legal OR patent depending on whether they want case precedent or prior-art mapping.
- Do NOT default to `effort=high` — start at medium, escalate only if needed.
- Do NOT narrate Monitor events — wait for completion.
- Do NOT abandon a running job because progress events feel slow. Domain expert jobs at `medium` legitimately take 5-10 minutes.
