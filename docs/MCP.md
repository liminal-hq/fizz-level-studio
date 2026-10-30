# The MCP server

How Claude works in Fizz Level Studio: the server as built in `packages/mcp/src`, its modes and the person's controls, the tools still to add, and how Claude and the person share one script.

## 1. As built

A stdio MCP server for **one level file**, built on `@modelcontextprotocol/sdk` (^1.32.1), server name `fizz-level-studio`, version `0.1.0`. It declares the `tools` capability only and opens no network ports.

```bash
bun packages/mcp/src/server.ts levels/crater-play.fizz     # the server (normally started by Claude Code)
bun test packages/mcp                                      # 21 tests, including a real stdio round trip
```

| File | Role |
| --- | --- |
| `server.ts` | Takes one `<level>.fizz` path (exits with status 2 if it is missing or not `.fizz`), lists `TOOLS`, routes calls to `callTool`, returns the text as content and the structured result as `structuredContent` |
| `tools.ts` | The nine tools: name, description, input schema, handler. `callTool` checks the input against the schema and never throws for a caller mistake |
| `studio.ts` | The `Studio` class: the level file, the sidecar, `edit`, `accept`, `reject`, `undo`, `setMode`, `addNote`; `validateLines`; `writeAtomic` |
| `world.ts` | The level rasteriser, the one-character renderer with ruler and legend, the pending-layer renderer, the gap check |
| `schema.ts` | A small JSON Schema checker for the subset the tools use (`additionalProperties: false` everywhere) |
| `cli.ts` | The person's command line: `mode`, `status`, `accept`, `reject`, `undo` |

The server's instructions to Claude: read with `get_level` and `get_region`, change with `edit_level`; in propose mode edits are only proposals the person accepts or rejects, and Claude cannot change the mode or accept anything.

### Files

- The **level file** is reloaded from disk on every call, so a change made in a text editor shows on the next read.
- The **sidecar** is `<level>.studio.json` beside it (`crater-play.fizz` → `crater-play.studio.json`): `{ version: 1, mode, nextId, nextNote, history, notes }`. An unreadable sidecar is treated as new, in propose mode, and is not overwritten until something is written.
- Both are written atomically: a temporary file `.<name>.<pid>.tmp` in the same folder, then a rename.
- The server and the CLI share the sidecar by read-modify-write with no lock; use one at a time.

### Tools

| Tool | Input | Returns |
| --- | --- | --- |
| `get_level` | none | Header (name, id, width, height, ground, theme, area), the script as numbered lines, parse errors, counts (tiles by kind, with pool cells as `liquid:<tile>`; enemies by kind; treats by kind), start, exit (cell count, first, up to 20), the mode, pending proposals and notes. Call it first. |
| `get_region` | `x0, y0, x1, y1` (integers, inclusive, clamped to the level), `include_pending?` | A text picture, top row first, one character per cell, with an x ruler, a y label on each row and a legend; the items, enemies, hover platforms and start inside; notes that touch the region; what the rasteriser draws and ignores. With `include_pending`, a second picture of only the cells pending proposals would change. |
| `list_kinds` | none | Every tile, item, enemy kind, terrain segment, liquid, level id, theme and area, from `tables.ts`, with the statement that places each |
| `edit_level` | `lines` (1 to 200 strings), `title` (1 to 120 characters), `why?` (up to 1,000) | The mode that applied, the history id, the status (`pending` or `applied`), the lines in canonical form |
| `get_proposal_state` | `id?` (such as `h3`) | One entry or all, with status and the person's reason |
| `add_note` | `{x, y}` or `{x0, y0, x1, y1}`, `text` (1 to 500) | The note (id `n1`, `n2`, …), kept in the sidecar, shown by `get_level` and by `get_region` for any window it touches |
| `run_checks` | `include_pending?` | Structural checks (`has_start`, `has_exit`, `has_treats`, `edits_in_bounds`), the gaps with their verdicts and rules, `playtest_bot: "not run"`, and how many need attention |
| `undo` | none | The id undone, or a refusal |
| `get_changes` | `since?` (`h4`) or `last?` (default 10) | History entries |

### How a write is checked

`validateLines` parses the lines inside a scratch script made of the level's real `level` header, `start 0,0` and `edits`, so bounds and word checks are the real ones and the reported line numbers are positions in the lines Claude sent. Then:

- Each entry must be one line (S001). Only `paint`, `clear` and `place` are accepted; blank lines, comments and any other statement (including the enemies and objects the language allows in `edits`) are refused with S002.
- Any parser error is returned with its code, the line's position, the message, the fix and the text.
- One bad line rejects the whole call, and nothing is stored.
- A level file that has parse errors blocks `edit_level` and the picture tools until the person fixes it; the errors are returned.
- Accepted and direct lines are appended with `appendEdits` and stored in canonical form (`formatNode`), so `paint one-way x=26,28,30 y=9` may differ in spacing from what Claude typed.

