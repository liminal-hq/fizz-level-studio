# Fizz 2 coverage

Every Lieutenant Fizz 2 feature, concept and open change that a level author has to control, set against where the studio's documents handle it. **Status** is how well the studio's documents covered the feature before they were brought up to date with the Fizz 2 repository on 2026-11-04: **Covered**, **Partial** (named, but wrong, thin or missing what the author sets) or **Missing**. **Action** is what was done about it and where it now lives. Nothing here is built in the studio.

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
| `LEVL` header: size, name (48 bytes), start, `floor_solid`, `switches` | `docs/FAP.md` `LEVL`; `crates/fizz-pack/src/level.rs` | `LANGUAGE.md` "What a Fizz 2 level holds", "The header" | Partial: called "LEVL v2", `floor` listed as an object | Corrected: it is section version 1 amended in place (#138); `floor solid` is a header word; every header field mapped to a statement |
| Section length formula and record order (header, name, objects, rules, strings, tiles) | `docs/FAP.md` on #138 | `LANGUAGE.md` "What a Fizz 2 level holds"; `EDITOR.md` "Budgets" | Missing | Added, with the meter labelled an estimate unless `fizz-bake` supplies it |
| Tile ids and the slice's letters `. w # B = ^ D b E` | `crates/fizz-ep2/src/tiles.rs`, `level.rs` | `LANGUAGE.md` "The map block" | Partial: letters listed, meanings deferred | Added the legend with ids; recorded that ids are shared with Fizz 1; letters for `CHOC` and the slopes proposed and left open (Q11) |
| Textures chosen by letter and neighbours | `docs/OBLIQUE.md` (#142) | `LANGUAGE.md` "The map block" | Missing | Added: choosing `#` or `B` chooses the look |
| Objects: red key, blue key, snack (cheezie, choc, cookie, soda can), chicken | `docs/FAP.md` object kinds; `world.rs` | `LANGUAGE.md` "Objects" | Partial: no kinds, subs or limits | Added the kind and `sub` table, one key per colour, kinds 5 to 7 reserved |
| Object ids | None: records have no id; rules use indices (#138) | `LANGUAGE.md` "Objects"; `DECISIONS.md` D25 | Partial: "index is its sorted position" without saying rules depend on it | `id=` kept as a source name resolved to an index; renaming rewrites rules; the editor refuses reordering |
| Kind order and construction order | `SourceError::KindOrder` (#137); the state hash indexes by position | `LANGUAGE.md` "Objects" | Covered | Cited the source |
| What an object's point means (centre, chicken spawn, Ben's lower-left corner) | `level.rs` constants | `LANGUAGE.md` "Positions" | Missing | Added; the Inspector says which |
| Doors as switched tiles on fixed channels | `tiles.rs` (channels 1 and 2) | `LANGUAGE.md` "Locks" | Partial | Added: a door's channel comes from its tile, closed while on |
| Lock as a rule record (key colour, channel, event cell) | #140 | `LANGUAGE.md` "Locks"; `EDITOR.md` 13 | Partial: `lock red-door key=red` with no cell, lock missing from the trigger list | `lock red-door key=red at=X,Y`; E110 for a bad cell; green key absent |
| Rule records: trigger, flags, guard, subject, rectangle or time, delay, two slots | #138 | `LANGUAGE.md` "Rules" | Partial: no delay, no time fields, no cells, "no repeating timers" contradicted by the record | Full field mapping; `after=`, `time at= every=`, cells required; the earlier "no delays, no repeating timers" corrected to "the records have room; which run is the game's choice" |
| Only locks run today | `RuleError::Trigger` (#140) | `LANGUAGE.md` "Rules"; matrix | Missing | W106 and the "accepted" capability state |
| Effects and shared captions by id | `crates/fizz-ep2/src/cues.rs` (#140) | `LANGUAGE.md` "Rules"; `EDITOR.md` cue pickers | Partial: "the shared tables only" | Named lists from the game; E116 |
| Level strings (32, 1 to 30 bytes, seven styles) | #138 | `LANGUAGE.md` "Rules"; `EDITOR.md` Strings tab | Missing | `string NAME "text" style=`; E112, W107 |
| Limits: 32 rules, 32 strings, channels 0 to 31 | `MAX_RULES`, `MAX_STRINGS`, `MAX_CHANNELS` | `LANGUAGE.md`; `EDITOR.md` "Budgets" | Partial (rules only) | All limits with codes E111 to E113 and meters |
| Channel start state is level data | #140 | `LANGUAGE.md` "The header" | Covered | Cited |
| Death reset: channels, keys, snacks and cans, ammo, chickens; rules re-arm | #140; Fizz 2 `docs/FIZZ1-DIFFERENCES.md` | `LANGUAGE.md` "Rules"; `DECISIONS.md` | Partial: listed as an open question with "persist (recommended)" | Recorded the owner's decision (reset) as D33; open question closed |
| Level digest and the pack compatibility number | `fizz_ep2::level::digest`; `pack_content()` | `TESTING.md` section 7; `ARCHITECTURE.md` section 7 | Missing | Digest parity test; the compatibility number explained as why a cue id or tile change invalidates packs |
| `fizz-bake` commands, manifests, `file:line:col` errors | `docs/FAP.md` "The baker" | `ARCHITECTURE.md` 7; `ENGINE-CHANGES.md` | Partial | Kept; noted the baker and parser are plans, not code |

## Movement and rules that diverge from Fizz 1

| Feature | Source in Fizz 2 | Studio doc and section | Status | Action taken |
| --- | --- | --- | --- | --- |
| No wall-kick | `docs/FIZZ1-DIFFERENCES.md` (owner, 2026-10-30) | `SPEC.md` Q13 | Partial: an open question only | W103 as a design-rule lint; the profile's physics parameters; Convert to Fizz 2 runs it |
| Exit entered with a fresh Up press while standing | #145 | `LANGUAGE.md`; `EDITOR.md` Exit lens | Missing | W102, W110, the Exit lens |
| Ben's body 0.7 by 1.4, 0.8 by 2.0 on the trial | `ben.rs`; `7b948ae` | `EDITOR.md` Head room lens; `LANGUAGE.md` W105 | Missing | Body size as a profile parameter; W105 and a two-size comparison |
| Ladders, vines, mantle, lifts, conveyors not ported | `docs/PLATFORM.md` "Departures" | Capability matrix | Missing | E102 rows in the matrix |
| Ammo restarts at five on a respawn | `docs/FIZZ1-DIFFERENCES.md` | Capability matrix | Missing | Noted; no level field |
| Roadmap says wall-kick "comes first" in M3.5 while the differences page says it is left out | `roadmap.json` `wallkick`; `FIZZ1-DIFFERENCES.md` | `SPEC.md` §11 | Missing | Recorded as open question Q16 for the owner |

## The look: theme, projection, parallax, night, lights

| Feature | Source in Fizz 2 | Studio doc and section | Status | Action taken |
| --- | --- | --- | --- | --- |
| Oblique ground (global projection, faces from neighbours) | `docs/OBLIQUE.md` (#142, #143) | `EDITOR.md` "Previews" | Missing | Game view drawn by the game's presenter in WebAssembly; never reimplemented |
| Theme chooses back wall and parallax stack | `docs/OBLIQUE.md` "Backgrounds and parallax" (#144) | `LANGUAGE.md` "Theme, look and lights" | Missing | `theme` reserved (W109) until the Fizz 2 theme format exists; Q17 |
| Parallax layers and factors; Sky setting Full, Light, Auto | `crates/fizz-view/src/parallax.rs`; `FIZZ2.CFG` (#144) | `EDITOR.md` "Previews" | Missing | Preview only; Sky is a player setting, not level data |
| Night mode, palette banks, dynamic lights | `docs/LIGHTS.md`; `light.rs` (#146) | `EDITOR.md` "Previews"; `LANGUAGE.md` | Missing | Preview only; Night is a player setting; `light` reserved; W111 for the 15-light view budget once lights are data |
| Lights derived from objects (doors, exit, Ben, shots) | #146 | `LANGUAGE.md` "Theme, look and lights" | Missing | No authoring needed; recorded |
| Animated tiles (conveyors, gates, glowing exits) | `roadmap.json` `anim-tiles` (planned) | Capability matrix | Missing | Absent rows; follows the profile when it lands |
| Backdrops (`BDRP`) | `docs/FAP.md` (not specified) | `EDITOR.md` 14 "How sprites reach a pack" | Missing | Recorded as unknown |
| Music per level | None | `LANGUAGE.md` `music` | Missing | Reserved (W109) |

## Sprites

| Feature | Source in Fizz 2 | Studio doc and section | Status | Action taken |
| --- | --- | --- | --- | --- |
| Sprite grids, EGA letters, anchors, sources, canonical JSON | `docs/SPRITES.md` | `EDITOR.md` 14 | Missing (only Fizz 1 point sprites) | Section 14 added: browser, preview, drawn-only editing, constraints |
| Kind to sprite by state (chicken, snacks, keys, doors, Ben's pose) | `fizz-slice-view`; `SPRITES.md` | `EDITOR.md` 14 "How a level uses sprites" | Missing | Levels name kinds; the profile maps kinds to sprites |
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
| Target as a two-way switch | Studio D30 | `LANGUAGE.md` "Targets and capabilities"; `EDITOR.md` 13 | Partial | Target profiles with capability states (D34) |
| Fizz 1 export losses | — | `LANGUAGE.md` "Lowering to Fizz 1" | Partial: no door-channel rule, no exit or look | Full mapping table; E120 for a door that starts open; W110 |
| Fizz 1 to Fizz 2 conversion | — | `LANGUAGE.md` "Converting a Fizz 1 level to Fizz 2" | Missing | Convert to Fizz 2 command |
| Episode 3 on Fizz 2's simulation | Fizz 2 `CLAUDE.md`, `README.md` | `LANGUAGE.md` "Later episodes"; `ROADMAP.md` M10 | Missing | Dialect versions, profiles and content tables (D35) |
| Overworld in Fizz 2 | None | `OVERWORLD.md` section 10 | Missing | Recorded as absent; the overworld designer is profile-driven |

## What remains open

The questions this review raised are in `SPEC.md` §11 (Q11, Q12 and Q14 to Q22) and `DECISIONS.md` (the 2026-11-04 log entry). The ones that need the owner first: the theme and light format (Q17), whether the studio's proposed E1xx numbering is adopted by `fizz-script` (Q14), which Ben ships (Q19), the wall-kick contradiction (Q16), and whether Fizz 1 export of rules should ever be attempted (Q21).
