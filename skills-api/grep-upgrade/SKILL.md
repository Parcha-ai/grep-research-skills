---
name: grep-upgrade
description: Choose a GREP subscription plan or upgrade your account via raw HTTP. Use when the user wants to subscribe, upgrade, check pricing, manage their GREP plan, or after /grep-login suggests choosing a plan.
disable-model-invocation: true
---

# GREP Upgrade — API flavour

Plan selection + Stripe checkout via curl.

## Prerequisite

Load the `get_token` helper from `/grep-api-reference`.

## Step 1: Waitlist + current plan

```bash
: "${GREP_API_BASE:=https://api.grep.ai}"
TOKEN=$(get_token) || { echo "Not authenticated — run /grep-login" >&2; exit 1; }

WAITLIST=$(curl -s -H "Authorization: Bearer $TOKEN" "$GREP_API_BASE/grep/researchWaitlistStatus")
STATUS=$(curl -s -H "Authorization: Bearer $TOKEN" "$GREP_API_BASE/billing/status")
```

If `on_waitlist == true`, stop and explain:

> "You're currently on the GREP waitlist. We'll email you when your account is activated. Check back with `/grep-status`."

Otherwise parse `$STATUS` for `tier`, `credits_remaining`, `subscription_status`.

## Step 2: Pick a plan (AskUserQuestion)

Header: "Choose your GREP plan". Options: Try Free, Pro ($200/mo), Ultra ($500/mo), Pay As You Go.

## Step 3: Dispatch on choice

### Pro or Ultra

Ask billing interval (monthly/annual). Then:

```bash
BODY=$(node -e "console.log(JSON.stringify({tier: process.argv[1], billing_interval: process.argv[2]}))" -- "$TIER" "$INTERVAL")
CHECKOUT=$(curl -s -X POST "$GREP_API_BASE/billing/checkout" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "$BODY")
URL=$(printf '%s' "$CHECKOUT" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).checkout_url||''))")
```

Open `$URL` in the user's browser (xdg-open / open / wslview). Tell them to complete payment and come back.

### Pay As You Go

Ask for deposit amount (min $10). Convert to cents:

```bash
BODY=$(node -e "console.log(JSON.stringify({amount_cents: parseInt(process.argv[1], 10)}))" -- "$CENTS")
PAYG=$(curl -s -X POST "$GREP_API_BASE/billing/payg/activate" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$BODY")
URL=$(printf '%s' "$PAYG" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).checkout_url||''))")
```

Open $URL the same way.

### Try Free

No action needed. Tell the user they have 100 free credits; suggest `/research`.

## Step 4: Confirm activation

After the user says they've completed payment:

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$GREP_API_BASE/billing/status"
```

If tier changed, confirm. If not, tell them to give it a minute (webhook delay).

## Anti-patterns

- Do NOT hardcode Stripe URLs — always use `checkout_url` from the response.
- Do NOT offer plans to waitlisted users.
- Do NOT poll the checkout session in a loop.
