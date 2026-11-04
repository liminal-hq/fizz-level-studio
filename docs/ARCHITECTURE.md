# Architecture

How Fizz Level Studio is put together: the packages, how a script flows through them, where the game owns the rules, the WebAssembly plan for enemy paths and playtests, and the file layout.

## 1. Principles

- **The game owns the simulation.** Deterministic rules (physics, collision, enemy behaviour, timing) live in Rust in the game (`crates/sim`, `episodes/episode-1/game`) behind a raw C-ABI WebAssembly export surface with no `wasm-bindgen`. The studio's TypeScript draws and edits; it never re-derives a simulation rule. This is the game repository's own rule (`CLAUDE.md`, `docs/ENGINE_SPEC.md` §4.1) carried into the studio.
- **The script is the source.** A level or overworld is a `.fizz` text file. The canvas, Claude's view and the exported Rust are all derived from it.
- **The `Builder` is the semantics.** The language is a thin skin over the private `Builder` in `episodes/episode-1/game/src/levels.rs`. Where a design idea disagreed with the `Builder`, the `Builder` won (`docs/LANGUAGE.md`, "Changes from the sketch").
- **Prove against the game's own data.** Every claim of equality is checked by building the real thing and comparing, not by reading code.

## 2. Packages

| Package | Path | Entry points | Depends on |
| --- | --- | --- | --- |
| Language | `packages/language/src` | `parse`, `parseOrThrow` (`parser.ts`); `print`, `formatNode` (`printer.ts`); `appendEdits` (`edits.ts`); `toRust` (`rust.ts`); `isOverworld`, `parseOverworld`, `printOverworld`, `rasteriseOverworld`, `overworldToRust`, `hashf`, `SCATTER_RATES` (`overworld.ts`); `DOCS`, `docsFor`, `FIELD_NOTES`, `TILE_NOTES` (`docs.ts`); name tables (`tables.ts`); `FizzErrors`, `formatError` (`errors.ts`); the `check` and `export` CLI (`cli.ts`) | Nothing |
| MCP server | `packages/mcp/src` | `server.ts` (stdio server), `tools.ts` (the nine tools), `studio.ts` (file, sidecar, proposals, accept, reject, undo), `world.ts` (level rasteriser, glyph rendering, gap check), `schema.ts` (input checker), `cli.ts` (the person's command line) | Language; `@modelcontextprotocol/sdk` ^1.32.1 |
| Tools | `tools/` | Proof generators, verifiers, audits, the decompiler, the prototype data generators, the design harness | Language, MCP (`world.ts`) |
| Proof copy | `scratch/rust/` | A Cargo workspace copied from the game, plus the generated functions and proof tests | The game's crates |
| Fizz 2 dialect and target profiles | not built | Planned: the dialect, the target profiles and their capability states, the Fizz 1 export check and Convert to Fizz 2, in `packages/language`; the profiles as generated data files | Language |
| Design prototype | `design/project/` | `Proto.dc.html` and the other canvas pages | `levels-data.js`, `lang-docs.js` (generated) |
| Studio app | not built | | Language, MCP, the game's WebAssembly |

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

## 5. The WebAssembly boundary

The game is one WebAssembly module with a single `World` held in a static, and exports such as `game_new`, `enter_level(id)`, `enter_map`, `step(held)`, `state_get(i)`, `state_set(i, v)`, `level_hash(id)`, `area_of(x, y)`, the name tables (`table_len`, `name_ptr`, `name_len`) and buffer pointers for instances, lights and events (`episodes/episode-1/game/src/lib.rs`). The studio talks to the same module, in a Web Worker so a long search never blocks the canvas, and adds the exports below (detail in [ENGINE-CHANGES.md](ENGINE-CHANGES.md)).

| Need | Export (proposed) | Shape |
| --- | --- | --- |
| Open a built-in or Rust-written level by its data | `level_dump(id)` → pointer and length of a serialised `LevelData` | Tiles, switches, floor flag, spawns, items, platforms, start, arena, rooms — the fields `dump_all_truth` writes as JSON today |
| Build a level from a script, unsaved | `load_ops(ptr, len)` then `enter_loaded()` | A builder-op stream: one op per `Builder` call the exporter would write, run by the real `Builder` |
| Enemy paths | `trace_enemy(index, ticks)` → a buffer of positions | The real `World` stepped with Ben out of reach and only that enemy live, recording where it goes |
| Playtest | `playtest_begin(route, options)`, `playtest_step(budget)` → done flag, `playtest_result()` | `playtest::solve` driven in slices so the worker can report progress and stop |
| Names | existing `table_len(t)`, `name_ptr`, `name_len`, plus tables for tiles, items, kinds and level ids | So `tables.ts` can be checked or generated |

Why a builder-op stream rather than shipping the rasteriser's grid into the sim: the op stream is run by the game's own `Builder`, so a script previewed in the studio is built by the same code that the exported Rust calls, and the fingerprint the studio shows is the game's. The rasteriser stays as a fast picture for drawing and for Claude's text view, checked against the game by `tools/verify-rasteriser.ts`.

The prototype's Paths lens (`walkExtent` in `Proto.dc.html`: a gloop turns at a wall or where the ground ends, a marsh only at walls, a drone flies a 2.6 × 1.4 tile oval, a hopper reacts inside 10 tiles across and 4 up or down) is the design reference for what the lens shows. The real lens draws the positions `trace_enemy` returns.

## 6. File layout

Today:

```text
fizz-level-studio/
  SPEC.md                    the product spec
  README.md                  where to start, commands
  package.json               test, test:mcp, prove, prove:all scripts
  docs/                      LANGUAGE.md and the spec's companion documents
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

For the real studio, the proposal is to keep the two packages, move the level rasteriser into the language package, and add:

```text
  packages/studio/           the app (canvas, windows, tools, objects, lenses, history)
  packages/wasm-bridge/      the worker that loads the game's module and wraps the new exports
```

and, in the game repository, generated level and overworld functions under a child module of `levels.rs` (for example `episodes/episode-1/game/src/levels/generated/`) so they can reach the private `Builder`, with the proof tests beside them.

## 7. Fizz 2 and the baker (planned)

Lieutenant Fizz 2 bakes its levels from `.fizz` sources in its own repository. None of this is built here; it fixes who owns what so the editor does not grow a second copy of the game's rules.

```text
 level.fizz  (script fizz2 0, checked against a target profile)
      │
      ├── editor (packages/language, TypeScript): lossless parse, print, completion, live checks
      │
      └── fizz-bake (Fizz 2 repository, Rust)
            fizz-script : parse → resolve → validate → lint → lower
            LEVL        : header, name, objects, rules (up to 32), strings (up to 32), tiles; section version 1
            LIGHT.FAP   : the world's pack; manifests and digests reviewable as text
            dump        : disassembly of objects and rule records
```

- **The baker is the authority.** `fizz-script` and `fizz-bake` decide what a Fizz 2 script means and what it bakes to. The editor's parser must agree with them on the dialect's grammar, its error codes and its positions.
- **Two parsers is the risk.** The language package is TypeScript and `fizz-script` is Rust. The options (a shared conformance corpus of scripts with expected codes and printed output, or loading `fizz-script` through WebAssembly as the Paths lens will load the sim) are not decided; see the open questions in [DECISIONS.md](DECISIONS.md). Either way, a corpus of golden scripts belongs in both repositories' tests.
- **Rules are data.** A `when ... then ...` rule becomes a fixed 32-byte record at bake time. There is no VM on DOS and no rule text on the device, so the editor shows rules from the source and, in the dump view, from the records.
- **Digests and manifests.** The pack's manifest and digest include the rule records and the decompiled lines, so a change to a rule shows in review as text. The editor does not compute them; it can show them.
- **What exists in the Fizz 2 repository.** The `LEVL` data model is built and tested (`crates/fizz-pack`, `crates/fizz-ep2`; rules, strings and locks on the unmerged #137, #138 and #140). `fizz-script`, `fizz-bake`, the dialect's grammar and the packs are plans. So the record layout is a fact the editor can rely on, and the syntax is a proposal (`LANGUAGE.md`).
- **The compatibility number.** A world pack carries a number derived from the schema and the game's content tables (tile properties, ids, snack kinds, key colours, cue ids, styles, the rules' semantics). A change to any of them makes old packs refuse to load, which is why the editor reads those tables from the target profile and never assumes them.
- **Target profiles.** The editor keeps one script and a Target that names a profile (`fizz1`, `ep2`, later `ep3`): the dialect versions it accepts, its content tables, limits, budgets, the lints' physics parameters and a capability state per feature. Profiles are data generated from each game's own tables (ENGINE-CHANGES E11 and F2). The Fizz 1 export is a lowering plus a check inside the language package; Convert to Fizz 2 goes the other way.
- **The game's look.** The oblique ground, parallax, the sky and night lights are drawn by Fizz 2's presenter crates; the editor shows them through a WebAssembly draw export (F5) in a worker, beside the Paths lens and the playtest bot, and never redraws them in TypeScript.
- **Sprites.** Fizz 2's sprites are JSON grids in its `assets/sprites/`; the editor reads them for drawing and edits only `drawn` sets, writing canonically. Sprites reach packs through `fizz-bake`, not through the editor.
