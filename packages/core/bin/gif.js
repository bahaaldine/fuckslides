'use strict';

const puppeteer    = require('puppeteer');
const { execSync } = require('child_process');
const fs  = require('fs');
const os  = require('os');
const path = require('path');

const WIDTH    = 1280;
const HEIGHT   = 720;
const SCALE    = 2;
const FPS      = 20;
const DURATION = 13000;

module.exports = async function exportGif(config, slideArg) {
  const cwd       = process.cwd();
  const slidesDir = path.join(cwd, config.slidesDir || 'slides');

  if (!slideArg) {
    console.error('Usage: fuckslides gif <slide.html>');
    process.exit(1);
  }

  const slideFile = path.isAbsolute(slideArg) ? slideArg : path.join(slidesDir, slideArg);
  const outFile   = path.join(cwd, path.basename(slideArg, '.html') + '.gif');
  const tmpDir    = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-gif-'));

  console.log(`\nLaunching browser…\n`);
  const browser = await puppeteer.launch({ headless: true });
  const page    = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE });
  await page.goto(`file://${slideFile}`, { waitUntil: 'domcontentloaded' });

  const interval    = Math.round(1000 / FPS);
  const totalFrames = Math.round(DURATION / interval);

  console.log(`  Capturing ${totalFrames} frames at ${FPS}fps (${DURATION / 1000}s)\n`);

  for (let i = 0; i < totalFrames; i++) {
    const raw  = await page.screenshot({ type: 'png' });
    const shot = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    fs.writeFileSync(path.join(tmpDir, `frame-${String(i).padStart(4, '0')}.png`), shot);
    process.stdout.write(`\r  [${String(i + 1).padStart(3)}/${totalFrames}] captured`);
    if (i < totalFrames - 1) await new Promise(r => setTimeout(r, interval));
  }

  await browser.close();
  console.log('\n\n  Encoding with gifski…\n');

  execSync(
    `gifski --fps ${FPS} --quality 100 -W ${WIDTH * SCALE} -H ${HEIGHT * SCALE} --output "${outFile}" "${tmpDir}"/frame-*.png`,
    { shell: true, stdio: 'inherit' }
  );

  fs.readdirSync(tmpDir).forEach(f => fs.unlinkSync(path.join(tmpDir, f)));
  fs.rmdirSync(tmpDir);

  const size = (fs.statSync(outFile).size / (1024 * 1024)).toFixed(1);
  console.log(`\n✅  ${path.basename(outFile)} — ${size} MB\n    ${outFile}\n`);
};
