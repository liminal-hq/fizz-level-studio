#!/usr/bin/env bash
# Rebuilds every real level and the overworld from their scripts and compares them with the game, then checks the studio's rasteriser against the game's own data.
#
# (c) Copyright 2026 Liminal HQ, Scott Morris
# SPDX-License-Identifier: Apache-2.0 OR MIT
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
bun tools/gen-all-proof.ts
bun tools/gen-overworld-proof.ts
bash scripts/prove-crater.sh >/dev/null
truth="$root/scratch/truth"
mkdir -p "$truth"
cd scratch/rust
# Every `_proof` test: the exporter's output equals the game's levels and overworld.
cargo test --offline -p lf-episode-1 _proof -- --nocapture
# The game's own data, for the rasteriser checks below.
FIZZ_DUMP_ALL="$truth" FIZZ_DUMP_OW="$truth/overworld.json" cargo test --offline -p lf-episode-1 'dump_' >/dev/null
cd "$root"
slugs=(crater caves citadel meteor-mesa zarg-lookout marshmallow-meadows bonbon-playhouse fudge-bog mirror-shafts sugar-glass-gallery frosting-flats frosting-spire cocoa-foundry gumdrop-isle whisper-hollow saucer)
for i in "${!slugs[@]}"; do
	printf '%s: ' "${slugs[$i]}"
	bun tools/verify-rasteriser.ts "$truth/$i.json" "levels/real/${slugs[$i]}.fizz" | tr '\n' ' '
	echo
done
bun tools/verify-overworld.ts "$truth/overworld.json"
