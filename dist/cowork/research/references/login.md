# GREP Login

Authenticate with a GREP account. Three methods:
- **OTP** — email-based one-time password (default for interactive users)
- **API key** — paste a long-lived key (best for CI, headless, and agents)
- **Sign up** — create an account at grep.ai first

## Direct arguments (for agents and automation)

If arguments are passed directly, skip the interactive questions:

- **Email address** (e.g., `user@example.com`) — go straight to OTP flow (Step 1 with this email)
- **`--api-key parcha-abc123`** — save immediately:
  ```bash
  SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
  node "$SCRIPTS_DIR/auth.js" set-api-key "<api_key>"
  ```
  On success, skip to waitlist check. On failure, report the error.
- **`--api-key parcha-abc123 --email user@example.com`** — save API key, associate with email

If no arguments match these patterns, proceed to Step 0.

## Step 0: Choose method

Use **AskUserQuestion**:
- Header: "Get started"
- Question: "How would you like to connect to GREP?"
- Options:
  - "Sign up — I'm new to GREP" — "Create an account at grep.ai, then come back here to connect."
  - "Log in — I already have an account" — "Send a 6-digit code to my email."
  - "Use an API key" — "Paste an API key from grep.ai/api-keys."

### If "Sign up"

Open the signup page:
```bash
open "https://grep.ai/start"
```
On Linux use `xdg-open`, on WSL use `wslview`.

Tell the user:
> "I've opened grep.ai/start in your browser. Create your account there. Once done, come back and run this again to connect."

Stop here.

### If "Use an API key"

Ask for the key via **AskUserQuestion** (free-text):
- Header: "API key"
- Question: "Paste your GREP API key. Create one at https://grep.ai/api-keys"

Save it:
```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/auth.js" set-api-key "<api_key>"
```

On success, skip to Step 5.5 (waitlist check). On failure, offer to try again or switch to OTP.

### If "Log in"

Continue with OTP flow below.

## Step 1: Get the user's email

Use **AskUserQuestion**:
- Header: "Email"
- Question: "What email address is your GREP account at grep.ai?"

## Step 2: Send verification code

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/auth.js" send-code "<email>"
```

Non-interactive. Output: `{"ok": true, "email": "...", "message": "Code sent"}`.

Tell the user: "Code sent to <email>. Check your inbox (and spam folder)."

## Step 3: Ask for code

Use **AskUserQuestion**:
- Header: "OTP code"
- Question: "What's the 6-digit verification code you just received?"

## Step 4: Verify

```bash
node "$SCRIPTS_DIR/auth.js" verify "<email>" "<code>"
```

- Success: `{"ok": true, "email": "..."}` — session saved to `~/.grep/session.json`
- Failure: `{"ok": false, "error": "..."}` — exit code 1

## Step 5: Confirm or recover

- **Success:** Move to Step 5.5.
- **"One time code is invalid":** Code was wrong or expired. Loop back to Step 2 for a fresh code.
- **Other failure:** Report the error.

## Step 5.5: Check waitlist status

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/billing.js" waitlist
```

Returns `{ "on_waitlist": true/false }`.

**If on waitlist:**

Use **AskUserQuestion**:
- Header: "Waitlist"
- Question: "You're on the GREP waitlist. Do you have an invite or promo code to skip the line?"
- Options:
  - "I have a code" — "Enter a promo or invite code for immediate access"
  - "I'll wait" — "We'll email you when activated (usually a few days)"

### If "I have a code"

Ask for the code via **AskUserQuestion**, then redeem:
```bash
node "$SCRIPTS_DIR/billing.js" redeem "<code>"
```

- `access_granted: true` — "Code accepted! You're off the waitlist." Continue to Step 6.
- `access_granted: false` — code is valid but doesn't bypass waitlist. Applied for later.
- Failure — invalid code, offer to retry or wait.

### If "I'll wait"

> "No problem. We'll email you when your account is activated. Run `/grep-status` anytime to check."

Stop here. Do NOT proceed to onboarding.

**If not on waitlist:** Continue to Step 6.

## Step 6: Check onboarding status

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/billing.js" onboarding
```

**If `has_completed_onboarding` is true:** Skip to Step 7.

**If false:** Open the onboarding page:
```bash
open "https://grep.ai/start"
```

Tell the user:
> "I've opened grep.ai/start in your browser. Complete onboarding there — it only takes a minute. Come back here when done."

Poll in background for completion (every 15 seconds, up to 5 minutes):
```bash
for i in $(seq 1 20); do
  sleep 15
  RESULT=$(node "$SCRIPTS_DIR/billing.js" onboarding 2>/dev/null)
  COMPLETED=$(echo "$RESULT" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).has_completed_onboarding)}catch{console.log('false')}})")
  if [ "$COMPLETED" = "true" ]; then
    echo '{"onboarding_complete": true}'
    exit 0
  fi
done
echo '{"onboarding_complete": false, "timed_out": true}'
```

Run as background Bash (`run_in_background: true`). On completion, proceed to Step 7. On timeout, tell the user to finish at grep.ai/start and come back.

## Step 7: Check billing and suggest plan

```bash
SCRIPTS_DIR="${CLAUDE_SKILL_DIR}/scripts"
node "$SCRIPTS_DIR/billing.js" status
```

- **Free tier:** "Authenticated as <email>. You have 100 free credits (~10 deep research jobs). Run `/research "topic"` to get started, or upgrade your plan anytime."
- **Paid plan:** "Authenticated as <email>. You're on the {tier} plan with {credits_remaining} credits remaining."

## Troubleshooting

- **No code received:** Check spam folder. Code expires in 10 minutes.
- **Invalid code:** Most common cause is re-sending (each `send-code` invalidates the previous). Always use the MOST RECENT code.
- **Session expired later:** Run this login flow again.

## Anti-patterns

- Do NOT use `auth.js login <email>` — that's the interactive terminal flow and blocks on stdin.
- Do NOT call `send-code` twice before the user enters the first code. Each send invalidates the previous.
- Do NOT ask for the code via plain prose if AskUserQuestion is available.
