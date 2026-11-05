# Risks

| Risk | Effect | Mitigation |
| --- | --- | --- |
| The scratch copy drifts from the game | The proofs pass against old code | Move the proofs into the game repository (R-EXP-04); until then, `diff -r` the copy before trusting a run |
| Name tables drift (`tables.ts`, `SCATTER_RATES`, `AREA_RUST`) | A script compiles to the wrong tile or theme | Generate them from the game or test them against it (ENGINE-CHANGES E11) |
| The TypeScript rasteriser diverges from the `Builder` on a statement no real level uses | The canvas lies about a level | Proof on every statement, not only the 16 levels; prefer the sim's own build (E7) |
| The progress mask is full | A 16th level silently shares the secret-found bit | Widen before adding a level (E4), with a save migration |
| Object identity across hand edits | The studio rewrites the wrong line | Match by line and original text; refuse otherwise (Q4) |
| The `edits` log grows without bound | Scripts become hard to read | A person-run tidy command; fold edits into sections on request |
| Claude proposals go stale | Accepting writes something that no longer fits | `accept` revalidates against the current file (built); show the conflict in the studio |
| The playtest bot is slow | The studio stalls | Run it natively on a worker thread with a tick budget per step and progress over a `Channel` (E9) |
| Cross-repository crate coupling | A change in a game crate breaks the studio, or two episodes' crates cannot link together | Pinned git revisions bumped in reviewed changes (D58); a host process per episode if they cannot share a build (Q41); F23 marks the APIs the studio calls |
| A large TypeScript-to-Rust port | The port stalls, or drifts from the proven TypeScript | The TypeScript package stays the reference until every fixture and proof matches (D56); the port is bounded (about 1,845 lines) and has its corpus from day one |
| The Liminal HQ standards' plugins are copies | The studio's copies of tear-off and window effects drift from Waypoint's | `PROVENANCE.md` per copy, and a move to the published plugins when they are published |
| Streaming frames over IPC is too slow for a smooth Game view | A laggy canvas | Indexed frames with a palette (a 320 by 200 frame is 64,000 bytes), sent only on change; measured in M1 (Q43) |
| The design prototype is mistaken for the product | Canned behaviour is relied on | The prototype labels canned parts; this spec marks every requirement's status |
| Two parsers drift (TypeScript here, Rust in `fizz-script`) | The editor accepts a script the baker rejects, or the reverse | A shared conformance corpus in both repositories' tests (G-F2-1) |
| The studio's dialect proposal is written before the Fizz 2 grammar | The editor is built against syntax `fizz-script` does not adopt | Build M2 and M3 behind the corpus, start the corpus in the Fizz 2 repository, and treat every syntax line in `LANGUAGE.md` as provisional until `fizz-script` exists (D40) |
| Fizz 2 changes fast and its level pull requests are unmerged | The documents describe records or rules that change before merging | Each fact names its pull request and is marked provisional; recheck `docs/FIZZ2-COVERAGE.md` before starting M2 |
| The games keep diverging | A Fizz 1 export silently plays differently | Every divergence is a capability-matrix row with a check (W110 and the rest); a divergence found without a row is a bug in the profile |
| Ben's body size changes | Levels tuned for one body block the other | The body is a profile parameter and the Head room lens compares two sizes (W105) |
| A preview imitates the game's look | The person trusts a picture the game does not draw | The Game view is the game's presenter or the labelled flat fallback (D37) |
| Behaviour scripts are not deterministic or too slow on a 486 | Worlds play differently on DOS, or stutter | The numeric model only, static worst-case counts, budgets from the profile, parity fixtures (`spec/SCRIPTING.md` section 9) |
| Bytecode versions drift, or bad bytecode is loaded | Old packs run with new meanings; a pack crashes the game | A bytecode version in the compatibility number; a load-time verifier |
| Much of the design waits on Fizz 2 change requests | The studio's Fizz 2 milestones stall | Each milestone names its change requests; capability states let the editor ship a feature as "accepted" before the game runs it |
| The studio's state and rule design outgrows `LEVL` 2's fixed records | Rules that cannot be baked | Limits in the profile (Q23, Q24); the corpus checks the baker's records |
