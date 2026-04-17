---
name: grep-login
description: Authenticate with GREP deep research via raw HTTP. Use when the user needs to log in to GREP, authenticate, set up GREP credentials, or when a GREP API call returns 401 unauthorized. Supports direct arguments for agent use — `/grep-login <email>` to login with OTP, `/grep-login --api-key <key>` to authenticate with an API key.
disable-model-invocation: true
---

# GREP Login — API flavour

Authenticate the user with their GREP account without the `brain` CLI. Three methods:

- **Enchanted link** — click a magic link in email (recommended when the user has a browser).
- **OTP** — email + 6-digit code (AI-agent friendly).
- **API key** — long-lived key (CI, headless).

All three write `~/.grep/session.json` with mode `0o600`.

## Prerequisite

Load the `get_token` helper from `/grep-api-reference` into the same bash block when you later need to validate auth. For this skill's *login* flow, we write the session file directly with the node commands below — no helper needed during login itself.

## Direct arguments (for agents and automation)

If `$ARGUMENTS` matches a pattern, skip the interactive picker:

- **`/grep-login user@example.com`** — go straight to OTP flow at Step 1 with this email.
- **`/grep-login --api-key <api_key>`** — save the API key (see "API key flow" below). Skip to Step 6.
- **`/grep-login --api-key <api_key> --email user@example.com`** — same + associate email.

If empty or no match, start at Step 0.

## Step 0: Pick a method

Use **AskUserQuestion**:

- Header: "Get started"
- Question: "How would you like to connect to GREP?"
- Options:
  - "Sign up — I'm new to GREP" → open `https://preview.grep.ai/start`, stop.
  - "Log in — enchanted link" (recommended) → Step 1E below.
  - "Log in — OTP code" → Step 1 below.
  - "Use an API key" → Step 5 below.

## Enchanted link flow (Step 1E)

Collect email via **AskUserQuestion** → variable `$EMAIL`.

```bash
: "${DESCOPE_PROJECT_ID:=P38Xct9AhA95T0MU5T8g7o9V9886}"
REDIRECT_URL="${BRAIN_ENCHANTED_REDIRECT_URL:-https://preview.grep.ai/auth/verify}"

SENT=$(curl -s -X POST "https://api.descope.com/v1/auth/enchantedlink/signup-in/email" \
  -H "Authorization: Bearer $DESCOPE_PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d "$(node -e "console.log(JSON.stringify({loginId: process.argv[1], redirectUrl: process.argv[2]}))" -- "$EMAIL" "$REDIRECT_URL")")
PENDING_REF=$(printf '%s' "$SENT" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).pendingRef||''))")
LINK_ID=$(printf '%s' "$SENT" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).linkId||''))")

[ -z "$PENDING_REF" ] && { echo "Failed to send link: $SENT" >&2; exit 1; }
echo "Check your email and click link #$LINK_ID."
```

Then poll (run as **background Bash** with `timeout` of `660000` ms):

```bash
: "${DESCOPE_PROJECT_ID:=P38Xct9AhA95T0MU5T8g7o9V9886}"
END=$(( $(date +%s) + 600 ))
while [ "$(date +%s)" -lt $END ]; do
  RESP=$(curl -s -X POST "https://api.descope.com/v1/auth/enchantedlink/pending-session" \
    -H "Authorization: Bearer $DESCOPE_PROJECT_ID" \
    -H "Content-Type: application/json" \
    -d "$(node -e "console.log(JSON.stringify({pendingRef: process.argv[1]}))" -- "$PENDING_REF")")
  SESSION_JWT=$(printf '%s' "$RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(JSON.parse(s).sessionJwt||'')}catch{}}")
  if [ -n "$SESSION_JWT" ]; then
    mkdir -p "$HOME/.grep"
    printf '%s' "$RESP" | node -e "
      let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
        const d=JSON.parse(s);
        const sess={
          email: (d.user&&(d.user.email||(d.user.loginIds||[])[0]))||'',
          sessionJwt: d.sessionJwt, refreshJwt: d.refreshJwt,
          user: d.user||{}, authenticatedAt: new Date().toISOString(),
          authMethod: 'enchanted_link'
        };
        require('fs').writeFileSync(process.env.HOME+'/.grep/session.json', JSON.stringify(sess,null,2), {mode:0o600});
        console.log(JSON.stringify({ok:true, email:sess.email, firstSeen: d.firstSeen||false}));
      });
    "
    exit 0
  fi
  sleep 2
done
echo '{"ok":false,"status":"timeout"}'
exit 2
```

On success, move to **Step 5.5** (waitlist check).

## OTP flow (Step 1)

Collect email (`$EMAIL`). Send code:

