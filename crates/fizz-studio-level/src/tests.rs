// Tests for the level document: validation, minimal edits, undo through a session, and the view
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_protocol::LevelEdit;
use fizz_studio_session::{Document, Request, Session, WriterToken};

use crate::{step_name, LevelDocument};

const CRATER: &str = include_str!("../../../levels/crater.fizz");
const CRATER_GRID: &str = include_str!("../../../fixtures/fizz1/raster/levels-crater.json");

fn paint(tile: &str, x: u32, y: u32) -> LevelEdit {
    LevelEdit::Paint {
        tile: tile.to_string(),
        x: vec![[x, x]],
        y: vec![[y, y]],
    }
}

fn open() -> (Session<LevelDocument>, WriterToken) {
    let mut session = Session::new(LevelDocument::new(CRATER));
    let token = session.claim_writer("test").unwrap();
    (session, token)
}

fn request(session: &Session<LevelDocument>, edit: LevelEdit) -> Request<LevelEdit> {
    Request::new(session.revision(), step_name(&edit), edit)
}

#[test]
fn crater_opens_with_all_its_cells() {
    let view = LevelDocument::new(CRATER).view();
    assert_eq!((view.width, view.height), (192, 28));
    assert_eq!(view.cells.len(), 5_376);
    assert_eq!(view.name, "Crater Fields");
    assert!(view.diagnostics.is_empty());
    assert_eq!(view.palette[0], "empty");
}

#[test]
fn the_view_equals_the_reference_grid() {
    let golden: serde_json::Value = serde_json::from_str(CRATER_GRID).unwrap();
    let ids = golden["palette"].as_object().unwrap();
    let rows = golden["tiles"].as_array().unwrap();
    let expected: Vec<u64> = rows
        .iter()
        .flat_map(|row| row.as_array().unwrap().iter().map(|n| n.as_u64().unwrap()))
        .collect();
    let view = LevelDocument::new(CRATER).view();
    // The reference numbers tiles by the game's constants and leaves `empty` as 0.
    let seen: Vec<u64> = view
        .cells
        .iter()
        .map(|&cell| match view.palette[cell as usize].as_str() {
            "empty" => 0,
            word => ids[word].as_u64().unwrap(),
        })
        .collect();
    assert_eq!(seen, expected);
    assert_eq!(view.items.len(), golden["items"].as_array().unwrap().len());
    assert_eq!(
        view.spawns.len(),
        golden["spawns"].as_array().unwrap().len()
    );
    assert_eq!(view.start.map(|s| (s.x, s.y)), Some((3.0, 4.0)));
}

#[test]
fn a_paint_is_appended_under_edits_and_touches_only_the_end() {
    let (mut session, token) = open();
    let edit = paint("grass", 5, 10);
    let patch = session.apply(&token, request(&session, edit)).unwrap();
    assert_eq!(patch.edits.len(), 1);
    let change = &patch.edits[0];
    assert!(change.removed.is_empty());
    assert!(change.start + 1 >= CRATER.len(), "only the end changes");
    let text = session.text();
    assert!(text.contains("edits\n"));
    assert!(text.contains("paint grass x=5 y=10"));
    let (kept, _) = CRATER.split_at(change.start);
    assert!(text.starts_with(kept));
    let view = session.document().view();
    let at = (10 * view.width + 5) as usize;
    assert_eq!(view.palette[view.cells[at] as usize], "grass");
    assert!(view.diagnostics.is_empty());
}

#[test]
fn undoing_every_step_restores_the_original_bytes() {
    let (mut session, token) = open();
    for edit in [
        paint("grass", 5, 10),
        LevelEdit::Clear {
            x: vec![[0, 3]],
            y: vec![[8, 9]],
        },
        LevelEdit::Place {
            item: "cookie".to_string(),
            x: vec![[7, 7]],
            y: vec![[12, 12]],
        },
    ] {
        session.apply(&token, request(&session, edit)).unwrap();
        session.end_step(&token).unwrap();
    }
    assert_eq!(session.undo_step().unwrap().name, "Place cookie");
    while session.can_undo() {
        session.undo(&token, session.revision()).unwrap();
    }
    assert_eq!(session.text(), CRATER);
    while session.can_redo() {
        session.redo(&token, session.revision()).unwrap();
    }
    assert!(session.text().contains("place cookie"));
}

