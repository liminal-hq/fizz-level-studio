// Holds the Rust level rasteriser to the game: each Episode 1 level script against `build_level`
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

#[path = "rasteriser/compare.rs"]
mod compare;

use std::fs;
use std::path::{Path, PathBuf};

use fizz_studio_games::fizz1_episode_1::levels;
use fizz_studio_language::parser::parse;
use fizz_studio_language::raster::rasterise;
use fizz_studio_language::tables::LEVEL_IDS;

fn levels_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../levels/real")
}

/// The game's level id for each rust constant name in the studio's `LEVEL_IDS`.
fn game_id(rust: &str) -> u8 {
    match rust {
        "CRATER" => levels::CRATER,
        "CAVES" => levels::CAVES,
        "CITADEL" => levels::CITADEL,
        "METEOR_MESA" => levels::METEOR_MESA,
        "ZARG_LOOKOUT" => levels::ZARG_LOOKOUT,
        "MARSHMALLOW_MEADOWS" => levels::MARSHMALLOW_MEADOWS,
        "BONBON_PLAYHOUSE" => levels::BONBON_PLAYHOUSE,
        "FUDGE_BOG" => levels::FUDGE_BOG,
        "MIRROR_SHAFTS" => levels::MIRROR_SHAFTS,
        "SUGAR_GLASS_GALLERY" => levels::SUGAR_GLASS_GALLERY,
        "FROSTING_FLATS" => levels::FROSTING_FLATS,
        "FROSTING_SPIRE" => levels::FROSTING_SPIRE,
        "COCOA_FOUNDRY" => levels::COCOA_FOUNDRY,
        "GUMDROP_ISLE" => levels::GUMDROP_ISLE,
        "WHISPER_HOLLOW" => levels::WHISPER_HOLLOW,
        "SAUCER" => levels::SAUCER,
        other => panic!("the studio names a level `{other}` the test does not know"),
    }
}

#[test]
fn the_studios_level_table_matches_the_games() {
    assert_eq!(LEVEL_IDS.len(), usize::from(levels::TABLE_LEN));
    for def in LEVEL_IDS {
        let id = game_id(def.rust);
        let game = levels::build_level(id);
        assert_eq!(game.id, id, "{}", def.id);
        assert_eq!(
            levels::LEVELS[usize::from(id)].area,
            compare::area_index(def.area),
            "{}: area",
            def.id
        );
    }
}

#[test]
fn every_episode_1_script_describes_the_level_the_game_builds() {
    let mut scripts: Vec<PathBuf> = fs::read_dir(levels_dir())
        .expect("levels/real exists")
        .map(|e| e.expect("readable entry").path())
        .filter(|p| p.extension().is_some_and(|e| e == "fizz"))
        .collect();
    scripts.sort();
    assert_eq!(
        scripts.len(),
        usize::from(levels::TABLE_LEN),
        "one script per level"
    );

    let mut failures = Vec::new();
    let mut seen = Vec::new();
    for path in &scripts {
        let source = fs::read_to_string(path).expect("UTF-8 script");
        let parsed = parse(&source);
        assert!(parsed.errors.is_empty(), "{}", path.display());
        let world = rasterise(&parsed.ast).expect("the script has a header");
        let def = LEVEL_IDS
            .iter()
            .find(|d| d.id == world.id)
            .unwrap_or_else(|| panic!("{}: unknown id `{}`", path.display(), world.id));
        let id = game_id(def.rust);
        seen.push(id);
        let game = levels::build_level(id);
        for problem in compare::level(&world, &game) {
            failures.push(format!("{} ({}): {problem}", def.id, path.display()));
        }
    }
    seen.sort_unstable();
    let all: Vec<u8> = (0..levels::TABLE_LEN).collect();
    assert_eq!(seen, all, "every game level has exactly one script");
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}
