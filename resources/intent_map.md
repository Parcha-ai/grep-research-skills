# Intent → API mapping

Used by `grep-domain-expert`, `grep-build-*`, and `grep-research-workflow` skills to translate a user's natural-language request into the right `POST /api/v2/research` body.

| Phrase fragment | Request body fields |
|---|---|
| "make / build / create a slidedeck about X" | `{question: "X", output_type: "slidedeck"}` |
| "make / build / create a spreadsheet of X" | `{question: "X", output_type: "spreadsheet"}` |
| "build me an interactive app / tool / dashboard for X" | `{question: "X", output_type: "html_app"}` |
| "deep / thorough / comprehensive research on X" | `{question: "X", effort: "high"}` |
| "quick / fast lookup on X" | `{question: "X", effort: "low"}` |
| "use the legal expert for X" | `{question: "X", expert_id: "legal-research-case-law-expert"}` |
| "background check / due diligence on person Y" | `{question: "Background check on Y", expert_id: "people-due-diligence-expert"}` |
| "due diligence on company Z" | `{question: "Due diligence on Z", expert_id: "corporate-due-diligence-expert"}` |
| "patent landscape for X" | `{question: "Patent landscape for X", expert_id: "patent-research-ip-expert"}` |
| "clinical trials for drug / disease X" | `{question: "Clinical trials for X", expert_id: "medical-research-clinical-trials-expert"}` |
| "real estate analysis for address X" | `{question: "Real estate analysis for X", expert_id: "real-estate-property-expert"}` |
| "supply chain mapping for product X" | `{question: "Supply chain for X", expert_id: "supply-chain-global-trade-expert"}` |
| "vessel tracking / maritime intel on X" | `{question: "Maritime intel on X", expert_id: "maritime-intelligence-expert"}` |
| "decode VIN X" | `{question: "Decode VIN X", expert_id: "vehicle-research-vin-expert"}` |
| "produce a podcast about X" | `{question: "Podcast about X", expert_id: "media-producer"}` |
| "produce a video / news broadcast about X" | `{question: "Video about X", expert_id: "media-producer"}` |
| "trending news on X" | `{question: "Trending news on X", expert_id: "real-time-intelligence-expert"}` |
| "research X and then make me a deck / spreadsheet about it" | `grep-research-workflow` |
| "follow up on / continue / go deeper on (job <slug>)" | `grep-continue` → `POST /api/v2/research/<slug>/continue` |
| "research X using my attached PDFs" | `grep-with-context` → upload then `attachment_ids=[…]` |

## Effort defaults

If the phrase doesn't include an effort signal:

- Default `effort: "medium"` (covers most "research X" requests)
- "quick" / "fast" / "check" → `low`
- "deep" / "thorough" / "comprehensive" / "investigation" → `high`
- "build a / make a / create a" → `output_type` sugar handles `effort=build` automatically

## Pricing reminder (gateway / PAYG)

On the gateway surface, each tier costs:

- `effort=low` → 40¢ (or 2¢ on the freshly-funded-wallet promo, first 3 jobs)
- `effort=medium` → $2.00
- `effort=high` → $10.00
- `effort=build` → $2.00

Each GET (poll, files, timeline) costs 1¢. v2 surface bills against the user's Descope-tied subscription instead — no per-call charge for authenticated users on a paid tier.
