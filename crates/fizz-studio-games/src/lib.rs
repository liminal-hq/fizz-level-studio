// The two games' crates, linked natively and pinned by revision (D58, D59)
//
// The pins are the git dependencies in `Cargo.toml`, bumped deliberately in a reviewed change.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/// Fizz 1's simulation and Episode 1's levels, from `liminal-hq/lieutenant-fizz`.
pub use lf_episode_1 as fizz1_episode_1;
pub use lf_sim as fizz1_sim;

/// Fizz 2's crates, from `ScottMorris/lieutenant-fizz-2`.
pub use fizz_ep2 as fizz2_ep2;
pub use fizz_pack as fizz2_pack;
pub use fizz_phys as fizz2_phys;
pub use fizz_sim as fizz2_sim;
pub use fizz_slice_view as fizz2_slice_view;
pub use fizz_view as fizz2_view;
