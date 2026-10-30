// Proof that the overworld script rebuilds build_overworld() exactly.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use super::*;

include!("ow_builder.rs");
include!("ow_fizz.rs");

#[test]
fn the_overworld_script_matches_the_game() {
    let real = build_overworld();
    let made = overworld_fizz();
    assert!(real.map.data.iter().filter(|&&t| t == TREE).count() > 50, "the scatter is not vacuous");
    assert_eq!((real.map.w, real.map.h), (made.map.w, made.map.h), "size");
    assert_eq!(real.map.floor_solid, made.map.floor_solid, "floor_solid");
    if let Some(i) = (0..real.map.data.len()).find(|&i| real.map.data[i] != made.map.data[i]) {
        panic!("tile differs at x={} y={}: game {} script {}", i as i32 % real.map.w, i as i32 / real.map.w, real.map.data[i], made.map.data[i]);
    }
    assert_eq!(format!("{:?}", real.points), format!("{:?}", made.points), "points");
    assert_eq!(format!("{:?}", real.areas), format!("{:?}", made.areas), "areas");
    assert_eq!(real.start, made.start, "start");
    println!("overworld: {} tiles, {} points, {} trees, {} rocks", real.map.data.len(), made.points.len(), made.map.data.iter().filter(|&&t| t == TREE).count(), made.map.data.iter().filter(|&&t| t == ROCK).count());
}