### Modes and the person's controls

| Mode | `edit_level` does | Level file |
| --- | --- | --- |
| `propose` (the default) | Records a `pending` history entry | Unchanged until the person accepts |
| `direct` | Appends the lines at once and records an `applied` entry, one undo step | Changed |

The mode lives in the sidecar and is set only by the CLI. No tool reads a mode from its input (an unknown field such as `mode` is rejected by the schema), and no tool changes it. Accept and reject are not MCP tools; the CLI stands in for the studio window's buttons:

```bash
bun packages/mcp/src/cli.ts mode propose|direct levels/crater-play.fizz
bun packages/mcp/src/cli.ts status levels/crater-play.fizz
bun packages/mcp/src/cli.ts accept <proposal-id|all> levels/crater-play.fizz [--reason "text"]
bun packages/mcp/src/cli.ts reject <proposal-id|all> levels/crater-play.fizz [--reason "text"]
bun packages/mcp/src/cli.ts undo levels/crater-play.fizz
```

- **Accept** revalidates each proposal against the file as it is now, appends it, marks it `accepted` with the time, `resolved_by: person` and the reason, and records the exact lines inserted. A proposal that no longer fits is reported and left pending; the CLI exits 1.
- **Reject** marks it `rejected` with the reason; the file is byte-identical.
- **Undo** (tool or CLI) reverts Claude's last `applied` step only: it removes exactly the inserted lines if they are still the last non-blank lines of the file, and refuses otherwise, changing nothing. Accepted proposals are not undone this way.

History statuses: `pending`, `accepted`, `rejected`, `applied`, `undone`. Ids run `h1`, `h2`, … in creation order. Every entry is `by: claude`; the person's own hand edits are not in the history (`get_level` always shows the current script).

### What the rasteriser draws

It draws terrain segments, liquid, walls, every tile fill, `plat`, `ladder`, stairs, `crystal`, `mural`, `wall-behind`, `vine-nook`, `room` and `secret-room` (as facade tiles in empty cells), `pogo-cache`, item and `row` lines, enemy and prop spawns, `hover` platforms (the line between their ends), `start`, exit tiles and the edits block. It ignores `theme` and `area`, the `arena` bounds, room bounds and the secret flag, and everything the game decides at run time. In a picture, two things in one cell show only the top one (start, then enemies, then items, then hover paths, then tiles).

### The gap check

On each surface row, a gap is a run of columns with nothing to stand on at that row or below, bounded left and right by columns that can be stood on in that row. Up to 3 wide is "a normal jump clears it", exactly 4 is "tight: only a jump timed within a tenth of a second of the edge", 5 or more is "needs a ledge or a hover platform". Pools count as gaps; spikes do not. Hover platforms are not surfaces. The widths are the stated design rule, not checked against the jump physics. On `crater.fizz` it reports a 4-wide pool, a 3-wide gap and a 6-wide pool.

### Limits

- One level file per server process; no overworld support.
- Claude can add `paint`, `clear` and `place` lines only. It cannot add enemies or objects, move or delete anything, or rewrite a line.
- `run_checks` never runs the playtest bot.
- `get_selection` is not implemented: there is no studio window to read a selection from.
- The server has been driven by the automated tests only, never inside a real Claude Code session.

## 2. Tools to add

Every new write tool follows the same rules: it is validated by the language package before anything is stored, it obeys the sidecar's mode (a pending proposal in propose mode, an applied undo step in direct mode), and it never accepts, rejects or changes the mode.

### The studio and the selection

| Tool | Input | Returns |
| --- | --- | --- |
| `get_selection` | none | The file, the selected cell or area, the selected object (kind, line, fields) or point, and the visible window |
| `list_files` | none | The level and overworld scripts in the workspace, with their kind and id; every other tool gains an optional `file` |

### Objects (the studio-owned-lines rule)

