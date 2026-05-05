'use strict';

const puppeteer   = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const GLOBAL_INJECT = `
  document.getAnimations().forEach(a => { try { a.finish(); } catch(e) {} });
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
`;

const WIDTH  = 1280;
const HEIGHT = 720;

module.exports = async function exportPdf(config) {
  const cwd      = process.cwd();
  const slidesDir = path.join(cwd, config.slidesDir || 'slides');
  const outFile   = path.join(cwd, config.name ? `${config.name}.pdf` : 'presentation.pdf');
  const tmpDir    = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-pdf-'));
  const overrides = config.pdfOverrides || {};

  console.log('\nLaunching browser…\n');
  const browser  = await puppeteer.launch({ headless: true });
  const pdfPaths = [];

  for (let i = 0; i < config.slides.length; i++) {
    const file    = config.slides[i];
    const url     = `file://${path.join(slidesDir, file)}`;
    const tmpPdf  = path.join(tmpDir, `slide-${String(i).padStart(3, '0')}.pdf`);
    const override = overrides[file] || {};
    process.stdout.write(`  [${String(i + 1).padStart(2)}/${config.slides.length}] ${file}`);

    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.evaluate(GLOBAL_INJECT + (override.extra || ''));
      await new Promise(r => setTimeout(r, 2000 + (override.wait || 0)));

      await page.pdf({
        path: tmpPdf, width: `${WIDTH}px`, height: `${HEIGHT}px`,
        printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      pdfPaths.push(tmpPdf);
      console.log(' ✓');
    } catch (err) {
      console.log(` ✗ (${err.message.split('\n')[0]})`);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log('\n  Merging…');
  const merged = await PDFDocument.create();
  for (const p of pdfPaths) {
    const doc   = await PDFDocument.load(fs.readFileSync(p));
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach(pg => merged.addPage(pg));
  }
  fs.writeFileSync(outFile, await merged.save());

  pdfPaths.forEach(p => fs.unlinkSync(p));
  fs.rmdirSync(tmpDir);

  const size = (fs.statSync(outFile).size / (1024 * 1024)).toFixed(1);
  console.log(`\n✅  ${path.basename(outFile)} — ${pdfPaths.length} slides, ${size} MB\n    ${outFile}\n`);
};
