// Tests for the structured edits: one per statement form, and the refusals
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_protocol::{Facing, LevelEdit, ThingKind, ThingRef};
use fizz_studio_session::DocumentError;

use crate::{apply_thing_edit, LevelDocument, ThingOutcome};

const BASE: &str = "\
level \"T\" 60x16 ground=3 id=crater
theme crater
area crater-fields
start 3,4

terrain
  flat 60

blocks
  block x=49..51 y=10

treats
  row cheezie x=17..20 y=7  // four
  soda        x=36 y=5
  row choc    x=46..52 y=8 by=3
  cheezie x=10,26,40 y=6
  pogo-cache  x=8..10 rise=7

enemies
  gloop  x=35,42,55  // three
  drone  x=30.5 y=7.5
  hopper x=20 y=4 ride
  marsh  x=25 y=4 dir=-1

edits
  place cheezie x=5..6 y=9..10
";

/// The reference the webview would send for the n-th thing of a kind in `text`.
fn thing(text: &str, kind: ThingKind, index: usize) -> ThingRef {
    let view = LevelDocument::new(text).view();
    let (line, x, y) = match kind {
        ThingKind::Item => {
            let i = &view.items[index];
            (i.line, i.x, Some(i.y))
        }
        ThingKind::Spawn => {
            let s = &view.spawns[index];
            (s.line, s.x, s.y)
        }
        ThingKind::Start => {
            let s = view.start.unwrap();
            (s.line, s.x, Some(s.y))
        }
    };
    let line = line.unwrap();
    ThingRef {
        kind,
        index: index as u32,
        line,
        expect: text.split('\n').nth(line as usize - 1).unwrap().to_string(),
        x,
        y,
    }
}

fn mv(
    text: &str,
    kind: ThingKind,
    index: usize,
    x: f64,
    y: Option<f64>,
) -> Result<ThingOutcome, DocumentError> {
    apply_thing_edit(
        text,
        &LevelEdit::MoveThing {
            thing: thing(text, kind, index),
            x,
            y,
        },
    )
}

fn face(text: &str, index: usize, facing: Facing) -> Result<ThingOutcome, DocumentError> {
    apply_thing_edit(
        text,
        &LevelEdit::FaceThing {
            thing: thing(text, ThingKind::Spawn, index),
            facing,
        },
    )
}

fn delete(text: &str, kind: ThingKind, index: usize) -> Result<ThingOutcome, DocumentError> {
    apply_thing_edit(
        text,
        &LevelEdit::DeleteThing {
            thing: thing(text, kind, index),
        },
    )
}

/// The lines of `after` that are not in `before`, and the ones that are gone, in order.
fn changed(before: &str, after: &str) -> (Vec<String>, Vec<String>) {
    let (b, a): (Vec<&str>, Vec<&str>) =
        (before.split('\n').collect(), after.split('\n').collect());
    let prefix = b.iter().zip(&a).take_while(|(x, y)| x == y).count();
    let suffix = b[prefix..]
        .iter()
        .rev()
        .zip(a[prefix..].iter().rev())
        .take_while(|(x, y)| x == y)
        .count();
    let strings = |s: &[&str]| s.iter().map(|l| l.to_string()).collect();
    (
        strings(&b[prefix..b.len() - suffix]),
        strings(&a[prefix..a.len() - suffix]),
    )
}

fn gone_and_new(before: &str, outcome: &ThingOutcome) -> (Vec<String>, Vec<String>) {
    changed(before, &outcome.text)
}

fn refused(result: Result<ThingOutcome, DocumentError>) -> String {
    match result {
        Err(DocumentError::Refused(message)) => message,
        other => panic!("expected a refusal, got {other:?}"),
    }
}

#[test]
fn an_item_moves_by_changing_one_number_and_keeps_its_alignment() {
    // items: 0..3 row cheezie, 4 soda
    let outcome = mv(BASE, ThingKind::Item, 4, 37.0, Some(5.0)).unwrap();
    let (old, new) = gone_and_new(BASE, &outcome);
    assert_eq!(old, ["  soda        x=36 y=5"]);
    assert_eq!(new, ["  soda        x=37 y=5"]);
    assert_eq!(outcome.name, "Move soda to 37, 5");
}

#[test]
fn an_item_in_a_list_changes_only_its_own_number() {
    // The list `cheezie x=10,26,40 y=6` holds items 8, 9, 10 (4 + 1 + 3 = after the choc row).
    let first = 4 + 1 + 3;
    let outcome = mv(BASE, ThingKind::Item, first + 1, 27.0, Some(6.0)).unwrap();
    let (old, new) = gone_and_new(BASE, &outcome);
    assert_eq!(old, ["  cheezie x=10,26,40 y=6"]);
    assert_eq!(new, ["  cheezie x=10,27,40 y=6"]);
}

