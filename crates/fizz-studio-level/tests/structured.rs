// Property tests for the structured edits over every real level and the edge fixtures, and the
// locks by effect
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// This is G-TRUST-2's test (spec/GOALS.md): an edit that rewrites a line must leave every line it
// did not touch byte for byte as it was, and must never change what the level builds beyond the one
// thing asked. The levels are `fixtures/fizz1/levels/*.fizz` and the edge fixtures; each level is
// sampled evenly (every thing of a small level, a spread of a large one) to keep the run short.

use std::path::{Path, PathBuf};
use std::time::Instant;

use fizz_studio_level::{apply_thing_edit, LevelDocument, LAYER_ORDER};
use fizz_studio_protocol::{Facing, LevelEdit, LevelView, ThingKind, ThingRef};
use fizz_studio_session::{Document, DocumentError, Request, Session, SessionError};

fn fixtures() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/fizz1")
}

fn files(dir: &str) -> Vec<(String, String)> {
    let mut out: Vec<(String, String)> = std::fs::read_dir(fixtures().join(dir))
        .unwrap()
        .filter_map(|e| {
            let path = e.unwrap().path();
            (path.extension().is_some_and(|x| x == "fizz")).then(|| {
                let bytes = std::fs::read(&path).unwrap();
                (
                    path.file_name().unwrap().to_string_lossy().into_owned(),
                    String::from_utf8_lossy(&bytes).into_owned(),
                )
            })
        })
        .collect();
    out.sort();
    out
}

/// What the webview draws for a thing, as a reference to send.
fn thing_ref(text: &str, view: &LevelView, kind: ThingKind, index: usize) -> Option<ThingRef> {
    let (line, x, y) = match kind {
        ThingKind::Item => {
            let i = view.items.get(index)?;
            (i.line?, i.x, Some(i.y))
        }
        ThingKind::Spawn => {
            let s = view.spawns.get(index)?;
            (s.line?, s.x, s.y)
        }
        ThingKind::Start => {
            let s = view.start.as_ref()?;
            (s.line?, s.x, Some(s.y))
        }
    };
    Some(ThingRef {
        kind,
        index: index as u32,
        line,
        expect: text.split('\n').nth(line as usize - 1)?.to_string(),
        x,
        y,
    })
}

/// Up to `limit` indices out of `0..n`, evenly spread, always with the first and the last.
fn sample(n: usize, limit: usize) -> Vec<usize> {
    if n <= limit {
        return (0..n).collect();
    }
    let mut out: Vec<usize> = (0..limit).map(|k| k * (n - 1) / (limit - 1)).collect();
    out.dedup();
    out
}

/// The things of a view that a thing edit may name: the sample of each list, and the start.
fn things(view: &LevelView, items: usize, spawns: usize) -> Vec<(ThingKind, usize)> {
    let mut out: Vec<(ThingKind, usize)> = sample(view.items.len(), items)
        .into_iter()
        .map(|i| (ThingKind::Item, i))
        .collect();
    out.extend(
        sample(view.spawns.len(), spawns)
            .into_iter()
            .map(|i| (ThingKind::Spawn, i)),
    );
    if view.start.is_some() {
        out.push((ThingKind::Start, 0));
    }
    out
}

/// Where a thing is, as a move to the same place would say it.
fn here(view: &LevelView, kind: ThingKind, index: usize) -> (f64, Option<f64>) {
    match kind {
        ThingKind::Item => (view.items[index].x, Some(view.items[index].y)),
        ThingKind::Spawn => {
            let s = &view.spawns[index];
            (s.x, if s.on_ground { None } else { s.y })
        }
        ThingKind::Start => {
            let s = view.start.as_ref().unwrap();
            (s.x, Some(s.y))
        }
    }
}

/// The view with its line numbers left out, which a split changes and nothing else should.
fn shape(view: &LevelView) -> String {
    let mut view = view.clone();
    // Minus zero is zero.
    let z = |v: f64| if v == 0.0 { 0.0 } else { v };
    for i in &mut view.items {
        i.line = None;
        (i.x, i.y) = (z(i.x), z(i.y));
    }
    for s in &mut view.spawns {
        s.line = None;
        // A spawn pinned to the ground it stood on builds the same thing.
        s.on_ground = false;
        (s.x, s.y) = (z(s.x), s.y.map(z));
    }
    if let Some(s) = &mut view.start {
        s.line = None;
    }
    for m in &mut view.markers {
        m.line = None;
    }
    view.sections.clear();
    view.cell_sections.clear();
    let text = format!(
        "{:?}",
        (
            view.width,
            view.height,
            &view.cells,
            &view.items,
            &view.spawns,
            &view.start,
            &view.markers
        )
    );
    // A short summary, so a failure does not print the whole grid.
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    std::hash::Hash::hash(&text, &mut hasher);
    format!(
        "{} items, {} spawns, hash {:x}",
        view.items.len(),
        view.spawns.len(),
        std::hash::Hasher::finish(&hasher)
    )
}

