---
name: grep-login
description: Authenticate with GREP deep research. Use when the user needs to log in to GREP, authenticate, set up GREP credentials, or when a GREP API call returns 401 unauthorized.
disable-model-invocation: true
---

# GREP Login

Authenticate the user with their GREP account using email verification.

## Steps

1. Ask the user for their email address (the one associated with their GREP account at grep.ai)
2. Run the auth script to send a verification code:

```bash
node ${CLAUDE_SKILL_DIR}/../scripts/auth.js login "$EMAIL"
```

3. The script will:
   - Send a one-time verification code to their email
   - Prompt them to enter the code
   - Store the session in `~/.grep/session.json`

4. If authentication succeeds, confirm to the user they're now authenticated.
5. If it fails, suggest they check their email or try again.

## Troubleshooting

- **No code received**: Check spam folder. Code expires in 10 minutes.
- **Invalid code**: Request a new one by running login again.
- **Session expired**: Run `/grep-login` again to re-authenticate.
