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
- [Frontend Code Conventions](#frontend-code-conventions)
- [Tauri v2](#tauri-v2)
- [Generated Files](#generated-files)
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

The repository's home is GitHub (`liminal-hq/fizz-level-studio`), so use `gh` for pull requests, labels, reviews and Actions. The old Forgejo repository is archived and read-only; don't use it.

## Local Tooling

- **Rust:** the toolchain is pinned in `rust-toolchain.toml` (1.98.0, with `rustfmt` and `clippy`), and the Cargo workspace at the root holds the pure crates under `crates/`. `scratch/rust/` is a separate workspace and is excluded. `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings` and `cargo nextest run --workspace` are the checks; the `ci` profile in `.config/nextest.toml` writes the JUnit report.
- **Runtime and package manager:** **Bun**, with the Node version in `.node-version`. `packages/mcp` has its own `package.json` and `bun.lock`; install there with `bun install`.
- **Formatting:** `.editorconfig` is authoritative (tabs, LF, UTF-8); `.prettierrc` matches it (`useTabs`, single quotes, trailing commas, 100 columns), and Prettier is pinned in `package.json`. `bun run format` writes and `bun run format:check` checks code, JSON, CSS and YAML (not Markdown; `markdownlint` covers that). The legacy sources listed in `.prettierignore` (`packages/language`, `packages/mcp`, and the older `tools/`) were written with spaces and stay as they are until a pure-whitespace change reformats them or the Rust port retires them. Rust is formatted by `rustfmt` with its defaults.
- **Commands:**
  - `bun run test` runs the language package's tests (`bun test packages/language`).
  - `bun run test:mcp` runs the MCP server's tests, including a real stdio round trip.
  - `bun run prove` and `bun run prove:all` rebuild levels from scripts and compare them with the game. They need Rust and the crates in the local Cargo cache (`--offline`), and build only inside `scratch/rust/`.
  - **Check groups:** `bun run check --groups docs,frontend` runs just those groups (`base` always runs; `--list` names them; no argument runs all, as `bun run validate` does). The groups are `base`, `docs`, `language`, `rust`, `frontend`, `app`, and `supply`, defined in `tools/check.sh`. In CI, `tools/ci-scope.sh` maps a pull request's changed paths to the groups they can affect through a first-match rules table, selecting every group for a path no rule knows, and each CI job runs only when its group is chosen; pushes to `main` and manual runs run everything. Adding a crate, package, or script means adding a rule to the table (`bun run check:scope` proves each rule against an example path).
  - `bun run validate` runs everything below, and the Rust checks, in one go before a commit; CI runs the same checks as separate jobs. `bun run check:headers`, `check:case`, `check:storage`, `check:boundaries`, `check:i18n`, `check:licences`, `check:bindings`, `check:bundles`, `check:fizz1`, `check:raster` and `check:docs` are the gate scripts in `scripts/`. `bun run bindings` regenerates the TypeScript types that `ts-rs` writes into `packages/protocol/src/generated/` from `crates/fizz-studio-protocol`; never hand-edit them.
  - `bun run check:stubs` lists the Fizz 2 stubs still in the workspace (each `stub.rs` names the change request it stands in for); it informs and never fails. A stub is deleted when the real implementation passes the same contract suite (`docs/BUILD-PLAN.md`, section 4).
  - `bun run dev` serves the webview alone, `bun run tauri:dev` runs the desktop app, `bun run typecheck` and `bun run test:js` check the frontend, and `bun run build` builds it into `apps/studio/dist` (the Tauri build needs it).
  - **Logs:** the webview's `console.*` calls and uncaught errors are forwarded by `src/services/logger.ts` into `tauri-plugin-log`, so they share the native stream. It goes to stdout and to a rotating file in the app's log directory (`~/.local/share/ca.liminalhq.fizzstudio/logs/` on Linux), at `Trace` and up in a debug build and `Info` and up in a release one. Each webview line is prefixed with its window label. Never log a level's script text or Claude's messages.
  - `packages/chrome` is a copy of Waypoint's shared window chrome (title bar, window menu, context menu, dialogs, settings shell), with `--fls-*` tokens; `PROVENANCE.md` there says which commit and how to bring fixes across. The app's own tokens are in `apps/studio/src/theme/tokens.css`.
  - **Windows:** every window is built in Rust (`apps/studio/src-tauri/src/windows.rs`); its label says what it is (`main-{n}`, `panel-{panel}-{n}`, `new-world`, `preferences`, `about`, `tear-ghost`), and each capability file in `capabilities/` names windows by those labels, one concern per file. A Rust test fails if a capability names a window the app cannot open. The webview opens one through `src/services/windowsClient.ts`.
  - **Settings:** Rust owns them (`crates/fizz-studio-settings`, wrapped by `plugins/fizz-studio-settings`). The file is `settings.json` in the app's config directory, with `settings.json.prev` as the generation before it and an unreadable file kept as `settings.json.unreadable-<n>`. The webview reaches them only through the plugin's `guest-js` (`getSettings`, `updateSettings` with the revision it was based on, `touchRecent`, `clearRecent`, `onSettingsChanged`), never by `invoke` and never by browser storage. `bun run build:plugins` builds the plugins' `dist-js` and runs before the app's `typecheck`, `test` and `build`.
  - **Worlds:** Rust owns every open level (`crates/fizz-studio-level`, a `LevelDocument` behind `fizz-studio-session`, wrapped by `plugins/fizz-studio-worlds`). The webview sends a `LevelEdit` with the revision it drew (`applyEdit`, `undo`, `redo`, `endStep`, `saveLevel`) and gets a `LevelSnapshot` back, which every window also hears as `level://changed`; a stale revision is refused, an edit is appended under `edits` and never rewrites a written line, and a file edited outside the studio becomes a revision marked `edited_outside` (or `level://conflict` when it collides with unsaved changes). Only `main-*` and `panel-*` windows are granted the plugin. Listeners use `newerOnly`, which ignores a revision at or below the one applied for that level.
  - **Frame stream probe:** `VITE_FIZZ_PROBE=frames bun run tauri:dev` streams 600 synthetic 320 by 200 frames from the game host at 60 frames per second, draws them, and logs one summary line (arrival gaps, decode and draw time); it exists to measure the stream on a real webview and never starts in a release build.
  - **The games:** `crates/fizz-studio-games` links Fizz 1 (`liminal-hq/lieutenant-fizz`) and Fizz 2 (`ScottMorris/lieutenant-fizz-2`) as git dependencies pinned by `rev`; bump a pin deliberately, in a reviewed change, never to a local checkout. `cargo deny check sources` allows only those two repositories.
  - `bun run lint:md` runs markdownlint over every Markdown file, and `bun run check:links` checks every relative link and anchor.
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
- The oblique ground is the Fizz 2 look, and a Fizz 2 level's canvas is drawn by the game's own presenter, linked natively into the studio's game host (D59), never imitated in TypeScript. Behaviours and rules run in the game's own interpreter, hosted the same way. The studio's pixel editor paints panels and drawn sprites.
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

`.github/workflows/ci.yml` runs one job per check on GitHub Actions (`ubuntu-24.04`) for every pull request and push to `main`: Format, Markdown lint, link check, language tests, MCP server tests (which installs the server's dependencies with `--frozen-lockfile`), Frontend tests, Rust format, Rust Clippy, Rust tests, bindings drift (Clippy and the tests run in the Liminal HQ Tauri CI container, which has WebKitGTK, after building the frontend), and the gate checks (licence headers, case collisions, browser storage, plugin boundaries, and dependency licences). The test jobs write JUnit XML (`bun run test:ci`, `bun run test:mcp:ci`, and nextest's `ci` profile), and `.github/workflows/publish-test-results.yml` posts the results to the pull request as a comment and a check run; it is a separate `workflow_run` workflow so that it also works for Dependabot and fork pull requests, and it takes effect once it is on `main`. The proofs need Rust and the game's crates, so they run locally, not in CI. `.github/dependabot.yml` is configured with every limit at zero, so it is off until someone raises them.

## Frontend Code Conventions

These apply to the desktop app once `apps/studio` exists (`spec/DESKTOP.md`).

- **No barrel files.** Don't create an `index.ts` or `index.tsx` that only re-exports from sibling files. Import directly from the file that defines the thing.
- **React 19 + TypeScript (strict) + Vite.** Function components only. One folder per area directly under `src/` (`app`, `canvas`, `panels`, `settings`, `services`, and so on).
- **The frontend renders; Rust decides.** The document, rules, checks, exporter and settings live in Rust. Frontend code reacts to commands and events and never re-derives domain rules. Ephemeral UI state (hover, drag pointer state, focus) stays in the frontend.
- **No browser storage for app state.** Preferences and window state go through the settings plugin; `localStorage`, `sessionStorage` and IndexedDB are not used. `scripts/check-browser-storage.sh` enforces it.
- **Styling:** CSS Modules plus CSS custom properties, with the `--fls-*` prefix and `data-fls-theme`, never Waypoint's `--wp-*` or Folio's `--folio-*`. No inline-style styling: a value that must be measured in script is passed to the stylesheet as a custom property. Colour literals live only in token files; component CSS uses `var(--fls-*)` with no inline fallback. The level canvas is never themed: the game's palette stays the game's palette.
- **Cursors:** the plain arrow over buttons, tabs and menu items; the pointing hand only for a real link that opens somewhere. Direct-manipulation surfaces keep their own cursors.
- **Accessibility is a build requirement, not a polish pass.** A component that is not keyboard-operable is not done.
- **All user-visible strings go through the message catalogue** (`apps/studio/src/i18n/messages.ts`, `t('area.thing')`), with no string literals in JSX. Error and lint messages are catalogue keys with arguments. The en-CA source has `{name}` tokens, `.one`/`.other` plurals and `// translator:` notes for ambiguous words, read with `t()` and `tn()`. `en-XA` (accented and lengthened) and `ar-XB` (right to left) are pseudo-locales offered only in a developer build, chosen with `VITE_FIZZ_LOCALE` until the settings plugin exists; fr-CA waits for a translator. `bun run check:i18n` fails on a visible literal in a `.tsx` file.
- **JavaScript reaches a native plugin only through its `guest-js` package.** Application code imports typed functions and never calls `invoke('plugin:...|...')` or listens for a plugin's event by string. `scripts/check-plugin-boundaries.sh` enforces it.
- **Module names never differ only by case.** `Canvas.tsx` beside `canvas.ts` is two files on Linux and one on Windows. `scripts/check-case-collisions.sh` enforces it.

## Tauri v2

The studio uses **Tauri v2** for desktop (Linux first, Windows 11). These are the house patterns and pitfalls from Folio, Waypoint, Spindle, Cadence and Jar.

- **Platform detection:** use `@tauri-apps/plugin-os`. `platform()` is synchronous. Prefer a plugin's availability status over platform checks when deciding whether a feature exists.
- **Prefer Tauri plugins over web APIs** when one exists, and use `async/await` for the async APIs.
- **Common v1 pitfalls:** many online resources describe Tauri v1. In v2, `tauri` becomes `app` in the config, `build.distDir` becomes `frontendDist`, `build.devPath` becomes `devUrl`, and `tauri.allowlist` is replaced by capabilities. `@tauri-apps/api` exports only `core`, `path`, `event` and `window`; the rest moved to `@tauri-apps/plugin-*`.
- **Permissions and capabilities (critical):** capability files live in `apps/studio/src-tauri/capabilities/`, one per concern. Installing a plugin is not enough. Every command in a plugin's `COMMANDS` list needs a matching entry in its `permissions/default.toml`, or a webview `invoke()` silently fails the ACL check even though the Rust command exists. Rust-side calls bypass the ACL, so check the ACL first when an invoke "does nothing".
- **Multiple webviews, one bundle.** Each window is a separate webview with its own JavaScript heap; route by window label and never assume state is shared across windows. Shared state goes through Rust.
- **The Linux webview is WebKitGTK.** Performance, `backdrop-filter`, transparency and Wayland behaviour differ from Chromium and WebView2. Verify visual and performance work on WebKitGTK.
- **Window frames and shadows differ per platform.** The OS draws the shadow and rounded corners on Windows; on Linux the chrome draws them in CSS inside a transparent margin. `data-platform` on the root element selects the tokens.
- **Logical versus physical pixels.** Positions from Rust are physical; `screenX` and `screenY` are logical. Convert with the monitor scale factor.
- **Background work and visibility.** Webview timers are throttled when a window is hidden, so long-running work (checks, bakes, playtests) runs in Rust and pushes events.

## Generated Files

Some files are generated and committed because something needs them without a build; the rest are build output and stay out of Git. Follow Folio and Waypoint.

**Committed, and checked for drift in CI:**

- `packages/protocol/src/generated/`: the TypeScript `ts-rs` writes from `crates/fizz-studio-protocol` (`bun run bindings`, `bun run check:bindings`). Never hand-edit.
- `plugins/*/api-iife.js`: rollup's bundle of each plugin's `guest-js`. Each plugin's `build.rs` points at it (`global_api_script_path`), so a plain `cargo build` works without a JavaScript build. `bun run build:plugins` rewrites it and `bun run check:bundles` fails when a committed one is stale or missing.
- The capability files in `apps/studio/src-tauri/capabilities/`, which are written by hand.

**Not committed (ignored):** `dist-js/` (the plugins' ESM and CJS bundles), `apps/*/src-tauri/gen/` (the app's capability schemas), and `plugins/*/permissions/autogenerated/` and `plugins/*/permissions/schemas/` (the permission files Tauri generates from each plugin's commands). Folio and Waypoint ignore these for app-specific plugins; Jar and Spindle commit them because their plugins are standalone and meant to be reused. If a plugin here is ever published on its own, commit its permission files then.

## Architecture Rules

- **The game owns the simulation.** Deterministic rules (physics, collision, enemy behaviour, timing) live in the game's Rust, and the studio never re-derives them in TypeScript outside `design/`.
- **The script is the source.** The canvas, Claude's view and every export derive from the text file.
- **Prove against the game's own data.** A claim of equality is checked by building the real thing and comparing.
- **Hand-written lines are never rewritten.** The studio rewrites only the object lines it owns (`spec/EDITOR.md`, section 4).
- **Claude proposes by default.** Accept, reject and the mode are the person's alone, and no MCP tool can change them.
- **The language package is pure.** No DOM, no storage, no network.
- **The desktop app follows the Liminal HQ Tauri standards** (`spec/DESKTOP.md`): Rust owns state (intents in, patches out, one writer, a revision on every change), pure crates with no `tauri` dependency, thin plugins with `guest-js`, windows created in Rust, no browser storage, every string from the catalogue. The planned domain logic is Rust, including a port of the TypeScript language package (D56); the games are linked natively, not run as WebAssembly (D59).
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
