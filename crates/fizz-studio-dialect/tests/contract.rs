// The contract every Fizz 2 dialect must meet, run against the provisional dialect
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_dialect::stub::{parse_world, ProvisionalDialect};
use fizz_studio_dialect::{Fizz2Document, Fizz2Syntax, MapError};
use fizz_studio_profile::stub::ProvisionalProfiles;
use fizz_studio_profile::{Profile, ProfileSource};

const SLICE: &str = include_str!("../../../fixtures/fizz2/worlds/light/levels/light-1.fizz");
const WORLD: &str = include_str!("../../../fixtures/fizz2/worlds/light/world.fizz");

fn profile(id: &str) -> Profile {
    ProvisionalProfiles::new().profile(id).unwrap().clone()
}

/// What every `Fizz2Syntax` must do, whoever implements it.
fn contract<S: Fizz2Syntax>(syntax: &S, profile: &Profile) {
    // Printing gives back exactly what was read, whatever the text.
    for text in [
        SLICE,
        "",
        "script fizz2 0\n",
        "script fizz2 0\r\nmap\r\n",
        "no newline",
        "\n\n",
    ] {
        let parsed = syntax.parse(text, profile);
        assert_eq!(parsed.document.print(), text, "round trip of {text:?}");
    }

    // A rewrite changes only the row it touches and says what it changed.
    let mut parsed = syntax.parse(SLICE, profile);
    let before: Vec<String> = parsed
        .document
        .print()
        .split('\n')
        .map(str::to_owned)
        .collect();
    let patch = parsed
        .document
        .set_cell(2, 2, '=', profile)
        .expect("a cell inside the map");
    let after: Vec<String> = parsed
        .document
        .print()
        .split('\n')
        .map(str::to_owned)
        .collect();
    assert_eq!(before.len(), after.len());
    let changed: Vec<usize> = (0..before.len())
        .filter(|&i| before[i] != after[i])
        .collect();
    assert_eq!(
        changed,
        vec![patch.line - 1],
        "only the touched row changes"
    );
    assert_eq!(patch.old, before[patch.line - 1]);
    assert_eq!(patch.new, after[patch.line - 1]);
    let rows = parsed.document.map_rows();
    assert_eq!(rows[rows.len() - 1 - 2].chars().nth(2), Some('='));

    // A rewrite that cannot be made is refused, never a panic.
    let mut doc = parsed.document;
    assert_eq!(doc.set_cell(99, 0, '.', profile), Err(MapError::OutOfRange));
    assert_eq!(doc.set_cell(0, 99, '.', profile), Err(MapError::OutOfRange));
    assert_eq!(
        doc.set_cell(0, 0, '~', profile),
        Err(MapError::UnknownLetter('~'))
    );
    let mut empty = syntax.parse("script fizz2 0\n", profile).document;
    assert_eq!(empty.set_cell(0, 0, '.', profile), Err(MapError::NoMap));

    // Positions read as path:line:col.
    let bad = syntax.parse("script fizz2 7\n", profile);
    for d in &bad.diagnostics {
        let position = d.position("levels/a.fizz");
        assert!(position.starts_with("levels/a.fizz:"), "{position}");
        assert_eq!(position.split(':').count(), 3);
    }
}

#[test]
fn the_provisional_dialect_meets_the_contract() {
    contract(&ProvisionalDialect, &profile("ep2"));
}

#[test]
fn the_slice_reads_clean() {
    let parsed = ProvisionalDialect.parse(SLICE, &profile("ep2"));
    assert!(parsed.diagnostics.is_empty(), "{:?}", parsed.diagnostics);
    assert_eq!(parsed.document.dialect(), Some(("fizz2".to_owned(), 0)));
    assert_eq!(parsed.document.size(), Some((32, 48)));
    let rows = parsed.document.map_rows();
    assert_eq!(rows.len(), 48);
    assert!(rows.iter().all(|r| r.chars().count() == 32));
}

#[test]
fn an_unknown_dialect_version_is_e101_at_the_version() {
    let parsed = ProvisionalDialect.parse("script fizz2 7\n", &profile("ep2"));
    assert_eq!(parsed.diagnostics.len(), 1);
    let d = &parsed.diagnostics[0];
    assert_eq!((d.code, d.line, d.col), ("E101", 1, 14));
}

#[test]
fn a_wrong_width_and_an_unknown_letter_are_e103_and_e104() {
    let text = "script fizz2 0\nlevel \"T\" 3x2\nmap\n\t|..Q|\n\t|....|\n";
    let parsed = ProvisionalDialect.parse(text, &profile("ep2"));
    let codes: Vec<(&str, usize, usize)> = parsed
        .diagnostics
        .iter()
        .map(|d| (d.code, d.line, d.col))
        .collect();
    assert_eq!(codes, vec![("E104", 4, 5), ("E103", 5, 3)]);
}

#[test]
fn the_synthetic_profile_changes_the_palette_with_no_code_change() {
    let text = "script fizz2 0\nlevel \"S\" 3x2\nmap\n\t|_X_|\n\t|TTT|\n";
    let on_synthetic = ProvisionalDialect.parse(text, &profile("synthetic"));
    assert!(
        on_synthetic.diagnostics.is_empty(),
        "{:?}",
        on_synthetic.diagnostics
    );
    let on_ep2 = ProvisionalDialect.parse(text, &profile("ep2"));
    assert!(on_ep2.diagnostics.iter().any(|d| d.code == "E104"));
}

#[test]
fn the_world_file_lists_the_slice_level() {
    let world = parse_world(WORLD);
    assert_eq!(world.name.as_deref(), Some("Lighthouse Point"));
    assert_eq!(world.id.as_deref(), Some("light"));
    assert_eq!(world.pack.as_deref(), Some("LIGHT"));
    assert_eq!(world.target.as_deref(), Some("ep2"));
    assert_eq!(world.levels, vec!["levels/light-1.fizz"]);
}