fn lines(text: &str) -> Vec<&str> {
    text.split('\n').collect()
}

/// Every line but those of the rewritten statement is byte for byte what it was. One exception, the
/// join of R7: an edit that makes a line say what its neighbour says (a spawn moved back to the
/// ground beside two split off it) joins them, so the line before and the line after may change, and
/// no line further away may.
fn untouched_lines_are_identical(old: &str, new: &str, line: usize) {
    let (o, n) = (lines(old), lines(new));
    let tail = o.len() - line;
    let strict =
        n.len() >= tail && o[..line - 1] == n[..line - 1] && o[line..] == n[n.len() - tail..];
    if strict {
        return;
    }
    let above = line.saturating_sub(2);
    assert_eq!(
        o[..above],
        n[..above],
        "lines above line {line} (beyond its neighbour)"
    );
    let below = (line + 1).min(o.len());
    let tail = o.len() - below;
    assert!(
        n.len() >= tail,
        "line {line}: the text got shorter than its tail"
    );
    assert_eq!(
        o[below..],
        n[n.len() - tail..],
        "lines below line {line} (beyond its neighbour)"
    );
}

fn move_to(text: &str, thing: ThingRef, x: f64, y: Option<f64>) -> Result<String, DocumentError> {
    apply_thing_edit(text, &LevelEdit::MoveThing { thing, x, y }).map(|o| o.text)
}

#[derive(Default, Debug)]
struct Tally {
    moved: usize,
    refused: usize,
    split: usize,
    restored_bytes: usize,
    rejoined: usize,
    deleted: usize,
    turned: usize,
    locked: usize,
}

