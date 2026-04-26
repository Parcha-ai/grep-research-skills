#!/usr/bin/env node
/**
 * GREP API Client - Submit research jobs and poll for results
 *
 * Usage:
 *   node grep-api.js research "What is quantum computing?"
 *   node grep-api.js status <job_id>
 *   node grep-api.js result <job_id>
 *
 * Reads auth token from ~/.grep/session.json (via auth.js)
 */

const fs = require('fs');
const path = require('path');

const GREP_API_BASE = process.env.GREP_API_BASE || 'https://api.grep.ai';
const SESSION_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.grep', 'session.json');
const DESCOPE_PROJECT_ID = 'P35S8vZ7BYoDSOJVaYbIDRZObJq6';
const DESCOPE_BASE_URL = 'https://api.descope.com';

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

// API call helper — fetches a fresh (possibly refreshed) token on every call.
async function api(method, endpoint, body) {
  const token = await getValidToken();
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${GREP_API_BASE}${endpoint}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

// === Commands ===

async function submitResearch(query, options = {}) {
  const body = {
    question: query,
    depth: options.depth || 'deep',
  };
  if (options.approach) body.approach = options.approach;
  if (options.context) body.context = options.context;

  const result = await api('POST', '/api/v1/research', body);
  console.log(JSON.stringify(result, null, 2));
}

async function checkStatus(jobId) {
  const result = await api('GET', `/api/v1/research/${jobId}?include_status_messages=true`);
  console.log(JSON.stringify(result, null, 2));
}

async function getResult(jobId) {
  const result = await api('GET', `/api/v1/research/${jobId}?include_status_messages=true`);
  const report = extractReport(result);
  const jobUrl = `https://grep.ai/research/${jobId}`;
  if (report) {
    console.log(`Status: ${result.status}\n\n${report}`);
    console.log(`\n---\n[View full report on GREP](${jobUrl})`);
  } else {
    console.log(JSON.stringify(result, null, 2));
    console.log(`\n---\n[View full report on GREP](${jobUrl})`);
  }
}

async function listJobs() {
  const result = await api('GET', '/api/v1/research');
  console.log(JSON.stringify(result, null, 2));
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
  const depth = options.depth || 'deep';
  // Default max wait: 540s (9 min). Must stay under the Bash tool's 10-min hard cap.
  // Individual skills override this: /quick-research uses 60, /research uses 540,
  // /ultra-research does NOT use `run` (it submits + polls across turns) because
  // ultra-deep jobs can run up to 1 hour.
  const maxWaitSeconds = Number(options.maxWaitSeconds || 540);
  const initialWaitMs = 20_000;  // first poll after 20s
  const pollIntervalMs = 15_000; // then every 15s

  // 1. Submit
  const submitBody = { question: query, depth };
  if (options.context) submitBody.context = options.context;
  process.stderr.write(`[research] Submitting (depth=${depth})...\n`);
  const submitted = await api('POST', '/api/v1/research', submitBody);
  const jobId = submitted.job_id || submitted.id;
  if (!jobId) {
    console.error('[research] No job_id in submit response');
    console.error(JSON.stringify(submitted, null, 2));
    process.exit(1);
  }
  process.stderr.write(`[research] Job ${jobId} submitted, polling for results...\n`);

  // 2. Poll with bounded wall clock
  const startedAt = Date.now();
  let attempt = 0;
  let seenMessageCount = 0; // track which status_messages we've already printed
  await sleep(initialWaitMs);

  while ((Date.now() - startedAt) / 1000 < maxWaitSeconds) {
    attempt++;
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const result = await api('GET', `/api/v1/research/${jobId}?include_status_messages=true`);
    const status = result.status;

    // Print any new status messages since last poll.
    // Messages have structure: { event, content: { status, content: { type } } }
    // The human-readable progress is in content.status (e.g. "Thinking: ...", "Searching...")
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
    }

    if (status === 'completed' || status === 'complete') {
      process.stderr.write(`[research] Completed in ${elapsed}s (${attempt} polls)\n`);
      const report = extractReport(result);
      const jobUrl = `https://grep.ai/research/${jobId}`;
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
  const jobUrl = `https://grep.ai/research/${jobId}`;
  console.log(JSON.stringify({
    status: 'timeout',
    job_id: jobId,
    job_url: jobUrl,
    message: `Research job is still running after ${maxWaitSeconds}s. Check later with: status ${jobId}`,
  }, null, 2));
  process.exit(2);
}

// === Main ===

// Parse argv: pull out flags like --depth=deep, --max-wait=600, leaving positional args
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

switch (command) {
  case 'run':
    // Blocking: submit + poll to completion + print report
    if (!args[0]) { console.error('Usage: grep-api.js run "query" [--depth=deep|ultra_fast|ultra_deep] [--max-wait=480] [--context-file=path]'); process.exit(1); }
    runResearch(args.join(' '), {
      depth: flags.depth,
      maxWaitSeconds: flags['max-wait'],
      context: loadContext(),
    }).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'research':
    // Non-blocking: submit only, print job_id
    if (!args[0]) { console.error('Usage: grep-api.js research "query"'); process.exit(1); }
    submitResearch(args.join(' '), { depth: flags.depth, context: loadContext() }).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'status':
    if (!args[0]) { console.error('Usage: grep-api.js status <job_id>'); process.exit(1); }
    checkStatus(args[0]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'result':
    if (!args[0]) { console.error('Usage: grep-api.js result <job_id>'); process.exit(1); }
    getResult(args[0]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'jobs':
    listJobs().catch(e => { console.error(e.message); process.exit(1); });
    break;
  default:
    console.error('GREP API Client');
    console.error('');
    console.error('Usage:');
    console.error('  node grep-api.js run "query"         Submit + poll to completion (blocking)');
    console.error('  node grep-api.js research "query"    Submit a research job (non-blocking)');
    console.error('  node grep-api.js status <job_id>     Check job status');
    console.error('  node grep-api.js result <job_id>     Get job results');
    console.error('  node grep-api.js jobs                List recent jobs');
    console.error('');
    console.error('Flags:');
    console.error('  --depth=<ultra_fast|deep|ultra_deep>  Research depth (default: deep)');
    console.error('    ultra_fast  ~25 seconds');
    console.error('    deep        ~5 minutes (range 2-9 min)');
    console.error('    ultra_deep  up to 1 hour — NOT recommended with `run`, use `research` + polling');
    console.error('  --max-wait=<seconds>                  Max wait for `run` command (default: 540, cap 540)');
    console.error('  --context-file=<path>                 Read additional context from file and send with request');
    console.error('  --context="<text>"                    Inline additional context string');
    process.exit(1);
}