#[test]
fn a_stroke_of_many_paints_undoes_as_one_step() {
    let (mut session, token) = open();
    for x in 0..20 {
        let edit = paint("path", x, 6);
        let request = request(&session, edit).merging("stroke-1");
        session.apply(&token, request).unwrap();
    }
    assert_eq!(session.undo_depth(), 1);
    session.undo(&token, session.revision()).unwrap();
    assert_eq!(session.text(), CRATER);
}

#[test]
fn bad_edits_are_refused_and_change_nothing() {
    let (mut session, token) = open();
    let refused = [
        paint("lava", 1, 1),
        paint("grass", 192, 1),
        paint("grass", 1, 28),
        LevelEdit::Paint {
            tile: "grass".to_string(),
            x: vec![[9, 4]],
            y: vec![[1, 1]],
        },
        LevelEdit::Paint {
            tile: "grass".to_string(),
            x: vec![],
            y: vec![[1, 1]],
        },
        LevelEdit::Place {
            item: "gold".to_string(),
            x: vec![[1, 1]],
            y: vec![[1, 1]],
        },
    ];
    for edit in refused {
        assert!(session.apply(&token, request(&session, edit)).is_err());
    }
    assert_eq!(session.text(), CRATER);
    assert_eq!(session.revision(), 0);
}

#[test]
fn a_script_with_errors_still_has_a_view() {
    let broken = "level \"Tiny\" 4x3 ground=1 id=crater\nstart 1,1\nbogus line\n";
    let view = LevelDocument::new(broken).view();
    assert_eq!((view.width, view.height), (4, 3));
    assert_eq!(view.cells.len(), 12);
    assert!(!view.diagnostics.is_empty());
    assert_eq!(view.diagnostics[0].line, 3);
    assert!(!view.diagnostics[0].message.is_empty());

    let headless = LevelDocument::new("bogus line\n").view();
    assert_eq!((headless.width, headless.height), (0, 0));
    assert!(headless.cells.is_empty());
    assert!(!headless.diagnostics.is_empty());
}

#[test]
fn step_names_say_what_was_done() {
    assert_eq!(step_name(&paint("grass", 0, 0)), "Paint grass");
    assert_eq!(
        step_name(&LevelEdit::Clear {
            x: vec![],
            y: vec![]
        }),
        "Clear"
    );
}

#[test]
fn replace_refuses_a_range_inside_a_character() {
    let mut document = LevelDocument::new("é");
    assert!(document.replace(1, 2, "x").is_err());
    assert!(document.replace(0, 9, "x").is_err());
    assert_eq!(document.text(), "é");
}

#[test]
fn a_cell_is_traced_to_the_last_statement_that_changed_it() {
    let doc = LevelDocument::new(CRATER);
    assert_eq!(doc.cell_line(50, 10), Some(17));
    assert_eq!(doc.cell_line(107, 5), Some(18));
    assert_eq!(doc.cell_line(50, 11), Some(30));
    assert_eq!(doc.cell_line(3, 4), Some(5));
    assert_eq!(doc.cell_line(100, 20), None);
    assert_eq!(doc.cell_line(-1, 0), None);
}

#[test]
fn a_painted_cell_is_traced_to_its_edit_line() {
    let mut text = CRATER.to_string();
    text.push_str("\nedits\n  paint one-way x=50 y=10\n");
    let doc = LevelDocument::new(text.clone());
    let line = text.lines().count() as u32;
    assert_eq!(doc.cell_line(50, 10), Some(line));
}
