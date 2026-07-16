'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

const AUDIO_EXTS = ['.webm', '.m4a', '.mp3', '.ogg', '.wav'];

module.exports = function serve(config) {
  const cwd       = process.cwd();
  const slidesDir = path.join(cwd, config.slidesDir || 'slides');
  const pkgDir    = path.join(__dirname, '..');
  const PORT      = config.port || 3000;

  // Inject slide manifest into player.html so the player knows the deck
  const slidesJson   = JSON.stringify(config.slides);
  const labelsJson   = JSON.stringify(config.labels || config.slides.map(s => s.replace('.html', '')));
  const nameJson     = JSON.stringify(config.name || 'presentation');
  const titleJson    = JSON.stringify(config.title || config.name || 'presentation');
  const disabledJson = JSON.stringify(config.disabled || []);
  const configSnippet = `<script>
window.FUCKSLIDES_SLIDES    = ${slidesJson};
window.FUCKSLIDES_LABELS    = ${labelsJson};
window.FUCKSLIDES_NAME      = ${nameJson};
window.FUCKSLIDES_TITLE     = ${titleJson};
window.FUCKSLIDES_DISABLED  = ${disabledJson};
</script>`;

  const playerTemplate = fs.readFileSync(path.join(pkgDir, 'player.html'), 'utf8');
  const playerHtml     = playerTemplate
    .replace('<title>Fuckslides</title>', `<title>${config.title || config.name || 'Fuckslides'}</title>`)
    .replace('</head>', configSnippet + '\n</head>');

  // Inject slide manifest into each slide too (for standalone keyboard nav)
  function injectSlideManifest(html) {
    const tag = `<script>window.FUCKSLIDES_SLIDES=${slidesJson};</script>`;
    return html.includes('</head>') ? html.replace('</head>', tag + '\n</head>') : html;
  }

  const cfgPath   = path.join(cwd, 'fuckslides.config.js');
  const notesPath = path.join(cwd, 'notes.json');
  const recDir    = path.join(slidesDir, 'recordings');

  // Map of slide file -> relative recording URL. One recording per slide;
  // if multiple extensions exist for the same base, the newest mtime wins.
  function scanRecordings() {
    const map = {};
    if (!fs.existsSync(recDir)) return map;
    const best = {};
    for (const f of fs.readdirSync(recDir)) {
      const ext = path.extname(f).toLowerCase();
      if (!AUDIO_EXTS.includes(ext)) continue;
      const base = path.basename(f, ext);
      const mtime = fs.statSync(path.join(recDir, f)).mtimeMs;
      if (!best[base] || mtime > best[base].mtime) best[base] = { file: f, mtime };
    }
    for (const base of Object.keys(best)) map[base + '.html'] = 'recordings/' + best[base].file;
    return map;
  }

  function removeRecordings(slideFile) {
    if (!fs.existsSync(recDir)) return;
    const base = path.basename(slideFile, '.html');
    for (const f of fs.readdirSync(recDir)) {
      const ext = path.extname(f).toLowerCase();
      if (AUDIO_EXTS.includes(ext) && path.basename(f, ext) === base) {
        fs.unlinkSync(path.join(recDir, f));
      }
    }
  }

  const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];

    if (req.method === 'GET' && urlPath === '/api/source') {
      const fileParam = new URL(req.url, 'http://localhost').searchParams.get('file');
      if (!fileParam) { res.writeHead(400); res.end('Missing file param'); return; }
      const target = path.join(slidesDir, path.basename(fileParam));
      if (!fs.existsSync(target)) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(fs.readFileSync(target, 'utf8'));
      return;
    }

    if (req.method === 'POST' && urlPath === '/api/save') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { file, content } = JSON.parse(body);
          const target = path.join(slidesDir, path.basename(file));
          fs.writeFileSync(target, content, 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    if (req.method === 'POST' && urlPath === '/api/save-order') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { slides: newSlides, labels: newLabels, disabled: newDisabled } = JSON.parse(body);
          let src = fs.readFileSync(cfgPath, 'utf8');
          const fmt = arr => '[\n    ' + arr.map(s => `'${s.replace(/'/g, "\\'")}'`).join(',\n    ') + ',\n  ]';
          src = src.replace(/slides:\s*\[[^\]]*\]/, `slides: ${fmt(newSlides)}`);
          src = src.replace(/labels:\s*\[[^\]]*\]/, `labels: ${fmt(newLabels)}`);
          if (newDisabled !== undefined) {
            const disabledFmt = `disabled: ${fmt(newDisabled)}`;
            if (/disabled\s*:/.test(src)) {
              src = src.replace(/disabled:\s*\[[^\]]*\]/, disabledFmt);
            } else {
              src = src.replace(/};/, `  ${disabledFmt},\n};`);
            }
            config.disabled = newDisabled;
          }
          fs.writeFileSync(cfgPath, src, 'utf8');
          config.slides = newSlides;
          config.labels  = newLabels;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    if (req.method === 'GET' && urlPath === '/api/available-slides') {
      try {
        const allHtml = fs.readdirSync(slidesDir)
          .filter(f => f.endsWith('.html') && f !== 'index.html')
          .sort();
        const available = allHtml.filter(f => !config.slides.includes(f));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(available));
      } catch (e) {
        res.writeHead(500); res.end('[]');
      }
      return;
    }

    if (req.method === 'GET' && urlPath === '/api/notes') {
      const notes = fs.existsSync(notesPath) ? fs.readFileSync(notesPath, 'utf8') : '{}';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(notes);
      return;
    }

    if (req.method === 'POST' && urlPath === '/api/save-notes') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { file, notes } = JSON.parse(body);
          let all = {};
          if (fs.existsSync(notesPath)) {
            try { all = JSON.parse(fs.readFileSync(notesPath, 'utf8')); } catch(_) {}
          }
          if (notes.trim() === '') delete all[file];
          else all[file] = notes;
          fs.writeFileSync(notesPath, JSON.stringify(all, null, 2), 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    if (req.method === 'GET' && urlPath === '/api/recordings') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(scanRecordings()));
      return;
    }

    if (req.method === 'POST' && urlPath === '/api/save-recording') {
      const params = new URL(req.url, 'http://localhost').searchParams;
      const file = params.get('file');
      const ext  = (params.get('ext') || 'webm').replace(/[^a-z0-9]/gi, '');
      if (!file || !AUDIO_EXTS.includes('.' + ext)) {
        res.writeHead(400); res.end('Bad file or ext'); return;
      }
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        try {
          if (!fs.existsSync(recDir)) fs.mkdirSync(recDir, { recursive: true });
          removeRecordings(path.basename(file));          // overwrite semantics
          const base   = path.basename(file, '.html');
          const target = path.join(recDir, base + '.' + ext);
          fs.writeFileSync(target, Buffer.concat(chunks));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, url: 'recordings/' + base + '.' + ext }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    if (req.method === 'POST' && urlPath === '/api/delete-recording') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { file } = JSON.parse(body);
          removeRecordings(path.basename(file));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    if (urlPath === '/' || urlPath === '/player.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(playerHtml);
      return;
    }

    if (urlPath === '/presenter') {
      const presenterPath = path.join(pkgDir, 'presenter.html');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(presenterPath).pipe(res);
      return;
    }

    if (urlPath === '/js/fuckslides.js') {
      const jsPath = path.join(pkgDir, 'js', 'fuckslides.js');
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      fs.createReadStream(jsPath).pipe(res);
      return;
    }

    if (urlPath === '/logo.png') {
      const logoPath = path.join(pkgDir, 'logo.png');
      if (!fs.existsSync(logoPath)) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'image/png' });
      fs.createReadStream(logoPath).pipe(res);
      return;
    }

    const filePath = path.join(slidesDir, urlPath);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404); res.end('Not found'); return;
    }

    const ext = path.extname(filePath);
    if (ext === '.html') {
      const html = injectSlideManifest(fs.readFileSync(filePath, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }

    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  server.on('error', e => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\n  ❌  Port ${PORT} is already in use.\n  Run: lsof -ti :${PORT} | xargs kill -9\n`);
    } else console.error(e);
    process.exit(1);
  });

  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`\n  fuckSlides · "${config.name || 'presentation'}"\n  ${url}\n`);
    try { execSync(`open "${url}"`); } catch(e) {}
  });
};
