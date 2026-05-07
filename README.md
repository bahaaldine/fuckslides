# fuckSlides

A no-bullshit HTML presentation framework. Your slides are plain HTML files. fuckSlides provides everything around them — a presenter player, keyboard navigation, slide overview, filmstrip, in-browser editor, speaker notes, PDF export, and animated GIF export.

No build step. No lock-in. Every slide is just a file you can open in a browser.

---

## Install

```bash
npm install -g fuck-slides
```

Or use without installing:

```bash
npx fuck-slides create my-talk
```

---

## Quick start

```bash
fuckslides create my-talk
cd my-talk
npm install
fuckslides serve
```

A browser opens with your presentation in the player.

---

## Project structure

```
my-talk/
  slides/
    cover.html
    problem.html
    solution.html
    ...
  fuckslides.config.js   ← slide manifest + options
  notes.json             ← speaker notes (auto-created, one key per slide)
  package.json
```

---

## fuckslides.config.js

```js
module.exports = {
  // Presentation name — used as PDF filename and player title
  name: 'my-talk',

  // Directory containing your HTML slides (default: 'slides')
  slidesDir: 'slides',

  // Ordered list of slide filenames
  slides: [
    'cover.html',
    'problem.html',
    'solution.html',
    'demo.html',
    'thank-you.html',
  ],

  // Human-readable labels shown in the slide overview
  labels: [
    'Cover',
    'The Problem',
    'The Solution',
    'Demo',
    'Thank You',
  ],

  // Slides to skip during navigation (still visible in overview, greyed out)
  disabled: [
    'backup-slide.html',
  ],

  // Dev server port (default: 3000)
  port: 3000,
};
```

---

## Commands

### `fuckslides serve`

Opens the presentation in a browser with the full player shell.

```bash
fuckslides serve
```

Runs at `http://localhost:3000`. The slide manifest is injected automatically into every slide — you never hardcode it.

### `fuckslides pdf`

Exports all slides to a single PDF.

```bash
fuckslides pdf
# → my-talk.pdf
```

