#!/usr/bin/env node
/**
 * GREP Skills - Headless Descope OTP Authentication
 *
 * Two-step flow (non-interactive, AI-agent friendly):
 *   node auth.js send-code <email>              # Send OTP code, exit
 *   node auth.js verify <email> <code>          # Submit code, save session
 *
 * One-step flow (interactive, terminal-friendly):
 *   node auth.js login [email]                  # Send + prompt stdin + verify
 *
 * Session management:
 *   node auth.js status                         # Check current session
 *   node auth.js logout                         # Clear session
 *   node auth.js token                          # Print current access token
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DESCOPE_PROJECT_ID = 'P38Xct9AhA95T0MU5T8g7o9V9886';
const DESCOPE_BASE_URL = 'https://api.descope.com';
const GREP_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.grep');
const SESSION_FILE = path.join(GREP_DIR, 'session.json');

// Ensure ~/.grep directory exists
function ensureDir() {
  if (!fs.existsSync(GREP_DIR)) {
    fs.mkdirSync(GREP_DIR, { recursive: true, mode: 0o700 });
  }
}

// Load saved session
function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return null;
}

// Save session
function saveSession(session) {
  ensureDir();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), { mode: 0o600 });
}

// Clear session
function clearSession() {
  if (fs.existsSync(SESSION_FILE)) {
    fs.unlinkSync(SESSION_FILE);
  }
}

// Check if JWT is expired
function isExpired(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
    return payload.exp * 1000 < Date.now();
  } catch (e) {
    return true;
  }
}

// Descope API call
async function descopeApi(endpoint, body) {
  const res = await fetch(`${DESCOPE_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DESCOPE_PROJECT_ID}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.errorDescription || data.error || `HTTP ${res.status}`);
  }
  return data;
}

// Refresh session using refresh token.
// Descope's /v1/auth/refresh expects `Authorization: Bearer <projectId>:<refreshJwt>`
// (colon-separated), NOT the refreshJwt in the body.
async function refreshSession(session) {
  try {
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
      console.error(`[auth] refresh failed: ${res.status} ${errText}`);
      return null;
    }
    const data = await res.json();
    const updated = {
      ...session,
      sessionJwt: data.sessionJwt || session.sessionJwt,
      refreshJwt: data.refreshJwt || session.refreshJwt,
    };
    saveSession(updated);
    return updated;
  } catch (e) {
    console.error(`[auth] refresh error: ${e.message}`);
    return null;
  }
}

// Get valid token (refresh if needed)
async function getValidToken() {
  let session = loadSession();
  if (!session) return null;
  
  if (isExpired(session.sessionJwt)) {
    if (session.refreshJwt && !isExpired(session.refreshJwt)) {
      session = await refreshSession(session);
      if (!session) return null;
    } else {
      return null;
    }
  }
  return session.sessionJwt;
}

// Prompt user for input (works in terminal)
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// === Commands ===

// Non-interactive: just send the OTP code and exit.
async function sendCode(email) {
  if (!email) {
    console.error('Error: email is required. Usage: auth.js send-code <email>');
    process.exit(1);
  }
  try {
    await descopeApi('/v1/auth/otp/signup-in/email', { loginId: email });
    console.error(`Verification code sent to ${email}.`);
    console.log(JSON.stringify({ ok: true, email, message: 'Code sent' }));
  } catch (err) {
    console.error(`Failed to send code: ${err.message}`);
    console.log(JSON.stringify({ ok: false, error: err.message }));
    process.exit(1);
  }
}

// Non-interactive: submit a previously-sent OTP code.
async function verify(email, code) {
  if (!email || !code) {
    console.error('Error: email and code are required. Usage: auth.js verify <email> <code>');
    process.exit(1);
  }
  try {
    const result = await descopeApi('/v1/auth/otp/verify/email', {
      loginId: email,
      code: code,
    });

    const session = {
      email: email,
      sessionJwt: result.sessionJwt,
      refreshJwt: result.refreshJwt,
      user: result.user || {},
      authenticatedAt: new Date().toISOString(),
    };
    saveSession(session);

    console.error(`Authenticated as ${email}`);
    console.log(JSON.stringify({ ok: true, email }));
  } catch (err) {
    console.error(`Verification failed: ${err.message}`);
    console.log(JSON.stringify({ ok: false, error: err.message }));
    process.exit(1);
  }
}

async function login(email) {
  if (!email) {
    email = await prompt('Enter your email: ');
  }
  if (!email) {
    console.error('Error: Email is required');
    process.exit(1);
  }

  console.error(`Sending verification code to ${email}...`);
  
  try {
    // Step 1: Send OTP
    await descopeApi('/v1/auth/otp/signup-in/email', {
      loginId: email,
    });
    
    console.error('Code sent! Check your email.');
    
    // Step 2: Get code from user
    const code = await prompt('Enter the verification code: ');
    if (!code) {
      console.error('Error: Code is required');
      process.exit(1);
    }
    
    // Step 3: Verify OTP
    const result = await descopeApi('/v1/auth/otp/verify/email', {
      loginId: email,
      code: code,
    });
    
    // Save session
    const session = {
      email: email,
      sessionJwt: result.sessionJwt,
      refreshJwt: result.refreshJwt,
      user: result.user || {},
      authenticatedAt: new Date().toISOString(),
    };
    saveSession(session);
    
    console.error(`\nAuthenticated as ${email}`);
    console.log(JSON.stringify({ ok: true, email }));
    
  } catch (err) {
    console.error(`Authentication failed: ${err.message}`);
    console.log(JSON.stringify({ ok: false, error: err.message }));
    process.exit(1);
  }
}

async function status() {
  const session = loadSession();
  if (!session) {
    console.log(JSON.stringify({ authenticated: false }));
    return;
  }
  
  const token = await getValidToken();
  console.log(JSON.stringify({
    authenticated: !!token,
    email: session.email,
    authenticatedAt: session.authenticatedAt,
    sessionExpired: isExpired(session.sessionJwt),
    refreshExpired: session.refreshJwt ? isExpired(session.refreshJwt) : true,
  }));
}

async function token() {
  const t = await getValidToken();
  if (t) {
    // Output ONLY the token to stdout (for piping)
    process.stdout.write(t);
  } else {
    console.error('Not authenticated. Run: node auth.js login <email>');
    process.exit(1);
  }
}

async function logout() {
  clearSession();
  console.log(JSON.stringify({ ok: true, message: 'Logged out' }));
}

// === Main ===

const [,, command, ...args] = process.argv;

switch (command) {
  case 'send-code':
    sendCode(args[0]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'verify':
    verify(args[0], args[1]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'login':
    login(args[0]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'status':
    status().catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'token':
    token().catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'logout':
    logout().catch(e => { console.error(e.message); process.exit(1); });
    break;
  default:
    console.error('GREP Skills Authentication');
    console.error('');
    console.error('Two-step flow (AI-agent friendly):');
    console.error('  node auth.js send-code <email>        Send OTP, exit');
    console.error('  node auth.js verify <email> <code>    Submit OTP, save session');
    console.error('');
    console.error('One-step flow (terminal, interactive):');
    console.error('  node auth.js login [email]            Prompt for email + code via stdin');
    console.error('');
    console.error('Session management:');
    console.error('  node auth.js status                   Check session status');
    console.error('  node auth.js token                    Print access token');
    console.error('  node auth.js logout                   Clear session');
    process.exit(1);
}
