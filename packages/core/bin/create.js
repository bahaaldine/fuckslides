'use strict';

const fs   = require('fs');
const path = require('path');

module.exports = function create(name) {
  if (!name) { console.error('Usage: fuckslides create <name>'); process.exit(1); }

  const dest = path.resolve(process.cwd(), name);
  if (fs.existsSync(dest)) { console.error(`❌  Directory "${name}" already exists.`); process.exit(1); }

  const tmpl = path.join(__dirname, '..', 'template');

  function copyDir(src, dst) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, entry.name);
      const d = path.join(dst, entry.name);
      if (entry.isDirectory()) copyDir(s, d);
      else fs.copyFileSync(s, d);
    }
  }

  copyDir(tmpl, dest);

  // Patch package.json name
  const pkgPath = path.join(dest, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.name = name;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  console.log(`
✅  Created presentation: ${name}

  cd ${name}
  npm install
  fuckslides serve
`);
};
