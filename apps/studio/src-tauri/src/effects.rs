// Puts the blur the Transparency settings ask for behind each see-through window
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The page decides how see-through its own backgrounds are (`theme/transparencyDom.ts`: the
// window's alpha from the settings, the glass mode and the system's preferences); Rust decides the
// one thing the page cannot do, which is to ask the compositor or DWM for blur, Mica or Acrylic
// behind the window. The page never sends a value to the `window-effects` plugin (its capability
// is `get_status` only): the settings are the one source, `plan` turns them into at most one
// request per window, and `reconcile` makes the window match it after every change of the
// settings, every page load, and every focus, size or theme change. A request the system cannot do
// is never made: `plan` reads the plugin's status.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use fizz_studio_protocol::{ColourMode, GlassMode, Settings, WindowBlur, WindowId};
use tauri::{AppHandle, Manager, Runtime, Theme, Webview, Window, WindowEvent};
use tauri_plugin_window_effects::{
    EffectKind, Effects, Flavour, PluginStatus, Rect, WindowEffects, FEATURE_ACRYLIC, FEATURE_BLUR,
    FEATURE_MICA, FEATURE_OPACITY,
};

/// The transparent margin the frame draws its shadow in on Linux, in logical pixels: the page's
/// `--fls-window-shadow-margin` for `data-platform='linux'` (`theme/tokens.css`).
pub const SHADOW_MARGIN: i32 = 8;

/// How long a burst of resizes settles before the blur region is fitted to the new size.
const RESIZE_SETTLE: Duration = Duration::from_millis(150);

/// What a window is like now, as far as its effect is concerned.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WindowState {
    /// The window is in front.
    pub focused: bool,
    /// Maximised or full screen: it meets the screen's edges, so the frame has no margin.
    pub maximised: bool,
    /// The window draws dark, which picks the dark Mica and the tint of Acrylic.
    pub dark: bool,
    /// The window's size in logical pixels, which a blur region is in.
    pub size: (i64, i64),
}

/// The effect a window should have behind it under `settings`, on a system that reports `status`,
/// or none. Nothing is asked for unless glass is not switched off, the window is set to let the
/// desktop through, its blur is not Off, a window that is not in front may stay see-through, and
/// the plugin says the system can do it. Glass following the system is the page's to read: where
/// the system asks for less transparency the page draws solid, which hides the blur.
pub fn plan(settings: &Settings, status: &PluginStatus, window: &WindowState) -> Option<Effects> {
    let wanted = &settings.transparency;
    if settings.glass == GlassMode::Off || !wanted.window_enabled {
        return None;
    }
    if wanted.window_blur == WindowBlur::Off {
        return None;
    }
    if wanted.solid_when_unfocused && !window.focused {
        return None;
    }
    if !status.has(FEATURE_OPACITY) {
        return None;
    }
    let kind = match status.flavour {
        // Low is the quiet material (Mica), High the strong one (Acrylic); either stands in for the
        // other where only one exists.
        Flavour::Windows => {
            let (mica, acrylic) = (status.has(FEATURE_MICA), status.has(FEATURE_ACRYLIC));
            match (wanted.window_blur, mica, acrylic) {
                (WindowBlur::Low, true, _) | (WindowBlur::High, true, false) => EffectKind::Mica,
                (WindowBlur::High, _, true) | (WindowBlur::Low, false, true) => EffectKind::Acrylic,
                _ => return None,
            }
        }
        // The compositors have one blur and no strength to ask for: Low and High are the same.
        Flavour::Wayland | Flavour::X11 => {
            if !status.has(FEATURE_BLUR) {
                return None;
            }
            EffectKind::Blur
        }
        Flavour::Unsupported => return None,
    };
    // Blur only the visible window, not the margin its shadow is drawn in. Windows covers the whole
    // window and ignores a region.
    let margin = i64::from(SHADOW_MARGIN);
    let region = (status.flavour != Flavour::Windows
        && !window.maximised
        && window.size.0 > 2 * margin
        && window.size.1 > 2 * margin)
        .then(|| {
            vec![Rect {
                x: SHADOW_MARGIN,
                y: SHADOW_MARGIN,
                width: (window.size.0 - 2 * margin) as i32,
                height: (window.size.1 - 2 * margin) as i32,
            }]
        });
    Some(Effects {
        kind,
        dark: window.dark,
        region,
    })
}

