// Creates the app's windows: every window is built here, never from `tauri.conf.json`
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// `tauri.conf.json` keeps `"windows": []`, so decorations, transparency, shadow, and size limits
// are chosen for every window in one place. Windows are frameless and transparent and shadowed:
// Windows 11 draws the shadow and rounded corners, while on Linux Tauri cannot, so the page's
// window frame draws its own inside a small transparent margin.
//
// A window's label says what it is, and the capability files match on those labels: `main-{n}`,
// `panel-{panel}-{n}`, `new-world`, `preferences`, `about`, and `tear-ghost`. The pixel editor
// (`pixel-{n}`) and behaviour editor (`behaviour-{n}`) windows arrive with their milestones.

use crate::panel_place::{fit, placement_of, position_known_here, Fitted};
pub use fizz_studio_protocol::{PanelPlaced, WindowId, WindowKind, WindowPlacement};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder,
};

/// How a kind of window is made, in logical pixels.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct WindowSpec {
    pub title: &'static str,
    pub size: (f64, f64),
    pub min_size: Option<(f64, f64)>,
    pub resizable: bool,
    /// Keeps the window off the taskbar: it belongs to a main window, not the desktop.
    pub skip_taskbar: bool,
    /// Opens as a child of the first main window, so it stays above it and closes with it.
    pub child_of_main: bool,
    pub always_on_top: bool,
}

/// The title the tear-off ghost carries. It is never shown in a window list.
const APP_TITLE: &str = "Fizz Level Studio";

/// The native title a main window opens with: the start screen's name. The page then keeps it equal
/// to the title bar's text (`set_window_title`), which never holds the app's name.
pub const START_TITLE: &str = "Start";

/// The spec for a kind of window.
pub fn spec_for(kind: WindowKind) -> WindowSpec {
    match kind {
        WindowKind::Main => WindowSpec {
            title: START_TITLE,
            size: (1440.0, 900.0),
            min_size: Some((1024.0, 680.0)),
            resizable: true,
            skip_taskbar: false,
            child_of_main: false,
            always_on_top: false,
        },
        WindowKind::Panel => WindowSpec {
            title: "Panel",
            size: (520.0, 720.0),
            min_size: Some((320.0, 240.0)),
            resizable: true,
            skip_taskbar: false,
            child_of_main: false,
            always_on_top: false,
        },
        WindowKind::NewWorld => WindowSpec {
            title: "New level",
            size: (760.0, 700.0),
            min_size: None,
            resizable: false,
            skip_taskbar: true,
            child_of_main: true,
            always_on_top: false,
        },
        WindowKind::Preferences => WindowSpec {
            title: "Preferences",
            size: (860.0, 620.0),
            min_size: Some((560.0, 440.0)),
            resizable: true,
            skip_taskbar: false,
            child_of_main: false,
            always_on_top: false,
        },
        WindowKind::About => WindowSpec {
            title: "About Fizz Level Studio",
            size: (560.0, 640.0),
            min_size: None,
            resizable: false,
            skip_taskbar: true,
            child_of_main: false,
            always_on_top: false,
        },
        WindowKind::TearGhost => WindowSpec {
            title: APP_TITLE,
            size: (240.0, 160.0),
            min_size: None,
            resizable: false,
            skip_taskbar: true,
            child_of_main: false,
            always_on_top: true,
        },
    }
}

/// Builds the window `id`, centred and shown.
pub fn build_window<R: Runtime>(
    app: &AppHandle<R>,
    id: &WindowId,
) -> tauri::Result<WebviewWindow<R>> {
    build_window_at(app, id, None)
}

/// Builds the window `id`, at `place` when given (a remembered size and, where the platform allows,
/// position, already fitted to the screens), and otherwise centred. A window with a place is made
/// hidden, sized and moved, then shown, so it never flashes at the default size.
pub fn build_window_at<R: Runtime>(
    app: &AppHandle<R>,
    id: &WindowId,
    place: Option<Fitted>,
) -> tauri::Result<WebviewWindow<R>> {
    build_window_with(app, id, place, true)
}

