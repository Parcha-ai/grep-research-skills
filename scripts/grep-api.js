#!/usr/bin/env node
/**
 * GREP API Client - Submit research jobs and poll for results
 *
 * Targets the v2 surface at `/api/v2/*`. Auth is Descope JWT or a `grp_*` API
 * key, both sent as `Authorization: Bearer <token>` — reads
 * ~/.grep/session.json (populated by scripts/auth.js).
 *
 * Usage:
 *   node grep-api.js run "What is quantum computing?" --effort=low
 *   node grep-api.js status <slug>
 *   node grep-api.js result <slug>
 *   node grep-api.js files <slug>
 *
 * Note: the wallet/PAYG gateway path (Receipt-bearer auth, x402, Stripe Link,
 * Base USDC) lives on the `mpp-gateway-future` branch. It re-enters the script
 * once the backend's MPP gateway is GA.
 */

const fs = require('fs');
const path = require('path');

const GREP_API_BASE = process.env.GREP_API_BASE || 'https://api.grep.ai';
const SESSION_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.grep', 'session.json');
const DESCOPE_PROJECT_ID = 'P35S8vZ7BYoDSOJVaYbIDRZObJq6';
const DESCOPE_BASE_URL = 'https://api.descope.com';

// UI host derivation — for printing user-facing https://grep.ai/research/<slug> links.
//   https://api.grep.ai           → https://grep.ai
//   https://preview-api.grep.ai   → https://preview.grep.ai
// Override via GREP_UI_BASE if the heuristic doesn't match the deployment.
const GREP_UI_BASE = process.env.GREP_UI_BASE
  || GREP_API_BASE.replace('://api.', '://').replace('://preview-api.', '://preview.');

const BASE_PATH = process.env.GREP_API_BASE_PATH || '/api/v2';

// Map legacy depth vocab to canonical effort vocab.
const DEPTH_TO_EFFORT = {
  ultra_fast: 'low',
  deep: 'medium',
  ultra: 'high',
  ultra_deep: 'high',
};

// Load session from disk
function loadSession() {
  try {
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveSession(session) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), { mode: 0o600 });
}

// Check if JWT is expired (with 30s buffer so we refresh proactively)
function isExpired(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
    return payload.exp * 1000 < Date.now() + 30_000;
  } catch (e) {
    return true;
  }
}

