---
name: grep-login
description: Authenticate with GREP deep research. Use when the user needs to log in to GREP, authenticate, set up GREP credentials, or when a GREP API call returns 401 unauthorized.
disable-model-invocation: true
---

# GREP Login

Authenticate the user with their GREP account. Supports two modes:
- **Device flow** (recommended for new users): Opens the browser, user signs up/logs in on the web, session syncs back to the terminal automatically.
- **OTP flow** (fallback): Email-based one-time password, fully in-terminal. Use when browser isn't available.

## Resolve the script path

The skill directory may be symlinked, so `${CLAUDE_SKILL_DIR}/..` can resolve to the wrong place. Use this instead to get the real scripts directory:

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

## Choose auth method

**Default to OTP flow** — it's proven and works everywhere. Skip straight to Step 1.

Enchanted Links (magic link click-to-auth) are available as an experimental alternative but require the `/auth/verify` frontend route to be deployed. Only offer enchanted links if the user specifically asks for it.

### If Enchanted Link (experimental):

#### Step 0a: Get the user's email

Use **AskUserQuestion**:
- Header: "Email"
- Question: "What email address for your GREP account?"

#### Step 0b: Send the enchanted link

```bash
node "${SCRIPTS_DIR}/auth.js" enchanted-send "<email>"
```

This returns JSON: `{ "ok": true, "pendingRef": "...", "linkId": "42", "maskedEmail": "..." }`

Tell the user: "Check your email and **click link #42** (the number matching your link ID). This will authenticate your terminal AND open the GREP onboarding page in your browser."

#### Step 0c: Poll for completion

Run in background (`run_in_background: true`):

```bash
node "${SCRIPTS_DIR}/auth.js" enchanted-poll "<pendingRef>"
```

Run with `timeout: 660000` (11 minutes). The command polls Descope every 2 seconds until the user clicks the link. Output:
- Success: `{"ok": true, "email": "...", "firstSeen": true/false}` — session saved
- Timeout (exit code 2): `{"ok": false, "status": "timeout"}`

**What happens when they click:** The enchanted link takes them to the verify page, which:
1. Verifies the token (unblocks the terminal poll)
2. Establishes a web session in their browser
3. Redirects them to `grep.ai/start` for onboarding

So one click does everything — the terminal gets authenticated and the user lands on onboarding.

If the poll succeeds, check `firstSeen`:
- **`firstSeen: true`** — new user, they're currently going through onboarding in their browser. Proceed to Step 6 to poll for onboarding completion.
- **`firstSeen: false`** — returning user, skip to Step 7 (check billing status).

If the poll times out, tell the user and offer the OTP flow instead.

### If OTP flow:

Continue with Step 1 below.

## Steps (OTP Flow)

### Step 1: Get the user's email

Use **AskUserQuestion** with a free-text option:

- Question: "What email address is your GREP account at grep.ai?"
- Header: "Email"
- Offer a single option like "Enter email" so the user types their address, OR ask the user directly in prose and read the next turn.

### Step 2: Send the verification code

```bash
node "${SCRIPTS_DIR}/auth.js" send-code "<email>"
```

This is non-interactive — it just hits the Descope OTP endpoint and exits. Output is a JSON line: `{"ok": true, "email": "...", "message": "Code sent"}`.

Tell the user: "Code sent to <email>. Check your inbox (and spam folder)."

### Step 3: Ask for the verification code

Use **AskUserQuestion** so the user gets a clean input field, not a stdin prompt:

- Question: "What's the 6-digit verification code you just received?"
- Header: "OTP code"
- Options: a single "Enter code" option, or ask in prose.

The user will type the code as free text.

### Step 4: Verify the code

```bash
node "${SCRIPTS_DIR}/auth.js" verify "<email>" "<code>"
```

This is also non-interactive. Output:
- Success: `{"ok": true, "email": "..."}` — session is saved to `~/.grep/session.json`
- Failure: `{"ok": false, "error": "..."}` — exit code 1

