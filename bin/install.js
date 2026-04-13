#!/usr/bin/env node
/**
 * grep-research-skills installer
 *
 * Invoked via: npx grep-research-skills
 *
 * Copies skills + scripts to a persistent location (~/.grep-research-skills/),
 * then creates symlinks so Claude Code, Cowork, and OpenClaw can discover them.
 *
 * Re-running updates in place.
 */

const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || process.env.USERPROFILE;
const INSTALL_DIR = path.join(HOME, '.grep-research-skills');
const GREP_DIR = path.join(HOME, '.grep');

// Where we're copying FROM (the npm package or local repo)
const PKG_ROOT = path.resolve(__dirname, '..');

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

function log(msg) { console.log(`  ${msg}`); }
function ok(msg) { log(`${GREEN}✓${NC} ${msg}`); }
function warn(msg) { log(`${YELLOW}→${NC} ${msg}`); }

// Recursively copy a directory, preserving structure
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

// Create a symlink, replacing an existing symlink but not a real dir/file
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

function main() {
  console.log('');
  console.log('  ╔════════════════════════════════════════════╗');
  console.log('  ║  GREP Research Skills Installer            ║');
  console.log('  ╚════════════════════════════════════════════╝');
  console.log('');

  // 1. Check Node version
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major < 18) {
    console.error(`  Error: Node.js 18+ required (found ${process.version})`);
    process.exit(1);
  }

  // 2. Copy skills + scripts to persistent location
  log('Installing to ~/.grep-research-skills/ ...');

  // Copy scripts/
  copyDirSync(path.join(PKG_ROOT, 'scripts'), path.join(INSTALL_DIR, 'scripts'));

  // Copy skills/
  copyDirSync(path.join(PKG_ROOT, 'skills'), path.join(INSTALL_DIR, 'skills'));

  // Copy plugin manifest
  const pluginDir = path.join(INSTALL_DIR, '.claude-plugin');
  fs.mkdirSync(pluginDir, { recursive: true });
  const pluginSrc = path.join(PKG_ROOT, '.claude-plugin', 'plugin.json');
  if (fs.existsSync(pluginSrc)) {
    fs.copyFileSync(pluginSrc, path.join(pluginDir, 'plugin.json'));
  }

  ok('Copied skills and scripts to ~/.grep-research-skills/');

  // 3. Ensure ~/.grep directory for session storage
  if (!fs.existsSync(GREP_DIR)) {
    fs.mkdirSync(GREP_DIR, { recursive: true, mode: 0o700 });
  }

  // 4. Detect environments and create symlinks
  const skillsRoot = path.join(INSTALL_DIR, 'skills');
  const skillNames = fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  let installedTo = [];

  // Claude Code / Cowork: ~/.claude/skills/<skill-name> -> ~/.grep-research-skills/skills/<skill-name>
  const claudeSkills = path.join(HOME, '.claude', 'skills');
  const hasClaude = fs.existsSync(path.join(HOME, '.claude')) || process.env.CLAUDE_CODE;
  if (hasClaude || true) { // Always install for Claude Code — it's the primary target
    fs.mkdirSync(claudeSkills, { recursive: true });

    // Clean up legacy "grep" symlink from old grep-skills installs
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

  // OpenClaw: ~/.openclaw/skills/<skill-name> -> ~/.grep-research-skills/skills/<skill-name>
  const openclawSkills = path.join(HOME, '.openclaw', 'skills');
  const hasOpenclaw = fs.existsSync(path.join(HOME, '.openclaw'));
  try {
    // Check if openclaw binary exists
    require('child_process').execSync('which openclaw', { stdio: 'ignore' });
  } catch {
    // openclaw not on PATH — only install if ~/.openclaw exists
    if (!hasOpenclaw) {
      // Skip OpenClaw entirely
    }
  }

  // Always try OpenClaw if the directory exists or the binary is available
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

  // 5. Print summary
  console.log('');
  if (installedTo.length > 0) {
    ok(`Installed for: ${installedTo.join(', ')}`);
  }

  console.log('');
  log('Next steps:');
  log('  1. Run /grep-login in your AI agent to authenticate');
  log('  2. Run /research "your topic" to start researching');
  console.log('');
  ok('Setup complete!');
  console.log('');
}

main();