/// Whether a window with this label can have an effect: every window the frame draws, but not the
/// tear-off ghost, a click-through preview with no frame of its own.
pub fn applies_to(label: &str) -> bool {
    matches!(
        WindowId::parse(label),
        Some(
            WindowId::Main { .. }
                | WindowId::Panel { .. }
                | WindowId::NewWorld
                | WindowId::Preferences
                | WindowId::About
        )
    )
}

#[derive(Default)]
struct Debounce {
    generation: u64,
    running: bool,
}

/// What the app remembers: the last effect asked for each window, so nothing is asked twice, and the
/// plugin's status.
#[derive(Default)]
pub struct Driver {
    applied: Mutex<HashMap<String, Option<Effects>>>,
    status: Mutex<Option<PluginStatus>>,
    /// The last failure per window, so a request the system keeps refusing is logged once.
    failed: Mutex<HashMap<String, String>>,
    settle: Mutex<HashMap<String, Debounce>>,
    /// One request at a time, so a late one never overtakes an earlier one.
    gate: tauri::async_runtime::Mutex<()>,
}

fn locked<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|e| e.into_inner())
}

fn settings_now<R: Runtime>(app: &AppHandle<R>) -> Settings {
    app.try_state::<tauri_plugin_fizz_studio_settings::Store>()
        .map(|store| store.snapshot().settings)
        .unwrap_or_default()
}

