# Fizz 2 coverage

Every Lieutenant Fizz 2 feature, concept and open change that a level author has to control, set against where the studio's documents handle it. **Status** is how well the studio's documents covered the feature before they were brought up to date with the Fizz 2 repository on 2026-11-04: **Covered**, **Partial** (named, but wrong, thin or missing what the author sets) or **Missing**. **Action** is what was done about it and where it now lives. Nothing here is built in the studio. A second pass on the same day applied the owner's decisions (D42 to D53); the rows they changed say so, and the features they added are in [Added by the owner's decisions](#added-by-the-owners-decisions).

## Sources

The Fizz 2 repository (`~/source/experiments/fizz-2`) was read on `main` at `ba1ec8e` and on its open pull requests. Anything taken from an unmerged pull request is **provisional**: it may change before it merges, and the studio's documents mark it so.

| Change | State on 2026-11-04 | Commits |
| --- | --- | --- |
| `main` | `docs/ARCHITECTURE.md`, `FAP.md`, `SPRITES.md`, `PLATFORM.md`, `FIZZ1-DIFFERENCES.md`, `MANUAL.md`, `LORE.md`, `SCENE-CONTRACT.md`; `crates/fizz-ep2`, `crates/fizz-pack`; `tools/progress-report/roadmap.json` | `ba1ec8e` |
| #137 Build the slice world from level data | Open | `d3499ed` |
| #138 Carry rules and strings in the `LEVL` section | Open, stacked on #137 | `c64c103` |
| #140 Make locks and the death reset level data | Open, stacked on #138 | `eb9b1db`, `fa1872c` |
| #142 Specify the oblique ground for the demo level (`docs/OBLIQUE.md`) | Open | `1d11d76`, `c3a4da7`, `6c2216a` |
| #143 Draw the ground in oblique projection | Open, stacked on #142 | `0cfc9ef`, `b7b9842` and others |
| #144 Draw the Lighthouse night behind open air with parallax layers | Open, stacked on #143 | `da0c0de`, `84b68de`, `9bd8fd3` |
| #145 Make the exit a doorway Ben enters with Up | Open, stacked on #144 | `6ec369a`, `a1b0b06` |
| #146 Add a night mode with palette banks and dynamic lights (`docs/LIGHTS.md`) | Open, stacked on #145 | `1407255`, `16c94c8`, `e10186c` |
| `trial/lab-ben-sprites` Ben sprites from the pose workshop and a taller body | A trial branch, "not for merge", on top of #140 | `7b948ae` |
| #141 A descending slide-whistle for Ben's fall | An open issue, not a pull request; needs a new cue id | — |

Not found anywhere in that repository: a `fizz-script` crate, a `fizz-bake` tool, a `.fizz` file, the `script fizz2 0` line, any E1xx or W1xx code, `when ... then ...` syntax, object ids, a `legend`, an overworld, or a level or theme format. They are plans (the studio's earlier documents and `docs/FAP.md`, "The baker").

## Level data

| Feature | Source in Fizz 2 | Studio doc and section | Status | Action taken |
| --- | --- | --- | --- | --- |
| `LEVL` header: size, name (48 bytes), start, `floor_solid`, `switches` | `docs/FAP.md` `LEVL`; `crates/fizz-pack/src/level.rs` | `LANGUAGE.md` "What a Fizz 2 level holds", "The header" | Partial: called "LEVL v2", `floor` listed as an object | Corrected, then decided: `LEVL` goes to version 2 and version 1 is dropped (D43, F10); `floor solid` is a header word |
| Section length formula and record order (header, name, objects, rules, strings, tiles) | `docs/FAP.md` on #138 | `LANGUAGE.md` "What a Fizz 2 level holds"; `EDITOR.md` "Budgets" | Missing | Added, with the meter labelled an estimate unless `fizz-bake` supplies it |
| Tile ids and the slice's letters `. w # B = ^ D b E` | `crates/fizz-ep2/src/tiles.rs`, `level.rs` | `LANGUAGE.md` "The map block" | Partial: letters listed, meanings deferred | Added the legend with ids; recorded that ids are shared with Fizz 1; letters for `CHOC` and the slopes proposed and left open (Q11) |
| Textures chosen by letter and neighbours | `docs/OBLIQUE.md` (#142) | `LANGUAGE.md` "The map block" | Missing | Added: choosing `#` or `B` chooses the look |
| Objects: red key, blue key, snack (cheezie, choc, cookie, soda can), chicken | `docs/FAP.md` object kinds; `world.rs` | `LANGUAGE.md` "Objects" | Partial: no kinds, subs or limits | Added the kind and `sub` table, one key per colour, kinds 5 to 7 reserved |
| Object ids | None: records have no id; rules use indices (#138) | `LANGUAGE.md` "Objects"; `DECISIONS.md` D25 | Partial: "index is its sorted position" without saying rules depend on it | `id=` kept as a source name resolved to an index; renaming rewrites rules; the editor refuses reordering |
| Kind order and construction order | `SourceError::KindOrder` (#137); the state hash indexes by position | `LANGUAGE.md` "Objects" | Covered | Cited the source |
| What an object's point means (centre, chicken spawn, Ben's lower-left corner) | `level.rs` constants | `LANGUAGE.md` "Positions" | Missing | Added; the Inspector says which |
| Doors as switched tiles on fixed channels | `tiles.rs` (channels 1 and 2) | `LANGUAGE.md` "Locks" | Partial | Doors bind to a named state with `door ... state= open=` (D42, F11) |
| Lock as a rule record (key colour, channel, event cell) | #140 | `LANGUAGE.md` "Locks"; `EDITOR.md` 13 | Partial: `lock red-door key=red` with no cell, lock missing from the trigger list | Reframed: states with rules, `lock` as sugar that expands exactly (D42); Fizz 2's key-colour lock is a gap, F11 |
| Rule records: trigger, flags, guard, subject, rectangle or time, delay, two slots | #138 | `LANGUAGE.md` "Rules" | Partial: no delay, no time fields, no cells, "no repeating timers" contradicted by the record | Rebuilt as inputs, two conditions and two actions per rule over named states (D42, F10, F11; Q23, Q24) |
| Only locks run today | `RuleError::Trigger` (#140) | `LANGUAGE.md` "Rules"; matrix | Missing | W106 and the "accepted" capability state until F11 |
| Effects and shared captions by id | `crates/fizz-ep2/src/cues.rs` (#140) | `LANGUAGE.md` "Rules"; `EDITOR.md` cue pickers | Partial: "the shared tables only" | Named lists from the game; E116 |
| Level strings (32, 1 to 30 bytes, seven styles) | #138 | `LANGUAGE.md` "Rules"; `EDITOR.md` Strings tab | Missing | `string NAME "text" style=`; E112, W107 |
| Limits: 32 rules, 32 strings, channels 0 to 31 | `MAX_RULES`, `MAX_STRINGS`, `MAX_CHANNELS` | `LANGUAGE.md`; `EDITOR.md` "Budgets" | Partial (rules only) | All limits with codes E111 to E113 and meters |
| Channel start state is level data | #140 | `LANGUAGE.md` "The header" | Covered | Cited |
| Death reset: channels, keys, snacks and cans, ammo, chickens; rules re-arm | #140; Fizz 2 `docs/FIZZ1-DIFFERENCES.md` | `LANGUAGE.md` "Rules"; `DECISIONS.md` | Partial: listed as an open question with "persist (recommended)" | Recorded as D33; states reset to their start values |
| Level digest and the pack compatibility number | `fizz_ep2::level::digest`; `pack_content()` | `TESTING.md` section 7; `ARCHITECTURE.md` section 7 | Missing | Digest parity test; the compatibility number explained as why a cue id or tile change invalidates packs |
| `fizz-bake` commands, manifests, `file:line:col` errors | `docs/FAP.md` "The baker" | `ARCHITECTURE.md` 7; `ENGINE-CHANGES.md` | Partial | Kept; noted the baker and parser are plans, not code |

## Movement and rules that diverge from Fizz 1

| Feature | Source in Fizz 2 | Studio doc and section | Status | Action taken |
| --- | --- | --- | --- | --- |
| No wall-kick | `docs/FIZZ1-DIFFERENCES.md` (owner, 2026-10-30) | `SPEC.md` Q13 | Partial: an open question only | Reversed by the owner: a core Fizz 2 mechanic, always on (D47, F9); W103 now checks Fizz 1 levels (Q26) |
| Exit entered with a fresh Up press while standing | #145 | `LANGUAGE.md`; `EDITOR.md` Exit lens | Missing | W102, W110, the Exit lens |
| Ben's body 0.7 by 1.4, 0.8 by 2.0 on the trial | `ben.rs`; `7b948ae` | `EDITOR.md` Head room lens; `LANGUAGE.md` W105 | Missing | Body size as a profile parameter; W105 and a two-size comparison |
| Ladders, vines, mantle, lifts, conveyors not ported | `docs/PLATFORM.md` "Departures" | Capability matrix | Missing | E102 rows in the matrix |
| Ammo restarts at five on a respawn | `docs/FIZZ1-DIFFERENCES.md` | Capability matrix | Missing | Noted; no level field |
| Roadmap says wall-kick "comes first" in M3.5 while the differences page says it is left out | `roadmap.json` `wallkick`; `FIZZ1-DIFFERENCES.md` | `SPEC.md` §11 | Missing | Resolved by D47 (Q16); F9 asks the Fizz 2 repository to change its page and roadmap |

## The look: theme, projection, parallax, night, lights

| Feature | Source in Fizz 2 | Studio doc and section | Status | Action taken |
| --- | --- | --- | --- | --- |
| Oblique ground (global projection, faces from neighbours) | `docs/OBLIQUE.md` (#142, #143) | `EDITOR.md` "Previews" | Missing | Game view drawn by the game's presenter, linked natively in the game host; never reimplemented |
| Theme chooses back wall and parallax stack | `docs/OBLIQUE.md` "Backgrounds and parallax" (#144) | `LANGUAGE.md` "Theme, look and lights" | Missing | The theme is the world's with a level override; `theme` reserved until F3 |
| Parallax layers and factors; Sky setting Full, Light, Auto | `crates/fizz-view/src/parallax.rs`; `FIZZ2.CFG` (#144) | `EDITOR.md` "Previews" | Missing | Bitmap panels imported or painted, packed in `BDRP` (D52, F19); Sky stays a player setting |
| Night mode, palette banks, dynamic lights | `docs/LIGHTS.md`; `light.rs` (#146) | `EDITOR.md` "Previews"; `LANGUAGE.md` | Missing | Night stays a player setting; lights are placed objects (D44, F12) with the light meters |
| Lights derived from objects (doors, exit, Ben, shots) | #146 | `LANGUAGE.md` "Theme, look and lights" | Missing | No authoring needed; recorded |
| Animated tiles (conveyors, gates, glowing exits) | `roadmap.json` `anim-tiles` (planned) | Capability matrix | Missing | Absent rows; follows the profile when it lands |
| Backdrops (`BDRP`) | `docs/FAP.md` (not specified) | `EDITOR.md` 14 "How sprites reach a pack" | Missing | Recorded as unknown |
| Music per level | None | `LANGUAGE.md` `music` | Missing | Reserved (W109) |

## Sprites

| Feature | Source in Fizz 2 | Studio doc and section | Status | Action taken |
| --- | --- | --- | --- | --- |
| Sprite grids, EGA letters, anchors, sources, canonical JSON | `docs/SPRITES.md` | `EDITOR.md` 14 | Missing (only Fizz 1 point sprites) | Section 14 added: browser, preview, drawn-only editing, constraints |
| Kind to sprite by state (chicken, snacks, keys, doors, Ben's pose) | `fizz-slice-view`; `SPRITES.md` | `EDITOR.md` 14 "How a level uses sprites" | Missing | Built-in objects name kinds; custom definitions name sprites per state (D39, D51) |
| Ben's pose-workshop frames | `ep2-ben-lab.json` on `7b948ae` | `EDITOR.md` 14 "The Sprites window" | Missing | Listed as provisional with the body-size consequence |
| Enemy roster and states | `roadmap.json` `enemy-roster` | `EDITOR.md` 14 | Missing | Placeholder boxes until published |
| `SPRT` section | `docs/FAP.md` (not specified) | `EDITOR.md` 14 | Missing | Unknowns listed; the studio never writes packs |
| HUD keys green and gold | `ep2-hud-keys.json` | Capability matrix | Missing | Recorded: sprites exist, objects do not |

## Budgets and platform

| Feature | Source in Fizz 2 | Studio doc and section | Status | Action taken |
| --- | --- | --- | --- | --- |
| Floppy budget, reserves, EXE plus packs | `docs/PLATFORM.md` "Size budget"; `docs/FAP.md` | `EDITOR.md` "Budgets" | Missing | Meter, provisional |
| Section limit 96 KB, deflate, stored when smaller | `docs/FAP.md` | `EDITOR.md` "Budgets" | Missing | Meter |
| DOS floor 4 MB, 486DX | #143; `docs/ARCHITECTURE.md` | `EDITOR.md` "Budgets" | Missing | Recorded as not a level property |
| Light budget (16 active, pool of 32) | #146 | `LANGUAGE.md` W111 | Missing | Lint reserved |
| Pack compatibility number | `docs/FAP.md` | `ARCHITECTURE.md` 7 | Missing | Explained; the editor shows the profile's number |

## Targets, Fizz 1 and later episodes

| Feature | Source | Studio doc and section | Status | Action taken |
| --- | --- | --- | --- | --- |
| Fizz 1 and Fizz 2 diverge in meaning | Fizz 2 `docs/FIZZ1-DIFFERENCES.md`; #140, #145 | `LANGUAGE.md` "A superset in text, not in meaning"; matrix | Partial: "a superset" | Superset kept for text only; the capability matrix lists every divergence with its check |
| Target as a two-way switch | Studio D30 | `LANGUAGE.md` "Targets and capabilities"; `EDITOR.md` 13 | Partial | Target profiles with capability states (D34), bound to the level at creation (D46) |
| Fizz 1 export losses | — | `LANGUAGE.md` "Lowering to Fizz 1" | Partial: no door-channel rule, no exit or look | Full mapping table; E120 for a door that starts open; W110 |
| Fizz 1 to Fizz 2 conversion | — | `LANGUAGE.md` "Converting a Fizz 1 level to Fizz 2" | Missing | Convert to Fizz 2 with a conversion report, into a world (D46) |
| Episode 3 on Fizz 2's simulation | Fizz 2 `CLAUDE.md`, `README.md` | `LANGUAGE.md` "Later episodes"; `ROADMAP.md` M13 | Missing | Dialect versions, profiles and content tables (D35) |
| Overworld in Fizz 2 | None | `OVERWORLD.md` section 10 | Missing | Recorded as absent; the overworld designer is profile-driven |

## Added by the owner's decisions

These are the owner's design (2026-11-04), not features of Fizz 2 today. **Status** is the studio documents' coverage before the second pass; every one was Missing.

| Feature | Today in Fizz 2 | Studio doc and section | Status | Action taken |
| --- | --- | --- | --- | --- |
| Named states with value sets, bindings and rule inputs (keys, switches, enemies cleared, timers, areas, state changes) | Two lock records (#140) | `LANGUAGE.md` "States and rules"; `EDITOR.md` 13 (States and Rules windows, States lens) | Missing | Dialect, lints E110 to E126 and W113, windows, lens, MCP tools; F11 |
| `LEVL` version 2, version 1 dropped | Version 1 amended (#138) | `LANGUAGE.md` "What a Fizz 2 level holds" | Missing | D43; F10 |
| Placed lights (radius, colour or bank, falloff, flicker, state, attachment) | Constants (#146) | `LANGUAGE.md` "Objects"; `EDITOR.md` 13 "Lights" | Missing | Light tool, meters, W111; F12; Q28 |
| The oblique look as every Fizz 2 level's canvas | The slice only (#143) | `EDITOR.md` 13 "Views" | Missing | D45; F5, F13 |
| A level's target fixed at creation; convert up, export down | — | `WORLD.md` 3; `EDITOR.md` 13 | Missing | D46; the Target setting removed |
| Wall-kick as a core mechanic | Left out | `LANGUAGE.md` matrix | Missing | D47; F9; Q26 |
| World projects building one world pack | `<WORLD>.FAP` planned (`docs/FAP.md`) | `WORLD.md` | Missing | D48; F4, F15 |
| The retro art set, art only | `tools/sprites/export-fizz1.ts` exports the slice's Fizz 1 sprites | `WORLD.md` 5; `EDITOR.md` 14 | Missing | D49; F20; Q31 |
| Raised floating words and cues from rules and objects; a world sound library | Fixed event table; effects in `SHARED.FAP` | `LANGUAGE.md` "States and rules"; `SCRIPTING.md` 5; `EDITOR.md` 13 | Missing | D50; F18; Q29, Q30 |
| Custom enemies and items with behaviour scripts, bytecode, a step budget | One built-in enemy | `SCRIPTING.md` | Missing | D51; F16, F17, F21, F22; Q32, Q33 |
| Bitmap parallax panels, PNG import, the pixel editor | Procedural layers (#144) | `EDITOR.md` 15 | Missing | D52; F19, F14; Q34, Q35 |
| Cost meters for lights, panels and behaviours | `/BENCH` whole-frame figures | `EDITOR.md` 13 "Budgets" | Missing | F22 |

## The desktop app

The owner set the studio's end goal as a Tauri v2 desktop app to the Liminal HQ standards (D54). The studio's documents had assumed a browser app; these rows say what that changes for the Fizz 2 work.

| Feature | Source | Studio doc and section | Status | Action taken |
| --- | --- | --- | --- | --- |
| The Liminal HQ Tauri standards (layout, crates and plugins, Rust-owned state, windows in Rust, settings, catalogue, gate, CI) | `folio/AGENTS.md`; `waypoint/AGENTS.md` | `DESKTOP.md` | Missing | New document; R-APP-01 to R-APP-16 |
| One parser for Fizz 2 | Fizz 2 plans `fizz-script` | `ARCHITECTURE.md` 7; D55 | Partial: a second parser or WebAssembly was open (Q10) | The studio links `fizz-script` natively (proposed) |
| The Game view, rule previews and behaviour debugger | F5, F6, F21 | `ARCHITECTURE.md` 5; `EDITOR.md` 13; `SCRIPTING.md` 6.2 | Partial: planned through WebAssembly in a Web Worker | Native in the game host, streamed over `Channel`s (D59); F5, F6, F21 recast as native APIs |
| The Fizz 2 crates used from the studio | Workspace crates in the Fizz 2 repository | `ENGINE-CHANGES.md` F23; D58 | Missing | Pinned git dependencies; F23 |
| Claude's MCP server | `folio/spec/13-agents.md` | `MCP.md` 5; D57 | Partial: a file-based TypeScript server | A stdio sidecar with live and headless modes, propose kept |
| Testing the app | `folio/AGENTS.md`; Folio's D-14 | `TESTING.md` 8; D60 | Partial: Playwright on the prototype | `tauri-mcp-server` and Rust tests; Playwright for the design only |

## What remains open

The questions still open are in `SPEC.md` §11 (Q11, Q14, Q15, Q17 to Q20, Q22 to Q35) and `DECISIONS.md` (the two 2026-11-04 log entries). The ones that need the owner first: what "wall-kick disabled for Fizz 1 levels" means (Q26), the state and rule limits (Q23, Q24), world-scoped states (Q27), the behaviour budgets (Q32), and which Ben ships (Q19).
