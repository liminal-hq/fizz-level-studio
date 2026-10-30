#!/usr/bin/env bash
# Exports the scripts into the scratch Rust copy and runs the comparison tests there.
#
# (c) Copyright 2026 Liminal HQ, Scott Morris
# SPDX-License-Identifier: Apache-2.0 OR MIT
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
game="$root/scratch/rust/episodes/episode-1/game/src"
cli="$root/packages/language/src/cli.ts"
bun "$cli" export "$root/levels/crater.fizz" crater_fizz "$game/crater_fizz.rs"
bun "$cli" export "$root/scratch/kitchen-sink.fizz" kitchen_sink "$game/kitchen_sink.rs"
cd "$root/scratch/rust"
cargo test --offline -p lf-episode-1 _proof -- --nocapture
