# AGENTS.md

## Table of Contents

- [Repository Metadata](#repository-metadata)
- [Project Status](#project-status)
- [Localization and Spelling](#localization-and-spelling)
- [Markdown Formatting](#markdown-formatting)
- [Authoring Voice](#authoring-voice)
- [Commit Messages](#commit-messages)
- [Pull Request Titles](#pull-request-titles)
- [Pull Request Content](#pull-request-content)
- [Pull Request Labels](#pull-request-labels)
- [Git Workflow](#git-workflow)
- [Local Tooling](#local-tooling)
- [The Language](#the-language)
- [The Fizz 2 Dialect](#the-fizz-2-dialect)
- [Testing](#testing)
- [CI](#ci)
- [Architecture Rules](#architecture-rules)
- [What Not to Touch](#what-not-to-touch)
- [Documentation](#documentation)
- [Repository Layout](#repository-layout)
- [Licence and Copyright](#licence-and-copyright)

## Repository Metadata

Applied to the GitHub repository `liminal-hq/fizz-level-studio`; nothing here is read by a tool.

- **Description:** A level and overworld editor for Lieutenant Fizz, with a plain-text level language, an MCP server for Claude and proofs against the game.
- **Topics:** `level-editor`, `lieutenant-fizz`, `game-tools`, `mcp`, `typescript`, `bun`, `tauri`, `tauri-v2`, `rust`, `desktop-app`, `liminal-hq`

## Project Status

Fizz Level Studio is the level and overworld editor for Lieutenant Fizz, where a person and Claude design levels together. The studio app itself is not built yet; its end goal is a Tauri v2 desktop app to the Liminal HQ Tauri standards (`spec/DESKTOP.md`, D54), with the standards taken from `folio/AGENTS.md` and the other Liminal HQ apps. What exists is the design (`spec/`, `docs/`, the prototype in `design/`), the language package (`packages/language`: parser, printer, edits, Rust exporter, overworld scripts and rasteriser, completion data), an MCP server that lets Claude read and propose edits to one level file (`packages/mcp`), and proofs that all 16 Episode 1 levels and the overworld, written as scripts, rebuild the game's own data exactly (`scripts/prove-all.sh`, `scratch/rust/`). The next work is the shared editor shell, then world projects and the Fizz 2 dialect with states and rules (see [The Fizz 2 Dialect](#the-fizz-2-dialect)); none of it is built in this repository yet. Update this section as each part lands.

## Localization and Spelling

**REQUIREMENT:** All code variables, comments, UI strings, commit messages and documentation MUST use **Canadian English** spelling, as the other Liminal HQ repositories do (British-leaning: `colour`, `centre`, `behaviour`, `licence` as a noun, `artefact`). Use Oxford commas.

Keep American spellings where an external API, library, file format or the game's own names require them (for example `color` in a CSS property, or the SPDX identifier `license`). No scanlines in any art.

## Markdown Formatting

**REQUIREMENT:** Do not hard-wrap markdown prose. Write each paragraph or bullet as a single unwrapped line in the source, and let the renderer reflow it. This applies to `README.md`, `CLAUDE.md` and everything under `spec/` and `docs/`. Commit message bodies are the one exception.

Use a real em dash (`—`) in prose, never `--` (a CLI flag excepted). `bun run lint:md` checks the rest.

## Authoring Voice

**REQUIREMENT:** Write every outward-facing line — code comments, identifiers, docs — as the author of the artefact, for the reader who will meet it later, not as a record of the process that produced it. Don't reference "this change", "this PR", a reviewer or a commit SHA in code, docs or PR prose; state the fact or the reasoning directly, as if it had always been true. When a comment has been edited more than once, rewrite it as one clean explanation. Commit messages are the place to record why a change happened.

## Commit Messages

**Format:** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `build:`, `ci:`, `chore:`), and a body on every commit that explains what and why, with bold labels instead of headings and every code-level reference in backticks. Hard-wrap bodies at roughly 72 to 100 characters. Write the message to a file and commit with `git commit -F`. The history opens with the import of the folder as it stood, which has a plain subject.

End every commit that an AI model helped write with a `Co-Authored-By:` trailer that names the model that produced the code and carries the address its vendor provides, for example `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Name the model actually used, not a fixed one, and add one trailer per model when more than one contributed.

## Pull Request Titles

**REQUIREMENT:** A PR title is a human-readable summary of the change, never a Conventional Commit.

- Start with a capital letter, write in the imperative mood, and keep to roughly 70 characters.
- No `feat:`, `fix:` or `chore:` prefixes.
- Describe the outcome, not the process.
- Keep the style consistent across the PRs in a stack; don't rename merged PRs unless asked.

## Pull Request Content

**Requirement:** Use outcome-focused language and leave out internal planning notes and workflow artefacts. Open PRs ready for review unless the user asks for a draft.

- Use `## Summary` with flat bullets that have **bold** lead-ins (and `###` subsections only when they help), then `## Test plan` as a checklist (`- [x]` / `- [ ]`) with the commands that were run.
- If something could not be verified, say so plainly at the end of the test plan.
- `.github/pull_request_template.md` has the shape.

## Pull Request Labels

**Requirement:** Add labels to every PR when it is created or updated.

- **Primary category** (at least one): `enhancement`, `bug`, `documentation`, `testing`, `ci`, `build`, or `chore`. Use these, not `feat` or `fix`.
- **Shared operational labels:** `infrastructure`, `internal`, `release`, `blocked`, `epic`, `skip-changelog`.
- **Scope labels:** technology (`frontend`, `backend`, `rust`, `plugin`, `data-model`), platform (`linux`, `windows`, `wayland`), cross-cutting (`architecture`, `spike`, `experimental`, `developer-experience`, `performance`, `security`, `accessibility`, `localisation`, `theming`, `design-system`), and the studio's own areas (`language`, `fizz-2`, `mcp`, `overworld`, `canvas`, `scripting`, `proofs`, `desktop`).
- `skip-changelog` excludes a change from the generated release notes, whose categories are in `.github/release.yml`.

## Git Workflow

**Requirement:** Never push, tag or dispatch a workflow unless the user explicitly asks. The default branch is `main`; never commit directly to it. Work on topic branches (`feat/<topic>`, `fix/<topic>`, `docs/<topic>`; for a fix tied to an issue, `fix/issue-<number>-<short-description>`) and merge through a pull request with a merge commit.

The repository's home is GitHub (`liminal-hq/fizz-level-studio`), so use `gh` for pull requests, labels, reviews and Actions. Forgejo holds a mirror; don't open pull requests there.

## Local Tooling

- **Runtime and package manager:** **Bun**, with the Node version in `.node-version`. `packages/mcp` has its own `package.json` and `bun.lock`; install there with `bun install`.
- **Formatting:** `.editorconfig` is authoritative (tabs, LF, UTF-8); `.prettierrc` matches it. The sources are not yet checked wholesale with Prettier, so format only the lines you touch.
- **Commands:**
  - `bun run test` runs the language package's tests (`bun test packages/language`).
  - `bun run test:mcp` runs the MCP server's tests, including a real stdio round trip.
  - `bun run prove` and `bun run prove:all` rebuild levels from scripts and compare them with the game. They need Rust and the crates in the local Cargo cache (`--offline`), and build only inside `scratch/rust/`.
  - `bun run lint:md` runs markdownlint over every Markdown file.
- **Before committing:** run `bun run test`, `bun run test:mcp` and `bun run lint:md`. Run `bun run prove:all` after any change to the parser, printer, exporter or overworld code.

## The Language

A `.fizz` file is one level or one overworld as plain text, read and written by the studio, by a person and by Claude. The Fizz 1 language is documented in `spec/LANGUAGE.md`: statements run in file order, ranges are inclusive, `y` counts up from the bottom, and errors have the codes E001 to E016. `parse(text)` never throws and keeps bad lines in the AST so a script always prints back unchanged. The language is a thin skin over the game's `Builder`; where a design idea disagreed with the `Builder`, the `Builder` won.

## The Fizz 2 Dialect

Planned, not built, and the more important target. Lieutenant Fizz 2 is a separate game that will bake its levels from `.fizz` sources. Its dialect is a **superset of the Fizz 1 script in text, not in meaning**: the two games are diverging. The design is the owner's (2026-11-04, `docs/DECISIONS.md` D42 to D53); what Fizz 2 lacks for it is a numbered change request (F1 to F23 in `docs/ENGINE-CHANGES.md`). Do not edit the Fizz 2 repository from here.

- The first line is `script fizz2 0` (dialect and version), written when the level is created: **a level's target is fixed for life**. Fizz 1 levels convert up to Fizz 2 with a conversion report; Fizz 2 levels export down to Fizz 1 with the lossy check, never a conversion.
- A Fizz 2 level belongs to a **world project** (`spec/WORLD.md`): levels, overworld, shared definitions, sprites (and the retro Fizz 1 art set, art only), parallax panels, sounds and strings, built by `fizz-bake` into one world pack.
- A level lowers to **`LEVL` version 2** (version 1 dropped): size, name, start, `floor_solid`, a state table, bindings, a tile map, objects, rules and strings.
- **States with rules:** `state NAME START [values=...]`; doors, lights and panels bind to a state; `when INPUT [if CONDITION] then ACTION, ACTION` rules change states from keys, switches, enemies cleared, timers and more; `lock red-door key=red at=X,Y` is sugar. Rules and objects raise floating words and sounds. Rules compile to fixed records; there is no rule VM and no rule text on DOS.
- **Custom enemies and items** have behaviour scripts compiled to bytecode and run by the game's interpreter under a per-tick step budget (`spec/SCRIPTING.md`). Fizz 1 levels keep the Fizz 1 roster.
- The syntax is the studio's proposal, overridden by `fizz-script` when it exists: a `map` block with the profile's legend, `at=X,Y` beside `x=`/`y=` (printed only for exact cell centres), an `objects` section with a required `id=` resolved to an index, placed `light` objects. Codes E001 to E016 are reused, the dialect adds E101 to E130 and the scripts E201 to E208; lints are W101 to W113 and W201 to W205.
- The **target profile** (`fizz1`, `ep2`, later `ep3`) holds content tables, limits, budgets, physics parameters (the wall-kick is core in Fizz 2) and a capability state per feature.
- The oblique ground is the Fizz 2 look, and a Fizz 2 level's canvas is drawn by the game's own presenter in WebAssembly, never imitated in TypeScript. Behaviours and rules run in the game's WebAssembly too. The studio's pixel editor paints panels and drawn sprites.
- The baker (`fizz-bake`), the parser crate (`fizz-script`), the packs, manifests and digests live in the Fizz 2 repository, and are plans there today. This repository owns the language reference and the editor; it must not copy the baker's rules.

`spec/LANGUAGE.md`, `spec/WORLD.md`, `spec/SCRIPTING.md`, `spec/EDITOR.md` (sections 13 to 15), `docs/FIZZ2-COVERAGE.md` and `docs/DECISIONS.md` carry the detail and the open questions.

## Testing

- Run the relevant tests after every change, and all three checks before committing.
- The language package is plain TypeScript with no DOM, so everything in `packages/language/src` is tested directly with `bun test`.
- A new statement needs a parser and printer round-trip test, an error-message test, and a proof case against the game when it maps to a `Builder` call.
- A new error code is added to `spec/LANGUAGE.md` in the same change, with a test that produces it.
- The MCP tests speak the protocol directly. Nothing has yet been run inside a real Claude Code session, and the docs say so.
- Prefer synthetic fixtures. Never commit an `.env`, a token or a path to a private machine.

## CI

`.github/workflows/ci.yml` installs the MCP server's dependencies with `--frozen-lockfile`, lints the Markdown and runs the language and MCP tests on GitHub Actions (`ubuntu-24.04`) for every pull request and push to `main`. `.github/dependabot.yml` is configured with every limit at zero, so it is off until someone raises them. The proofs need Rust and the game's crates, so they run locally, not in CI.

## Architecture Rules

- **The game owns the simulation.** Deterministic rules (physics, collision, enemy behaviour, timing) live in the game's Rust, and the studio never re-derives them in TypeScript outside `design/`.
- **The script is the source.** The canvas, Claude's view and every export derive from the text file.
- **Prove against the game's own data.** A claim of equality is checked by building the real thing and comparing.
- **Hand-written lines are never rewritten.** The studio rewrites only the object lines it owns (`spec/EDITOR.md`, section 4).
- **Claude proposes by default.** Accept, reject and the mode are the person's alone, and no MCP tool can change them.
- **The language package is pure.** No DOM, no storage, no network.
- **The desktop app follows the Liminal HQ Tauri standards** (`spec/DESKTOP.md`): Rust owns state (intents in, patches out, one writer, a revision on every change), pure crates with no `tauri` dependency, thin plugins with `guest-js`, windows created in Rust, no browser storage, every string from the catalogue. The planned domain logic is Rust, including a port of the TypeScript language package (proposed, D56); the games are linked natively, not run as WebAssembly (proposed, D59).
- **No barrel files.** Import from the defining file.

## What Not to Touch

- `scratch/rust/` is a copy of the game's crates where the proofs run, plus generated Rust. Do not edit the copied crates by hand; regenerate with the scripts. `scratch/rust/target/` and `scratch/truth/` are ignored build output.
- `design/` is a copy of the published design canvas. Treat it as a record, not as source to refactor. `design/project/levels-data.js` and `lang-docs.js` are generated by `tools/`.
- `levels/real/*.fizz` are written out from the game's data by `tools/decompile-level.ts`; regenerate instead of editing.
- Do not change the Fizz 1 behaviour of the parser, printer or exporter to suit the Fizz 2 dialect. The dialect is a superset, and `bun run prove:all` must stay green.
- Do not edit any other repository, push, or contact a server from here.

## Documentation

- Keep `README.md` and the relevant files in `spec/` and `docs/` in sync with behaviour in the same commit that changes it.
- Keep `CLAUDE.md` and this file in sync: when a convention changes here, update the summary there.
- Mark anything not built as planned, and say what is not decided.

## Repository Layout

- `packages/language/` — the language: `parser.ts`, `printer.ts`, `edits.ts`, `rust.ts`, `overworld.ts`, `docs.ts`, `tables.ts`, `errors.ts`, `cli.ts`, and its tests.
- `packages/mcp/` — the MCP server: `server.ts`, `tools.ts`, `studio.ts`, `world.ts`, `schema.ts`, `cli.ts`, and its tests.
- `tools/` — proof generators, verifiers, audits, the decompiler, data generators for the prototype, and `design-harness/` (Playwright suites for the design pages).
- `scripts/` — `prove-crater.sh` and `prove-all.sh`.
- `levels/`, `overworlds/` — the proven Episode 1 scripts.
- `scratch/` — the kitchen-sink script and the Rust proof workspace.
- `design/` — the design canvas copy and prototype.
- `spec/` — the product spec (`README.md`, `REQUIREMENTS.md`) and its design documents: goals, architecture, the desktop app, language, editor, overworld, MCP, world projects and behaviour scripting.
- `docs/` — decisions, roadmap, build plan, engine changes, testing, the Fizz 2 coverage table, open questions and risks.
- `assets/` — `hero.svg` (the animated README banner) and `icon/` (the logo set and avatars).

## Licence and Copyright

**REQUIREMENT:** Every `.ts` and `.sh` file starts with a licence header (after the shebang, for scripts):

```ts
// One-line summary of what this file does
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
```

Do not add headers to `.json`, `.svg`, `.yml` or `.md` files. The dual licence is `LICENSE-MIT` and `LICENSE-APACHE` in the repository root.
