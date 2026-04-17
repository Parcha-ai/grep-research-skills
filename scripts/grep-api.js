#!/usr/bin/env node
/**
 * GREP API Client - Submit research jobs, manage workspace/projects/experts/inputs/defaults
 *
 * Usage:
 *   node grep-api.js run "What is quantum computing?"
 *   node grep-api.js status <job_id>
 *   node grep-api.js search --status=complete --query="parcha"
 *   node grep-api.js inputs:attach <job_id> /path/to/data.csv
 *   node grep-api.js defaults:upload local.md=remote/path.md
 *   node grep-api.js ws:tree
 *   node grep-api.js project:upload acme ./SOP.md
 *   node grep-api.js expert:init medical-expert
 *
 * Reads auth token from ~/.grep/session.json (via auth.js)
 */

const fs = require('fs');
const path = require('path');

const GREP_API_BASE = process.env.GREP_API_BASE || 'https://preview-api.grep.ai';
const SESSION_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.grep', 'session.json');
const DESCOPE_PROJECT_ID = 'P38Xct9AhA95T0MU5T8g7o9V9886';
const DESCOPE_BASE_URL = 'https://api.descope.com';

// =============================================================================
// Session + auth (unchanged from v0.1)
// =============================================================================

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

function isExpired(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
    return payload.exp * 1000 < Date.now() + 30_000;
  } catch (e) {
    return true;
  }
}

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

async function getValidToken() {
  let session = loadSession();
  if (!session) {
    console.error('Not authenticated. Run: grep-login');
    process.exit(1);
  }
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

// =============================================================================
// HTTP helpers
// =============================================================================

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
  // Some endpoints (DELETE) may return empty bodies; tolerate.
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { _raw: text }; }
}

