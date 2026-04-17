#!/usr/bin/env node
/**
 * grep-research-skills installer
 *
 * Invoked via: npx grep-research-skills [--api | --cli]
 *
 * Two mutually-exclusive flavours:
 *
 *   --api (DEFAULT)
 *     Installs the raw-HTTP skills from `skills-api/`. No `brain` binary
 *     required. Works in sandboxed Claude Code environments (Claude.ai web,
 *     some cloud runners, locked-down laptops) where installing an
 *     arbitrary binary is not possible.
 *
 *   --cli
 *     Installs the CLI-backed skills from `skills-cli/` AND fetches the
 *     `brain` Rust binary via the official installer. Faster UX + richer
 *     ergonomics; requires the ability to drop a binary onto PATH.
 *
 * Env vars:
 *   GREP_SKILLS_FLAVOUR=api|cli     Same as --api / --cli flag.
 *   BRAIN_DESCOPE_PROJECT_ID=...    Override the Descope project ID.
 *   GREP_BASE_URL=...               Override the onboarding landing page.
 *   SKIP_BRAIN_INSTALL=1            (--cli only) Skip the curl | sh brain
 *                                   install step, assume brain is on PATH.
 *
 * Resolution order when neither flag nor env is set:
 *   1. A prior install's ~/.grep-research-skills/.flavour file (sticky).
 *   2. Default: api.
 *
 * Re-running switches flavours cleanly: the opposite flavour's symlinks
 * are removed from ~/.claude/skills/ (and ~/.openclaw/skills/) before the
 * new ones are written.
 */

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync, spawnSync } = require('child_process');

const HOME = process.env.HOME || process.env.USERPROFILE;
const INSTALL_DIR = path.join(HOME, '.grep-research-skills');
const FLAVOUR_FILE = path.join(INSTALL_DIR, '.flavour');
const GREP_DIR = path.join(HOME, '.grep');
const SESSION_FILE = path.join(GREP_DIR, 'session.json');
const BRAIN_CONFIG_DIR = path.join(HOME, '.config', 'brain');
const BRAIN_CONFIG_FILE = path.join(BRAIN_CONFIG_DIR, 'config.toml');
const BRAIN_BIN_DIR = path.join(HOME, '.local', 'bin');

const GREP_BASE_URL = process.env.GREP_BASE_URL || 'https://preview.grep.ai';
const DESCOPE_PROJECT_ID =
  process.env.BRAIN_DESCOPE_PROJECT_ID || 'P38Xct9AhA95T0MU5T8g7o9V9886';

const PKG_ROOT = path.resolve(__dirname, '..');

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const NC = '\x1b[0m';

function log(msg) { console.log(`  ${msg}`); }
function ok(msg) { log(`${GREEN}✓${NC} ${msg}`); }
function warn(msg) { log(`${YELLOW}→${NC} ${msg}`); }
function err(msg) { log(`${RED}✗${NC} ${msg}`); }
function info(msg) { log(`${CYAN}→${NC} ${msg}`); }

// =============================================================================
// Flavour resolution
// =============================================================================

function resolveFlavour(argv) {
  if (argv.includes('--api')) return 'api';
  if (argv.includes('--cli')) return 'cli';
  const env = (process.env.GREP_SKILLS_FLAVOUR || '').trim().toLowerCase();
  if (env === 'api' || env === 'cli') return env;
  // Sticky: re-use the previously installed flavour.
  if (fs.existsSync(FLAVOUR_FILE)) {
    const prior = fs.readFileSync(FLAVOUR_FILE, 'utf8').trim().toLowerCase();
    if (prior === 'api' || prior === 'cli') return prior;
  }
  return 'api'; // default — guaranteed to work everywhere
}

function flavourSourceDir(flavour) {
  return path.join(PKG_ROOT, flavour === 'cli' ? 'skills-cli' : 'skills-api');
}

// =============================================================================
// Filesystem helpers
// =============================================================================

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

/** Remove any skill symlink that points into our INSTALL_DIR. */
function unlinkOurSkills(targetDir) {
  if (!fs.existsSync(targetDir)) return 0;
  let count = 0;
  for (const name of fs.readdirSync(targetDir)) {
    const p = path.join(targetDir, name);
    let stat;
    try { stat = fs.lstatSync(p); } catch { continue; }
    if (!stat.isSymbolicLink()) continue;
    try {
      const target = fs.readlinkSync(p);
      if (target.startsWith(INSTALL_DIR)) {
        fs.unlinkSync(p);
        count++;
      }
    } catch {/* ignore */}
  }
  return count;
}

// =============================================================================
// brain binary (CLI flavour only)
// =============================================================================