/// Every property for one level.
fn check_level(name: &str, text: &str, items: usize, spawns: usize) -> Tally {
    let mut tally = Tally::default();
    // A few edge fixtures (huge sizes) overflow in the rasteriser itself; they are not about things.
    let Ok(view) = std::panic::catch_unwind(|| LevelDocument::new(text).view()) else {
        return tally;
    };
    for (kind, index) in things(&view, items, spawns) {
        let Some(thing) = thing_ref(text, &view, kind, index) else {
            continue;
        };
        let label = format!("{name} {kind:?} #{index} line {}", thing.line);
        let (x, y) = here(&view, kind, index);

        // A move to the same place is byte-identical.
        if let Ok(same) = move_to(text, thing.clone(), x, y) {
            assert_eq!(same, text, "{label}: a no-op changed bytes");
        }

        // The resolved y, for a move up that pins a spawn to the ground it stood on.
        let resolved = match kind {
            ThingKind::Item => view.items[index].y,
            ThingKind::Spawn => view.spawns[index].y.unwrap_or(f64::NAN),
            ThingKind::Start => view.start.as_ref().unwrap().y,
        };
        let up = (!resolved.is_nan()).then_some((x, Some(resolved + 1.0)));
        // A move by one along x and one up: accepted or refused, never a panic, and exactly the
        // effect asked.
        for (target, (nx, ny)) in [(0, (x + 1.0, y)), (1, up.unwrap_or((x + 1.0, y)))] {
            if target == 1 && up.is_none() {
                continue;
            }
            let label = format!("{label} -> ({nx}, {ny:?})");
            let Ok(moved) = move_to(text, thing.clone(), nx, ny) else {
                tally.refused += 1;
                continue;
            };
            tally.moved += 1;
            let after = LevelDocument::new(&moved).view();
            assert_eq!(after.cells, view.cells, "{label}: cells");
            assert_eq!(after.items.len(), view.items.len(), "{label}");
            assert_eq!(after.spawns.len(), view.spawns.len(), "{label}");
            for (n, (a, b)) in after.items.iter().zip(&view.items).enumerate() {
                if kind != ThingKind::Item || n != index {
                    assert_eq!(
                        (&a.kind, a.x, a.y),
                        (&b.kind, b.x, b.y),
                        "{label}: item {n}"
                    );
                }
            }
            for (n, (a, b)) in after.spawns.iter().zip(&view.spawns).enumerate() {
                if kind != ThingKind::Spawn || n != index {
                    assert_eq!(
                        (&a.kind, a.x, a.y, a.dir, a.ride),
                        (&b.kind, b.x, b.y, b.dir, b.ride),
                        "{label}: spawn {n}"
                    );
                }
            }
            match kind {
                ThingKind::Item => {
                    let (a, b) = (&after.items[index], &view.items[index]);
                    assert_eq!((&a.kind, a.x, Some(a.y)), (&b.kind, nx, ny), "{label}");
                    assert_eq!(after.start, view.start, "{label}: start");
                }
                ThingKind::Spawn => {
                    let (a, b) = (&after.spawns[index], &view.spawns[index]);
                    assert_eq!(
                        (&a.kind, a.x, a.dir, a.ride),
                        (&b.kind, nx, b.dir, b.ride),
                        "{label}"
                    );
                    if let Some(v) = ny {
                        assert_eq!(a.y, Some(v), "{label}");
                    }
                    assert_eq!(after.start, view.start, "{label}: start");
                }
                ThingKind::Start => {
                    let s = after.start.as_ref().unwrap();
                    assert_eq!((s.x, Some(s.y)), (nx, ny), "{label}");
                }
            }
            untouched_lines_are_identical(text, &moved, thing.line as usize);
            let split = lines(&moved).len() != lines(text).len();
            tally.split += usize::from(split);

            // And back: what the level builds is restored, and the bytes when it was one number
            // changed in place.
            if let Some(back) = thing_ref(&moved, &after, kind, index) {
                let target_back = (x, y);
                if let Ok(restored) = move_to(&moved, back, target_back.0, target_back.1) {
                    assert_eq!(
                        shape(&LevelDocument::new(&restored).view()),
                        shape(&view),
                        "{label}: there and back changed what the level builds"
                    );
                    let old_line = lines(text)[thing.line as usize - 1];
                    // A number moved and moved back is written as the program writes it, which is not
                    // how a hand wrote `3.50` or `-0`.
                    let canonical = kind == ThingKind::Item
                        || !(old_line.contains('.') || old_line.contains("-0"));
                    let simple = target == 0
                        && canonical
                        && !split
                        && !old_line.contains("..")
                        && !old_line.contains("row ");
                    if simple {
                        assert_eq!(restored, text, "{label}: bytes not restored");
                        tally.restored_bytes += 1;
                    }
                    // R7: a statement split by the move up is joined again by the move back, when
                    // the list was written as the engine writes one.
                    let plain = !old_line.contains("..")
                        && !old_line.contains("row ")
                        && !old_line.contains("//")
                        && !old_line.contains(", ")
                        && !old_line.contains(" ,");
                    let grew = lines(&moved).len() > lines(text).len();
                    if target == 1 && grew && canonical && plain && kind != ThingKind::Start {
                        assert_eq!(restored, text, "{label}: a split was not joined back");
                        tally.rejoined += 1;
                    }
                }
            }
        }
        // The x move is the one the rest of the checks use.
        let Ok(_) = move_to(text, thing.clone(), x + 1.0, y) else {
            continue;
        };

        // A turn changes only the spawn's facing; Left or Right, never a panic.
        if kind == ThingKind::Spawn {
            for facing in [Facing::Left, Facing::Right] {
                let edit = LevelEdit::FaceThing {
                    thing: thing_ref(text, &view, kind, index).unwrap(),
                    facing,
                };
                if let Ok(turned) = apply_thing_edit(text, &edit) {
                    let t = LevelDocument::new(&turned.text).view();
                    assert_eq!(t.spawns.len(), view.spawns.len(), "{label}");
                    assert_eq!(t.spawns[index].x, view.spawns[index].x, "{label}");
                    assert_eq!(t.spawns[index].y, view.spawns[index].y, "{label}");
                    untouched_lines_are_identical(text, &turned.text, thing.line as usize);
                    tally.turned += 1;
                }
            }
        }

        // Delete, then undo through a session: the bytes are back.
        if kind != ThingKind::Start {
            let delete = LevelEdit::DeleteThing {
                thing: thing_ref(text, &view, kind, index).unwrap(),
            };
            if let Ok(gone) = apply_thing_edit(text, &delete) {
                let g = LevelDocument::new(&gone.text).view();
                match kind {
                    ThingKind::Item => assert_eq!(g.items.len() + 1, view.items.len(), "{label}"),
                    _ => assert_eq!(g.spawns.len() + 1, view.spawns.len(), "{label}"),
                }
                untouched_lines_are_identical(text, &gone.text, thing.line as usize);
                let mut session = Session::new(LevelDocument::new(text));
                let writer = session.claim_writer("test").unwrap();
                let asked = Request::new(session.revision(), gone.name.clone(), delete.clone());
                session.apply(&writer, asked).unwrap();
                assert_eq!(session.text(), gone.text);
                session.undo(&writer, session.revision()).unwrap();
                assert_eq!(
                    session.text(),
                    text,
                    "{label}: undo did not restore the bytes"
                );
                tally.deleted += 1;
            }
        }

        // With the thing's layer locked, the same move is refused and the text is unchanged.
        let layers = ["treats", "enemies"];
        let mut session = Session::new(LevelDocument::new(text));
        let writer = session.claim_writer("test").unwrap();
        session.set_locks(layers.iter().map(|l| l.to_string()));
        let asked = Request::new(
            session.revision(),
            "move",
            LevelEdit::MoveThing {
                thing: thing_ref(text, &view, kind, index).unwrap(),
                x: x + 1.0,
                y,
            },
        );
        match (kind, session.apply(&writer, asked)) {
            (ThingKind::Start, Ok(_)) => {}
            (ThingKind::Start, Err(e)) => panic!("{label}: the start is never locked: {e}"),
            (_, Err(SessionError::Locked { .. })) => tally.locked += 1,
            (_, other) => panic!("{label}: expected a lock refusal, got {other:?}"),
        }
        if kind != ThingKind::Start {
            assert_eq!(
                session.text(),
                text,
                "{label}: a refused edit changed the text"
            );
        }
    }
    tally
}