// Multipart upload helper. `parts` is an array of { name, filename?, value }
// where value can be a string (form field) or a Buffer (file body).
async function apiMultipart(method, endpoint, parts) {
  const token = await getValidToken();
  const form = new FormData();
  for (const p of parts) {
    if (p.filename !== undefined && Buffer.isBuffer(p.value)) {
      // File part — wrap Buffer in Blob with optional content-type.
      const blob = new Blob([p.value], { type: p.contentType || 'application/octet-stream' });
      form.append(p.name, blob, p.filename);
    } else {
      form.append(p.name, p.value);
    }
  }
  const res = await fetch(`${GREP_API_BASE}${endpoint}`, {
    method,
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { _raw: text }; }
}

// Read file → { name, buffer, contentType }
function readFile(p) {
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  const buf = fs.readFileSync(abs);
  // Best-effort MIME from extension; backend re-detects anyway.
  const ext = path.extname(abs).toLowerCase();
  const mimeMap = {
    '.md': 'text/markdown', '.txt': 'text/plain', '.json': 'application/json',
    '.yaml': 'application/yaml', '.yml': 'application/yaml',
    '.csv': 'text/csv', '.pdf': 'application/pdf',
    '.html': 'text/html', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  };
  return { name: path.basename(abs), buffer: buf, contentType: mimeMap[ext] || 'application/octet-stream' };
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

// =============================================================================
// Research submit / status / result (existing v0.1 + new optional fields)
// =============================================================================

// Build a research-submit body from optional fields. Only sets keys the user passed.
function buildSubmitBody(query, options) {
  const body = { question: query };
  // depth (alias of effort) — preserve v0.1 default of 'deep' when caller passes nothing.
  body.depth = options.depth || 'deep';

  if (options.approach) body.approach = options.approach;
  if (options.context) body.context = options.context;

  // New fields from feat/workspace-projects-browser:
  if (options.project) body.project = options.project;
  if (options.expert) body.expert_id = options.expert;
  if (options.language) body.language = options.language;
  if (options.fromDate) body.from_date = options.fromDate;
  if (options.toDate) body.to_date = options.toDate;
  if (options.additionalThesis) body.additional_thesis = options.additionalThesis;
  if (options.website) body.website = options.website;
  if (options.skipClarification) body.skip_clarification = true;
  if (options.actionMode) body.action_mode = true;
  if (options.outputType) body.output_type = options.outputType;
  if (options.customSkills && options.customSkills.length) body.custom_skills = options.customSkills;
  if (options.customMcpTools && options.customMcpTools.length) body.custom_mcp_tools = options.customMcpTools;

  return body;
}

async function submitResearch(query, options = {}) {
  const result = await api('POST', '/api/v1/research', buildSubmitBody(query, options));
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

async function listJobs(opts = {}) {
  const limit = opts.limit ? `?limit=${opts.limit}` : '';
  const result = await api('GET', `/api/v1/research${limit}`);
  console.log(JSON.stringify(result, null, 2));
}

function extractReport(result) {
  const messages = result.status_messages || [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const inner = m?.content?.content;
    const innerType = inner?.type || '';
    if (innerType === 'text_block' && inner?.text) {
      const text = inner.text;
      if (text.includes('##') || text.length > 500) return text;
    }
    const text = m?.content?.text || '';
    if (text && (text.includes('##') || text.length > 500)) return text;
  }
  return null;
}

async function runResearch(query, options = {}) {
  const depth = options.depth || 'deep';
  const maxWaitSeconds = Number(options.maxWaitSeconds || 540);
  const initialWaitMs = 20_000;
  const pollIntervalMs = 15_000;

  const submitBody = buildSubmitBody(query, options);
  process.stderr.write(`[research] Submitting (depth=${depth})...\n`);
  const submitted = await api('POST', '/api/v1/research', submitBody);
  const jobId = submitted.job_id || submitted.id;
  if (!jobId) {
    console.error('[research] No job_id in submit response');
    console.error(JSON.stringify(submitted, null, 2));
    process.exit(1);
  }
  process.stderr.write(`[research] Job ${jobId} submitted, polling for results...\n`);

  const startedAt = Date.now();
  let attempt = 0;
  let seenMessageCount = 0;
  await sleep(initialWaitMs);

  while ((Date.now() - startedAt) / 1000 < maxWaitSeconds) {
    attempt++;
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const result = await api('GET', `/api/v1/research/${jobId}?include_status_messages=true`);
    const status = result.status;

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

// =============================================================================
// Search jobs (client-side filter over /api/v1/research)
//   Backend has no full-text search yet; we page through and filter locally.
// =============================================================================

async function searchJobs(opts = {}) {
  const limit = Number(opts.limit) || 50;
  const offset = Number(opts.offset) || 0;
  const wantStatus = opts.status ? String(opts.status).toLowerCase() : null;
  const queryNeedle = opts.query ? String(opts.query).toLowerCase() : null;

  // Pull a page; the backend supports limit/offset.
  const page = await api('GET', `/api/v1/research?limit=${limit}&offset=${offset}`);
  const items = page.items || page.results || page.jobs || [];
  const matched = items.filter(j => {
    if (wantStatus && String(j.status || '').toLowerCase() !== wantStatus) return false;
    if (queryNeedle) {
      const q = (j.question || j.input_payload?.question || '').toLowerCase();
      if (!q.includes(queryNeedle)) return false;
    }
    return true;
  });
  console.log(JSON.stringify({
    total_matched: matched.length,
    total_in_page: items.length,
    limit,
    offset,
    items: matched,
  }, null, 2));
}

// =============================================================================
// Per-job input files: POST/DELETE /grep/jobs/{id}/inputs
// =============================================================================

async function attachInputs(jobId, files) {
  if (!jobId) throw new Error('job_id required');
  if (!files || !files.length) throw new Error('at least one file required');
  const parts = files.map(p => {
    const f = readFile(p);
    return { name: 'files', filename: f.name, value: f.buffer, contentType: f.contentType };
  });
  const result = await apiMultipart('POST', `/grep/jobs/${encodeURIComponent(jobId)}/inputs`, parts);
  console.log(JSON.stringify(result, null, 2));
}

async function deleteInput(jobId, remotePath) {
  if (!jobId || !remotePath) throw new Error('job_id and remote_path required');
  // remotePath may contain slashes (FastAPI :path catch-all on the backend);
  // encode segments individually to preserve them.
  const encoded = remotePath.split('/').map(encodeURIComponent).join('/');
  const result = await api('DELETE', `/grep/jobs/${encodeURIComponent(jobId)}/inputs/${encoded}`);
  console.log(JSON.stringify(result, null, 2));
}

// =============================================================================
// Per-user defaults: POST/GET/DELETE /grep/user/defaults
// =============================================================================

// Each pair: "<local_path>=<remote_path>" or just "<local_path>" (uses basename remote)
async function uploadDefaults(pairs) {
  if (!pairs || !pairs.length) throw new Error('at least one file=path pair required');
  const parts = [];
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    const localPath = eq >= 0 ? pair.slice(0, eq) : pair;
    const remotePath = eq >= 0 ? pair.slice(eq + 1) : path.basename(localPath);
    const f = readFile(localPath);
    parts.push({ name: 'files', filename: f.name, value: f.buffer, contentType: f.contentType });
    parts.push({ name: 'paths', value: remotePath });
  }
  const result = await apiMultipart('POST', '/grep/user/defaults', parts);
  console.log(JSON.stringify(result, null, 2));
}

async function listDefaults() {
  const result = await api('GET', '/grep/user/defaults');
  console.log(JSON.stringify(result, null, 2));
}

async function deleteDefault(remotePath) {
  if (!remotePath) throw new Error('remote_path required');
  const encoded = remotePath.split('/').map(encodeURIComponent).join('/');
  const result = await api('DELETE', `/grep/user/defaults/${encoded}`);
  console.log(JSON.stringify(result, null, 2));
}

// =============================================================================
// Workspace browsing: /grep/code-storage/workspace[/...]
// =============================================================================

async function wsTree(subpath, opts = {}) {
  // Default to the grouped tree (sections: projects/jobs/experts/apps).
  // If the user passes a path, prefer the flat /workspace?path= variant.
  if (subpath) {
    const result = await api('GET', `/grep/code-storage/workspace?path=${encodeURIComponent(subpath)}`);
    console.log(JSON.stringify(result, null, 2));
  } else {
    const result = await api('GET', '/grep/code-storage/workspace/tree');
    console.log(JSON.stringify(result, null, 2));
  }
}

async function wsRead(p) {
  if (!p) throw new Error('path required');
  // Returns raw bytes — but for skill-friendly output, fetch + print the body.
  const token = await getValidToken();
  const res = await fetch(`${GREP_API_BASE}/grep/code-storage/workspace/file?path=${encodeURIComponent(p)}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  process.stdout.write(buf);
  if (!buf.length || buf[buf.length - 1] !== 0x0a) process.stdout.write('\n');
}

async function wsHistory(opts = {}) {
  const limit = opts.limit ? `?limit=${opts.limit}` : '';
  const result = await api('GET', `/grep/code-storage/workspace/history${limit}`);
  console.log(JSON.stringify(result, null, 2));
}

async function wsDiff(fromSha, toSha) {
  if (!toSha) throw new Error('to_sha required (from_sha is optional)');
  const params = new URLSearchParams();
  if (fromSha) params.set('from_sha', fromSha);
  params.set('to_sha', toSha);
  const result = await api('GET', `/grep/code-storage/workspace/diff?${params}`);
  console.log(JSON.stringify(result, null, 2));
}

// =============================================================================
// Workspace projects: upload/delete/mkdir
// =============================================================================

async function projectUpload(projectName, files) {
  if (!projectName) throw new Error('project_name required');
  if (!files || !files.length) throw new Error('at least one file required');
  const parts = [{ name: 'project_name', value: projectName }];
  for (const p of files) {
    const f = readFile(p);
    parts.push({ name: 'files', filename: f.name, value: f.buffer, contentType: f.contentType });
  }
  const result = await apiMultipart('POST', '/grep/code-storage/workspace/projects/upload', parts);
  console.log(JSON.stringify(result, null, 2));
}

async function projectDelete(projectName, filePath) {
  if (!projectName || !filePath) throw new Error('project_name and file_path required');
  const params = new URLSearchParams({ project_name: projectName, file_path: filePath });
  const result = await api('DELETE', `/grep/code-storage/workspace/projects/file?${params}`);
  console.log(JSON.stringify(result, null, 2));
}

async function projectMkdir(projectName, dirPath) {
  if (!projectName || !dirPath) throw new Error('project_name and dir_path required');
  const params = new URLSearchParams({ project_name: projectName, dir_path: dirPath });
  const result = await api('POST', `/grep/code-storage/workspace/projects/mkdir?${params}`);
  console.log(JSON.stringify(result, null, 2));
}

// =============================================================================
// Custom experts: init / save / train
// =============================================================================

async function expertInit(expertName) {
  if (!expertName) throw new Error('expert_name required');
  const result = await api('POST', '/grep/code-storage/workspace/experts/init', { expert_name: expertName });
  console.log(JSON.stringify(result, null, 2));
}

async function expertSave(expertName, configPath) {
  if (!expertName) throw new Error('expert_name required');
  if (!configPath) throw new Error('config file path required');
  const f = readFile(configPath);
  const text = f.buffer.toString('utf8');
  // Try JSON first; fall through to raw string (server may parse YAML).
  let config;
  try { config = JSON.parse(text); } catch { config = text; }
  const result = await api('POST', '/grep/code-storage/workspace/experts/save', {
    expert_name: expertName,
    config,
  });
  console.log(JSON.stringify(result, null, 2));
}

async function expertTrain(expertName, files) {
  if (!expertName) throw new Error('expert_name required');
  if (!files || !files.length) throw new Error('at least one document required');
  const parts = files.map(p => {
    const f = readFile(p);
    return { name: 'files', filename: f.name, value: f.buffer, contentType: f.contentType };
  });
  const result = await apiMultipart(
    'POST',
    `/grep/code-storage/workspace/experts/${encodeURIComponent(expertName)}/brain`,
    parts,
  );
  console.log(JSON.stringify(result, null, 2));
}

// =============================================================================
// Lifecycle controls: resume / stop / delete check
// =============================================================================

async function resumeJob(jobId, opts = {}) {
  if (!jobId) throw new Error('job_id required');
  const body = {};
  if (opts.message) body.steering_message = opts.message;
  const result = await api('POST', `/grep/research/${encodeURIComponent(jobId)}/resume`, body);
  console.log(JSON.stringify(result, null, 2));
}

async function stopCheck(checkResultId, opts = {}) {
  if (!checkResultId) throw new Error('check_result_id required');
  const action = opts.action === 'cancel' ? 'cancel' : 'pause';
  const result = await api('POST', '/grep/stopGrepCheck', { check_result_id: checkResultId, action });
  console.log(JSON.stringify(result, null, 2));
}

async function deleteCheck(checkResultId) {
  if (!checkResultId) throw new Error('check_result_id required');
  const result = await api('DELETE', `/grep/check-result/${encodeURIComponent(checkResultId)}`);
  console.log(JSON.stringify(result, null, 2));
}

// =============================================================================
// Apps (existing read endpoints — wrapper)
// =============================================================================

async function listApps(opts = {}) {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.offset) params.set('offset', String(opts.offset));
  const qs = params.toString() ? `?${params}` : '';
  const result = await api('GET', `/api/v1/apps${qs}`);
  console.log(JSON.stringify(result, null, 2));
}

async function getApp(appId) {
  if (!appId) throw new Error('app_id required');
  const result = await api('GET', `/api/v1/apps/${encodeURIComponent(appId)}`);
  console.log(JSON.stringify(result, null, 2));
}

// =============================================================================
// Main / arg parsing
// =============================================================================

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

// Build the options bag every research-submitting subcommand uses.
function buildResearchOpts() {
  const csv = (s) => s ? String(s).split(',').map(x => x.trim()).filter(Boolean) : undefined;
  return {
    depth: flags.depth,
    maxWaitSeconds: flags['max-wait'],
    context: loadContext(),
    project: flags.project,
    expert: flags.expert,
    language: flags.language,
    fromDate: flags['from-date'],
    toDate: flags['to-date'],
    additionalThesis: flags['additional-thesis'],
    website: flags.website,
    skipClarification: flags['skip-clarification'] === true,
    actionMode: flags['action-mode'] === true,
    outputType: flags['output-type'],
    customSkills: csv(flags['custom-skills']),
    customMcpTools: csv(flags['custom-mcp-tools']),
    approach: flags.approach,
  };
}

function fail(msg) { console.error(msg); process.exit(1); }

const handler = async () => {
  switch (command) {
    // ---- existing v0.1 ----
    case 'run':
      if (!args[0]) fail('Usage: grep-api.js run "query" [--depth=...] [--max-wait=540] [--context-file=path] [--project=...] [--expert=...] [--language=...] ...');
      await runResearch(args.join(' '), buildResearchOpts());
      break;
    case 'research':
      if (!args[0]) fail('Usage: grep-api.js research "query" [flags...]');
      await submitResearch(args.join(' '), buildResearchOpts());
      break;
    case 'status':
      if (!args[0]) fail('Usage: grep-api.js status <job_id>');
      await checkStatus(args[0]);
      break;
    case 'result':
      if (!args[0]) fail('Usage: grep-api.js result <job_id>');
      await getResult(args[0]);
      break;
    case 'jobs':
      await listJobs({ limit: flags.limit });
      break;

    // ---- new in v0.2 ----
    case 'search':
      await searchJobs({ status: flags.status, query: flags.query, limit: flags.limit, offset: flags.offset });
      break;

    case 'inputs:attach':
      if (args.length < 2) fail('Usage: grep-api.js inputs:attach <job_id> <file...>');
      await attachInputs(args[0], args.slice(1));
      break;
    case 'inputs:delete':
      if (args.length < 2) fail('Usage: grep-api.js inputs:delete <job_id> <remote_path>');
      await deleteInput(args[0], args[1]);
      break;

    case 'defaults:upload':
      if (!args.length) fail('Usage: grep-api.js defaults:upload <local=remote> [<local=remote>...]');
      await uploadDefaults(args);
      break;
    case 'defaults:list':
      await listDefaults();
      break;
    case 'defaults:delete':
      if (!args[0]) fail('Usage: grep-api.js defaults:delete <remote_path>');
      await deleteDefault(args[0]);
      break;

    case 'ws:tree':
      await wsTree(args[0]);
      break;
    case 'ws:cat':
      if (!args[0]) fail('Usage: grep-api.js ws:cat <path>');
      await wsRead(args[0]);
      break;
    case 'ws:log':
      await wsHistory({ limit: flags.limit });
      break;
    case 'ws:diff':
      if (!args[0]) fail('Usage: grep-api.js ws:diff <to_sha> [<from_sha>]   (or pass --from=SHA --to=SHA)');
      // Two ergonomic forms: positional `<to> [<from>]` OR named `--from --to`.
      if (flags.from || flags.to) {
        await wsDiff(flags.from, flags.to || args[0]);
      } else {
        await wsDiff(args[1], args[0]);
      }
      break;

    case 'project:upload':
      if (args.length < 2) fail('Usage: grep-api.js project:upload <project_name> <file...>');
      await projectUpload(args[0], args.slice(1));
      break;
    case 'project:delete':
      if (args.length < 2) fail('Usage: grep-api.js project:delete <project_name> <file_path>');
      await projectDelete(args[0], args[1]);
      break;
    case 'project:mkdir':
      if (args.length < 2) fail('Usage: grep-api.js project:mkdir <project_name> <dir_path>');
      await projectMkdir(args[0], args[1]);
      break;

    case 'expert:init':
      if (!args[0]) fail('Usage: grep-api.js expert:init <expert_name>');
      await expertInit(args[0]);
      break;
    case 'expert:save':
      if (args.length < 2) fail('Usage: grep-api.js expert:save <expert_name> <config_file.json|yaml>');
      await expertSave(args[0], args[1]);
      break;
    case 'expert:train':
      if (args.length < 2) fail('Usage: grep-api.js expert:train <expert_name> <document...>');
      await expertTrain(args[0], args.slice(1));
      break;

    case 'resume':
      if (!args[0]) fail('Usage: grep-api.js resume <job_id> [--message="continue with X"]');
      await resumeJob(args[0], { message: flags.message });
      break;
    case 'stop':
      if (!args[0]) fail('Usage: grep-api.js stop <check_result_id> [--action=pause|cancel]');
      await stopCheck(args[0], { action: flags.action });
      break;
    case 'check:delete':
      if (!args[0]) fail('Usage: grep-api.js check:delete <check_result_id>');
      await deleteCheck(args[0]);
      break;

    case 'apps':
      await listApps({ limit: flags.limit, offset: flags.offset });
      break;
    case 'app':
      if (!args[0]) fail('Usage: grep-api.js app <app_id>');
      await getApp(args[0]);
      break;

    default:
      console.error('GREP API Client');
      console.error('');
      console.error('Research:');
      console.error('  run "query" [--depth=...] [--project=...]      Submit + poll to completion');
      console.error('  research "query" [flags...]                    Submit only (non-blocking)');
      console.error('  status <job_id>                                Check job status');
      console.error('  result <job_id>                                Get job results');
      console.error('  jobs [--limit=N]                               List recent jobs');
      console.error('  search [--status=...] [--query=...] [--limit=N] [--offset=N]');
      console.error('                                                 Filter jobs (client-side)');
      console.error('');
      console.error('Per-job inputs (POST/DELETE /grep/jobs/{id}/inputs):');
      console.error('  inputs:attach <job_id> <file...>               Attach input files (multipart)');
      console.error('  inputs:delete <job_id> <remote_path>           Remove an attached input');
      console.error('');
      console.error('Per-user defaults (GET/POST/DELETE /grep/user/defaults):');
      console.error('  defaults:upload <local=remote> [<local=remote>...]   Upload defaults');
      console.error('  defaults:list                                  List your defaults');
      console.error('  defaults:delete <remote_path>                  Remove a default');
      console.error('');
      console.error('Workspace browsing (Pierre-backed):');
      console.error('  ws:tree [path]                                 List workspace tree (or sections)');
      console.error('  ws:cat <path>                                  Read a workspace file');
      console.error('  ws:log [--limit=N]                             Workspace commit history');
      console.error('  ws:diff <to_sha> [<from_sha>]                  Diff between commits');
      console.error('');
      console.error('Workspace projects:');
      console.error('  project:upload <name> <file...>                Upload files to projects/{name}/');
      console.error('  project:delete <name> <file_path>              Delete a file from a project');
      console.error('  project:mkdir <name> <dir_path>                Create a directory in a project');
      console.error('');
      console.error('Custom experts:');
      console.error('  expert:init <name>                             Initialize an expert config template');
      console.error('  expert:save <name> <config.json|yaml>          Save expert config');
      console.error('  expert:train <name> <document...>              Upload training documents');
      console.error('');
      console.error('Lifecycle controls:');
      console.error('  resume <job_id> [--message="..."]              Resume a paused job (optional steering)');
      console.error('  stop <check_result_id> [--action=pause|cancel] Pause or cancel a running check');
      console.error('  check:delete <check_result_id>                 Soft-delete a check result');
      console.error('');
      console.error('Apps (slidedecks, podcasts, narratives):');
      console.error('  apps [--limit=N] [--offset=N]                  List your apps');
      console.error('  app <app_id>                                   Get app detail');
      console.error('');
      console.error('Research submit flags (use with `run` or `research`):');
      console.error('  --depth=<ultra_fast|deep|ultra_deep>           Tier (default: deep)');
      console.error('  --max-wait=<seconds>                           Cap for `run` (default: 540)');
      console.error('  --context="<text>" | --context-file=<path>     Inline context');
      console.error('  --project=<workspace/path>                     SOP-driven project (reads SOP.md)');
      console.error('  --expert=<expert_id>                           Pick a registered expert');
      console.error('  --language=<en|es|fr|...>                      Response language ISO code');
      console.error('  --from-date=YYYY-MM-DD --to-date=YYYY-MM-DD    Date filter for content');
      console.error('  --additional-thesis="<text>"                   Extra thesis to explore');
      console.error('  --website=<url>                                Enriched context URL');
      console.error('  --custom-skills=skill1,skill2                  Custom skill names');
      console.error('  --custom-mcp-tools=tool1,tool2                 Custom MCP tool names');
      console.error('  --skip-clarification                           Bypass clarification questions');
      console.error('  --output-type=report|data_explorer             Output shape');
      process.exit(1);
  }
};

handler().catch(e => { console.error(e.message); process.exit(1); });
