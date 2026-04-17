#!/usr/bin/env node
/**
 * grep-research-skills installer
 *
 * Invoked via: npx grep-research-skills
 *
 * 1. Ensures the `brain` CLI is on PATH — if missing, runs the installer
 *    one-liner from github.com/Parcha-ai/brain-cli.
 * 2. Seeds the Descope project ID into ~/.config/brain/config.toml (so
 *    agents can call `brain auth send-code` / `enchanted-send` without
 *    needing BRAIN_DESCOPE_PROJECT_ID env var).
 * 3. Copies skills to ~/.grep-research-skills/ and symlinks them for
 *    Claude Code / Cowork / OpenClaw discovery.
 *
 * Re-running updates in place.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const HOME = process.env.HOME || process.env.USERPROFILE;
const INSTALL_DIR = path.join(HOME, '.grep-research-skills');
const GREP_DIR = path.join(HOME, '.grep');
const SESSION_FILE = path.join(GREP_DIR, 'session.json');
const BRAIN_CONFIG_DIR = path.join(HOME, '.config', 'brain');
const BRAIN_CONFIG_FILE = path.join(BRAIN_CONFIG_DIR, 'config.toml');
const BRAIN_BIN_DIR = path.join(HOME, '.local', 'bin');

const GREP_BASE_URL = process.env.GREP_BASE_URL || 'https://preview.grep.ai';
// The Descope project ID owned by grep.ai. Seeded into every user's
// ~/.config/brain/config.toml by this installer so the open-source
// brain-cli doesn't need to hardcode it.
const DESCOPE_PROJECT_ID =
  process.env.BRAIN_DESCOPE_PROJECT_ID || 'P38Xct9AhA95T0MU5T8g7o9V9886';

const PKG_ROOT = path.resolve(__dirname, '..');

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const NC = '\x1b[0m';

function log(msg) { console.log(`  ${msg}`); }
function ok(msg) { log(`${GREEN}✓${NC} ${msg}`); }
function warn(msg) { log(`${YELLOW}→${NC} ${msg}`); }
function err(msg) { log(`${RED}✗${NC} ${msg}`); }

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function symlinkSkill(skillDir, targetDir, skillName) {
  const target = path.join(targetDir, skillName);
  if (fs.existsSync(target)) {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(target);
    } else {
      warn(`${skillName} exists at ${target} and is not a symlink — skipping`);
      return false;
    }
  }
  fs.symlinkSync(skillDir, target);
  return true;
}

/**
 * Return the path of `brain` on PATH, or null if not found.
 * Checks $PATH plus ~/.local/bin (where install.sh drops the binary)
 * which may not be on PATH yet.
 */
