'use strict';

const fs   = require('fs');
const path = require('path');

module.exports = async function exportPresentation(config, outputPath) {
  const cwd      = process.cwd();
  const slidesDir = path.join(cwd, config.slidesDir || 'slides');
  const pkgDir   = path.join(__dirname, '..');
  const out      = outputPath || path.join(cwd, (config.name || 'presentation') + '.html');

  // Read all slide HTML
  const slideContents = {};
  for (const slide of config.slides) {
    const p = path.join(slidesDir, slide);
    if (fs.existsSync(p)) slideContents[slide] = fs.readFileSync(p, 'utf8');
  }

  // Inline fuckslides.js
  const fsJsPath = path.join(pkgDir, 'js', 'fuckslides.js');
  const fsJs = fs.existsSync(fsJsPath) ? fs.readFileSync(fsJsPath, 'utf8') : '';

  // Logo as base64 data URI
  const logoPath = path.join(pkgDir, 'logo.png');
  const logoDat = fs.existsSync(logoPath)
    ? 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64')
    : '';

  // Read player template
  let html = fs.readFileSync(path.join(pkgDir, 'player.html'), 'utf8');

  // Inject config + slide contents
  const snippet = `<script>
window.FUCKSLIDES_SLIDES    = ${JSON.stringify(config.slides)};
window.FUCKSLIDES_LABELS    = ${JSON.stringify(config.labels || config.slides.map(s => s.replace('.html','')))};
window.FUCKSLIDES_NAME      = ${JSON.stringify(config.name || 'presentation')};
window.FUCKSLIDES_TITLE     = ${JSON.stringify(config.title || config.name || 'presentation')};
window.FUCKSLIDES_DISABLED  = ${JSON.stringify(config.disabled || [])};
window.FUCKSLIDES_EXPORT    = true;
window.FUCKSLIDES_CONTENTS  = ${JSON.stringify(slideContents)};
</script>`;

  html = html.replace('</head>', snippet + '\n</head>');

  // Inline fuckslides.js and remove external src reference
  if (fsJs) html = html.replace(/<script src="\/js\/fuckslides\.js"><\/script>/g, `<script>${fsJs}</script>`);

  // Swap logo src to data URI
  if (logoDat) html = html.replace(/src="\/logo\.png"/g, `src="${logoDat}"`);

  // Remove api-dependent features in export (save, save-order — they 404 silently already)
  fs.writeFileSync(out, html, 'utf8');

  const size = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`\n  ✓  Exported → ${path.relative(cwd, out)}  (${size} KB)\n  Open in any browser — no server needed.\n`);

  return out;
};
