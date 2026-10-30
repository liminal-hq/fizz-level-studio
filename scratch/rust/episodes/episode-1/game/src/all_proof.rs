// Proof that the scripts in levels/real rebuild every level of the game exactly.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use super::*;

include!("all_fizz.rs");

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
fn bonbon_playhouse_matches_the_game() {
    let real = bonbon_playhouse();
    let generated = bonbon_playhouse_fizz();
    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 100);
    assert_same(&real, &generated);
    println!("bonbon-playhouse: fingerprint {:#010x}, {} spawns, {} items, {} platforms, {} rooms", generated.fingerprint(), generated.spawns.len(), generated.items.len(), generated.plats.len(), generated.rooms.len());
}

#[test]
fn caves_matches_the_game() {
    let real = caves();
    let generated = caves_fizz();
    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 100);
    assert_same(&real, &generated);
    println!("caves: fingerprint {:#010x}, {} spawns, {} items, {} platforms, {} rooms", generated.fingerprint(), generated.spawns.len(), generated.items.len(), generated.plats.len(), generated.rooms.len());
}

#[test]
fn citadel_matches_the_game() {
    let real = citadel();
    let generated = citadel_fizz();
    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 100);
    assert_same(&real, &generated);
    println!("citadel: fingerprint {:#010x}, {} spawns, {} items, {} platforms, {} rooms", generated.fingerprint(), generated.spawns.len(), generated.items.len(), generated.plats.len(), generated.rooms.len());
}

#[test]
fn cocoa_foundry_matches_the_game() {
    let real = cocoa_foundry();
    let generated = cocoa_foundry_fizz();
    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 100);
    assert_same(&real, &generated);
    println!("cocoa-foundry: fingerprint {:#010x}, {} spawns, {} items, {} platforms, {} rooms", generated.fingerprint(), generated.spawns.len(), generated.items.len(), generated.plats.len(), generated.rooms.len());
}

#[test]
fn crater_matches_the_game() {
    let real = crater();
    let generated = crater_fizz();
    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 100);
    assert_same(&real, &generated);
    println!("crater: fingerprint {:#010x}, {} spawns, {} items, {} platforms, {} rooms", generated.fingerprint(), generated.spawns.len(), generated.items.len(), generated.plats.len(), generated.rooms.len());
}

#[test]
fn frosting_flats_matches_the_game() {
    let real = frosting_flats();
    let generated = frosting_flats_fizz();
    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 100);
    assert_same(&real, &generated);
    println!("frosting-flats: fingerprint {:#010x}, {} spawns, {} items, {} platforms, {} rooms", generated.fingerprint(), generated.spawns.len(), generated.items.len(), generated.plats.len(), generated.rooms.len());
}

#[test]
fn frosting_spire_matches_the_game() {
    let real = frosting_spire();
    let generated = frosting_spire_fizz();
    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 100);
    assert_same(&real, &generated);
    println!("frosting-spire: fingerprint {:#010x}, {} spawns, {} items, {} platforms, {} rooms", generated.fingerprint(), generated.spawns.len(), generated.items.len(), generated.plats.len(), generated.rooms.len());
}

#[test]
fn fudge_bog_matches_the_game() {
    let real = fudge_bog();
    let generated = fudge_bog_fizz();
    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 100);
    assert_same(&real, &generated);
    println!("fudge-bog: fingerprint {:#010x}, {} spawns, {} items, {} platforms, {} rooms", generated.fingerprint(), generated.spawns.len(), generated.items.len(), generated.plats.len(), generated.rooms.len());
}

#[test]
fn gumdrop_isle_matches_the_game() {
    let real = gumdrop_isle();
    let generated = gumdrop_isle_fizz();
    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 100);
    assert_same(&real, &generated);
    println!("gumdrop-isle: fingerprint {:#010x}, {} spawns, {} items, {} platforms, {} rooms", generated.fingerprint(), generated.spawns.len(), generated.items.len(), generated.plats.len(), generated.rooms.len());
}

#[test]
fn marshmallow_meadows_matches_the_game() {
    let real = marshmallow_meadows();
    let generated = marshmallow_meadows_fizz();
    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 100);
    assert_same(&real, &generated);
    println!("marshmallow-meadows: fingerprint {:#010x}, {} spawns, {} items, {} platforms, {} rooms", generated.fingerprint(), generated.spawns.len(), generated.items.len(), generated.plats.len(), generated.rooms.len());
}

#[test]
fn meteor_mesa_matches_the_game() {
    let real = meteor_mesa();
    let generated = meteor_mesa_fizz();
    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 100);
    assert_same(&real, &generated);
    println!("meteor-mesa: fingerprint {:#010x}, {} spawns, {} items, {} platforms, {} rooms", generated.fingerprint(), generated.spawns.len(), generated.items.len(), generated.plats.len(), generated.rooms.len());
}

#[test]
fn mirror_shafts_matches_the_game() {
    let real = mirror_shafts();
    let generated = mirror_shafts_fizz();
    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 100);
    assert_same(&real, &generated);
    println!("mirror-shafts: fingerprint {:#010x}, {} spawns, {} items, {} platforms, {} rooms", generated.fingerprint(), generated.spawns.len(), generated.items.len(), generated.plats.len(), generated.rooms.len());
}

#[test]
fn saucer_matches_the_game() {
    let real = saucer();
    let generated = saucer_fizz();
    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 100);
    assert_same(&real, &generated);
    println!("saucer: fingerprint {:#010x}, {} spawns, {} items, {} platforms, {} rooms", generated.fingerprint(), generated.spawns.len(), generated.items.len(), generated.plats.len(), generated.rooms.len());
}

#[test]
fn sugar_glass_gallery_matches_the_game() {
    let real = sugar_glass_gallery();
    let generated = sugar_glass_gallery_fizz();
    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 100);
    assert_same(&real, &generated);
    println!("sugar-glass-gallery: fingerprint {:#010x}, {} spawns, {} items, {} platforms, {} rooms", generated.fingerprint(), generated.spawns.len(), generated.items.len(), generated.plats.len(), generated.rooms.len());
}

#[test]
fn whisper_hollow_matches_the_game() {
    let real = whisper_hollow();
    let generated = whisper_hollow_fizz();
    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 100);
    assert_same(&real, &generated);
    println!("whisper-hollow: fingerprint {:#010x}, {} spawns, {} items, {} platforms, {} rooms", generated.fingerprint(), generated.spawns.len(), generated.items.len(), generated.plats.len(), generated.rooms.len());
}

#[test]
fn zarg_lookout_matches_the_game() {
    let real = zarg_lookout();
    let generated = zarg_lookout_fizz();
    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 100);
    assert_same(&real, &generated);
    println!("zarg-lookout: fingerprint {:#010x}, {} spawns, {} items, {} platforms, {} rooms", generated.fingerprint(), generated.spawns.len(), generated.items.len(), generated.plats.len(), generated.rooms.len());
}