// Refresh the session JWT using the refresh JWT.
// Descope /v1/auth/refresh expects Authorization: Bearer <projectId>:<refreshJwt>
async function refreshSession(session) {
  const res = await fetch(`${DESCOPE_BASE_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DESCOPE_PROJECT_ID}:${session.refreshJwt}`,
    },
    body: '{}',
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Refresh failed: ${res.status} ${errText}`);
  }
  const data = await res.json();
  const updated = {
    ...session,
    sessionJwt: data.sessionJwt || session.sessionJwt,
    refreshJwt: data.refreshJwt || session.refreshJwt,
  };
  saveSession(updated);
  return updated;
}

// Get a valid session token, refreshing if needed. Called on EVERY API request
// so long-running polls survive JWT expiration mid-flight.
async function getValidToken() {
  let session = loadSession();
  if (!session) {
    console.error('Not authenticated. Run: grep-login');
    process.exit(1);
  }

  // API key sessions bypass JWT refresh — keys are long-lived.
  if (session.apiKey) return session.apiKey;

  if (isExpired(session.sessionJwt)) {
    if (!session.refreshJwt || isExpired(session.refreshJwt)) {
      console.error('Session expired and refresh token is also expired. Run: grep-login');
      process.exit(1);
    }
    try {
      session = await refreshSession(session);
    } catch (e) {
      console.error(`Token refresh failed: ${e.message}. Run: grep-login`);
      process.exit(1);
    }
  }

  return session.sessionJwt;
}

// Build the Authorization header. v2 only — Bearer <Descope JWT> or
// Bearer <grp_* API key>, both fetched from getValidToken (which reads
// ~/.grep/session.json and refreshes the JWT proactively).
async function buildAuthHeaders() {
  const token = await getValidToken();
  return { Authorization: `Bearer ${token}` };
}

// Print a 402 payment-required body and exit 3.
//
// On v2, 402 means the user's subscription tier is out of credits or doesn't
// cover the requested effort — they need to upgrade their plan or top up.
// Direct them to /grep-upgrade. (The wallet/PAYG gateway flow with x402 rails
// lives on the mpp-gateway-future branch.)
async function handle402(res) {
  const eb = await res.json().catch(() => ({}));
  console.error(JSON.stringify({
    error: 'payment_required',
    code: eb.error?.code || eb.code || 'payment_required',
    message: eb.error?.message || eb.detail || eb.message
      || 'Subscription quota exceeded — upgrade your plan or top up.',
    upgrade_url: `${GREP_UI_BASE}/upgrade`,
    hint: 'Run `/grep-upgrade` from your AI agent, or visit the upgrade URL above.',
    raw: eb,
  }, null, 2));
  process.exit(3);
}

// API call helper — fetches a fresh (possibly refreshed) token on every call.
async function api(method, endpoint, body) {
  const headers = await buildAuthHeaders();
  headers['Content-Type'] = 'application/json';
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${GREP_API_BASE}${endpoint}`, opts);

  if (res.status === 402) {
    await handle402(res);
    return;  // unreachable; handle402 calls process.exit(3)
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

// === Commands ===

function buildSubmitBody(query, options = {}) {
  const body = {
    question: query,
    effort: options.effort || DEPTH_TO_EFFORT[options.depth] || 'medium',
  };
  if (options.expertId)              body.expert_id = options.expertId;
  if (options.outputType)            body.output_type = options.outputType;
  if (options.context)               body.context = options.context;
  if (options.responseLanguage)      body.response_language = options.responseLanguage;
  if (options.jsonSchema)            body.json_schema = options.jsonSchema;
  if (options.referenceJobs?.length) body.reference_jobs = options.referenceJobs;
  if (options.attachmentIds?.length) body.attachment_ids = options.attachmentIds;
  if (options.renderRichReport)      body.render_rich_report = true;
  if (options.webhookUrl)            body.webhook_url = options.webhookUrl;
  return body;
}

async function submitResearch(query, options = {}) {
  const body = buildSubmitBody(query, options);
  const result = await api('POST', `${BASE_PATH}/research`, body);
  console.log(JSON.stringify(result, null, 2));
}

async function checkStatus(jobIdOrSlug) {
  const result = await api('GET', `${BASE_PATH}/research/${jobIdOrSlug}`);
  console.log(JSON.stringify(result, null, 2));
}

async function getResult(jobIdOrSlug, options = {}) {
  // Polls until the job is complete (or maxWaitSeconds elapses). Same shape
  // as runResearch's polling loop — bounded wall clock, 15s interval after
  // an initial 20s wait, exits 0 with the report on success, 1 on failure,
  // 2 on timeout. Use --no-wait to get the legacy single-GET behaviour.
  const maxWaitSeconds = Number(options.maxWaitSeconds || 540);
  const initialWaitMs = options.noWait ? 0 : 20_000;
  const pollIntervalMs = 15_000;

  // Single GET path — print whatever the server has now and exit 0
  if (options.noWait) {
    const result = await api('GET', `${BASE_PATH}/research/${jobIdOrSlug}`);
    const report = extractReport(result);
    const slug = result.slug || jobIdOrSlug;
    const jobUrl = `${GREP_UI_BASE}/research/${slug}`;
    if (report) {
      console.log(`Status: ${result.status}\n\n${report}`);
      console.log(`\n---\n[View full report on GREP](${jobUrl})`);
    } else {
      console.log(JSON.stringify(result, null, 2));
      console.log(`\n---\n[View full report on GREP](${jobUrl})`);
    }
    return;
  }

  // Polling path — wait for the job to reach a terminal status.
  // Hoist `slug` to function scope so the timeout branch below has access to
  // the server-returned pretty slug (rather than falling back to a raw UUID
  // when the caller resumed via job_id).
  const startedAt = Date.now();
  let attempt = 0;
  let seenMessageCount = 0;
  let slug = jobIdOrSlug;
  if (initialWaitMs) await sleep(initialWaitMs);

  while ((Date.now() - startedAt) / 1000 < maxWaitSeconds) {
    attempt++;
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const result = await api('GET', `${BASE_PATH}/research/${jobIdOrSlug}`);
    const status = result.status;
    slug = result.slug || slug;

    // Print new status messages since the last poll
    const messages = result.status_messages || [];
    if (messages.length > seenMessageCount) {
      for (let i = seenMessageCount; i < messages.length; i++) {
        const msg = messages[i];
        const statusText = msg?.content?.status || msg?.content?.text || '';
        if (statusText) {
          const summary = statusText.length > 300 ? statusText.slice(0, 297) + '...' : statusText;
          process.stderr.write(`[result] > ${summary}\n`);
        }
      }
      seenMessageCount = messages.length;
    } else if (!messages.length && result.message && (attempt === 1 || attempt % 4 === 0)) {
      process.stderr.write(`[result] > ${result.message}\n`);
    }

    if (status === 'completed' || status === 'complete') {
      process.stderr.write(`[result] Completed in ${elapsed}s (${attempt} polls)\n`);
      const report = extractReport(result);
      const jobUrl = `${GREP_UI_BASE}/research/${slug}`;
      if (report) {
        console.log(`Status: ${result.status}\n\n${report}`);
        console.log(`\n---\n[View full report on GREP](${jobUrl})`);
      } else {
        console.log(JSON.stringify(result, null, 2));
        console.log(`\n---\n[View full report on GREP](${jobUrl})`);
      }
      return;
    }

    if (status === 'failed') {
      console.error(`[result] Job failed: ${result.error || 'unknown error'}`);
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    process.stderr.write(`[result] ${status} (${elapsed}s elapsed, poll ${attempt})...\n`);
    await sleep(pollIntervalMs);
  }

  // Timeout — print what we have and exit 2 so callers can resume.
  // `slug` was last set inside the loop to the server-returned pretty slug;
  // the timeout branch reuses that instead of redeclaring it.
  process.stderr.write(`[result] Timed out after ${maxWaitSeconds}s. Job still running.\n`);
  const jobUrl = `${GREP_UI_BASE}/research/${slug}`;
  console.log(JSON.stringify({
    status: 'timeout',
    slug,
    job_url: jobUrl,
    message: `Job still running after ${maxWaitSeconds}s. Re-run \`result ${slug}\` later or use \`--no-wait\` for a single GET.`,
  }, null, 2));
  process.exit(2);
}

async function listJobs() {
  const result = await api('GET', `${BASE_PATH}/research`);
  console.log(JSON.stringify(result, null, 2));
}

async function listFiles(jobIdOrSlug) {
  const result = await api('GET', `${BASE_PATH}/research/${jobIdOrSlug}/files`);
  console.log(JSON.stringify(result, null, 2));
}

async function readFile(jobIdOrSlug, filePath) {
  // Encode each path segment with encodeURIComponent (not encodeURI) so #, ?, &, =
  // in filenames don't silently corrupt the URL.
  const encoded = filePath.split('/').map(encodeURIComponent).join('/');

  // Bypass api()'s unconditional res.json() — workspace files are usually
  // markdown/plaintext/binary, not JSON. Build the request inline so we can
  // dispatch on Content-Type.
  const headers = await buildAuthHeaders();
  const res = await fetch(`${GREP_API_BASE}${BASE_PATH}/research/${jobIdOrSlug}/files/${encoded}`, { headers });
  if (res.status === 402) { await handle402(res); return; }
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const obj = await res.json();
    process.stdout.write(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
  } else {
    // Text, markdown, HTML, CSS, JS — write through verbatim. Binary files
    // (images, PDFs) are written as a Buffer — callers can redirect to a file.
    const buf = Buffer.from(await res.arrayBuffer());
    process.stdout.write(buf);
  }
}

async function getTimeline(jobIdOrSlug) {
  const result = await api('GET', `${BASE_PATH}/research/${jobIdOrSlug}/timeline`);
  console.log(JSON.stringify(result, null, 2));
}

async function cancelJob(jobIdOrSlug) {
  const result = await api('POST', `${BASE_PATH}/research/${jobIdOrSlug}/cancel`, {});
  console.log(JSON.stringify(result, null, 2));
}

async function continueJob(jobIdOrSlug, question, opts = {}) {
  // Forward the same body fields a fresh POST /research accepts, EXCEPT
  // expert_id (the parent job's expert is inherited) and reference_jobs
  // (the parent IS the reference). Everything else is a valid continuation
  // hint — output_type especially, since "build me a deck from this research"
  // is a canonical follow-up.
  const body = { question };
  if (opts.effort)                   body.effort = opts.effort;
  if (opts.context)                  body.context = opts.context;
  if (opts.outputType)               body.output_type = opts.outputType;
  if (opts.responseLanguage)         body.response_language = opts.responseLanguage;
  if (opts.jsonSchema)               body.json_schema = opts.jsonSchema;
  if (opts.attachmentIds?.length)    body.attachment_ids = opts.attachmentIds;
  if (opts.renderRichReport)         body.render_rich_report = true;
  if (opts.webhookUrl)               body.webhook_url = opts.webhookUrl;
  const result = await api('POST', `${BASE_PATH}/research/${jobIdOrSlug}/continue`, body);
  console.log(JSON.stringify(result, null, 2));
}

async function uploadAttachment(filePath) {
  const fileBuf = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const form = new FormData();
  form.append('files', new Blob([fileBuf]), fileName);

  const headers = await buildAuthHeaders();
  const res = await fetch(`${GREP_API_BASE}${BASE_PATH}/attachments`, {
    method: 'POST',
    headers,
    body: form,
  });
  if (res.status === 402) { await handle402(res); return; }
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  console.log(JSON.stringify(await res.json(), null, 2));
}

async function deleteAttachment(id) {
  const headers = await buildAuthHeaders();
  const res = await fetch(`${GREP_API_BASE}${BASE_PATH}/attachments/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (res.status === 402) { await handle402(res); return; }
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  console.log(JSON.stringify({ deleted: id }, null, 2));
}

async function listExperts() {
  // Public, no auth.
  const res = await fetch(`${GREP_API_BASE}${BASE_PATH}/experts`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  console.log(JSON.stringify(await res.json(), null, 2));
}

async function getDiscovery() {
  // v2 publishes its contract via /openapi.json — public, no auth.
  const res = await fetch(`${GREP_API_BASE}/openapi.json`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  console.log(JSON.stringify(await res.json(), null, 2));
}

// Sleep helper
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Extract the report text from a completed job response.
// The report is the last text_block message — it lives in content.content.text
// (inner content) for text_block types. Falls back to content.text or content.status.
function extractReport(result) {
  const messages = result.status_messages || [];
  // Walk backwards — the report is typically one of the last messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const inner = m?.content?.content;
    const innerType = inner?.type || '';
    // text_block with inner text is the report
    if (innerType === 'text_block' && inner?.text) {
      const text = inner.text;
      if (text.includes('##') || text.length > 500) {
        return text;
      }
    }
    // Fallback: check content.text directly
    const text = m?.content?.text || '';
    if (text && (text.includes('##') || text.length > 500)) {
      return text;
    }
  }
  return null;
}

// Submit a research job and block until it completes, with polling + backoff.
// Prints heartbeat to stderr, final report to stdout.
// Exits 0 on success, 1 on failure, 2 on timeout (with job_id so caller can resume).
async function runResearch(query, options = {}) {
  // Default max wait: 540s (9 min). Must stay under the Bash tool's 10-min hard cap.
  const maxWaitSeconds = Number(options.maxWaitSeconds || 540);
  const initialWaitMs = 20_000;  // first poll after 20s
  const pollIntervalMs = 15_000; // then every 15s

  // 1. Submit
  const submitBody = buildSubmitBody(query, options);
  process.stderr.write(`[research] Submitting (effort=${submitBody.effort}${submitBody.expert_id ? `, expert=${submitBody.expert_id}` : ''}${submitBody.output_type ? `, output_type=${submitBody.output_type}` : ''})...\n`);
  const submitted = await api('POST', `${BASE_PATH}/research`, submitBody);
  const jobId = submitted.job_id || submitted.id;
  const slug = submitted.slug || jobId;
  if (!jobId) {
    console.error('[research] No job_id in submit response');
    console.error(JSON.stringify(submitted, null, 2));
    process.exit(1);
  }
  process.stderr.write(`[research] Job ${slug} submitted, polling for results...\n`);

  // 2. Poll with bounded wall clock
  const startedAt = Date.now();
  let attempt = 0;
  let seenMessageCount = 0;
  await sleep(initialWaitMs);

  while ((Date.now() - startedAt) / 1000 < maxWaitSeconds) {
    attempt++;
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const result = await api('GET', `${BASE_PATH}/research/${slug}`);
    const status = result.status;

    // Print any new status messages since last poll.
    const messages = result.status_messages || [];
    if (messages.length > seenMessageCount) {
      for (let i = seenMessageCount; i < messages.length; i++) {
        const msg = messages[i];
        const statusText = msg?.content?.status || msg?.content?.text || '';
        if (statusText) {
          const summary = statusText.length > 300 ? statusText.slice(0, 297) + '...' : statusText;
          process.stderr.write(`[research] > ${summary}\n`);
        }
      }
      seenMessageCount = messages.length;
    } else if (!messages.length && result.message && (attempt === 1 || attempt % 4 === 0)) {
      // Gateway-style heartbeat — no streaming messages, just the high-level status.
      process.stderr.write(`[research] > ${result.message}\n`);
    }

    if (status === 'completed' || status === 'complete') {
      process.stderr.write(`[research] Completed in ${elapsed}s (${attempt} polls)\n`);
      const report = extractReport(result);
      const jobUrl = `${GREP_UI_BASE}/research/${slug}`;
      if (report) {
        console.log(report);
        console.log(`\n---\n[View full report on GREP](${jobUrl})`);
      } else {
        console.log(JSON.stringify(result, null, 2));
        console.log(`\n---\n[View full report on GREP](${jobUrl})`);
      }
      return;
    }

    if (status === 'failed') {
      console.error(`[research] Job failed: ${result.error || 'unknown error'}`);
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    process.stderr.write(`[research] ${status} (${elapsed}s elapsed, poll ${attempt})...\n`);
    await sleep(pollIntervalMs);
  }

  // 3. Timeout — leave the job running, caller can resume via status/result
  process.stderr.write(`[research] Timed out after ${maxWaitSeconds}s. Job still running.\n`);
  const jobUrl = `${GREP_UI_BASE}/research/${slug}`;
  console.log(JSON.stringify({
    status: 'timeout',
    job_id: jobId,
    slug,
    job_url: jobUrl,
    message: `Research job is still running after ${maxWaitSeconds}s. Check later with: status ${slug}`,
  }, null, 2));
  process.exit(2);
}

// === Main ===

// Parse argv: pull out flags like --effort=low, --max-wait=600, leaving positional args
function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq >= 0) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        flags[arg.slice(2)] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

const [,, command, ...rawArgs] = process.argv;
const { positional: args, flags } = parseArgs(rawArgs);

// Load context from file if --context-file flag is provided
function loadContext() {
  if (flags['context-file']) {
    try {
      return fs.readFileSync(flags['context-file'], 'utf8');
    } catch (e) {
      console.error(`Failed to read context file: ${e.message}`);
      process.exit(1);
    }
  }
  return flags.context || undefined;
}

function loadJsonSchema() {
  if (flags['json-schema-file']) {
    try {
      return JSON.parse(fs.readFileSync(flags['json-schema-file'], 'utf8'));
    } catch (e) {
      console.error(`Failed to read json-schema-file: ${e.message}`);
      process.exit(1);
    }
  }
  return undefined;
}

function commonOptions() {
  return {
    effort: flags.effort,
    depth: flags.depth,  // legacy
    maxWaitSeconds: flags['max-wait'],
    context: loadContext(),
    expertId: flags['expert-id'],
    outputType: flags['output-type'],
    referenceJobs: flags['reference-jobs']?.split(',').filter(Boolean),
    attachmentIds: flags['attachment-ids']?.split(',').filter(Boolean),
    renderRichReport: flags['render-rich-report'] === true,
    webhookUrl: flags['webhook-url'],
    jsonSchema: loadJsonSchema(),
    responseLanguage: flags['response-language'],
  };
}

switch (command) {
  case 'run':
    if (!args[0]) { console.error('Usage: grep-api.js run "query" [--effort=low|medium|high|build] [--max-wait=540] [--context-file=path] [--expert-id=...] [--output-type=...]'); process.exit(1); }
    runResearch(args.join(' '), commonOptions()).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'research':
    if (!args[0]) { console.error('Usage: grep-api.js research "query" [--effort=...]'); process.exit(1); }
    submitResearch(args.join(' '), commonOptions()).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'status':
    if (!args[0]) { console.error('Usage: grep-api.js status <job_id_or_slug>'); process.exit(1); }
    checkStatus(args[0]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'result':
    if (!args[0]) { console.error('Usage: grep-api.js result <job_id_or_slug> [--no-wait] [--max-wait=540]'); process.exit(1); }
    getResult(args[0], { noWait: flags['no-wait'] === true, maxWaitSeconds: flags['max-wait'] }).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'jobs':
    listJobs().catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'files':
    if (!args[0]) { console.error('Usage: grep-api.js files <job_id_or_slug>'); process.exit(1); }
    listFiles(args[0]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'file':
    if (!args[0] || !args[1]) { console.error('Usage: grep-api.js file <job_id_or_slug> <path>'); process.exit(1); }
    readFile(args[0], args[1]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'timeline':
    if (!args[0]) { console.error('Usage: grep-api.js timeline <job_id_or_slug>'); process.exit(1); }
    getTimeline(args[0]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'cancel':
    if (!args[0]) { console.error('Usage: grep-api.js cancel <job_id_or_slug>'); process.exit(1); }
    cancelJob(args[0]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'continue':
    if (!args[0] || !args[1]) { console.error('Usage: grep-api.js continue <job_id_or_slug> "<follow-up question>" [--effort=...] [--output-type=...] [--attachment-ids=...] [--json-schema-file=...] [--render-rich-report] [--webhook-url=...] [--response-language=...] [--context=...] [--context-file=...]'); process.exit(1); }
    continueJob(args[0], args.slice(1).join(' '), {
      effort: flags.effort,
      context: loadContext(),
      outputType: flags['output-type'],
      responseLanguage: flags['response-language'],
      jsonSchema: loadJsonSchema(),
      attachmentIds: flags['attachment-ids']?.split(',').filter(Boolean),
      renderRichReport: flags['render-rich-report'] === true,
      webhookUrl: flags['webhook-url'],
    }).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'upload':
    if (!args[0]) { console.error('Usage: grep-api.js upload <path>'); process.exit(1); }
    uploadAttachment(args[0]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'delete-attachment':
    if (!args[0]) { console.error('Usage: grep-api.js delete-attachment <attachment_id>'); process.exit(1); }
    deleteAttachment(args[0]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'experts':
    listExperts().catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'discovery':
    getDiscovery().catch(e => { console.error(e.message); process.exit(1); });
    break;
  default:
    console.error('GREP API Client (v2)');
    console.error('');
    console.error('Auth:');
    console.error('  Descope JWT or grp_* API key — Bearer auth, read from ~/.grep/session.json');
    console.error('  (populated by `scripts/auth.js login <email>` or `set-api-key grp_xxx`).');
    console.error('');
    console.error('Usage:');
    console.error('  node grep-api.js run "query"               Submit + poll to completion (blocking)');
    console.error('  node grep-api.js research "query"          Submit a research job (non-blocking)');
    console.error('  node grep-api.js status <slug>             Check job status');
    console.error('  node grep-api.js result <slug>             Poll until complete + render report (--no-wait for one-shot GET)');
    console.error('  node grep-api.js jobs                      List recent jobs');
    console.error('  node grep-api.js files <slug>              List workspace files');
    console.error('  node grep-api.js file <slug> <path>        Read one workspace file');
    console.error('  node grep-api.js timeline <slug>           Get message timeline');
    console.error('  node grep-api.js cancel <slug>             Cancel a running job');
    console.error('  node grep-api.js continue <slug> "..."     Continue a completed job with follow-up');
    console.error('  node grep-api.js upload <path>             Upload an attachment (returns attachment_id)');
    console.error('  node grep-api.js delete-attachment <id>    Delete an attachment');
    console.error('  node grep-api.js experts                   List public domain experts (free, no auth)');
    console.error('  node grep-api.js discovery                 OpenAPI doc (free, no auth)');
    console.error('');
    console.error('Flags:');
    console.error('  --effort=<low|medium|high|build>     Effort tier (default: medium)');
    console.error('    low      ~25s — quick lookup');
    console.error('    medium   ~5min — standard');
    console.error('    high     up to 1 hour — exhaustive');
    console.error('    build    10-15 min — runnable HTML (used with --output-type)');
    console.error('  --depth=<ultra_fast|deep|ultra_deep> Legacy alias for --effort (mapped automatically)');
    console.error('  --expert-id=<id>                     Route to a specific expert (see `experts` command)');
    console.error('  --output-type=<slidedeck|spreadsheet|html_app|podcast|video|news_broadcast>');
    console.error('  --reference-jobs=<id1>,<id2>         Build on prior jobs (multi-step workflows)');
    console.error('  --attachment-ids=<id1>,<id2>         Mount uploaded files in the workspace');
    console.error('  --render-rich-report                 Request a rich-rendered report');
    console.error('  --webhook-url=<url>                  POST completion to this URL');
    console.error('  --json-schema-file=<path>            Constrain output to a JSON Schema');
    console.error('  --response-language=<lang>           Response language (e.g. "en", "es")');
    console.error('  --max-wait=<seconds>                 Max wait for `run` (default 540, cap 540)');
    console.error('  --context-file=<path>                Read context from file');
    console.error('  --context="<text>"                   Inline context string');
    console.error('');
    console.error('Env:');
    console.error('  GREP_API_BASE              API host (default https://api.grep.ai; use https://preview-api.grep.ai for preview)');
    console.error('  GREP_UI_BASE               UI host for printed report links (auto-derived from GREP_API_BASE; override if needed)');
    console.error('  GREP_API_BASE_PATH         Override the base path (rare; defaults to /api/v2)');
    console.error('');
    console.error('Exit codes:');
    console.error('  0 success   1 error/auth   2 timeout (job still running)');
    console.error('  3 payment_required (subscription quota exceeded — run /grep-upgrade)');
    process.exit(1);
}
