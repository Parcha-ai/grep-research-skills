#!/usr/bin/env node
/**
 * Build the consolidated single-skill zip for Cowork/Claude.ai distribution.
 *
 * Assembles:
 *   dist/cowork/research/SKILL.md          (router)
 *   dist/cowork/research/references/*.md   (workflow reference files)
 *   dist/cowork/research/scripts/*.js      (bundled scripts)
 *
 * Outputs:
 *   dist/grep-research-skills-v{version}.zip
 *
 * Usage:
 *   node bin/build-cowork-zip.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST_SKILL = path.join(ROOT, 'dist', 'cowork', 'research');
const SCRIPTS_SRC = path.join(ROOT, 'scripts');
const SCRIPTS_DEST = path.join(DIST_SKILL, 'scripts');
const DIST_DIR = path.join(ROOT, 'dist');

// ---------------------------------------------------------------------------
// 1. Read version from plugin manifest
// ---------------------------------------------------------------------------

const pluginJsonPath = path.join(ROOT, '.claude-plugin', 'plugin.json');
if (!fs.existsSync(pluginJsonPath)) {
  console.error('ERROR: .claude-plugin/plugin.json not found. Run from the repo root.');
  process.exit(1);
}

const { version } = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
if (!version) {
  console.error('ERROR: No "version" field in plugin.json.');
  process.exit(1);
}

console.log(`Building grep-research-skills v${version} for Cowork...`);

// ---------------------------------------------------------------------------
// 2. Verify the consolidated skill files exist
// ---------------------------------------------------------------------------

const requiredFiles = [
  path.join(DIST_SKILL, 'SKILL.md'),
  path.join(DIST_SKILL, 'references', 'deep.md'),
  path.join(DIST_SKILL, 'references', 'quick.md'),
  path.join(DIST_SKILL, 'references', 'ultra.md'),
  path.join(DIST_SKILL, 'references', 'plan.md'),
  path.join(DIST_SKILL, 'references', 'skill-creator.md'),
  path.join(DIST_SKILL, 'references', 'login.md'),
  path.join(DIST_SKILL, 'references', 'upgrade.md'),
  path.join(DIST_SKILL, 'references', 'status.md'),
];

const missing = requiredFiles.filter(f => !fs.existsSync(f));
if (missing.length > 0) {
  console.error('ERROR: Missing consolidated skill files:');
  missing.forEach(f => console.error(`  - ${path.relative(ROOT, f)}`));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. Copy scripts into the skill directory
// ---------------------------------------------------------------------------

const scriptFiles = ['auth.js', 'billing.js', 'grep-api.js', 'update-check.js'];

fs.mkdirSync(SCRIPTS_DEST, { recursive: true });

for (const file of scriptFiles) {
  const src = path.join(SCRIPTS_SRC, file);
  const dest = path.join(SCRIPTS_DEST, file);
  if (!fs.existsSync(src)) {
    console.error(`ERROR: Script not found: scripts/${file}`);
    process.exit(1);
  }
  fs.copyFileSync(src, dest);
  console.log(`  Copied scripts/${file}`);
}

// ---------------------------------------------------------------------------
// 4. Create the zip
// ---------------------------------------------------------------------------

const zipName = `grep-research-skills-v${version}.zip`;
const zipPath = path.join(DIST_DIR, zipName);

// Remove old zip if it exists
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// Zip from inside dist/cowork so the archive root is "research/"
try {
  execSync(`cd "${path.join(DIST_DIR, 'cowork')}" && zip -r "${zipPath}" research/`, {
    stdio: 'pipe',
  });
} catch (e) {
  console.error(`ERROR: zip failed: ${e.message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 5. Report
// ---------------------------------------------------------------------------

const stats = fs.statSync(zipPath);
const sizeKB = (stats.size / 1024).toFixed(1);

console.log('');
console.log(`Done! Created ${zipName}`);
console.log(`  Path: ${path.relative(ROOT, zipPath)}`);
console.log(`  Size: ${sizeKB} KB`);
console.log('');

// Count files in the zip for verification
try {
  const listing = execSync(`unzip -l "${zipPath}"`, { encoding: 'utf8' });
  const fileCount = listing.split('\n').filter(l => l.match(/^\s+\d+\s+\d{2}-\d{2}-\d{4}/)).length;
  console.log(`  Contains ${fileCount} files:`);

  // Show the tree — filter to lines with date stamps (actual file entries)
  const files = listing
    .split('\n')
    .filter(l => l.match(/^\s+\d+\s+\d{2}-\d{2}-\d{4}/))
    .map(l => l.trim().split(/\s+/).slice(3).join(' '))
    .filter(Boolean);
  files.forEach(f => console.log(`    ${f}`));
} catch {
  // zip listing is best-effort
}

console.log('');
console.log('Upload this zip to Cowork: Settings > Plugins > Add Plugin');
