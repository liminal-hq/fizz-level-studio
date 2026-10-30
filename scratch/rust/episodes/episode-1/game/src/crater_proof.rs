// Proof that the Fizz exporter reproduces `crater()` exactly.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use super::*;

// The generated function, written by `packages/language/src/cli.ts export`.
include!("crater_fizz.rs");

fn assert_same(a: &LevelData, b: &LevelData) {
    assert_eq!(a.id, b.id, "id");
    assert_eq!(format!("{:?}", a.theme), format!("{:?}", b.theme), "theme");
    assert_eq!(a.area, b.area, "area");
    assert_eq!((a.map.w, a.map.h), (b.map.w, b.map.h), "map size");
    assert_eq!(a.map.switches, b.map.switches, "switches");
    assert_eq!(a.map.floor_solid, b.map.floor_solid, "floor_solid");
    if let Some(i) = (0..a.map.data.len()).find(|&i| a.map.data[i] != b.map.data[i]) {
        let w = a.map.w as usize;
        panic!(
            "tile map differs at x={} y={}: original {} generated {}",
            i % w,
            i / w,
            a.map.data[i],
            b.map.data[i]
        );
    }
    assert_eq!(format!("{:?}", a.spawns), format!("{:?}", b.spawns), "spawns");
    assert_eq!(format!("{:?}", a.items), format!("{:?}", b.items), "items");
    assert_eq!(format!("{:?}", a.plats), format!("{:?}", b.plats), "platforms");
    assert_eq!(a.start, b.start, "start");
    assert_eq!(format!("{:?}", a.arena), format!("{:?}", b.arena), "arena");
    assert_eq!(format!("{:?}", a.rooms), format!("{:?}", b.rooms), "rooms");
    assert_eq!(a.fingerprint(), b.fingerprint(), "fingerprint");
}

#[test]
fn generated_crater_matches_hand_written_crater() {
    let real = crater();
    let generated = crater_fizz();
    // Guard against a vacuous pass: the level is not empty.
    assert!(real.spawns.len() == 9 && real.items.len() > 40);
    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 1000);
    assert_same(&real, &generated);
    println!(
        "crater fingerprint {:#010x} == {:#010x}; {} tiles, {} spawns, {} items",
        real.fingerprint(),
        generated.fingerprint(),
        real.map.data.len(),
        real.spawns.len(),
        real.items.len()
    );
}

/// The comparison can fail: a level with one item moved must not match.
#[test]
fn comparison_detects_a_difference() {
    let real = crater();
    let mut other = crater_fizz();
    other.items[0].x += 1.0;
    assert_ne!(real.fingerprint(), other.fingerprint());
}

/// Writes the real `crater()` as JSON when `FIZZ_DUMP` names a file, so other tools can check themselves against the game's own data.
#[test]
fn dump_crater_truth() {
    let Ok(path) = std::env::var("FIZZ_DUMP") else { return };
    let l = crater();
    let items: Vec<String> = l.items.iter().map(|i| format!("[\"{:?}\",{},{}]", i.kind, i.x, i.y)).collect();
    let spawns: Vec<String> = l.spawns.iter().map(|s| format!("[\"{:?}\",{},{},{},{}]", s.kind, s.x, s.y, s.dir, s.ride)).collect();
    let plats: Vec<String> = l.plats.iter().map(|p| format!("{:?}", format!("{:?}", p))).collect();
    let data: Vec<String> = l.map.data.iter().map(|t| t.to_string()).collect();
    let json = format!(
        "{{\"w\":{},\"h\":{},\"start\":[{},{}],\"data\":[{}],\"items\":[{}],\"spawns\":[{}],\"plats\":[{}]}}",
        l.map.w, l.map.h, l.start.0, l.start.1, data.join(","), items.join(","), spawns.join(","), plats.join(",")
    );
    std::fs::write(path, json).unwrap();
}

/// Writes every level of the game as JSON into the directory `FIZZ_DUMP_ALL` names, one file per level id, so the language can be checked against all of them.
#[test]
fn dump_all_truth() {
    let Ok(dir) = std::env::var("FIZZ_DUMP_ALL") else { return };
    for def in LEVELS.iter() {
        let l = (def.build)();
        let items: Vec<String> = l.items.iter().map(|i| format!("[\"{:?}\",{},{}]", i.kind, i.x, i.y)).collect();
        let spawns: Vec<String> = l.spawns.iter().map(|s| format!("[\"{:?}\",{},{},{},{}]", s.kind, s.x, s.y, s.dir, s.ride)).collect();
        let plats: Vec<String> = l.plats.iter().map(|p| format!("[{},{},{},{},{},{},{},{},{}]", p.ax, p.ay, p.bx, p.by, p.speed, p.w, p.h, p.dwell, p.ph)).collect();
        let rooms: Vec<String> = l.rooms.iter().map(|r| format!("[{},{},{},{},{}]", r.x0, r.y0, r.x1, r.y1, r.secret)).collect();
        let arena = match l.arena { Some(a) => format!("[{},{},{}]", a.x0, a.x1, a.floor), None => "null".to_string() };
        let data: Vec<String> = l.map.data.iter().map(|t| t.to_string()).collect();
        let json = format!(
            "{{\"id\":{},\"theme\":\"{:?}\",\"area\":{},\"w\":{},\"h\":{},\"start\":[{},{}],\"switches\":{},\"floorSolid\":{},\"arena\":{},\"rooms\":[{}],\"data\":[{}],\"items\":[{}],\"spawns\":[{}],\"plats\":[{}]}}",
            l.id, l.theme, l.area, l.map.w, l.map.h, l.start.0, l.start.1, l.map.switches, l.map.floor_solid, arena, rooms.join(","), data.join(","), items.join(","), spawns.join(","), plats.join(",")
        );
        std::fs::write(format!("{}/{}.json", dir, l.id), json).unwrap();
    }
}

/// Writes the overworld as JSON into the file `FIZZ_DUMP_OW` names.
#[test]
fn dump_overworld_truth() {
    let Ok(path) = std::env::var("FIZZ_DUMP_OW") else { return };
    let d = build_overworld();
    let data: Vec<String> = d.map.data.iter().map(|t| t.to_string()).collect();
    let points: Vec<String> = d.points.iter().map(|p| format!("[\"{:?}\",{},{},{},{},{},{},{}]", p.kind, p.level, p.x, p.y, p.to, p.req, p.big, p.hidden)).collect();
    let areas: Vec<String> = d.areas.iter().map(|a| format!("[{},{},{},{},{}]", a.x0, a.y0, a.x1, a.y1, a.area)).collect();
    let json = format!("{{\"w\":{},\"h\":{},\"floorSolid\":{},\"start\":[{},{}],\"data\":[{}],\"points\":[{}],\"areas\":[{}]}}", d.map.w, d.map.h, d.map.floor_solid, d.start.0, d.start.1, data.join(","), points.join(","), areas.join(","));
    std::fs::write(path, json).unwrap();
}
