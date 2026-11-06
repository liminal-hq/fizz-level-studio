# Behaviour scripting

Custom enemies and items for Fizz 2 worlds, with **full behaviour scripting**: the author defines a kind (its sprite, hitbox, stats, behaviours, reactions and effects) in the world's definitions, the baker compiles each behaviour to a compact **bytecode** stored in a section of the world pack, and the simulation interprets it with a **per-tick step budget**, so cost and determinism can be checked. This is the owner's design (decided 2026-11-04). **None of it is built**, in the studio or in the Fizz 2 repository, which today has one built-in enemy (the chicken, Fizz 1's gloop ported line for line) and four snack kinds. The Fizz 2 work it needs is F16, F17 and F21 in [ENGINE-CHANGES.md](../docs/ENGINE-CHANGES.md#fizz-2-planned); the language below is the studio's proposal, and the Fizz 2 repository's compiler and interpreter are the authority once they exist.

## 1. Principles

- **The game runs the behaviour.** The bytecode runs in the game's simulation, and every preview, trace and debug session in the studio runs that same interpreter, linked natively in the studio's game host (`DESKTOP.md`, D59). The studio never interprets a behaviour in TypeScript.
- **Deterministic on every platform.** The same world gives the same state hash on native, Web and DOS. The language uses only what Fizz 2's numeric model allows (`docs/PLATFORM.md` and `spec/ARCHITECTURE.md` in that repository): `f64` with basic IEEE operations (`+`, `-`, `*`, `/`, `sqrt`, comparisons, `abs`, `min`, `max`, `floor`), no `exp` family, no platform maths library, and random numbers only from a seeded per-entity stream built on `fizz_phys::rng::hashf`, as the chicken's cluck stream is. Angles and waves come from tables the game owns.
- **Bounded by construction.** There are no loops and no recursion in a handler: repetition happens across ticks. Every handler is therefore a finite tree of instructions whose worst-case length the compiler computes, so the step budget is checked when the world is baked, not discovered on a 486.
- **The game's physics, not a copy.** Movement goes through the game's own body and collision code (`fizz-phys`): a script asks to walk, jump or fly, and the game moves the body. A script cannot set a position through a wall.
- **Sandboxed.** A behaviour can read its own entity, a fixed set of sensors, the level's states and its own registers, and can call a fixed set of actions. It has no addresses, no access to other entities' memory, and no way to allocate.

## 2. The definition language

Definitions are a section of the Fizz 2 dialect, in the world's `defs/*.fizz` files (a sibling file type, not a separate language: the same lexical rules, comments, errors and lossless printing as a level).

```text
script fizz2 0
enemy beetle-bot
  sprite   idle=beetle_idle walk=beetle_walk1,beetle_walk2 alert=beetle_alert stunned=beetle_stun dead=beetle_dead
  hitbox   0.8x0.7
  stats    hp=2 speed=2.5 gravity=yes stomp=stun shot=damage contact=hurt
  registers patrol-left patrol-right cooldown
  behaviour
    mode walk
      on enter      set cooldown 0; anim walk
      on tick       walk facing speed; if wall-ahead or ledge-ahead then turn
      on tick       if ben-ahead 6 and cooldown <= 0 then goto charge
    mode charge
      on enter      anim alert; set cooldown 120
      on tick       walk facing speed * 2; if wall-ahead then goto walk
      on tick       set cooldown cooldown - 1
  on stomp        stun 180; raise word bonk; cue bonk
  on shot         damage 1; if hp <= 0 then defeat
  on defeat       raise word "zapped!" style=yellow; cue win; set state alarm off; score 10
end

item cookie-jar
  sprite   idle=jar
  hitbox   0.8x0.8
  bob      yes
  on take  score 5; ammo 2; raise word crunch; cue crunch
end

item gate-key
  sprite   idle=keyGreen
  on take  key gate; raise word "gate key" style=green; cue key
end
```

### 2.1 Definitions

| Field                                                     | Enemy | Item     | Meaning                                                                                                                                                                                                    |
| --------------------------------------------------------- | ----- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sprite`                                                  | Yes   | Yes      | A sprite (or a list of frames) per state; the states `idle`, `walk`, `alert`, `stunned` and `dead` are named after the Fizz 2 roster plan, and others may be added                                         |
| `hitbox`                                                  | Yes   | Yes      | The body in tiles (width by height), anchored at the feet and centre as the sprites are                                                                                                                    |
| `stats`                                                   | Yes   | —        | `hp`, `speed` (tiles a second), `gravity` (yes or no), and the default reactions: `stomp=` (`stun`, `damage`, `defeat`, `bounce`, `hurt`), `shot=` (`stun`, `damage`, `pass`), `contact=` (`hurt`, `none`) |
| `registers`                                               | Yes   | Yes      | Up to eight named numeric registers (`f64`), zero at spawn, hashed with the entity                                                                                                                         |
| `behaviour`                                               | Yes   | Optional | Modes with handlers (section 2.2)                                                                                                                                                                          |
| `bob`                                                     | —     | Yes      | Draw with the pickup bob the keys and snacks have                                                                                                                                                          |
| `on take`                                                 | —     | Yes      | The item's effects when Ben takes it                                                                                                                                                                       |
| `on stomp`, `on stun`, `on shot`, `on touch`, `on defeat` | Yes   | Some     | Reactions, overriding the defaults in `stats`                                                                                                                                                              |

### 2.2 Behaviours

- A behaviour is a set of **modes**; the entity is in exactly one at a time. A mode has `on enter` and any number of `on tick` handlers, run in order every tick while the mode is current.
- **Statements:** `set REG EXPR`, `goto MODE`, `if COND then STATEMENTS [else STATEMENTS]`, and the actions below, separated by `;`. There is no `while`, `for`, function or call.
- **Expressions:** numbers, registers, sensors, `+ - * /`, `sqrt`, `abs`, `min`, `max`, `floor`, comparisons, `and`, `or`, `not`. Division by zero, an overflow to infinity and a NaN are defined: the instruction yields 0 and raises a debug event, so every platform does the same thing.
- **Sensors (read only):** `facing`, `on-ground`, `wall-ahead`, `ledge-ahead`, `ben-dx`, `ben-dy`, `ben-ahead N` (Ben within N tiles in the facing direction and in sight on the same rows), `hp`, `ticks-in-mode`, `rand` (the next number from the entity's seeded stream), `state NAME`.
- **Actions:** movement (`walk DIR SPEED`, `jump SPEED`, `fly VX VY`, `stop`, `turn`, `face DIR`), animation (`anim STATE`), combat (`stun TICKS`, `damage N`, `defeat`, `hurt-ben`), effects (`score N`, `ammo N`, `key NAME`, `set state NAME VALUE`, `toggle state NAME`), events (`raise word STRING [style=S]`, `cue EFFECT`; see section 5), and `remove` (the entity leaves the level until a death resets it). Spawning other entities is not in the first version (Q33).

### 2.3 Items and their effects

An item is taken when Ben's body overlaps its box, as Fizz 1's snacks are. Its `on take` effects are the actions above: `score N`, `ammo N` (the soda can is `ammo 5`), `key NAME` (Ben now holds a named key, which a state rule may test; section 6 of [LANGUAGE.md](LANGUAGE.md#states-and-rules)), `set state`, and events. The built-in snacks and keys stay built-in; a custom item is for anything else.

## 3. The bytecode and its section

The baker compiles each behaviour and reaction to bytecode. The studio proposes the shape; the Fizz 2 repository decides the bytes (F17).

- **A stack machine with fixed-width instructions**: one opcode byte and up to three operand bytes, a small constant pool of `f64` values per definition, and register and sensor operands by index. No jump goes backwards, which is what makes the worst-case count computable.
- **A `BHVR` section** in the world pack: a header (the bytecode version, the counts), then per definition its constant pool, its handler table (mode by event) and its code. A `DEFS` section (F16) holds the definitions' data: the sprite references, hitbox, stats, default reactions and register count, as fixed-size records the game reads without parsing, as it reads `LEVL`.
- **A verifier at load**, in the style of `LevelView::new`: every opcode known, every operand in range, every jump forward and inside its handler, every handler's worst case within the budget, every sprite and state reference resolved. A pack that fails is refused with the pack messages `docs/FAP.md` lists.
- **Versioning.** The opcode table, the sensor and action lists and the semantics carry a **bytecode version**, which is part of the pack's compatibility number (`pack_content()`), so a game refuses bytecode it does not understand rather than running it differently. A new opcode is a new version; an opcode never changes meaning within a version.
- **Hashing.** Each custom entity's mode, registers, position, velocity, hp and timers are part of the state hash, in entity order, so a platform that runs a behaviour differently fails the parity gate at once.

## 4. The step budget and the cost meters

- **The step budget** is a number of instructions per entity per tick, and a number per level per tick, both set by the target profile (the values are the Fizz 2 repository's to choose against the 486 floor; Q32). The compiler computes each handler's worst case; a behaviour over the per-entity budget is an error (E205), and a level whose entities could together exceed the per-level budget is a warning (W203) with the worst tick shown.
- **At run time** the interpreter still counts. If a count is ever exceeded (it should not be, since the bake checked), the handler stops at that instruction for that tick, deterministically on every platform, and raises a debug event.
- **The Budget window** shows, per definition and per level: the worst-case instructions per tick against the budgets, the bytecode size of each definition and the `BHVR` and `DEFS` section sizes in the world pack, and, from the game's own bench figures when it reports them, an estimated DOS cost per tick (F22). A meter without a source says "not run".

## 5. Events: floating words and sounds

Rules and objects **raise events**; they do not draw or play anything themselves.

- `raise word STRING [style=S]` shows a floating word at the entity (or, from a rule, at the action's cell), as the game's captions float today. The words are level or world strings (up to 30 bytes, the seven styles) or the shared captions (`bonk`, `clunk` and the rest).
- `cue EFFECT` plays a sound from the world's sound library at the event's place, with the game's stereo placement.
- Each presenter decides how to show and play them, exactly as it does for the built-in events today (`fizz-slice-view`'s presentation table). Events are not hashed; the transcript records them, so the parity gate compares them on every platform.
- The editor lists every word and cue a world uses, previews a word in the game's caption font and colour and plays a cue through the game's Web sound, and checks every caption, string and effect id (E116, E207).
- **An in-editor sound designer is not in scope.** Sounds come from the world's sound library, which is made with the game's own audio tools (Undertone sources lowered to OPX); a designer inside the studio would overlap that work and is recorded as a future item only (Q30).

## 6. The editor

### 6.1 The behaviour editor

- A **Definitions** window lists the world's enemies and items with their sprites, and opens one in the behaviour editor.
- The **behaviour editor** has the text of the definition (with completion for sensors, actions, registers, modes, sprites, states, strings and cues from the profile and the world), and beside it a **mode graph**: each mode a box, each `goto` an arrow, the events that leave a mode labelled, unreachable modes flagged (W201).
- Each handler shows its **worst-case instruction count** against the budget as it is typed, from the compiler (the studio's language package compiles to the same bytecode as the baker: the desktop app links the baker's compiler natively, D55).
- The fields (sprite per state, hitbox, stats, default reactions) are a form above the text, and the form and the text are one source.

### 6.2 Preview and debugger

All of it runs **the game's own interpreter**, linked natively in the game host on a worker thread (F6, F21), with traces streamed to the window over a `Channel`.

- **Preview** places the definition in a small test room (or in the open level) and runs it, drawn by the game's presenter: walk, charge, stomp it, shoot it, take it.
- **Debugger:** pause, step one tick, run to an event; the current mode, every register, the sensors' values and the instructions used this tick, per entity; a breakpoint on a handler or on a mode change; the hitbox drawn over the sprite.
- **Replay:** a preview records its inputs, so the same run replays exactly, and the debugger can step backwards by replaying to the tick before.
- **Parity check:** a preview's final state hash can be compared with the native game's for the same inputs (a test fixture, not a per-session check).

### 6.3 Lints and errors

| Code | Meaning                                                                                         |
| ---- | ----------------------------------------------------------------------------------------------- |
| E201 | Unknown sensor, action, register, mode, sprite state or definition name                         |
| E202 | A statement or expression the language does not have (a loop, a call, `exp`, `sin`)             |
| E203 | More than eight registers, or a register name used twice                                        |
| E204 | A `goto` to a mode that does not exist, or a behaviour with no mode                             |
| E205 | A handler whose worst case exceeds the per-entity step budget                                   |
| E206 | A hitbox or speed outside the profile's limits                                                  |
| E207 | An unknown cue, caption or string in a `raise` or `cue`                                         |
| E208 | A custom definition in a level whose target cannot run behaviours (Fizz 1)                      |
| W201 | A mode no `goto` reaches                                                                        |
| W202 | A mode with no way out that is not meant to be final                                            |
| W203 | A level whose entities could together exceed the per-level budget in one tick                   |
| W204 | An enemy with no reaction to stomp, stun or shot beyond the defaults, which may not be intended |
| W205 | A sprite state the behaviour uses with no frame in some target's sprite sets                    |

These are the studio's proposed numbers, offered to the Fizz 2 compiler as the dialect's are (`DECISIONS.md` D40).

### 6.4 MCP

Claude reads and proposes definitions like any other lines (`MCP.md` section 2): `list_defs`, `get_def` (the text, fields, mode graph and worst-case counts), `add_def` and `set_def` as proposals, `check_def` (the compiler's verdict without storing), and `run_behaviour` (a preview run in the game host for a number of ticks with given inputs, returning the trace of modes, positions and events, or "not available" when the module is not loaded).

## 7. Fizz 1

Fizz 1 levels use **the Fizz 1 roster only**. A Fizz 1 level cannot use a custom definition (E208), and exporting a Fizz 2 level that places one is E123. Fizz 1's enemies stay its built-in kinds, placed and documented as today.

## 8. Tests and conformance

- **Compiler conformance.** A corpus of definitions with their expected bytecode, worst-case counts and errors, run by the studio and by the Fizz 2 compiler, as for the level dialect.
- **Determinism.** A set of behaviour fixtures, each run for a fixed input script natively, in WebAssembly under Bun or Node, and on DOS in headless DOSBox, with equal state hashes every 60 ticks, in the Fizz 2 repository's parity gate.
- **Budget.** A fixture at exactly the per-entity budget passes, one instruction over is E205, and a runtime over-count (forced by a test hook) stops the handler identically everywhere.
- **Verifier.** Malformed bytecode (a backward jump, an operand out of range, an unknown opcode, a wrong version) is refused at load.
- **Sandbox.** No fixture can read or change another entity, an address or a platform value.
- **Studio side.** The behaviour editor's counts equal the compiler's for every corpus definition; the debugger's register values equal the native trace for each fixture.

## 9. Risks

| Risk                                             | Effect                                               | Mitigation                                                                                                                                                               |
| ------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Non-determinism across x87, SSE2 and WebAssembly | A world plays differently on DOS                     | Only the numeric model's operations; no `exp` family; table-driven waves; defined results for division by zero and NaN; every entity hashed; parity fixtures in the gate |
| Cost on a 486                                    | Levels that stutter on the DOS floor                 | Static worst-case counts, per-entity and per-level budgets from the profile, a runtime counter, and the Budget window's DOS cost estimate from the game's bench          |
| Sandbox escape or a crash from bad bytecode      | A pack that hangs or corrupts the game               | A load-time verifier, no addresses, no backward jumps, bounds on every operand                                                                                           |
| Bytecode versions drift                          | An old pack runs with new meanings                   | The bytecode version in the compatibility number; opcodes never change meaning within a version                                                                          |
| Two compilers drift (the studio and the baker)   | The editor's counts or errors differ from the game's | One compiler, the baker's, linked natively (D55), and a shared conformance corpus                                                                                        |
| Scripts become a second physics                  | Enemies that tunnel or behave unlike Fizz's world    | Movement only through the game's body code; no direct position writes                                                                                                    |
| Scope                                            | Scripting grows into a general language              | No loops, no calls, eight registers, a fixed action list; additions are new bytecode versions                                                                            |