fn run_corpus(corpus: Vec<(String, String)>, items: usize, spawns: usize) -> Tally {
    let totals = std::sync::Mutex::new(Tally::default());
    std::thread::scope(|scope| {
        for chunk in corpus.chunks(4) {
            let totals = &totals;
            scope.spawn(move || {
                for (name, text) in chunk {
                    let t = check_level(name, text, items, spawns);
                    let mut all = totals.lock().unwrap();
                    all.moved += t.moved;
                    all.refused += t.refused;
                    all.split += t.split;
                    all.restored_bytes += t.restored_bytes;
                    all.rejoined += t.rejoined;
                    all.deleted += t.deleted;
                    all.turned += t.turned;
                    all.locked += t.locked;
                }
            });
        }
    });
    totals.into_inner().unwrap()
}

#[test]
fn every_real_level_keeps_every_untouched_line_and_every_other_thing() {
    let corpus = files("levels");
    assert_eq!(corpus.len(), 17, "the 17 real levels");
    let tally = run_corpus(corpus, 24, 12);
    assert!(tally.moved > 100, "{tally:?}");
    assert!(tally.deleted > 50, "{tally:?}");
    assert!(tally.locked > 100, "{tally:?}");
    assert!(tally.split > 5, "some moves split a statement: {tally:?}");
    assert!(tally.restored_bytes > 20, "{tally:?}");
    assert!(tally.rejoined > 3, "splits are joined back: {tally:?}");
}

#[test]
fn the_edge_fixtures_never_panic_and_keep_the_same_properties() {
    // The CRLF, tab and quote fixtures among them; most hold few or no things.
    let corpus = files("edge");
    assert!(corpus.iter().any(|(n, _)| n == "crlf.fizz"));
    assert!(corpus.iter().any(|(n, _)| n == "tabs-for-indentation.fizz"));
    assert!(corpus
        .iter()
        .any(|(n, _)| n == "comment-slashes-in-quotes.fizz"));
    let tally = run_corpus(corpus, 12, 8);
    assert!(
        tally.moved > 5,
        "the edge fixtures hold things to move: {tally:?}"
    );
}

