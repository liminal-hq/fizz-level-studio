# Architecture

How Fizz Level Studio is put together: the packages, how a script flows through them, where the game owns the rules, the game host for enemy paths and playtests, and the file layout.

## 1. Principles

- **The game owns the simulation.** Deterministic rules (physics, collision, enemy behaviour, timing) live in Rust in the game (`crates/sim`, `episodes/episode-1/game`) (which also builds to WebAssembly behind a raw C-ABI export surface for its own web and Android builds). The studio never re-derives a simulation rule: in the desktop app it links the games' crates natively (D59) and its own logic is Rust too (D55); the webview only draws. This is the game repository's own rule (`CLAUDE.md`, `docs/ENGINE_SPEC.md` §4.1) carried into the studio.
- **The script is the source.** A level or overworld is a `.fizz` text file. The canvas, Claude's view and the exported Rust are all derived from it.
- **The `Builder` is the semantics.** The language is a thin skin over the private `Builder` in `episodes/episode-1/game/src/levels.rs`. Where a design idea disagreed with the `Builder`, the `Builder` won (`spec/LANGUAGE.md`, "Changes from the sketch").
- **Prove against the game's own data.** Every claim of equality is checked by building the real thing and comparing, not by reading code.

## 2. Packages

| Package | Path | Entry points | Depends on |
| --- | --- | --- | --- |
| Language | `packages/language/src` | `parse`, `parseOrThrow` (`parser.ts`); `print`, `formatNode` (`printer.ts`); `appendEdits` (`edits.ts`); `toRust` (`rust.ts`); `isOverworld`, `parseOverworld`, `printOverworld`, `rasteriseOverworld`, `overworldToRust`, `hashf`, `SCATTER_RATES` (`overworld.ts`); `DOCS`, `docsFor`, `FIELD_NOTES`, `TILE_NOTES` (`docs.ts`); name tables (`tables.ts`); `FizzErrors`, `formatError` (`errors.ts`); the `check` and `export` CLI (`cli.ts`) | Nothing |
| MCP server | `packages/mcp/src` | `server.ts` (stdio server), `tools.ts` (the nine tools), `studio.ts` (file, sidecar, proposals, accept, reject, undo), `world.ts` (level rasteriser, glyph rendering, gap check), `schema.ts` (input checker), `cli.ts` (the person's command line) | Language; `@modelcontextprotocol/sdk` ^1.32.1 |
| Tools | `tools/` | Proof generators, verifiers, audits, the decompiler, the prototype data generators, the design harness | Language, MCP (`world.ts`) |
| Proof copy | `scratch/rust/` | A Cargo workspace copied from the game, plus the generated functions and proof tests | The game's crates |
| Fizz 2 dialect and target profiles | not built | Planned: the dialect, the target profiles and their capability states, the Fizz 1 export check and Convert to Fizz 2, parsed through the baker's own `fizz-script` (D55) with the studio's Rust crates around it; the profiles as generated data files | Language |
| Design prototype | `design/project/` | `Proto.dc.html` and the other canvas pages | `levels-data.js`, `lang-docs.js` (generated) |
| Studio app | not built | Planned as a Tauri v2 desktop app: `apps/studio`, `crates/fizz-studio-*`, `plugins/*` ([DESKTOP.md](DESKTOP.md)) | The studio's crates; the Fizz 1 and Fizz 2 game crates, linked natively |

The level rasteriser lives in `packages/mcp/src/world.ts` because the MCP server needed it first; the overworld rasteriser lives in `packages/language/src/overworld.ts`. The real studio needs both from one place, so the level rasteriser should move into the language package beside the overworld one.

## 3. Data flow

```text
                ┌──────────────────────── level.fizz (text) ────────────────────────┐
                │                                                                    │
           parse(text)                                                    appendEdits(ast, edits)
                │                                                         print(ast)  ▲
                ▼                                                                    │
     AST: one node per line ──────────────────────────────────────────────────────────┘
     { type, line, raw, comment, ...fields }
                │
      ┌─────────┼──────────────────────────────┬───────────────────────────────┐
      ▼         ▼                              ▼                               ▼
  toRust(ast, fn)                         rasterise(ast)                docsFor(scope)
      │                                        │                               │
      ▼                                        ▼                               ▼
  fn <fn>() -> LevelData            World { tiles, liquid, items,        completion, manual,
  (Builder calls in file order,     spawns, hovers, switches, start }    list_kinds
   then b.out(ID, start, arena))           │
      │                          ┌─────────┼──────────────┐
      ▼                          ▼         ▼              ▼
  the game's levels.rs      canvas     get_region     run_checks / findGaps
  (compiled, fingerprinted)
```

Overworld scripts follow the same shape: `parseOverworld` → `OwAst` → `overworldToRust` (writes `fn <name>() -> MapData` against `OverworldBuilder`) and `rasteriseOverworld` (an `OwWorld` with tiles, areas, points, the start and, for each cell, the script line that last wrote it).

Details that matter:

- **Every node keeps its raw text.** `print` writes `raw` for a parsed node and `formatNode` only for a node built in memory, so a parsed file prints back byte for byte and an append changes nothing above it.
- **Errors do not stop parsing.** A bad line becomes an `error` node with its code; `parse` returns every error, in line order. `toRust` refuses an AST with error nodes.
- **The exporter emits one call per statement in file order**, expanding lists into one call per value, and writes `// Edits painted in the studio.` before the first edits line. `theme`, `area`, `level`, `start` and `arena` emit no call; `start` and `arena` go into `b.out(...)`.
- **The rasteriser runs the statements in file order on a grid**, as the `Builder` does, including the ground height that `crystal`, `pogo-cache` and ground-based enemies read. It ignores `theme`, `area` and the `arena` bounds, and draws a room as facade tiles only.
- **Generated Rust must sit inside `levels.rs` or a child module that starts with `use super::*;`**, because `Builder` and `Seg` are private to that module. The proof copy includes the generated files from child modules with `include!`.

## 4. Where the game owns rules

| Concern | Owner | How the studio gets it |
| --- | --- | --- |
| What a statement builds | The game's `Builder` | Proven equal to the TypeScript rasteriser on all 16 levels; the exported Rust calls the `Builder` itself |
| Tile ids and names | `tiles.rs` | Copied into `tables.ts`; the verifiers read `tiles.rs` to map ids |
| Item and spawn kinds | `ents.rs` | Copied into `tables.ts` |
| Level ids, themes, areas | `LEVELS` in `levels.rs` | Copied into `LEVEL_IDS`, `THEMES`, `AREAS` in `tables.ts` |
| Overworld scatter rates and roll | `area_theme` and `hashf` (`lf_sim::hashf`) | Copied into `SCATTER_RATES` and `hashf` in `overworld.ts`; proven tree for tree |
| Fingerprint | `LevelData::fingerprint` (FNV-1a over id, area, size, tiles, switches, floor flag, spawns, items, platforms, start, arena, rooms) | Rust proof; a WebAssembly export `level_hash(id)` exists for built-in levels |
| How enemies move | `world.rs` | Not available; must be exported (ENGINE-CHANGES E8) |
| Whether a level can be finished | `playtest.rs` (beam search over input macros through the real `World`) | Test-only today; must be exported (E9) |
| Sprite names | `SPRITE_NAMES` in `sprites.rs`, exported as name table 0 | Not used by the studio yet (E10) |

The gap check in `world.ts` (`findGaps`) and the prototype's Gaps lens apply a stated design rule (3, 4, 5 or more) to the grid; they are not checked against the jump physics and are labelled that way. The prototype's Reach lens is a rough three-tile box and is labelled a rough guide.

## 5. The game host

The desktop app links the games' own Rust and runs it natively, on worker threads, behind one `GameHost` trait in `fizz-studio-host` with an implementation per game (D59). Results stream to the webview over Tauri `Channel`s; nothing about a game's rules runs in the webview.

| Need | Fizz 1 (links `lf-sim` and `lf-episode-1`) | Fizz 2 (links `fizz-ep2`, `fizz-slice-view` and the presenter crates) |
| --- | --- | --- |
| Open a built-in or Rust-written level by its data | A public API returning a level's `LevelData` (E6), the fields `dump_all_truth` writes as JSON today | The `LEVL` section through `fizz-pack`'s `LevelView` |
| Build a level from a script, unsaved | A builder-op stream run on the real `Builder` (E7) | Bake in memory with `fizz-bake`'s library and build the world with `world_from_view` (F4, F6) |
| Draw it as the game does | Not needed: Fizz 1 levels use the flat view | A public draw call into an indexed frame for any level and the world's art (F5), streamed with its palette |
| Enemy paths | A trace of one enemy with Ben out of reach (E8) | The same, from the stepped world |
| Rules and behaviours | — | Rule previews and the behaviour debugger's per-tick inspection (F21) |
| Playtest | `playtest::solve` behind a feature, stepped in slices (E9) | The playtest bot when Fizz 2 has one |
| Names | The game's name tables (E11) | The content export (F2) |

Why a builder-op stream rather than the rasteriser's grid for a Fizz 1 preview: the op stream is run by the game's own `Builder`, so a script previewed in the studio is built by the same code that the exported Rust calls, and the fingerprint the studio shows is the game's. The rasteriser stays as a fast picture for drawing and for Claude's text view, checked against the game by the proofs.

The prototype's Paths lens (`walkExtent` in `Proto.dc.html`: a gloop turns at a wall or where the ground ends, a marsh only at walls, a drone flies a 2.6 × 1.4 tile oval, a hopper reacts inside 10 tiles across and 4 up or down) is the design reference for what the lens shows. The real lens draws the positions the host's trace returns.

The game's WebAssembly exports (`game_new`, `enter_level(id)`, `step(held)` and the rest in `episodes/episode-1/game/src/lib.rs`) are the game's own web build; the studio does not use them, and the exports once planned for it (E6 to E9 as C-ABI functions) are needed only if a web build of the studio ever returns, which is out of scope (D54).

## 6. File layout

Today:

```text
fizz-level-studio/
  spec/                      the product spec (README.md, REQUIREMENTS.md) and its companion documents
  README.md                  where to start, commands
  package.json               test, test:mcp, prove, prove:all scripts
  docs/                      decisions, roadmap, engine changes, testing, questions and risks
  packages/
    language/src/            parser, printer, edits, rust, overworld, docs, tables, errors, args, cli
    language/test/           8 test files, 76 tests
    mcp/src/                 server, tools, studio, world, schema, cli
    mcp/test/                studio.test.ts, e2e.test.ts (21 tests)
  levels/crater.fizz         Crater Fields, hand-written, call for call with crater()
  levels/real/*.fizz         all 16 levels, written as fills by tools/decompile-level.ts (crater included)
  overworlds/main.fizz       the Episode 1 overworld, with paths and scatter
  tools/                     proof generators, verifiers, audits, decompiler, data generators
  tools/design-harness/      Playwright suites for the design pages
  scripts/                   prove-crater.sh, prove-all.sh
  scratch/kitchen-sink.fizz  each v0 statement once
  scratch/rust/              copy of the game's crates where the proofs run
  scratch/truth/             the game's data as JSON, written by the dump tests
  design/                    copy of the published design canvas
```

For the desktop app, the repository moves to the Liminal HQ layout of [DESKTOP.md](DESKTOP.md) section 3 (`apps/studio`, `crates/fizz-studio-*`, `plugins/*`, `packages/chrome`, `packages/protocol`, `spec/`), with the TypeScript packages kept as the reference until the Rust port matches (D56), and, in the game repository, generated level and overworld functions under a child module of `levels.rs` (for example `episodes/episode-1/game/src/levels/generated/`) so they can reach the private `Builder`, with the proof tests beside them.

## 7. Fizz 2 and the baker (planned)

Lieutenant Fizz 2 bakes its levels from `.fizz` sources in its own repository. None of this is built here; it fixes who owns what so the editor does not grow a second copy of the game's rules.

```text
 level.fizz  (script fizz2 0, checked against a target profile)
      │
      ├── editor (Rust crates, D55: fizz-script and the Fizz 1 port): lossless parse, print, completion, live checks
      │
      └── fizz-bake (Fizz 2 repository, Rust)
            fizz-script : parse → resolve → validate → lint → lower
            LEVL 2      : header, name, states, bindings, objects, rules, strings, tiles
            LIGHT.FAP   : the world's pack; manifests and digests reviewable as text
            dump        : disassembly of objects and rule records
```

- **The baker is the authority.** `fizz-script` and `fizz-bake` decide what a Fizz 2 script means and what it bakes to. The editor's parser must agree with them on the dialect's grammar, its error codes and its positions.
- **One parser for Fizz 2.** The desktop app links `fizz-script` natively (D55), so the studio and the baker share one parser and the old question of a second TypeScript parser or a WebAssembly build of `fizz-script` falls away. A corpus of golden scripts still belongs in both repositories' tests, because the studio adds owned-line rewrites and completion on top of the parser.
- **Rules are data.** A `when ... then ...` rule becomes a fixed 32-byte record at bake time. There is no VM on DOS and no rule text on the device, so the editor shows rules from the source and, in the dump view, from the records.
- **Digests and manifests.** The pack's manifest and digest include the rule records and the decompiled lines, so a change to a rule shows in review as text. The editor does not compute them; it can show them.
- **What exists in the Fizz 2 repository.** The `LEVL` data model is built and tested (`crates/fizz-pack`, `crates/fizz-ep2`; rules, strings and locks on the unmerged #137, #138 and #140). `fizz-script`, `fizz-bake`, the dialect's grammar and the packs are plans. So the record layout is a fact the editor can rely on, and the syntax is a proposal (`LANGUAGE.md`).
- **The compatibility number.** A world pack carries a number derived from the schema and the game's content tables (tile properties, ids, snack kinds, key colours, cue ids, styles, the rules' semantics). A change to any of them makes old packs refuse to load, which is why the editor reads those tables from the target profile and never assumes them.
- **Target profiles.** Each level is bound at creation to a profile (`fizz1`, `ep2`, later `ep3`): the dialect versions it accepts, its content tables, limits, budgets, the lints' physics parameters and a capability state per feature. Profiles are data generated from each game's own tables (ENGINE-CHANGES E11 and F2). The Fizz 1 export is a lowering plus the lossy check inside the language package; Convert to Fizz 2 writes a new level.
- **World projects.** A Fizz 2 level lives in a world project whose levels, definitions, sprites, panels, sounds and strings `fizz-bake` builds into one world pack ([WORLD.md](WORLD.md)). The studio runs the baker; it never writes pack bytes.
- **Behaviours.** Custom enemies and items are compiled to bytecode and run by the game's interpreter; the studio's behaviour editor, preview and debugger drive that interpreter natively through the game host ([SCRIPTING.md](SCRIPTING.md)).
- **The game's look.** The oblique ground, the parallax panels, the sky and the lights are drawn by Fizz 2's presenter crates; a Fizz 2 level's canvas is that drawing, made natively by the game host through a public draw call (F5) and streamed to the webview over a `Channel`, and the editor never redraws it in TypeScript.
- **Sprites.** Fizz 2's sprites are JSON grids in its `assets/sprites/`; the editor reads them for drawing and edits only `drawn` sets, writing canonically. Sprites reach packs through `fizz-bake`, not through the editor.
