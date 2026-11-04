# Fizz Level Studio — design artefacts

A copy of everything published to the design canvas at <https://claude.ai/artifact/E43evy173R6mC7bAeN5FAF>, so the work lives beside the code.

- `project/` — the canvas: `canvas.json` (boards, pages and notes), one `*.dc.html` page per board, and the data files the pages load. `support.js` is the Design runtime the pages need to run outside the canvas.
- `project/ds/liminal-hq/tokens.json` — the Liminal HQ design system tokens the canvas was built with.
- `assets/` — the screenshots the walkthrough uses, named by the blob id the pages reference (`/_blob/<id>`).

## The pages

| Page | What it is |
| --- | --- |
| `Proto.dc.html` | The interactive prototype. New level asks for a target: Fizz 1 behaves as before, and Fizz 2 opens a canned level with States and Rules, the Light tool, Night, Budget, Definitions, Panels, Script and the Export check (proposed, canned data). It loads `level-data.js` (the sample draft), `levels-data.js` (all 16 levels and the overworld) and `lang-docs.js` (the language docs, for completion) |
| `F2NewLevel`, `F2Editor`, `F2States`, `F2Lights`, `F2Panels`, `F2Behaviour`, `F2Budget`, `F2Sprites` `.dc.html` | The Fizz 2 editor as proposed in `docs/EDITOR.md` sections 13 to 15, `docs/WORLD.md` and `docs/SCRIPTING.md`: New world and New level with the target choice and Capabilities card; the editor with the Game view; States and Rules; lights and the night view; parallax panels and the pixel editor; the Definitions and behaviour editor; Budget, the Fizz 1 export check and the conversion report; the Sprites window. Every Fizz 2 line and number is a proposal on a canned sample |
| `AppStart`, `AppSettings`, `AppAbout`, `AppConflict`, `AppRecovery` `.dc.html` | The desktop app around the editor (`docs/DESKTOP.md`): the start screen with recent worlds and the window menu, Settings, About with third-party notices, the file-changed-on-disk dialog, and crash recovery. The title bar follows Folio's chrome, with the app menu button on the left |
| `Guide.dc.html` | The walkthrough of the editor, twelve steps |
| `Manual.dc.html` | The language manual, with a live checker for edits lines |
| `Level.dc.html` | Crater Fields drawn block by block, checked against the game |
| `Ultimate*.dc.html`, `Work*.dc.html`, `Main`, `Canvas`, `Script`, `Chat`, `Float`, `Split`, `Overlay`, `Workspace` | The layout explorations that led to the chosen layout |
| `Logos*.dc.html`, `Icon*.dc.html` | Logo and icon explorations; the line park (28) is the chosen direction |
| `Tools.dc.html`, `Language.dc.html` | The MCP surface and the first sketch of the language |

## Regenerating the data files

```bash
bun tools/gen-proto-levels.ts > design/project/levels-data.js   # the 16 levels and the overworld
bun tools/gen-lang-docs.ts > design/project/lang-docs.js        # the language docs
```

## Running the pages

`tools/design-harness/README.md` explains how to serve the pages and run their Playwright tests in a headless Chromium.