function findBrain() {
  const local = path.join(BRAIN_BIN_DIR, 'brain');
  if (fs.existsSync(local)) return local;
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
    const out = execFileSync(brainPath, ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim();
  } catch {
    return null;
  }
}

function compareVersions(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const ai = pa[i] || 0;
    const bi = pb[i] || 0;
    if (ai > bi) return 1;
    if (ai < bi) return -1;
  }
  return 0;
}

function extractVersion(versionLine) {
  const m = (versionLine || '').match(/(\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}

function installBrain() {
  if (process.env.SKIP_BRAIN_INSTALL === '1') {
    warn('SKIP_BRAIN_INSTALL=1 — not installing brain; skill commands will fail until `brain` is on PATH.');
    return null;
  }
  if (process.platform === 'win32') {
    err('Automatic brain install is not supported on Windows.');
    log('Install brain manually: https://github.com/Parcha-ai/brain-cli#install');
    log('Or re-run without --cli to use the API flavour (no binary needed).');
    return null;
  }
  log('Installing brain CLI from https://github.com/Parcha-ai/brain-cli ...');
  const result = spawnSync(
    'sh',
    ['-c', 'curl -fsSL https://raw.githubusercontent.com/Parcha-ai/brain-cli/main/install.sh | sh'],
    { stdio: 'inherit' }
  );
  if (result.status !== 0) {
    err('brain installer failed. Install manually: https://github.com/Parcha-ai/brain-cli');
    return null;
  }
  return findBrain();
}

// =============================================================================
// Descope project ID (seeded in both flavours so --api → --cli transitions work)
// =============================================================================

function seedDescopeProjectId() {
  fs.mkdirSync(BRAIN_CONFIG_DIR, { recursive: true, mode: 0o700 });
  let existing = '';
  if (fs.existsSync(BRAIN_CONFIG_FILE)) {
    existing = fs.readFileSync(BRAIN_CONFIG_FILE, 'utf8');
    if (/^\s*descope_project_id\s*=/m.test(existing)) return false;
  }
  const appended = existing.endsWith('\n') || existing === '' ? existing : existing + '\n';
  const line = `descope_project_id = "${DESCOPE_PROJECT_ID}"\n`;
  fs.writeFileSync(BRAIN_CONFIG_FILE, appended + line);
  try { fs.chmodSync(BRAIN_CONFIG_FILE, 0o600); } catch {/* non-unix */}
  return true;
}

// =============================================================================
// Main
// =============================================================================

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

  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major < 18) {
    console.error(`  Error: Node.js 18+ required (found ${process.version})`);
    process.exit(1);
  }

  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('  Usage: npx grep-research-skills [--api | --cli]');
    console.log('');
    console.log('    --api   Install raw-HTTP skills (default). No binary needed.');
    console.log('    --cli   Install CLI-backed skills + fetch the `brain` binary.');
    console.log('');
    process.exit(0);
  }

  const flavour = resolveFlavour(argv);
  info(`Flavour: ${flavour === 'cli' ? 'CLI (brain binary)' : 'API (raw HTTP, no binary)'}`);

  const srcDir = flavourSourceDir(flavour);
  if (!fs.existsSync(srcDir)) {
    err(`skills source missing: ${srcDir}`);
    process.exit(1);
  }

  // 1. brain install (CLI only)
  if (flavour === 'cli') {
    let brainPath = findBrain();
    if (!brainPath) {
      warn('brain CLI not found on PATH — installing...');
      brainPath = installBrain();
      if (!brainPath) {
        err('Could not install brain. Skill commands will fail until it is on PATH.');
      }
    }
    if (brainPath) {
      const ver = brainVersion(brainPath);
      ok(`brain CLI: ${ver || '<version check failed>'} (${brainPath})`);
      const pkg = require(path.join(PKG_ROOT, 'package.json'));
      const minVer = pkg.brainCliMinVersion;
      const detected = extractVersion(ver);
      if (minVer && detected && compareVersions(detected, minVer) < 0) {
        warn(`brain ${detected} is older than the required ${minVer}. ` +
             `Upgrade: curl -fsSL https://raw.githubusercontent.com/Parcha-ai/brain-cli/main/install.sh | sh`);
      }
      const PATH_ENV = process.env.PATH || process.env.Path || '';
      const pathEntries = PATH_ENV.split(path.delimiter).filter(Boolean);
      if (!pathEntries.includes(BRAIN_BIN_DIR)) {
        warn(`${BRAIN_BIN_DIR} is not on your PATH. Add it:`);
        if (process.platform === 'win32') {
          log(`    setx PATH "%PATH%;${BRAIN_BIN_DIR}"`);
        } else {
          log(`    export PATH="${BRAIN_BIN_DIR}:$PATH"`);
        }
      }
    }
  }

  // 2. Seed Descope project ID (always — enables later --cli switch without reconfig)
  const wrote = seedDescopeProjectId();
  if (wrote) {
    ok(`Seeded Descope project ID into ${BRAIN_CONFIG_FILE}`);
  } else {
    ok(`Descope project ID already present in ${BRAIN_CONFIG_FILE}`);
  }

  // 3. Copy skills for this flavour (wipe first so removed skills don't linger)
  log(`Installing ${flavour} skills to ~/.grep-research-skills/ ...`);
  const destSkills = path.join(INSTALL_DIR, 'skills');
  if (fs.existsSync(destSkills)) {
    fs.rmSync(destSkills, { recursive: true, force: true });
  }
  copyDirSync(srcDir, destSkills);

  const pluginDir = path.join(INSTALL_DIR, '.claude-plugin');
  fs.mkdirSync(pluginDir, { recursive: true });
  const pluginSrc = path.join(PKG_ROOT, '.claude-plugin', 'plugin.json');
  if (fs.existsSync(pluginSrc)) {
    fs.copyFileSync(pluginSrc, path.join(pluginDir, 'plugin.json'));
  }

  // 4. Persist flavour choice (sticky for next npx run without a flag)
  fs.writeFileSync(FLAVOUR_FILE, flavour + '\n');
  ok(`Flavour persisted to ${FLAVOUR_FILE}`);

  // 5. Clean up legacy scripts directory from 0.1.x installs
  const legacyScripts = path.join(INSTALL_DIR, 'scripts');
  if (fs.existsSync(legacyScripts)) {
    try {
      fs.rmSync(legacyScripts, { recursive: true, force: true });
      warn(`Removed legacy ${legacyScripts}/ (no longer used)`);
    } catch {/* ignore */}
  }

  if (!fs.existsSync(GREP_DIR)) {
    fs.mkdirSync(GREP_DIR, { recursive: true, mode: 0o700 });
  }

  // 6. Symlink skills into Claude Code + OpenClaw dirs.
  //    First, remove any symlinks that point into INSTALL_DIR from a previous
  //    flavour install. This is what makes --api → --cli switches clean.
  const skillsRoot = destSkills;
  const skillNames = fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const installedTo = [];
  const claudeSkills = path.join(HOME, '.claude', 'skills');
  {
    fs.mkdirSync(claudeSkills, { recursive: true });
    const legacyGrep = path.join(claudeSkills, 'grep');
    if (fs.existsSync(legacyGrep) && fs.lstatSync(legacyGrep).isSymbolicLink()) {
      fs.unlinkSync(legacyGrep);
      warn('Removed legacy symlink at ~/.claude/skills/grep');
    }
    const removed = unlinkOurSkills(claudeSkills);
    if (removed) info(`Unlinked ${removed} prior skill(s) from ${claudeSkills} before re-link`);
    let count = 0;
    for (const name of skillNames) {
      if (symlinkSkill(path.join(skillsRoot, name), claudeSkills, name)) count++;
    }
    ok(`Linked ${count} skill(s) for Claude Code & Cowork (~/.claude/skills/)`);
    installedTo.push('Claude Code', 'Cowork');
  }

  const openclawSkills = path.join(HOME, '.openclaw', 'skills');
  if (fs.existsSync(path.join(HOME, '.openclaw'))) {
    fs.mkdirSync(openclawSkills, { recursive: true });
    const removed = unlinkOurSkills(openclawSkills);
    if (removed) info(`Unlinked ${removed} prior skill(s) from ${openclawSkills} before re-link`);
    let count = 0;
    for (const name of skillNames) {
      if (symlinkSkill(path.join(skillsRoot, name), openclawSkills, name)) count++;
    }
    ok(`Linked ${count} skill(s) for OpenClaw (~/.openclaw/skills/)`);
    installedTo.push('OpenClaw');
  }

  // 7. Summary
  console.log('');
  if (installedTo.length > 0) {
    ok(`Installed for: ${installedTo.join(', ')}`);
  }

  if (!fs.existsSync(SESSION_FILE)) {
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
  log(`Skills installed (${flavour} flavour):`);
  for (const name of skillNames) {
    log(`  /${name}`);
  }
  console.log('');
  ok('Setup complete.');
  if (flavour === 'api') {
    info('To switch to the CLI flavour later: npx grep-research-skills --cli');
  } else {
    info('To switch to the API flavour later: npx grep-research-skills --api');
  }
  console.log('');
}

main();
