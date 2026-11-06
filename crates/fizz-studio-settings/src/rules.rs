// The rules for changing settings: validation, patches and the recent-worlds list
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::collections::BTreeSet;

use fizz_studio_protocol::{
    AccentChoice, DockSettings, PanelPlacement, PlaceKind, Settings, SettingsError, SettingsField,
    SettingsPatch, Workspace, ZoneId, RECENT_WORLDS_CAP,
};

use crate::dock::{zone_min, MAX_EXTENT as RECT_MAX, PANEL_IDS, ZONE_MAX};

fn invalid(message: impl Into<String>) -> SettingsError {
    SettingsError::Invalid {
        message: message.into(),
    }
}

/// The largest size or coordinate a panel may be given; anything beyond is not a real screen.
const MAX_EXTENT: i32 = RECT_MAX;

/// The longest a workspace's name may be, in characters.
const NAME_MAX: usize = 64;

fn field(field: SettingsField, message: impl Into<String>) -> SettingsError {
    SettingsError::InvalidField {
        field,
        message: message.into(),
    }
}

fn rect_ok(place: &PanelPlacement) -> bool {
    place.w >= 1
        && place.h >= 1
        && place.w <= MAX_EXTENT
        && place.h <= MAX_EXTENT
        && (0..=MAX_EXTENT).contains(&place.x)
        && (0..=MAX_EXTENT).contains(&place.y)
}

/// Checks one workspace: every panel exactly once and in the place it says, tab groups that are
/// not empty and show a tab they hold, zone sizes in range and rectangles on a real screen.
fn validate_workspace(name: &str, workspace: &Workspace) -> Result<(), SettingsError> {
    for id in workspace.panels.keys() {
        if !PANEL_IDS.contains(&id.as_str()) {
            return Err(field(
                SettingsField::WorkspacePanel,
                format!("the {name} workspace has a panel {id:?} the editor does not have"),
            ));
        }
    }
    for id in PANEL_IDS {
        let Some(entry) = workspace.panels.get(id) else {
            return Err(field(
                SettingsField::WorkspacePanel,
                format!("the {name} workspace has no place for the {id} panel"),
            ));
        };
        if !rect_ok(&entry.float) {
            return Err(field(
                SettingsField::WorkspaceRect,
                format!("the {id} panel in the {name} workspace has no room or is off screen"),
            ));
        }
        if let Some(w) = entry.window {
            let on_screen = (-MAX_EXTENT..=MAX_EXTENT).contains(&w.x)
                && (-MAX_EXTENT..=MAX_EXTENT).contains(&w.y);
            if !(1..=MAX_EXTENT).contains(&w.w) || !(1..=MAX_EXTENT).contains(&w.h) || !on_screen {
                return Err(field(
                    SettingsField::WorkspaceRect,
                    format!("the {id} panel's window in the {name} workspace is not on a screen"),
                ));
            }
        }
        if entry.place == PlaceKind::Window && entry.window.is_none() {
            return Err(field(
                SettingsField::WorkspaceRect,
                format!("the {id} panel in the {name} workspace is in a window with no placement"),
            ));
        }
        if entry.window_from == PlaceKind::Window {
            return Err(field(
                SettingsField::WorkspacePanel,
                format!("the {id} panel in the {name} workspace returns from a window to a window"),
            ));
        }
    }
    let mut seen: BTreeSet<&str> = BTreeSet::new();
    for (zone, z) in workspace.zones.all() {
        let (min, label) = (zone_min(zone), zone_label(zone));
        if z.size < min || z.size > ZONE_MAX {
            return Err(field(
                SettingsField::ZoneSize,
                format!(
                    "the {label} zone in the {name} workspace is {} pixels, outside {min} to {ZONE_MAX}",
                    z.size
                ),
            ));
        }
        for group in &z.groups {
            if group.tabs.is_empty() || !group.tabs.contains(&group.active) {
                return Err(field(
                    SettingsField::WorkspaceTabs,
                    format!(
                        "a tab group in the {label} zone of the {name} workspace is empty or shows a tab it does not hold"
                    ),
                ));
            }
            for tab in &group.tabs {
                let docked = workspace
                    .panels
                    .get(tab)
                    .is_some_and(|e| e.place == PlaceKind::Docked);
                if !seen.insert(tab) || !docked {
                    return Err(field(
                        SettingsField::WorkspacePanel,
                        format!(
                            "the {tab} panel is doubled or not docked but in a tab group in the {name} workspace"
                        ),
                    ));
                }
            }
        }
    }
    for (id, entry) in &workspace.panels {
        if entry.place == PlaceKind::Docked && !seen.contains(id.as_str()) {
            return Err(field(
                SettingsField::WorkspacePanel,
                format!("the {id} panel is docked in the {name} workspace but in no tab group"),
            ));
        }
    }
    if let Some(at) = workspace.tool_picker {
        if !(0..=MAX_EXTENT).contains(&at.x) || !(0..=MAX_EXTENT).contains(&at.y) {
            return Err(field(
                SettingsField::WorkspaceRect,
                format!("the tool picker in the {name} workspace is off the map"),
            ));
        }
    }
    Ok(())
}

