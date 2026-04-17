---
name: grep-api-reference
description: Reference for calling the GREP HTTP API directly via curl and the helper functions needed to do it. Use when writing or debugging bash commands that hit the GREP API, when you need the exact endpoint path/method/shape for an operation, or when a skill's curl command fails and you need to troubleshoot. This skill is the canonical source for auth, session storage, JWT refresh, and the full endpoint inventory that the GREP-API-flavour skills speak.
---

# GREP API Reference

This skill is the ground truth for every HTTP call the *API-flavour* skills make. It documents endpoints, auth flow, and shared helpers. When another skill says "see `/grep-api-reference` for the auth helper", this is where that helper lives verbatim.

## Why this exists

The GREP-API-flavour skills ship for environments that cannot install the `brain` Rust CLI (Claude.ai web, locked-down laptops, some cloud runners). They speak the REST API directly via `curl`. This reference consolidates everything they share so every skill can copy the same patterns.

## Base configuration

Every skill prologue sets these:

```bash
: "${GREP_API_BASE:=https://api.grep.ai}"
: "${DESCOPE_PROJECT_ID:=P38Xct9AhA95T0MU5T8g7o9V9886}"
SESSION_FILE="$HOME/.grep/session.json"
```

Env overrides:

- `BRAIN_API_KEY` — long-lived key; shortcircuits session lookup. Preferred for CI.
- `GREP_API_BASE` — override API base (default `https://api.grep.ai`; use `https://preview-api.grep.ai` for staging).
- `DESCOPE_PROJECT_ID` — override the Descope project (defaults to the GREP production project ID).

## The canonical `get_token` helper

