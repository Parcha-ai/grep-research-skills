---
name: grep-login
description: Authenticate with GREP deep research. Use when the user needs to log in to GREP, authenticate, set up GREP credentials, or when a GREP API call returns 401 unauthorized.
disable-model-invocation: true
---

# GREP Login

Authenticate the user with their GREP account using email OTP. Uses a two-step flow so you never need to deal with interactive stdin prompts.

## Resolve the script path

The skill directory may be symlinked, so `${CLAUDE_SKILL_DIR}/..` can resolve to the wrong place. Use this instead to get the real scripts directory:

```bash
SCRIPTS_DIR="$(dirname "$(dirname "$(dirname "$(readlink -f "${CLAUDE_SKILL_DIR}/SKILL.md")")")")/scripts"
```

If that's too clunky, just use the absolute path in whichever location the repo was installed — on most systems it's under `~/.claude/skills/grep-login/../scripts/auth.js` AFTER resolving the symlink.

## Steps

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

- **Success:** Tell the user "Authenticated as <email>. You can now use `/research` to run deep research."
- **Failure with "One time code is invalid":** The code was wrong or expired. Loop back to Step 2 to send a fresh code.
- **Other failure:** Report the error to the user and suggest they try again or check grep.ai status.

## Troubleshooting

- **No code received:** Check spam folder. Code expires in 10 minutes.
- **Invalid code:** The most common cause is re-sending (each `send-code` call invalidates the previous code). Always use the MOST RECENT code.
- **Session expired later:** Run `/grep-login` again.

## Anti-patterns

- Do NOT use `auth.js login <email>` for this skill — that's the interactive terminal flow and will block waiting for stdin.
- Do NOT call `send-code` twice in a row before the user has had a chance to enter the first code. Each send invalidates the previous.
- Do NOT ask for the code via a plain prose message if AskUserQuestion is available — the native input box is a better UX.
