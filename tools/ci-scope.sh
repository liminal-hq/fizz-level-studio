#!/bin/bash
# Chooses which groups of checks a pull request needs, from the paths it changes.
#
# (c) Copyright 2026 Liminal HQ, Scott Morris
# SPDX-License-Identifier: Apache-2.0 OR MIT
#
# usage: tools/ci-scope.sh [--base <ref>]   the paths changed since the merge base with <ref> (default origin/main)
#        tools/ci-scope.sh --files          the paths come from standard input, one per line
#        tools/ci-scope.sh --self-test      check the table below (one test per rule) and exit
#
# Standard output is one line for tools/check.sh --groups: a comma list such as `base,docs,frontend`, or `all` for the full gate.
# Standard error says why, one line per changed path with the rule that matched it. `base` is always in the answer.
#
# How it decides: each path takes the FIRST rule of RULES whose pattern matches it (a shell glob where `*` also matches `/`), and the
# answer is the union of the groups of those rules. A path that no rule matches selects `all`: a file the table has never heard of may
# change anything, so the safe answer is the full gate. A rule may name `all` itself (build scripts, the workflow, lock files). No
# changed paths at all selects `base`. This follows Fizz 2's tools/ci-scope.sh.
#
# The groups are the ones in tools/check.sh (--list). Adding a crate, a package, or a script means adding a rule here; until then
# its changes run the full gate.
set -euo pipefail
cd "$(dirname "$0")/.."

ALL_GROUPS="base docs language rust frontend app supply"

# pattern ; groups ; example path (the self-test checks each rule against its example, so an example must reach its own rule first)
RULES=(
  # Records and static files: nothing runs against them beyond the base checks.
  'design/*;base;design/project/Proto.dc.html'
  'assets/*;base;assets/hero.svg'
  'LICENSE-*;base;LICENSE-MIT'
  '.gitignore;base;.gitignore'
  '.gitattributes;base;.gitattributes'
  '.editorconfig;base;.editorconfig'
  '.prettierignore;base;.prettierignore'
  # Documentation.
  '*.md;docs;docs/BUILD-PLAN.md'
  '.markdownlint.jsonc;docs;.markdownlint.jsonc'
  'tools/check-links.ts;docs;tools/check-links.ts'
  # The workflow and the files that decide what runs or how it is built: the full gate.
  '.github/workflows/*;all;.github/workflows/ci.yml'
  '.github/*;base;.github/dependabot.yml'
  'tools/check.sh;all;tools/check.sh'
  'tools/ci-scope.sh;all;tools/ci-scope.sh'
  'Cargo.toml;all;Cargo.toml'
  'Cargo.lock;all;Cargo.lock'
  'rust-toolchain.toml;all;rust-toolchain.toml'
  'package.json;all;package.json'
  'bun.lock;all;bun.lock'
  'tsconfig.json;all;tsconfig.json'
  'tsconfig.base.json;all;tsconfig.base.json'
  '.prettierrc;all;.prettierrc'
  '.node-version;all;.node-version'
  'scripts/junit-summary.sh;all;scripts/junit-summary.sh'
  # The checks themselves.
  '.config/*;rust;.config/nextest.toml'
  'deny.toml;supply;deny.toml'
  'scripts/check-licences.sh;supply;scripts/check-licences.sh'
  'scripts/check-bindings-drift.sh;app;scripts/check-bindings-drift.sh'
  'scripts/binding-crates.sh;app;scripts/binding-crates.sh'
  'scripts/generate-protocol-bindings.sh;app;scripts/generate-protocol-bindings.sh'
  'scripts/check-plugin-bundles.sh;app;scripts/check-plugin-bundles.sh'
  'scripts/check-jsx-literals.ts;frontend;scripts/check-jsx-literals.ts'
  'scripts/jsx-literals.ts;frontend;scripts/jsx-literals.ts'
  'scripts/check-*.sh;base;scripts/check-headers.sh'
  'scripts/list-stubs.sh;base;scripts/list-stubs.sh'
  'scripts/prove-*;language;scripts/prove-all.sh'
  # The Fizz 1 language, its corpus, and its proofs.
  'tools/gen-fizz1-*;language;tools/gen-fizz1-raster.ts'
  'tools/fizz1-cases.ts;language;tools/fizz1-cases.ts'
  'packages/language/*;language;packages/language/src/parser.ts'
  'packages/mcp/*;language;packages/mcp/src/world.ts'
  'fixtures/fizz1/*;language;fixtures/fizz1/raster/crater.json'
  'levels/*;language;levels/crater.fizz'
  'overworlds/*;language;overworlds/main.fizz'
  'scratch/*;language;scratch/kitchen-sink.fizz'
  # The desktop app and its Rust.
  'shared/*;app;shared/rollup.config.js'
  'packages/chrome/*;frontend;packages/chrome/src/TitleBar/TitleBar.tsx'
  'packages/protocol/*;frontend,app;packages/protocol/src/generated/WindowId.ts'
  'apps/studio/src-tauri/*;rust,app;apps/studio/src-tauri/src/lib.rs'
  'apps/studio/*;frontend;apps/studio/src/main.tsx'
  'plugins/*;rust,frontend,app;plugins/fizz-studio-host/src/lib.rs'
  'crates/fizz-studio-language/*;language,rust;crates/fizz-studio-language/src/parser.rs'
  'crates/fizz-studio-protocol/*;rust,frontend,app;crates/fizz-studio-protocol/src/window.rs'
  'crates/fizz-studio-games/*;rust,supply;crates/fizz-studio-games/src/lib.rs'
  'crates/*;rust;crates/fizz-studio-session/src/lib.rs'
  'fixtures/*;rust;fixtures/profiles/synthetic.json'
)

