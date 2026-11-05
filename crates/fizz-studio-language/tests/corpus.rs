// Holds the Rust parser and printer to the Fizz 1 conformance corpus the TypeScript package produced.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::fs;
use std::path::{Path, PathBuf};

use fizz_studio_language::ast::Range;
use fizz_studio_language::edits::{append_edits, Edit};
use fizz_studio_language::messages::{fix, message};
use fizz_studio_language::parser::parse;
use fizz_studio_language::printer::print;
use serde_json::{json, Value};

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .expect("the repository root exists")
}

fn files_with_extension(dir: &Path, extension: &str, found: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    let mut entries: Vec<_> = entries.map(|e| e.expect("readable entry").path()).collect();
    entries.sort();
    for path in entries {
        if path.is_dir() {
            files_with_extension(&path, extension, found);
        } else if path.extension().is_some_and(|e| e == extension) {
            found.push(path);
        }
    }
}

fn read(path: &Path) -> String {
    String::from_utf8(fs::read(path).expect("readable file")).expect("UTF-8 file")
}

#[test]
fn every_fixture_matches_the_reference() {
    let root = repo_root().join("fixtures/fizz1");
    let mut inputs = Vec::new();
    files_with_extension(&root, "fizz", &mut inputs);
    assert!(inputs.len() > 100, "found only {} fixtures", inputs.len());

    let mut failures = Vec::new();
    for input in &inputs {
        let id = input
            .strip_prefix(&root)
            .expect("under the corpus")
            .with_extension("")
            .display()
            .to_string();
        let source = read(input);
        let printed = read(&input.with_extension("print"));
        let recorded: Value = serde_json::from_str(&read(&input.with_extension("json")))
            .expect("fixture JSON parses");

        let result = parse(&source);

        if print(&result.ast) != printed {
            failures.push(format!("{id}: printed output differs"));
        }

        let errors: Vec<Value> = result
            .errors
            .iter()
            .map(|d| {
                json!({
                    "line": d.line,
                    "code": d.code,
                    "message": message(d),
                    "fix": fix(d),
                })
            })
            .collect();
        if Value::Array(errors.clone()) != recorded["errors"] {
            failures.push(format!(
                "{id}: errors differ\n  rust: {}\n  want: {}",
                Value::Array(errors),
                recorded["errors"]
            ));
        }

        let ast = serde_json::to_value(&result.ast).expect("the AST serialises");
        if ast != recorded["ast"] {
            let first = ast["nodes"]
                .as_array()
                .zip(recorded["ast"]["nodes"].as_array())
                .and_then(|(got, want)| got.iter().zip(want).find(|(g, w)| g != w));
            failures.push(format!("{id}: AST differs\n  first mismatch: {first:?}"));
        }
    }
    assert!(
        failures.is_empty(),
        "{} of {} fixtures differ:\n{}",
        failures.len(),
        inputs.len(),
        failures.join("\n")
    );
}

#[test]
fn every_tracked_level_prints_back_byte_for_byte() {
    let root = repo_root();
    let mut levels = Vec::new();
    files_with_extension(&root.join("levels"), "fizz", &mut levels);
    levels.push(root.join("scratch/kitchen-sink.fizz"));
    assert!(levels.len() >= 18, "found only {} levels", levels.len());
    for path in levels {
        let source = read(&path);
        let result = parse(&source);
        assert!(
            result.errors.is_empty(),
            "{}: {:?}",
            path.display(),
            result.errors
        );
        assert_eq!(
            print(&result.ast),
            source,
            "{} does not round-trip",
            path.display()
        );
    }
}

fn ranges(value: &Value) -> Vec<Range> {
    value
        .as_array()
        .expect("a list of ranges")
        .iter()
        .map(|r| Range {
            lo: r["lo"].as_f64().expect("lo"),
            hi: r["hi"].as_f64().expect("hi"),
        })
        .collect()
}

fn edit_from(value: &Value) -> Edit {
    let xs = ranges(&value["xs"]);
    let ys = ranges(&value["ys"]);
    let text = |key: &str| value[key].as_str().expect(key).to_string();
    match value["op"].as_str().expect("op") {
        "paint" => Edit::Paint {
            tile: text("tile"),
            xs,
            ys,
        },
        "clear" => Edit::Clear { xs, ys },
        "place" => Edit::Place {
            kind: text("kind"),
            xs,
            ys,
        },
        other => panic!("unknown edit {other}"),
    }
}

#[test]
fn appended_edits_print_as_the_reference_does() {
    let root = repo_root().join("fixtures/fizz1/edits");
    let mut inputs = Vec::new();
    files_with_extension(&root, "fizz", &mut inputs);
    assert!(inputs.len() >= 10, "found only {} edit cases", inputs.len());
    for input in &inputs {
        let edits: Vec<Edit> =
            serde_json::from_str::<Vec<Value>>(&read(&input.with_extension("edits.json")))
                .expect("edits JSON parses")
                .iter()
                .map(edit_from)
                .collect();
        let want = read(&input.with_extension("after"));
        let ast = append_edits(&parse(&read(input)).ast, &edits);
        assert_eq!(print(&ast), want, "{}", input.display());

        // Every appended node carries the line it prints on, and the result parses back to itself.
        let lines: Vec<&str> = want.split('\n').collect();
        for node in &ast.nodes {
            if let Some(raw) = &node.raw {
                assert_eq!(lines[node.line - 1], raw, "{}", input.display());
            }
        }
    }
}
