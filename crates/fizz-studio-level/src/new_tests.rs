// Tests for the new level templates, their validation, and R-WLD-02 (the target is fixed at creation)
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_dialect::stub::{parse_world, ProvisionalDialect};
use fizz_studio_dialect::Fizz2Syntax;
use fizz_studio_profile::stub::ProvisionalProfiles;
use fizz_studio_profile::ProfileSource;
use fizz_studio_protocol::{LevelEdit, LevelTarget, NewLevelRequest};
use fizz_studio_session::{Request, Session};

use crate::{
    default_ground, is_slug, new_level_text, new_world_text, open_level_text, pack_name, step_name,
    AnyLevelDocument,
};

fn request(target: LevelTarget) -> NewLevelRequest {
    NewLevelRequest {
        name: "Sugar Hill".to_string(),
        id: "sugar-hill".to_string(),
        width: 40,
        height: 24,
        ground: None,
        theme: None,
        target,
        folder: String::new(),
    }
}

/// The Fizz 1 language accepts only the game's own level ids, so the clean cases use one.
fn known(id: &str) -> NewLevelRequest {
    let def = fizz_studio_language::tables::level_def(id).expect("a game level id");
    let mut r = request(LevelTarget::Fizz1);
    r.id = id.to_string();
    r.theme = Some(def.theme.to_string());
    r
}

#[test]
fn a_fizz_1_level_parses_clean_and_has_no_script_line() {
    let text = new_level_text(&known("crater")).unwrap();
    assert!(text.starts_with("level \"Sugar Hill\" 40x24 ground=6 id=crater\n"));
    assert!(text.contains("theme crater\nstart 2,6\n"));
    assert!(!text.lines().any(|l| l.starts_with("script")));
    let parsed = fizz_studio_language::parser::parse(&text);
    assert!(parsed.errors.is_empty(), "{:?}", parsed.errors);
    let view = open_level_text(text).view();
    assert!(view.diagnostics.is_empty());
    assert_eq!((view.width, view.height), (40, 24));
}

#[test]
fn a_fizz_1_level_with_its_own_id_has_only_the_unknown_id_error() {
    let text = new_level_text(&request(LevelTarget::Fizz1)).unwrap();
    let parsed = fizz_studio_language::parser::parse(&text);
    let codes: Vec<&str> = parsed.errors.iter().map(|e| e.code).collect();
    assert_eq!(
        codes,
        vec!["E002"],
        "the language knows only the game's ids"
    );
}

#[test]
fn a_fizz_2_level_reads_with_no_diagnostics() {
    let text = new_level_text(&request(LevelTarget::Fizz2)).unwrap();
    assert!(text.starts_with(
        "script fizz2 0\nlevel \"Sugar Hill\" 40x24 id=sugar-hill\nstart 2,2\nfloor open\n\nmap\n"
    ));
    assert!(text.contains("\n\t|........................................|  23\n"));
    assert!(text.ends_with("  0\n"));
    let profiles = ProvisionalProfiles::new();
    let parsed = ProvisionalDialect.parse(&text, profiles.profile("ep2").unwrap());
    assert!(parsed.diagnostics.is_empty(), "{:?}", parsed.diagnostics);
    let view = open_level_text(text).view();
    assert_eq!((view.width, view.height), (40, 24));
    assert!(view.diagnostics.is_empty());
}

#[test]
fn every_theme_parses_clean() {
    for def in fizz_studio_language::tables::LEVEL_IDS {
        let text = new_level_text(&known(def.id)).unwrap();
        let parsed = fizz_studio_language::parser::parse(&text);
        assert!(parsed.errors.is_empty(), "{}: {:?}", def.id, parsed.errors);
    }
}

#[test]
fn the_ground_defaults_to_a_quarter_of_the_height_and_at_least_one() {
    assert_eq!(default_ground(28), 7);
    assert_eq!(default_ground(9), 2);
    assert_eq!(default_ground(2), 1);
}

#[test]
fn the_world_file_names_the_pack_and_the_level() {
    let text = new_world_text(&request(LevelTarget::Fizz2));
    assert_eq!(
        text,
        "script fizz2 0\nworld \"Sugar Hill\" id=sugar-hill pack=SUGARHIL target=ep2\nlevels   levels/sugar-hill.fizz\n"
    );
    let world = parse_world(&text);
    assert_eq!(world.pack.as_deref(), Some("SUGARHIL"));
    assert_eq!(world.levels, vec!["levels/sugar-hill.fizz"]);
    assert_eq!(pack_name("a-b-c"), "ABC");
}