function findBrain() {
  // Check the installer's canonical location first — works everywhere
  // including Windows where `command -v` is not available.
  const local = path.join(BRAIN_BIN_DIR, 'brain');
  if (fs.existsSync(local)) return local;

  // Unix: consult PATH via `command -v`.
  if (process.platform !== 'win32') {
    try {
      const out = execSync('command -v brain', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const trimmed = out.trim();
      if (trimmed) return trimmed;
    } catch {/* not on PATH */}
  }
  return null;
}

function brainVersion(brainPath) {
  try {
    const out = execSync(`${brainPath} --version`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim();
  } catch {
    return null;
  }
}

function installBrain() {
  const SKIP = process.env.SKIP_BRAIN_INSTALL === '1';
  if (SKIP) {
    warn('SKIP_BRAIN_INSTALL=1 — not installing brain; skill commands will fail until `brain` is on PATH.');
    return null;
  }

  log('Installing brain CLI from https://github.com/Parcha-ai/brain-cli ...');
  const result = spawnSync(
    'sh',
    [
      '-c',
      'curl -fsSL https://raw.githubusercontent.com/Parcha-ai/brain-cli/main/install.sh | sh',
    ],
    { stdio: 'inherit' }
  );
  if (result.status !== 0) {
    err('brain installer failed. Install manually: https://github.com/Parcha-ai/brain-cli');
    return null;
  }
  return findBrain();
}

/**
 * Write `descope_project_id = "..."` to ~/.config/brain/config.toml.
 * Preserves any existing keys by doing a line-based merge.
 */
function seedDescopeProjectId() {
  fs.mkdirSync(BRAIN_CONFIG_DIR, { recursive: true, mode: 0o700 });

  let existing = '';
  if (fs.existsSync(BRAIN_CONFIG_FILE)) {
    existing = fs.readFileSync(BRAIN_CONFIG_FILE, 'utf8');
    if (/^\s*descope_project_id\s*=/m.test(existing)) {
      // Already set — leave it alone.
      return false;
    }
  }

  const appended = existing.endsWith('\n') || existing === '' ? existing : existing + '\n';
  const line = `descope_project_id = "${DESCOPE_PROJECT_ID}"\n`;
  fs.writeFileSync(BRAIN_CONFIG_FILE, appended + line);
  try { fs.chmodSync(BRAIN_CONFIG_FILE, 0o600); } catch {/* non-unix */}
  return true;
}

function main() {
  console.log('');
  console.log('   ██████╗ ██████  ███████ ██████  ');
  console.log('  ██       ██   ██ ██      ██   ██ ');
  console.log('  ██  ████ ██████  █████   ██████  ');
  console.log('  ██    ██ ██   ██ ██      ██      ');
  console.log('   ██████  ██   ██ ███████ ██      ');
  console.log('');
  console.log('  Research Skills Installer');
  console.log('');

  // 1. Check Node version (we still need a recent Node for this installer itself)
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major < 18) {
    console.error(`  Error: Node.js 18+ required (found ${process.version})`);
    process.exit(1);
  }

  // 2. Ensure brain CLI is available
  let brainPath = findBrain();
  if (!brainPath) {
    warn('brain CLI not found on PATH — installing...');
    brainPath = installBrain();
    if (!brainPath) {
      err('Could not install brain automatically. Skill commands will fail until it is on PATH.');
    }
  }
  if (brainPath) {
    const ver = brainVersion(brainPath);
    ok(`brain CLI: ${ver || '<version check failed>'} (${brainPath})`);
    if (!process.env.PATH.split(':').includes(BRAIN_BIN_DIR)) {
      warn(`${BRAIN_BIN_DIR} is not on your PATH. Add to your shell rc:`);
      log(`    export PATH="${BRAIN_BIN_DIR}:$PATH"`);
    }
  }

  // 3. Seed Descope project ID
  const wrote = seedDescopeProjectId();
  if (wrote) {
    ok(`Seeded Descope project ID into ${BRAIN_CONFIG_FILE}`);
  } else {
    ok(`Descope project ID already present in ${BRAIN_CONFIG_FILE}`);
  }

  // 4. Copy skills to persistent location
  log('Installing skills to ~/.grep-research-skills/ ...');
  copyDirSync(path.join(PKG_ROOT, 'skills'), path.join(INSTALL_DIR, 'skills'));

  const pluginDir = path.join(INSTALL_DIR, '.claude-plugin');
  fs.mkdirSync(pluginDir, { recursive: true });
  const pluginSrc = path.join(PKG_ROOT, '.claude-plugin', 'plugin.json');
  if (fs.existsSync(pluginSrc)) {
    fs.copyFileSync(pluginSrc, path.join(pluginDir, 'plugin.json'));
  }
  ok('Copied skills to ~/.grep-research-skills/');

  // 5. Clean up legacy scripts directory from old installs
  const legacyScripts = path.join(INSTALL_DIR, 'scripts');
  if (fs.existsSync(legacyScripts)) {
    try {
      fs.rmSync(legacyScripts, { recursive: true, force: true });
      warn(`Removed legacy ${legacyScripts}/ (skills now call \`brain\` directly)`);
    } catch {/* ignore */}
  }

  // 6. Ensure ~/.grep exists for sessions
  if (!fs.existsSync(GREP_DIR)) {
    fs.mkdirSync(GREP_DIR, { recursive: true, mode: 0o700 });
  }

  // 7. Symlink skills into each environment
  const skillsRoot = path.join(INSTALL_DIR, 'skills');
  const skillNames = fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  let installedTo = [];

  const claudeSkills = path.join(HOME, '.claude', 'skills');
  {
    fs.mkdirSync(claudeSkills, { recursive: true });

    const legacyGrep = path.join(claudeSkills, 'grep');
    if (fs.existsSync(legacyGrep) && fs.lstatSync(legacyGrep).isSymbolicLink()) {
      fs.unlinkSync(legacyGrep);
      warn('Removed legacy symlink at ~/.claude/skills/grep');
    }

    let count = 0;
    for (const name of skillNames) {
      if (symlinkSkill(path.join(skillsRoot, name), claudeSkills, name)) {
        count++;
      }
    }
    ok(`Linked ${count} skill(s) for Claude Code & Cowork (~/.claude/skills/)`);
    installedTo.push('Claude Code', 'Cowork');
  }

  const openclawSkills = path.join(HOME, '.openclaw', 'skills');
  const hasOpenclaw = fs.existsSync(path.join(HOME, '.openclaw'));
  if (hasOpenclaw) {
    fs.mkdirSync(openclawSkills, { recursive: true });
    let count = 0;
    for (const name of skillNames) {
      if (symlinkSkill(path.join(skillsRoot, name), openclawSkills, name)) {
        count++;
      }
    }
    ok(`Linked ${count} skill(s) for OpenClaw (~/.openclaw/skills/)`);
    installedTo.push('OpenClaw');
  }

  // 8. Summary
  console.log('');
  if (installedTo.length > 0) {
    ok(`Installed for: ${installedTo.join(', ')}`);
  }

  const hasSession = fs.existsSync(SESSION_FILE);
  if (!hasSession) {
    console.log('');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('  Welcome to GREP! Let\'s get you set up.');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    try {
      const platform = process.platform;
      if (platform === 'darwin') {
        execSync(`open "${GREP_BASE_URL}/start"`, { stdio: 'ignore' });
      } else if (platform === 'win32') {
        execSync(`start "" "${GREP_BASE_URL}/start"`, { stdio: 'ignore', shell: true });
      } else {
        try { execSync(`xdg-open "${GREP_BASE_URL}/start"`, { stdio: 'ignore' }); }
        catch { try { execSync(`wslview "${GREP_BASE_URL}/start"`, { stdio: 'ignore' }); } catch {} }
      }
      ok(`Opened ${GREP_BASE_URL}/start in your browser`);
    } catch {
      log(`Open this URL in your browser: ${GREP_BASE_URL}/start`);
    }

    console.log('');
    log('  1. Complete signup & onboarding at grep.ai (in your browser)');
    log('  2. Come back here and run /grep-login to connect your terminal');
    log('  3. Run /research "your topic" to start researching');
    console.log('');
  }

  console.log('');
  log('Skills installed:');
  log('  /research "topic"              Deep research with citations (~5 min)');
  log('  /quick-research "topic"        Fast fact check (~25s)');
  log('  /ultra-research "topic"        Exhaustive investigation (up to 1h)');
  log('  /grep-login                    Authenticate (OTP, enchanted link, or API key)');
  log('  /grep-status                   Check auth + job status');
  log('  /grep-upgrade                  Choose your plan (Free / Pro / Ultra / PAYG)');
  log('  /grep-plan "topic"             Research best practices before you /plan');
  log('  /grep-skill-creator "desc"     Create new skills powered by research');
  log('  /brain-cli                     Reference for every `brain` command');
  console.log('');
  ok('Setup complete.');
  console.log('');
}

main();
