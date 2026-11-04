# World projects

How the studio organises Fizz 2 work: a **world project** holds one world's levels, overworld, shared definitions, sprites, parallax panels, sounds and strings, and builds into one world pack (`<WORLD>.FAP`). This is the owner's design (decided 2026-11-04). **None of it is built**, in the studio or in the Fizz 2 repository: the Fizz 2 repository today has one slice level written as Rust `const` data, the pack format and its reader (`fizz-pack`), and a plan for `fizz-bake`. Every part of the world project that needs Fizz 2 work is a numbered change request in [ENGINE-CHANGES.md](ENGINE-CHANGES.md#fizz-2-planned) (F1 to F22).

## 1. What a world is

In Fizz 2 a world is a set of levels that load together from one pack: `docs/FAP.md` in the Fizz 2 repository plans `SHARED.FAP` (Ben, the HUD, the shared effects) plus one pack per world, such as `LIGHT.FAP`, holding that world's levels (`LEVL`), backdrops (`BDRP`) and world sprites (`SPRT`). The world project is the studio's source for exactly one such pack.

A world project holds:

| Part | What it is | Lands in the world pack as |
| --- | --- | --- |
| Levels | `script fizz2 N` level files, each with its map, objects, states, rules, lights and strings | One `LEVL` section each (version 2, F10) |
| Overworld | The world's map, if the target has one (Fizz 2 has none today; `OVERWORLD.md` section 10) | To be decided with the overworld (Q22) |
| Enemy and item definitions | Custom enemies and items: sprite, hitbox, stats, behaviours, reactions and effects ([SCRIPTING.md](SCRIPTING.md)) | A definitions section (`DEFS`, F16) and a bytecode section (`BHVR`, F17) |
| States | Shared state definitions a level can reuse (names, value sets, start values) | Copied into each level's state table at bake; world-scoped states are open (Q27) |
| Sounds | The world's sound library: the effects its rules and objects may raise, by name | A world sound section (F18) |
| Strings | Shared floating words and captions, beside each level's own | Copied into each level's string table at bake |
| Sprites | The world's sprite sets (Fizz 2's JSON grid format), including the retro art set when imported | `SPRT` (F7) |
| Parallax panels | Bitmap background panels with their scroll settings | `BDRP` (F19) |
| Theme | The world's default theme: back-wall material, panel stack, night ambient | The theme format (F3) |

Things that are not in the world pack: Ben's own sprites and the HUD (in `SHARED.FAP`), music (the `MUSIC.*` files and the `MUSC` table), saves and settings.

## 2. The folder

A proposed layout; the names are the studio's and the baker reads whatever the world file lists.

```text
light/                          one world project
  world.fizz                    the world header: name, id, pack stem, target, dialect version, theme, the lists below
  levels/*.fizz                 the levels
  overworld.fizz                the overworld, when the target has one
  defs/enemies.fizz             enemy definitions and their behaviours
  defs/items.fizz               item definitions and their effects
  defs/states.fizz              shared state definitions
  defs/sounds.fizz              the sound library: names bound to effect sources
  defs/strings.fizz             shared strings
  sprites/*.json                sprite sets in Fizz 2's canonical grid format
  art/retro-fizz1/              the imported Fizz 1 art set (read-only)
  panels/*.json                 parallax panels as palette grids, with their source images
  studio.json                   the editor's own settings: layouts, open files, the profile pin; never baked
```

```text
script fizz2 0
world "Lighthouse Point" id=light pack=LIGHT target=ep2
theme lighthouse
levels   levels/light-1.fizz, levels/light-2.fizz
defs     defs/enemies.fizz, defs/items.fizz, defs/states.fizz, defs/sounds.fizz, defs/strings.fizz
sprites  sprites/*.json, art/retro-fizz1
panels   panels/*.json
```

