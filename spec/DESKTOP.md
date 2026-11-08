# The desktop app

Fizz Level Studio's end goal is a **desktop app built with Tauri v2, following the Liminal HQ Tauri standards** that Folio, Waypoint, Jar and Cadence follow (owner decision, 2026-11-04; `DECISIONS.md` D54). This page is that app's shape: platforms, stack, repository layout, the crates and plugins, who owns state, windows, settings, files, packaging, CI and what is out of scope. **None of it is built.** Everything marked **Proposed** is a recommendation for the owner; everything else is the Liminal HQ standard, cited to the reference repository it comes from (all under `~/source/liminal-hq/`).

`folio/AGENTS.md` is the fullest statement of the standard and is the main reference; where Folio's practice differs from its own rule, this page says so.

## 1. Platforms

| Platform                                             | Status                                                                                | Source                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Linux, Wayland first (GNOME, KDE, Cinnamon), X11 too | Primary                                                                               | `folio/README.md`, `folio/AGENTS.md`; `waypoint/AGENTS.md` ("Linux (primary)") |
| Windows 11, x64 and arm64                            | A real target, written alongside Linux                                                | `folio/README.md`; `waypoint/AGENTS.md` ("Windows 11 (a real target)")         |
| macOS                                                | Not planned (as Folio and Waypoint; Jar and Fizz Desktop do ship it)                  | `folio/README.md`; `waypoint/docs/architecture/ci-cd.md` §4                    |
| Android, iOS, any mobile                             | **Out of scope** for the studio                                                       | Owner direction                                                                |
| A browser build as a product                         | **Out of scope**; the design prototype in `design/` stays a browser page, as a record | Owner direction                                                                |

The app identifier follows the pattern `ca.liminalhq.<name>` (`ca.liminalhq.folio`, `ca.liminalhq.waypoint`, `ca.liminalhq.lieutenantfizz`). **Proposed:** `ca.liminalhq.fizzstudio`, which also names the data and log directories, as Folio's does (D-10 in `folio/docs/decisions.md`). The product name stays Fizz Level Studio (Q36).

## 2. Stack

| Part               | Standard                                                                                                                                                                                                                     | Source                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Shell              | Tauri v2 (`tauri = "2"`, `tauri-plugin = "2"` as workspace dependencies)                                                                                                                                                     | `folio/Cargo.toml`                                                             |
| Frontend           | React 19, TypeScript strict, Vite, function components only, CSS Modules, no inline styles                                                                                                                                   | `folio/AGENTS.md` "Frontend Code Conventions"; `folio/apps/folio/package.json` |
| JavaScript tooling | Bun workspaces (`apps/*`, `packages/*`, `plugins/*`), Node pinned in `.node-version` (24.14.0 in Folio), Prettier with tabs, single quotes, 100 columns; `.editorconfig` authoritative                                       | `folio/AGENTS.md` "Local Tooling"; `folio/package.json`                        |
| Rust               | A Cargo workspace; `rust-toolchain.toml` pins the toolchain with rustfmt and clippy (1.98.0 in Folio, Waypoint, Cadence and Fizz Desktop); edition 2021, resolver 2, `license = "Apache-2.0 OR MIT"`, release `strip = true` | `folio/rust-toolchain.toml`, `folio/Cargo.toml`                                |
| Shared types       | Defined once in Rust and generated with `ts-rs` into `packages/protocol`, never edited by hand, with a drift check                                                                                                           | `folio/AGENTS.md` "Architecture Rules"; `scripts/check-bindings-drift.sh`      |
| Long-running work  | Rust worker threads, not webview timers (which throttle in hidden windows)                                                                                                                                                   | `folio/spec/02-architecture.md` "Threading"                                    |

## 3. Repository layout

The studio moves to the standard layout as M1 is built. **Proposed** names; the shape is the standard's (`folio/AGENTS.md` "Repository Layout").

