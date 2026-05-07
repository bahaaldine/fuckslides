'use strict';

const fs   = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
      count++;
    }
  }
  return count;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function presenterHtml({ name, slides, labels }) {
  const items     = slides.map((file, i) => [file, labels && labels[i] ? labels[i] : file]);
  const itemsJson = JSON.stringify(items);
  const title     = escapeHtml(name || 'Presentation');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    :root {
      --bg: #0d0f14;
      --hud: rgba(255,255,255,0.06);
      --hud-border: rgba(255,255,255,0.10);
      --fg: #fff;
      --muted: rgba(255,255,255,0.55);
      --accent: #38BDF8;
    }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; padding: 0; background: var(--bg); color: var(--fg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; overflow: hidden; }
    .stage { position: fixed; inset: 0; display: grid; place-items: center; }
    .stage iframe {
      width: min(100vw, calc(100vh * 16 / 9));
      aspect-ratio: 16 / 9;
      border: 0;
      background: var(--bg);
      box-shadow: 0 0 60px rgba(0, 0, 0, 0.6);
    }
    .hud {
      position: fixed; bottom: 1rem; right: 1rem;
      display: flex; gap: 0.6rem; align-items: center;
      font-size: 12px; letter-spacing: 0.05em;
      background: var(--hud); border: 1px solid var(--hud-border);
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      padding: 0.5rem 0.9rem; border-radius: 999px;
      color: var(--muted); user-select: none;
      transition: opacity 0.4s ease;
    }
    .hud .num { color: var(--accent); font-weight: 600; font-variant-numeric: tabular-nums; }
    .hud .label { color: var(--fg); font-weight: 500; max-width: 24ch; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hud .keys { color: var(--muted); font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 11px; }
    .hud .keys kbd { background: rgba(255,255,255,0.08); padding: 0.1em 0.4em; border-radius: 3px; font-family: inherit; font-size: 0.95em; }
    .hud.dim { opacity: 0.25; }

    .nav-zone {
      position: fixed; top: 0; bottom: 0; width: 12vw;
      cursor: pointer; opacity: 0; transition: opacity 0.2s;
    }
    .nav-zone:hover { opacity: 0.05; background: white; }
    .nav-zone.left { left: 0; }
    .nav-zone.right { right: 0; }

    .overview {
      position: fixed; inset: 0;
      background: rgba(13, 15, 20, 0.96);
      display: none; padding: 4vh 4vw;
      overflow-y: auto; z-index: 10;
    }
    .overview.open { display: block; }
    .overview h2 {
      margin: 0 0 2vh; font-weight: 600; letter-spacing: -0.02em;
      color: var(--accent); font-size: 1.1rem;
    }
    .overview .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5vw; }
    .overview .tile {
      cursor: pointer; border-radius: 10px; overflow: hidden;
      background: var(--bg); border: 1px solid var(--hud-border);
      position: relative; aspect-ratio: 16/9;
    }
    .overview .tile:hover { border-color: var(--accent); }
    .overview .tile iframe { width: 1280px; height: 720px; transform: scale(calc(280 / 1280)); transform-origin: top left; pointer-events: none; border: 0; }
    .overview .tile .meta {
      position: absolute; left: 0; right: 0; bottom: 0;
      padding: 0.4rem 0.6rem;
      background: linear-gradient(0deg, rgba(0,0,0,0.85), rgba(0,0,0,0));
      font-size: 11px; color: var(--fg);
      display: flex; justify-content: space-between; align-items: baseline;
    }
    .overview .tile .meta .n { color: var(--accent); font-variant-numeric: tabular-nums; font-weight: 600; }
  </style>
</head>
<body>
  <div class="stage">
    <iframe id="slide" allow="fullscreen" referrerpolicy="no-referrer"></iframe>
  </div>
  <div class="nav-zone left"  id="navL"></div>
  <div class="nav-zone right" id="navR"></div>

  <div class="hud" id="hud">
    <span class="num"  id="num"></span>
    <span class="label" id="label"></span>
    <span class="keys"><kbd>←</kbd> <kbd>→</kbd> · <kbd>F</kbd> full · <kbd>O</kbd> overview</span>
  </div>

  <div class="overview" id="overview">
    <h2>All slides — click to jump</h2>
    <div class="grid" id="overviewGrid"></div>
  </div>

  <script>
    const SLIDES   = ${itemsJson};
    const slideEl  = document.getElementById('slide');
    const numEl    = document.getElementById('num');
    const labelEl  = document.getElementById('label');
    const hudEl    = document.getElementById('hud');
    const overEl   = document.getElementById('overview');
    const overGrid = document.getElementById('overviewGrid');

    let i = 0;
    let hudTimer = null;

    function bumpHud() {
      hudEl.classList.remove('dim');
      clearTimeout(hudTimer);
      hudTimer = setTimeout(() => hudEl.classList.add('dim'), 2500);
    }

    function go(n) {
      i = ((n % SLIDES.length) + SLIDES.length) % SLIDES.length;
      slideEl.src = 'slides/' + SLIDES[i][0];
      numEl.textContent  = (i + 1) + ' / ' + SLIDES.length;
      labelEl.textContent = SLIDES[i][1];
      history.replaceState(null, '', '#' + (i + 1));
      bumpHud();
    }

    document.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'Enter') { go(i + 1); e.preventDefault(); }
      else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace') { go(i - 1); e.preventDefault(); }
      else if (k === 'Home') { go(0); }
      else if (k === 'End')  { go(SLIDES.length - 1); }
      else if (k === 'f' || k === 'F') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
      }
      else if (k === 'o' || k === 'O') { toggleOverview(); }
      else if (k === 'Escape') { if (overEl.classList.contains('open')) toggleOverview(); }
      else if (/^[0-9]$/.test(k)) {
        const target = parseInt(k, 10);
        if (target >= 1 && target <= SLIDES.length) go(target - 1);
      }
    });

    document.getElementById('navL').addEventListener('click', () => go(i - 1));
    document.getElementById('navR').addEventListener('click', () => go(i + 1));
    document.addEventListener('mousemove', bumpHud);

    function buildOverview() {
      overGrid.innerHTML = '';
      SLIDES.forEach(([file, label], idx) => {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.innerHTML =
          '<iframe src="slides/' + file + '" loading="lazy"></iframe>' +
          '<div class="meta"><span class="n">' + (idx + 1) + '</span><span>' + label + '</span></div>';
        tile.addEventListener('click', () => { go(idx); toggleOverview(); });
        overGrid.appendChild(tile);
      });
    }
    function toggleOverview() {
      overEl.classList.toggle('open');
      if (overEl.classList.contains('open') && overGrid.children.length === 0) buildOverview();
    }

    const startIdx = Math.max(0, Math.min(SLIDES.length - 1, parseInt((location.hash || '#1').slice(1), 10) - 1)) || 0;
    go(startIdx);
  </script>
