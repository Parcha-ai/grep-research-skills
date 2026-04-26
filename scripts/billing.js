#!/usr/bin/env node
/**
 * GREP Billing Client - Check plans, create checkout sessions, manage subscriptions
 *
 * Usage:
 *   node billing.js tiers                              # List available plans + pricing
 *   node billing.js status                             # Current subscription status
 *   node billing.js checkout <tier> [interval]         # Create Stripe checkout (tier: pro|ultra, interval: month|year)
 *   node billing.js payg <amount_cents>                # Activate PAYG wallet with initial deposit
 *
 * Reads auth token from ~/.grep/session.json (via auth.js)
 */

const fs = require('fs');
const path = require('path');

const GREP_API_BASE = process.env.GREP_API_BASE || 'https://api.grep.ai';
const SESSION_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.grep', 'session.json');
const DESCOPE_PROJECT_ID = 'P35S8vZ7BYoDSOJVaYbIDRZObJq6';
const DESCOPE_BASE_URL = 'https://api.descope.com';

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
    console.error('Not authenticated. Run: /grep-login');
    process.exit(1);
  }

  // API key sessions bypass JWT refresh — keys are long-lived.
  if (session.apiKey) return session.apiKey;

  if (isExpired(session.sessionJwt)) {
    if (!session.refreshJwt || isExpired(session.refreshJwt)) {
      console.error('Session expired. Run: /grep-login');
      process.exit(1);
    }
    try {
      session = await refreshSession(session);
    } catch (e) {
      console.error(`Token refresh failed: ${e.message}. Run: /grep-login`);
      process.exit(1);
    }
  }

  return session.sessionJwt;
}

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

async function tiers() {
  const result = await api('GET', '/billing/tiers');
  console.log(JSON.stringify(result, null, 2));
}

async function status() {
  const result = await api('GET', '/billing/status');
  console.log(JSON.stringify(result, null, 2));
}

async function checkout(tier, billingInterval) {
  if (!tier) {
    console.error('Usage: billing.js checkout <tier> [month|year]');
    console.error('  tier: pro, ultra');
    process.exit(1);
  }

  const validTiers = ['basic', 'pro', 'ultra'];
  if (!validTiers.includes(tier)) {
    console.error(`Invalid tier "${tier}". Must be one of: ${validTiers.join(', ')}`);
    process.exit(1);
  }

  const interval = billingInterval || 'month';
  if (!['month', 'year'].includes(interval)) {
    console.error(`Invalid interval "${interval}". Must be "month" or "year".`);
    process.exit(1);
  }

  const result = await api('POST', '/billing/checkout', {
    tier,
    billing_interval: interval,
    return_url: 'https://grep.ai/billing?checkout=complete',
  });

  console.log(JSON.stringify(result, null, 2));
}

async function waitlist() {
  const result = await api('GET', '/grep/researchWaitlistStatus');
  console.log(JSON.stringify(result, null, 2));
}

async function onboarding() {
  const result = await api('GET', '/grep/onboarding/status');
  console.log(JSON.stringify(result, null, 2));
}

async function paygActivate(amountCents) {
  if (!amountCents || isNaN(amountCents)) {
    console.error('Usage: billing.js payg <amount_cents>');
    console.error('  Minimum: 1000 (= $10.00)');
    process.exit(1);
  }

  const amount = parseInt(amountCents, 10);
  if (amount < 1000) {
    console.error('Minimum PAYG deposit is $10.00 (1000 cents).');
    process.exit(1);
  }

  const result = await api('POST', '/billing/payg/activate', {
    amount_cents: amount,
    return_url: 'https://grep.ai/billing?checkout=complete',
  });

  console.log(JSON.stringify(result, null, 2));
}

// === Main ===

const [,, command, ...args] = process.argv;

switch (command) {
  case 'tiers':
    tiers().catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'status':
    status().catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'waitlist':
    waitlist().catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'onboarding':
    onboarding().catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'checkout':
    checkout(args[0], args[1]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  case 'payg':
    paygActivate(args[0]).catch(e => { console.error(e.message); process.exit(1); });
    break;
  default:
    console.error('GREP Billing Client');
    console.error('');
    console.error('Usage:');
    console.error('  node billing.js tiers                         List available plans');
    console.error('  node billing.js status                        Current subscription');
    console.error('  node billing.js waitlist                      Check waitlist status');
    console.error('  node billing.js onboarding                   Check onboarding status');
    console.error('  node billing.js checkout <tier> [month|year]  Create Stripe checkout');
    console.error('  node billing.js payg <amount_cents>           Activate PAYG wallet');
    process.exit(1);
}