```text
fizz-level-studio/
  apps/studio/                  the app: src/ (React, one folder per area) and src-tauri/ (a thin composition root)
  crates/                       pure Rust, no tauri dependency, tested headlessly
  plugins/                      Tauri plugins: each a Rust crate plus guest-js; copied ones carry PROVENANCE.md
  packages/chrome/              the shared React chrome (title bar, window menu, context menu, dialogs, settings shell), copied from Waypoint with the studio's own tokens
  packages/protocol/            ts-rs generated types only
  packages/language/            the current TypeScript language package, kept as the reference until the Rust port matches (D56)
  packages/mcp/                 the current TypeScript MCP server, until the Rust host replaces it (D57)
  spec/                         the authoritative design: what the app does
  docs/                         decisions, developer documents, references (today's docs/ until spec/ is split out)
  design/                       the design canvas and prototype: reference only, never ported or mirrored
  levels/, overworlds/          the proven Episode 1 scripts
  scripts/                      the gate's checks (headers, boundaries, storage, licences, bindings)
  packaging/                    agent launchers and installers
```

- **`spec/` versus `docs/`.** In the standard, behaviour lives in `spec/`, decisions in `docs/decisions.md` with D-numbers, and boundary changes in `spec/02-architecture.md` (`folio/AGENTS.md` "Documentation"). Today this repository keeps both in `SPEC.md` and `docs/`; the split happens in M1 (Q37).
- **`design/`** stays a reference: "do not port, adapt or structurally mirror its code" (`folio/AGENTS.md`), which is already this repository's rule.
- **`packages/chrome`** comes from Waypoint, as Folio's did, with renamed tokens (`--fls-*` and `data-fls-theme` proposed, never another app's prefix) and colour literals only in token files (`folio/docs/decisions.md` D-08, D-09; `folio/AGENTS.md`).
- **Scaffold only what the milestone needs** (`folio/AGENTS.md`).

## 4. Crates and plugins

The rules (`folio/AGENTS.md` "Architecture Rules"):

