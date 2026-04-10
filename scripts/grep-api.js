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

const GREP_API_BASE = process.env.GREP_API_BASE || 'https://preview-api.grep.ai';
const SESSION_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.grep', 'session.json');

// Get session token
function getToken() {
  try {
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    return session.sessionJwt;
  } catch (e) {
    console.error('Not authenticated. Run: grep-login');
    process.exit(1);
  }
}

// API call helper
async function api(method, endpoint, body) {
  const token = getToken();
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

  const result = await api('POST', '/api/v1/research', body);
  console.log(JSON.stringify(result, null, 2));
}

async function checkStatus(jobId) {
  const result = await api('GET', `/api/v1/research/${jobId}?include_status_messages=true`);
  console.log(JSON.stringify(result, null, 2));
}

async function getResult(jobId) {
  const result = await api('GET', `/api/v1/research/${jobId}?include_status_messages=true`);
  
  // Extract report from status_messages
  const messages = result.status_messages || [];
  let report = null;
  for (const m of messages) {
    const text = m?.content?.text || '';
    if (text && (text.includes('##') || text.length > 500)) {
      report = text;
      break;
    }
  }
  
  if (report) {
    console.log(`Status: ${result.status}\n\n${report}`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

async function listJobs() {
  const result = await api('GET', '/api/v1/research');
  console.log(JSON.stringify(result, null, 2));
}

// === Main ===

const [,, command, ...args] = process.argv;

switch (command) {
  case 'research':
    if (!args[0]) { console.error('Usage: grep-api.js research "query"'); process.exit(1); }
    submitResearch(args.join(' ')).catch(e => { console.error(e.message); process.exit(1); });
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
    console.error('  node grep-api.js research "query"    Submit a research job');
    console.error('  node grep-api.js status <job_id>     Check job status');
    console.error('  node grep-api.js result <job_id>     Get job results');
    console.error('  node grep-api.js jobs                List recent jobs');
    process.exit(1);
}
