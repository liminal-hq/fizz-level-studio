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

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// Which window, by what it is: the part of a label that is not decoration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum WindowId {
    /// A main window: a level or world being edited, numbered from 1.
    Main {
        n: u32,
    },
    /// A panel torn off the main window, such as the Script panel: `panel-script-1`.
    Panel {
        panel: String,
        n: u32,
    },
    /// The New level and New world window.
    NewWorld,
    Preferences,
    About,
    /// The ghost that follows the pointer while a panel is being torn off.
    TearGhost,
}

/// The kinds of window, for the sizes and behaviour a kind shares.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WindowKind {
    Main,
    Panel,
    NewWorld,
    Preferences,
    About,
    TearGhost,
}

impl WindowId {
    pub fn kind(&self) -> WindowKind {
        match self {
            WindowId::Main { .. } => WindowKind::Main,
            WindowId::Panel { .. } => WindowKind::Panel,
            WindowId::NewWorld => WindowKind::NewWorld,
            WindowId::Preferences => WindowKind::Preferences,
            WindowId::About => WindowKind::About,
            WindowId::TearGhost => WindowKind::TearGhost,
        }
    }

    /// The window label, which the capability files match on.
    pub fn label(&self) -> String {
        match self {
            WindowId::Main { n } => format!("main-{n}"),
            WindowId::Panel { panel, n } => format!("panel-{panel}-{n}"),
            WindowId::NewWorld => "new-world".to_owned(),
            WindowId::Preferences => "preferences".to_owned(),
            WindowId::About => "about".to_owned(),
            WindowId::TearGhost => "tear-ghost".to_owned(),
        }
    }

    /// The window a label names, or `None` for a label that is not one of ours.
    pub fn parse(label: &str) -> Option<WindowId> {
        match label {
            "new-world" => return Some(WindowId::NewWorld),
            "preferences" => return Some(WindowId::Preferences),
            "about" => return Some(WindowId::About),
            "tear-ghost" => return Some(WindowId::TearGhost),
            _ => {}
        }
        if let Some(n) = label.strip_prefix("main-") {
            return numbered(n).map(|n| WindowId::Main { n });
        }
        let rest = label.strip_prefix("panel-")?;
        let (panel, n) = rest.rsplit_once('-')?;
        if panel.is_empty()
            || !panel
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        {
            return None;
        }
        Some(WindowId::Panel {
            panel: panel.to_owned(),
            n: numbered(n)?,
        })
    }
}

/// A window number: digits only, from 1, written without leading zeros.
fn numbered(text: &str) -> Option<u32> {
    if text.starts_with('0') || !text.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    text.parse().ok().filter(|n| *n >= 1)
}

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
            size: (760.0, 560.0),
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

/// Opens a window, or focuses it when it is already open. Reopening never makes a second.
///
/// The command is `async` on purpose: a synchronous command runs on the main thread, and on Windows
/// building a webview from there waits on that same thread, so the new window never leaves
/// `about:blank`.
#[tauri::command]
pub async fn open_window<R: Runtime>(app: AppHandle<R>, id: WindowId) -> Result<(), String> {
    open_or_focus(&app, &id)
        .map(drop)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn every_id() -> Vec<WindowId> {
        vec![
            WindowId::Main { n: 1 },
            WindowId::Main { n: 12 },
            WindowId::Panel {
                panel: "script".into(),
                n: 1,
            },
            WindowId::Panel {
                panel: "game-view".into(),
                n: 3,
            },
            WindowId::NewWorld,
            WindowId::Preferences,
            WindowId::About,
            WindowId::TearGhost,
        ]
    }

    #[test]
    fn labels_say_what_a_window_is() {
        assert_eq!(WindowId::Main { n: 1 }.label(), "main-1");
        assert_eq!(
            WindowId::Panel {
                panel: "script".into(),
                n: 2
            }
            .label(),
            "panel-script-2"
        );
        assert_eq!(WindowId::NewWorld.label(), "new-world");
    }

    #[test]
    fn a_label_parses_back_to_the_window_it_names() {
        for id in every_id() {
            assert_eq!(WindowId::parse(&id.label()), Some(id.clone()), "{id:?}");
        }
    }

    #[test]
    fn a_label_that_is_not_ours_names_nothing() {
        for label in [
            "",
            "main",
            "main-0",
            "main-01",
            "main-x",
            "panel-script",
            "panel--1",
            "panel-Script-1",
            "settings",
            "main-1 ",
        ] {
            assert_eq!(WindowId::parse(label), None, "{label:?}");
        }
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
