<!-- Auto-generated from GET https://api.grep.ai/api/v2/experts -->
<!-- 27 public experts. Drift-tracked via .github/workflows/sync-experts.yml. -->

# Grep public experts

The 27 expert IDs accepted on `POST /api/v2/research`'s `expert_id` field. Use this table to route a user's question to the right specialist.

| expert_id | Display name | Domain / specialty | Sample question | Output types |
|---|---|---|---|---|
| `app-builder` | App Builder | Full-Stack Development, Interactive HTML Apps | Build an interactive HTML app comparing the top 5 LLM providers | html_app, slidedeck, spreadsheet |
| `business-aml-compliance-expert` | Know Your Business | AML / KYB | Sanctions + adverse-media + UBO screening for a US business | report |
| `corporate-due-diligence-expert` | Corporate Due Diligence | Company Due Diligence | Run due diligence on Anthropic — funding, leadership, risk signals | report |
| `crypto-market-analyst` | Crypto Analyst | Cryptocurrency | Token research and on-chain market analysis | report |
| `financial-markets-expert` | Financial Markets | Stock Markets, Equities | Analyze NVIDIA's earnings vs analyst expectations | report |
| `general-expert` | Open | General | What is Anthropic? | report |
| `government-research-compliance-expert` | Government & Compliance | Federal contracts, regulation | Federal contractors in the AI safety space | report |
| `gtm-strategy-expert` | GTM Strategy | Go-To-Market | Account-based prospecting for vertical AI tools | report |
| `individual-aml-compliance-expert` | Know Your Customer | KYC / AML (individuals) | PEP + sanctions + adverse-media screening for a person | report |
| `insurance-industry-expert` | Insurance | Insurance research | Underwriting trends in cyber liability insurance | report |
| `legal-research-case-law-expert` | Legal Research | Case Law | Find precedent case law on AI copyright in the 9th Circuit | report |
| `maritime-intelligence-expert` | Maritime | Vessel tracking | Track Liberian-flagged tankers transiting the Strait of Hormuz | report |
| `marketing-competitive-intelligence-expert` | Marketing Intel | Brand & Competitive | Brand health analysis for Stripe vs Adyen | report |
| `media-producer` | Media Producer | AV Production | Produce a 5-minute podcast on the history of stablecoins | podcast, video, news_broadcast |
| `medical-research-clinical-trials-expert` | Medical Research | Clinical Trials | Latest clinical trials for GLP-1 agonists in Alzheimer's | report |
| `northflank-platform-expert` | Northflank Platform Expert | Cloud DevOps | Deploy a multi-region service on Northflank | report |
| `patent-research-ip-expert` | Patent & IP | Prior Art | Patent landscape for transformer architecture variations | report |
| `people-due-diligence-expert` | People Due Diligence | Person Research | Background research on Sam Altman | report |
| `real-estate-property-expert` | Real Estate | Property Research | Estimate the rental yield for 123 Main St, Austin TX | report |
| `real-time-intelligence-expert` | Real-Time Intel | Trending / Breaking News | What's trending today on AI safety | report |
| `space-science-research-expert` | Space Science | NASA / Academic | Latest JWST findings on early-universe galaxies | report |
| `supply-chain-global-trade-expert` | Supply Chain | Global Trade | HS-code-level analysis of US semiconductor exports to Taiwan | report |
| `technology-intelligence-expert` | Tech Intel | Tech Architecture / AI | Compare RAG architectures used by Anthropic, OpenAI, Google | report |
| `travel-hospitality-expert` | Travel | Flights / Hotels | Plan a 7-day Tokyo itinerary, mid-range budget, foodie focus | report |
| `us-government-policy-expert` | U.S. Policy | Federal Policy | Recent CFIUS policy changes affecting Chinese investments | report |
| `vehicle-research-vin-expert` | Vehicle Research | VIN / Automotive | Decode VIN 1HGCM82633A123456 and pull recall history | report |
| `youtube-expert` | YouTube | Video Search / Transcripts | Find tutorials on x402 protocol implementation | report |

## How to pick

- **General / unspecified domain** → `general-expert`
- **Specific domain mentioned** → match the domain column
- **Asked for a deliverable beyond a report** → `app-builder` (slidedeck/spreadsheet/HTML app) or `media-producer` (podcast/video)
- **Multiple domains touched** → pick the one most central to the user's intent; the chosen expert can still call cross-domain tools

## How to verify (drift check)

```bash
curl -s https://api.grep.ai/api/v2/experts | jq -r '.[].id' | sort > /tmp/live.txt
grep -oP '^\| `\K[a-z0-9-]+(?=`)' resources/experts.md | sort -u > /tmp/local.txt
diff /tmp/live.txt /tmp/local.txt
# No output = in sync. Output = drift; regenerate this file.
```

<!-- DRIFT DETECTED 2026-07-02T07:25:00Z -->
<!-- See workflow run: https://github.com/Parcha-ai/grep-research-skills/actions/runs/28572925952 -->
