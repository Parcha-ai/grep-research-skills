---
name: grep-upgrade
description: Choose a GREP subscription plan or upgrade your account. Use when the user wants to subscribe, upgrade, check pricing, manage their GREP plan, or after /grep-login suggests choosing a plan. Also use when a user hits quota limits or gets a "quota exceeded" error.
disable-model-invocation: true
---

# GREP Upgrade

Help the user choose a subscription plan or upgrade their existing one. Presents plan options, creates a Stripe checkout session, and opens the payment page in their browser.

## Resolve the script path

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Step 1: Check waitlist and subscription status

First, check if the user is waitlisted:

```bash
node "${SCRIPTS_DIR}/billing.js" waitlist
```

This returns `{ "on_waitlist": true/false }`. If `on_waitlist` is `true`, tell the user:
> "You're currently on the GREP waitlist. We'll email you when your account is activated. Check back with `/grep-status`."

Do NOT present plan options to waitlisted users. Stop here.

If not waitlisted, check their current plan:

```bash
node "${SCRIPTS_DIR}/billing.js" status
```

The response is JSON with these key fields:
- `tier` — current plan: `"free"`, `"basic"`, `"pro"`, `"ultra"`, `"payg"`
- `credits_remaining` — credits left this period
- `credit_quota` — total credits per period
- `subscription_status` — `"active"`, `"canceled"`, `"past_due"`, or absent for free

Use this to tailor the presentation. If the user is already on Pro or Ultra, show upgrade/management options. If free, show the full plan selection.

## Step 2: Present plan options

Use **AskUserQuestion** to let the user choose a plan. Present these options:

**For free-tier users:**

- **Try Free** — "Start with 100 free credits. No card required. Enough for ~10 deep research jobs."
- **Pro ($200/mo)** — "1,500 credits/month. ~150 deep research jobs. All features including exports, slides, API access, and priority queue."
- **Ultra ($500/mo)** — "4,500 credits/month. ~450 deep research jobs. Everything in Pro with maximum throughput."
- **Pay As You Go** — "No subscription. Deposit any amount ($10 min), pay $0.20/credit as you go."

**For users already on a paid plan:**
- Show their current plan and credits remaining
- Offer upgrade to the next tier if applicable
- Mention `/grep-status` for detailed usage info

**Question format:**
- Header: "Choose your GREP plan"
- Question: "Which plan would you like?"
- Options: "Try Free", "Pro ($200/mo)", "Ultra ($500/mo)", "Pay As You Go"

## Step 3: Handle the user's choice

### If "Try Free"

No action needed. Tell the user:
> "You're all set with 100 free credits — enough for about 10 deep research jobs. Run `/research "your topic"` to get started. You can upgrade anytime with `/grep-upgrade`."

### If "Pro" or "Ultra"

Ask about billing interval with **AskUserQuestion**:
- Question: "Monthly or annual billing? Annual saves ~17% (2 months free)."
- Options: "Monthly", "Annual"

Then create the checkout session:

```bash
node "${SCRIPTS_DIR}/billing.js" checkout <tier> <month|year>
```

The response is JSON with a `checkout_url` field. Open it in the user's browser:

```bash
open "<checkout_url>"
```

On Linux, use `xdg-open` instead. On WSL, use `wslview` or `cmd.exe /c start`.

Tell the user:
> "Opening Stripe checkout in your browser. Complete the payment there, then come back here. Your plan will activate immediately."

### If "Pay As You Go"

Ask for deposit amount with **AskUserQuestion**:
- Question: "How much would you like to deposit? Minimum $10. Credits cost $0.20 each ($2.00 per deep research job)."
- Options: "$10", "$20", "$50", "Custom amount"

If custom, ask for the dollar amount in a follow-up question.

Convert to cents and activate:

```bash
node "${SCRIPTS_DIR}/billing.js" payg <amount_cents>
```

The response contains a `checkout_url`. Open it in the browser just like the subscription flow.

## Step 4: Confirm activation

After the user returns from Stripe, verify their plan updated:

```bash
node "${SCRIPTS_DIR}/billing.js" status
```

If the tier has changed from "free", confirm:
> "You're now on the {tier} plan with {credits_remaining} credits. Run `/research "your topic"` to start researching."

If it hasn't changed yet (webhook delay), tell them:
> "Payment received — your plan should activate within a minute. If it doesn't, run `/grep-status` to check."

## Anti-patterns

- Do NOT hardcode Stripe URLs — always use the `checkout_url` from the API response.
- Do NOT present upgrade options to waitlisted users — they can't purchase until approved.
- Do NOT ask for credit card details — Stripe Hosted Checkout handles all payment collection.
- Do NOT poll the checkout session status in a loop — just check once when the user says they've completed payment.
