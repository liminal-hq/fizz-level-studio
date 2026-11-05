// The text of a new level: validated, one template per target, never edited into another target
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_language::tables::THEMES;
use fizz_studio_profile::stub::ProvisionalProfiles;
use fizz_studio_profile::ProfileSource;
use fizz_studio_protocol::{LevelTarget, NewLevelRequest};

use crate::fizz2::DEFAULT_PROFILE;

/// The widths a new level may have.
pub const WIDTH_RANGE: std::ops::RangeInclusive<u32> = 8..=1024;
/// The heights a new level may have.
pub const HEIGHT_RANGE: std::ops::RangeInclusive<u32> = 8..=128;

/// Whether `id` is a slug: lowercase letters, digits, and hyphens, not starting or ending with one.
pub fn is_slug(id: &str) -> bool {
    !id.is_empty()
        && !id.starts_with('-')
        && !id.ends_with('-')
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Checks a request. The message names what is wrong, in English (Canada).
pub fn validate_new_level(request: &NewLevelRequest) -> Result<(), String> {
    let name = &request.name;
    if name.trim().is_empty() {
        return Err("the name is empty".to_string());
    }
    if name.contains(['\n', '\r', '"']) {
        return Err("the name must be one line without quotes".to_string());
    }
    if !is_slug(&request.id) {
        return Err("the id may hold only lowercase letters, digits, and hyphens, and cannot start or end with a hyphen".to_string());
    }
    if !WIDTH_RANGE.contains(&request.width) {
        return Err("the width must be from 8 to 1024".to_string());
    }
    if !HEIGHT_RANGE.contains(&request.height) {
        return Err("the height must be from 8 to 128".to_string());
    }
    if request.target == LevelTarget::Fizz1 {
        if let Some(theme) = &request.theme {
            if !THEMES.contains(&theme.as_str()) {
                return Err(format!(
                    "`{theme}` is not a theme; the themes are {}",
                    THEMES.join(", ")
                ));
            }
        }
        if let Some(ground) = request.ground {
            if ground == 0 || ground >= request.height {
                return Err("the ground must be at least 1 and below the height".to_string());
            }
        }
    }
    Ok(())
}

/// The ground height a Fizz 1 level gets when none is given: a quarter of the height, at least 1.
pub fn default_ground(height: u32) -> u32 {
    (height / 4).max(1)
}

/// The pack name of a world: the id uppercased, letters and digits only, at most 8 characters.
pub fn pack_name(id: &str) -> String {
    let pack: String = id
        .chars()
        .filter(char::is_ascii_alphanumeric)
        .take(8)
        .collect::<String>()
        .to_uppercase();
    if pack.is_empty() {
        "WORLD".to_string()
    } else {
        pack
    }
}

/// The `world.fizz` text of a new Fizz 2 world holding the one level `levels/<id>.fizz`.
pub fn new_world_text(request: &NewLevelRequest) -> String {
    format!(
        "script fizz2 0\nworld \"{}\" id={} pack={} target=ep2\nlevels   levels/{}.fizz\n",
        request.name,
        request.id,
        pack_name(&request.id),
        request.id
    )
}

/// The text of a new level. A Fizz 1 level has no `script` line; a Fizz 2 level starts
/// `script fizz2 0`. Nothing a later edit does changes either.
pub fn new_level_text(request: &NewLevelRequest) -> Result<String, String> {
    validate_new_level(request)?;
    let (w, h) = (request.width, request.height);
    Ok(match request.target {
        LevelTarget::Fizz1 => {
            let ground = request.ground.unwrap_or_else(|| default_ground(h));
            let mut text = format!(
                "level \"{}\" {w}x{h} ground={ground} id={}\n",
                request.name, request.id
            );
            if let Some(theme) = &request.theme {
                text.push_str(&format!("theme {theme}\n"));
            }
            text.push_str(&format!("start 2,{ground}\n\nterrain\n"));
            text
        }
        LevelTarget::Fizz2 => {
            let profiles = ProvisionalProfiles::new();
            let profile = profiles
                .profile(DEFAULT_PROFILE)
                .expect("the default profile exists");
            let empty = profile
                .legend
                .iter()
                .find(|e| e.tile == "EMPTY")
                .map_or('.', |e| e.letter);
            let row: String = std::iter::repeat_n(empty, w as usize).collect();
            let mut text = format!(
                "script fizz2 0\nlevel \"{}\" {w}x{h} id={}\nstart 2,2\nfloor open\n\nmap\n",
                request.name, request.id
            );
            for y in (0..h).rev() {
                text.push_str(&format!("\t|{row}|  {y}\n"));
            }
            text
        }
    })
}