```bash
: "${DESCOPE_PROJECT_ID:=P38Xct9AhA95T0MU5T8g7o9V9886}"
curl -s -X POST "https://api.descope.com/v1/auth/otp/signup-in/email" \
  -H "Authorization: Bearer $DESCOPE_PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d "$(node -e "console.log(JSON.stringify({loginId: process.argv[1]}))" -- "$EMAIL")" > /dev/null
echo "Code sent to $EMAIL."
```

Collect code via AskUserQuestion (`$CODE`). Verify:

```bash
VERIFY=$(curl -s -X POST "https://api.descope.com/v1/auth/otp/verify/email" \
  -H "Authorization: Bearer $DESCOPE_PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d "$(node -e "console.log(JSON.stringify({loginId: process.argv[1], code: process.argv[2]}))" -- "$EMAIL" "$CODE")")

SESSION_JWT=$(printf '%s' "$VERIFY" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(JSON.parse(s).sessionJwt||'')}catch{}}")
[ -z "$SESSION_JWT" ] && { echo "Verification failed: $VERIFY" >&2; exit 1; }

mkdir -p "$HOME/.grep"
printf '%s' "$VERIFY" | node -e "
  let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
    const d=JSON.parse(s);
    const sess={
      email: process.env.EMAIL,
      sessionJwt: d.sessionJwt, refreshJwt: d.refreshJwt,
      user: d.user||{}, authenticatedAt: new Date().toISOString(),
      authMethod: 'otp'
    };
    require('fs').writeFileSync(process.env.HOME+'/.grep/session.json', JSON.stringify(sess,null,2), {mode:0o600});
    console.log(JSON.stringify({ok:true, email:sess.email}));
  });
" EMAIL="$EMAIL"
```

If verification fails with "One time code is invalid", re-send (each `send-code` invalidates the previous).

## API key flow (Step 5)

Ask for the key via AskUserQuestion (`$API_KEY`).

```bash
: "${GREP_API_BASE:=https://api.grep.ai}"
CHECK=$(curl -s -w '\n%{http_code}' -H "Authorization: Bearer $API_KEY" "$GREP_API_BASE/billing/status")
BODY=$(printf '%s' "$CHECK" | sed '$d')
CODE=$(printf '%s' "$CHECK" | tail -1)
[ "$CODE" != "200" ] && { echo "Invalid API key ($CODE): $BODY" >&2; exit 1; }

mkdir -p "$HOME/.grep"
printf '%s' "$BODY" | node -e "
  let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
    const d=JSON.parse(s);
    const sess={
      email: d.email||null,
      apiKey: process.env.API_KEY,
      authMethod: 'api_key',
      authenticatedAt: new Date().toISOString()
    };
    require('fs').writeFileSync(process.env.HOME+'/.grep/session.json', JSON.stringify(sess,null,2), {mode:0o600});
    console.log(JSON.stringify({ok:true, authMethod:'api_key', tier: d.tier}));
  });
" API_KEY="$API_KEY"
```

## Step 5.5: Check waitlist

```bash
TOKEN=$(get_token)   # from /grep-api-reference
: "${GREP_API_BASE:=https://api.grep.ai}"
WAITLIST=$(curl -s -H "Authorization: Bearer $TOKEN" "$GREP_API_BASE/grep/researchWaitlistStatus")
ON=$(printf '%s' "$WAITLIST" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).on_waitlist===true?'true':'false'))")
```

If `$ON` = `true`, tell the user:

> "You're on the GREP waitlist. We'll email you at `<email>` as soon as your account is activated. Run `/grep-status` anytime to check."

Stop here.

## Step 6: Check onboarding

```bash
ONBOARD=$(curl -s -H "Authorization: Bearer $TOKEN" "$GREP_API_BASE/grep/onboarding/status")
DONE=$(printf '%s' "$ONBOARD" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).has_completed_onboarding===true?'true':'false'))")
```

If `$DONE` = `false`, open `https://preview.grep.ai/start` in the browser and poll every 15s up to 5 min for completion.

## Step 7: Check billing

```bash
STATUS=$(curl -s -H "Authorization: Bearer $TOKEN" "$GREP_API_BASE/billing/status")
# Present tier + credits_remaining to the user.
```

## Troubleshooting

- **No code received** → check spam folder; code expires in 10 minutes.
- **"One time code is invalid"** → each `send-code` call invalidates the previous code. Always use the most recent.
- **Session expired later** → just re-run `/grep-login`.

## Anti-patterns

- Do NOT block-poll the enchanted link in the foreground — it can take 10 minutes; run the poll loop as a **background Bash** command.
- Do NOT call `send-code` twice in quick succession.
- Do NOT skip writing `authMethod` into session.json — the `get_token` helper branches on it to decide refresh vs. not.
