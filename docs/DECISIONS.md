# Decisions

The decisions taken for Fizz Level Studio by its owner, Scott Morris, each with the reason and the alternative set aside. Where the reason was not recorded beyond the choice itself, the entry says so.

| # | Decision | Reason | Set aside |
| --- | --- | --- | --- |
| D1 | Levels get their own text **builder language** that compiles to the game's Rust `Builder` calls | A level becomes something a person, the studio and Claude can all read and write, and the Rust it produces is the same calls a hand-written level makes, so it can be proven equal to the game | Editing a binary or JSON level format; generating Rust directly from the editor's grid |
| D2 | **Statements run in file order**; sections are labels and never reorder | The `Builder` is order-dependent: `fill` overwrites, items and spawns append to ordered lists that the fingerprint hashes, and `crystal`, ground-based enemies and `pogo-cache` read the ground that earlier terrain recorded | A fixed section order (terrain, then blocks, then treats), as the first sketch implied |
| D3 | **y counts up from the bottom**; row 0 is the bottom | It is the `Builder`'s and the game's convention, so a script's numbers are the numbers in `levels.rs` | Screen order (y down), which would need converting on every export |
| D4 | **Items sit at the middle of a whole block** | `Builder::item` stores an item at the cell centre (`x + 0.5`), so a script names the cell | Writing the centre (36.5) in scripts |
| D5 | **Fractional treat positions: not now** | Every item in all 16 Episode 1 levels sits on a cell centre (`tools/verify-rasteriser.ts` agrees on every item at cell + 0.5) | A fractional `place` |
| D6 | The `level` line carries **`id=`**; `theme` and `area` are optional and checked | `Builder::out(id, ...)` takes the theme and area from the `LEVELS` table by id, so a script's own theme and area cannot drive anything | `theme` and `area` as the source, as the first sketch had |
| D7 | `row ITEM x=A..B y=N [by=S]` | `Builder::row(kind, x0, n, y, step)` is a start, a count, a row and a step; a range with a step says the same thing in coordinates | Exposing the five raw numbers |
| D8 | **Claude proposes by default** (ghost changes the person accepts); **direct edit** is a switch that is the person's to turn on | The person stays in control of what lands in a level; direct editing is for drafts | Claude editing directly by default; Claude choosing its own mode |
| D9 | **Accept and reject are CLI-only** on the MCP server (standing in for the studio's buttons) | If accept were a tool, Claude could accept its own proposals | Accept and reject as MCP tools |
| D10 | **Tiles and objects are different**: tiles are painted and appended to `edits`; objects (lifts, rooms, the boss arena, switch channels, and overworld points) are one line each that **the studio owns and rewrites in place**; hand-written lines the studio did not touch are never rewritten | Appending a second `hover` line every time a lift moves would leave two lifts; rewriting only the lines the studio owns keeps hand-written text intact | Appending every object change; rewriting any line the studio understands |
| D11 | **Both authoring paths stay**: a level can be a script that exports to Rust, or hand-written procedural Rust that the editor opens by reading its data | Several Episode 1 levels compute positions with loops, closures and `b.ground_at(...)`, which a flat script cannot say; forcing them into scripts would lose the procedure | Scripts only; Rust only |
| D12 | **Generated and procedural statements stay** in the language beside painted fills (terrain runs, `scatter`, `path`, `pogo-cache`, ladders, stairs) | A script that says `flat 14, up 2` or `scatter` reads as the level's design; the decompiled fill scripts prove the language can say any level, not that they read well | Fills only, as `tools/decompile-level.ts` writes |
| D13 | **Overworlds are scripts too** (`overworld "Name" WxH id=...`), there can be more than one, and hand painting compiles to Rust through an `OverworldBuilder` | The overworld needs the same review and proof as a level; it is proven to rebuild `build_overworld()` exactly | Keeping the overworld as hand-written Rust only |
| D14 | Teleporters are **named** and paired with `with=` | The game pairs teleporters by index in the point list, which changes whenever a point is added; names survive edits and the exporter computes the indices | Writing indices in scripts |
| D15 | **The overworld designer is the next big feature**: level points, unlock rules, teleporters, and later level sprites | Owner's priority; the overworld model is proven and adding a level needs it | Building out level editing first |
| D16 | Enemy **walking paths** are shown by a lens; the prototype computes them in JavaScript as a reference; **the real version asks the game's WebAssembly** | The game's rule is that the Rust crate owns the simulation and TypeScript never re-derives its rules; a JavaScript copy would drift and is already approximate on slopes | Shipping the JavaScript rule |
| D17 | **Code completion** with the whole language documented, driven by `packages/language/src/docs.ts`, with a test that keeps it complete | One source for completion, the manual and `list_kinds`, so none of them can miss a word | Hand-written completion lists in the editor |
| D18 | The **Ultimate** layout is the home layout: the level is the canvas, every panel floats, snaps and resizes | It blends the H4, H5 and H6 workspace iterations ("the level is the background, every panel floats, snaps and resizes") with the Liminal desktop chrome | Layouts A (workbench), B (canvas first), C (script first), D (conversation first), E (floating panels), F (side-by-side split), G (layered overlay), H and H1 to H6 |
| D19 | The **line park (logo 28)** is the logo direction: one circle holding a chocolate river, three crystals, a candy tree and the flag, in a single gradient line | Not recorded beyond the owner's choice | The other logo explorations in `Logos*.dc.html` (Ben in the rising-fizz style, the planet variations, crystals, rivers and trees) |
| D20 | `crystal` is a blocks statement (`b.crys(x)`, a decorative tile on the ground), distinct from the `crystal-switch` enemy | That is what `b.crys` is | `crystal` as an enemy, as the first sketch had |
| D21 | Coordinates outside the level are refused (E013) | The `Builder` silently ignores out-of-range writes, so a typo would vanish | Accepting them as the `Builder` does |
| D22 | `.fizz` is a **superset of the Fizz 1 script** for Fizz 2, with first line `script fizz2 0`; every Fizz 1 script parses and prints, and only the Fizz 2 subset lowers | One language for both games; the editor and the Fizz 2 baker read the same files | A separate Fizz 2 language |
| D23 | The Fizz 2 parser lives in its own reusable `std` crate, `fizz-script`, called by `fizz-bake`; the slice pack is `LIGHT.FAP` | The baker and any other host tool share one parser | Parsing inside `fizz-bake` only |
| D24 | `x=`/`y=` name a cell centre and `at=` is exact; the printer writes `x=`/`y=` only for an exact cell centre | A position has one printed form | Writing `at=` everywhere, or `x=`/`y=` with fractions |
| D25 | Objects are **stably sorted by kind**, `id=` is required, and an object's index is its sorted position | Indices stay stable across edits and the printer's output is canonical | File-order objects without ids |
| D26 | The legend is the **most complete** one, including slope letters and reserved letters for Fizz 1 tiles that have no Fizz 2 id | A Fizz 1 level opens in Fizz 2 without losing tiles | A minimal legend that grows as needed |
| D27 | Error codes **E001 to E016 are reused** and new ones are **E1xx**, all reported as `path:line:col`; lints are W1xx | Existing messages, tests and habits carry over | Renumbering |
| D28 | **Channels are state; switched tiles read a channel; keys and items are facts; locks sit on the door; a `when ... then ...` rule layer connects them**, compiled at bake time into fixed rule records with **no VM and no rule text on DOS** | The DOS build stays small and deterministic, and a door is described by what it reads | Hard-wired red and blue doors; a scripting VM |
| D29 | The start state is **explicit** (`channel 1,2 on`), and **W101** warns when a door channel starts off, silenced by `allow W101` | A door that starts open is usually a mistake, and sometimes a puzzle | Defaulting silently |
| D30 | The editor has a **Target** setting (Fizz 1 or Fizz 2) that greys out what Fizz 1 lacks and runs the **Fizz 1 export check** (E120 to E122, W104) | One editor for both games, with no silent loss on export | Two editors; exporting without a check |
| D31 | The rule layer is built in the Fizz 2 work's second milestone, not deferred | The slice's door puzzle needs it | Deferring rules |

## Decisions log

### 2026-10-30 — The Fizz 2 dialect and the rule layer

The owner approved the Fizz 2 plan for level source, the rule layer and the baker. D22 to D31 above are its decisions that touch this studio. In short:

- `.fizz` is a superset of the Fizz 1 script (`script fizz2 0`); Fizz 1 export is a lowering plus a check, with `at=` snapping reported as W104, `chicken` becoming `gloop`, non-standard locks as E120, any `when` as E121 and a solid `floor` as E122.
- Positions: `x=`/`y=` for a cell centre, `at=` for exact, printed by one rule; objects sorted by kind with a required `id=`; the legend includes slopes and reserved Fizz 1 letters.
- The door model is channels, locks and a `when ... then ...` rule layer compiled into 32-byte records at bake time, with no VM on DOS. The baker is `fizz-script` plus `fizz-bake` in the Fizz 2 repository, and the first pack is `LIGHT.FAP`.

**Not decided yet.** The planner's open questions, with its recommendations, are awaiting the owner:

1. A conditional hash step for trigger rules only (recommended yes).
2. Channels and fired-rule bits persisting over a death (recommended yes).
3. W101 silenced by `allow W101` with a comment (recommended yes).
4. The slice gaining the door puzzle (recommended yes).
5. The limits: 32 rules, 32-byte records, two action slots.
6. Captions: shared-table ids only at first.
7. One directory per world, `assets/levels/light/`.
8. Bumping `LEVL` to v2 (recommended).
9. All of the Fizz 1 language parses and prints, only the Fizz 2 subset lowers.
10. The W1xx family, with `bake check` failing on any warning without an `allow`.
11. A lock opens (its channel goes off) and fires only while closed.
12. No delayed actions or repeating timers at first.

The editor's own open questions follow from these: whether it keeps a TypeScript parser or loads `fizz-script` as WebAssembly (and the conformance corpus either way), which letters mean which tiles in the legend, how the editor should refuse a shaft that only a wall-kick could climb, and where the E1xx and W1xx codes beyond those named are assigned.
