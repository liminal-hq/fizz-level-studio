// The rules for changing settings: validation, patches and the recent-worlds list
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_protocol::{Settings, SettingsError, SettingsPatch, RECENT_WORLDS_CAP};

fn invalid(message: impl Into<String>) -> SettingsError {
    SettingsError::Invalid {
        message: message.into(),
    }
}

/// The largest size or coordinate a panel may be given; anything beyond is not a real screen.
const MAX_EXTENT: i32 = 20_000;

/// Checks the values a patch can set: a locale is not empty, a layout has a window kind and each
/// of its panels has an id, a place on screen and room to show.
pub fn validate(settings: &Settings) -> Result<(), SettingsError> {
    if settings.locale.trim().is_empty() {
        return Err(invalid("locale must not be empty"));
    }
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
    if let Some(larger) = patch.larger_controls {
        next.larger_controls = larger;
    }
    if let Some(locale) = &patch.locale {
        next.locale = locale.clone();
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
