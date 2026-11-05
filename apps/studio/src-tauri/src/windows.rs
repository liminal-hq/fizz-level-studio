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

pub use fizz_studio_protocol::{WindowId, WindowKind};
use tauri::{
    AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
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

/// The title the app's windows carry before the page names them (the page sets the real one).
const APP_TITLE: &str = "Fizz Level Studio";

/// The spec for a kind of window.
pub fn spec_for(kind: WindowKind) -> WindowSpec {
    match kind {
        WindowKind::Main => WindowSpec {
            title: APP_TITLE,
            size: (1440.0, 900.0),
            min_size: Some((1024.0, 680.0)),
            resizable: true,
            skip_taskbar: false,
            child_of_main: false,
            always_on_top: false,
        },
        WindowKind::Panel => WindowSpec {
            title: APP_TITLE,
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
    builder.build()
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
        assert_eq!(open_panels(app.handle().clone()).len(), 5);
        let unknown = WindowId::Panel {
            panel: "game-view".into(),
            n: 1,
        };
        let refused = tauri::async_runtime::block_on(open_window(app.handle().clone(), unknown));
        assert!(refused.is_err());
        assert!(app.get_webview_window("panel-game-view-1").is_none());
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
