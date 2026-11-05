// Provisional profiles written by hand
//
// Stands in for F2 (the Fizz 2 content export) until the profile is generated from the game's own
// tables. Nothing here claims a feature is built: every capability is `accepted` or `reserved`.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use crate::{Profile, ProfileSource};

const EP2: &str = include_str!("../../../fixtures/profiles/ep2.provisional.json");
const SYNTHETIC: &str = include_str!("../../../fixtures/profiles/synthetic.json");

/// The provisional Episode 2 profile and the synthetic test profile.
pub struct ProvisionalProfiles {
    profiles: Vec<Profile>,
}

impl ProvisionalProfiles {
    pub fn new() -> Self {
        let parse = |text: &str| serde_json::from_str(text).expect("the fixture profile is valid");
        Self {
            profiles: vec![parse(EP2), parse(SYNTHETIC)],
        }
    }
}

impl Default for ProvisionalProfiles {
    fn default() -> Self {
        Self::new()
    }
}

impl ProfileSource for ProvisionalProfiles {
    fn ids(&self) -> Vec<String> {
        self.profiles.iter().map(|p| p.id.clone()).collect()
    }

    fn profile(&self, id: &str) -> Option<&Profile> {
        self.profiles.iter().find(|p| p.id == id)
    }
}