#[test]
fn an_item_in_a_list_that_changes_y_splits_the_line_in_order() {
    let first = 4 + 1 + 3;
    let outcome = mv(BASE, ThingKind::Item, first + 1, 26.0, Some(9.0)).unwrap();
    let (old, new) = gone_and_new(BASE, &outcome);
    assert_eq!(old, ["  cheezie x=10,26,40 y=6"]);
    assert_eq!(
        new,
        [
            "  cheezie x=10 y=6",
            "  cheezie x=26 y=9",
            "  cheezie x=40 y=6"
        ]
    );
    assert_eq!(outcome.name, "Move cheezie to 26, 9 (split line 16)");
}

#[test]
fn a_row_member_moved_along_the_row_keeps_the_members_order_in_one_list() {
    // row choc x=46..52 y=8 by=3 holds items 5, 6, 7: 52 moves to 55, which is not on the step.
    let outcome = mv(BASE, ThingKind::Item, 7, 55.0, Some(8.0)).unwrap();
    let (_, new) = gone_and_new(BASE, &outcome);
    assert_eq!(new, ["  choc x=46,49,55 y=8"]);
}

#[test]
fn a_one_cell_row_moves_by_its_numbers() {
    let text = BASE.replace(
        "row cheezie x=17..20 y=7  // four",
        "row cheezie x=17 y=7  // one",
    );
    let outcome = mv(&text, ThingKind::Item, 0, 18.0, Some(8.0)).unwrap();
    let (_, new) = gone_and_new(&text, &outcome);
    assert_eq!(new, ["  row cheezie x=18 y=8  // one"]);
}

#[test]
fn a_row_member_moved_off_the_step_becomes_one_list_and_keeps_the_comment() {
    // row cheezie x=17..20 y=7  // four: move 18 right to 25.
    let outcome = mv(BASE, ThingKind::Item, 1, 25.0, Some(7.0)).unwrap();
    let (_, new) = gone_and_new(BASE, &outcome);
    assert_eq!(new, ["  cheezie x=17,25,19..20 y=7  // four"]);
}

#[test]
fn a_row_member_moved_up_splits_the_row_in_order_and_the_comment_stays_on_the_first_line() {
    let outcome = mv(BASE, ThingKind::Item, 1, 18.0, Some(9.0)).unwrap();
    let (_, new) = gone_and_new(BASE, &outcome);
    assert_eq!(
        new,
        [
            "  cheezie x=17 y=7  // four",
            "  cheezie x=18 y=9",
            "  row cheezie x=19..20 y=7"
        ]
    );
}

#[test]
fn deleting_the_middle_of_a_row_writes_one_list() {
    let outcome = delete(BASE, ThingKind::Item, 1).unwrap();
    let (_, new) = gone_and_new(BASE, &outcome);
    assert_eq!(new, ["  cheezie x=17,19..20 y=7  // four"]);
    assert_eq!(outcome.name, "Delete cheezie");
}

#[test]
fn deleting_the_end_of_a_row_shrinks_it() {
    let outcome = delete(BASE, ThingKind::Item, 3).unwrap();
    let (_, new) = gone_and_new(BASE, &outcome);
    assert_eq!(new, ["  row cheezie x=17..19 y=7  // four"]);
    // row choc x=46..52 by=3 minus 52 keeps the step.
    let outcome = delete(BASE, ThingKind::Item, 7).unwrap();
    let (_, new) = gone_and_new(BASE, &outcome);
    assert_eq!(new, ["  row choc    x=46..49 y=8 by=3"]);
}

#[test]
fn a_place_moves_in_place_along_one_axis_and_splits_by_columns_otherwise() {
    // place cheezie x=5..6 y=9..10 holds (5,9) (5,10) (6,9) (6,10): the last four items.
    let n = LevelDocument::new(BASE).view().items.len();
    let last_four = n - 4;
    // (5,10) to (5,12): only y changes in one column, but the x list has two columns: split.
    let outcome = mv(BASE, ThingKind::Item, last_four + 1, 5.0, Some(12.0)).unwrap();
    let (_, new) = gone_and_new(BASE, &outcome);
    assert_eq!(
        new,
        [
            "  place cheezie x=5 y=9",
            "  place cheezie x=5 y=12",
            "  place cheezie x=6 y=9..10"
        ]
    );
    // Deleting (6,9) leaves the first column whole and the second partial.
    let outcome = delete(BASE, ThingKind::Item, last_four + 2).unwrap();
    let (_, new) = gone_and_new(BASE, &outcome);
    assert_eq!(
        new,
        ["  place cheezie x=5 y=9..10", "  place cheezie x=6 y=10"]
    );
}

