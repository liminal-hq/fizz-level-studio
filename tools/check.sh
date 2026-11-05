#!/bin/bash
# Runs the studio's checks in named groups: the whole gate, or just the groups a change can affect.
#
# (c) Copyright 2026 Liminal HQ, Scott Morris
# SPDX-License-Identifier: Apache-2.0 OR MIT
#
# usage: tools/check.sh [--groups <list>|all] [--list] [--names]
#
#   --groups <list>  run the named groups, a comma list such as `docs,frontend`; `base` always runs. The default, and `all`, run every
#                    group, which is the full gate (`bun run validate`). tools/ci-scope.sh chooses the list for a pull request from the
#                    paths it changes.
#   --list           print the groups with a line about each and exit (nothing runs).
#   --names          print only the group names, one per line, and exit.
#
# The groups (each check belongs to exactly one; AGENTS.md has the detail):
#   base       always: Prettier, licence headers, case collisions, browser storage, plugin boundaries, the scope table, the stub list
#   docs       Markdown lint and the link check
#   language   the TypeScript language and MCP tests, and the corpus, raster, and docs drift checks
#   rust       cargo fmt, Clippy, and every crate's tests (the app, the plugins, the pure crates)
#   frontend   type-check, the Vitest suites, the JSX literal check, and the build
#   app        generated TypeScript bindings and plugin bundles up to date
#   supply     dependency licences and git sources
set -euo pipefail
cd "$(dirname "$0")/.."

ALL_GROUPS="base docs language rust frontend app supply"

list_groups() {
  cat <<'LIST'
base       always runs: Prettier, licence headers, case collisions, browser storage, plugin boundaries, the stub list
docs       Markdown lint, the link check
language   TypeScript language and MCP tests, corpus, raster and docs drift
rust       cargo fmt, Clippy, every crate's tests
frontend   type-check, Vitest, JSX literals, the build
app        bindings and plugin bundles up to date
supply     dependency licences and git sources
LIST
}

SELECTED=all
while [ $# -gt 0 ]; do
  case "$1" in
    --list) list_groups; exit 0 ;;
    --names) for g in $ALL_GROUPS; do echo "$g"; done; exit 0 ;;
    --groups) [ $# -ge 2 ] || { echo "check: --groups needs a list" >&2; exit 2; }; SELECTED="$2"; shift 2 ;;
    --groups=*) SELECTED="${1#--groups=}"; shift ;;
    -h|--help) sed -n '/^# usage/,/^set -e/p' "$0" | sed '$d; s/^# \{0,1\}//'; exit 0 ;;
    *) echo "check: unknown argument $1 (try --list)" >&2; exit 2 ;;
  esac
done
if [ "$SELECTED" != all ]; then
  IFS=, read -r -a picked <<< "$SELECTED"
  for g in "${picked[@]}"; do
    case " $ALL_GROUPS all " in *" $g "*) ;; *) echo "check: unknown group '$g' (try --list)" >&2; exit 2 ;; esac
  done
  case ",$SELECTED," in *,all,*) SELECTED=all ;; esac
fi
# group <name>: true when the group was asked for. `base` always runs.
group() { [ "$1" = base ] || [ "$SELECTED" = all ] || case ",$SELECTED," in *",$1,"*) true ;; *) false ;; esac; }
case ",$SELECTED," in
  ,all,) echo "check: groups: $ALL_GROUPS" ;;
  *,base,*) echo "check: groups: $SELECTED" ;;
  *) echo "check: groups: base,$SELECTED" ;;
esac

step() { printf '\n==> %s\n' "$*"; }

if group base; then
  step "base: Prettier"; bun run format:check
  step "base: licence headers"; bun run check:headers
  step "base: case collisions"; bun run check:case
  step "base: browser storage"; bun run check:storage
  step "base: plugin boundaries"; bun run check:boundaries
  step "base: scope table"; bun run check:scope
  step "base: stubs"; bun run check:stubs
fi
if group docs; then
  step "docs: Markdown lint"; bun run lint:md
  step "docs: link check"; bun run check:links
fi
if group language; then
  step "language: language tests"; bun run test
  step "language: MCP server tests"; bun run test:mcp
  step "language: corpus drift"; bun run check:fizz1
  step "language: raster drift"; bun run check:raster
  step "language: docs drift"; bun run check:docs
fi
if group rust; then
  step "rust: format"; cargo fmt --all -- --check
  step "rust: Clippy"; cargo clippy --workspace --all-targets -- -D warnings
  step "rust: tests"; cargo nextest run --workspace
fi
if group frontend; then
  step "frontend: type-check"; bun run typecheck
  step "frontend: tests"; bun run test:js
  step "frontend: JSX literals"; bun run check:i18n
  step "frontend: build"; bun run build
fi
if group app; then
  step "app: generated bindings"; bun run check:bindings
  step "app: plugin bundles"; bun run check:bundles
fi
if group supply; then
  step "supply: licences and sources"; bun run check:licences
fi
printf '\nAll selected checks passed.\n'
