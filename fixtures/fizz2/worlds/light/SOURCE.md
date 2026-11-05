# Where the slice fixture comes from

`levels/light-1.fizz` is the Lighthouse Point slice level, written by hand in the studio's proposed Fizz 2 syntax (`spec/LANGUAGE.md`). It is a provisional fixture twice over:

- **Its data** is read from `crates/fizz-ep2/src/level.rs` (the `ROWS`, `SPAWN`, `KEY`, `KEY_BLUE`, `SNACKS`, `CHICKEN` and door constants) in the Fizz 2 repository, `ScottMorris/lieutenant-fizz-2`, on the unmerged branch `m2/level-source` at commit `d3499eda254d21ba031d396db4db7f390550f08c`. That data is not on the repository's `main` (`ba1ec8e`) yet, so the fixture will need to be re-read when it merges.
- **Its syntax** is the studio's proposal. The Fizz 2 repository has not specified the dialect, and `fizz-script` will override it when it exists (F1).

Only the `script` line, the `level` header, and the `map` block are read by the provisional dialect; every other line is kept as written. The `world.fizz` lists one level, which is all the slice has.

This directory holds no digests, sizes, or frames. Golden numbers come from the Fizz 2 repository only.
