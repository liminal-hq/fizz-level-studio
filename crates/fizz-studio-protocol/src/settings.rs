// Settings on the wire: the document, a patch, the change event and the refusals
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The rules that act on these (merging a patch, the recent-worlds list, migration and saving) live
// in the `fizz-studio-settings` crate; this file is only the shapes JavaScript and Rust share.

use std::collections::BTreeMap;
use std::fmt;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// How many worlds the recent list keeps.
pub const RECENT_WORLDS_CAP: usize = 12;

/// The language the interface starts in until a person chooses another.
pub const DEFAULT_LOCALE: &str = "en-CA";

/// The colour scheme: follow the system, or force one.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub enum ColourMode {
    #[default]
    System,
    Light,
    Dark,
}

/// The application settings. Every field has a default, so a file written by an older build (or
/// edited by hand down to a few lines) still loads.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(default)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct Settings {
    pub colour_mode: ColourMode,
    /// Bigger hit targets and text for the controls.
    pub larger_controls: bool,
    /// The interface language as a BCP 47 tag.
    pub locale: String,
    /// Paths of the worlds last opened, most recent first, no duplicates, at most
    /// [`RECENT_WORLDS_CAP`].
    pub recent_worlds: Vec<String>,
    /// Panel layouts by window label. The value is a JSON document the layout code owns; settings
    /// keep it as an opaque string.
    pub layout: BTreeMap<String, String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            colour_mode: ColourMode::System,
            larger_controls: false,
            locale: DEFAULT_LOCALE.to_owned(),
            recent_worlds: Vec::new(),
            layout: BTreeMap::new(),
        }
    }
}

/// A change to the settings: only the fields that change. A layout entry set to `null` is removed.
/// The recent list changes through its own commands, never through a patch.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(default)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct SettingsPatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub colour_mode: Option<ColourMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub larger_controls: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub locale: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub layout: Option<BTreeMap<String, Option<String>>>,
}

/// The settings in force and the revision they are at. It is both the answer to a read and the
/// payload of the change event. The revision starts at 0 for what was loaded and grows by one with
/// every change, so a window keeps the highest revision it has seen and ignores lower ones.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct SettingsSnapshot {
    #[ts(type = "number")]
    pub revision: u64,
    pub settings: Settings,
}

/// What a refused command carries. Nothing changed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "kebab-case")]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub enum SettingsError {
    /// The update was based on an older revision than the one in force; read again and retry.
    Stale {
        #[ts(type = "number")]
        based_on: u64,
        #[ts(type = "number")]
        current: u64,
    },
    /// A value is not acceptable, such as an empty locale or a layout that is not JSON.
    Invalid { message: String },
    /// The settings could not be saved.
    Storage { message: String },
}

impl fmt::Display for SettingsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SettingsError::Stale { based_on, current } => write!(
                f,
                "the settings changed since revision {based_on} (now at {current}); read them again and retry"
            ),
            SettingsError::Invalid { message } => write!(f, "invalid settings: {message}"),
            SettingsError::Storage { message } => {
                write!(f, "could not save the settings: {message}")
            }
        }
    }
}

impl std::error::Error for SettingsError {}
