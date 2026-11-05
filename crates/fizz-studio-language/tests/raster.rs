// Holds the Rust level rasteriser to the golden worlds the TypeScript rasteriser produced.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::fs;
use std::path::{Path, PathBuf};

use fizz_studio_language::parser::parse;
use fizz_studio_language::raster::{rasterise, World};
use serde_json::Value;

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .expect("the repository root exists")
}

fn grid(value: &Value, w: usize, h: usize) -> Vec<u64> {
    let rows = value.as_array().expect("rows");
    assert_eq!(rows.len(), h, "row count");
    rows.iter()
        .flat_map(|row| {
            let row = row.as_array().expect("a row");
            assert_eq!(row.len(), w, "row width");
            row.iter().map(|n| n.as_u64().expect("a whole number"))
        })
        .collect()
}

fn compare(id: &str, world: &World, golden: &Value) -> Vec<String> {
    let mut problems = Vec::new();
    let mut check = |what: &str, same: bool| {
        if !same {
            problems.push(format!("{id}: {what} differs"));
        }
    };
    check("w", golden["w"] == world.w);
    check("h", golden["h"] == world.h);
    check("name", golden["name"] == world.name.as_str());
    check("id", golden["id"] == world.id.as_str());
    check(
        "theme",
        golden["theme"] == serde_json::to_value(&world.theme).unwrap(),
    );
    check(
        "area",
        golden["area"] == serde_json::to_value(&world.area).unwrap(),
    );
    check("ground", golden["ground"].as_f64() == Some(world.ground));
    check("switches", golden["switches"] == world.switches);
    check(
        "start",
        golden["start"] == serde_json::to_value(world.start).unwrap(),
    );
    check(
        "items",
        golden["items"] == serde_json::to_value(&world.items).unwrap(),
    );
    check(
        "spawns",
        golden["spawns"] == serde_json::to_value(&world.spawns).unwrap(),
    );
    check(
        "hovers",
        golden["hovers"] == serde_json::to_value(&world.hovers).unwrap(),
    );

    let h_at: Vec<f64> = golden["hAt"]
        .as_array()
        .expect("hAt")
        .iter()
        .map(|n| n.as_f64().expect("a number"))
        .collect();
    check("hAt", h_at == world.h_at);

    let palette = golden["palette"].as_object().expect("palette");
    let tiles: Vec<u64> = world
        .tiles
        .iter()
        .map(|t| palette[t.as_str()].as_u64().expect("a tile id"))
        .collect();
    check("tiles", tiles == grid(&golden["tiles"], world.w, world.h));
    let liquid: Vec<u64> = world.liquid.iter().map(|l| u64::from(*l)).collect();
    check(
        "liquid",
        liquid == grid(&golden["liquid"], world.w, world.h),
    );
    problems
}

#[test]
fn every_level_rasterises_as_the_reference_does() {
    let root = repo_root();
    let dir = root.join("fixtures/fizz1/raster");
    let mut goldens: Vec<PathBuf> = fs::read_dir(&dir)
        .expect("the raster fixtures exist")
        .map(|e| e.expect("entry").path())
        .collect();
    goldens.sort();
    assert!(goldens.len() >= 18, "found only {} worlds", goldens.len());

    let mut problems = Vec::new();
    for path in &goldens {
        let golden: Value = serde_json::from_str(&fs::read_to_string(path).expect("readable"))
            .expect("golden JSON parses");
        let from = golden["from"].as_str().expect("from");
        let source = fs::read_to_string(root.join(from)).expect("the level exists");
        let world = rasterise(&parse(&source).ast).expect("a level header");
        problems.extend(compare(from, &world, &golden));
    }
    assert!(problems.is_empty(), "{}", problems.join("\n"));
}

#[test]
fn a_script_without_a_header_has_no_world() {
    assert!(rasterise(&parse("start 3,4\n").ast).is_none());
}
