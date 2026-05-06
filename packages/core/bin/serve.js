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
};

module.exports = function serve(config) {
  const cwd       = process.cwd();
  const slidesDir = path.join(cwd, config.slidesDir || 'slides');
  const pkgDir    = path.join(__dirname, '..');
  const PORT      = config.port || 3000;

  // Inject slide manifest into player.html so the player knows the deck
  const slidesJson  = JSON.stringify(config.slides);
  const labelsJson  = JSON.stringify(config.labels || config.slides.map(s => s.replace('.html', '')));
  const nameJson    = JSON.stringify(config.name || 'presentation');
  const configSnippet = `<script>
window.FUCKSLIDES_SLIDES = ${slidesJson};
window.FUCKSLIDES_LABELS = ${labelsJson};
window.FUCKSLIDES_NAME   = ${nameJson};
</script>`;

  const playerTemplate = fs.readFileSync(path.join(pkgDir, 'player.html'), 'utf8');
  const playerHtml     = playerTemplate.replace('</head>', configSnippet + '\n</head>');

  // Inject slide manifest into each slide too (for standalone keyboard nav)
  function injectSlideManifest(html) {
    const tag = `<script>window.FUCKSLIDES_SLIDES=${slidesJson};</script>`;
    return html.includes('</head>') ? html.replace('</head>', tag + '\n</head>') : html;
  }

  const cfgPath = path.join(cwd, 'fuckslides.config.js');

  const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];

    if (req.method === 'POST' && urlPath === '/api/save-order') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { slides: newSlides, labels: newLabels } = JSON.parse(body);
          let src = fs.readFileSync(cfgPath, 'utf8');
          const fmt = arr => '[\n    ' + arr.map(s => `'${s.replace(/'/g, "\\'")}'`).join(',\n    ') + ',\n  ]';
          src = src.replace(/slides:\s*\[[^\]]*\]/, `slides: ${fmt(newSlides)}`);
          src = src.replace(/labels:\s*\[[^\]]*\]/, `labels: ${fmt(newLabels)}`);
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

    if (urlPath === '/' || urlPath === '/player.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(playerHtml);
      return;
    }

    if (urlPath === '/js/fuckslides.js') {
      const jsPath = path.join(pkgDir, 'js', 'fuckslides.js');
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      fs.createReadStream(jsPath).pipe(res);
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
