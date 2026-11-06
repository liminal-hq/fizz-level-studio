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

use crate::dock::DockSettings;

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

/// Where the accent colour comes from: the system, one of the studio's own, or a hex the person
/// typed.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "kebab-case")]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub enum AccentChoice {
    /// The system's accent, or the studio cyan when the system has none.
    #[default]
    System,
    /// The studio's cyan.
    Studio,
    AfterglowOrange,
    AfterglowPurple,
    /// A colour as lowercase `#rrggbb`.
    Custom {
        hex: String,
    },
}

/// Whether panels are drawn as frosted glass.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub enum GlassMode {
    /// Glass unless the system asks for reduced transparency.
    #[default]
    System,
    On,
    /// Solid panels.
    Off,
}

/// How strongly the desktop behind a see-through window is blurred, where the compositor can.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub enum WindowBlur {
    /// No blur: the desktop shows through as it is.
    Off,
    /// The quiet material (Mica on Windows, the compositor's blur on Linux).
    #[default]
    Low,
    /// The strong material (Acrylic on Windows; the same blur as Low on Linux).
    High,
}

/// The least and most of each transparency value, inclusive. The settings crate refuses anything
/// outside them, and the Transparency page's sliders use the same ends.
pub const GLASS_BLUR_MAX: u8 = 40;
pub const GLASS_SATURATION_MIN: u16 = 100;
pub const GLASS_SATURATION_MAX: u16 = 200;
pub const PANEL_OPACITY_MIN: u8 = 40;
pub const MENU_OPACITY_MIN: u8 = 60;
pub const OPACITY_MAX: u8 = 100;

/// How the glass inside the windows is drawn, which surfaces wear it, and whether the window
/// itself lets the desktop through. The `glass` mode stays the master switch: with it off, or the
/// system asking for less transparency under `system`, every surface is solid whatever this says.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(default)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct TransparencySettings {
    /// The blur behind a glass surface, in pixels (0 to [`GLASS_BLUR_MAX`]).
    pub blur: u8,
    /// How much the colours behind the glass are saturated, in percent
    /// ([`GLASS_SATURATION_MIN`] to [`GLASS_SATURATION_MAX`]).
    pub saturation: u16,
    /// How opaque a glass panel's fill is, in percent ([`PANEL_OPACITY_MIN`] to [`OPACITY_MAX`]).
    pub panel_opacity: u8,
    /// The docked panels, their rails and the peek flyout.
    pub docks: bool,
    /// The floating panels, the tool picker and the command palette.
    pub floating: bool,
    /// The menus: the application menu, the menu bar's menus and the context menus.
    pub menus: bool,
    /// The dialogs.
    pub dialogs: bool,
    /// The title bar and the menu bar under it.
    pub title_bar: bool,
    /// How opaque a glass menu is, in percent ([`MENU_OPACITY_MIN`] to [`OPACITY_MAX`]).
    pub menu_opacity: u8,
    /// Whether the window's own background lets the desktop through, where the system can.
    pub window_enabled: bool,
    /// The blur the compositor puts behind a see-through window, where it has one.
    pub window_blur: WindowBlur,
    /// A window that is not in front draws solid.
    pub solid_when_unfocused: bool,
}

impl Default for TransparencySettings {
    fn default() -> Self {
        Self {
            blur: 16,
            saturation: 120,
            panel_opacity: 88,
            docks: true,
            floating: true,
            menus: false,
            dialogs: false,
            title_bar: false,
            menu_opacity: 96,
            window_enabled: false,
            window_blur: WindowBlur::Low,
            solid_when_unfocused: true,
        }
    }
}

