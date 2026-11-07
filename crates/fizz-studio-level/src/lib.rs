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
mod layers;
mod locks;
mod new;
mod proposals;
mod view;
mod words;

#[cfg(test)]
mod fizz2_tests;
#[cfg(test)]
mod new_tests;
#[cfg(test)]
mod tests;

pub use any::{open_level_text, AnyLevelDocument};
pub use document::{step_name, LevelDocument};
pub use fizz2::Fizz2LevelDocument;
pub use layers::{layers_changed, LAYER_ORDER};
pub use locks::{locked_layers, sidecar_with_locks};
pub use new::{
    default_ground, is_slug, new_level_text, new_world_text, pack_name, validate_new_level,
    HEIGHT_RANGE, WIDTH_RANGE,
};
pub use proposals::{pending_ghosts, sidecar_path, word_docs};