#[test]
fn the_rules_refuse_what_they_should() {
    let bad = |edit: fn(&mut NewLevelRequest)| {
        let mut r = request(LevelTarget::Fizz1);
        edit(&mut r);
        new_level_text(&r).expect_err("refused")
    };
    assert!(bad(|r| r.name = "  ".into()).contains("name"));
    assert!(bad(|r| r.name = "Say \"hi\"".into()).contains("name"));
    assert!(bad(|r| r.name = "two\nlines".into()).contains("name"));
    assert!(bad(|r| r.id = "Sugar".into()).contains("id"));
    assert!(bad(|r| r.id = "a b".into()).contains("id"));
    assert!(bad(|r| r.id = String::new()).contains("id"));
    assert!(bad(|r| r.width = 7).contains("width"));
    assert!(bad(|r| r.width = 1025).contains("width"));
    assert!(bad(|r| r.height = 7).contains("height"));
    assert!(bad(|r| r.height = 129).contains("height"));
    assert!(bad(|r| r.theme = Some("lava".into())).contains("theme"));
    assert!(bad(|r| r.ground = Some(0)).contains("ground"));
    let mut edge = request(LevelTarget::Fizz1);
    (edge.width, edge.height) = (1024, 128);
    assert!(new_level_text(&edge).is_ok());
    assert!(is_slug("a-1") && !is_slug("-a") && !is_slug("a-"));
}

/// The first line, the `script` line, and the `level` header.
fn header(text: &str) -> (String, Option<String>, String) {
    let first = text.lines().next().unwrap().to_string();
    let script = text
        .lines()
        .find(|l| l.starts_with("script"))
        .map(str::to_string);
    let level = text
        .lines()
        .find(|l| l.starts_with("level "))
        .unwrap()
        .to_string();
    (first, script, level)
}

fn edits() -> Vec<LevelEdit> {
    let mut all = Vec::new();
    for n in 0..30u32 {
        all.push(LevelEdit::Paint {
            tile: if n % 2 == 0 { "grass" } else { "fill" }.to_string(),
            x: vec![[n % 8, n % 8 + 2]],
            y: vec![[n % 5, n % 5 + 1]],
        });
        all.push(LevelEdit::Clear {
            x: vec![[n % 6, n % 6]],
            y: vec![[n % 4, n % 4 + 1]],
        });
        all.push(LevelEdit::Place {
            item: "crystal".to_string(),
            x: vec![[n % 7, n % 7]],
            y: vec![[n % 3 + 1, n % 3 + 1]],
        });
    }
    all
}

/// Applies many edits, checking the header after each; returns the text before and after.
fn hammer(text: String) -> (String, String) {
    let before = text.clone();
    let mut session = Session::new(open_level_text(text));
    let token = session.claim_writer("test").unwrap();
    for edit in edits() {
        let request = Request::new(session.revision(), step_name(&edit), edit);
        // Some edits are refused (a Fizz 2 level places nothing yet); a refusal changes nothing.
        let _ = session.apply(&token, request);
        assert_eq!(header(session.text()), header(&before));
    }
    (before, session.text().to_string())
}

#[test]
fn no_edit_changes_a_fizz_1_levels_header_or_adds_a_script_line() {
    let (before, after) = hammer(new_level_text(&known("crater")).unwrap());
    assert_ne!(before, after, "some edits applied");
    assert!(header(&after).1.is_none());
    assert!(matches!(open_level_text(after), AnyLevelDocument::Fizz1(_)));
}

#[test]
fn no_edit_changes_a_fizz_2_levels_script_line_or_header() {
    let (before, after) = hammer(new_level_text(&request(LevelTarget::Fizz2)).unwrap());
    assert_ne!(before, after, "some edits applied");
    assert_eq!(header(&after).0, "script fizz2 0");
    assert!(matches!(open_level_text(after), AnyLevelDocument::Fizz2(_)));
}

#[test]
fn a_created_level_opens_as_its_own_target() {
    let one = open_level_text(new_level_text(&known("crater")).unwrap());
    let two = open_level_text(new_level_text(&request(LevelTarget::Fizz2)).unwrap());
    assert_eq!(one.target(), LevelTarget::Fizz1);
    assert_eq!(two.target(), LevelTarget::Fizz2);
}