Every API-flavour skill that makes an authenticated call copies this verbatim at the top of its bash block. Claude Code always ships Node, so we rely on it for JWT-base64 parsing + the Descope refresh (which requires a colon-separated `Bearer <projectId>:<refreshJwt>` header that's awkward in pure bash):

```bash
get_token() {
  [ -n "${BRAIN_API_KEY:-}" ] && { printf '%s' "$BRAIN_API_KEY"; return 0; }
  node -e '
    const fs = require("fs");
    const f = process.env.HOME + "/.grep/session.json";
    if (!fs.existsSync(f)) process.exit(2);
    const s = JSON.parse(fs.readFileSync(f, "utf8"));
    if (s.apiKey) { process.stdout.write(s.apiKey); process.exit(0); }
    const isExpired = j => {
      try { const p = JSON.parse(Buffer.from(j.split(".")[1], "base64").toString());
            return p.exp * 1000 < Date.now() + 30000; } catch { return true; }
    };
    if (s.sessionJwt && !isExpired(s.sessionJwt)) {
      process.stdout.write(s.sessionJwt); process.exit(0);
    }
    if (!s.refreshJwt || isExpired(s.refreshJwt)) process.exit(2);
    const pid = process.env.DESCOPE_PROJECT_ID || "P38Xct9AhA95T0MU5T8g7o9V9886";
    fetch("https://api.descope.com/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json",
                 "Authorization": `Bearer ${pid}:${s.refreshJwt}` },
      body: "{}"
    }).then(r => r.ok ? r.json() : Promise.reject(`refresh failed ${r.status}`))
      .then(d => {
        const upd = { ...s, sessionJwt: d.sessionJwt, refreshJwt: d.refreshJwt || s.refreshJwt };
        fs.writeFileSync(f, JSON.stringify(upd, null, 2), { mode: 0o600 });
        process.stdout.write(d.sessionJwt);
      }).catch(e => { console.error(e); process.exit(2); });
  '
}
```

Usage:

```bash
TOKEN=$(get_token) || { echo "Not authenticated — run /grep-login" >&2; exit 1; }
curl -H "Authorization: Bearer $TOKEN" "$GREP_API_BASE/api/v1/research?limit=5"
```

## Session file shape

`~/.grep/session.json` has two possible layouts, identical to what the `brain` CLI writes:

**Descope session (OTP or enchanted link):**
```json
{
  "email": "alice@example.com",
  "sessionJwt": "eyJ…",
  "refreshJwt": "eyJ…",
  "user": { … },
  "authenticatedAt": "2026-04-17T…",
  "authMethod": "otp"
}
```

**API key session:**
```json
{
  "email": null,
  "apiKey": "<api_key>",
  "authMethod": "api_key",
  "authenticatedAt": "2026-04-17T…"
}
```

Write it with mode `0o600`. Never log the contents.

## Endpoint inventory

Auth (Descope, NOT `$GREP_API_BASE`):

| Method | Path | Purpose |
|---|---|---|
| POST | `https://api.descope.com/v1/auth/otp/signup-in/email` | Send OTP code; header `Authorization: Bearer $DESCOPE_PROJECT_ID`; body `{"loginId": "<email>"}` |
| POST | `https://api.descope.com/v1/auth/otp/verify/email` | Verify OTP; body `{"loginId", "code"}`; returns `{sessionJwt, refreshJwt, user}` |
| POST | `https://api.descope.com/v1/auth/enchantedlink/signup-in/email` | Send click-to-auth link; body `{"loginId", "redirectUrl"}`; returns `{pendingRef, linkId, maskedEmail}` |
| POST | `https://api.descope.com/v1/auth/enchantedlink/pending-session` | Poll; body `{"pendingRef"}`; 401 = not yet clicked; 200 w/ `sessionJwt` = done |
| POST | `https://api.descope.com/v1/auth/refresh` | Refresh JWT; header `Authorization: Bearer $DESCOPE_PROJECT_ID:$REFRESH_JWT` (colon-separated!); empty body |

GREP API (`$GREP_API_BASE`):

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/research` | Submit research job; body `ResearchJobInput` (see below) |
| GET  | `/api/v1/research?limit=N` | List recent jobs |
| GET  | `/api/v1/research/{id}?include_status_messages=true` | Job status + status messages |
| GET  | `/api/v1/research/{id}?include_check_results=true` | Job with check results |
| GET  | `/billing/tiers` | Plan catalog |
| GET  | `/billing/status` | Current tier + credits |
| POST | `/billing/checkout` | Stripe checkout session; body `{tier, billing_interval, return_url}` |
| POST | `/billing/payg/activate` | PAYG credit; body `{amount_cents, return_url}` |
| GET  | `/grep/researchWaitlistStatus` | `{on_waitlist}` |
| GET  | `/grep/onboarding/status` | `{has_completed_onboarding}` |
| GET  | `/grep/user/defaults` | List per-user default files |
| POST | `/grep/user/defaults` | Upload (multipart: `files=@file`, `paths=<remote/path>`) |
| DELETE | `/grep/user/defaults/{path}` | Delete a default (path may contain slashes) |
| POST | `/grep/jobs/{id}/inputs` | Attach files to a job (multipart: `files=@file`) |
| DELETE | `/grep/jobs/{id}/inputs/{path}` | Delete an attached input |

## Research submit payload

`POST /api/v1/research` body. Only `question` is required; everything else optional.

```jsonc
{
  "question": "...",                     // required
  "depth": "ultra_fast|deep|ultra_deep",  // also accepted as "effort"
  "context": "free-form extra context",
  "project": "experts/flutterwave_mcc",   // SOP-driven; reads SOP.md from that workspace path
  "additional_thesis": "...",             // advanced
  "language": "en",
  "skip_clarification": false
}
```

Response shape:
```jsonc
{ "job_id": "01J8R4…", "status": "queued", ... }
```

## Multipart upload recipe

```bash
TOKEN=$(get_token)
curl -X POST "$GREP_API_BASE/grep/user/defaults" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@./rubric.md" \
  -F "paths=legal/rubric.md"
```

Bulk (multiple `files=@` flags, matching `paths=` in the same order):

```bash
curl -X POST "$GREP_API_BASE/grep/user/defaults" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@./rubric.md" -F "paths=legal/rubric.md" \
  -F "files=@./guide.md"  -F "paths=style/guide.md"
```

Job inputs work the same but without `paths=` (server uses each file's basename):

```bash
curl -X POST "$GREP_API_BASE/grep/jobs/$JOB_ID/inputs" \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@./data.csv" -F "files=@./schema.json"
```

## Error surface patterns

Use `curl -w '\nHTTP %{http_code}\n'` so status codes are visible even when body is JSON.

- `401` → call `get_token` again; if still 401, run `/grep-login`.
- `403` → user doesn't own this resource.
- `413` → payload too large (100 MB/file, 500 MB/job for inputs).
- `429` → rate-limited; back off.

## Polling a job to completion

```bash
TOKEN=$(get_token)
sleep 20  # initial wait, matches brain-cli behaviour
while :; do
  RESP=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$GREP_API_BASE/api/v1/research/$JOB_ID?include_status_messages=true")
  STATUS=$(printf '%s' "$RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).status||''))")
  [ "$STATUS" = "complete" ] || [ "$STATUS" = "completed" ] && { printf '%s' "$RESP"; break; }
  [ "$STATUS" = "failed" ] && { echo "job failed" >&2; exit 1; }
  sleep 15
done
```

## When to reach for this skill

- Writing a new API-flavour skill: copy `get_token` from here verbatim.
- Debugging a 401: check `~/.grep/session.json` exists and isn't empty; JWT not expired; for Descope sessions, refreshJwt not expired either.
- Working with file uploads: multipart shape reference above.
- Composing advanced research submit fields: full field list in the payload section above.

## Anti-patterns

- Do NOT invent new curl flags not documented here. If a header/method isn't in the inventory above, it isn't exposed.
- Do NOT write tokens to log output. Always `printf '%s'` not `echo` (prevents trailing newline leaks in logs).
- Do NOT hit Descope endpoints against `$GREP_API_BASE`. Descope always goes to `https://api.descope.com`.
