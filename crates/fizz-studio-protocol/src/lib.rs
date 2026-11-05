// Shared types crossing the Rust and JavaScript boundary
//
// `ts-rs` generates the matching TypeScript types into `packages/protocol/src/generated/` from this
// crate. Never hand-maintain a parallel TypeScript copy of these shapes.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

mod host;
mod level;
mod settings;
mod window;

pub use host::*;
pub use level::*;
pub use settings::*;
pub use window::*;
