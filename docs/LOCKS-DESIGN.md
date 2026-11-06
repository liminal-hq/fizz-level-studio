# Logic-based locks: the holistic design

This note answers the Fizz 2 session's five questions on locks for the `script fizz2 0` dialect and `LEVL` version 2. It is the studio's proposal: the owner's design is D42 (locks are states with rules) and D43 (`LEVL` 2), the bytes belong to the Fizz 2 `docs/FAP.md`, the meaning to `docs/RULES.md` and the grammar to `docs/SCRIPT.md`. Where `fizz-script` decides otherwise it wins (D40), and `spec/LANGUAGE.md` is corrected to match.

It reads the Fizz 2 specifications on the open pull requests: #149 (`LEVL` 2 layout), #155 (`RULES.md`), #152 (`SCRIPT.md`), and the early code on #153 (`fizz-script`) and #156 (the state table). Nothing in them is merged, so this note treats every part as movable and picks the design that serves the goal, not the stopgap.

Agreed already and assumed here: `x=`/`y=` name a cell (an object sits at its centre), `at=X,Y` is an exact position in tile units, `y` counts up, the printer writes `x=`/`y=` only for exact cell centres, and `lock NAME key=K at=X,Y` names its door by any cell of the door's run and writes no channel.

## The five recommendations

1. **One model, written three ways:** `state` declares values by name, `door` and `state=` fields bind things to a set of values, `when` rules change states, and `lock` is sugar that expands to exactly one state, one door binding and one rule, visible in the dump view.
2. **Channels leave the dialect and the bytes.** No `channel` statement, no `channel=N` alias, no explicit channel on a lock; E110's alias half and W122 go. A Fizz 1 conversion turns channels into ordinary two-valued states named `channel-N`, and says so.
3. **The door tile keeps no channel.** The baker emits door bindings (a rect and a value mask); `tiles::props` loses its switch-channel byte; the simulation may keep `map.switches` as a private, derived bit per door binding.
4. **The object model grows by rows, not by grammar:** a generic key kind with four colours and a held count, `keep` on a lock, extra `door` lines on a lock's state, a keyhole lock on a switch, bindings for lights and panels, and level-scoped states only, with a reserved world flag.
5. **Land the Fizz 2 stacks as A (bytes), then B (syntax and lowering), then C (the full rule phase and the preview API)**, after one documentation pass that brings `RULES.md`, `FAP.md` and `SCRIPT.md` into line with this note; the studio stubs the parser additions and the preview meanwhile.

## 1. The final surface syntax

### States

```text
state red-door values=closed,open           // value 0 is closed; the start is value 0
state alarm                                 // the default set: off,on, starting off
state lift-mode values=low,mid,high start=mid
```

- `state NAME [values=V0,V1,...] [start=V]`. Values are words, unique within the state, 2 to 8 of them; value `i` is the `i`th word, which is the number the record and every rule hold. The default set is `off,on`. The start defaults to value 0.
- The printer omits `values=off,on` and a `start=` that names value 0, so the common state is one short line.
- This replaces the positional form `state NAME START [values=...]` in `LANGUAGE.md` and the `SCRIPT.md` extension table. A positional start reads as a value list of one, and making the start a field lets the default carry most states.
- States are numbered in file order, counting the states that `lock` lines declare at the lock's line. A state of the world's `defs/states.fizz` is named, not redeclared, and is copied into the level's table at the end, in the order the level first names it (E130 when a level redeclares it).

### Bindings

```text
door x=15 y=20..22 state=red-door open=open          // passable while red-door is open
door x=30..31 y=4 state=lift-mode open=mid,high      // passable for either value
light id=lamp-1 at=4,13 radius=7.5 state=alarm on=on
```

