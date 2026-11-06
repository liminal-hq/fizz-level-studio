// The dock layout on the wire: workspaces of docked, floating and torn-off panels
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Every panel is in one of three places: docked in a zone (left, right or bottom), floating over
// the level, or in a window of its own. A zone holds tab groups of docked panels and has a size,
// a collapsed flag and nothing else; the caps that depend on the window are the frontend's. A
// workspace is one named arrangement of every panel, and the dock settings hold the named
// workspaces and which one is active. The rules (validation, the defaults, migration) live in the
// `fizz-studio-settings` crate; the TypeScript model in `apps/studio/src/panels/dock/` mirrors
// these shapes.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::settings::PanelPlacement;

/// A side of the editor where panels dock.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub enum ZoneId {
    Left,
    Right,
    Bottom,
}

/// Where a panel is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub enum PlaceKind {
    /// In a tab group of a zone.
    Docked,
    /// Over the level, at the entry's floating rectangle.
    Floating,
    /// In a window of its own, at the entry's window placement.
    Window,
}

/// Panels sharing one slot of a zone as tabs, one of them showing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct TabGroup {
    pub tabs: Vec<String>,
    /// The showing tab; one of `tabs`.
    pub active: String,
}

/// One side of the editor: a size, a collapsed flag and the groups docked there.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct Zone {
    /// Width for the left and right zones, height for the bottom zone, in pixels.
    pub size: i32,
    /// Folded to a rail showing each panel's icon and title.
    pub collapsed: bool,
    pub groups: Vec<TabGroup>,
}

/// The three zones.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct Zones {
    pub left: Zone,
    pub right: Zone,
    pub bottom: Zone,
}

impl Zones {
    pub fn get(&self, id: ZoneId) -> &Zone {
        match id {
            ZoneId::Left => &self.left,
            ZoneId::Right => &self.right,
            ZoneId::Bottom => &self.bottom,
        }
    }

    pub fn all(&self) -> [(ZoneId, &Zone); 3] {
        [
            (ZoneId::Left, &self.left),
            (ZoneId::Right, &self.right),
            (ZoneId::Bottom, &self.bottom),
        ]
    }
}

/// Where a torn-off window sits on the screen, in pixels. Coordinates may be negative on a
/// screen to the left of or above the main one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct WindowPlacement {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

/// Where a panel's window is, as the app reports it when the window opens, moves, resizes or
/// closes. The frontend writes it into the panel's `window` record in the active workspace.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct PanelPlaced {
    /// The window's label, such as `panel-script-1`.
    pub label: String,
    pub placement: WindowPlacement,
    /// Whether `placement.x` and `placement.y` are real. A platform that cannot say where a window
    /// is (Wayland) reports the size only, and the saved position is then left as it was.
    pub positioned: bool,
}

/// One panel in a workspace.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct PanelEntry {
    pub place: PlaceKind,
    /// The zone the panel was last docked in: where it goes when it docks back.
    pub home: ZoneId,
    /// Where it floats, kept while it is docked so it floats again where it was.
    pub float: PanelPlacement,
    /// Where its own window sits, kept after it comes back.
    pub window: Option<WindowPlacement>,
    /// What it was before it went to its own window (docked or floating): where it returns to.
    pub window_from: PlaceKind,
}

/// Where the floating tool picker sits over the level: its top-left corner, in pixels from the
/// top-left of the map. The frontend keeps it inside the map as the window and the docks change.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct ToolPickerPlacement {
    pub x: i32,
    pub y: i32,
}

/// One named arrangement of every panel.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct Workspace {
    /// Every panel, by id (`palette`, `script`, ...).
    pub panels: BTreeMap<String, PanelEntry>,
    pub zones: Zones,
    /// Where the tool picker was moved to; `None` puts it at the map's top-left corner.
    #[serde(default)]
    pub tool_picker: Option<ToolPickerPlacement>,
}

/// The named workspaces and the one in use. With no workspaces saved the settings crate's
/// defaults apply (`resolve_dock`), the same way an unsaved window kind takes the default
/// floating layout.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(default)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct DockSettings {
    /// The name of the active workspace; one of `workspaces`.
    pub active: String,
    pub workspaces: BTreeMap<String, Workspace>,
}