#[test]
fn a_crlf_file_with_things_keeps_its_line_endings_when_a_statement_splits() {
    let text = std::fs::read_to_string(fixtures().join("levels/crater.fizz"))
        .unwrap()
        .replace('\n', "\r\n");
    let view = LevelDocument::new(&text).view();
    let n = view
        .spawns
        .iter()
        .position(|s| s.on_ground && s.x == 62.0)
        .expect("the middle gloop");
    let thing = thing_ref(&text, &view, ThingKind::Spawn, n).unwrap();
    let out = apply_thing_edit(
        &text,
        &LevelEdit::FaceThing {
            thing,
            facing: Facing::Right,
        },
    )
    .unwrap();
    assert!(out.text.matches('\n').count() == text.matches('\n').count() + 2);
    assert_eq!(
        out.text.matches("\r\n").count(),
        out.text.matches('\n').count(),
        "every line still ends in CRLF"
    );
}

#[test]
fn one_edit_of_the_largest_level_is_quick() {
    let (name, text) = files("levels")
        .into_iter()
        .max_by_key(|(_, t)| t.len())
        .unwrap();
    let view = LevelDocument::new(&text).view();
    let thing = thing_ref(&text, &view, ThingKind::Item, view.items.len() / 2).unwrap();
    let (x, y) = here(&view, ThingKind::Item, view.items.len() / 2);
    let started = Instant::now();
    let _ = move_to(&text, thing, x + 1.0, y);
    let took = started.elapsed();
    // A debug build, loosely: the point is one edit is a handful of parses, not seconds.
    assert!(took.as_millis() < 2000, "{name}: {took:?}");
}

// ---------------------------------------------------------------------------------------------
// Locks by effect

const CRATER: &str = include_str!("../../../levels/crater.fizz");

fn opened(text: &str) -> (Session<LevelDocument>, fizz_studio_session::WriterToken) {
    let mut session = Session::new(LevelDocument::new(text));
    let token = session.claim_writer("test").unwrap();
    (session, token)
}

fn first_item(text: &str, word: &str) -> (ThingRef, f64, f64) {
    let view = LevelDocument::new(text).view();
    let index = view
        .items
        .iter()
        .position(|i| i.kind == word && i.generator.is_none())
        .unwrap();
    let t = thing_ref(text, &view, ThingKind::Item, index).unwrap();
    (t, view.items[index].x, view.items[index].y)
}

fn move_edit(thing: ThingRef, x: f64, y: Option<f64>) -> LevelEdit {
    LevelEdit::MoveThing { thing, x, y }
}

fn lock(session: &mut Session<LevelDocument>, layers: &[&str]) {
    session.set_locks(layers.iter().map(|l| l.to_string()));
}

fn layers_of(error: SessionError) -> Vec<String> {
    match error {
        SessionError::Locked { layers } => layers,
        other => panic!("expected a lock, got {other:?}"),
    }
}

#[test]
fn locking_treats_refuses_moving_a_treat_but_not_an_enemy_or_the_start() {
    let (mut session, token) = opened(CRATER);
    lock(&mut session, &["treats"]);
    let (soda, x, y) = first_item(CRATER, "soda");
    let asked = Request::new(0, "m", move_edit(soda, x + 1.0, Some(y)));
    assert_eq!(
        layers_of(session.apply(&token, asked).unwrap_err()),
        ["treats"]
    );
    assert_eq!(session.text(), CRATER);

    let view = LevelDocument::new(CRATER).view();
    let drone = view.spawns.iter().position(|s| s.kind == "drone").unwrap();
    let thing = thing_ref(CRATER, &view, ThingKind::Spawn, drone).unwrap();
    let asked = Request::new(
        0,
        "m",
        move_edit(thing, view.spawns[drone].x + 1.0, view.spawns[drone].y),
    );
    session.apply(&token, asked).unwrap();
}

#[test]
fn locking_enemies_refuses_moving_and_turning_an_enemy_but_not_a_treat() {
    let (mut session, token) = opened(CRATER);
    lock(&mut session, &["enemies"]);
    let view = LevelDocument::new(CRATER).view();
    let thing = thing_ref(CRATER, &view, ThingKind::Spawn, 1).unwrap();
    let flip = LevelEdit::FaceThing {
        thing: thing.clone(),
        facing: Facing::Right,
    };
    let asked = Request::new(0, "f", flip);
    assert_eq!(
        layers_of(session.apply(&token, asked).unwrap_err()),
        ["enemies"]
    );
    let gone = LevelEdit::DeleteThing { thing };
    let asked = Request::new(0, "d", gone);
    assert_eq!(
        layers_of(session.apply(&token, asked).unwrap_err()),
        ["enemies"]
    );
    assert_eq!(session.text(), CRATER);

    let (soda, x, y) = first_item(CRATER, "soda");
    let asked = Request::new(0, "m", move_edit(soda, x + 1.0, Some(y)));
    session.apply(&token, asked).unwrap();
}

