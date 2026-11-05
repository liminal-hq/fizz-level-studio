// Target profiles: the legend, limits, and capability states a target offers
//
// Pure Rust with no Tauri. Every word, letter, and limit the editor offers comes from a profile
// (R-TGT-01 to R-TGT-05), so a new target is data, not code. `ProfileSource` is the seam: the
// provisional profiles in `stub` stand in until the Fizz 2 content export (F2) generates them.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

pub mod stub;

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// A dialect a profile accepts on the `script` line.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DialectVersion {
    pub name: String,
    pub version: u32,
}

/// One letter of the `map` legend.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LegendEntry {
    pub letter: char,
    pub tile: String,
    pub id: u8,
    pub meaning: String,
}

/// The counts a level and its world must stay within.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Limits {
    pub rules: u32,
    pub states: u32,
    pub state_values: u32,
    pub strings: u32,
    pub string_bytes: u32,
    pub sprite_min: u32,
    pub sprite_max: u32,
}

/// Whether the game can run a feature, shown on the Capabilities card.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CapabilityState {
    /// The game runs it today.
    Built,
    /// The design accepts it and the studio will write it, but the game cannot run it yet.
    Accepted,
    /// The name is set aside and refused with a lint until the game defines it.
    Reserved,
}

/// A target profile.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    /// Why the profile is not generated from the game, when it is not.
    #[serde(default)]
    pub provisional: Option<String>,
    pub dialects: Vec<DialectVersion>,
    pub legend: Vec<LegendEntry>,
    pub limits: Limits,
    pub capabilities: BTreeMap<String, CapabilityState>,
}

impl Profile {
    /// The legend entry for a map letter.
    pub fn entry(&self, letter: char) -> Option<&LegendEntry> {
        self.legend.iter().find(|e| e.letter == letter)
    }

    /// Whether the profile accepts a dialect and version on the `script` line.
    pub fn accepts(&self, name: &str, version: u32) -> bool {
        self.dialects
            .iter()
            .any(|d| d.name == name && d.version == version)
    }
}

/// Where profiles come from.
pub trait ProfileSource {
    /// The ids of every profile, in a stable order.
    fn ids(&self) -> Vec<String>;
    /// A profile by id.
    fn profile(&self, id: &str) -> Option<&Profile>;
}
