# Design harness

Runs the design canvas pages (`*.dc.html`) in a real headless Chromium with the artifact's own runtime, instead of a stand-in renderer, and drives them with Playwright.

## What it needs

- `support.js`: the runtime. It is the file `artifact-type/dc-runtime.js` in the published design artifact; read it with the Artifact tool's `read` action and save it as `support.js` beside the pages.
- The pages, `level-data.js` (the sample level) and `levels-data.js` (all 16 real levels, written by `tools/gen-proto-levels.ts`) in the same folder.
- A static server on `127.0.0.1:8765` (for example `python3 -m http.server 8765 --bind 127.0.0.1` in that folder). Stop it when finished.
- Playwright and its headless Chromium from the game repository's `node_modules` (the scripts load `@playwright/test` from there and pass `executablePath` to the installed `chrome-headless-shell`).

## Scripts

| Script | What it does |
|---|---|
| `load.cjs <page> [png]` | Loads one page, prints the title, console errors and the first text, and takes a screenshot |
| `all.cjs` | Loads every page in the folder and reports errors and unresolved placeholders (set `H` to the folder) |
| `e2e.cjs`, `e2e3.cjs` | Interaction tests for the prototype: painting, windows, menus, typed lines, zoom, selecting, stamping, pop-out |
| `guide-e2e.cjs` | Tests the walkthrough's demos |
| `proto-crater-e2e.cjs` | Crater Fields in the prototype: cell count, gaps, painting with y from the bottom, typed `place` lines, switching to the sample |
| `proto-levels-e2e.cjs` | Opens every starter level through the File menu card and checks its size and title |

Audio is muted (`--mute-audio`); the pages make no sound. The Google Fonts links fail inside the sandbox, so pages render with fallback fonts and can occasionally be slow to load.
