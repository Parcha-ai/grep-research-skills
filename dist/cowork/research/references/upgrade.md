# GREP Upgrade

Help the user choose a subscription plan or upgrade their existing one. Presents plan options, creates a Stripe checkout session, and opens the payment page.

## Step 1: Check waitlist and subscription status

First, check if the user is waitlisted:

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/billing.js" waitlist
```

If `on_waitlist` is `true`:
> "You're currently on the GREP waitlist. We'll email you when your account is activated. Check back with the status workflow."

Do NOT present plan options to waitlisted users. Stop here.

If not waitlisted, check their current plan:

```bash
node "$SCRIPTS_DIR/billing.js" status
```

Key response fields:
- `tier` — current plan: `"free"`, `"basic"`, `"pro"`, `"ultra"`, `"payg"`
- `credits_remaining` — credits left this period
- `credit_quota` — total credits per period
- `subscription_status` — `"active"`, `"canceled"`, `"past_due"`, or absent for free

Use this to tailor the presentation.

## Step 2: Present plan options

Use **AskUserQuestion**:

**For free-tier users:**
- Header: "Choose your GREP plan"
- Question: "Which plan would you like?"
- Options:
  - "Try Free" — "Start with 100 free credits. No card required. ~10 deep research jobs."
  - "Pro ($200/mo)" — "1,500 credits/month. ~150 deep research jobs. All features including exports, slides, API access, priority queue."
  - "Ultra ($500/mo)" — "4,500 credits/month. ~450 deep research jobs. Everything in Pro with maximum throughput."
  - "Pay As You Go" — "No subscription. Deposit any amount ($10 min), pay $0.20/credit."

**For paid users:** Show current plan and credits, offer upgrade to next tier.

## Step 3: Handle the choice

### If "Try Free"

No action needed:
> "You're all set with 100 free credits. Run `/research "your topic"` to get started. Upgrade anytime."

### If "Pro" or "Ultra"

Ask about billing interval via **AskUserQuestion**:
- Question: "Monthly or annual billing? Annual saves ~17% (2 months free)."
- Options: "Monthly", "Annual"

Create checkout session:
```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/billing.js" checkout <tier> <month|year>
```

Open the `checkout_url` from the response:
```bash
open "<checkout_url>"
```
On Linux use `xdg-open`, on WSL use `wslview`.

Tell the user:
> "Opening Stripe checkout in your browser. Complete payment there, then come back. Your plan activates immediately."

### If "Pay As You Go"

Ask for deposit amount via **AskUserQuestion**:
- Question: "How much would you like to deposit? Minimum $10. Credits cost $0.20 each."
- Options: "$10", "$20", "$50", "Custom amount"

If custom, ask for the dollar amount in a follow-up.

Convert to cents and activate:
```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/billing.js" payg <amount_cents>
```

Open the `checkout_url` from the response.

## Step 4: Confirm activation

After the user returns from Stripe:

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/billing.js" status
```

If tier changed from "free": "You're now on the {tier} plan with {credits_remaining} credits."

If unchanged (webhook delay): "Payment received — plan should activate within a minute. Run the status check to verify."

## Anti-patterns

- Do NOT hardcode Stripe URLs — always use `checkout_url` from the API response.
- Do NOT present upgrade options to waitlisted users.
- Do NOT ask for credit card details — Stripe Hosted Checkout handles payment collection.
- Do NOT poll checkout status in a loop — check once when the user says they've completed.
