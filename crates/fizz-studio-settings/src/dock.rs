// The default dock: the fixed arrangement and the Paint, Script and Review workspaces
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The default arrangement puts every panel in exactly one place: Palette and Layers docked left; Inspector, Objects
// and History as tabs on the right; Script and Proposals as tabs at the bottom. Each workspace varies
// it. `packages/protocol/fixtures/default-dock.json` holds the same data for the frontend, and
// the tests here check these against it, so the two cannot drift apart.

use std::collections::BTreeMap;

use fizz_studio_protocol::{
    DockSettings, PanelEntry, PlaceKind, Settings, TabGroup, WindowPlacement, Workspace, Zone,
    ZoneId, Zones,
};

use crate::layout::{default_layout, MAIN_KIND};

/// Every panel the editor has, in the order the Panels menu lists them (defined beside the window
/// labels, which a panel window may carry only for these).
pub use fizz_studio_protocol::PANEL_IDS;

/// The smallest a left or right zone, and the bottom zone, may be, in pixels.
pub const SIDE_MIN: i32 = 160;
pub const BOTTOM_MIN: i32 = 96;

/// The largest a zone may be whatever the window; the window's own 30% cap is the frontend's.
pub const ZONE_MAX: i32 = 4_000;

/// The largest size or coordinate a panel's rectangle may have.
pub const MAX_EXTENT: i32 = 20_000;

/// The workspace that is active until the person chooses another.
pub const DEFAULT_ACTIVE: &str = "Paint";

pub fn zone_min(zone: ZoneId) -> i32 {
    match zone {
        ZoneId::Bottom => BOTTOM_MIN,
        _ => SIDE_MIN,
    }
}

type Groups<'a> = &'a [(&'a [&'a str], &'a str)];

fn zone(size: i32, collapsed: bool, groups: Groups) -> Zone {
    Zone {
        size,
        collapsed,
        groups: groups
            .iter()
            .map(|(tabs, active)| TabGroup {
                tabs: tabs.iter().map(|t| (*t).to_owned()).collect(),
                active: (*active).to_owned(),
            })
            .collect(),
    }
}

/// A workspace whose panels are all docked where `zones` puts them, each floating where the
/// default floating layout puts it.
fn workspace(zones: Zones) -> Workspace {
    let floats = default_layout(MAIN_KIND).panels;
    let mut panels = BTreeMap::new();
    for id in PANEL_IDS {
        let home = zones
            .all()
            .into_iter()
            .find(|(_, z)| z.groups.iter().any(|g| g.tabs.iter().any(|t| t == id)))
            .map(|(zone, _)| zone)
            .unwrap_or(ZoneId::Right);
        panels.insert(
            id.to_owned(),
            PanelEntry {
                place: PlaceKind::Docked,
                home,
                float: floats[id],
                window: None::<WindowPlacement>,
                window_from: PlaceKind::Docked,
                home_spot: None,
            },
        );
    }
    Workspace {
        panels,
        zones,
        tool_picker: None,
    }
}

fn base_zones() -> Zones {
    Zones {
        left: zone(196, false, &[(&["palette", "layers"], "palette")]),
        right: zone(
            264,
            false,
            &[(&["inspector", "objects", "history"], "inspector")],
        ),
        bottom: zone(180, false, &[(&["script", "proposals"], "script")]),
    }
}

/// The fixed default arrangement.
pub fn default_workspace() -> Workspace {
    workspace(base_zones())
}

/// The shipped arrangement of the workspace called `name`, or the fixed default for any other.
pub fn default_workspace_for(name: &str) -> Workspace {
    let base = base_zones();
    match name {
        // Every dock open, as in board H1 of the design canvas: the fixed default arrangement.
        "Paint" => workspace(base),
        // The script docked at the bottom and taller; the palette folds away.
        "Script" => workspace(Zones {
            left: Zone {
                collapsed: true,
                ..base.left.clone()
            },
            bottom: zone(260, false, &[(&["script", "proposals"], "script")]),
            ..base
        }),
        // Proposals docked on the right and wider, the script folded to a rail.
        "Review" => workspace(Zones {
            left: Zone {
                collapsed: true,
                ..base.left.clone()
            },
            right: zone(
                340,
                false,
                &[(
                    &["proposals", "inspector", "objects", "history"],
                    "proposals",
                )],
            ),
            bottom: zone(180, true, &[(&["script"], "script")]),
        }),
        _ => workspace(base),
    }
}

/// The workspaces a fresh settings document starts with.
pub fn default_dock() -> DockSettings {
    DockSettings {
        active: DEFAULT_ACTIVE.to_owned(),
        workspaces: ["Paint", "Script", "Review"]
            .into_iter()
            .map(|name| (name.to_owned(), default_workspace_for(name)))
            .collect(),
    }
}

/// The dock in force: the saved one, or the defaults when none is saved.
pub fn resolve_dock(settings: &Settings) -> DockSettings {
    if settings.dock.workspaces.is_empty() {
        default_dock()
    } else {
        settings.dock.clone()
    }
}

/// Adds to every saved workspace each panel it lacks, so a panel a newer build introduced (Layers)
/// loads into an older file without a settings version bump. The panel takes its default
/// rectangle and joins the default zone's group for it, or its home zone when the default does not
/// dock it there. A workspace that is otherwise unsound is left for validation to refuse.
pub fn fill_missing_panels(dock: &mut DockSettings) {
    for (name, workspace) in dock.workspaces.iter_mut() {
        let shipped = default_workspace_for(name);
        for id in PANEL_IDS {
            if workspace.panels.contains_key(id) {
                continue;
            }
            let Some(entry) = shipped.panels.get(id).cloned() else {
                continue;
            };
            let docked_already = workspace
                .zones
                .all()
                .into_iter()
                .any(|(_, z)| z.groups.iter().any(|g| g.tabs.iter().any(|t| t == id)));
            if entry.place == PlaceKind::Docked && !docked_already {
                let zone = match entry.home {
                    ZoneId::Left => &mut workspace.zones.left,
                    ZoneId::Right => &mut workspace.zones.right,
                    ZoneId::Bottom => &mut workspace.zones.bottom,
                };
                match zone.groups.first_mut() {
                    Some(group) => group.tabs.push(id.to_owned()),
                    None => zone.groups.push(TabGroup {
                        tabs: vec![id.to_owned()],
                        active: id.to_owned(),
                    }),
                }
            }
            workspace.panels.insert(id.to_owned(), entry);
        }
    }
}
