// The Fizz 1 level document: edits appended to the script, and the view the canvas draws
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Pure Rust with no Tauri. The text is the source; the view is worked out from it each time.

mod document;
mod view;

#[cfg(test)]
mod tests;

pub use document::{step_name, LevelDocument};