# classify: paths on standard input; the answer on standard output, the reasons on standard error.
classify() {
  local f rule pat groups matched any=0 all=0 sel=" base " g
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    any=1
    matched=
    for rule in "${RULES[@]}"; do
      pat="${rule%%;*}"
      groups="${rule#*;}"; groups="${groups%%;*}"
      # shellcheck disable=SC2254
      case "$f" in
        $pat) matched=1; break ;;
      esac
    done
    if [ -z "$matched" ]; then
      echo "ci-scope: $f -> all (no rule matches this path)" >&2
      all=1
      continue
    fi
    echo "ci-scope: $f -> $groups (rule '$pat')" >&2
    if [ "$groups" = all ]; then
      all=1
    else
      for g in ${groups//,/ }; do sel="$sel$g "; done
    fi
  done
  [ "$any" = 1 ] || echo "ci-scope: no changed paths -> base" >&2
  if [ "$all" = 1 ]; then
    echo all
    return
  fi
  local out=
  for g in $ALL_GROUPS; do
    case "$sel" in *" $g "*) out="$out${out:+,}$g" ;; esac
  done
  echo "$out"
}

fail() { echo "ci-scope: FAIL: $*" >&2; exit 1; }

self_test() {
  local rule pat groups example want got n=0 bad=0 files
  # One test per rule: its example path, alone, gives exactly the rule's groups (with base).
  for rule in "${RULES[@]}"; do
    pat="${rule%%;*}"
    groups="${rule#*;}"; example="${groups#*;}"; groups="${groups%%;*}"
    if [ "$groups" = all ]; then want=all; else want="$(ALL_GROUPS="$ALL_GROUPS" order "base,$groups")"; fi
    got="$(printf '%s\n' "$example" | classify 2> /dev/null)"
    if [ "$got" != "$want" ]; then
      echo "ci-scope: rule '$pat': example $example gave '$got', expected '$want'" >&2
      bad=1
    fi
    n=$((n + 1))
  done
  # Every group a rule names exists.
  for rule in "${RULES[@]}"; do
    groups="${rule#*;}"; groups="${groups%%;*}"
    for g in ${groups//,/ }; do
      case " all $ALL_GROUPS " in *" $g "*) ;; *) echo "ci-scope: rule '${rule%%;*}' names the unknown group '$g'" >&2; bad=1 ;; esac
    done
  done
  # The groups are the ones check.sh runs.
  got="$(tools/check.sh --names | tr '\n' ' ' | sed 's/ $//')"
  [ "$got" = "$ALL_GROUPS" ] || { echo "ci-scope: tools/check.sh --names is '$got', not '$ALL_GROUPS'" >&2; bad=1; }
  # The combinations the rules exist for.
  expect() {
    local want="$1" got
    shift
    got="$(printf '%s\n' "$@" | classify 2> /dev/null)"
    [ "$got" = "$want" ] || { echo "ci-scope: [$*] gave '$got', expected '$want'" >&2; bad=1; }
    n=$((n + 1))
  }
  expect base                                  # nothing changed
  expect base,docs README.md docs/QUESTIONS.md spec/EDITOR.md
  expect all some/new/file.rs                  # unknown path: the full gate
  expect all docs/QUESTIONS.md some/new/file.rs # one unknown path among docs is enough
  expect base,language,rust crates/fizz-studio-language/src/raster.rs fixtures/fizz1/raster/crater.json
  expect base,frontend apps/studio/src/app/App.tsx packages/chrome/src/tokens.css
  expect base,rust,frontend,app plugins/fizz-studio-host/src/lib.rs
  expect base,rust,frontend,app crates/fizz-studio-protocol/src/level.rs
  expect base,rust crates/fizz-studio-session/src/session.rs
  expect base,rust,supply crates/fizz-studio-games/src/lib.rs deny.toml
  expect all .github/workflows/ci.yml
  expect all tools/check.sh
  expect all Cargo.lock bun.lock
  # --files reads standard input, so a path with a space stays one path.
  expect all 'docs/a b.md' 'x y'
  [ "$bad" = 0 ] || fail "the self-test found problems (above)"
  echo "ci-scope: self-test ok ($n tests)"
}

# order <comma list>: the list in the canonical group order, without repeats.
order() {
  local out= g
  for g in $ALL_GROUPS; do
    case ",$1," in *",$g,"*) out="$out${out:+,}$g" ;; esac
  done
  echo "$out"
}

case "${1:-}" in
  --self-test) self_test ;;
  --files) classify ;;
  --base) [ $# -ge 2 ] || fail "--base needs a ref"; git diff --name-only --no-renames "$2...HEAD" | classify ;;
  "") git diff --name-only --no-renames "origin/main...HEAD" | classify ;;
  *) fail "unknown argument $1 (see the usage at the top of the script)" ;;
esac
