---
name: brain-cli
description: Reference for the `brain` CLI — the command-line interface to Grep (grep.ai). Use when the user asks "what can the brain CLI do?", "how do I read my Grep report?", "list my jobs", "search my workspace", "check my billing", or any question about operating the Grep account/workspace/research system from the terminal. Also use when you need to know the exact subcommand or JSON shape for a given task.
---

# `brain` CLI Reference

`brain` is the Rust CLI that drives everything in Grep from the terminal: auth, research, workspace browsing, reports, apps, billing, account status. Every `grep-research-skills` skill speaks `brain` under the hood — this skill is the agent-facing atlas of what's possible.

Source: https://github.com/Parcha-ai/brain-cli

## When to reach for this skill

* The user asks a capability question ("can brain do X?", "how do I Y from the CLI?").
* You're writing shell that needs to call a Grep API and want to pick the right subcommand.
* You're debugging an auth / billing / onboarding issue and want the exact command + JSON shape.

## Prerequisite

`brain --version` must work on `$PATH`. If not, run `npx grep-research-skills` (this repo's installer), or:

```bash
curl -fsSL https://raw.githubusercontent.com/Parcha-ai/brain-cli/main/install.sh | sh
```

## Global flags

Every command accepts:

* `--json` — emit machine-readable JSON to stdout (always prefer this in scripts).
* `--endpoint URL` — override the Grep API base URL (default `https://api.grep.ai`).
* `--no-color` — disable ANSI colour codes.

Env overrides:

* `BRAIN_API_KEY` — shortcut any file-based auth with a literal API key.
* `BRAIN_ENDPOINT` — same as `--endpoint`.
* `BRAIN_DESCOPE_PROJECT_ID` — required by Descope flows when not seeded into config.

Session files (Unix mode 0o600):

* `~/.grep/session.json` — primary auth store (JWT or API key). Read+written.
* `~/.config/brain/config.toml` — legacy fallback + non-secret values (descope_project_id, endpoint).

---

## Command inventory

### `brain auth`

| Subcommand | Purpose |
|---|---|
| `login [email] [--method otp\|enchanted\|api-key]` | Interactive login; defaults to enchanted link |
| `logout` | Delete `~/.grep/session.json` |
| `status` / `whoami` | Show current auth state (email, method, JWT expiry) |
| `token` | Print the current Bearer token to stdout (auto-refreshes) |
| `send-code <email>` | Descope OTP: send a 6-digit code |
| `verify <email> <code>` | Descope OTP: verify and save session |
| `enchanted-send <email> [--redirect-url URL]` | Descope enchanted link: send email |
| `enchanted-poll <pendingRef> [--max-wait SECS]` | Poll for enchanted-link click |
| `set-api-key [--key KEY]` | Save a long-lived API key (validates via `/billing/status`) |

**Recipe — agent-friendly OTP:**
```bash
brain auth send-code alice@example.com --json
# user reads their email…
brain auth verify alice@example.com 123456 --json
```

**Recipe — CI / headless:**
```bash
export BRAIN_API_KEY=<api_key>
# or: brain auth set-api-key --key <api_key>
brain auth status --json  # confirm
```

### `brain research`

| Subcommand | Purpose |
|---|---|
| `submit "<question>" [--depth ultra_fast\|deep\|ultra_deep] [--context TEXT \| --context-file PATH] [--project WORKSPACE_PATH] [--wait] [--timeout SECS]` | Submit a research job |
| `list [--status ...] [--limit N]` | Alias of `brain jobs` |
| `get <job_id> [--include-status-messages]` | Fetch a single job |

`--wait` blocks until complete (20s initial delay, 15s polling interval, default 540s cap). Live status messages stream to stderr.

`--project` flows a workspace directory through as the job's SOP source — the backend reads `SOP.md` from that path and uses it as the agent's system prompt.

### `brain jobs` / `brain report`

```bash
brain jobs                           # list recent jobs (table)
brain jobs --json                    # JSON for scripting
brain jobs <job_id>                  # detail view
brain jobs --status complete --limit 50
brain report <job_id>                # print the full report.md to stdout
```

### `brain ls` / `brain cat` / `brain log`

Filesystem-style browsing of the Grep workspace + job outputs.

```bash
brain ls                             # workspace sections (projects/, jobs/, apps/, experts/)
brain ls projects/acme               # list files under a path
brain ls projects/acme -l            # long format with size + mtime

brain cat projects/acme/notes.md     # read a workspace file
brain cat jobs/<job_id>/report.md    # read a file inside a job's workspace

brain log                            # workspace commit history
brain log <job_id>                   # checkpoint history for a specific job
brain log --limit 50
```

### `brain apps`

```bash
brain apps                           # list your recent app artifacts (slidedecks, podcasts, …)
brain apps --limit 50
brain apps <app_id>                  # detail (status, deployed_url)
```

### `brain billing`

```bash
brain billing tiers                  # plan catalog
brain billing status --json          # current tier + credits_remaining + email
brain billing checkout --tier pro --interval month --return-url https://…
brain billing payg --amount-cents 2500   # minimum 1000 (=$10)
```

### `brain status`

```bash
brain status waitlist                # { "on_waitlist": true|false }
brain status onboarding              # { "has_completed_onboarding": true|false }
# whoami lives under `brain auth`:
brain auth whoami                    # alias of `brain auth status`
```

### `brain defaults`

Per-user default context files. Stored in Pierre at `users/{uid}/defaults/`; hydrated into `./defaults/` in every sandbox.

```bash
brain defaults list --json                       # → GET /grep/user/defaults
brain defaults upload ./rubric.md --as legal/rubric.md --json
                                                 # → POST /grep/user/defaults (multipart)
brain defaults upload ./a.md ./b.md ./c.md       # bulk; basenames kept
brain defaults delete legal/rubric.md --json     # → DELETE /grep/user/defaults/{path}
```

Only the first file of a bulk upload honours `--as`; subsequent files keep their basename.

### `brain inputs`

Per-job input files. Stored in Pierre at `jobs/{id}/input_files/`; hydrated into `./input_files/` in the job's sandbox at dispatch. Limits: 100 MB/file, 500 MB/job.

```bash
brain inputs attach <job_id> ./data.csv ./schema.json --json
                                                 # → POST /grep/jobs/{id}/inputs (multipart)
brain inputs delete <job_id> data.csv --json     # → DELETE /grep/jobs/{id}/inputs/{path}
```

---

## JSON shapes (sample)

```jsonc
// brain auth status --json
{ "authenticated": true, "authMethod": "enchanted_link", "email": "…",
  "authenticatedAt": "2026-04-17T03:12:00Z",
  "sessionExpired": false, "refreshExpired": false }

// brain research submit … --json (without --wait)
{ "job_id": "01J8R4…", "status": "queued" }

// brain jobs --json
{ "items": [ { "id": "01J8R4…", "status": "complete",
               "created_at": "2026-04-12T…", "question": "…",
               "check_results": [ … ] } ],
  "count": 17 }

// brain apps --json
{ "items": [ { "id": "01J8R6…", "title": "Q1 Report",
               "app_type": "slidedeck", "status": "deployed",
               "deployed_url": "https://…", "created_at": "…" } ],
  "count": 4 }

// brain billing status --json
{ "tier": "pro", "email": "…",
  "credits_remaining": 1234, "credit_quota": 1500,
  "subscription_status": "active" }
```

---

## Common recipes

### Read the latest completed report

```bash
JOB=$(brain jobs --status complete --limit 1 --json | jq -r '.items[0].id')
brain report "$JOB"
```

### Watch an in-flight job

```bash
JOB=$(brain research submit "What is Parcha?" --depth deep --json | jq -r '.job_id // .id')
while :; do
  STATUS=$(brain research get "$JOB" --json | jq -r .status)
  [ "$STATUS" = "complete" ] && break
  sleep 15
done
brain report "$JOB"
```

### Search your workspace for a keyword across files

`brain` does not ship full-text search yet. Combine with shell:

```bash
for f in $(brain ls projects/acme --json | jq -r '.files[].path'); do
  brain cat "$f" | grep -H -- 'keyword' || true
done
```

### Upgrade to Pro on monthly billing

```bash
brain billing checkout --tier pro --interval month --json | jq -r .checkout_url | xargs xdg-open
```

### Dump the bearer token for use in an external tool

```bash
TOKEN=$(brain auth token)
curl -H "Authorization: Bearer $TOKEN" https://api.grep.ai/api/v1/research?limit=1
```

---

## Auth state machine

```
(no session) ──brain auth login────────────────▶ (Descope JWT session)
                                                      │
                                          (JWT expires)│
                                                      ▼
                            auto-refresh via `brain auth token`
                                                      │
                                            (refresh expires)
                                                      ▼
                                                (no session) → prompt login

(no session) ──brain auth set-api-key────▶ (long-lived API key session)
                                                      │
                                             no refresh needed
                                                      │
                                                      ▼
                                     stays valid until revoked

Env `BRAIN_API_KEY=<key>` shortcuts all of the above for every call.
```

---

## Anti-patterns

* Do NOT ask the user to paste their API key in chat — use `brain auth set-api-key` (reads via `rpassword`) or set `BRAIN_API_KEY` before invoking the CLI.
* Do NOT embed raw Descope endpoints in scripts. `brain auth` is the stable interface; shell-outs to `api.descope.com` break when projects migrate.
* Do NOT use `brain research submit --wait` with `--depth ultra_deep` — ultra-deep jobs run up to an hour, longer than any bash tool timeout. Use `/ultra-research` (which schedules a `/loop` cron) instead.
* Do NOT re-submit a research query if a previous job is still running — `brain research get <id>` picks up where you left off.
* Do NOT hardcode endpoints. The CLI already defaults to `https://api.grep.ai` and respects `BRAIN_ENDPOINT` / `--endpoint`.
