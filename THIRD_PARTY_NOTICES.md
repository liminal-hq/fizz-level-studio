# Third-party notices

Fizz Level Studio is `Apache-2.0 OR MIT`. The parts of what it ships that carry notices of their own are listed here. The licence check (`deny.toml`, `scripts/check-licences.sh`, `bun run check:licences`) keeps any other licence out of the Rust dependencies.

## Mozilla Public License 2.0 crates

MPL-2.0 is a file-level licence. Tauri's web stack brings `cssparser`, `cssparser-macros`, `selectors`, `dtoa-short` and `option-ext`, each used unmodified as a dependency, with its source available from its crate page. The licence text is at <https://www.mozilla.org/MPL/2.0/>. They arrive with the app shell; nothing in the workspace depends on them yet.

## CodeMirror

The script panel is a CodeMirror 6 editor (`@codemirror/state`, `view`, `commands`, `language`, `search`, `autocomplete` and `lint`), with the packages it needs: `@lezer/common`, `@lezer/highlight`, `@lezer/lr`, `@marijn/find-cluster-break`, `crelt`, `style-mod` and `w3c-keyname`. All are MIT licensed, copyright Marijn Haverbeke and others, used unmodified and bundled into the webview. The licence text is at <https://github.com/codemirror/view/blob/main/LICENSE>. They are pinned to exact versions in `apps/studio/package.json`.

## The games

The studio links the Lieutenant Fizz games' Rust crates as git dependencies pinned by revision (`crates/fizz-studio-games`), and ships their art through the sprite sets the games export. Both games are `Apache-2.0 OR MIT` like the studio. `deny.toml` allows exactly those two repositories as git sources.
