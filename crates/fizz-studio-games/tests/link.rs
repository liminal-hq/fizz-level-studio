// The link check: both games build into the studio and agree with what the studio copies from them
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_games::{fizz1_episode_1, fizz2_ep2};

#[test]
fn fizz_1_builds_a_level_from_the_linked_crate() {
    let level = fizz1_episode_1::levels::build_level(0);
    assert_eq!(level.id, 0);
    assert!(!level.items.is_empty() || !level.spawns.is_empty());
    assert!(level.start.0 >= 0.0 && level.start.1 >= 0.0);
}

#[test]
fn every_fizz_1_level_builds() {
    for id in 0..fizz1_episode_1::levels::LEVEL_COUNT {
        let level = fizz1_episode_1::levels::build_level(id);
        assert_eq!(level.id, id, "level {id}");
    }
}

/// The Fizz 2 tile ids the provisional profile's legend copies, checked against the game's own.
#[test]
fn the_provisional_legend_matches_the_linked_fizz_2_tile_ids() {
    use fizz2_ep2::tiles;
    let expected = [
        (0, tiles::EMPTY),
        (1, tiles::FILL),
        (2, tiles::BLOCK),
        (3, tiles::PLAT),
        (4, tiles::SPIKE),
        (12, tiles::DOOR_R),
        (13, tiles::DOOR_B),
        (17, tiles::EXIT),
        (30, tiles::WALLBG),
    ];
    for (id, linked) in expected {
        assert_eq!(linked, id);
    }
}
