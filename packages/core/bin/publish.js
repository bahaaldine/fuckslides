'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

module.exports = async function publish(config) {
  const cwd = process.cwd();

  // Require git
  try { execSync('git rev-parse --git-dir', { cwd, stdio: 'pipe' }); }
  catch (_) { console.error('\n  ❌  Not a git repository. Run git init first.\n'); process.exit(1); }

  // Require remote
  let remote;
  try { remote = execSync('git remote get-url origin', { cwd, encoding: 'utf8' }).trim(); }
  catch (_) { console.error('\n  ❌  No git remote "origin". Add one first:\n  git remote add origin <url>\n'); process.exit(1); }

  console.log('\n  Building export…');
  const exportFn = require('./export');
  const tmpHtml = path.join(cwd, '.fuckslides-export-tmp.html');
  await exportFn(config, tmpHtml);

  const html = fs.readFileSync(tmpHtml, 'utf8');
  fs.unlinkSync(tmpHtml);

  // Build a temp dir and push to gh-pages
  const tmpDir = path.join(cwd, '.fuckslides-publish-tmp');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir);
  fs.writeFileSync(path.join(tmpDir, 'index.html'), html, 'utf8');

  try {
    console.log('  Pushing to gh-pages…');
    execSync('git init -b gh-pages', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git add index.html', { cwd: tmpDir, stdio: 'pipe' });
    execSync(`git -c user.name="fuckslides" -c user.email="bot@fuckslides" commit -m "publish"`, { cwd: tmpDir, stdio: 'pipe' });
    execSync(`git push "${remote}" HEAD:gh-pages --force`, { cwd: tmpDir, stdio: 'inherit' });

    fs.rmSync(tmpDir, { recursive: true, force: true });

    const ghMatch = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    const url = ghMatch
      ? `https://${ghMatch[1]}.github.io/${ghMatch[2]}`
      : 'your GitHub Pages URL';

    console.log(`\n  ✓  Published!\n  ${url}\n`);
  } catch (e) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.error('\n  ❌  Publish failed:', e.message, '\n');
    process.exit(1);
  }
};