#[test]
fn a_spawn_in_a_list_moves_its_own_x_and_stays_on_the_ground() {
    let outcome = mv(BASE, ThingKind::Spawn, 1, 43.0, None).unwrap();
    let (old, new) = gone_and_new(BASE, &outcome);
    assert_eq!(old, ["  gloop  x=35,42,55  // three"]);
    assert_eq!(new, ["  gloop  x=35,43,55  // three"]);
}

#[test]
fn a_spawn_given_a_y_is_pinned_and_split_out_of_its_list() {
    let outcome = mv(BASE, ThingKind::Spawn, 1, 42.0, Some(6.0)).unwrap();
    let (_, new) = gone_and_new(BASE, &outcome);
    assert_eq!(
        new,
        [
            "  gloop  x=35  // three",
            "  gloop  x=42 y=6",
            "  gloop  x=55"
        ]
    );
    assert_eq!(outcome.name, "Move gloop to 42, 6 (split line 20)");
}

#[test]
fn a_fractional_spawn_keeps_its_fraction() {
    let outcome = mv(BASE, ThingKind::Spawn, 3, 31.5, Some(7.5)).unwrap();
    let (_, new) = gone_and_new(BASE, &outcome);
    assert_eq!(new, ["  drone  x=31.5 y=7.5"]);
}

#[test]
fn a_standing_spawn_put_back_on_the_ground_loses_its_y() {
    let pinned = mv(BASE, ThingKind::Spawn, 3, 30.5, None).unwrap();
    assert!(pinned.text.contains("  drone  x=30.5\n"), "{}", pinned.text);
}

#[test]
fn turning_a_ground_spawn_right_pins_it_and_names_the_ground() {
    let outcome = face(BASE, 1, Facing::Right).unwrap();
    let (_, new) = gone_and_new(BASE, &outcome);
    assert_eq!(
        new,
        [
            "  gloop  x=35  // three",
            "  gloop  x=42 y=3 dir=1",
            "  gloop  x=55"
        ]
    );
    assert_eq!(
        outcome.name,
        "Turn gloop to face right (pinned to y=3, split line 20)"
    );
}

#[test]
fn turning_left_with_no_dir_is_the_default_and_changes_nothing() {
    let outcome = face(BASE, 1, Facing::Left).unwrap();
    assert_eq!(outcome.text, BASE);
}

#[test]
fn turning_a_spawn_that_has_a_dir_rewrites_just_that_token() {
    // marsh x=25 y=4 dir=-1 is the sixth spawn: gloop x3, drone, hopper, marsh.
    let outcome = face(BASE, 5, Facing::Right).unwrap();
    let (_, new) = gone_and_new(BASE, &outcome);
    assert_eq!(new, ["  marsh  x=25 y=4 dir=1"]);
    assert_eq!(face(BASE, 5, Facing::Left).unwrap().text, BASE);
}

#[test]
fn a_rider_has_no_facing_and_cannot_stand_on_the_ground() {
    assert!(refused(face(BASE, 4, Facing::Right)).contains("no facing"));
    assert!(refused(mv(BASE, ThingKind::Spawn, 4, 20.0, None)).contains("needs a y"));
}

#[test]
fn the_start_moves_by_its_numbers_and_cannot_be_deleted_or_turned() {
    let outcome = mv(BASE, ThingKind::Start, 0, 5.0, Some(4.0)).unwrap();
    let (old, new) = gone_and_new(BASE, &outcome);
    assert_eq!(old, ["start 3,4"]);
    assert_eq!(new, ["start 5,4"]);
    assert_eq!(outcome.name, "Move start to 5, 4");
    assert!(refused(delete(BASE, ThingKind::Start, 0)).contains("needs a start"));
}

#[test]
fn deleting_a_whole_statement_removes_its_line_and_keeps_a_comment_as_its_own_line() {
    let outcome = delete(BASE, ThingKind::Item, 4).unwrap();
    let (old, new) = gone_and_new(BASE, &outcome);
    assert_eq!(old, ["  soda        x=36 y=5"]);
    assert!(new.is_empty());
    assert_eq!(outcome.name, "Delete soda");

    // gloop x=55 alone, with a comment: three are in the list, so make it one with a comment.
    let text = BASE.replace("gloop  x=35,42,55  // three", "gloop  x=35  // one");
    let outcome = delete(&text, ThingKind::Spawn, 0).unwrap();
    let (_, new) = changed(&text, &outcome.text);
    assert_eq!(new, ["  // one"]);
    assert_eq!(outcome.name, "Delete gloop (kept its comment)");
}

#[test]
fn a_generated_item_is_refused_with_its_line() {
    let n = LevelDocument::new(BASE).view().items.len();
    // The pogo-cache's three items come after the list and before the place's four.
    let generated = n - 4 - 3;
    let message = refused(delete(BASE, ThingKind::Item, generated));
    assert!(
        message.contains("pogo-cache") && message.contains("line 17"),
        "{message}"
    );
}