/// A settings field a refusal can name, so a form shows the message beside the right control.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub enum SettingsField {
    AccentHex,
    /// The name of a workspace, or the active workspace's name.
    WorkspaceName,
    /// A panel in a workspace that is unknown, missing or in more than one place.
    WorkspacePanel,
    /// A tab group that is empty or whose showing tab is not among its tabs.
    WorkspaceTabs,
    /// A zone size outside its range.
    ZoneSize,
    /// A floating rectangle or a window placement that is not on a real screen.
    WorkspaceRect,
    /// The glass blur outside its range.
    TransparencyBlur,
    /// The glass saturation outside its range.
    TransparencySaturation,
    /// The panel opacity outside its range.
    TransparencyPanelOpacity,
    /// The menu opacity outside its range.
    TransparencyMenuOpacity,
}

/// Where one floating panel sits in its window, in pixels from the top-left of the editor area.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct PanelPlacement {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    /// Shrunk to its header.
    pub collapsed: bool,
    /// Shown at all; a hidden panel keeps its place for when it returns.
    pub visible: bool,
    /// Stacking order: the highest is in front.
    pub z: u32,
}

/// The floating panels of one kind of window, by panel id (`palette`, `script`, ...).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(default)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct PanelLayout {
    pub panels: BTreeMap<String, PanelPlacement>,
}

/// What the window chrome shows. These are view choices of the windows, kept here so every window
/// and every restart agree on them.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(default)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct UiSettings {
    /// Whether Main windows show a permanent menu bar under the title bar, carrying the menus. Off
    /// (the default), the application menu in the title bar carries them and is the primary menu.
    pub menu_bar: bool,
}

/// The application settings. Every field has a default, so a file written by an older build (or
/// edited by hand down to a few lines) still loads.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(default)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct Settings {
    pub colour_mode: ColourMode,
    /// Where the accent colour comes from.
    pub accent: AccentChoice,
    /// Whether panels are glass or solid.
    pub glass: GlassMode,
    /// How the glass is drawn, where it is worn, and whether the window lets the desktop through.
    pub transparency: TransparencySettings,
    /// Bigger hit targets and text for the controls.
    pub larger_controls: bool,
    /// What the window chrome shows.
    pub ui: UiSettings,
    /// The interface language as a BCP 47 tag.
    pub locale: String,
    /// Paths of the worlds last opened, most recent first, no duplicates, at most
    /// [`RECENT_WORLDS_CAP`].
    pub recent_worlds: Vec<String>,
    /// Panel layouts by window kind (`main` for the editor window). A panel missing from a saved
    /// layout, or a kind with none, takes the defaults in the settings crate.
    pub layout: BTreeMap<String, PanelLayout>,
    /// The dock: named workspaces (Paint, Script, Review, and any the person adds) and which one
    /// is active. Every panel is in exactly one place in each workspace.
    pub dock: DockSettings,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            colour_mode: ColourMode::System,
            accent: AccentChoice::System,
            glass: GlassMode::System,
            transparency: TransparencySettings::default(),
            larger_controls: false,
            ui: UiSettings::default(),
            locale: DEFAULT_LOCALE.to_owned(),
            recent_worlds: Vec::new(),
            layout: BTreeMap::new(),
            dock: DockSettings::default(),
        }
    }
}

/// A change to the settings: only the fields that change. A layout entry set to `null` is removed, which restores that kind's defaults.
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
    pub accent: Option<AccentChoice>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub glass: Option<GlassMode>,
    /// Replaces the transparency settings as a whole.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub transparency: Option<TransparencySettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub larger_controls: Option<bool>,
    /// Replaces the chrome choices as a whole.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub ui: Option<UiSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub locale: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub layout: Option<BTreeMap<String, Option<PanelLayout>>>,
    /// Replaces the dock as a whole.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub dock: Option<DockSettings>,
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
    /// A value is not acceptable, such as an empty locale or a panel with no room.
    Invalid { message: String },
    /// A value is not acceptable and belongs to one field.
    InvalidField {
        field: SettingsField,
        message: String,
    },
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
            SettingsError::InvalidField { message, .. } => {
                write!(f, "invalid settings: {message}")
            }
            SettingsError::Storage { message } => {
                write!(f, "could not save the settings: {message}")
            }
        }
    }
}

impl std::error::Error for SettingsError {}
