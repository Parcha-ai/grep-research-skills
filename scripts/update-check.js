#!/usr/bin/env node
/**
 * GREP Research Skills — auto-update check
 *
 * Called at session start or before first skill use.
 * Checks npm for a newer version, throttled to once per hour.
 * If an update is available, runs `npx grep-research-skills` to update in place.
 *
 * Exit 0 always — errors must never block a session.
 *
 * Usage:
 *   node update-check.js          # Check and update if needed
 *   node update-check.js --check  # Check only, print status, don't update
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HOME = process.env.HOME || process.env.USERPROFILE;
const GREP_DIR = path.join(HOME, '.grep');
const VERSION_FILE = path.join(GREP_DIR, 'installed-version');
const THROTTLE_FILE = path.join(GREP_DIR, 'last-update-check');
const INSTALL_DIR = path.join(HOME, '.grep-research-skills');
const THROTTLE_SECONDS = 3600; // 1 hour
const PKG_NAME = 'grep-research-skills';

function getInstalledVersion() {
  try {
    const pkgJson = path.join(INSTALL_DIR, '.claude-plugin', 'plugin.json');
    if (fs.existsSync(pkgJson)) {
      return JSON.parse(fs.readFileSync(pkgJson, 'utf8')).version;
    }
  } catch {}
  try {
    if (fs.existsSync(VERSION_FILE)) {
      return fs.readFileSync(VERSION_FILE, 'utf8').trim();
    }
  } catch {}
  return null;
}

function isThrottled() {
  try {
    if (!fs.existsSync(THROTTLE_FILE)) return false;
    const last = parseInt(fs.readFileSync(THROTTLE_FILE, 'utf8').trim(), 10);
    return (Date.now() / 1000 - last) < THROTTLE_SECONDS;
  } catch {
    return false;
  }
}

function recordCheck() {
  try {
    fs.mkdirSync(GREP_DIR, { recursive: true });
    fs.writeFileSync(THROTTLE_FILE, String(Math.floor(Date.now() / 1000)));
  } catch {}
}

async function getLatestVersion() {
  try {
    const res = await fetch(`https://registry.npmjs.org/${PKG_NAME}/latest`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.version;
  } catch {
    return null;
  }
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

async function main() {
  const checkOnly = process.argv.includes('--check');

  if (!checkOnly && isThrottled()) {
    console.log(JSON.stringify({ status: 'throttled', message: 'Checked recently, skipping' }));
    process.exit(0);
  }

  const installed = getInstalledVersion();
  const latest = await getLatestVersion();

  recordCheck();

  if (!latest) {
    console.log(JSON.stringify({ status: 'error', message: 'Could not reach npm registry' }));
    process.exit(0);
  }

  if (!installed) {
    console.log(JSON.stringify({ status: 'unknown', installed: null, latest }));
    process.exit(0);
  }

  if (compareVersions(installed, latest) >= 0) {
    console.log(JSON.stringify({ status: 'up_to_date', installed, latest }));
    process.exit(0);
  }

  // Update available
  if (checkOnly) {
    console.log(JSON.stringify({ status: 'update_available', installed, latest }));
    process.exit(0);
  }

  // Run the update
  process.stderr.write(`[grep] Updating ${installed} → ${latest}...\n`);
  try {
    execSync(`npx --yes ${PKG_NAME}@latest`, { stdio: 'ignore', timeout: 30000 });
    fs.writeFileSync(VERSION_FILE, latest);
    process.stderr.write(`[grep] Updated to ${latest}\n`);
    console.log(JSON.stringify({ status: 'updated', from: installed, to: latest }));
  } catch (e) {
    process.stderr.write(`[grep] Update failed: ${e.message}\n`);
    console.log(JSON.stringify({ status: 'update_failed', installed, latest, error: e.message }));
  }
}

main().catch(() => process.exit(0));
