// The contract every profile source must meet, run against the provisional profiles
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_profile::stub::ProvisionalProfiles;
use fizz_studio_profile::{CapabilityState, ProfileSource};
use std::collections::HashSet;

/// What every `ProfileSource` must do, whoever implements it.
fn contract<P: ProfileSource>(source: &P) {
    let ids = source.ids();
    assert!(!ids.is_empty(), "a source lists at least one profile");
    for id in &ids {
        let profile = source.profile(id).expect("every listed id resolves");
        assert_eq!(&profile.id, id);
        assert!(source.profile("no-such-profile").is_none());

        let letters: HashSet<char> = profile.legend.iter().map(|e| e.letter).collect();
        assert_eq!(
            letters.len(),
            profile.legend.len(),
            "{id}: legend letters are unique"
        );
        let ids: HashSet<u8> = profile.legend.iter().map(|e| e.id).collect();
        assert_eq!(ids.len(), profile.legend.len(), "{id}: tile ids are unique");
        assert!(profile.limits.sprite_min <= profile.limits.sprite_max);
        assert!(
            !profile.dialects.is_empty(),
            "{id}: accepts at least one dialect"
        );
    }
}

#[test]
fn the_provisional_profiles_meet_the_contract() {
    contract(&ProvisionalProfiles::new());
}

#[test]
fn the_provisional_profile_never_claims_a_feature_is_built() {
    let profiles = ProvisionalProfiles::new();
    for id in profiles.ids() {
        let profile = profiles.profile(&id).unwrap();
        assert!(
            profile.provisional.is_some(),
            "{id} says why it is provisional"
        );
        for (name, state) in &profile.capabilities {
            assert_ne!(
                *state,
                CapabilityState::Built,
                "{id}: {name} must not be built"
            );
        }
    }
}

#[test]
fn the_slice_legend_matches_fizz_ep2_tile_ids() {
    let profiles = ProvisionalProfiles::new();
    let ep2 = profiles.profile("ep2").unwrap();
    let expected = [
        ('.', 0),
        ('#', 1),
        ('B', 2),
        ('=', 3),
        ('^', 4),
        ('D', 12),
        ('b', 13),
        ('E', 17),
        ('w', 30),
    ];
    for (letter, id) in expected {
        assert_eq!(ep2.entry(letter).map(|e| e.id), Some(id), "letter {letter}");
    }
    assert!(ep2.accepts("fizz2", 0));
    assert!(!ep2.accepts("fizz2", 7));
}

#[test]
fn the_synthetic_profile_differs_from_episode_two() {
    let profiles = ProvisionalProfiles::new();
    let synthetic = profiles.profile("synthetic").unwrap();
    let ep2 = profiles.profile("ep2").unwrap();
    assert!(synthetic.entry('X').is_some());
    assert!(ep2.entry('X').is_none());
    assert_ne!(synthetic.limits, ep2.limits);
}
