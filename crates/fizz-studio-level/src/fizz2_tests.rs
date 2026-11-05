// Tests for the Fizz 2 level document: map paints, refusals, undo, the view, and dispatch
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_protocol::{LevelEdit, LevelTarget};
use fizz_studio_session::{Document, Request, Session, WriterToken};

use crate::{open_level_text, step_name, AnyLevelDocument, Fizz2LevelDocument};

const SLICE: &str = include_str!("../../../fixtures/fizz2/worlds/light/levels/light-1.fizz");

fn paint(tile: &str, x: [u32; 2], y: [u32; 2]) -> LevelEdit {
    LevelEdit::Paint {
        tile: tile.to_string(),
        x: vec![x],
        y: vec![y],
    }
}

fn open() -> (Session<Fizz2LevelDocument>, WriterToken) {
    let mut session = Session::new(Fizz2LevelDocument::new(SLICE));
    let token = session.claim_writer("test").unwrap();
    (session, token)
}

fn request(session: &Session<Fizz2LevelDocument>, edit: LevelEdit) -> Request<LevelEdit> {
    Request::new(session.revision(), step_name(&edit), edit)
}

fn changed_lines(a: &str, b: &str) -> Vec<usize> {
    let (a, b): (Vec<_>, Vec<_>) = (a.split('\n').collect(), b.split('\n').collect());
    assert_eq!(a.len(), b.len());
    (0..a.len()).filter(|&i| a[i] != b[i]).collect()
}

#[test]
fn the_slice_opens_as_32_by_48_with_no_diagnostics() {
    let view = Fizz2LevelDocument::new(SLICE).view();
    assert_eq!((view.width, view.height), (32, 48));
    assert_eq!(view.cells.len(), 32 * 48);
    assert_eq!(view.name, "Lighthouse Point");
    assert_eq!(view.start.map(|s| (s.x, s.y)), Some((2.0, 2.0)));
    assert_eq!(view.palette[0], "empty");
    assert!(view.items.is_empty() && view.spawns.is_empty());
    assert!(view.diagnostics.is_empty(), "{:?}", view.diagnostics);
    // Row 0 is the bottom: all fill. The top left is open air.
    assert_eq!(view.palette[view.cells[0] as usize], "fill");
    assert_eq!(view.palette[view.cells[47 * 32] as usize], "empty");
}

#[test]
fn a_paint_rewrites_exactly_the_touched_rows() {
    let (mut session, token) = open();
    let request = request(&session, paint("BLOCK", [3, 5], [2, 3]));
    let patch = session.apply(&token, request).unwrap();
    assert_eq!(patch.edits.len(), 1);
    let text = session.text();
    let touched = changed_lines(SLICE, text);
    assert_eq!(touched.len(), 2);
    let lines: Vec<&str> = text.split('\n').collect();
    for &i in &touched {
        // The map rows end with their row number; only rows 2 and 3 change.
        let number = lines[i].rsplit("|  ").next().unwrap().trim();
        assert!(number == "2" || number == "3", "{number}");
        assert_eq!(&lines[i][5..8], "BBB");
    }
    let view = session.document().view();
    assert_eq!(view.palette[view.cells[2 * 32 + 3] as usize], "block");
    assert_eq!(view.palette[view.cells[3 * 32 + 5] as usize], "block");
}

#[test]
fn tile_names_match_in_any_case_and_clear_paints_empty() {
    for name in ["plat", "PLAT", "Plat"] {
        let mut document = Fizz2LevelDocument::new(SLICE);
        document.apply(&paint(name, [1, 1], [3, 3])).unwrap();
        let view = document.view();
        assert_eq!(view.palette[view.cells[3 * 32 + 1] as usize], "plat");
        assert_eq!(changed_lines(SLICE, document.text()).len(), 1);
    }
    let mut document = Fizz2LevelDocument::new(SLICE);
    document
        .apply(&LevelEdit::Clear {
            x: vec![[0, 1]],
            y: vec![[0, 0]],
        })
        .unwrap();
    let view = document.view();
    assert_eq!(view.cells[0], 0);
    assert_eq!(view.cells[1], 0);
    assert_ne!(view.cells[2], 0);
}

#[test]
fn undoing_every_step_restores_the_bytes() {
    let (mut session, token) = open();
    for edit in [
        paint("block", [3, 5], [2, 3]),
        paint("spike", [10, 10], [20, 21]),
        LevelEdit::Clear {
            x: vec![[0, 3]],
            y: vec![[40, 40]],
        },
    ] {
        let request = request(&session, edit);
        session.apply(&token, request).unwrap();
        session.end_step(&token).unwrap();
    }
    assert_ne!(session.text(), SLICE);
    while session.can_undo() {
        session.undo(&token, session.revision()).unwrap();
    }
    assert_eq!(session.text(), SLICE);
}

#[test]
fn bad_edits_are_refused_and_change_nothing() {
    let (mut session, token) = open();
    let refused = [
        paint("lava", [1, 1], [1, 1]),
        paint("block", [32, 32], [1, 1]),
        paint("block", [1, 1], [48, 48]),
        // Half of these cells would be inside the map.
        paint("block", [30, 33], [1, 1]),
        paint("block", [5, 2], [1, 1]),
        LevelEdit::Paint {
            tile: "block".to_string(),
            x: vec![],
            y: vec![[1, 1]],
        },
        LevelEdit::Place {
            item: "cookie".to_string(),
            x: vec![[1, 1]],
            y: vec![[1, 1]],
        },
    ];
    for edit in refused {
        let request = request(&session, edit);
        assert!(session.apply(&token, request).is_err());
    }
    assert_eq!(session.text(), SLICE);
    assert_eq!(session.revision(), 0);
}

#[test]
fn a_bad_map_shows_its_diagnostics_in_english() {
    let broken = SLICE.replacen("|#wwwwwwwww^^^wwB", "|#wwwwwwwww^^?wwB", 1);
    let view = Fizz2LevelDocument::new(broken).view();
    assert_eq!(view.diagnostics.len(), 1);
    assert_eq!(view.diagnostics[0].code, "E104");
    assert!(view.diagnostics[0].message.contains('?'));
    let wrong = SLICE.replacen("script fizz2 0", "script fizz2 9", 1);
    let view = Fizz2LevelDocument::new(wrong).view();
    assert_eq!(view.diagnostics[0].code, "E101");
    assert!(!view.diagnostics[0].message.contains("dialect."));
}

#[test]
fn the_dispatch_picks_the_document_by_the_script_line() {
    let two = open_level_text(SLICE);
    assert!(matches!(two, AnyLevelDocument::Fizz2(_)));
    assert_eq!(two.target(), LevelTarget::Fizz2);
    assert_eq!(two.banner().as_deref(), Some("level.flatFallback"));
    let one = open_level_text(include_str!("../../../levels/crater.fizz"));
    assert!(matches!(one, AnyLevelDocument::Fizz1(_)));
    assert_eq!(one.target(), LevelTarget::Fizz1);
    assert_eq!(one.banner(), None);
    assert_eq!(one.view().width, 192);
}

#[test]
fn an_unknown_profile_is_none() {
    assert!(Fizz2LevelDocument::with_profile(SLICE, "nope").is_none());
    assert!(Fizz2LevelDocument::with_profile(SLICE, "synthetic").is_some());
}
