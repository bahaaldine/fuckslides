'use strict';

const puppeteer = require('puppeteer');
const PptxGenJS = require('pptxgenjs');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const GLOBAL_INJECT = `
  document.getAnimations().forEach(a => { try { a.finish(); } catch(e) {} });
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
`;

const WIDTH  = 1280;
const HEIGHT = 720;

module.exports = async function exportPptx(config) {
  const cwd       = process.cwd();
  const slidesDir = path.join(cwd, config.slidesDir || 'slides');
  const outFile   = path.join(cwd, (config.name || 'presentation') + '.pptx');
  const tmpDir    = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-pptx-'));
  const overrides = config.pdfOverrides || {};

  console.log('\nLaunching browser…\n');
  const browser = await puppeteer.launch({ headless: true });
  const shots   = [];

  for (let i = 0; i < config.slides.length; i++) {
    const file     = config.slides[i];
    const url      = `file://${path.join(slidesDir, file)}`;
    const tmpPng   = path.join(tmpDir, `slide-${String(i).padStart(3, '0')}.png`);
    const override = overrides[file] || {};
    process.stdout.write(`  [${String(i + 1).padStart(2)}/${config.slides.length}] ${file}`);

    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 });

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.evaluate(GLOBAL_INJECT + (override.extra || ''));
      await new Promise(r => setTimeout(r, 1500 + (override.wait || 0)));
      await page.screenshot({ path: tmpPng, type: 'png' });
      shots.push({ png: tmpPng, label: config.labels?.[i] || file.replace('.html', '') });
      console.log(' ✓');
    } catch (err) {
      console.log(` ✗ (${err.message.split('\n')[0]})`);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log('\n  Building PPTX…');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title  = config.title || config.name || 'presentation';

  for (const { png, label } of shots) {
    const slide = pptx.addSlide();
    slide.addImage({ path: png, x: 0, y: 0, w: '100%', h: '100%' });
    slide.slideNumber = { x: '90%', y: '94%', fontSize: 10, color: '888888' };
    // store slide name as notes for reference
    slide.addNotes(label);
  }

  await pptx.writeFile({ fileName: outFile });

  shots.forEach(({ png }) => { try { fs.unlinkSync(png); } catch (_) {} });
  try { fs.rmdirSync(tmpDir); } catch (_) {}

  const size = (fs.statSync(outFile).size / (1024 * 1024)).toFixed(1);
  console.log(`\n✅  ${path.basename(outFile)} — ${shots.length} slides, ${size} MB\n    ${outFile}\n`);
};