/// Builds the window `id` like [`build_window_at`], and leaves it hidden when `show` is false. A
/// window the compositor is about to drag (the tear-off plugin's `toplevel_drag`) is made hidden:
/// the drag shows it itself, through GTK, so it can attach the window before it is mapped.
pub fn build_window_with<R: Runtime>(
    app: &AppHandle<R>,
    id: &WindowId,
    place: Option<Fitted>,
    show: bool,
) -> tauri::Result<WebviewWindow<R>> {
    let spec = spec_for(id.kind());
    let mut builder =
        WebviewWindowBuilder::new(app, id.label(), WebviewUrl::App("index.html".into()))
            .title(spec.title)
            .inner_size(spec.size.0, spec.size.1)
            .resizable(spec.resizable)
            // A fixed window cannot be maximised either: the button would do nothing.
            .maximizable(spec.resizable)
            .skip_taskbar(spec.skip_taskbar)
            .always_on_top(spec.always_on_top)
            .decorations(false)
            .transparent(true)
            .shadow(true)
            .visible(show && place.is_none())
            .center();
    if let Some((width, height)) = spec.min_size {
        builder = builder.min_inner_size(width, height);
    }
    if spec.child_of_main {
        // On Wayland a window's place cannot be set, so a child is placed by the compositor over
        // its parent. Without a main window there is nothing to belong to.
        if let Some(main) = app.get_webview_window(&WindowId::Main { n: 1 }.label()) {
            builder = builder.parent(&main)?;
        }
    }
    let window = builder.build()?;
    if let Some(place) = place {
        window.set_size(PhysicalSize::new(place.size.0, place.size.1))?;
        if let Some((x, y)) = place.position {
            window.set_position(PhysicalPosition::new(x, y))?;
        }
        if show {
            window.show()?;
        }
    }
    Ok(window)
}

/// Sets the native title of the window that asks (the taskbar, Alt+Tab and window lists show it).
///
/// A window can name only itself: the target is the calling webview's window, never an argument.
/// The page sends the same text its title bar shows, so the two never differ.
#[tauri::command]
pub fn set_window_title<R: Runtime>(window: WebviewWindow<R>, title: String) -> Result<(), String> {
    window.set_title(&title).map_err(|e| e.to_string())
}

/// Focuses the window `id` if it is open, and otherwise builds it.
pub fn open_or_focus<R: Runtime>(
    app: &AppHandle<R>,
    id: &WindowId,
) -> tauri::Result<WebviewWindow<R>> {
    if let Some(window) = app.get_webview_window(&id.label()) {
        window.unminimize()?;
        window.show()?;
        window.set_focus()?;
        return Ok(window);
    }
    build_window(app, id)
}

/// Opens a window, or focuses it when it is already open. Reopening never makes a second. A panel
/// window is made for any panel in `PANEL_IDS` and for no other.
///
/// The command is `async` on purpose: a synchronous command runs on the main thread, and on Windows
/// building a webview from there waits on that same thread, so the new window never leaves
/// `about:blank`.
#[tauri::command]
pub async fn open_window<R: Runtime>(app: AppHandle<R>, id: WindowId) -> Result<(), String> {
    if !id.is_openable() {
        return Err(format!("{} is not a window the app opens", id.label()));
    }
    open_or_focus(&app, &id)
        .map(drop)
        .map_err(|e| e.to_string())
}

/// Sent to every window when a panel window goes away, however it closes. The payload is the label,
/// such as `panel-script-1`, so the main window can dock the panel back.
pub const PANEL_CLOSED_EVENT: &str = "panel://closed";

/// Tells every window that the window `label` is gone, if it was a panel window that closed on its
/// own (its close button, Dock back). A panel that goes with its main window or with the app is not
/// announced: it was not docked back, and the saved arrangement keeps it in its window for the next
/// start.
pub fn announce_panel_closed<R: Runtime>(app: &AppHandle<R>, label: &str) {
    if matches!(WindowId::parse(label), Some(WindowId::Panel { .. })) {
        let leaving = app
            .try_state::<crate::quit::QuitState>()
            .is_some_and(|state| state.panel_goes_with_owner(label));
        if leaving {
            return;
        }
        if let Err(e) = app.emit(PANEL_CLOSED_EVENT, label) {
            log::warn!("could not announce that {label} closed: {e}");
        }
    }
}

