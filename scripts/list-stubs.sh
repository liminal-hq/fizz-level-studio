#!/usr/bin/env bash
# List the Fizz 2 stubs still in the workspace, so one that outlives its milestone shows in every run
#
# (c) Copyright 2026 Liminal HQ, Scott Morris
# SPDX-License-Identifier: Apache-2.0 OR MIT

# Every stub lives in a file named `stub.rs` whose header says which change request it stands in
# for. This prints each one with that line and always exits 0; it informs, it does not gate.
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || dirname "$(dirname "${BASH_SOURCE[0]}")")"

found=0
while IFS= read -r -d '' f; do
  found=$((found + 1))
  reason="$(grep -m1 -E '^// Stands in for' "$f" || echo '// (no "Stands in for" line)')"
  echo "  $f: ${reason#// }"
done < <(find crates plugins -name stub.rs -not -path '*/target/*' -print0 2>/dev/null)

echo "$found stub(s) remain."
