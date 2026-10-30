// Compiles and runs the exporter's output for every statement type (a smoke test, not an equality proof).
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use super::*;

include!("kitchen_sink.rs");

#[test]
fn kitchen_sink_builds() {
    let l = kitchen_sink();
    assert_eq!(l.id, CAVES);
    assert!(l.arena.is_some() && l.plats.len() == 1 && l.rooms.len() == 2 && l.rooms[1].secret);
    assert_eq!(l.map.get(26, 9), PLAT);
    assert_eq!(l.map.get(12, 8), EMPTY);
    assert_eq!(l.items.last().map(|i| (i.x, i.y)), Some((30.5, 10.5)));
    assert!(l.spawns.iter().any(|s| s.ride) && l.spawns.iter().any(|s| s.dir > 0.0));
}