/// Sent to the main window a panel window belongs to when the window opens, moves, resizes or is
/// about to close on its own. The payload is a [`PanelPlaced`]; the main window writes it into the
/// panel's `window` record in the active workspace, which is the source of truth.
pub const PANEL_PLACED_EVENT: &str = "panel://placed";

/// What a window reports about where it is now, or `None` for a window with no size to report (a
/// minimised one reports none).
fn placed(
    label: &str,
    position: tauri::Result<PhysicalPosition<i32>>,
    size: tauri::Result<PhysicalSize<u32>>,
) -> Option<PanelPlaced> {
    let size = size.ok().filter(|s| s.width >= 50 && s.height >= 50)?;
    let position = position.ok().map(|p| (p.x, p.y));
    Some(PanelPlaced {
        label: label.to_owned(),
        placement: placement_of(position, (size.width, size.height)),
        positioned: position.is_some() && position_known_here(),
    })
}

/// Tells the main window a panel window belongs to where the panel window is now. Called as a
/// panel window moves, resizes and closes; any other window is ignored.
pub fn report_panel_placed<R: Runtime>(window: &tauri::Window<R>) {
    let Some(WindowId::Panel { n, .. }) = WindowId::parse(window.label()) else {
        return;
    };
    let Some(report) = placed(window.label(), window.outer_position(), window.inner_size()) else {
        return;
    };
    let owner = WindowId::Main { n }.label();
    if let Err(e) = window
        .app_handle()
        .emit_to(owner, PANEL_PLACED_EVENT, report)
    {
        log::warn!("could not report where {} is: {e}", window.label());
    }
}

/// The screens as placements, in physical pixels.
fn screens<R: Runtime>(app: &AppHandle<R>) -> Vec<WindowPlacement> {
    app.available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|m| WindowPlacement {
            x: m.position().x,
            y: m.position().y,
            w: i32::try_from(m.size().width).unwrap_or(i32::MAX),
            h: i32::try_from(m.size().height).unwrap_or(i32::MAX),
        })
        .collect()
}

/// Opens a panel's window, or brings it forward when it is open. `placement` is the remembered
/// place from the saved workspace: it is fitted to `screens` (and a platform that cannot place
/// windows keeps only its size). Only the panels in `PANEL_IDS` have windows.
fn open_panel_window<R: Runtime>(
    app: &AppHandle<R>,
    panel: String,
    placement: Option<WindowPlacement>,
    screens: &[WindowPlacement],
    hidden: bool,
) -> Result<WebviewWindow<R>, String> {
    let id = WindowId::Panel { panel, n: 1 };
    if !id.is_openable() {
        return Err(format!("{} is not a window the app opens", id.label()));
    }
    if let Some(open) = app.get_webview_window(&id.label()) {
        if !hidden {
            open.unminimize().map_err(|e| e.to_string())?;
            open.show().map_err(|e| e.to_string())?;
            open.set_focus().map_err(|e| e.to_string())?;
        }
        return Ok(open);
    }
    let fitted = placement.map(|place| fit(place, screens, position_known_here()));
    build_window_with(app, &id, fitted, !hidden).map_err(|e| e.to_string())
}

/// Opens a panel's window, or brings it forward when it is open, and says where it is. With
/// `hidden` the window is made and left hidden for the compositor's window drag to show (a drag
/// that then cannot start closes it again through `close_panel`).
///
/// Like `open_window` this is `async` so building a webview does not wait on the main thread.
#[tauri::command]
pub async fn tear_off_panel<R: Runtime>(
    app: AppHandle<R>,
    panel: String,
    placement: Option<WindowPlacement>,
    hidden: Option<bool>,
) -> Result<PanelPlaced, String> {
    let window = open_panel_window(
        &app,
        panel,
        placement,
        &screens(&app),
        hidden.unwrap_or(false),
    )?;
    let label = window.label().to_owned();
    // A window that has not been drawn yet may not know its size; the place asked for, or the
    // kind's default size, stands in until it moves or resizes and reports.
    Ok(
        placed(&label, window.outer_position(), window.inner_size()).unwrap_or_else(|| {
            let spec = spec_for(WindowKind::Panel);
            PanelPlaced {
                label,
                placement: placement.unwrap_or(WindowPlacement {
                    x: 0,
                    y: 0,
                    w: spec.size.0 as i32,
                    h: spec.size.1 as i32,
                }),
                positioned: false,
            }
        }),
    )
}

