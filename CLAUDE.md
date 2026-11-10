# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Fizz Level Studio is the level and overworld editor for Lieutenant Fizz, where a person and Claude design levels together. See `AGENTS.md` for the authoritative conventions — most importantly: **Canadian English** spelling and Oxford commas; **Conventional Commits** with a detailed body on every commit, ending with a `Co-Authored-By:` trailer that names the AI model used (for example `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`), but **never in PR titles** (human-readable, imperative, with labels on every PR); the licence header on every `.ts` and `.sh` file; **no barrel files**, no browser storage and every visible string through the message catalogue once the desktop app exists; **no pushes unless explicitly asked**; the repository's home is GitHub (`liminal-hq/fizz-level-studio`, use `gh`; the old Forgejo repository is archived); no scanlines in any art. `spec/README.md` describes the design.

## Status

The studio app is not built; its end goal is a Tauri v2 desktop app to the Liminal HQ standards, Linux first and Windows 11, no mobile (`spec/DESKTOP.md`). What exists: the language package (`packages/language`), the MCP server for one level file (`packages/mcp`), the proofs that all 16 Episode 1 levels and the overworld rebuild the game's data exactly (`scripts/prove-all.sh`), and the design prototype (`design/`). The Fizz 2 dialect, states and rules, world projects, behaviour scripting, the target profiles, the sprite tools and the pixel editor are planned and documented (`spec/LANGUAGE.md`, `spec/WORLD.md`, `spec/SCRIPTING.md`, `spec/EDITOR.md` sections 13 to 15, `docs/FIZZ2-COVERAGE.md`, `docs/DECISIONS.md`) but not built.

## Commands

```bash
bun run test        # the language package's tests
bun run test:mcp    # the MCP server's tests (run `bun install` in packages/mcp once)
bun run prove       # Crater Fields and the kitchen sink against the game (needs Rust, offline)
bun run prove:all   # all 16 levels and the overworld against the game
bun run lint:md     # markdownlint over every Markdown file
bun run check:links  # every relative Markdown link and anchor resolves
cargo nextest run --workspace  # the Rust crates' tests (with cargo fmt and clippy)
```

Run `bun run test`, `bun run test:mcp`, `bun run lint:md` and `bun run check:links` before every commit (and the Rust checks when a crate changed); run `bun run prove:all` after touching the parser, printer, exporter or overworld code.

## Architecture — the key things to understand

- **The script is the source.** A level is a `.fizz` text file; the canvas, Claude's view and exports derive from it. Statements run in file order; `y` counts up from the bottom.
- **The game owns the rules.** No physics, collision or enemy movement in TypeScript outside `design/`.
- **The `Builder` is the semantics** of the Fizz 1 language. Prove changes with `scripts/prove-all.sh`.
- **The script is one document, edited by peers** (the canvas, the code editor and Claude): structured edits rewrite only the statements they touch and keep comments and formatting, nothing is read-only, and every change is one named undo step (D68, superseding D8 to D10; the Inspector, Delete, F, the arrows and the Erase tool move, turn and delete an item, an enemy or the start by rewriting its own statement, a painted tile is still appended under `edits`, and an outside change comes in whole as one undo step, D72).
- **Claude is a peer with two modes**, Direct and Review, switchable by the person and by Claude over MCP; accepting its own proposals or widening its mode is lightly discouraged, not blocked. In the desktop app the MCP server is a stdio sidecar relaying to the running app (proposed, D57), separate from the debug-only `tauri-plugin-mcp-bridge` used for tests.
- **Right-click menus are the studio's own (D74).** One host per window; a surface hands a `ContextTarget` to `useContextMenu().open`, and every row is a registry command (a text field's own actions are the one exception). The native menu is blocked everywhere, and Shift+right-click shows it in debug builds only.
- **The desktop app** follows the Liminal HQ Tauri standards: Rust owns state, pure crates, thin plugins, windows in Rust, no browser storage. Domain logic is planned in Rust (the language package ported, D56) with both games linked natively (D59).
- **Fizz 2 is the more important target, and a superset dialect in text only** (`script fizz2 0`): the games diverge in meaning. A level's target is fixed at creation (Fizz 1 converts up, Fizz 2 exports down). Fizz 2 levels live in world projects built into one world pack, lower to `LEVL` version 2, and use named states with rules (`lock` is sugar), placed lights, raised words and sounds, and custom enemies and items with behaviour scripts compiled to bytecode. The syntax is the studio's proposal, overridden by `fizz-script`; codes E101 to E130, E201 to E208, lints W101 to W113, W201 to W205. The game's look and the behaviours run in the game's own Rust code, linked natively into the studio's game host, never in TypeScript. Fizz 2 work the studio needs is change requests F1 to F28; the Fizz 2 repository is not edited from here.

## Do not touch

`scratch/rust/` copied crates, `design/` (a record), and generated files (`levels/real/*.fizz`, `design/project/levels-data.js`, `lang-docs.js`); regenerate them instead. Never edit another repository.

## Repository metadata

The intended description and topic tags are in `AGENTS.md` under "Repository Metadata", for the owner to apply.

Keep this file and `AGENTS.md` in sync: when a convention changes there, update the summary here in the same commit.
