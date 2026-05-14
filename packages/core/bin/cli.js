#!/usr/bin/env node
'use strict';

const path = require('path');
const fs   = require('fs');

const [,, cmd, ...args] = process.argv;

function loadConfig(cwd) {
  const cfgPath = path.join(cwd, 'fuckslides.config.js');
  if (!fs.existsSync(cfgPath)) {
    console.error('❌  No fuckslides.config.js found. Run this from a presentation directory.');
    process.exit(1);
  }
  return require(cfgPath);
}

// parse --template flag for add-slide
function getFlag(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

switch (cmd) {
  case 'create':
    require('./create')(args[0]);
    break;
  case 'import':
    require('./import')(args);
    break;
  case 'pdf':
    require('./pdf')(loadConfig(process.cwd()));
    break;
  case 'gif':
    require('./gif')(loadConfig(process.cwd()), args[0]);
    break;
  case 'serve':
    require('./serve')(loadConfig(process.cwd()));
    break;
  case 'export': {
    const outArg = args[0] && !args[0].startsWith('-') ? args[0] : undefined;
    require('./export')(loadConfig(process.cwd()), outArg ? path.join(process.cwd(), outArg) : undefined);
    break;
  }
  case 'add-slide':
    require('./add-slide')(args[0], getFlag('--template'));
    break;
  case 'publish':
    require('./publish')(loadConfig(process.cwd()));
    break;
  default:
    console.log(`
  fuckSlides — no-bullshit HTML presentations

  Commands:
    fuckslides create <name>          Scaffold a new presentation
    fuckslides import <file …>        Convert PDF or images to slides (requires ANTHROPIC_API_KEY)
    fuckslides serve                  Open presentation in browser with player
    fuckslides pdf                    Export all slides to PDF
    fuckslides gif <slide>            Export a slide to animated GIF
    fuckslides export [output.html]   Bundle into a single self-contained HTML file
    fuckslides add-slide <name>       Add a new slide (--template title|stat|quote|split|bullets|cover)
    fuckslides publish                Deploy to GitHub Pages
`);
}
