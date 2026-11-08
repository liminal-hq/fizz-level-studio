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
fn a_row_is_one_line_with_its_step_and_undoes_in_one_go() {
    let (mut session, token) = open();
    let row = LevelEdit::Row {
        item: "cheezie".to_string(),
        x: [4, 10],
        y: 9,
        by: 3,
    };
    assert_eq!(step_name(&row), "Place 3 cheezie");
    session.apply(&token, request(&session, row)).unwrap();
    assert!(session.text().ends_with("  row cheezie x=4..10 y=9 by=3\n"));
    let view = LevelDocument::new(session.text()).view();
    assert!(view.diagnostics.is_empty());
    let placed = view
        .items
        .iter()
        .filter(|i| i.y == 9.0 && i.kind == "cheezie")
        .count();
    assert!(placed >= 3);
    session.undo(&token, session.revision()).unwrap();
    assert_eq!(session.text(), CRATER);
}

#[test]
fn a_row_off_its_step_or_an_unknown_enemy_is_refused() {
    let (mut session, token) = open();
    for edit in [
        LevelEdit::Row {
            item: "cheezie".to_string(),
            x: [4, 9],
            y: 9,
            by: 3,
        },
        LevelEdit::Row {
            item: "cheezie".to_string(),
            x: [4, 9],
            y: 9,
            by: 0,
        },
        LevelEdit::Row {
            item: "gold".to_string(),
            x: [4, 6],
            y: 9,
            by: 1,
        },
        LevelEdit::Row {
            item: "cheezie".to_string(),
            x: [4, 6],
            y: 99,
            by: 1,
        },
        LevelEdit::Spawn {
            enemy: "dragon".to_string(),
            x: 4,
            y: 9,
        },
        LevelEdit::Spawn {
            enemy: "drone".to_string(),
            x: 400,
            y: 9,
        },
    ] {
        assert!(session.apply(&token, request(&session, edit)).is_err());
    }
    assert_eq!(session.text(), CRATER);
}