- `door x=RANGE y=RANGE state=NAME open=V[,V...]` binds every switched tile in the rectangle. Lights, panels and (later) platforms bind with `state=NAME on=V[,V...]` on the object.
- **A binding holds a set of values, not one value.** It lowers to an 8-bit mask over the state's values. The mask costs nothing (it replaces #149's `value` byte), and it removes the need for a second state or a second binding when a door is open for two of three values. #156's `closed` mask is the same idea with the opposite polarity; the record should store the **active** set (passable, lit, shown), so that every binding kind reads the same way.
- Every switched tile must be covered by exactly one door binding (E110), and a door rectangle must contain only switched tiles (E110). Anything not bound is unaffected by states.

### Rules

```text
when take id=red-key then word "red key" style=red at=2,11
when touch x=15 y=20..22 if state red-door is closed and holding key-red then set red-door open, spend key-red
when use id=lever-1 repeat then toggle lift, cue clunk at=6,3
when cleared group=guards then set lift-mode high
when time at=60 every=120 repeat then next lift-mode
when state alarm becomes on after=30 then cue door at=15,21
when state lift-mode changes then word "whirr" at=12,3
```

The shape is `when INPUT [if COND [and COND]] [after=TICKS] then ACTION[, ACTION] [repeat]`.

| Part       | Dialect                                                                                                                                                                                                                                                                                            | Lowers to (trigger, condition or op)                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Inputs     | `start`; `enter x=R y=R`; `take id=ID`; `shoot x=R y=R`; `stomp`, `stun` or `defeat` with `id=ID` or `any`; `time at=T [every=T]`; `touch x=R y=R` or `touch at=I,J` (a cell); `touch id=ID`; `use id=SWITCH`; `hit id=SWITCH`; `cleared group=NAME`; `state NAME becomes V`; `state NAME changes` | Triggers 2 to 15 of #149; `changes` is trigger 15 with `arg` 0xFF                             |
| Conditions | `state NAME is V[,V...]`, `state NAME is not V[,V...]`, `holding KEY`, `not holding KEY`                                                                                                                                                                                                           | A state-in-set condition with a mask (`is not` is the complement), and the two key conditions |
| Delay      | `after=TICKS`                                                                                                                                                                                                                                                                                      | The record's `delay`                                                                          |
| Actions    | `set NAME V`, `toggle NAME`, `next NAME`, `spend KEY`, `give KEY`, `score N`, `ammo N`, `word NAME-or-"text" [style=S] at=I,J`, `cue NAME at=I,J`                                                                                                                                                  | Ops 1 to 9 of #149                                                                            |
| Repeat     | `repeat`                                                                                                                                                                                                                                                                                           | `REPEAT`; without it a rule fires once per life                                               |