Uses Puppeteer. Automatically finishes all CSS keyframe animations, forces scroll-reveal elements visible, and applies per-slide overrides you define (see [PDF overrides](#pdf-overrides)).

### `fuckslides gif <slide>`

Exports a single slide as an animated GIF.

```bash
fuckslides gif demo.html
# → demo.gif
```

Captures at **2560×1440** (2× retina), **20fps**, **13 seconds**, then encodes with [gifski](https://gif.ski) for maximum quality.

Requires gifski:
```bash
brew install gifski   # macOS
```

### `fuckslides create <name>`

Scaffolds a new presentation.

```bash
fuckslides create my-talk
```

### `fuckslides import <file …>`

Converts an existing PDF or a set of images into a fuckSlides presentation using Claude's vision API.

```bash
fuckslides import deck.pdf
fuckslides import slide1.png slide2.png slide3.png
```

Requires an Anthropic API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
fuckslides import deck.pdf
```

**What it does:**

1. For PDFs — extracts each page as a screenshot using Puppeteer
2. Sends every slide image to Claude with a detailed fuckSlides design prompt
3. Receives a complete, styled HTML file per slide
4. Writes them to `slides/` and generates `fuckslides.config.js`
5. Run `fuckslides serve` and you're live

**Example — starting from a PDF:**

```bash
mkdir my-talk && cd my-talk
fuckslides import ../my-existing-deck.pdf
fuckslides serve
```

**Example — starting from screenshots:**

```bash
mkdir my-talk && cd my-talk
fuckslides import ~/Desktop/slide-*.png
fuckslides serve
```

The generated slides faithfully reproduce the content and layout of the originals and apply the fuckSlides design system — dark background, dot-grid, Inter typography, staggered fade-up animations.

---

## Writing slides

Each slide is a standalone HTML file fixed at **1280×720**. The only requirement is including the runtime:

```html
<script src="/js/fuckslides.js"></script>
```

### Minimal slide

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Slide</title>
  <style>
    html, body {
      width: 1280px; height: 720px; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      background: #0d0f14; color: #fff;
      font-family: 'Inter', sans-serif;
    }
    h1 { font-size: 96px; font-weight: 900; letter-spacing: -0.04em; }
  </style>
</head>
<body>
  <h1>Hello.</h1>
  <script src="/js/fuckslides.js"></script>
</body>
</html>
```

### Real slide — title + stat cards

A realistic slide with entrance animations, a dot-grid background, and a stat grid:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>By the Numbers</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      width: 1280px; height: 720px; overflow: hidden;
      font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased;
      background: #0d0f14; color: #fff;
    }

    body::before {
      content: '';
      position: fixed; inset: 0;
      background-image: radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px);
      background-size: 32px 32px;
      pointer-events: none;
    }

    @keyframes fade-up {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: none; }
    }

    .slide {
      width: 1280px; height: 720px;
      display: flex; flex-direction: column; justify-content: center;
      padding: 0 80px; gap: 48px; position: relative; z-index: 1;
    }

    .eyebrow {
      font-size: 11px; font-weight: 700; letter-spacing: 0.22em;
      text-transform: uppercase; color: #38BDF8;
      opacity: 0; animation: fade-up 0.5s ease forwards 0.05s;
    }

    h1 {
      font-size: 64px; font-weight: 900; letter-spacing: -0.04em;
      line-height: 1; color: #fff;
      opacity: 0; animation: fade-up 0.5s ease forwards 0.15s;
    }

    h1 em { color: #38BDF8; font-style: normal; }

    .cards {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
    }

    .card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-top: 2px solid #38BDF8;
      border-radius: 12px;
      padding: 24px 28px;
      opacity: 0;
    }
    .card:nth-child(1) { animation: fade-up 0.5s ease forwards 0.3s; }
    .card:nth-child(2) { animation: fade-up 0.5s ease forwards 0.42s; }
    .card:nth-child(3) { animation: fade-up 0.5s ease forwards 0.54s; }

    .card-num {
      font-size: 52px; font-weight: 900; letter-spacing: -0.04em;
      color: #38BDF8; line-height: 1;
    }

    .card-label {
      margin-top: 8px; font-size: 14px; color: rgba(255,255,255,0.5);
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="slide">
    <div>
      <div class="eyebrow">Key Results</div>
      <h1>Progress so <em>far.</em></h1>
    </div>
    <div class="cards">
      <div class="card">
        <div class="card-num">12k</div>
        <div class="card-label">users onboarded in the first month</div>
      </div>
      <div class="card">
        <div class="card-num">94%</div>
        <div class="card-label">satisfaction score across all cohorts</div>
      </div>
      <div class="card">
        <div class="card-num">3 days</div>
        <div class="card-label">median time from signup to first value</div>
      </div>
    </div>
  </div>
  <script src="/js/fuckslides.js"></script>
</body>
</html>
```

### Scroll reveals

```html
<p class="reveal">This appears on scroll.</p>
```

```css
.reveal { opacity: 0; transform: translateY(16px); transition: opacity 0.5s, transform 0.5s; }
.reveal.visible { opacity: 1; transform: none; }
```

### Animated counters

```html
<span data-target="25" data-suffix="×"></span>
<span data-target="99.9" data-suffix="%" data-prefix="~"></span>
```

The number animates up when the slide becomes visible. In PDF export it snaps to the final value.

---

## Player features

| Feature | Shortcut |
|---------|----------|
| Next slide | `→` `↓` `Space` `PageDown` |
| Previous slide | `←` `↑` `PageUp` |
| Fullscreen | `F` |
| Slide overview | `G` |
| Filmstrip | `T` |
| In-browser editor | `E` |
| Speaker notes | `N` |
| Close overlay | `Esc` |
| Clicker support | `PageDown` / `PageUp` |

### Slide overview (`G`)

Full-screen grid of all slides as live thumbnails. Click any slide to jump. **Drag to reorder** — the new order is saved instantly to `fuckslides.config.js` and `localStorage`. Slides marked `disabled` in your config appear greyed out with a strikethrough; you can toggle them on/off per-session with the ⊘ button on each thumbnail.

### Filmstrip (`T`)

Horizontal strip of thumbnails that slides up from the bottom. Click to jump.

### In-browser editor (`E`)

A full split-pane code editor for the current slide, without leaving the browser.

- **Left pane** — syntax-highlighted HTML source with live editing
- **Right pane** — live preview with hover-to-edit: hover any text element to highlight it, click to edit it inline. Changes sync back to the code pane in real time.
- **Autosaves** to disk after 1.5 seconds of idle — the main slide reloads automatically.
- Drag the centre divider to resize panes. `+` / `−` buttons zoom each pane independently.
- `Esc` closes the editor (or exits inline text editing first if one is active).

### Speaker notes (`N`)

A slide-up notes panel for presenter use.

- Each slide has its own notes, stored in `notes.json` at your project root.
- Notes autosave after 1 second of idle. The file is plain JSON — easy to diff and commit.
- Notes update automatically when you navigate between slides.
- Typing in the notes panel does not interfere with slide navigation shortcuts.

`notes.json` example:
```json
{
  "cover.html": "Wait for the room to settle before clicking. Start with the question, not the deck.",
  "context.html": "Two minutes max on this slide. They already know the background.",
  "demo.html": "Live demo — terminal ready in a second Space. If it breaks, say 'let me show the recording' and move on.",
  "cta.html": "Slow down here. Make sure the ask is clear before you leave this slide."
}
```

---

## Disabling slides

Mark slides as skipped in your config:

```js
disabled: [
  'appendix-pricing.html',
  'backup-competitive.html',
],
```

Disabled slides are excluded from navigation (`→` / `←`) but remain visible in the slide overview, greyed out. Toggle them on/off per-session from the overview without editing the config. The state is saved back to `fuckslides.config.js` automatically.

This is useful for backup slides, appendices, or content you want available but not in the default flow.

---

## PDF overrides

Some slides need special handling before Puppeteer captures them — animations mid-play, multi-step states, etc.

```js
pdfOverrides: {

  // Force an odometer-style animation to its final state
  'storage.html': {
    extra: `
      document.querySelectorAll('.odo-slot').forEach(slot => {
        const strip = slot.querySelector('.odo-strip');
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(-' + ((30 + parseInt(slot.dataset.target)) * 152) + 'px)';
      });
    `,
    wait: 300,
  },

  // Snap a number counter to its final value
  'metrics.html': {
    extra: `
      const n = document.getElementById('big-num');
      n.style.transition = 'none';
      n.style.opacity = '1';
      n.style.transform = 'scale(1)';
    `,
    wait: 200,
  },

  // Show the "completed" state of a multi-step migration diagram
  'migrate.html': {
    extra: `
      for (let i = 0; i < 5; i++) {
        const pill = document.getElementById('pill-' + i);
        pill.classList.remove('pill-ready');
        pill.classList.add('pill-migrated');
        pill.textContent = 'Migrated';
      }
      document.getElementById('progress-fill').style.width = '100%';
    `,
    wait: 200,
  },

},
```

The `extra` script runs after the global finisher, which already calls `getAnimations().forEach(a => a.finish())` and forces all `.reveal` elements visible.

---

## Updating the framework

```bash
npm update fuck-slides
```

All player improvements — new shortcuts, better PDF export, editor features — apply to every presentation that runs this command.

---

## How it works

```
fuckslides serve
  └─ HTTP server at localhost:3000
       ├─ GET /                   → player.html (injected with slide manifest)
       ├─ GET /js/fuckslides.js   → runtime
       ├─ GET /slide.html         → your slide (manifest injected)
       ├─ GET /api/source         → raw slide source (for the editor)
       ├─ GET /api/notes          → all speaker notes as JSON
       ├─ POST /api/save          → write edited slide HTML to disk
       ├─ POST /api/save-notes    → update notes.json for one slide
       └─ POST /api/save-order    → write new slide order to fuckslides.config.js

fuckslides pdf
  └─ Puppeteer opens each slide
       → injects animation finisher
       → applies pdfOverrides
       → page.pdf() → merges with pdf-lib

fuckslides gif <slide>
  └─ Puppeteer at 2560×1440, deviceScaleFactor: 2
       → 260 frames at 20fps
       → gifski --quality 100
```

---

## License

MIT
