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
 *   npm run build:cowork
 *   # or
 *   node bin/build-cowork-zip.js
 *
 * Requires: `npm install` first (pulls archiver from devDependencies).
 * Pure-JS — no system `zip`/`unzip` binaries needed. Works on macOS, Linux, Windows.
 */

const fs = require('fs');
const path = require('path');

// archiver is a devDependency — install with `npm install` first.
let archiver;
try {
  archiver = require('archiver');
} catch (e) {
  console.error('ERROR: `archiver` not found. Run `npm install` first to pull devDependencies.');
  process.exit(1);
}

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
  // Routes 1-8 — research tiers + planning + skill-creator + account ops
  path.join(DIST_SKILL, 'references', 'deep.md'),
  path.join(DIST_SKILL, 'references', 'quick.md'),
  path.join(DIST_SKILL, 'references', 'ultra.md'),
  path.join(DIST_SKILL, 'references', 'plan.md'),
  path.join(DIST_SKILL, 'references', 'skill-creator.md'),
  path.join(DIST_SKILL, 'references', 'login.md'),
  path.join(DIST_SKILL, 'references', 'upgrade.md'),
  path.join(DIST_SKILL, 'references', 'status.md'),
  // Routes 9-16 — v2 expansion: domain experts, deliverables, workflows, MCP
  path.join(DIST_SKILL, 'references', 'domain-expert.md'),
  path.join(DIST_SKILL, 'references', 'build-app.md'),
  path.join(DIST_SKILL, 'references', 'build-slidedeck.md'),
  path.join(DIST_SKILL, 'references', 'build-spreadsheet.md'),
  path.join(DIST_SKILL, 'references', 'research-workflow.md'),
  path.join(DIST_SKILL, 'references', 'with-context.md'),
  path.join(DIST_SKILL, 'references', 'continue.md'),
  path.join(DIST_SKILL, 'references', 'mcp.md'),
];

const missing = requiredFiles.filter(f => !fs.existsSync(f));
if (missing.length > 0) {
  console.error('ERROR: Missing consolidated skill files:');
  missing.forEach(f => console.error(`  - ${path.relative(ROOT, f)}`));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. Copy scripts into the skill directory (so they're zipped under research/scripts/)
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
// 4. Create the zip — pure JS, no shell. Walk the tree ourselves so we have
//    an authoritative file list for the post-build report (no `unzip -l`
//    parsing, which produces different output on Linux vs macOS).
// ---------------------------------------------------------------------------

const zipName = `grep-research-skills-v${version}.zip`;
const zipPath = path.join(DIST_DIR, zipName);

fs.mkdirSync(DIST_DIR, { recursive: true });

// Remove old zip if it exists
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// Walk DIST_SKILL recursively and collect (absolute path, archive path) pairs.
// Archive path is rooted at `research/` so the unzipped tree looks like:
//   research/SKILL.md, research/references/*.md, research/scripts/*.js
function collectFiles(dir, archivePrefix) {
  const entries = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, name.name);
    const archivePath = path.posix.join(archivePrefix, name.name);
    if (name.isDirectory()) {
      entries.push(...collectFiles(fullPath, archivePath));
    } else if (name.isFile()) {
      entries.push({ fullPath, archivePath });
    }
  }
  return entries;
}

const fileList = collectFiles(DIST_SKILL, 'research').sort((a, b) =>
  a.archivePath.localeCompare(b.archivePath)
);

// Build the zip with archiver
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

const zipPromise = new Promise((resolve, reject) => {
  output.on('close', resolve);
  output.on('error', reject);
  archive.on('error', reject);
  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      console.warn(`warning: ${err.message}`);
    } else {
      reject(err);
    }
  });
});

archive.pipe(output);
for (const { fullPath, archivePath } of fileList) {
  archive.file(fullPath, { name: archivePath });
}
archive.finalize();

zipPromise
  .then(() => {
    // -----------------------------------------------------------------------
    // 5. Report — listing is derived from our own file list, not `unzip -l`,
    //    so it's consistent across platforms.
    // -----------------------------------------------------------------------
    const stats = fs.statSync(zipPath);
    const sizeKB = (stats.size / 1024).toFixed(1);

    console.log('');
    console.log(`Done! Created ${zipName}`);
    console.log(`  Path: ${path.relative(ROOT, zipPath)}`);
    console.log(`  Size: ${sizeKB} KB`);
    console.log(`  Contains ${fileList.length} files:`);
    for (const { archivePath } of fileList) {
      console.log(`    ${archivePath}`);
    }
    console.log('');
    console.log('Upload this zip to Cowork: Settings > Plugins > Add Plugin');
  })
  .catch((err) => {
    console.error(`ERROR: zip failed: ${err.message}`);
    process.exit(1);
  });
