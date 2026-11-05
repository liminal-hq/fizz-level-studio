// Where a panel's window goes: reading its place, and fitting a remembered place to the screens
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The settings document is the source of truth for where a torn-off panel's window sits, one record
// per panel in each workspace (`PanelEntry.window`, in physical pixels). These are the pure parts
// of keeping it: turning what a window reports into a record the settings accept, deciding
// whether a position can be trusted or applied on this platform, and fitting a remembered place to
// the screens that exist now (a screen unplugged since, a smaller one). `windows.rs` does the
// reading and applying.

use fizz_studio_protocol::WindowPlacement;

/// The most a coordinate or size may be, the same bound the settings crate checks.
pub const MAX_EXTENT: i32 = 20_000;

/// A window's smallest sensible size in physical pixels, so a corrupt record cannot open a speck.
pub const MIN_SIDE: i32 = 160;

/// How much of a window must be over a screen for its remembered position to be kept, in pixels.
/// Enough to see the title bar and grab it.
pub const VISIBLE: (i32, i32) = (96, 48);

/// Whether this platform can say where a window is and place one. Wayland cannot: a client has no
/// say over its position, and the toolkit reports the origin. Everywhere else it can.
pub fn position_known(linux: bool, wayland_display: bool, gdk_backend: Option<&str>) -> bool {
    !(linux && wayland_display && gdk_backend != Some("x11"))
}

/// [`position_known`] for the platform the app is running on now.
pub fn position_known_here() -> bool {
    position_known(
        cfg!(target_os = "linux"),
        std::env::var_os("WAYLAND_DISPLAY").is_some_and(|v| !v.is_empty()),
        std::env::var("GDK_BACKEND").ok().as_deref(),
    )
}

fn clamp(value: i64, low: i32, high: i32) -> i32 {
    value.clamp(i64::from(low), i64::from(high)) as i32
}

/// The record for a window at `position` with `size` (physical pixels), held to what the settings
/// accept. A window that cannot report a position gives `None`, and the origin is recorded then
/// (the caller keeps the older position when `positioned` is false).
pub fn placement_of(position: Option<(i32, i32)>, size: (u32, u32)) -> WindowPlacement {
    let (x, y) = position.unwrap_or((0, 0));
    WindowPlacement {
        x: clamp(i64::from(x), -MAX_EXTENT, MAX_EXTENT),
        y: clamp(i64::from(y), -MAX_EXTENT, MAX_EXTENT),
        w: clamp(i64::from(size.0), 1, MAX_EXTENT),
        h: clamp(i64::from(size.1), 1, MAX_EXTENT),
    }
}

/// What to apply to a new window.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Fitted {
    pub size: (u32, u32),
    /// Where to put it, or `None` to leave it where the system places a new window (centred).
    pub position: Option<(i32, i32)>,
}

fn overlap(a: (i32, i32, i32, i32), b: (i32, i32, i32, i32)) -> (i32, i32) {
    let w = (a.0 + a.2).min(b.0 + b.2) - a.0.max(b.0);
    let h = (a.1 + a.3).min(b.1 + b.3) - a.1.max(b.1);
    (w.max(0), h.max(0))
}

