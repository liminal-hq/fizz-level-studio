# Third-party notices

Fizz Level Studio is `Apache-2.0 OR MIT`. The parts of what it ships that carry notices of their own are listed here. The licence check (`deny.toml`, `scripts/check-licences.sh`, `bun run check:licences`) keeps any other licence out of the Rust dependencies.

## Mozilla Public License 2.0 crates

MPL-2.0 is a file-level licence. Tauri's web stack brings `cssparser`, `cssparser-macros`, `selectors`, `dtoa-short` and `option-ext`, each used unmodified as a dependency, with its source available from its crate page. The licence text is at <https://www.mozilla.org/MPL/2.0/>. They arrive with the app shell; nothing in the workspace depends on them yet.

## The games

The studio links the Lieutenant Fizz games' Rust crates as dependencies pinned by revision, and ships their art through the sprite sets the games export. Both games are `Apache-2.0 OR MIT` like the studio.
