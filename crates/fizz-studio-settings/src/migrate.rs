// Migration of an older settings file, one version step at a time
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// A step works on the file's `settings` value as plain JSON, so it can rename or reshape fields
// the current `Settings` no longer has. Steps run in order from the file's version up to the
// current one.

use fizz_studio_protocol::PanelLayout;
use serde_json::Value;

/// One step: turns the `settings` value of version `from` into that of version `from + 1`.
#[derive(Clone, Copy)]
pub struct Migration {
    pub from: u32,
    pub apply: fn(Value) -> Result<Value, String>,
}

/// The steps this build knows, in order.
pub const MIGRATIONS: &[Migration] = &[Migration {
    from: 1,
    apply: layouts_become_typed,
}];

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