/// Fits a remembered place to the `screens` that exist now (physical rectangles, as `x, y, w, h`).
///
/// The size is held between [`MIN_SIDE`] and the biggest screen, so it never opens larger than any
/// screen can show. The position is kept only when `can_place` is true and at least [`VISIBLE`]
/// pixels of the window are over some screen; otherwise it is dropped, and the window opens
/// centred. With no screens known the record is applied as it is.
pub fn fit(place: WindowPlacement, screens: &[WindowPlacement], can_place: bool) -> Fitted {
    let biggest = screens.iter().fold((i32::MAX, i32::MAX), |(w, h), s| {
        if w == i32::MAX {
            (s.w, s.h)
        } else {
            (w.max(s.w), h.max(s.h))
        }
    });
    let w = clamp(i64::from(place.w), MIN_SIDE, biggest.0.max(MIN_SIDE));
    let h = clamp(i64::from(place.h), MIN_SIDE, biggest.1.max(MIN_SIDE));
    let size = (w as u32, h as u32);
    if !can_place {
        return Fitted {
            size,
            position: None,
        };
    }
    let here = (place.x, place.y, w, h);
    let visible = screens.is_empty()
        || screens.iter().any(|s| {
            let (ow, oh) = overlap(here, (s.x, s.y, s.w, s.h));
            ow >= VISIBLE.0.min(w) && oh >= VISIBLE.1.min(h)
        });
    Fitted {
        size,
        position: visible.then_some((place.x, place.y)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(x: i32, y: i32, w: i32, h: i32) -> WindowPlacement {
        WindowPlacement { x, y, w, h }
    }

    #[test]
    fn wayland_cannot_place_or_report_a_window_and_the_rest_can() {
        assert!(!position_known(true, true, None));
        assert!(!position_known(true, true, Some("wayland")));
        assert!(position_known(true, true, Some("x11")));
        assert!(position_known(true, false, None));
        assert!(position_known(false, true, None));
    }

    #[test]
    fn a_report_is_held_to_what_the_settings_accept() {
        assert_eq!(
            placement_of(Some((10, -20)), (400, 300)),
            at(10, -20, 400, 300)
        );
        assert_eq!(
            placement_of(Some((-90_000, 90_000)), (0, 90_000)),
            at(-MAX_EXTENT, MAX_EXTENT, 1, MAX_EXTENT)
        );
        assert_eq!(placement_of(None, (400, 300)), at(0, 0, 400, 300));
    }

    #[test]
    fn a_remembered_place_on_a_screen_is_kept() {
        let screens = [at(0, 0, 1920, 1080)];
        let fitted = fit(at(300, 200, 520, 720), &screens, true);
        assert_eq!(fitted.size, (520, 720));
        assert_eq!(fitted.position, Some((300, 200)));
    }

    #[test]
    fn a_place_on_a_screen_that_is_gone_opens_centred() {
        let screens = [at(0, 0, 1920, 1080)];
        // Where a second screen to the left used to be.
        let fitted = fit(at(-1500, 100, 520, 720), &screens, true);
        assert_eq!(fitted.position, None);
        assert_eq!(fitted.size, (520, 720));
        // Only a sliver on the screen is not enough to grab.
        assert_eq!(fit(at(1900, 100, 520, 720), &screens, true).position, None);
        // A second screen to the left that exists is kept.
        let two = [at(0, 0, 1920, 1080), at(-1920, 0, 1920, 1080)];
        assert_eq!(
            fit(at(-1500, 100, 520, 720), &two, true).position,
            Some((-1500, 100))
        );
    }

    #[test]
    fn a_size_is_held_between_a_sensible_minimum_and_the_biggest_screen() {
        let screens = [at(0, 0, 1280, 720), at(1280, 0, 1920, 1080)];
        assert_eq!(fit(at(0, 0, 5000, 4000), &screens, true).size, (1920, 1080));
        assert_eq!(fit(at(0, 0, 10, 10), &screens, true).size, (160, 160));
    }

    #[test]
    fn a_platform_that_cannot_place_windows_still_restores_the_size() {
        let screens = [at(0, 0, 1920, 1080)];
        let fitted = fit(at(300, 200, 520, 720), &screens, false);
        assert_eq!(fitted.size, (520, 720));
        assert_eq!(fitted.position, None);
    }

    #[test]
    fn with_no_screens_known_the_record_is_applied_as_it_is() {
        let fitted = fit(at(-3000, 50, 520, 720), &[], true);
        assert_eq!(fitted.position, Some((-3000, 50)));
        assert_eq!(fitted.size, (520, 720));
    }
}