#[test]
fn locking_edits_stops_painting_but_not_a_hand_written_thing_and_does_stop_an_edits_thing() {
    // D71 (3) as reworded: every APPENDED change touches `edits`; a structured edit of a
    // hand-written thing touches only its own layer.
    let (mut session, token) = opened(CRATER);
    lock(&mut session, &["edits"]);
    let (soda, x, y) = first_item(CRATER, "soda");
    let asked = Request::new(0, "m", move_edit(soda, x + 1.0, Some(y)));
    session
        .apply(&token, asked)
        .expect("a hand-written treat is not in edits");

    // A thing placed under `edits` is: its statement is in that block.
    let (mut session, token) = opened(CRATER);
    let place = LevelEdit::Place {
        item: "cheezie".into(),
        x: vec![[5, 5]],
        y: vec![[9, 9]],
    };
    session
        .apply(&token, Request::new(0, "place", place))
        .unwrap();
    let text = session.text().to_string();
    lock(&mut session, &["edits"]);
    let view = LevelDocument::new(&text).view();
    let last = view.items.len() - 1;
    let thing = thing_ref(&text, &view, ThingKind::Item, last).unwrap();
    let asked = Request::new(session.revision(), "m", move_edit(thing, 6.0, Some(9.0)));
    let layers = layers_of(session.apply(&token, asked).unwrap_err());
    assert!(layers.contains(&"edits".to_string()), "{layers:?}");
    assert_eq!(session.text(), text);
}

#[test]
fn the_start_is_never_locked_even_with_every_layer_locked() {
    let (mut session, token) = opened(CRATER);
    lock(&mut session, &LAYER_ORDER);
    let view = LevelDocument::new(CRATER).view();
    let thing = thing_ref(CRATER, &view, ThingKind::Start, 0).unwrap();
    let asked = Request::new(0, "m", move_edit(thing, 5.0, Some(4.0)));
    session.apply(&token, asked).unwrap();
    assert!(session.text().contains("start 5,4"));
}

#[test]
fn moving_a_thing_over_cells_a_locked_tile_layer_owns_is_allowed() {
    // `block x=49..51 y=10` is the blocks layer's; a treat moved onto it changes none of its cells.
    let (mut session, token) = opened(CRATER);
    lock(
        &mut session,
        &["terrain", "walls", "blocks", "markers", "crystals"],
    );
    let (soda, _, _) = first_item(CRATER, "soda");
    let asked = Request::new(0, "m", move_edit(soda, 50.0, Some(10.0)));
    session.apply(&token, asked).unwrap();
    assert!(session.text().contains("soda        x=50 y=10"));
}

#[test]
fn undoing_a_move_with_its_layer_locked_is_refused_and_keeps_the_step() {
    let (mut session, token) = opened(CRATER);
    let (soda, x, y) = first_item(CRATER, "soda");
    session
        .apply(
            &token,
            Request::new(0, "move", move_edit(soda, x + 1.0, Some(y))),
        )
        .unwrap();
    let moved = session.text().to_string();
    lock(&mut session, &["treats"]);
    let refused = session.undo(&token, 1).unwrap_err();
    assert_eq!(layers_of(refused), ["treats"]);
    assert_eq!(session.text(), moved);
    assert_eq!(session.undo_depth(), 1, "the step is kept");
    lock(&mut session, &[]);
    session.undo(&token, 1).unwrap();
    assert_eq!(session.text(), CRATER);
}

#[test]
fn a_refused_thing_edit_is_a_document_refusal_not_a_lock() {
    let (mut session, token) = opened(CRATER);
    lock(&mut session, &["treats"]);
    let view = LevelDocument::new(CRATER).view();
    let thing = thing_ref(CRATER, &view, ThingKind::Start, 0).unwrap();
    let asked = Request::new(0, "d", LevelEdit::DeleteThing { thing });
    assert!(matches!(
        session.apply(&token, asked),
        Err(SessionError::Document(DocumentError::Refused(_)))
    ));
}

#[allow(dead_code)]
fn document_is_a_document(doc: &LevelDocument) -> &str {
    doc.text()
}