fn zone_label(zone: ZoneId) -> &'static str {
    match zone {
        ZoneId::Left => "left",
        ZoneId::Right => "right",
        ZoneId::Bottom => "bottom",
    }
}

/// Checks the dock: no workspaces at all means the defaults apply; otherwise the active name is
/// one of them, no name is empty or very long, and each workspace is sound.
pub fn validate_dock(dock: &DockSettings) -> Result<(), SettingsError> {
    if dock.workspaces.is_empty() {
        return if dock.active.is_empty() {
            Ok(())
        } else {
            Err(field(
                SettingsField::WorkspaceName,
                "the active workspace is named but there are no workspaces",
            ))
        };
    }
    for (name, workspace) in &dock.workspaces {
        if name.trim().is_empty() || name.chars().count() > NAME_MAX {
            return Err(field(
                SettingsField::WorkspaceName,
                format!("a workspace name must be 1 to {NAME_MAX} characters, not {name:?}"),
            ));
        }
        validate_workspace(name, workspace)?;
    }
    if !dock.workspaces.contains_key(&dock.active) {
        return Err(field(
            SettingsField::WorkspaceName,
            format!(
                "the active workspace {:?} is not one of the workspaces",
                dock.active
            ),
        ));
    }
    Ok(())
}

/// Whether `text` is a colour written as `#` and six lowercase hex digits.
fn is_hex_colour(text: &str) -> bool {
    let bytes = text.as_bytes();
    bytes.len() == 7
        && bytes[0] == b'#'
        && bytes[1..]
            .iter()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(b))
}

/// Checks the values a patch can set: a custom accent is a lowercase `#rrggbb`, a locale is not empty, a layout has a window kind and each
/// of its panels has an id, a place on screen and room to show.
pub fn validate(settings: &Settings) -> Result<(), SettingsError> {
    if settings.locale.trim().is_empty() {
        return Err(invalid("locale must not be empty"));
    }
    if let AccentChoice::Custom { hex } = &settings.accent {
        if !is_hex_colour(hex) {
            return Err(SettingsError::InvalidField {
                field: SettingsField::AccentHex,
                message: format!("the accent colour {hex:?} is not a lowercase #rrggbb colour"),
            });
        }
    }
    validate_dock(&settings.dock)?;
    for (label, layout) in &settings.layout {
        if label.is_empty() {
            return Err(invalid("a layout needs a window kind"));
        }
        for (id, place) in &layout.panels {
            if id.is_empty() {
                return Err(invalid(format!("a panel in the {label} layout has no id")));
            }
            let room =
                place.w >= 1 && place.h >= 1 && place.w <= MAX_EXTENT && place.h <= MAX_EXTENT;
            let on_screen =
                (0..=MAX_EXTENT).contains(&place.x) && (0..=MAX_EXTENT).contains(&place.y);
            if !room || !on_screen {
                return Err(invalid(format!(
                    "the {id} panel in the {label} layout has no room or is off screen"
                )));
            }
        }
    }
    Ok(())
}

/// `settings` with `patch` laid over it, or why the result is not acceptable.
pub fn apply_patch(settings: &Settings, patch: &SettingsPatch) -> Result<Settings, SettingsError> {
    let mut next = settings.clone();
    if let Some(mode) = patch.colour_mode {
        next.colour_mode = mode;
    }
    if let Some(accent) = &patch.accent {
        next.accent = accent.clone();
    }
    if let Some(glass) = patch.glass {
        next.glass = glass;
    }
    if let Some(larger) = patch.larger_controls {
        next.larger_controls = larger;
    }
    if let Some(ui) = patch.ui {
        next.ui = ui;
    }
    if let Some(locale) = &patch.locale {
        next.locale = locale.clone();
    }
    if let Some(dock) = &patch.dock {
        next.dock = dock.clone();
    }
    if let Some(layout) = &patch.layout {
        for (label, value) in layout {
            match value {
                Some(layout) => {
                    next.layout.insert(label.clone(), layout.clone());
                }
                None => {
                    next.layout.remove(label);
                }
            }
        }
    }
    validate(&next)?;
    Ok(next)
}

/// Puts `path` first in the recent list: an earlier copy of it is dropped, and the list keeps the
/// newest [`RECENT_WORLDS_CAP`]. An empty path is ignored.
pub fn touch_recent(settings: &mut Settings, path: &str) {
    if path.is_empty() {
        return;
    }
    settings.recent_worlds.retain(|p| p != path);
    settings.recent_worlds.insert(0, path.to_owned());
    settings.recent_worlds.truncate(RECENT_WORLDS_CAP);
}

/// Empties the recent list.
pub fn clear_recent(settings: &mut Settings) {
    settings.recent_worlds.clear();
}