| Tool | Input | Effect |
| --- | --- | --- |
| `list_objects` | `file?` | Every object: `id`, kind (`lift`, `room`, `secret-room`, `arena`, `channel`; on an overworld `level`, `tele`, `saucer`, `sign`, `area`), line number, the line's text, its fields, and whether the studio owns it |
| `add_object` | `kind`, fields, `title`, `why?` | Proposes a new line (under `edits`, or a top-level line for `arena`) |
| `set_object` | `id`, `expect` (the line's current text), changed fields, `title`, `why?` | Proposes rewriting that one line in place; refused if the line's text is no longer `expect` |
| `remove_object` | `id`, `expect`, `title`, `why?` | Proposes turning the line into `// removed in the studio: ...` |
| `edit_level` (extended) | as now | Also accepts enemy lines, `hover`, `channel`, `room` and `secret-room`, as the language's `edits` block does |

Rewriting a line is a new kind of history entry: it records the line number, the text before and the text after, so accept can check the line is unchanged and undo can put the old text back.

### The overworld

| Tool | Input | Returns or effect |
| --- | --- | --- |
| `get_overworld` | `file?` | Header, start, areas, points (kind, name or level, position, `req`, `big`, `hidden`, partner), counts, the script with line numbers |
| `get_map_region` | `x0, y0, x1, y1`, `include_pending?` | A text picture of the map with points marked |
| `add_point` / `set_point` / `remove_point` | as the object tools, for `level`, `tele`, `saucer`, `sign` | Proposals; `set_point` covers moving, changing the level, the unlock rule, `big`, `hidden` and the teleporter partner |
| `set_unlock` | point `id`, `req` (level slugs or `secret`) | A proposal that rewrites the point's `req=` |
| `check_overworld` | `file?` | Each level has exactly one point; teleporter pairs point both ways; no point sits on a solid tile; no unlock cycles; every level reachable from the saucer through paths and teleporters; every `req` names a level on this map; and the requirement-mask limit (see `OVERWORLD.md` §5) |

### Paths, playtests and the language

| Tool | Input | Returns |
| --- | --- | --- |
| `get_enemy_paths` | `region?` | For each walking enemy, the cells it covers and where it turns, from the game's WebAssembly (`ARCHITECTURE.md` §5); refused with "not available" until that export exists |
| `run_playtest` | `route?` (waypoints), `options?` (`climb`, `fire`, `pogo`, `keep_enemies`) | Finished or not, ticks, the furthest waypoint, the best position, keys held; through the game's `playtest::solve`. `run_checks` reports its result instead of "not run". |
| `describe_word` | `word`, `scope?` (`level`, `overworld`) | The `docs.ts` entry: kind, section, syntax, example, note, fields, field notes |
| `check_lines` | `lines`, `file?` | The parser's verdict on lines without storing anything, for drafting |

### Fizz 2 (planned)

Not built, and not before the dialect exists in the language package (`ROADMAP.md`, M7). The same rules apply: validated by the language package, mode-obeying, and rule and lock lines are studio-owned lines.

| Tool | Input | Effect |
| --- | --- | --- |
| `get_level` (extended) | none | Also returns the Target (`fizz1` or `fizz2`), the channels with their start states, the locks and the rules as sentences |
| `list_rules` | `file?` | Every `when ... then ...` rule with its line, trigger, guard, actions and flags, and the lint codes that apply to it |
| `add_rule`, `set_rule` | the rule's fields | Writes one rule line as a proposal; refused on any error, including the 32-rule limit |
| `set_channel` | `channel`, `state` | Writes the explicit start state; proposes `allow W101` only when the person asks |
| `run_checks` (extended) | `target?` | Adds the Fizz 2 checks (ids, bounds, channels, limits, conflicts, W1xx lints) or, for Fizz 1, the export check (E120 to E122, W104) |
| `get_dump` | `file?` | Read only: the baker's disassembly of the level (objects and rule records), when the baker is available; otherwise a message that it was not run |

`run_checks` keeps the rule that it says which checks ran and which did not (G-TRUST-4): a dump or a bake that was not available is reported as "not run", never as passed.

## 3. Propose and direct in the studio

- **Propose** (the default): Claude's change is a pending proposal. The studio shows it as dashed purple ghosts and as hunks in Review changes. Nothing reaches the file until the person presses Accept (or Accept all). Reject leaves the file byte-identical.
- **Direct**: a switch only the person turns on, meant for drafts. Claude's change is applied at once and is one step in the person's undo history; the toast offers Undo.
- The switch is in the Claude tab and the Claude menu, written to the sidecar by the studio; MCP tools can read the mode in their results but never set it.

## 4. Sharing one script

Claude and the person edit **the same `.fizz` file**. There is no second copy to merge.

1. The file on disk is the truth. The studio and the MCP server both read it; the server rereads it on every call.
2. The person's edits in the studio are saved to the file (appended under `edits`, or rewriting an owned object line). They are not MCP history entries; Claude sees them on its next `get_level` or `get_region`.
3. Claude's edits in propose mode live only in the sidecar until accepted. The studio watches the sidecar and draws pending proposals as ghosts.
4. Accepting appends (or rewrites) through the language package against the file as it is then, so a proposal made before the person's own edit is checked again. A proposal that no longer fits is shown as a conflict and stays pending.
5. Claude learns what happened through `get_proposal_state` and `get_changes`, including the person's reason.
6. Notes (`add_note`) are Claude's remarks pinned to a tile or rectangle, kept in the sidecar, never in the script.
7. Undo is per author: the studio's undo covers the person's steps and direct-mode steps from Claude; the `undo` tool covers only Claude's own last applied step and refuses if anything came after it.

Open: two processes writing the sidecar need a lock or a single writer (the studio), with the CLI retired once the studio's buttons exist.

## 5. Adding it to Claude Code

The README shows `claude mcp add` and a project `.mcp.json` for the current server. Work on a copy of a level (`cp levels/crater.fizz levels/crater-play.fizz`), because accepted and direct edits change the file.