/// What a window is like now. `None` for a window that is gone.
fn window_state<R: Runtime>(
    app: &AppHandle<R>,
    label: &str,
    settings: &Settings,
) -> Option<WindowState> {
    let window = app.get_webview_window(label)?;
    let dark = match settings.colour_mode {
        ColourMode::Dark => true,
        ColourMode::Light => false,
        ColourMode::System => window.theme().map(|t| t == Theme::Dark).unwrap_or(false),
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    let size = window
        .inner_size()
        .map(|s| {
            let logical = s.to_logical::<f64>(scale);
            (logical.width.round() as i64, logical.height.round() as i64)
        })
        .unwrap_or((0, 0));
    Some(WindowState {
        focused: window.is_focused().unwrap_or(true),
        maximised: window.is_maximized().unwrap_or(false)
            || window.is_fullscreen().unwrap_or(false),
        dark,
        size,
    })
}

/// Makes the window `label` match its plan. Idempotent: it asks the plugin only for what differs
/// from what it asked last, and reads the settings and the window's state when it runs, so two
/// requests that overlap end in the same place.
pub async fn reconcile<R: Runtime>(app: AppHandle<R>, label: String, refresh_status: bool) {
    let Some(driver) = app.try_state::<Driver>() else {
        return;
    };
    let _turn = driver.gate.lock().await;
    let Some(effects) = app.try_state::<WindowEffects<R>>() else {
        return;
    };
    let settings = settings_now(&app);
    let Some(window) = window_state(&app, &label, &settings) else {
        locked(&driver.applied).remove(&label);
        locked(&driver.failed).remove(&label);
        locked(&driver.settle).remove(&label);
        return;
    };
    let known = locked(&driver.status).clone();
    let status = match known {
        Some(status) if !refresh_status => status,
        _ => {
            let fresh = effects.get_status().await;
            *locked(&driver.status) = Some(fresh.clone());
            fresh
        }
    };
    let wanted = plan(&settings, &status, &window);
    let before = locked(&driver.applied).get(&label).cloned().flatten();
    if before == wanted && locked(&driver.applied).contains_key(&label) {
        return;
    }
    let result = match &wanted {
        Some(effect) => effects.apply(&label, effect.clone()).await,
        None if before.is_some() => effects.clear(&label).await,
        None => Ok(()),
    };
    match result {
        Ok(()) => {
            locked(&driver.failed).remove(&label);
            locked(&driver.applied).insert(label, wanted);
        }
        // Not recorded, so the next change tries again.
        Err(e) => report(&driver, &label, &e.to_string()),
    }
}

/// Logs a failure once per window and message.
fn report(driver: &Driver, label: &str, why: &str) {
    let mut failed = locked(&driver.failed);
    if failed.get(label).map(String::as_str) != Some(why) {
        log::warn!("could not apply the window effect of {label}: {why}");
        failed.insert(label.to_string(), why.to_string());
    }
}

fn reconcile_soon<R: Runtime>(app: &AppHandle<R>, label: &str, refresh_status: bool) {
    let (app, label) = (app.clone(), label.to_string());
    tauri::async_runtime::spawn(reconcile(app, label, refresh_status));
}

/// Reconciles `label` once a burst of events has settled (a resize sends one per frame).
fn reconcile_settled<R: Runtime>(app: &AppHandle<R>, label: &str) {
    let Some(driver) = app.try_state::<Driver>() else {
        return;
    };
    let generation = {
        let mut settle = locked(&driver.settle);
        let entry = settle.entry(label.to_string()).or_default();
        entry.generation += 1;
        if entry.running {
            return;
        }
        entry.running = true;
        entry.generation
    };
    let (app, label) = (app.clone(), label.to_string());
    std::thread::spawn(move || {
        let mut seen = generation;
        loop {
            std::thread::sleep(RESIZE_SETTLE);
            let Some(driver) = app.try_state::<Driver>() else {
                return;
            };
            let mut settle = locked(&driver.settle);
            let Some(entry) = settle.get_mut(&label) else {
                return;
            };
            if entry.generation != seen {
                seen = entry.generation;
                continue;
            }
            entry.running = false;
            drop(settle);
            tauri::async_runtime::block_on(reconcile(app.clone(), label, false));
            return;
        }
    });
}

/// Makes every window match the settings, reading the status again because the compositor can
/// change under the app.
pub fn reconcile_all<R: Runtime>(app: &AppHandle<R>) {
    for label in app.webview_windows().into_keys().filter(|l| applies_to(l)) {
        reconcile_soon(app, &label, true);
    }
}

/// Follows the settings: every change reconciles every window. Call once, after the settings
/// plugin and the window-effects plugin are set up. The store runs its observers under its lock,
/// so this only spawns the work, which reads the settings once the lock is free.
pub fn wire<R: Runtime>(app: &AppHandle<R>) {
    let Some(store) = app.try_state::<tauri_plugin_fizz_studio_settings::Store>() else {
        return;
    };
    let handle = app.clone();
    store.observe(move |_| reconcile_all(&handle));
}

/// A window's page started loading, so the window exists: give it what the settings ask for.
pub fn on_page_load<R: Runtime>(webview: &Webview<R>) {
    let label = webview.label();
    if applies_to(label) {
        reconcile_soon(webview.app_handle(), label, false);
    }
}

/// Follows the window's own changes: in front or not, resized (which includes maximised), the
/// theme changed.
pub fn on_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if !applies_to(window.label()) {
        return;
    }
    match event {
        WindowEvent::Focused(_) | WindowEvent::ThemeChanged(_) => {
            reconcile_soon(window.app_handle(), window.label(), false)
        }
        WindowEvent::Resized(_) => reconcile_settled(window.app_handle(), window.label()),
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use fizz_studio_protocol::TransparencySettings;
    use tauri_plugin_window_effects::{
        status_for, Desktop, Environment, SessionType, EXT_BACKGROUND_EFFECT,
    };

    fn settings(change: impl FnOnce(&mut TransparencySettings)) -> Settings {
        let mut s = Settings::default();
        s.transparency.window_enabled = true;
        change(&mut s.transparency);
        s
    }

    fn state() -> WindowState {
        WindowState {
            focused: true,
            maximised: false,
            dark: false,
            size: (1100, 720),
        }
    }

    fn kde_wayland() -> PluginStatus {
        status_for(&Environment {
            session_type: SessionType::Wayland,
            desktop: Desktop::Kde,
            has_composite: true,
            wayland_globals: vec![EXT_BACKGROUND_EFFECT.to_string()],
            build_number: None,
        })
    }

    fn gnome_wayland() -> PluginStatus {
        status_for(&Environment {
            session_type: SessionType::Wayland,
            desktop: Desktop::Gnome,
            has_composite: true,
            wayland_globals: Vec::new(),
            build_number: None,
        })
    }

    fn windows(build: u32) -> PluginStatus {
        status_for(&Environment {
            session_type: SessionType::Windows,
            desktop: Desktop::Other,
            has_composite: true,
            wayland_globals: Vec::new(),
            build_number: Some(build),
        })
    }

    #[test]
    fn nothing_is_asked_for_by_default() {
        assert_eq!(plan(&Settings::default(), &kde_wayland(), &state()), None);
    }

    #[test]
    fn blur_is_asked_for_where_the_compositor_offers_it_and_fits_the_visible_window() {
        let effect = plan(&settings(|_| {}), &kde_wayland(), &state()).expect("blur on KDE");
        assert_eq!(effect.kind, EffectKind::Blur);
        assert_eq!(
            effect.region,
            Some(vec![Rect {
                x: 8,
                y: 8,
                width: 1084,
                height: 704
            }])
        );
    }

    #[test]
    fn blur_covers_the_whole_window_when_it_is_maximised() {
        let maximised = WindowState {
            maximised: true,
            ..state()
        };
        let effect = plan(&settings(|_| {}), &kde_wayland(), &maximised).expect("blur");
        assert_eq!(effect.region, None);
    }

    #[test]
    fn gnome_has_no_blur_to_ask_for() {
        assert_eq!(plan(&settings(|_| {}), &gnome_wayland(), &state()), None);
    }

    #[test]
    fn every_guardrail_asks_for_nothing() {
        let kde = kde_wayland();
        let off = |s: Settings| plan(&s, &kde, &state());
        assert!(off(settings(|_| {})).is_some());
        assert_eq!(off(settings(|t| t.window_enabled = false)), None);
        assert_eq!(off(settings(|t| t.window_blur = WindowBlur::Off)), None);
        let mut glass_off = settings(|_| {});
        glass_off.glass = GlassMode::Off;
        assert_eq!(off(glass_off), None);
        // Glass forced on, or following the system, still asks: the page decides what it draws.
        let mut glass_on = settings(|_| {});
        glass_on.glass = GlassMode::On;
        assert!(off(glass_on).is_some());
        let unfocused = WindowState {
            focused: false,
            ..state()
        };
        assert_eq!(plan(&settings(|_| {}), &kde, &unfocused), None);
        let kept = settings(|t| t.solid_when_unfocused = false);
        assert!(plan(&kept, &kde, &unfocused).is_some());
    }

    #[test]
    fn a_system_that_cannot_be_transparent_gets_nothing() {
        let mut status = kde_wayland();
        status
            .features
            .iter_mut()
            .find(|f| f.name == FEATURE_OPACITY)
            .unwrap()
            .available = false;
        assert_eq!(plan(&settings(|_| {}), &status, &state()), None);
    }

    #[test]
    fn windows_maps_low_to_mica_and_high_to_acrylic_and_covers_the_whole_window() {
        let both = windows(22621);
        let low = plan(&settings(|_| {}), &both, &state()).unwrap();
        assert_eq!((low.kind, low.region), (EffectKind::Mica, None));
        let high = plan(
            &settings(|t| t.window_blur = WindowBlur::High),
            &both,
            &state(),
        )
        .unwrap();
        assert_eq!(high.kind, EffectKind::Acrylic);
        // Windows 10 has no Mica: Low falls back to Acrylic.
        let ten = windows(19045);
        assert_eq!(
            plan(&settings(|_| {}), &ten, &state()).unwrap().kind,
            EffectKind::Acrylic
        );
    }

    #[test]
    fn the_colour_mode_picks_the_dark_material() {
        let dark = WindowState {
            dark: true,
            ..state()
        };
        assert!(
            plan(&settings(|_| {}), &windows(22621), &dark)
                .unwrap()
                .dark
        );
    }

    #[test]
    fn the_tear_off_ghost_has_no_effects_and_every_framed_window_does() {
        for label in [
            "main-1",
            "main-12",
            "panel-script-1",
            "new-world",
            "preferences",
            "about",
        ] {
            assert!(applies_to(label), "{label}");
        }
        for label in ["tear-ghost", "other"] {
            assert!(!applies_to(label), "{label}");
        }
    }
}
