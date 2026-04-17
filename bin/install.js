#!/usr/bin/env node
/**
 * grep-research-skills installer
 *
 * Invoked via: npx grep-research-skills
 *
 * Drops 11 raw-HTTP skills into ~/.claude/skills/ (and ~/.openclaw/skills/
 * if OpenClaw is installed). Skills speak the GREP REST API directly via
 * curl + a small node-based get_token helper — no external binary needed.
 * Works in sandboxed Claude Code envs (Claude.ai web, some cloud runners,
 * locked-down laptops).
 *
 * Power users who want the speed-optimized variant can install
 * `grep-research-skills-cli` (separate npm package + repo) which routes
 * through the brain Rust CLI instead.
 *
 * Env overrides:
 *   BRAIN_DESCOPE_PROJECT_ID=...    Override the Descope project ID
 *                                   (seeded into ~/.config/brain/config.toml).
 *   GREP_BASE_URL=...               Override the onboarding landing page.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HOME = process.env.HOME || process.env.USERPROFILE;
const INSTALL_DIR = path.join(HOME, '.grep-research-skills');
const GREP_DIR = path.join(HOME, '.grep');
const SESSION_FILE = path.join(GREP_DIR, 'session.json');
const BRAIN_CONFIG_DIR = path.join(HOME, '.config', 'brain');
const BRAIN_CONFIG_FILE = path.join(BRAIN_CONFIG_DIR, 'config.toml');

const GREP_BASE_URL = process.env.GREP_BASE_URL || 'https://preview.grep.ai';
const DESCOPE_PROJECT_ID =
  process.env.BRAIN_DESCOPE_PROJECT_ID || 'P38Xct9AhA95T0MU5T8g7o9V9886';

const PKG_ROOT = path.resolve(__dirname, '..');

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const NC = '\x1b[0m';

function log(msg) { console.log(`  ${msg}`); }
function ok(msg) { log(`${GREEN}✓${NC} ${msg}`); }
function warn(msg) { log(`${YELLOW}→${NC} ${msg}`); }
function info(msg) { log(`${CYAN}→${NC} ${msg}`); }

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

/**
 * Write `descope_project_id = "..."` to ~/.config/brain/config.toml.
 * Done even though this flavour doesn't need brain — preserves config
 * for users who later install `grep-research-skills-cli`.
 */
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

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('  Usage: npx grep-research-skills');
    console.log('');
    console.log('  Installs 11 raw-HTTP research skills. No binary required.');
    console.log('  For the speed-optimized variant, see:');
    console.log('    npx grep-research-skills-cli');
    console.log('');
    process.exit(0);
  }

  // 1. Seed Descope project ID (so a later install of the CLI variant
  //    inherits the same config without a separate setup step).
  const wrote = seedDescopeProjectId();
  if (wrote) {
    ok(`Seeded Descope project ID into ${BRAIN_CONFIG_FILE}`);
  } else {
    ok(`Descope project ID already present in ${BRAIN_CONFIG_FILE}`);
  }

  // 2. Copy skills (wipe first so removed-in-new-version skills don't linger)
  log('Installing skills to ~/.grep-research-skills/ ...');
  const destSkills = path.join(INSTALL_DIR, 'skills');
  if (fs.existsSync(destSkills)) {
    fs.rmSync(destSkills, { recursive: true, force: true });
  }
  copyDirSync(path.join(PKG_ROOT, 'skills'), destSkills);

  const pluginDir = path.join(INSTALL_DIR, '.claude-plugin');
  fs.mkdirSync(pluginDir, { recursive: true });
  const pluginSrc = path.join(PKG_ROOT, '.claude-plugin', 'plugin.json');
  if (fs.existsSync(pluginSrc)) {
    fs.copyFileSync(pluginSrc, path.join(pluginDir, 'plugin.json'));
  }
  ok('Copied skills to ~/.grep-research-skills/');

  // 3. Clean up legacy artifacts from earlier installer versions.
  for (const legacy of ['scripts', '.flavour']) {
    const legacyPath = path.join(INSTALL_DIR, legacy);
    if (fs.existsSync(legacyPath)) {
      try {
        fs.rmSync(legacyPath, { recursive: true, force: true });
        warn(`Removed legacy ${legacyPath} (no longer used)`);
      } catch {/* ignore */}
    }
  }

  if (!fs.existsSync(GREP_DIR)) {
    fs.mkdirSync(GREP_DIR, { recursive: true, mode: 0o700 });
  }

  // 4. Symlink skills into Claude Code + OpenClaw dirs.
  //    Wipe any symlinks pointing into INSTALL_DIR first so a re-install
  //    after we've added/removed skills doesn't leave dead links.
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
    if (removed) info(`Unlinked ${removed} prior skill(s) from ${claudeSkills}`);
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
    if (removed) info(`Unlinked ${removed} prior skill(s) from ${openclawSkills}`);
    let count = 0;
    for (const name of skillNames) {
      if (symlinkSkill(path.join(skillsRoot, name), openclawSkills, name)) count++;
    }
    ok(`Linked ${count} skill(s) for OpenClaw (~/.openclaw/skills/)`);
    installedTo.push('OpenClaw');
  }

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
  log('Skills installed:');
  for (const name of skillNames) {
    log(`  /${name}`);
  }
  console.log('');
  ok('Setup complete.');
  console.log('');
}

main();
