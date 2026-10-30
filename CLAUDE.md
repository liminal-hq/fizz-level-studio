# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Fizz Level Studio is the level and overworld editor for Lieutenant Fizz, where a person and Claude design levels together. See `AGENTS.md` for the authoritative conventions — most importantly: **Canadian English** spelling and Oxford commas; **Conventional Commits** with a detailed body on every commit, ending with the `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` trailer; the licence header on every `.ts` and `.sh` file; **no pushes unless explicitly asked**; no scanlines in any art. `SPEC.md` describes the design.

## Status

The studio app is not built. What exists: the language package (`packages/language`), the MCP server for one level file (`packages/mcp`), the proofs that all 16 Episode 1 levels and the overworld rebuild the game's data exactly (`scripts/prove-all.sh`), and the design prototype (`design/`). The Fizz 2 dialect, the rule layer and the editor's Target setting are planned and documented (`docs/LANGUAGE.md`, `docs/EDITOR.md`, `docs/DECISIONS.md`) but not built.

## Commands

```bash
bun run test        # the language package's tests
bun run test:mcp    # the MCP server's tests (run `bun install` in packages/mcp once)
bun run prove       # Crater Fields and the kitchen sink against the game (needs Rust, offline)
bun run prove:all   # all 16 levels and the overworld against the game
bun run lint:md     # markdownlint over every Markdown file
```

Run `bun run test`, `bun run test:mcp` and `bun run lint:md` before every commit; run `bun run prove:all` after touching the parser, printer, exporter or overworld code.

## Architecture — the key things to understand

- **The script is the source.** A level is a `.fizz` text file; the canvas, Claude's view and exports derive from it. Statements run in file order; `y` counts up from the bottom.
- **The game owns the rules.** No physics, collision or enemy movement in TypeScript outside `design/`.
- **The `Builder` is the semantics** of the Fizz 1 language. Prove changes with `scripts/prove-all.sh`.
- **Hand-written lines are never rewritten**; the studio rewrites only the object lines it owns.
- **Claude proposes by default**; accept, reject and mode are the person's, not MCP tools.
- **Fizz 2 is a superset dialect** (`script fizz2 0`): `map` grids, `at=` and `x=`/`y=`, `chicken`, required `id=`, channels, locks and `when ... then ...` rules compiled at bake time into 32-byte records, error codes E001 to E016 plus E1xx, lints W1xx. The editor will have a Target setting (Fizz 1 or Fizz 2). The baker lives in the Fizz 2 repository, not here.

## Do not touch

`scratch/rust/` copied crates, `design/` (a record), and generated files (`levels/real/*.fizz`, `design/project/levels-data.js`, `lang-docs.js`); regenerate them instead. Never edit another repository.

## Repository metadata

The intended description and topic tags are in `AGENTS.md` under "Repository Metadata", for the owner to apply.

Keep this file and `AGENTS.md` in sync: when a convention changes there, update the summary here in the same commit.
