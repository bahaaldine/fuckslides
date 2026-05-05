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

switch (cmd) {
  case 'create':
    require('./create')(args[0]);
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
  default:
    console.log(`
  fuckSlides — no-bullshit HTML presentations

  Commands:
    fuckslides create <name>   Scaffold a new presentation
    fuckslides serve           Open presentation in browser with player
    fuckslides pdf             Export all slides to PDF
    fuckslides gif <slide>     Export a slide to animated GIF
`);
}