- `KEY` is the key object's word (`key-red`); `lock` takes the colour (`key=red`), because there it is a field of the door.
- `holding` is a condition, never a modifier of `touch`. The `touch ... holding KEY` form in `LANGUAGE.md` goes.
- **`touch` on cells takes a rectangle.** #149 makes the lock a touch of one cell, but the version 1 lock probe is "the tile in front of Ben at `py + 0.2`", which lands in the door's bottom cell when Ben stands at the door's foot. A one-cell touch at the middle of a three-tall door would never fire there. The touch union should be any rect; Ben touches it when his front probe lands in it or his body overlaps it, which is exactly the version 1 lock test over the door's run.
- `touch` is a level, not an edge (as `RULES.md` says): it holds every tick Ben is in contact. That keeps the version 1 lock exact. A `repeat` touch rule whose action is `toggle` or `next` would flip every tick, so it gets a new lint, W114.
- Reserved and not lowered: `hurt` (Ben hurt, which #155 calls `hit`), `kind=KIND` on `stomp`, `stun` and `defeat` (until custom enemies, F16), `use at=I,J` (Q25), and the conditions ammo at least, score at least and group cleared.

### `lock`, the sugar

```text
lock red-door key=red at=15,21
```

expands to exactly these three lines, at the lock's place in file order:

```text
state red-door values=closed,open
door x=15 y=20..22 state=red-door open=open
when touch x=15 y=20..22 if state red-door is closed and holding key-red then set red-door open, spend key-red
```

- The door's run is the 4-connected set of cells holding the same switched tile id as the cell `at=` names. It must be a rectangle; a run that is not is E110, with the fix "write `door` lines and a `when` rule".
- The rule's touch rectangle is the run's rectangle, so any cell of the door accepts the key, as today.
- The `holding` condition is written by the expansion, not added by the loader (#155 section 6 adds it in the loader). It is visible in the dump view, it counts toward the two conditions, and a `spend` of a key Ben does not hold is simply nothing. The loader adds nothing hidden.
- The door's sound and caption are not actions. Any door binding that becomes passable raises the game's built-in door event (`Event::DoorOpen`, effect 19) at its rectangle's centre cell, which closes #149's open point 1 and keeps the lock's second action slot for `spend`.
- Options: `keep` (do not spend the key; drops the second action), `id=SWITCH` in place of `at=` (a keyhole lock on a switch object: the input is `use id=SWITCH` and there is no door binding), and `key=red,blue` (both keys needed; lowers to two rules chained through the state, since the conditions are full).
- The printer keeps the `lock` line as written. The canvas and the Rules window treat a lock as one thing; editing its expansion by hand means replacing the lock with its three lines (an explicit command, one undo step).

### Cells, rectangles and points

A field holds one of three things, and each has one spelling: a **point** (`at=X,Y` exact, or `x=I y=J` for a cell centre, on objects and `start`), a **cell** (`at=I,J` with integers, on `lock`, `touch at=`, `word` and `cue`), or a **rectangle** (`x=RANGE y=RANGE`, on `door`, `enter`, `shoot` and `touch`). A cell's `at=` with a fraction is E009.

### The dump view

The dump view is the resolved, expanded level: every name numbered, every sugar line shown as its expansion with the source line it came from, and the counts against the limits. A toggle shows each record's bytes in the layout of #149's worked example.

```text
// dump: light-1.fizz — states 1/32, bindings 1/64, rules 1/32, strings 0/32
state 0   red-door   values=closed:0,open:1 start=closed       // lock, line 14
door  0   x=15 y=20..22 state=0 open={1}                       // lock, line 14
rule  0   touch x=15 y=20..22 if s0 in {0} and holding red then set s0 1, spend red   // lock, line 14
```

### Where the two sides disagree

"Studio" is `spec/LANGUAGE.md` with D42; "Fizz 2" is #149 (`FAP.md`), #155 (`RULES.md`), #152 (`SCRIPT.md`) and the code on #153 and #156.

| Topic                          | Studio says                                              | Fizz 2 says                                                                                                          | Resolution                                                                | Who changes                                                                   |
| ------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| How a state names values       | `state NAME START [values=...]`, positional start        | #149: value 0 is the first listed name, default `off,on`; #152 reserves the studio's form                            | `state NAME [values=...] [start=V]`, start defaults to value 0            | Studio and #152                                                               |
| A binding's value              | `open=VALUE`, one value                                  | #149: one `value`, active means passable; #155 and #156: a `closed` mask                                             | A mask of active values; `open=V[,V]` and `on=V[,V]`                      | All three: #149 byte 2 becomes `mask`, #155 section 3 and #156 flip to active |
| Channels                       | `channel LIST` as sugar for `channel-N` states           | #155 keeps 32 channels beside states (open question 1); #149 drops them; #152 has `channel` and the `channel=` alias | Gone from source and bytes; a private runtime detail (section 3)          | Studio, #152, #155                                                            |
| What a lock is                 | A touch rule with `holding`                              | #155: a `lock` input in its own phase (step 3); #149: trigger 1 retired, a touch-cell rule; #152: `Rule::lock`       | A plain rule (#149), touch over the door's rect, run in the rule phase    | #155 sections 4, 7 and 9; #152 lowering                                       |
| `touch`                        | "In front at body height"                                | #155: body overlap, a level; #149: one cell, corners equal                                                           | Any rect; front probe or overlap; a level                                 | #149 trigger 9; studio                                                        |
| `hit`                          | A switch struck by a shot or stomp                       | #155: Ben is hurt; #149: a switch is hit                                                                             | A switch is hit; Ben hurt is `hurt`, reserved                             | #155                                                                          |
| State-change input             | `state NAME becomes V`                                   | #155: `change` (any change); #149: `becomes`, `arg` a value                                                          | Both: `becomes V`, and `changes` as `arg` 0xFF                            | #149 (allow 0xFF), #155                                                       |
| `shoot` input                  | Absent                                                   | #149 trigger 5, #155                                                                                                 | Add `shoot x=R y=R`                                                       | Studio                                                                        |
| `kind=` on stomp, stun, defeat | Allowed                                                  | No subject for a kind                                                                                                | Reserved until F16                                                        | Studio                                                                        |
| Conditions                     | `is`, `is not`, `holding`                                | #149: is, is not, holds, not holds; #155 adds in-set, ammo, score, group cleared                                     | In-set (mask), holds, not holds; the rest numbered and rejected           | #149 condition kinds; #155 section 5                                          |
| `spend` without the key        | Not said                                                 | #155: the loader adds a key-held condition                                                                           | The baker writes it, visibly; it counts toward two                        | #155 section 6                                                                |
| Actions                        | Nine ops                                                 | #149 nine ops; #155 one `raise`                                                                                      | #149's nine                                                               | #155 (wording only)                                                           |
| The door's sound               | The game's door event                                    | #149 open point 1                                                                                                    | Built-in event of a door binding opening                                  | #149 closes the point; #155 section 9                                         |
| Groups                         | `group=NAME` on any object                               | #149: a number 1 to 16 in a chicken's `aux`; #155 also a condition                                                   | Names resolve to 1 to 16; an input only for now                           | Studio (new limit)                                                            |
| Limits                         | 32 states, 8 values, 32 rules, 32 strings, 2 and 2       | #149 adds 64 bindings, 16 groups; #152 caps names at 32 bytes                                                        | #149's, plus at most 32 door bindings (section 3)                         | Studio; #149 adds the door limit                                              |
| Evaluation order               | Rules after movement; a `becomes` sees same-tick changes | #155 section 7: rows in order, an earlier `changes` row sees a later row's change next tick; locks in step 3         | #155's order with the lock in step 6; touch is sampled in step 3          | Studio wording; #155 moves the lock                                           |
| Rule order of locks            | Table order                                              | #152: locks in file order                                                                                            | `when` and `lock` share file order                                        | Neither (agree)                                                               |
| The death reset                | D33: states, keys, rules re-arm                          | #155 section 8, in five steps; delays open (q4)                                                                      | #155's steps; a pending delay is dropped; a pending row ignores its input | Studio adds the delay line                                                    |
| Error and lint codes           | E105 missing id; E119 conflicting locks; W101 to W113    | #152: E105 name twice, E003 missing field, E119 withdrawn for W123, W120 to W123                                     | #152's numbers (D40); W122 retired; W121 becomes E110                     | Studio                                                                        |

## 2. Channels do not exist in the Fizz 2 dialect

**Recommendation: drop all three.** `channel LIST on|off`, the `channel=N` alias on a lock, and any explicit channel on a lock are not words of `script fizz2 0`. They give E102 with the fix "declare a `state` and bind it with `door`". E110 keeps only its door meanings (a lock cell that is not a switched door tile, a door rect with a non-switched tile, a switched tile no binding covers, a run that is not a rectangle). W122 is retired, not reused. W101 becomes "a door's bound state starts at an open value"; W108 covers a state nothing binds or tests; W120 (no key for the lock), W121 folded into E110, and W123 (two rules opening one door) stay as #152 numbers them.

Why: a channel is a Fizz 1 implementation of a two-valued state with a door hard-wired to it. Keeping it in the dialect gives every author two ways to say one thing and keeps the tile-fixed channel alive in the format. Every case it covers is a two-valued state.

**Fizz 1 conversion** (Convert to Fizz 2 writes a new level and a report; the Fizz 1 file is not changed):

- Each Fizz 1 channel that any tile, prop or `channel` line uses becomes `state channel-N` with `start=on` when the Fizz 1 level turns it on. The name keeps the number, so the Fizz 1 export down maps `channel-N` back to `channel N` exactly (only states of that name do).
- Red and blue doors become `lock` lines named `red-door`, `blue-door` (with `-2`, `-3` for further doors of a colour). A green door waits for the green key (section 4) and is listed.
- Fizz 1 props that drive channels become Fizz 2 rules where Fizz 2 has the input: a crystal switch becomes `switch ... by=shot` with `when hit id=... then set channel-1 off`; a floor switch becomes `switch ... by=use` with `when use id=... repeat then toggle channel-0`, which the report lists as approximated (Fizz 1 toggles on a touch; a repeating touch toggle would flip every tick, W114). Tiles that read a channel but have no Fizz 2 meaning (`bridge`, `gate`, `gate-2`, `gate-3`) keep their reserved letters and are listed as to check, with their `door` lines written so the logic survives when the tiles arrive.

What the report says, in its four lists:

```text
Carried over exactly
  red door at 15,20..22          lock red-door key=red at=15,21
Approximated
  channel 1,2,3 on               state channel-1 start=on, channel-2, channel-3 (two values each)
  floor switch at 40,3           switch sw-1 by=use + toggle rule: Up toggles it, not a touch
Dropped
  green door at 88,5..6          no green key in Fizz 2 yet
To check
  gate at 60,4..9 (channel 1)    reserved tile; bound to channel-1, not baked (E102 until Fizz 2 has gates)
  channel-N names                rename freely; a renamed state no longer exports to a Fizz 1 channel
```

## 3. Lowering the door tile's switch channel

**Recommendation: the door tile keeps no channel in any byte the baker writes.** In `LEVL` 2:

- The baker emits one binding record (kind 1, door tiles) per `door` line or lock, with its rect and the active mask. It writes no channel, and it reads none from `tiles::props`.
- `tiles::props` keeps the `SWITCHED` flag and each tile's art and colour, and loses the switch-channel byte; `pack_content()` drops those 256 bytes and `MAX_CHANNELS`, as #149 already plans. `DOOR_R` and `DOOR_B` stay separate tile ids, because the colour is what the map letter and the art say (#149 open point 4: keep the ids).
- At load, the simulation may keep `map.switches` as a **private derived bit per door binding**: binding `i` of kind 1 owns bit `i`, a per-cell `u8` overlay (0xFF for none) built from the rects says which bit a switched cell reads, and step 7 of the tick recomputes the bits from the states. The bits stay hashed as today, so a level's hash is a function of its states, and the slice's golden can survive the move.
- That needs **at most 32 door bindings** (the bits of a `u32`), within #149's 64 bindings of all kinds; the reader refuses a 33rd (studio E113, which extends to binding limits). The overlay is `w * h` bytes, the size of the tile layer, about 6 KB for a Fizz 1-sized level on DOS.
- If the Fizz 2 session would rather drop `map.switches` too, the overlay can name the binding and the solidity test read the state directly; the source and the bytes are the same either way, which is the point.

## 4. What the object model needs

| Need                               | Recommendation                                                                                                                                                                                                                         | Cost against the limits                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| More key colours                   | One key kind with `sub` the colour (0 red, 1 blue, 2 green, 3 gold), retiring kind 2 (#149 open point 2); a third and fourth switched door tile (green is id 35, as in Fizz 1). Objects `key-red`, `key-blue`, `key-green`, `key-gold` | No states, bindings or rules; the record is unchanged; key colour joins `pack_content()`                 |
| Several keys of a colour           | Ben holds a **count** per colour (0 to 3) instead of a flag; `holding` means at least one, `spend` takes one. E107 becomes "more than three keys of a colour"                                                                          | Four bytes in the hash for any level; no record change                                                   |
| One key opening several doors      | Two forms. **One state, many doors:** extra `door x=.. y=.. state=red-door open=open` lines on the lock's state, so the doors open together. **One key kept:** `lock ... keep` on each door                                            | Per extra door: 1 binding. Per kept-key door: 1 state, 1 binding, 1 rule                                 |
| A lock that is not a door          | Its state is an ordinary state: bind a light (`state=red-door on=open`), a panel, or later a platform. A keyhole with no door is `lock NAME key=K id=SWITCH`                                                                           | Per bound thing: 1 binding. Keyhole: 1 state, 1 rule, no binding. Platforms are binding kind 3, reserved |
| A lock needing two keys            | `lock NAME key=red,blue at=...`: one rule tests the first key and sets a hidden middle value, the second finishes; the state gets three values                                                                                         | 1 state, 1 binding, 2 rules                                                                              |
| A door that closes again           | An ordinary rule: `when state red-door becomes open after=300 then set red-door closed`                                                                                                                                                | 1 rule                                                                                                   |
| A state shared across levels (Q27) | **Level-scoped only in `LEVL` 2.** Reserve bit 0 of the state record's byte 2 as `WORLD` (must be zero). A later world-pack table, saved with progress and untouched by a death, can give it meaning without a new `LEVL` version      | Nothing now; later a world table and a save field                                                        |
| Key consumption and holding        | `spend` by default, `keep` to keep; keys never leave a level; a death returns them (D33)                                                                                                                                               | Nothing                                                                                                  |
| The death reset                    | Every state to its start, door bits recomputed, rule memory cleared, pending delays dropped, start rows fire again (#155 section 8). No per-state "survives death" flag: D33 says no such setting                                      | Nothing                                                                                                  |

A level of six locks spends 6 of 32 states, 6 of 32 door bindings and 6 of 32 rules: 6 × (8 + 16 + 48) = 432 bytes of `LEVL`. The rule budget is the one a busy level meets first; the Budget window shows the expanded count beside each lock.

## 5. What the studio needs from Fizz 2, and in what order

The studio links `fizz-script`, `fizz-pack` and `fizz-ep2` natively (D55, D58), so its editor is only as far along as those crates. The order that suits it:

| Step | Stack | What lands                                                                                                                                                                                             | What the studio gets                                                                            | What the studio stubs until then                                                                                                |
| ---- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 0    | All   | One documentation pass: #155, #149 and #152 amended to this note (the table in section 1)                                                                                                              | One contract to build the Rules window, the dump view and the checks against                    | Nothing: the studio's own `LANGUAGE.md` is corrected in the same pass                                                           |
| 1    | A     | `fizz-pack` reads and writes `LEVL` 2: state, binding and 48-byte rule records as public types, the reader checks with record indices, `pack_content()` with the new limits, and the slice regenerated | Exact byte counts for the Budget window, and record types for the dump view's byte toggle       | The length formula and a hand-written record encoder in `fizz-studio-profile`                                                   |
| 2    | B     | `fizz-script` parses and prints `state`, `door`, `when` and `lock` (lossless tree, canonical printer, corpus), before any lowering                                                                     | One parser for the canvas, completion, the Script window and the printer agreeing byte for byte | `crates/fizz-studio-dialect`'s stub keeps these lines raw; it gains a light reader for the four words to drive the Rules window |
| 3    | B     | `fizz-script` expands sugar with source spans (an `expand` API), resolves names and lowers to `LEVL` 2 through step 1's types; all E1xx and W1xx codes with corpus files                               | The dump view and the Checks window from the real baker                                         | The stub's own expansion, written from section 1, tested against the corpus once it exists                                      |
| 4    | C     | The rule phase for every input over `LEVL` 2, bindings recomputed each tick, the death reset, the lock moved to step 6                                                                                 | Playable rules in the Game view                                                                 | Rules shown as "accepted" (W106)                                                                                                |
| 5    | C     | The preview API (F6): `Preview::from_level`, `step`, `states`, `fired`, `events`, `reset` and `Clone`                                                                                                  | The rule debugger: state values per tick, which rows fired, scrubbing                           | A static view: the state table at its start values, no stepping                                                                 |
| 6    | A, C  | `pack_content()` exported as data (F2): the legend, key colours, trigger, condition and op tables, and capability states                                                                               | The `ep2` profile generated, not hand-kept                                                      | A hand-written profile table, checked by a test against step 1's constants                                                      |

- **Why A before C:** #156 can declare states only through the `World` API, because `LEVL` 1 cannot name one; rules work cannot be tested from a level file until step 1 lands.
- **Why the syntax half of B early:** the editor works on text first. Step 2 has no dependency on the bytes and can land beside step 1.
- **What can wait:** world-scoped states, platforms, panels, `use` on cells and the reserved conditions do not block the editor; the profile marks them reserved.

## Worked example

A red door with its key, and a lever that drives a lift and a light from one state. Platforms are reserved in Fizz 2 (binding kind 3), so the lift line parses and shows but is not baked (W109) until the game has level platforms.

```text
script fizz2 0
level "Lock Lab" 32x16 id=lock-lab
start 2,1

state lift values=down,up
lock red-door key=red at=15,2
when use id=lever-1 repeat then toggle lift, cue clunk at=6,1

objects
  key-red   id=red-key   at=4.5,6.7
  switch    id=lever-1   x=6 y=1 style=lever by=use
  light     id=lift-lamp at=10,9 radius=4 colour=yellow state=lift on=up
  platform  id=lift-1    x=10 y=1 to=10,9 state=lift on=up      // reserved
```

The expansion, as the baker sees it:

```text
state lift values=down,up
state red-door values=closed,open
door x=15 y=1..3 state=red-door open=open
when touch x=15 y=1..3 if state red-door is closed and holding key-red then set red-door open, spend key-red
when use id=lever-1 repeat then toggle lift, cue clunk at=6,1
```

The dump view:

```text
// dump: lock-lab.fizz — states 2/32, bindings 2/64 (1 door), rules 2/32, strings 0/32
state 0   lift       values=down:0,up:1 start=down              // line 5
state 1   red-door   values=closed:0,open:1 start=closed        // lock, line 6
door  0   x=15 y=1..3 state=1 open={1}                          // lock, line 6
light 1   object 2 (lift-lamp) state=0 on={1}                   // line 13
          platform lift-1: reserved, not baked (W109)           // line 14
rule  0   touch x=15 y=1..3 if s1 in {0} and holding red then set s1 1, spend red   // lock, line 6
rule  1   use object 1 (lever-1) repeat then toggle s0, cue 0x13 at 6,1           // line 7
```

Object indices follow the kind order (the key, then the switch, then the light). Pulling the lever toggles `lift`, which lights the lamp and, once platforms exist, sends the lift up; a death puts the lift down, closes the door and returns the key.

## Open questions

Each has the default this note uses until the owner or the Fizz 2 session decides.

1. **Lock timing.** Moving the lock from step 3 to the rule phase can reorder the slice's events within a tick (the door event after the snack events). Default: move it, prove the state hash unchanged, and re-pin the event transcript in the `LEVL` 2 change if it moves.
2. **Cell spelling.** `at=I,J` for a cell beside `x=I y=J` for a point at a cell's centre is two spellings near each other. Default: keep `at=I,J` for cells, as agreed.
3. **Held key counts.** A count per colour changes the hash of every level. Default: take it in the `LEVL` 2 change, when the hash moves anyway.
4. **`changes` as `arg` 0xFF.** Default: yes; it is a reader check and one dialect word.
5. **World-scoped states (Q27).** Default: level-only, with the reserved `WORLD` bit.
6. **The switch object's inputs.** `by=use,shot,stomp` maps to #149's switch flags. Default: that field name, with `use` the default.
