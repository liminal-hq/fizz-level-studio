// Golden files for the structured edits: a script, the edit asked of it, and the script after
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Each case is three files in `tests/fixtures/structured/`: `NAME.fizz`, `NAME.op.json` (a
// `LevelEdit`), and `NAME.after` (the script the engine must write, or `NAME.refused` holding the
// reason it must give). They live here and not in `fixtures/fizz1/`, which the TypeScript
// generator owns. To write them again after a deliberate change: `BLESS_STRUCTURED=1 cargo test -p
// fizz-studio-level --test goldens`, then read the diff.

use std::fs;
use std::path::{Path, PathBuf};

use fizz_studio_level::{apply_thing_edit, LevelDocument};
use fizz_studio_protocol::{Facing, LevelEdit, ThingKind, ThingRef};
use fizz_studio_session::DocumentError;

const CRATER: &str = include_str!("../../../levels/crater.fizz");
const EDGE_CRLF: &str = include_str!("../../../fixtures/fizz1/edge/crlf.fizz");
const EDGE_QUOTES: &str =
    include_str!("../../../fixtures/fizz1/edge/comment-slashes-in-quotes.fizz");

fn dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/structured")
}

/// The reference the webview would draw for the thing on `line` that is `nth` on that line.
fn at(text: &str, kind: ThingKind, line: u32, nth: usize) -> ThingRef {
    let view = LevelDocument::new(text).view();
    let positions: Vec<(usize, f64, Option<f64>)> = match kind {
        ThingKind::Item => view
            .items
            .iter()
            .enumerate()
            .filter(|(_, i)| i.line == Some(line))
            .map(|(n, i)| (n, i.x, Some(i.y)))
            .collect(),
        ThingKind::Spawn => view
            .spawns
            .iter()
            .enumerate()
            .filter(|(_, s)| s.line == Some(line))
            .map(|(n, s)| (n, s.x, s.y))
            .collect(),
        ThingKind::Start => vec![(0, view.start.unwrap().x, Some(view.start.unwrap().y))],
    };
    let (index, x, y) = positions[nth];
    ThingRef {
        kind,
        index: index as u32,
        line,
        expect: text.split('\n').nth(line as usize - 1).unwrap().to_string(),
        x,
        y,
    }
}

/// The cases, written down so the files can be made again. Crater's lines: 28 soda, 29 a choc
/// row, 43 gloop x=35,62,85, 40 the pogo-cache, 45 drone, 17 `row cheezie x=17..20 y=7`.
fn cases() -> Vec<(&'static str, String, LevelEdit)> {
    let line_of = |text: &str, needle: &str| {
        text.split('\n').position(|l| l.contains(needle)).unwrap() as u32 + 1
    };
    let soda = line_of(CRATER, "soda        x=36");
    let gloop = line_of(CRATER, "gloop  x=35,62,85");
    let row = line_of(CRATER, "row cheezie x=17..20");
    let choc = line_of(CRATER, "row choc    x=46..52");
    let start = line_of(CRATER, "start 3,4");
    let pogo = line_of(CRATER, "pogo-cache");
    let drone = line_of(CRATER, "drone  x=88.5");
    vec![
        (
            "move-soda",
            CRATER.to_string(),
            LevelEdit::MoveThing {
                thing: at(CRATER, ThingKind::Item, soda, 0),
                x: 37.0,
                y: Some(5.0),
            },
        ),
        (
            "flip-middle-gloop",
            CRATER.to_string(),
            LevelEdit::FaceThing {
                thing: at(CRATER, ThingKind::Spawn, gloop, 1),
                facing: Facing::Right,
            },
        ),
        (
            "move-gloop-up",
            CRATER.to_string(),
            LevelEdit::MoveThing {
                thing: at(CRATER, ThingKind::Spawn, gloop, 1),
                x: 62.0,
                y: Some(9.0),
            },
        ),
        (
            "delete-cheezie-in-row",
            CRATER.to_string(),
            LevelEdit::DeleteThing {
                thing: at(CRATER, ThingKind::Item, row, 1),
            },
        ),
        (
            "delete-last-of-choc-row",
            CRATER.to_string(),
            LevelEdit::DeleteThing {
                thing: at(CRATER, ThingKind::Item, choc, 2),
            },
        ),
        (
            "move-start",
            CRATER.to_string(),
            LevelEdit::MoveThing {
                thing: at(CRATER, ThingKind::Start, start, 0),
                x: 5.0,
                y: Some(4.0),
            },
        ),
        (
            "move-fractional-drone",
            CRATER.to_string(),
            LevelEdit::MoveThing {
                thing: at(CRATER, ThingKind::Spawn, drone, 0),
                x: 89.5,
                y: Some(7.5),
            },
        ),
        (
            "refuse-pogo-item",
            CRATER.to_string(),
            LevelEdit::DeleteThing {
                thing: at(CRATER, ThingKind::Item, pogo, 0),
            },
        ),
        (
            "refuse-delete-start",
            CRATER.to_string(),
            LevelEdit::DeleteThing {
                thing: at(CRATER, ThingKind::Start, start, 0),
            },
        ),
    ]
    .into_iter()
    .chain(edge_cases())
    .collect()
}