- `pack=` is the 8.3 stem the pack is written and loaded under (`LIGHT.FAP`); the pack stores it in its header and the game refuses a renamed file.
- `target=` names the target profile ([LANGUAGE.md](LANGUAGE.md#targets-and-capabilities)). It is fixed when the world is created (section 3).
- A Fizz 1 project is not a world project: Fizz 1 levels are Rust functions in the game, so a Fizz 1 project is a folder of Fizz 1 scripts and overworld scripts, as today.

## 3. The target is fixed at creation

- **A level's target is chosen when it is set up and never changes.** New level (and New world) asks for the target (Fizz 1 or Fizz 2, later Episode 3) and writes it into the file: a Fizz 2 level starts `script fizz2 N` and belongs to a world whose `target=` matches; a Fizz 1 level has no `script` line. There is no Target switch on an open level.
- **The target selects everything the level gets:** the tools and palette, the sprites, the rules and states, the views (the oblique Game view for Fizz 2, the flat view for Fizz 1), the checks and the exporter. Nothing of the other target is shown greyed out; it is simply not offered.
- **Convert up, export down.** A Fizz 1 level can be **converted** to Fizz 2: Convert to Fizz 2 writes a new Fizz 2 level into a chosen world and opens it with a **conversion report** (what carried over, what was approximated, what was dropped, and the checks to run). A Fizz 2 level is never converted to Fizz 1; it can be **exported** with the lossy check, which writes a Fizz 1 script and reports every loss ([LANGUAGE.md](LANGUAGE.md#lowering-to-fizz-1)).
- **Profiles stay data.** The capability model, the profile's tables and the Episode 3 extensibility are unchanged; what changed is that the profile is bound to the level for life instead of being a setting.

## 4. Building the world pack

- **Build world** (World menu) runs `fizz-bake` over the world file for a chosen target platform (Web or DOS) and shows its report: every section with its stored and decoded size, the manifest, any placeholder section, and every error with `file:line:col`. The studio never writes pack bytes itself; the baker is the only writer of packs (`docs/FAP.md`, "The baker").
- **Check world** runs `fizz-bake check` against the committed manifest, so a reviewer sees what a change does to the bytes.
- The **Budget window** reads the build report: the world pack's size against the floppy budget, the per-section limit, and the frame-cost meters of [EDITOR.md](EDITOR.md#budgets).
- Until `fizz-bake` builds world packs (F4, F15), Build world reads "not run" and the Budget window shows estimates labelled as such.

## 5. The retro art set

Fizz 1's character art stays available as an **importable art set**:

- **Import Fizz 1 art** copies Fizz 1's sprites (the Fizz 2 repository's `tools/sprites/export-fizz1.ts` already exports Fizz 1's `defineSprites()` to grids, pinned at a Fizz 1 commit) into the world's `art/retro-fizz1/` as a read-only set.
- The set is packed into **the world pack**, not into `SHARED.FAP` or the executable, so only a world that uses it pays for it (F20).
- A Fizz 2 level can then be a **retro level**: its objects draw with Fizz 1 sprites. **Retro means art only.** A retro level runs under Fizz 2's rules and physics: Ben's body, the wall-kick, the exit, the death reset and every rule are Fizz 2's. The Inspector says so on a retro level, and the Sprites window shows where a Fizz 1 sprite's box differs from the Fizz 2 body it is drawn over.
- **Fizz 1 mechanics inside Fizz 2 are not planned.** Running Fizz 1's own rules (its enemy kinds, lifts, ladders, its physics) inside a Fizz 2 level is recorded as a non-goal and an open question (Q31); custom enemies with behaviour scripts ([SCRIPTING.md](SCRIPTING.md)) are the planned way to get a Fizz 1-like enemy in Fizz 2.

## 6. Shared definitions and levels

- A level uses the world's definitions by name: `cookie-jar id=jar-1 at=4,5` places an item defined in `defs/items.fizz`, `state alarm` reuses a shared state definition, `caption=welcome` names a shared string, `cue door` a sound in the world's library.
- A level's own definitions of the same name are an error (E130), so a name means one thing in a world.
- Removing a definition that a level uses is refused, with the levels and lines that use it listed.
- Definitions have the same studio-owned-line rule as objects: the studio rewrites a definition's lines in place and never touches a hand-written line beside them.

## 7. What is not decided

- Whether a state can be **world-scoped** (one state shared by every level of the world, such as a switch in one level that opens a door in another), and how that would persist and reset (Q27).
- The world sound library's section and whether it replaces or adds to `SHARED.FAP`'s effects (Q29).
- Whether the overworld belongs to a world or above worlds (Q22).
- How a world pack's size is split when it no longer fits one floppy-friendly file (`docs/FAP.md` allows moving sections between files without a format change).
