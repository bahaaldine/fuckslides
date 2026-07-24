'use strict';

// fslides scaffold <name> — one command from nothing to a contributable,
// published deck:
//   1. creates a GitHub repo (via the gh CLI)
//   2. populates it: template slides, config (with repo wired for comments),
//      package.json, README, and a Pages workflow that runs `fslides build`
//   3. enables GitHub Pages (workflow build) and pushes
// The result: teammates clone and edit slides like code, viewers watch the
// deck on Pages, and slide comments land in the repo's issues.

const fs   = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
}

function die(msg) {
  console.error('\n  ❌  ' + msg + '\n');
  process.exit(1);
}

module.exports = function scaffold(name, opts = {}) {
  if (!name) die('Usage: fslides scaffold <name> [--private] [--org <org>]');
  if (!/^[a-z0-9._-]+$/i.test(name)) die('Repo name must be a valid GitHub repo name (letters, digits, . _ -).');

  const dir = path.resolve(process.cwd(), name);
  if (fs.existsSync(dir)) die(`Directory ${name}/ already exists.`);

  // gh CLI is the auth layer — require it up front
  let ghUser;
  try { ghUser = sh('gh api user --jq .login'); }
  catch (_) { die('GitHub CLI not authenticated. Install gh and run: gh auth login'); }

  const owner = opts.org || ghUser;
  const repo  = `${owner}/${name}`;
  const pkgDir = path.join(__dirname, '..');
  const version = require(path.join(pkgDir, 'package.json')).version;

  console.log(`\n  Scaffolding ${repo}…\n`);

  // ── 1. local files ──
  fs.mkdirSync(path.join(dir, 'slides'), { recursive: true });

  // template slides — the cover must NOT be named index.html, so the built
  // player can own the root URL on Pages
  const tplSlides = path.join(pkgDir, 'template', 'slides');
  for (const f of fs.readdirSync(tplSlides)) {
    const dest = f === 'index.html' ? 'cover.html' : f;
    fs.copyFileSync(path.join(tplSlides, f), path.join(dir, 'slides', dest));
  }

  fs.writeFileSync(path.join(dir, 'fuckslides.config.js'), `module.exports = {
  name: '${name}',
  title: '${name}',
  repo: '${repo}',            // powers slide comments (GitHub issues)
  slidesDir: 'slides',

  slides: [
    'cover.html',
  ],

  labels: [
    'Cover',
  ],
};
`, 'utf8');

  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name,
    version: '1.0.0',
    private: true,
    scripts: {
      serve:  'fslides serve',
      build:  'fslides build _site',
      pdf:    'fslides pdf',
    },
    devDependencies: { fslides: '^' + version },
  }, null, 2) + '\n', 'utf8');

  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n_site/\n.DS_Store\n', 'utf8');

  fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.github', 'workflows', 'pages.yml'), `name: Deploy deck to GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npx fslides build _site
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: './_site'
      - id: deployment
        uses: actions/deploy-pages@v5
`, 'utf8');

  fs.writeFileSync(path.join(dir, 'README.md'), `# ${name}

A [fslides](https://github.com/bahaaldine/fuckslides) presentation. Every slide is an HTML file in \`slides/\` — edit them like code.

**Watch it:** https://${owner}.github.io/${name}/ (deployed automatically on every push to \`main\`)

## Contribute

\`\`\`bash
git clone https://github.com/${repo}.git
cd ${name}
npm install
npm run serve        # opens the deck locally with the full player
\`\`\`

- **Edit a slide:** change the HTML in \`slides/\`, the browser live-reloads.
- **Add a slide:** \`npx fslides add-slide my-slide\`, then register it in \`fuckslides.config.js\`.
- **Comment on a slide:** press \`K\` in the player (or the 💬 button) — comments live in this repo's [issues](https://github.com/${repo}/issues), one per slide.
- **Speaker notes:** press \`N\` in the player; notes save to \`notes.json\`.
- **Record narration:** \`npm run serve\`, hit the mic button — audio or camera, saved under \`slides/recordings/\` and playable on the published deck.

Send a PR when you're happy.
`, 'utf8');

  // ── 2. git + GitHub repo ──
  const vis = opts.private ? '--private' : '--public';
  try {
    sh('git init -b main', { cwd: dir });
    sh('git add -A', { cwd: dir });
    sh('git commit -m "scaffold: new fslides deck"', { cwd: dir });
    console.log(`  Creating GitHub repo (${opts.private ? 'private' : 'public'})…`);
    sh(`gh repo create ${repo} ${vis} --source . --remote origin --push`, { cwd: dir });
  } catch (e) {
    die('Repo creation failed: ' + (e.stderr || e.message));
  }

  // ── 3. enable Pages (workflow build) ──
  try {
    sh(`gh api repos/${repo}/pages -X POST -f build_type=workflow`, { cwd: dir });
  } catch (e) {
    // 409 = already enabled; anything else is worth surfacing but not fatal
    const msg = String(e.stderr || e.message);
    if (!msg.includes('409')) console.log('  ⚠  Could not auto-enable Pages (' + msg.split('\n')[0] + ') — enable it in repo Settings → Pages → Source: GitHub Actions.');
  }

  console.log(`
  ✓  ${repo} is live.

     Repo:     https://github.com/${repo}
     Pages:    https://${owner}.github.io/${name}/   (first deploy running now)
     Comments: press K in the player → issues on the repo

     cd ${name} && npm install && npm run serve
`);
};
