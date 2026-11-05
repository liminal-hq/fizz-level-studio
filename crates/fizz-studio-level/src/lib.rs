// The level documents: Fizz 1 edits appended to the script, and the view the canvas draws
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Pure Rust with no Tauri. The text is the source; the view is worked out from it each time.

mod any;
mod document;
mod fizz2;
mod fizz2_view;
mod view;

#[cfg(test)]
mod fizz2_tests;
#[cfg(test)]
mod tests;

pub use any::{open_level_text, AnyLevelDocument};
pub use document::{step_name, LevelDocument};
pub use fizz2::Fizz2LevelDocument;