#[test]
fn a_move_out_of_the_level_is_refused_in_the_languages_words() {
    let message = refused(mv(BASE, ThingKind::Item, 4, 99.0, Some(5.0)));
    assert!(
        message.contains("59") || message.contains("outside"),
        "{message}"
    );
}

#[test]
fn items_sit_on_whole_cells() {
    assert!(refused(mv(BASE, ThingKind::Item, 4, 36.5, Some(5.0))).contains("whole"));
}

#[test]
fn a_move_to_the_same_place_changes_nothing() {
    let outcome = mv(BASE, ThingKind::Item, 4, 36.0, Some(5.0)).unwrap();
    assert_eq!(outcome.text, BASE);
}

#[test]
fn a_thing_whose_line_changed_is_gone_unless_it_can_be_found_again() {
    let mut stale = thing(BASE, ThingKind::Item, 4);
    stale.expect = "  soda        x=99 y=5".to_string();
    let edit = LevelEdit::DeleteThing { thing: stale };
    assert_eq!(
        apply_thing_edit(BASE, &edit),
        Err(DocumentError::Gone { line: 14 })
    );

    // Lines were added above it, so its index and line moved: it is found again by its text.
    let drifted = BASE.replace("treats\n", "treats\n  cheezie x=1 y=1\n  cheezie x=2 y=1\n");
    let stale = thing(BASE, ThingKind::Item, 4);
    let outcome = apply_thing_edit(&drifted, &LevelEdit::DeleteThing { thing: stale }).unwrap();
    assert!(!outcome.text.contains("soda"));
    assert!(outcome.text.contains("x=1 y=1"));
}

#[test]
fn a_crlf_script_keeps_its_line_endings_through_a_split() {
    let text = BASE.replace('\n', "\r\n");
    let outcome = face(&text, 1, Facing::Right).unwrap();
    assert!(outcome
        .text
        .contains("  gloop  x=35  // three\r\n  gloop  x=42 y=3 dir=1\r\n  gloop  x=55\r\n"));
    let (b, a): (Vec<&str>, Vec<&str>) = (
        text.split("\r\n").collect(),
        outcome.text.split("\r\n").collect(),
    );
    assert_eq!(a.len(), b.len() + 2);
}

#[test]
fn tabs_and_columns_survive_a_move() {
    let text = BASE.replace("  soda        x=36 y=5", "\tsoda\t\t\tx=36\ty=5");
    let outcome = mv(&text, ThingKind::Item, 4, 40.0, Some(6.0)).unwrap();
    let (_, new) = gone_and_new(&text, &outcome);
    assert_eq!(new, ["\tsoda\t\t\tx=40\ty=6"]);
}

#[test]
fn moving_a_split_spawn_back_to_the_ground_joins_its_line_again() {
    let text = BASE.replace("gloop  x=35,42,55  // three", "gloop  x=35,42,55");
    let up = mv(&text, ThingKind::Spawn, 1, 42.0, Some(6.0)).unwrap();
    assert!(up
        .text
        .contains("  gloop  x=35\n  gloop  x=42 y=6\n  gloop  x=55\n"));
    let back = mv(&up.text, ThingKind::Spawn, 1, 42.0, None).unwrap();
    assert_eq!(back.text, text, "the three lines are one again");
    assert_eq!(back.name, "Move gloop to 42, 3");
}

#[test]
fn moving_a_split_item_back_joins_its_list_again() {
    let first = 4 + 1 + 3;
    let up = mv(BASE, ThingKind::Item, first + 1, 26.0, Some(9.0)).unwrap();
    assert!(up
        .text
        .contains("  cheezie x=10 y=6\n  cheezie x=26 y=9\n  cheezie x=40 y=6\n"));
    let back = mv(&up.text, ThingKind::Item, first + 1, 26.0, Some(6.0)).unwrap();
    assert_eq!(back.text, BASE);
}

#[test]
fn a_comment_keeps_two_lines_apart() {
    // The first line carries a comment, so the middle joins only the line without one.
    let up = mv(BASE, ThingKind::Spawn, 1, 42.0, Some(6.0)).unwrap();
    let back = mv(&up.text, ThingKind::Spawn, 1, 42.0, None).unwrap();
    assert!(
        back.text
            .contains("  gloop  x=35  // three\n  gloop  x=42,55\n"),
        "{}",
        back.text
    );
    // ...and moving a thing whose neighbours were left apart by their author joins nothing.
    let apart = BASE.replace(
        "  gloop  x=35,42,55  // three",
        "  gloop  x=35\n  gloop  x=42\n  gloop  x=55",
    );
    let moved = mv(&apart, ThingKind::Spawn, 1, 43.0, None).unwrap();
    assert!(moved
        .text
        .contains("  gloop  x=35\n  gloop  x=43\n  gloop  x=55\n"));
}
