#!/usr/bin/env bash
# Check each plugin's committed api-iife.js matches what its guest-js builds
#
# (c) Copyright 2026 Liminal HQ, Scott Morris
# SPDX-License-Identifier: Apache-2.0 OR MIT

# `api-iife.js` is rollup's output, committed because each plugin's `build.rs` points at it
# (`global_api_script_path`), so a plain `cargo build` works without a JavaScript build. That makes it
# a generated file that can go stale: this rebuilds every plugin bundle and fails if a committed
# `api-iife.js` differs, or if a plugin has none. On a difference the rebuilt file is left in place,
# so `git diff` shows the change.
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || dirname "$(dirname "${BASH_SOURCE[0]}")")"

bun run build:plugins >/dev/null 2>&1

missing=()
for dir in plugins/*/; do
  [[ -f "${dir}build.rs" ]] || continue
  [[ -f "${dir}api-iife.js" ]] || missing+=("${dir}api-iife.js")
done
if [ "${#missing[@]}" -gt 0 ]; then
  echo "A plugin has no api-iife.js (run 'bun run build:plugins' and commit it):"
  printf '  %s\n' "${missing[@]}"
  exit 1
fi

# A file staged as it was rebuilt is fine (the first column); one the rebuild changed after staging,
# or one that is not in Git at all, is not (the second column, or `??`).
changed="$(git status --porcelain -- 'plugins/*/api-iife.js' | grep -vE '^[AMR] ' || true)"
if [ -n "${changed}" ]; then
  echo "The committed plugin bundles are out of date. Run 'bun run build:plugins' and commit the result:"
  echo "${changed}"
  exit 1
fi

echo "Plugin bundles are up to date."