</body>
</html>
`;
}

module.exports = function build(config) {
  const cwd       = process.cwd();
  const distDir   = path.join(cwd, 'dist');
  const slidesSrc = path.join(cwd, config.slidesDir || 'slides');
  const runtimeSrc = path.join(__dirname, '..', 'js');  // packages/core/js

  if (!fs.existsSync(slidesSrc)) {
    console.error(`\n❌  Slides directory not found: ${slidesSrc}\n`);
    process.exit(1);
  }

  console.log('\nBuilding static presentation…\n');

  // Wipe and recreate dist/
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // 1. Copy slides verbatim.
  const slideCount = copyDir(slidesSrc, path.join(distDir, 'slides'));
  console.log(`  copied  ${slideCount} files → dist/slides/`);

  // 2. Copy framework runtime (so <script src="/js/fuckslides.js"> in slides
  //    still resolves once dist/ is served via any static HTTP server).
  if (fs.existsSync(runtimeSrc)) {
    const jsCount = copyDir(runtimeSrc, path.join(distDir, 'js'));
    console.log(`  copied  ${jsCount} runtime file(s) → dist/js/`);
  }

  // 3. Generate the presenter index.html.
  const html = presenterHtml({
    name:   config.name,
    slides: config.slides || [],
    labels: config.labels || [],
  });
  fs.writeFileSync(path.join(distDir, 'index.html'), html);
  console.log('  wrote   dist/index.html');

  console.log('\n✅  Static build complete.\n');
  console.log(`    Folder:  ${distDir}`);
  console.log('    Preview: cd dist && python3 -m http.server 8080  (then http://localhost:8080)');
  console.log('    Or upload dist/ to any static host (Netlify, GitHub Pages, S3, etc).\n');
};
