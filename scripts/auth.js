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

const { execSync } = require('child_process');

const DESCOPE_PROJECT_ID = 'P35S8vZ7BYoDSOJVaYbIDRZObJq6';
const DESCOPE_BASE_URL = 'https://api.descope.com';
const GREP_API_BASE = process.env.GREP_API_BASE || 'https://api.grep.ai';
const GREP_BASE_URL = process.env.GREP_BASE_URL || 'https://grep.ai';
// Enchanted link verify page — requires /auth/verify route on the frontend.
// Currently experimental; OTP flow is the default.
const ENCHANTED_LINK_VERIFY_URL = process.env.ENCHANTED_LINK_VERIFY_URL || `${GREP_BASE_URL}/auth/verify`;
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

// Get valid token (refresh if needed). Returns API key for api_key sessions.
async function getValidToken() {
  let session = loadSession();
  if (!session) return null;

  // API key sessions don't need refresh — keys are long-lived.
  if (session.apiKey) return session.apiKey;

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

// Save an API key as the session (for headless/CI environments).
// API keys are long-lived tokens minted from the GREP dashboard; no refresh needed.
async function setApiKey(apiKey) {
  if (!apiKey) {
    console.error('Error: API key required. Usage: auth.js set-api-key <key>');
    process.exit(1);
  }
  // Validate the key by calling /billing/status with it
  try {
    const res = await fetch(`${GREP_API_BASE}/billing/status`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Invalid API key: ${res.status} ${text}`);
    }
    const data = await res.json();
    const session = {
      apiKey,
      email: data.email || null,
      authenticatedAt: new Date().toISOString(),
      authMethod: 'api_key',
    };
    saveSession(session);
    console.log(JSON.stringify({ ok: true, authMethod: 'api_key', tier: data.tier }));
  } catch (err) {
    console.error(`Failed to validate API key: ${err.message}`);
    console.log(JSON.stringify({ ok: false, error: err.message }));
    process.exit(1);
  }
}

// === Enchanted Link Flow (click-to-auth, no code typing) ===

// Open a URL in the user's default browser
function openBrowser(url) {
  try {
    const platform = process.platform;
    if (platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' });
    } else if (platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore', shell: true });
    } else {
      try {
        execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
      } catch {
        try {
          execSync(`wslview "${url}"`, { stdio: 'ignore' });
        } catch {
          return false;
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

// Send an enchanted link email. Returns { pendingRef, linkId, maskedEmail }.
async function enchantedSend(email) {
  if (!email) {
    console.error('Error: email required. Usage: auth.js enchanted-send <email>');
    process.exit(1);
  }
  try {
    const data = await descopeApi('/v1/auth/enchantedlink/signup-in/email', {
      loginId: email,
      redirectUrl: ENCHANTED_LINK_VERIFY_URL,
    });
    console.log(JSON.stringify({
      ok: true,
      pendingRef: data.pendingRef,
      linkId: data.linkId,
      maskedEmail: data.maskedEmail,
    }));
  } catch (err) {
    console.error(`Failed to send enchanted link: ${err.message}`);
    console.log(JSON.stringify({ ok: false, error: err.message }));
    process.exit(1);
  }
}

// Poll for enchanted link session completion.
// Polls /v1/auth/enchantedlink/pending-session until the user clicks the link.
async function enchantedPoll(pendingRef, options = {}) {
  if (!pendingRef) {
    console.error('Error: pendingRef required. Usage: auth.js enchanted-poll <pendingRef>');
    process.exit(1);
  }
  const maxWait = options.maxWait || 600; // 10 minutes
  const interval = options.interval || 2000; // 2 seconds (Descope recommends 1-2s)
  const startedAt = Date.now();

  while ((Date.now() - startedAt) / 1000 < maxWait) {
    try {
      const res = await fetch(`${DESCOPE_BASE_URL}/v1/auth/enchantedlink/pending-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DESCOPE_PROJECT_ID}`,
        },
        body: JSON.stringify({ pendingRef }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.sessionJwt) {
          const session = {
            email: data.user?.email || data.user?.loginIds?.[0] || '',
            sessionJwt: data.sessionJwt,
            refreshJwt: data.refreshJwt,
            user: data.user || {},
            authenticatedAt: new Date().toISOString(),
            authMethod: 'enchanted_link',
          };
          saveSession(session);

          console.log(JSON.stringify({
            ok: true,
            email: session.email,
            firstSeen: data.firstSeen || false,
          }));
          return;
        }
      }

      // Not ready yet — keep polling
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      if (elapsed % 10 === 0) { // Log every 10s to avoid noise
        process.stderr.write(`[auth] Waiting for link click... (${elapsed}s)\n`);
      }
    } catch (e) {
      process.stderr.write(`[auth] Poll error: ${e.message}\n`);
    }

    await new Promise(r => setTimeout(r, interval));
  }

  console.log(JSON.stringify({
    ok: false,
    status: 'timeout',
    message: `Timed out after ${maxWait}s waiting for enchanted link click.`,
  }));
  process.exit(2);
}

// Combined enchanted link flow: ask for email, send link, display linkId, poll.
// This is the primary auth command for install + login.
async function enchantedLogin(email) {
  if (!email) {
    email = await prompt('Enter your email: ');
  }
  if (!email) {
    console.error('Error: Email is required');
    process.exit(1);
  }

  process.stderr.write(`[auth] Sending enchanted link to ${email}...\n`);

  try {
    const data = await descopeApi('/v1/auth/enchantedlink/signup-in/email', {
      loginId: email,
      redirectUrl: ENCHANTED_LINK_VERIFY_URL,
    });

    process.stderr.write(`\n`);
    process.stderr.write(`  Check your email and click link #${data.linkId}\n`);
    process.stderr.write(`  Waiting for you to click...\n\n`);

    // Poll until the user clicks
    await enchantedPoll(data.pendingRef, { maxWait: 600, interval: 2000 });
  } catch (err) {
    console.error(`Enchanted link failed: ${err.message}`);
    console.log(JSON.stringify({ ok: false, error: err.message }));
    process.exit(1);
  }
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
  case 'set-api-key':
    setApiKey(args[0]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'enchanted-login':
    enchantedLogin(args[0]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'enchanted-send':
    enchantedSend(args[0]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'enchanted-poll':
    if (!args[0]) { console.error('Usage: auth.js enchanted-poll <pendingRef>'); process.exit(1); }
    enchantedPoll(args[0]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  default:
    console.error('GREP Skills Authentication');
    console.error('');
    console.error('Enchanted Link (click-to-auth, recommended):');
    console.error('  node auth.js enchanted-login [email]    Send link, wait for click (combined)');
    console.error('  node auth.js enchanted-send <email>     Send enchanted link, exit');
    console.error('  node auth.js enchanted-poll <ref>       Poll for link click completion');
    console.error('');
    console.error('OTP flow (AI-agent two-step):');
    console.error('  node auth.js send-code <email>          Send OTP code, exit');
    console.error('  node auth.js verify <email> <code>      Submit OTP, save session');
    console.error('');
    console.error('OTP flow (terminal, interactive):');
    console.error('  node auth.js login [email]              Prompt for email + code via stdin');
    console.error('');
    console.error('API key (headless/CI):');
    console.error('  node auth.js set-api-key <key>          Save a GREP API key as the session');
    console.error('');
    console.error('Session management:');
    console.error('  node auth.js status                     Check session status');
    console.error('  node auth.js token                      Print access token');
    console.error('  node auth.js logout                     Clear session');
    process.exit(1);
}