- **Concern-first split:** each concern is its own crate or plugin; the app crate composes them and implements no concern itself.
- **Pure crates for logic, thin plugins for the Tauri surface:** logic lives in `crates/*` with **no `tauri` dependency**; a plugin is the adapter (commands, events, managed state, permissions).
- **Plugins never call each other;** cross-concern behaviour is composed in the app crate through traits defined in the pure crates (Folio's `Host` trait in `folio-engine`, implemented by `TauriHost` in `plugins/folio-books/src/host.rs`).
- **JavaScript reaches a plugin only through its `guest-js`,** never a raw `invoke('plugin:...')` (`scripts/check-plugin-boundaries.sh`).
- **Every plugin reports availability** with a status command; platform code sits in `linux.rs`, `windows.rs` and `unsupported.rs`.
- **Published plugins are registry dependencies; unpublished ones are copied** into `plugins/` with a `PROVENANCE.md` (`folio/docs/decisions.md` D-08).

### Crates (Proposed)

| Crate                  | Concern                                                                                                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fizz-studio-language` | The Fizz 1 dialect, ported from `packages/language`: lossless parse, print, edits, the owned-line rewrite, the overworld, the Rust exporter, the word docs for completion (D56)                                                                                                                  |
| `fizz-studio-dialect`  | The Fizz 2 dialect's studio side: the editor's view of `fizz-script`'s AST (linked natively, D55), owned-line rewrites, `lock` expansion for display, rule sentences, completion                                                                                                                 |
| `fizz-studio-profile`  | Target profiles and capability states, from the games' generated tables (D58)                                                                                                                                                                                                                    |
| `fizz-studio-world`    | World projects and Fizz 1 project folders: the file set, canonical writes, file watching, autosave and recovery                                                                                                                                                                                  |
| `fizz-studio-session`  | The document model per open world or level: revisions, patches, named undo and redo, proposals, after Folio's `folio-session`                                                                                                                                                                    |
| `fizz-studio-states`   | States, bindings and rules as a model: checks, the States lens's data, the conversion of Fizz 1 channels                                                                                                                                                                                         |
| `fizz-studio-art`      | Sprite grids and panels: canonical reading and writing, pixel operations, PNG import and quantisation to the 16 EGA colours                                                                                                                                                                      |
| `fizz-studio-budget`   | The Budget window's meters, each with its source                                                                                                                                                                                                                                                 |
| `fizz-studio-export`   | Export to Fizz 1 with the lossy check, Convert to Fizz 2 with its report                                                                                                                                                                                                                         |
| `fizz-studio-bake`     | The adapter to `fizz-bake` and `fizz-pack`: Build world, Check world, dump, size reports                                                                                                                                                                                                         |
| `fizz-studio-host`     | The game host: a `GameHost` trait with a Fizz 2 implementation (linking `fizz-ep2`, `fizz-slice-view` and the behaviour interpreter) and a Fizz 1 implementation (linking `lf-episode-1`): the Game view's frames, rule previews, the behaviour debugger, enemy paths and the playtest bot (D59) |
| `fizz-studio-mcp`      | Claude's MCP server (`rmcp` over stdio, as `folio-mcp` is), live and headless (D57)                                                                                                                                                                                                              |
| `fizz-studio-protocol` | The shared types, exported with `ts-rs`                                                                                                                                                                                                                                                          |

### Plugins

| Plugin                                                                          | Origin                                                                             | Concern                                                                                                                         |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `tauri-plugin-fizz-studio-worlds`                                               | Proposed, domain                                                                   | Open, save and watch worlds and levels; sessions, intents, patches, history; recent worlds                                      |
| `tauri-plugin-fizz-studio-host`                                                 | Proposed, domain                                                                   | The game host's commands and its `Channel` streams                                                                              |
| `tauri-plugin-fizz-studio-art`                                                  | Proposed, domain                                                                   | The Sprites window and the pixel editor's commands                                                                              |
| `tauri-plugin-fizz-studio-bake`                                                 | Proposed, domain                                                                   | Build world and its progress stream                                                                                             |
| `tauri-plugin-fizz-studio-agents`                                               | Proposed, domain                                                                   | The live socket the MCP server relays to, and the person's accept and reject (D57)                                              |
| `tauri-plugin-fizz-studio-settings`                                             | Proposed, domain, modelled on `plugins/folio-settings`                             | The typed, versioned settings document (section 7)                                                                              |
| `tauri-plugin-window-tearoff`                                                   | Copied from `waypoint/plugins/window-tearoff` with `PROVENANCE.md` (not published) | Tearing panels off into windows and docking them back                                                                           |
| `tauri-plugin-window-effects`                                                   | Copied from `waypoint/plugins/window-effects` (not published)                      | Mica, acrylic and blur behind the chrome                                                                                        |
| `tauri-plugin-system-appearance`                                                | Published (`liminal-hq/tauri-plugins-workspace`, 0.1)                              | Colour scheme, accent, contrast, motion, transparency, text scale                                                               |
| `tauri-plugin-window-manager`                                                   | Published (same workspace, 0.1)                                                    | Window placement services, as Folio uses it                                                                                     |
| `tauri-plugin-store`, `-log`, `-dialog`, `-single-instance`, `-prevent-default` | Tauri's own                                                                        | Settings storage, logging, native dialogs, one instance, no browser shortcuts in release (`folio/docs/decisions.md` D-51, D-52) |
| `tauri-plugin-mcp-bridge`                                                       | Tauri ecosystem, **debug builds only**                                             | Driving the running app from `tauri-mcp-server` in tests (section 13); unrelated to Claude's design MCP                         |

There is no shared settings plugin in `tauri-plugins-workspace`; each app writes its own domain settings plugin (`waypoint-settings`, `folio-settings`), so the studio does too.

## 5. Who owns state

The standard: "One writer per piece of state, a monotonic revision on every mutation, and granular events after each change. Streaming data uses Tauri `Channel`s, not polled commands", and "the frontend renders; Rust decides" (`folio/AGENTS.md` "Architecture Rules", "Frontend Code Conventions"; Folio's D-02: "the document model lives in Rust and is the source of truth; the UI sends intents and receives patches").

For the studio:

- **Rust owns each open world and level.** `fizz-studio-session` holds the parsed scripts, the derived models (tiles, objects, states, rules, definitions), the proposals and the history. The frontend sends **intents** (paint these cells, move this object, set this state's start value, accept this proposal) and receives **patches** that carry the new revision; it never edits a script itself.
- **One writer.** Every change to a world, from the person, from Claude or from a hand edit noticed on disk, goes through its session's single writer, so the script, the canvas and Claude see one sequence of revisions (G-AI-3).
- **History in Rust.** Named undo and redo live in the session, shared by every window of the world, with entries that coalesce a stroke or a drag into one step, as `crates/folio-session/src/session.rs` does (`revision`, `saved_revision`, `undo`, `redo`, merge keys). The studio's rules carry over: each paint stroke, stamp, drag, typed line and accepted hunk is one named step; Claude's steps are marked as Claude's.
- **Stale answers are refused.** Anything computed for the view (a layout, a Game view frame, a lens) carries the revision it was computed from, and the frontend never draws it over a newer state (Folio's D-20).
- **Channels for streams:** the Game view's frames, rule-preview and behaviour-debugger traces, playtest progress and Build world's progress are `tauri::ipc::Channel` streams. Jar does this for its simulation (`Channel<SimEvent>`, `jar/AGENTS.md`); Folio states the rule but sends its export progress as a plain event, so the studio follows the rule, not Folio's practice.
- **Ephemeral UI state** (hover, the drag in progress, focus, the ring menu) stays in the frontend.

## 6. Windows

Windows are **created in Rust**, never declared in `tauri.conf.json` (`"windows": []`; Folio's D-13, `apps/folio/src-tauri/src/windows.rs`; Waypoint's `WindowFactory`). They are frameless and transparent with the chrome's title bar, and on Linux the chrome draws the shadow in a transparent margin (`folio/AGENTS.md`). State is never assumed to be shared between webviews: it goes through Rust.

**Menus and titles (D66).** The main window's primary menu is the app menu button at the left of its title bar, which opens File, Edit, View, Window and Help; with `ui.menu_bar` off (the default) the app menu is one flat list of the common commands (New, Open, Save, Close, Undo, Redo, the Menu bar, Toolbar and Ribbon switches, Panels, Window, Command palette, Preferences, Help, Keyboard shortcuts, About, Quit, D70), and when the person turns on `ui.menu_bar` in Preferences (General) the commands sort into File, Edit, View, Window and Help in a bar below the title bar and the button is plain text. Under them the commands row is the classic toolbar by default, or the ribbon or nothing (`ui.toolbar`, `ui.ribbon_folded`; the settings document is version 8). One command registry feeds every menu, the toolbar, the ribbon, each panel's ⋮ menu, the palette, the shortcuts table and the key dispatcher. A window's title bar and its native title (the taskbar and Alt+Tab) show the same text and never the app name: the open level's name (with a bullet after it while it has unsaved changes), Start on the start screen, or the window's own name (New level, Preferences, a panel's name). The app name stays in the app menu button and the About window.

**Dragging a panel out and back.** Besides the panel menu's Tear off and Dock back, a panel can be dragged: by its header grip, its rail entry, or (for the Script) its tab. The pointer leaving the main window hands the drag to the tear-off plugin, and the route is chosen from what the plugin probes, never from the platform. Where the compositor offers `xdg-toplevel-drag` (`toplevel_drag`, Wayland), the panel's window is made hidden and the compositor drags it with the pointer for the whole drag; a cancel closes it again, and a drop over the main window's docks docks the panel there. On X11 and Windows (`ghost` with `cursor_follow`), the plugin's ghost card follows the cursor, and a release over no region of the app opens the panel's window with its top-left at the cursor less where the card was held; the place is recorded per workspace (D65). Where neither works, the drag is cancelled with a note and the panel menu's rows remain. The main window registers a region for each place a panel can land (a dock, each tab group, the rail and its entries, and the level), named so a hit says the place (`zone:left`, `group:right:0`, `rail:left:0:1`, `level`). Dragging the tab (the Script) or the title of a torn-off panel's window back over them docks it there: the panel window sends `dockBackTo {zone, group, index}` over the panel bridge (and `dockHint` while it hovers, so the main window shows where it would land), or, under the compositor's drag, the plugin sends the main window the drop itself. The panel then docks in the main window, which closes its window, and its header and rail entry are marked for a moment. A release over the level docks the panel back to where it was. Real drags across windows are native and cannot be driven by synthetic events, so the decision logic is unit-tested against a fake plugin and the drags themselves are checked by hand on each desktop.

**Closing a window has one path, shared with Quit (D64).** A close request arrives in Rust as `WindowEvent::CloseRequested` from either origin: our own title bar (the frameless window's X, its window menu's Close row and the title bar actions all call the plain window close) or the shell (window manager, compositor, taskbar, Alt+F4, a compositor's window menu). Rust prevents it and routes by the window's kind: the last main window runs the whole-app quit round, one of several runs a round with only that window and then closes it and its torn-off panels, the panel, Preferences, About and ghost windows close at once, and the New level window asks its page, which prompts only when the form has input. An exit that no finished round asked for is held back and put through the round, except a non-zero code (restart, failure); a session end is not prompted, and the recovery copy carries unsaved work. The commit also flushes settings writes waiting on a pause.

The Ultimate layout's floating windows live inside the main window as panels; **popping a panel out is tear-off** (Waypoint's `window-tearoff`: a drag past a threshold, a ghost window, drop regions, docking back), so the script's "Display 2" pop-out, a torn-off Game view and a torn-off Rules window are real windows. **Proposed** labels:

| Label              | Window                                                                                          | Capabilities (by concern)                                          |
| ------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `main-{n}`         | A world or a Fizz 1 project, with the canvas and docked panels                                  | chrome, logging, settings, worlds, host, art, bake, agents, dialog |
| `panel-{kind}-{n}` | A torn-off panel (script, Game view, Rules, States, Budget, Sprites, Navigator, Review changes) | chrome, logging, settings, worlds, and host for the Game view only |
| `pixel-{n}`        | The pixel editor (`EDITOR.md` section 15)                                                       | chrome, logging, settings, art, dialog                             |
| `behaviour-{n}`    | The behaviour editor and debugger (`SCRIPTING.md`)                                              | chrome, logging, settings, worlds, host                            |
| `new-world`        | The New world and New level dialog that fixes the target                                        | chrome, logging, settings, worlds, dialog                          |
| `preferences`      | Preferences                                                                                     | chrome, logging, settings                                          |
| `about`            | About and third-party notices                                                                   | chrome, logging                                                    |
| `tear-ghost`       | The tear-off ghost                                                                              | `window-tearoff:default` only                                      |

Capabilities are one file per concern listing the labels it applies to (least privilege, `folio/AGENTS.md`; Folio's `src-tauri/capabilities/`), with the MCP bridge in a `dev-automation.json` for debug builds only.

## 7. Settings, recent worlds and no browser storage

- **A typed, versioned settings document** owned by the studio's settings plugin, with one writer and a revision, stored through `tauri-plugin-store` in the app data directory, a previous generation kept for recovery and an unreadable file set aside rather than lost (Folio's D-11 and `src-tauri/src/storage.rs`; `plugins/waypoint-settings/README.md`). It holds the theme, the window layouts (the Ultimate layout's saved arrangement), window geometry, zoom, the autosave interval, recent worlds and projects, and the paths to the game repositories.
- **The look is Neo-Glass Tactile (direction K, D61).** Floating panels are glass (`--fls-glass-*` tokens: a gradient, a blur, a light border, a deep shadow with an inset highlight) and every pressable control is a keycap (`--fls-key-*`, in `packages/chrome/src/Keycap/keycap.module.css`) with a fixed height, 2px of travel and the active tool lit in the accent (`--fls-lit-key-*`). Dark and light schemes follow the system or the `ColourMode` setting. The accent comes from the system-appearance plugin when it supplies one (`theme/accent.ts` derives the deeper stop, the edge, the label colour and the panel text colour, with the 4.5:1 contrast checks; `theme/followAccent.ts` sets them as custom properties on the root, which is not browser storage), and falls back to cyan on dark and teal on light. The Appearance page of the Preferences window can override the accent (follow the system, studio cyan, Afterglow orange or purple, or a custom colour) and the glass (follow the system, on, off), saved in the settings document (D62) and applied by every window from the settings change event. When the plugin reports reduced transparency or more contrast, or glass is off, the root carries `data-fls-transparency="reduced"` or `data-fls-contrast="more"` and the glass drops its blur for a solid fill; glass on sets `data-fls-glass="on"`, which keeps the blur whatever the system asks. Titles and labels are sentence case, never capitals, and the level canvas is never themed.
- **Every surface has one governing transparency setting and one token** (`apps/studio/src/theme/glassSurfaces.ts` holds the table, a unit test checks the stylesheets against it, and the live check reads each surface's computed fill). The panel opacity is `--fls-glass-alpha` (40 to 100; 100 is solid, lower lets more of the level show through, the same number for every surface and for the preview in Preferences, `glassValues` in `theme/transparency.ts`); a surface whose switch is off is solid and has no blur. The root sets the values inline; the switches are `data-fls-glass-*` attributes.

  | Surface                                                                                                                                                       | Governing setting                                                                               | Token it paints with                                                                                                             |
  | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
  | Title bar                                                                                                                                                     | Title bar switch, panel opacity                                                                 | `--fls-title-bar-opacity`, `--fls-title-bar-backdrop`                                                                            |
  | Menu row (menu bar, command search, workspace switcher), commands row (`AppToolbar`), ribbon                                                                  | Title bar switch, panel opacity (one strip with the title bar)                                  | `--fls-chrome-strip-bg` and `--fls-chrome-strip-filter` (the ribbon package reads `--fls-ribbon-bg` and `--fls-ribbon-backdrop`) |
  | Docks, rails, peek flyout, status line, panel headers (inside their dock)                                                                                     | Docked panels switch, panel opacity                                                             | `--fls-glass-docks-bg`, `--fls-glass-docks-filter`                                                                               |
  | Floating panels, tool picker, zoom pill, command palette                                                                                                      | Floating panels switch, panel opacity                                                           | `--fls-glass-floating-bg`, `--fls-glass-floating-filter`                                                                         |
  | Context menus, the panel menu and the app menu, the ribbon's overlay panel and tooltips, the drag ghost, CodeMirror popups (completion, hover, documentation) | Menus switch, menu opacity                                                                      | `--fls-bg-menu`, `--fls-menu-backdrop`                                                                                           |
  | Dialogs (close level, new level, shortcuts)                                                                                                                   | Dialogs switch, panel opacity                                                                   | `--fls-dialog-opacity`, `--fls-dialog-backdrop`                                                                                  |
  | Script editor                                                                                                                                                 | The glass of its dock or floating panel (clear over it); solid when that switch is off          | `--fls-editor-docks-bg`, `--fls-editor-floating-bg` (and the gutter pair)                                                        |
  | Window, stage and panel content (the Preferences window, torn-off panel windows, the Main window behind its panels)                                           | See-through window switch, raised to the floor that keeps text readable; never the level canvas | `--fls-bg-window`, `--fls-bg-stage`, `--fls-bg-content` via `--fls-window-alpha`                                                 |
  | Notices, the conflict and recovery banners, field and control washes                                                                                          | None: always solid                                                                              | `--fls-bg-raised`, `--fls-control-bg`                                                                                            |

  Reduced transparency (glass off, or the system asking for less under `system`) and forced colours win over every row: every alpha is 1 and there is no blur.

- **No `localStorage`, `sessionStorage` or IndexedDB**, enforced by the gate (`folio/scripts/check-browser-storage.sh`). This replaces the earlier plan to keep layouts in browser storage (`EDITOR.md` section 1).
- **Per-world settings** that belong with the world (its target, its profile pin) live in the world's files, not in app settings.
- A settings change is an event to every window; a page applies only a higher revision (`plugins/waypoint-settings/README.md`).

## 8. Strings, logging, licences

- **i18n:** every user-visible string goes through a message catalogue (`apps/studio/src/i18n/messages.ts`, `t('area.thing')`), with no literals in JSX; the chrome's labels come from it (`folio/AGENTS.md`). Waypoint also ships `fr-CA` and pseudo-locales in developer builds (`waypoint/SPEC.md` §9); the studio ships en-CA first (Q38). Error and lint messages from the Rust crates are catalogue keys with arguments, so the codes stay stable and the words can be translated.
- **Style:** Canadian English, sentence case for actions, Title Case for window titles, no all-caps (`folio/AGENTS.md`).
- **Logging:** `tauri-plugin-log` at Trace in debug and Info in release, to stdout and a rotating file; the frontend's `console.*` is redirected with the window label; never log secrets or document text, which for the studio includes script text and Claude's messages (`folio/AGENTS.md` "Logging").
- **Licence headers** on every source file (`.ts`, `.tsx`, `.rs`, `.sh`), none on generated, config or Markdown files, checked by the gate; dual `LICENSE-MIT` and `LICENSE-APACHE`; `THIRD_PARTY_NOTICES.md` with dependency licences checked by `cargo deny` (`folio/AGENTS.md`; Folio's D-25). The linked Fizz crates are the owner's, dual-licensed the same way.

## 9. Files

- **Native filesystem** through Rust and `tauri-plugin-dialog`; a world is a folder ([WORLD.md](WORLD.md)), opened by choosing its `world.fizz` or the folder.
- **Canonical files that diff cleanly.** Every file the studio writes is plain text in canonical form: scripts through the printer (which never rewrites a hand-written line), sprite and panel grids through the canonical writer. Writes are atomic (a temporary file in the same folder, then a rename), as `packages/mcp/src/studio.ts` does today.
- **File watching.** The studio watches the world's files, so an edit made in a text editor, by `git`, or by Claude through the headless MCP server shows at once: the session reparses the changed file, applies it as a revision marked "edited outside the studio", and keeps the owned-line rule (an owned line changed outside is no longer owned and is never rewritten). Folio has no file watching (its documents are zip packages); this is new to the studio and matters because the script is the source (Q39).
- **Autosave and crash recovery,** after Folio's D-27: a timer from settings writes a whole recovery copy of each unsaved file to `<app data>/recovery/<id>/` with a note, never over the real file, and the start screen offers Restore or Discard. Saving writes the real files.
- **One instance;** opening a `world.fizz` from the file manager goes to the running app (Folio's D-52), with a MIME type and icon for `.fizz` files (Q36).

## 10. Packaging and releases

As Folio's `release.yml`, from `vX.Y.Z` (and `-beta.N`) tags with synchronised manifest versions:

- Linux x64 and arm64: `deb` and `rpm` built in the CI container, and an AppImage repackaged from the `.deb` by the shared workflow `liminal-hq/.github/.github/workflows/package-arch-appimage.yml@main`.
- Windows x64 and arm64: `msi` and `nsis` (Waypoint's plan adds a portable zip, `waypoint/docs/architecture/ci-cd.md` §4).
- Signed updater artifacts; updates are opt-in (Folio's D-50).
- The MCP server binary ships as a Tauri sidecar (`externalBin`), with an installer command and a Help, Connect an agent item, as `folio-mcp` does (`folio/spec/13-agents.md`).

## 11. CI and the gate

- **One gate:** `bun run validate`, which runs format, headers, plugin boundaries, case collisions, browser storage, licences, the bindings drift check, `tsc`, Vitest, the build, `cargo fmt --check`, `cargo clippy --workspace --all-targets -D warnings` and `cargo nextest run --workspace` (`folio/package.json`, `folio/AGENTS.md`). For the studio it also runs the language conformance corpus and the Episode 1 proofs (section 13).
- **Containers:** Rust jobs in `ghcr.io/liminal-hq/tauri-ci-desktop:latest`, with Clippy also on `windows-latest` and `windows-11-arm`; local development in `ghcr.io/liminal-hq/tauri-dev-desktop:latest` (`folio/.github/workflows/ci.yml`, `folio/AGENTS.md`).
- **Dependabot:** weekly, at most five open pull requests, groups for `tauri*`, `@tauri-apps/*` and `tauri-plugin-*`, labelled `build`, with Actions labelled `ci` (`folio/.github/dependabot.yml`).
- **Forge.** The reference apps use GitHub Actions, and so does the studio: its home is `liminal-hq/fizz-level-studio` on GitHub with `.github/workflows/ci.yml`, sharing the containers and workflows, and Forgejo holds a mirror (Q40, settled).

## 12. Accessibility and keyboard

- Accessibility is a build requirement: a component that is not keyboard-operable is not done (`folio/AGENTS.md`).
- The canvas exposes its objects (and, on an overworld, its points) as a list with roving focus, Tab cycling, Enter to edit and a minimum target of 28 px (44 px in large mode), as Folio's spread canvas does (`folio/spec/06-ui.md`); cells are reachable with the arrow keys, as the prototype's cursor is.
- F6 and Ctrl+F6 cycle panes and windows (`folio/spec/12-sidebar-windows.md`); the studio's own keys (`EDITOR.md` section 3) stay, and all of them are listed on the `?` card and in the catalogue.
- `cursor: default` on controls, never `pointer` (`folio/AGENTS.md`); motion and contrast follow system appearance.
- The Game view has a text description of what is under the cursor, and floating words have their text available to assistive technology, since a frame alone is not accessible.

## 13. Testing

- **Rust tests** (`cargo nextest`) for every crate: the Fizz 1 dialect's conformance corpus (today's 76 TypeScript tests as fixtures), the 16-level and overworld proofs linked directly against the Fizz 1 game crates (no `scratch/rust/` copy needed), the Fizz 2 conformance corpus, the session's undo and revision rules, and golden files.
- **Vitest** with Testing Library and happy-dom for the frontend, and `tauri::test::mock_builder` for the app crate (`folio/spec/02-architecture.md` "Testing").
- **The running app** is driven by `tauri-mcp-server` through the debug-only `tauri-plugin-mcp-bridge` (registered under `cfg(all(debug_assertions, not(windows)))` in Folio because of a `webview2-com` clash, needing `withGlobalTauri` from `tauri.conf.dev.json`, started with `bun run tauri:dev`; `folio/AGENTS.md`, Folio's D-14). This replaces Playwright for the app.
- **The design harness** (`tools/design-harness/`, Playwright) stays as checks of the design prototype only.

## 14. Offline and local-first

- The studio works with no network: worlds are local folders, the game crates are linked in, and the MCP server talks over stdio and a user-only local socket (Unix mode 0600 or a named pipe, as Folio's live mode).
- Updates are opt-in and the only network use; nothing is sent anywhere else.
- Claude reaches the studio through the person's own agent program; the studio holds no account or key.

## 15. Out of scope

- Mobile builds of any kind; a browser build as a product; macOS for the first release.
- A sound designer (`SCRIPTING.md` section 5).
- Shipping or editing the games themselves: the studio links the game crates to show and check levels and runs `fizz-bake`, but releases of the games stay in their repositories.
- Editing the Fizz 1 or Fizz 2 repositories from the studio, except the files a person saves there on purpose (sprites in a game's `assets/sprites/`, scripts in its `assets/levels/`).
