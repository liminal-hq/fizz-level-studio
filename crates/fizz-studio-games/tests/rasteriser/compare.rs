// Compares a rasterised script with the level the game builds, reporting the first few mismatches
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_games::fizz1_episode_1::levels::LevelData;
use fizz_studio_games::fizz1_episode_1::tiles;
use fizz_studio_language::raster::World;
use fizz_studio_language::tables::{AREAS, ITEMS, KINDS, TILES};

/// How many mismatches of each sort are reported.
const SHOWN: usize = 5;

/// The game's tile id for a rust constant name in the studio's `TILES`, from `lf_episode_1::tiles`.
fn tile_id(rust: &str) -> u8 {
    match rust {
        "EMPTY" => tiles::EMPTY,
        "FILL" => tiles::FILL,
        "BLOCK" => tiles::BLOCK,
        "PLAT" => tiles::PLAT,
        "SPIKE" => tiles::SPIKE,
        "CHOC" => tiles::CHOC,
        "R45" => tiles::R45,
        "L45" => tiles::L45,
        "R22A" => tiles::R22A,
        "R22B" => tiles::R22B,
        "L22A" => tiles::L22A,
        "L22B" => tiles::L22B,
        "DOOR_R" => tiles::DOOR_R,
        "DOOR_B" => tiles::DOOR_B,
        "DOOR_G" => tiles::DOOR_G,
        "BRIDGE" => tiles::BRIDGE,
        "MURAL" => tiles::MURAL,
        "MURAL_PART" => tiles::MURAL_PART,
        "CRYS" => tiles::CRYS,
        "EXIT" => tiles::EXIT,
        "GRASS" => tiles::GRASS,
        "PATH" => tiles::PATH,
        "RIVER" => tiles::RIVER,
        "TREE" => tiles::TREE,
        "ROCK" => tiles::ROCK,
        "CONV_L" => tiles::CONV_L,
        "CONV_R" => tiles::CONV_R,
        "FURNACE" => tiles::FURNACE,
        "WALLBG" => tiles::WALLBG,
        "RUNG" => tiles::RUNG,
        "RUNG_TOP" => tiles::RUNG_TOP,
        "FACADE" => tiles::FACADE,
        "GATE" => tiles::GATE,
        "GATE_2" => tiles::GATE_2,
        "GATE_3" => tiles::GATE_3,
        "VINE" => tiles::VINE,
        "CRACKED" => tiles::CRACKED,
        "HOUSE_A" => tiles::HOUSE_A,
        "HOUSE_B" => tiles::HOUSE_B,
        "SHOP" => tiles::SHOP,
        "FOUNTAIN" => tiles::FOUNTAIN,
        other => panic!("the studio's tile table names `{other}`, which the game's tiles lack"),
    }
}

/// The tile word the rasteriser uses for a game tile id, or `id<n>` when the studio has no word.
fn tile_word(id: u8) -> String {
    TILES
        .iter()
        .find(|(_, rust)| tile_id(rust) == id)
        .map_or_else(|| format!("id{id}"), |(word, _)| (*word).to_string())
}

/// The index of an area word in the game's area constants (the order of the studio's `AREAS`).
pub fn area_index(area: &str) -> u8 {
    AREAS
        .iter()
        .position(|a| *a == area)
        .unwrap_or_else(|| panic!("unknown area {area}")) as u8
}

fn word_of(table: &[(&str, &str)], variant: &str) -> String {
    table
        .iter()
        .find(|(_, rust)| *rust == variant)
        .map_or_else(|| format!("?{variant}"), |(word, _)| (*word).to_string())
}

fn shown(problems: &mut Vec<String>, what: &str, mut found: Vec<String>) {
    let total = found.len();
    found.truncate(SHOWN);
    for line in found {
        problems.push(format!("{what}: {line}"));
    }
    if total > SHOWN {
        problems.push(format!("{what}: and {} more", total - SHOWN));
    }
}

/// Every difference between what the script rasterises to and what the game builds.
pub fn level(world: &World, game: &LevelData) -> Vec<String> {
    let mut problems = Vec::new();

    // The grid.
    if (world.w as i32, world.h as i32) != (game.map.w, game.map.h) {
        problems.push(format!(
            "size: game {}x{}, script {}x{}",
            game.map.w, game.map.h, world.w, world.h
        ));
        return problems;
    }
    if world.switches != game.map.switches {
        problems.push(format!(
            "switches: game {:#b}, script {:#b}",
            game.map.switches, world.switches
        ));
    }

    // Every tile.
    let mut tile_diffs = Vec::new();
    for (i, id) in game.map.data.iter().enumerate() {
        let want = if *id == tiles::EMPTY {
            "empty".to_string()
        } else {
            tile_word(*id)
        };
        let got = match world.tiles[i].as_str() {
            "" => "empty",
            word => word,
        };
        if want != got {
            tile_diffs.push(format!(
                "x={} y={}: game {want}, script {got}",
                i % world.w,
                i / world.w
            ));
        }
    }
    shown(&mut problems, "tiles", tile_diffs);

    // Items: the script names a cell, the game the cell's centre, in the same order.
    let mut item_diffs = Vec::new();
    if game.items.len() != world.items.len() {
        item_diffs.push(format!(
            "count: game {}, script {}",
            game.items.len(),
            world.items.len()
        ));
    }
    for (k, (g, s)) in game.items.iter().zip(&world.items).enumerate() {
        let kind = word_of(ITEMS, &format!("{:?}", g.kind));
        if kind != s.kind || g.x != s.x + 0.5 || g.y != s.y + 0.5 {
            item_diffs.push(format!(
                "#{k}: game {kind} at {},{}, script {} at {},{}",
                g.x,
                g.y,
                s.kind,
                s.x + 0.5,
                s.y + 0.5
            ));
        }
    }
    shown(&mut problems, "items", item_diffs);

    // Spawns: kind, position, facing and whether it rides platforms.
    let mut spawn_diffs = Vec::new();
    if game.spawns.len() != world.spawns.len() {
        spawn_diffs.push(format!(
            "count: game {}, script {}",
            game.spawns.len(),
            world.spawns.len()
        ));
    }
    for (k, (g, s)) in game.spawns.iter().zip(&world.spawns).enumerate() {
        let kind = word_of(KINDS, &format!("{:?}", g.kind));
        let dir_ok = s.dir.is_none_or(|d| d == g.dir);
        if kind != s.kind || g.x != s.x || Some(g.y) != s.y || g.ride != s.ride || !dir_ok {
            spawn_diffs.push(format!(
                "#{k}: game {kind} at {},{} dir {} ride {}, script {} at {:?},{:?} dir {:?} ride {}",
                g.x, g.y, g.dir, g.ride, s.kind, s.x, s.y, s.dir, s.ride
            ));
        }
    }
    shown(&mut problems, "spawns", spawn_diffs);

    // Ben's start.
    match world.start {
        Some(s) if s.x == game.start.0 && s.y == game.start.1 => {}
        other => problems.push(format!(
            "start: game {:?}, script {:?}",
            game.start,
            other.map(|s| (s.x, s.y))
        )),
    }
    problems
}