/// Cases over the CRLF and quote edge fixtures, for whatever things they hold.
fn edge_cases() -> Vec<(&'static str, String, LevelEdit)> {
    let mut out = Vec::new();
    for (name, text) in [("crlf", EDGE_CRLF), ("quotes", EDGE_QUOTES)] {
        let view = LevelDocument::new(text).view();
        if let Some(start) = view.start {
            let line = start.line.unwrap();
            let label: &'static str = if name == "crlf" {
                "edge-crlf-move-start"
            } else {
                "edge-quotes-move-start"
            };
            out.push((
                label,
                text.to_string(),
                LevelEdit::MoveThing {
                    thing: at(text, ThingKind::Start, line, 0),
                    x: start.x + 1.0,
                    y: Some(start.y),
                },
            ));
        }
    }
    out
}

fn run(text: &str, edit: &LevelEdit) -> Result<String, String> {
    match apply_thing_edit(text, edit) {
        Ok(outcome) => Ok(outcome.text),
        Err(DocumentError::Refused(message)) => Err(message),
        Err(other) => Err(other.to_string()),
    }
}

#[test]
fn every_golden_matches() {
    let dir = dir();
    if std::env::var("BLESS_STRUCTURED").is_ok() {
        fs::create_dir_all(&dir).unwrap();
        for (name, text, edit) in cases() {
            fs::write(dir.join(format!("{name}.fizz")), &text).unwrap();
            fs::write(
                dir.join(format!("{name}.op.json")),
                serde_json::to_string_pretty(&edit).unwrap() + "\n",
            )
            .unwrap();
            let (_ok, _bad) = (
                fs::remove_file(dir.join(format!("{name}.after"))),
                fs::remove_file(dir.join(format!("{name}.refused"))),
            );
            match run(&text, &edit) {
                Ok(after) => fs::write(dir.join(format!("{name}.after")), after).unwrap(),
                Err(reason) => {
                    fs::write(dir.join(format!("{name}.refused")), reason + "\n").unwrap()
                }
            }
        }
    }
    let mut checked = 0;
    let mut names: Vec<String> = fs::read_dir(&dir)
        .unwrap()
        .filter_map(|e| {
            let name = e.unwrap().file_name().into_string().unwrap();
            name.strip_suffix(".op.json").map(str::to_string)
        })
        .collect();
    names.sort();
    for name in &names {
        let text = fs::read_to_string(dir.join(format!("{name}.fizz"))).unwrap();
        let edit: LevelEdit =
            serde_json::from_str(&fs::read_to_string(dir.join(format!("{name}.op.json"))).unwrap())
                .unwrap();
        let result = run(&text, &edit);
        match (
            fs::read_to_string(dir.join(format!("{name}.after"))),
            fs::read_to_string(dir.join(format!("{name}.refused"))),
        ) {
            (Ok(after), _) => assert_eq!(result, Ok(after), "{name}"),
            (_, Ok(reason)) => assert_eq!(result, Err(reason.trim_end().to_string()), "{name}"),
            _ => panic!("{name} has neither an .after nor a .refused file"),
        }
        checked += 1;
    }
    assert!(checked >= 9, "the goldens are there: {checked}");
}