/// The labels of the panel windows that are open, sorted, so a window that starts late can tell
/// which panels are torn off.
#[tauri::command]
pub fn open_panels<R: Runtime>(app: AppHandle<R>) -> Vec<String> {
    let mut labels: Vec<String> = app
        .webview_windows()
        .into_keys()
        .filter(|label| matches!(WindowId::parse(label), Some(WindowId::Panel { .. })))
        .collect();
    labels.sort();
    labels
}

/// Closes a panel window, which docks the panel back. Only panel windows may be closed this way, and
/// closing one that is not open is not an error.
#[tauri::command]
pub async fn close_panel<R: Runtime>(app: AppHandle<R>, id: WindowId) -> Result<(), String> {
    if !matches!(id, WindowId::Panel { .. }) {
        return Err(format!("{} is not a panel window", id.label()));
    }
    match app.get_webview_window(&id.label()) {
        Some(window) => window.destroy().map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::Listener;

    fn every_id() -> Vec<WindowId> {
        vec![
            WindowId::Main { n: 1 },
            WindowId::Main { n: 12 },
            WindowId::Panel {
                panel: "script".into(),
                n: 1,
            },
            WindowId::Panel {
                panel: "history".into(),
                n: 3,
            },
            WindowId::NewWorld,
            WindowId::Preferences,
            WindowId::About,
            WindowId::TearGhost,
        ]
    }

    #[test]
    fn no_window_opens_titled_with_the_app_name() {
        for id in every_id() {
            if id == WindowId::TearGhost || id == WindowId::About {
                continue;
            }
            assert!(!spec_for(id.kind()).title.contains("Fizz"), "{id:?}");
        }
        assert_eq!(spec_for(WindowKind::Main).title, START_TITLE);
    }

    #[test]
    fn a_window_accepts_a_native_title_for_itself() {
        // The mock runtime does not report a title back, so this proves the command runs for the
        // calling window; the running-app checks read the real title.
        let app = tauri::test::mock_app();
        let id = WindowId::Main { n: 1 };
        let window = build_window(app.handle(), &id).expect("builds");
        set_window_title(window, "crater.fizz •".to_owned()).expect("sets");
    }

    #[test]
    fn the_main_window_opens_larger_than_its_minimum() {
        let spec = spec_for(WindowKind::Main);
        let (min_w, min_h) = spec.min_size.expect("the main window has a minimum size");
        assert!(spec.size.0 >= min_w && spec.size.1 >= min_h);
        assert_eq!(spec.size, (1440.0, 900.0));
    }

    #[test]
    fn dialogs_are_fixed_and_belong_to_a_main_window() {
        let spec = spec_for(WindowKind::NewWorld);
        assert!(!spec.resizable && spec.skip_taskbar && spec.child_of_main);
        let about = spec_for(WindowKind::About);
        assert!(!about.resizable && about.skip_taskbar && !about.child_of_main);
    }

    #[test]
    fn only_the_tear_off_ghost_floats_above_everything() {
        for id in every_id() {
            let floats = spec_for(id.kind()).always_on_top;
            assert_eq!(floats, id == WindowId::TearGhost, "{id:?}");
        }
    }

    #[test]
    fn every_window_opens_with_its_own_label_and_reopening_makes_no_second() {
        let app = tauri::test::mock_app();
        // Child windows come before the main window: the mock runtime cannot parent a window to
        // another, which a real child window does when a main window is open.
        let ids = every_id();
        let (mains, others): (Vec<_>, Vec<_>) = ids
            .into_iter()
            .partition(|id| matches!(id, WindowId::Main { .. }));
        for id in others.iter().chain(mains.iter()) {
            tauri::async_runtime::block_on(open_window(app.handle().clone(), id.clone()))
                .expect("opens");
            tauri::async_runtime::block_on(open_window(app.handle().clone(), id.clone()))
                .expect("focuses");
            assert!(app.get_webview_window(&id.label()).is_some(), "{id:?}");
        }
        assert_eq!(app.webview_windows().len(), every_id().len());
    }

    fn script_panel() -> WindowId {
        WindowId::Panel {
            panel: "script".into(),
            n: 1,
        }
    }

    #[test]
    fn every_editor_panel_opens_a_window_and_an_unknown_panel_is_refused() {
        let app = tauri::test::mock_app();
        for panel in fizz_studio_protocol::PANEL_IDS {
            let id = WindowId::Panel {
                panel: panel.into(),
                n: 1,
            };
            tauri::async_runtime::block_on(open_window(app.handle().clone(), id.clone()))
                .expect("opens");
            assert!(app.get_webview_window(&id.label()).is_some(), "{panel}");
        }
        assert_eq!(open_panels(app.handle().clone()).len(), 6);
        let unknown = WindowId::Panel {
            panel: "game-view".into(),
            n: 1,
        };
        let refused = tauri::async_runtime::block_on(open_window(app.handle().clone(), unknown));
        assert!(refused.is_err());
        assert!(app.get_webview_window("panel-game-view-1").is_none());
    }

    #[test]
    fn tearing_off_a_panel_opens_its_window_and_reopening_makes_no_second() {
        let app = tauri::test::mock_app();
        for panel in fizz_studio_protocol::PANEL_IDS {
            let window =
                open_panel_window(app.handle(), panel.to_owned(), None, &[], false).expect("opens");
            assert_eq!(window.label(), format!("panel-{panel}-1"));
        }
        open_panel_window(app.handle(), "script".into(), None, &[], false).expect("focuses");
        assert_eq!(open_panels(app.handle().clone()).len(), 6);
    }

    #[test]
    fn tearing_off_a_panel_that_is_not_ours_is_refused() {
        let app = tauri::test::mock_app();
        for panel in ["game-view", "", "Script"] {
            let refused = open_panel_window(app.handle(), panel.into(), None, &[], false);
            assert!(refused.is_err(), "{panel:?}");
        }
        assert!(open_panels(app.handle().clone()).is_empty());
    }

    #[test]
    fn a_remembered_place_opens_the_window_whether_or_not_a_screen_holds_it() {
        let app = tauri::test::mock_app();
        let place = WindowPlacement {
            x: -4000,
            y: 60,
            w: 700,
            h: 500,
        };
        let screens = [WindowPlacement {
            x: 0,
            y: 0,
            w: 1920,
            h: 1080,
        }];
        // The mock window cannot report a size back, so what is applied is checked in `panel_place`
        // and in the running app; here the window must open and be shown.
        let window =
            open_panel_window(app.handle(), "history".into(), Some(place), &screens, false)
                .expect("opens");
        assert!(window.is_visible().unwrap());
    }

    #[test]
    fn a_panel_window_can_be_opened_hidden_and_asking_again_makes_no_second() {
        // The mock runtime reports every window as visible, so that the window is left hidden is
        // checked in the running app (`tools/app-checks`); here the hidden path must open the
        // window once and find it again.
        let app = tauri::test::mock_app();
        let window =
            open_panel_window(app.handle(), "layers".into(), None, &[], true).expect("opens");
        assert_eq!(window.label(), "panel-layers-1");
        open_panel_window(app.handle(), "layers".into(), None, &[], true).expect("finds it");
        open_panel_window(app.handle(), "layers".into(), None, &[], false).expect("shows it");
        assert_eq!(open_panels(app.handle().clone()), vec!["panel-layers-1"]);
    }

    #[test]
    fn open_panels_lists_only_panel_windows() {
        let app = tauri::test::mock_app();
        assert!(open_panels(app.handle().clone()).is_empty());
        build_window(app.handle(), &WindowId::Main { n: 1 }).expect("builds");
        build_window(app.handle(), &script_panel()).expect("builds");
        assert_eq!(open_panels(app.handle().clone()), vec!["panel-script-1"]);
    }

    #[test]
    fn close_panel_refuses_a_window_that_is_not_a_panel() {
        let app = tauri::test::mock_app();
        build_window(app.handle(), &WindowId::Main { n: 1 }).expect("builds");
        build_window(app.handle(), &script_panel()).expect("builds");
        tauri::async_runtime::block_on(close_panel(app.handle().clone(), script_panel()))
            .expect("closes");
        // The mock runtime has no event loop to finish the removal, so the window going away is
        // checked in the running app (`tools/app-checks`). Closing a panel that was never opened is
        // fine; a main window is refused and stays open.
        tauri::async_runtime::block_on(close_panel(
            app.handle().clone(),
            WindowId::Panel {
                panel: "game-view".into(),
                n: 1,
            },
        ))
        .expect("nothing to close");
        let refused = tauri::async_runtime::block_on(close_panel(
            app.handle().clone(),
            WindowId::Main { n: 1 },
        ));
        assert!(refused.is_err());
        assert!(app.get_webview_window("main-1").is_some());
    }

    #[test]
    fn a_panel_closing_is_announced_and_a_main_window_closing_is_not() {
        use std::sync::{Arc, Mutex};
        let app = tauri::test::mock_app();
        let heard = Arc::new(Mutex::new(Vec::<String>::new()));
        let sink = heard.clone();
        app.listen(PANEL_CLOSED_EVENT, move |event| {
            sink.lock().unwrap().push(event.payload().to_owned());
        });
        announce_panel_closed(app.handle(), "panel-script-1");
        announce_panel_closed(app.handle(), "main-1");
        announce_panel_closed(app.handle(), "panel-bad");
        assert_eq!(*heard.lock().unwrap(), vec!["\"panel-script-1\""]);
    }

    #[test]
    fn a_panel_that_goes_with_its_main_window_is_not_announced() {
        use std::sync::{Arc, Mutex};
        let app = tauri::test::mock_app();
        app.manage(crate::quit::QuitState::default());
        let heard = Arc::new(Mutex::new(Vec::<String>::new()));
        let sink = heard.clone();
        app.listen(PANEL_CLOSED_EVENT, move |event| {
            sink.lock().unwrap().push(event.payload().to_owned());
        });
        app.state::<crate::quit::QuitState>()
            .mark_leaving("panel-script-1");
        announce_panel_closed(app.handle(), "panel-script-1");
        // The same label closing again on its own is the person docking it back.
        announce_panel_closed(app.handle(), "panel-script-1");
        announce_panel_closed(app.handle(), "panel-objects-1");
        assert_eq!(
            *heard.lock().unwrap(),
            vec!["\"panel-script-1\"", "\"panel-objects-1\""]
        );
    }

    #[test]
    fn a_window_is_built_frameless() {
        let app = tauri::test::mock_app();
        let window = build_window(app.handle(), &WindowId::Main { n: 1 }).expect("builds");
        assert_eq!(window.label(), "main-1");
        assert!(!window.is_decorated().unwrap());
    }

    /// Every capability file may name only windows the app can open: a label that parses, or a
    /// glob over one of the numbered families. A typo in a label would silently grant nothing.
    #[test]
    fn every_capability_names_windows_the_app_can_open() {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("capabilities");
        let mut files = 0;
        for entry in std::fs::read_dir(dir).expect("the capabilities directory") {
            let path = entry.expect("a directory entry").path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            files += 1;
            let text = std::fs::read_to_string(&path).expect("a readable capability");
            let capability: serde_json::Value = serde_json::from_str(&text).expect("valid JSON");
            let windows = capability["windows"].as_array().expect("a windows list");
            assert!(!windows.is_empty(), "{path:?} grants nothing");
            for window in windows {
                let label = window.as_str().expect("a string label");
                let known = label == "*"
                    || label == "main-*"
                    || label == "panel-*"
                    || WindowId::parse(label).is_some();
                assert!(
                    known,
                    "{path:?} names {label:?}, which is not a window we open"
                );
            }
        }
        assert!(files >= 4, "expected the capability files, found {files}");
    }
}
