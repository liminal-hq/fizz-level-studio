// Migration of an older settings file, one version step at a time
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// A step works on the file's `settings` value as plain JSON, so it can rename or reshape fields
// the current `Settings` no longer has. Steps run in order from the file's version up to the
// current one.

use fizz_studio_protocol::PanelLayout;

use crate::dock::default_dock;
use crate::layout::MAIN_KIND;
use serde_json::{json, Value};

/// One step: turns the `settings` value of version `from` into that of version `from + 1`.
#[derive(Clone, Copy)]
pub struct Migration {
    pub from: u32,
    pub apply: fn(Value) -> Result<Value, String>,
}

/// The steps this build knows, in order.
pub const MIGRATIONS: &[Migration] = &[
    Migration {
        from: 1,
        apply: layouts_become_typed,
    },
    Migration {
        from: 2,
        apply: add_accent_and_glass,
    },
    Migration {
        from: 3,
        apply: add_dock,
    },
    Migration {
        from: 4,
        apply: add_ui,
    },
    Migration {
        from: 5,
        apply: add_tool_picker,
    },
];

/// Version 6 gives each workspace the place of the floating tool picker, unset (the map's top-left
/// corner). A workspace that already has one keeps it.
fn add_tool_picker(mut settings: Value) -> Result<Value, String> {
    let Some(workspaces) = settings
        .get_mut("dock")
        .and_then(|dock| dock.get_mut("workspaces"))
        .and_then(Value::as_object_mut)
    else {
        return Ok(settings);
    };
    for workspace in workspaces.values_mut() {
        if let Some(object) = workspace.as_object_mut() {
            object.entry("tool_picker").or_insert(Value::Null);
        }
    }
    Ok(settings)
}

/// Version 5 adds the chrome choices (`ui`), the menu bar among them, off. A file that already has
/// them keeps them.
fn add_ui(mut settings: Value) -> Result<Value, String> {
    let object = settings
        .as_object_mut()
        .ok_or("settings is not an object")?;
    object
        .entry("ui")
        .or_insert_with(|| json!({ "menu_bar": false }));
    Ok(settings)
}

/// Version 4 adds the dock: named workspaces of docked, floating and torn-off panels.
///
/// Version 3 saved only floating rectangles, and the new default arrangement docks every panel, so
/// the old arrangement is not carried over as one; the dock starts from the defaults and no panel
/// can be lost. What is kept is the rectangles: when the owner had saved floating positions for
/// the editor window, each panel's remembered floating rectangle in every default workspace is
/// that saved one, so floating a panel puts it where the owner had left it. With no saved
/// positions the dock is left empty, which means the defaults (`resolve_dock`). A file that
/// already has a dock keeps it.
fn add_dock(mut settings: Value) -> Result<Value, String> {
    let object = settings
        .as_object_mut()
        .ok_or("settings is not an object")?;
    if object.contains_key("dock") {
        return Ok(settings);
    }
    let saved = object
        .get("layout")
        .and_then(|layouts| layouts.get(MAIN_KIND))
        .and_then(|main| serde_json::from_value::<PanelLayout>(main.clone()).ok());
    let Some(saved) = saved.filter(|layout| !layout.panels.is_empty()) else {
        return Ok(settings);
    };
    let mut dock = default_dock();
    for workspace in dock.workspaces.values_mut() {
        for (id, entry) in &mut workspace.panels {
            if let Some(place) = saved.panels.get(id) {
                entry.float = *place;
            }
        }
    }
    object.insert(
        "dock".to_owned(),
        serde_json::to_value(dock).map_err(|e| e.to_string())?,
    );
    Ok(settings)
}

/// Version 3 adds the accent choice and the glass setting. A file that already has either keeps
/// it; otherwise each takes its default, the system's.
fn add_accent_and_glass(mut settings: Value) -> Result<Value, String> {
    let object = settings
        .as_object_mut()
        .ok_or("settings is not an object")?;
    object
        .entry("accent")
        .or_insert_with(|| json!({ "kind": "system" }));
    object.entry("glass").or_insert_with(|| json!("system"));
    Ok(settings)
}

/// Version 1 kept each panel layout as an opaque JSON string. Version 2 types it. Nothing wrote
/// layouts in version 1, but a string that already has the typed shape is kept; any other entry is
/// dropped, so that kind takes the defaults.
fn layouts_become_typed(mut settings: Value) -> Result<Value, String> {
    let Some(layouts) = settings.get_mut("layout").and_then(Value::as_object_mut) else {
        return Ok(settings);
    };
    layouts.retain(|_, entry| {
        let parsed = match &*entry {
            Value::String(text) => serde_json::from_str::<Value>(text).ok(),
            other => Some(other.clone()),
        };
        match parsed {
            Some(value) if serde_json::from_value::<PanelLayout>(value.clone()).is_ok() => {
                *entry = value;
                true
            }
            _ => false,
        }
    });
    Ok(settings)
}

/// Brings `settings` from `version` up to `current` through `steps`. A version newer than
/// `current`, or a gap in the steps, is an error: the file stays untouched for the caller to set
/// aside.
pub fn migrate(
    mut settings: Value,
    version: u32,
    current: u32,
    steps: &[Migration],
) -> Result<Value, String> {
    if version > current {
        return Err(format!(
            "the file is version {version}, newer than this build understands ({current})"
        ));
    }
    let mut at = version;
    while at < current {
        let step = steps
            .iter()
            .find(|s| s.from == at)
            .ok_or_else(|| format!("no migration from version {at}"))?;
        settings = (step.apply)(settings)?;
        at += 1;
    }
    Ok(settings)
}