### Step 5: Confirm or recover

- **Success:** Move to Step 6 (check account status).
- **Failure with "One time code is invalid":** The code was wrong or expired. Loop back to Step 2 to send a fresh code.
- **Other failure:** Report the error to the user and suggest they try again or check grep.ai status.

### Step 6: Check onboarding status

After successful authentication, check whether the user has completed onboarding at grep.ai:

```bash
node "${SCRIPTS_DIR}/billing.js" onboarding
```

This returns JSON with a `has_completed_onboarding` field (true/false).

**If `has_completed_onboarding` is `true`:** Skip straight to Step 7.

**If `has_completed_onboarding` is `false`:**

The user hasn't finished onboarding on the web yet. Open the onboarding page for them:

```bash
open "https://preview.grep.ai/start"
```

On Linux use `xdg-open`, on WSL use `wslview`.

Tell the user clearly — they need to know the terminal is waiting and they should come back:

> "I've opened grep.ai/start in your browser. Complete the onboarding there — it only takes a minute.
>
> **Once you're done, come back here.** I'm polling in the background and will detect when onboarding is complete."

Then **poll in the background** for onboarding completion. Use a loop that checks every 15 seconds (up to 5 minutes):

```bash
for i in $(seq 1 20); do
  sleep 15
  RESULT=$(node "${SCRIPTS_DIR}/billing.js" onboarding 2>/dev/null)
  COMPLETED=$(echo "$RESULT" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).has_completed_onboarding)}catch{console.log('false')}})")
  if [ "$COMPLETED" = "true" ]; then
    echo '{"onboarding_complete": true}'
    exit 0
  fi
done
echo '{"onboarding_complete": false, "timed_out": true}'
```

Run this as a **background Bash command** (`run_in_background: true`) so the user doesn't have to stare at a spinner. When the background task completes:

- **If `onboarding_complete: true`:** Tell the user "Onboarding complete! Welcome to GREP. You're all set to start researching." and proceed to Step 7.
- **If `timed_out: true`:** Tell the user "No rush — finish onboarding at grep.ai/start when you're ready, then come back here and run `/grep-login` again. I'll pick up where we left off."

### Step 7: Check account status and suggest plan

Check whether the user is waitlisted, then check their billing status:

```bash
node "${SCRIPTS_DIR}/billing.js" waitlist
```

This returns JSON: `{ "on_waitlist": true/false }`.

- **If `on_waitlist` is `true`:** Tell the user "You're currently on the GREP waitlist — we'll email you at <email> when your account is activated. You can check back anytime with `/grep-status`." Do NOT suggest `/grep-upgrade` or `/research`. Stop here.

- **If `on_waitlist` is `false`:** Check billing status:

```bash
node "${SCRIPTS_DIR}/billing.js" status
```

Based on the response:

- **Free tier** (`tier: "free"`): Tell the user "Authenticated as <email>. You have 100 free credits to try GREP — enough for about 10 deep research jobs. Run `/research "topic"` to get started, or `/grep-upgrade` to choose a plan."
- **Already on a paid plan:** Tell the user "Authenticated as <email>. You're on the {tier} plan with {credits_remaining} credits remaining. Run `/research "topic"` to get started."

## Troubleshooting

- **No code received:** Check spam folder. Code expires in 10 minutes.
- **Invalid code:** The most common cause is re-sending (each `send-code` call invalidates the previous code). Always use the MOST RECENT code.
- **Session expired later:** Run `/grep-login` again.

## Anti-patterns

- Do NOT use `auth.js login <email>` for this skill — that's the interactive terminal flow and will block waiting for stdin.
- Do NOT call `send-code` twice in a row before the user has had a chance to enter the first code. Each send invalidates the previous.
- Do NOT ask for the code via a plain prose message if AskUserQuestion is available — the native input box is a better UX.
