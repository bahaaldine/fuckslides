# fuckSlides

A no-bullshit HTML presentation framework. Your slides are plain HTML files. fuckSlides provides everything around them — a presenter player, keyboard navigation, slide overview, filmstrip, PDF export, and animated GIF export.

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

That's it. A browser opens with your presentation in the player.

---

## Project structure

```
my-talk/
  slides/
    index.html          ← your slides go here
    slide-2.html
    ...
  fuckslides.config.js  ← slide manifest + options
  package.json
```

---

## fuckslides.config.js

This is the only config file you need. It lives at the root of your presentation.

```js
module.exports = {
  // Presentation name — used as the PDF filename and player title
  name: 'my-talk',

  // Directory containing your HTML slides (default: 'slides')
  slidesDir: 'slides',

  // Ordered list of slide filenames
  slides: [
    'index.html',
    'problem.html',
    'solution.html',
    'demo.html',
    'thank-you.html',
  ],

  // Human-readable labels shown in the overview panel
  // Must match the slides array length
  labels: [
    'Title',
    'The Problem',
    'The Solution',
    'Demo',
    'Thank You',
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

The player runs at `http://localhost:3000`. Slides are served from your `slides/` directory. The slide manifest is injected automatically — no hardcoding in your HTML files.

### `fuckslides pdf`

Exports all slides to a single PDF.

```bash
fuckslides pdf
# → my-talk.pdf
```

Uses Puppeteer under the hood. Automatically:
- Finishes all CSS keyframe animations
- Forces scroll-reveal elements visible
- Applies any per-slide overrides you define (see [PDF overrides](#pdf-overrides))

### `fuckslides gif <slide>`

Exports a single slide as an animated GIF.

```bash
fuckslides gif demo.html
# → demo.gif
```

Captures at **2560×1440** (2× retina), **20fps**, **13 seconds** via Puppeteer, then encodes with [gifski](https://gif.ski) for maximum quality.

Requires gifski to be installed:
```bash
brew install gifski   # macOS
```

### `fuckslides create <name>`

Scaffolds a new presentation directory.

```bash
fuckslides create my-talk
```

Creates:
```
my-talk/
  slides/index.html
  fuckslides.config.js
  package.json
```

---

## Writing slides

Each slide is a standalone HTML file. The only requirement is including the fuckSlides runtime script:

```html
<script src="/js/fuckslides.js"></script>
```

This gives you keyboard navigation, scroll reveals, and counter animations for free.

### Minimal slide

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Slide</title>
  <style>
    html, body {
      width: 100%; height: 100vh; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      background: #0A1520; color: #fff;
      font-family: 'Inter', sans-serif;
    }
    h1 { font-size: clamp(3rem, 7vw, 8rem); font-weight: 900; }
  </style>
</head>
<body>
  <h1>Hello, world.</h1>
  <script src="/js/fuckslides.js"></script>
</body>
</html>
```

> **Note:** Slides are designed for **1280×720** (16:9). Use `clamp()` and `vw`/`vh` units to keep layouts fluid.

### Scroll reveals

Add the `.reveal` class to any element. It will fade in when it enters the viewport (or immediately in PDF export).

```html
<p class="reveal">This appears on scroll.</p>
```

CSS you need to add to your slide:

```css
.reveal {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.reveal.visible {
  opacity: 1;
  transform: none;
}
```

### Animated counters

Add `data-target` to any element. The number animates up when it enters the viewport.

```html
<span data-target="25" data-suffix="×"></span>
<span data-target="99.9" data-suffix="%" data-prefix="~"></span>
```

---

## Player features

The player shell (`fuckslides serve`) provides:

| Feature | How to trigger |
|---------|---------------|
| Next slide | `→` `↓` `Space` `PageDown` |
| Previous slide | `←` `↑` `PageUp` |
| Fullscreen | `F` |
| Slide overview | `G` |
| Filmstrip | `T` |
| Close overlay | `Esc` |
| Clicker support | `PageDown` / `PageUp` |

### Slide overview (G)

Full-screen grid of all slides as live thumbnails. Click any slide to jump to it. **Drag and drop** to reorder — the new order is saved in `localStorage` and persists across sessions. Reset button restores the original order.

### Filmstrip (T)

Horizontal strip of thumbnails that slides up from the bottom. Click to jump.

### Keyboard focus after mouse click

If you click inside a slide with your mouse, keyboard focus moves to the iframe. fuckSlides forwards all `keydown` events from the iframe back to the player via `postMessage`, so navigation keeps working.

---

## PDF overrides

Some slides have JS-driven animations or multi-step states that need special handling before Puppeteer captures them. Define per-slide overrides in your config:

```js
module.exports = {
  // ...
  pdfOverrides: {

    // Wait extra time for a JS animation to complete
    'my-animated-slide.html': {
      wait: 5000,  // extra ms on top of the default 2000ms
    },

    // Inject JS to reach the desired state before capture
    'my-step-slide.html': {
      extra: `
        if (typeof goToLastStep === 'function') goToLastStep();
      `,
      wait: 1500,
    },

    // Combine both
    'my-scramble-intro.html': {
      extra: `
        document.querySelectorAll('[data-char]').forEach(el => {
          el.textContent = el.dataset.char;
        });
      `,
      wait: 300,
    },
  },
};
```

The `extra` script runs after the global animation finisher, which already:
- Calls `document.getAnimations().forEach(a => a.finish())` on every slide
- Forces all `.reveal` elements visible

---

## Updating the framework

Because your presentation depends on `fuck-slides` as an npm package, updating is one command:

```bash
npm update fuck-slides
```

All framework improvements — player features, better PDF export, GIF quality — apply instantly to every presentation that runs this command.

---

## How it works

```
fuckslides serve
  └─ HTTP server at localhost:3000
       ├─ GET /          → player.html (from fuck-slides package)
       │                    with slide manifest injected as window.FUCKSLIDES_SLIDES
       ├─ GET /js/fuckslides.js → runtime (from fuck-slides package)
       └─ GET /slide.html → your slide file (from slides/)

fuckslides pdf
  └─ Puppeteer opens each slide via file://
       → injects animation finisher JS
       → applies pdfOverrides
       → captures via page.pdf()
       → merges with pdf-lib

fuckslides gif <slide>
  └─ Puppeteer opens slide at 1280×720, deviceScaleFactor: 2
       → captures 260 frames at 20fps
       → encodes with gifski --quality 100
```

---

## License

MIT