#[test]
fn an_enemy_is_one_spawn_line() {
    let (mut session, token) = open();
    let spawn = LevelEdit::Spawn {
        enemy: "drone".to_string(),
        x: 20,
        y: 12,
    };
    assert_eq!(step_name(&spawn), "Place drone");
    session.apply(&token, request(&session, spawn)).unwrap();
    assert!(session.text().ends_with("  drone x=20 y=12\n"));
    let view = LevelDocument::new(session.text()).view();
    assert!(view.diagnostics.is_empty());
    assert!(view
        .spawns
        .iter()
        .any(|s| s.kind == "drone" && s.x == 20.0 && s.y == Some(12.0)));
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

const LINES: &str = "level \"Lines\" 12x8 ground=2 id=crater
start 2,2

blocks
  fill x=0..11 y=0..1
  red-door x=8 y=2..3
  exit x=10 y=2..3

treats
  cheezie x=3..4 y=4
  key-red x=6 y=5

enemies
  gloop x=5,7 y=2
  drone x=9 y=6 dir=-1

edits
  paint red-door x=8 y=3
  place cookie x=1 y=6
";

#[test]
fn every_thing_in_the_view_carries_the_line_that_placed_it() {
    let view = LevelDocument::new(LINES).view();
    assert!(view.diagnostics.is_empty(), "{:?}", view.diagnostics);
    assert_eq!(view.start.map(|s| s.line), Some(Some(2)));
    let items: Vec<(&str, f64, Option<u32>)> = view
        .items
        .iter()
        .map(|i| (i.kind.as_str(), i.x, i.line))
        .collect();
    assert_eq!(
        items,
        [
            ("cheezie", 3.0, Some(10)),
            ("cheezie", 4.0, Some(10)),
            ("key-red", 6.0, Some(11)),
            ("cookie", 1.0, Some(19)),
        ]
    );
    let spawns: Vec<(&str, f64, Option<u32>)> = view
        .spawns
        .iter()
        .map(|s| (s.kind.as_str(), s.x, s.line))
        .collect();
    assert_eq!(
        spawns,
        [
            ("gloop", 5.0, Some(14)),
            ("gloop", 7.0, Some(14)),
            ("drone", 9.0, Some(15)),
        ]
    );
}

#[test]
fn exits_and_doors_are_markers_and_a_later_paint_takes_the_cell() {
    let view = LevelDocument::new(LINES).view();
    let markers: Vec<(&str, f64, f64, u32, Option<u32>)> = view
        .markers
        .iter()
        .map(|m| (m.kind.as_str(), m.x, m.y, m.height, m.line))
        .collect();
    // The edit repaints the door's top cell, so that cell is the edit's and the bottom keeps its own.
    assert_eq!(
        markers,
        [
            ("red-door", 8.0, 2.0, 1, Some(6)),
            ("red-door", 8.0, 3.0, 1, Some(18)),
            ("exit", 10.0, 2.0, 2, Some(7)),
        ]
    );
}

#[test]
fn crater_has_its_exit_door_and_key_with_their_lines() {
    let view = LevelDocument::new(CRATER).view();
    assert!(view.items.iter().all(|i| i.line.is_some()));
    assert!(view.spawns.iter().all(|s| s.line.is_some()));
    assert!(view.markers.iter().any(|m| m.kind == "exit"));
    assert!(view.markers.iter().any(|m| m.kind == "red-door"));
    assert!(view.items.iter().any(|i| i.kind == "key-red"));
    for marker in &view.markers {
        let line = marker.line.expect("a marker has a line") as usize;
        let text = CRATER.lines().nth(line - 1).unwrap();
        assert!(text.contains(&marker.kind), "line {line}: {text}");
    }
}

#[test]
fn the_view_lists_the_layers_with_the_counts_of_what_the_level_builds() {
    let view = LevelDocument::new(CRATER).view();
    let ids: Vec<&str> = view.sections.iter().map(|s| s.id.as_str()).collect();
    assert_eq!(
        ids,
        ["terrain", "walls", "blocks", "crystals", "markers", "treats", "enemies"]
    );
    let count = |id: &str| view.sections.iter().find(|s| s.id == id).unwrap().count;
    assert_eq!(count("treats") as usize, view.items.len());
    assert_eq!(count("enemies") as usize, view.spawns.len());
    assert_eq!(count("markers") as usize, view.markers.len());
}

#[test]
fn an_edit_adds_the_edits_layer_to_the_view() {
    let (mut session, token) = open();
    let edit = paint("grass", 5, 9);
    let request = request(&session, edit);
    session.apply(&token, request).unwrap();
    let view = session.document().view();
    let edits = view.sections.iter().find(|s| s.id == "edits").unwrap();
    assert_eq!(edits.count, 1);
    assert_eq!(view.sections.last().unwrap().id, "edits");
}

fn lock(session: &mut Session<LevelDocument>, layers: &[&str]) {
    session.set_locks(layers.iter().map(|l| (*l).to_string()));
}

fn locked(error: fizz_studio_session::SessionError) -> Vec<String> {
    match error {
        fizz_studio_session::SessionError::Locked { layers } => layers,
        other => panic!("expected a lock, got {other:?}"),
    }
}

#[test]
fn locking_treats_refuses_placing_a_treat_but_not_painting_a_tile() {
    let (mut session, token) = open();
    lock(&mut session, &["treats"]);
    let place = LevelEdit::Place {
        item: "cheezie".to_string(),
        x: vec![[5, 5]],
        y: vec![[9, 9]],
    };
    let asked = request(&session, place);
    assert_eq!(
        locked(session.apply(&token, asked).unwrap_err()),
        ["treats"]
    );
    assert_eq!(session.text(), CRATER);
    let edit = paint("grass", 5, 9);
    let asked = request(&session, edit);
    session.apply(&token, asked).unwrap();
}

#[test]
fn locking_enemies_refuses_a_spawn_and_markers_an_exit() {
    let (mut session, token) = open();
    lock(&mut session, &["enemies", "markers"]);
    let spawn = LevelEdit::Spawn {
        enemy: "gloop".to_string(),
        x: 9,
        y: 9,
    };
    let asked = request(&session, spawn);
    assert_eq!(
        locked(session.apply(&token, asked).unwrap_err()),
        ["enemies"]
    );
    let edit = paint("exit", 9, 9);
    let asked = request(&session, edit);
    assert_eq!(
        locked(session.apply(&token, asked).unwrap_err()),
        ["markers"]
    );
}

#[test]
fn locking_edits_stops_every_edit() {
    let (mut session, token) = open();
    lock(&mut session, &["edits"]);
    for edit in [
        paint("grass", 5, 9),
        LevelEdit::Clear {
            x: vec![[5, 5]],
            y: vec![[9, 9]],
        },
    ] {
        let asked = request(&session, edit);
        assert_eq!(locked(session.apply(&token, asked).unwrap_err()), ["edits"]);
    }
    assert_eq!(session.revision(), 0);
}

#[test]
fn undo_across_a_lock_is_refused_naming_the_layer() {
    let (mut session, token) = open();
    let place = LevelEdit::Place {
        item: "cheezie".to_string(),
        x: vec![[5, 5]],
        y: vec![[9, 9]],
    };
    let asked = request(&session, place);
    session.apply(&token, asked).unwrap();
    lock(&mut session, &["treats"]);
    let undone = session.undo(&token, session.revision());
    assert_eq!(locked(undone.unwrap_err()), ["treats"]);
    assert!(session.text().contains("place cheezie"));
    lock(&mut session, &[]);
    session.undo(&token, session.revision()).unwrap();
    assert_eq!(session.text(), CRATER);
}

#[test]
fn an_outside_edit_to_a_locked_section_is_refused_and_another_is_taken() {
    let (mut session, token) = open();
    lock(&mut session, &["treats"]);
    let changed = CRATER.replace("soda        x=36 y=5", "soda        x=37 y=5");
    let error = session.apply_outside_edit(&token, 0, &changed).unwrap_err();
    assert_eq!(locked(error), ["treats"]);
    assert_eq!(session.text(), CRATER);
    let changed = CRATER.replace("flat 14, up 2", "flat 15, up 2");
    session.apply_outside_edit(&token, 0, &changed).unwrap();
}

#[test]
fn a_fizz_2_level_is_never_locked() {
    use crate::open_level_text;
    let mut session = Session::new(open_level_text("script fizz2 0\n"));
    session.set_locks(["edits".to_string()]);
    let token = session.claim_writer("test").unwrap();
    assert!(session
        .apply_outside_edit(&token, 0, "script fizz2 0\n\n")
        .is_ok());
}

fn owner_at(view: &fizz_studio_protocol::LevelView, x: usize, y: usize) -> Option<&str> {
    let index = view.cell_sections[y * view.width as usize + x];
    view.sections.get(usize::from(index)).map(|s| s.id.as_str())
}

#[test]
fn nothing_hidden_is_the_ordinary_view() {
    let document = LevelDocument::new(CRATER);
    assert_eq!(document.view_without(&[]), document.view());
    // A layer the level does not have hides nothing.
    assert_eq!(
        document.view_without(&["nonsense".to_string()]),
        document.view()
    );
}

#[test]
fn every_cell_is_traced_to_the_layer_that_wrote_it() {
    let view = LevelDocument::new(CRATER).view();
    assert_eq!(view.cell_sections.len(), view.cells.len());
    // The ground at the start is terrain, the one-way plat on line 17 is blocks, and the sky is no one's.
    assert_eq!(owner_at(&view, 5, 1), Some("terrain"));
    assert_eq!(owner_at(&view, 50, 10), Some("blocks"));
    assert_eq!(owner_at(&view, 10, 20), None);
    assert_eq!(view.cell_sections[20 * 192 + 10], 255);
    // The end walls come from the `walls` statement, the crystals and the exit from their own rows.
    assert_eq!(owner_at(&view, 0, 10), Some("walls"));
    assert_eq!(owner_at(&view, 186, 6), Some("markers"));
    assert!(view.cell_sections.iter().any(|&i| view
        .sections
        .get(usize::from(i))
        .is_some_and(|s| s.id == "crystals")));
}

#[test]
fn the_owner_agrees_with_the_line_that_last_changed_the_cell() {
    let document = LevelDocument::new(CRATER);
    let view = document.view();
    let sections = fizz_studio_level_lines(&view);
    for (x, y) in [(50, 10), (49, 10), (107, 5), (5, 1)] {
        let line = document.cell_line(x, y).expect("a statement set it");
        let owner = owner_at(&view, x as usize, y as usize).expect("an owner");
        let section = sections
            .iter()
            .find(|(id, runs)| *id == owner && runs.iter().any(|[a, b]| (*a..=*b).contains(&line)))
            .map(|(id, _)| *id);
        assert_eq!(section, Some(owner), "cell {x},{y} on line {line}");
    }
}

fn fizz_studio_level_lines(view: &fizz_studio_protocol::LevelView) -> Vec<(&str, Vec<[u32; 2]>)> {
    view.sections
        .iter()
        .map(|s| (s.id.as_str(), s.lines.clone()))
        .collect()
}

#[test]
fn hiding_terrain_leaves_the_ground_out_of_the_drawing_and_the_script_alone() {
    let document = LevelDocument::new(CRATER);
    let full = document.view();
    let masked = document.view_without(&["terrain".to_string()]);
    assert_ne!(masked.cells, full.cells);
    assert_eq!(masked.cells.len(), full.cells.len());
    // The cell at 5,1 was ground; without the terrain statements it is the sky.
    let word = |view: &fizz_studio_protocol::LevelView, x: usize, y: usize| {
        view.palette[usize::from(view.cells[y * 192 + x])].clone()
    };
    assert_ne!(word(&full, 5, 1), "empty");
    assert_eq!(word(&masked, 5, 1), "empty");
    // The plat that blocks wrote is still there, and the rows still list every layer.
    assert_eq!(word(&masked, 50, 10), word(&full, 50, 10));
    assert_eq!(masked.sections.len(), full.sections.len());
    assert_eq!(document.text(), CRATER);
}

#[test]
fn hiding_edits_shows_the_level_as_it_was_before_the_studio_changed_it() {
    let (mut session, token) = open();
    let edit = paint("grass", 5, 9);
    let asked = request(&session, edit);
    session.apply(&token, asked).unwrap();
    let document = session.document();
    let full = document.view();
    let masked = document.view_without(&["edits".to_string()]);
    assert_eq!(owner_at(&full, 5, 9), Some("edits"));
    assert_ne!(masked.cells, full.cells);
    assert_eq!(masked.cells, LevelDocument::new(CRATER).view().cells);
}

fn clear(x: u32, y: u32) -> LevelEdit {
    LevelEdit::Clear {
        x: vec![[x, x]],
        y: vec![[y, y]],
    }
}

#[test]
fn locking_terrain_refuses_painting_or_clearing_over_its_cells_and_not_the_sky() {
    let (mut session, token) = open();
    lock(&mut session, &["terrain"]);
    for edit in [paint("grass", 5, 1), clear(5, 1)] {
        let asked = request(&session, edit);
        assert_eq!(
            locked(session.apply(&token, asked).unwrap_err()),
            ["terrain"]
        );
    }
    assert_eq!(session.text(), CRATER);
    // Row 20 is open sky that no statement wrote.
    let edit = paint("grass", 5, 20);
    let asked = request(&session, edit);
    session.apply(&token, asked).unwrap();
}

#[test]
fn a_range_that_reaches_a_locked_layer_is_refused_whole() {
    let (mut session, token) = open();
    lock(&mut session, &["blocks"]);
    // x 48..52 at y=10 crosses the block line at x=49..51.
    let edit = LevelEdit::Paint {
        tile: "grass".to_string(),
        x: vec![[48, 52]],
        y: vec![[10, 10]],
    };
    let asked = request(&session, edit);
    assert_eq!(
        locked(session.apply(&token, asked).unwrap_err()),
        ["blocks"]
    );
    let edit = LevelEdit::Paint {
        tile: "grass".to_string(),
        x: vec![[40, 44]],
        y: vec![[10, 10]],
    };
    let asked = request(&session, edit);
    session.apply(&token, asked).unwrap();
}

#[test]
fn locking_the_end_walls_and_the_doors_guards_their_cells() {
    let (mut session, token) = open();
    lock(&mut session, &["walls", "markers"]);
    let asked = request(&session, paint("grass", 0, 10));
    assert_eq!(locked(session.apply(&token, asked).unwrap_err()), ["walls"]);
    let asked = request(&session, clear(186, 6));
    assert_eq!(
        locked(session.apply(&token, asked).unwrap_err()),
        ["markers"]
    );
}

#[test]
fn a_cell_painted_in_the_studio_belongs_to_edits_not_to_what_was_beneath() {
    let (mut session, token) = open();
    let asked = request(&session, paint("grass", 5, 1));
    session.apply(&token, asked).unwrap();
    // The cell now belongs to the edit that painted it, so locking the terrain does not guard it
    // again, and locking edits does.
    lock(&mut session, &["terrain"]);
    let asked = request(&session, paint("rock", 5, 1));
    session.apply(&token, asked).unwrap();
    lock(&mut session, &["edits"]);
    let asked = request(&session, paint("grass", 5, 1));
    assert_eq!(locked(session.apply(&token, asked).unwrap_err()), ["edits"]);
}

#[test]
fn undoing_a_paint_that_covered_a_cell_of_a_locked_layer_is_refused() {
    let (mut session, token) = open();
    let asked = request(&session, paint("grass", 5, 1));
    session.apply(&token, asked).unwrap();
    lock(&mut session, &["terrain"]);
    // Taking the paint away puts the terrain's own cell back, which a lock on terrain forbids.
    let undone = session.undo(&token, session.revision());
    assert_eq!(locked(undone.unwrap_err()), ["terrain"]);
    assert!(session.text().contains("paint grass x=5 y=1"));
    lock(&mut session, &[]);
    session.undo(&token, session.revision()).unwrap();
    assert_eq!(session.text(), CRATER);
}

#[test]
fn an_outside_edit_that_adds_a_paint_over_locked_cells_is_refused_and_a_free_one_is_taken() {
    let (mut session, token) = open();
    lock(&mut session, &["terrain"]);
    let over = format!("{CRATER}\nedits\n  paint grass x=5 y=1\n");
    let error = session.apply_outside_edit(&token, 0, &over).unwrap_err();
    assert_eq!(locked(error), ["terrain"]);
    let sky = format!("{CRATER}\nedits\n  paint grass x=5 y=20\n");
    session.apply_outside_edit(&token, 0, &sky).unwrap();
}

/// A level whose things are all placed relative to the ground the terrain lays: crystals, enemies
/// with no `y`, a pogo cache, and a start and an exit at fixed places for contrast.
const GROUND_RELATIVE: &str = "level \"Relative\" 60x24 ground=4 id=crater
theme crater
start 3,4

terrain
  flat 10, up 3, flat 8, down 3, flat 6, up22 2, flat 12, spikes 2, flat 8

walls

blocks
  block    x=20..22 y=12
  plat     x=30..33 y=9
  exit     x=57 y=6..7
  crystal  x=2,8,14,26,40

treats
  row cheezie x=4..7 y=8
  pogo-cache  x=12..14 rise=6
  pogo-cache  x=44..46 rise=3

enemies
  gloop  x=5,16,28,50
  hopper x=36
  drone  x=20.5 y=9.5
";

/// What a layer's hiding may leave out of a view: the cells, items, spawns and markers owned by
/// statements of the hidden layers. Everything else must be exactly as in the whole view.
fn assert_only_the_hidden_is_gone(text: &str, hidden: &[&str]) {
    let document = LevelDocument::new(text);
    let full = document.view();
    let ids: Vec<String> = hidden.iter().map(|id| (*id).to_string()).collect();
    let masked = document.view_without(&ids);
    let gone = crate::layers::lines_in(&fizz_studio_language::parser::parse(text).ast, &ids);
    let shown = |line: Option<u32>| !line.is_some_and(|l| gone.contains(&(l as usize)));
    let what = format!("hiding {hidden:?}");

    assert_eq!(
        (masked.width, masked.height),
        (full.width, full.height),
        "{what}"
    );
    assert_eq!(masked.start, full.start.filter(|s| shown(s.line)), "{what}");
    let items: Vec<_> = full
        .items
        .iter()
        .filter(|i| shown(i.line))
        .cloned()
        .collect();
    assert_eq!(masked.items, items, "{what}: items");
    let spawns: Vec<_> = full
        .spawns
        .iter()
        .filter(|s| shown(s.line))
        .cloned()
        .collect();
    assert_eq!(
        masked.spawns, spawns,
        "{what}: spawns (a spawn with no y keeps its ground height)"
    );
    let markers: Vec<_> = full
        .markers
        .iter()
        .filter(|m| shown(m.line))
        .cloned()
        .collect();
    assert_eq!(masked.markers, markers, "{what}: markers");

    // A cell whose last writer is shown holds the same tile; one whose last writer is hidden does not
    // show that writer's tile. The rows keep their counts, so a hidden layer can be read and shown.
    assert_eq!(masked.sections, full.sections, "{what}: rows");
    for (at, owner) in full.cell_sections.iter().enumerate() {
        let id = full
            .sections
            .get(usize::from(*owner))
            .map(|s| s.id.as_str());
        if id.is_some_and(|id| hidden.contains(&id)) {
            assert!(
                masked.cell_sections[at] != *owner || full.cells[at] == masked.cells[at],
                "{what}: cell {at} still drawn from a hidden layer"
            );
        } else {
            assert_eq!(masked.cells[at], full.cells[at], "{what}: cell {at}");
            assert_eq!(masked.cell_sections[at], *owner, "{what}: cell {at} owner");
        }
    }
}

#[test]
fn hiding_any_layer_or_set_of_layers_moves_nothing_that_stays_visible() {
    let layers = [
        "terrain", "walls", "blocks", "crystals", "markers", "treats", "enemies",
    ];
    for text in [CRATER, GROUND_RELATIVE] {
        for id in layers {
            assert_only_the_hidden_is_gone(text, &[id]);
        }
        for (a, b) in [
            ("terrain", "walls"),
            ("terrain", "blocks"),
            ("terrain", "crystals"),
            ("terrain", "treats"),
            ("terrain", "enemies"),
            ("walls", "blocks"),
            ("crystals", "markers"),
            ("treats", "enemies"),
        ] {
            assert_only_the_hidden_is_gone(text, &[a, b]);
        }
        assert_only_the_hidden_is_gone(text, &layers);
    }
}

#[test]
fn hiding_terrain_keeps_the_crystals_the_spawns_and_the_pogo_caches_where_they_were() {
    let document = LevelDocument::new(GROUND_RELATIVE);
    let full = document.view();
    assert!(full.diagnostics.is_empty(), "{:?}", full.diagnostics);
    let masked = document.view_without(&["terrain".to_string()]);
    let word = |view: &fizz_studio_protocol::LevelView, x: usize, y: usize| {
        view.palette[usize::from(view.cells[y * 60 + x])].clone()
    };
    // Crystals sit on the ground surface; without the terrain drawn they are still there.
    assert_eq!(word(&full, 8, 4), "crystal-tile");
    assert_eq!(word(&masked, 8, 4), "crystal-tile");
    assert_eq!(word(&full, 14, 7), "crystal-tile");
    assert_eq!(word(&masked, 14, 7), "crystal-tile");
    // The ground under them is not drawn.
    assert_eq!(word(&masked, 8, 1), "empty");
    // Every enemy keeps the y the ground gave it, and the treats of the pogo caches stay up.
    assert!(full
        .spawns
        .iter()
        .filter(|s| s.kind != "drone")
        .all(|s| s.y.is_some()));
    assert_eq!(masked.spawns, full.spawns);
    assert_eq!(masked.items, full.items);
    // The ground-relative things were not placed at the fixed-height fallback.
    assert!(full.items.len() >= 7);
}

#[test]
fn hiding_a_layer_keeps_every_rows_count() {
    let document = LevelDocument::new(CRATER);
    let full = document.view();
    for id in ["terrain", "treats", "enemies", "markers", "crystals"] {
        let masked = document.view_without(&[id.to_string()]);
        let counts = |view: &fizz_studio_protocol::LevelView| {
            view.sections
                .iter()
                .map(|s| (s.id.clone(), s.count))
                .collect::<Vec<_>>()
        };
        assert_eq!(counts(&masked), counts(&full), "hiding {id}");
    }
}

#[test]
fn a_locked_layer_still_refuses_an_edit_over_a_ground_relative_thing() {
    // Locking the crystals refuses an edit that would paint over a crystal's cell, whether or not
    // the terrain under it is hidden: locks look at the script's own cells, not the masked drawing.
    let (mut session, token) = open();
    session.set_locks(vec!["crystals".to_string()]);
    let before = session.document().text().to_string();
    let edit = paint("grass", 10, 4);
    let asked = request(&session, edit);
    assert!(session.apply(&token, asked).is_err());
    assert_eq!(session.document().text(), before);
}
