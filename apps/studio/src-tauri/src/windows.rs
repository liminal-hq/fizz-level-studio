// Creates the app's windows: every window is built here, never from `tauri.conf.json`
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// `tauri.conf.json` keeps `"windows": []`, so decorations, transparency, shadow, and size limits
// are chosen for every window in one place. Windows are frameless and transparent and shadowed:
// Windows 11 draws the shadow and rounded corners, while on Linux Tauri cannot, so the page's
// window frame draws its own inside a small transparent margin.

use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// The kinds of window the app opens. More arrive with the screens that need them.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WindowKind {
    /// A main window: a level or world being edited. There can be several, numbered from 1.
    Main,
}

impl WindowKind {
    /// The window label for the `n`th window of this kind: `main-1`, `main-2`, and so on.
    pub fn label(self, n: u32) -> String {
        match self {
            WindowKind::Main => format!("main-{n}"),
        }
    }
}

/// How a kind of window is made, in logical pixels.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct WindowSpec {
    pub title: &'static str,
    pub size: (f64, f64),
    pub min_size: Option<(f64, f64)>,
    pub resizable: bool,
}

/// The spec for a kind of window.
pub fn spec_for(kind: WindowKind) -> WindowSpec {
    match kind {
        WindowKind::Main => WindowSpec {
            title: "Fizz Level Studio",
            size: (1440.0, 900.0),
            min_size: Some((1024.0, 680.0)),
            resizable: true,
        },
    }
}

/// Builds the `n`th window of `kind`, centred and shown.
pub fn build_window<R: Runtime>(
    app: &AppHandle<R>,
    kind: WindowKind,
    n: u32,
) -> tauri::Result<WebviewWindow<R>> {
    let spec = spec_for(kind);
    let mut builder =
        WebviewWindowBuilder::new(app, kind.label(n), WebviewUrl::App("index.html".into()))
            .title(spec.title)
            .inner_size(spec.size.0, spec.size.1)
            .resizable(spec.resizable)
            .decorations(false)
            .transparent(true)
            .shadow(true)
            .center();
    if let Some((width, height)) = spec.min_size {
        builder = builder.min_inner_size(width, height);
    }
    builder.build()
}

/// Focuses the `n`th window of `kind` if it is open, and otherwise builds it.
pub fn open_or_focus<R: Runtime>(
    app: &AppHandle<R>,
    kind: WindowKind,
    n: u32,
) -> tauri::Result<WebviewWindow<R>> {
    if let Some(window) = app.get_webview_window(&kind.label(n)) {
        window.unminimize()?;
        window.show()?;
        window.set_focus()?;
        return Ok(window);
    }
    build_window(app, kind, n)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::test::{mock_builder, mock_context, noop_assets};

    #[test]
    fn labels_number_the_windows_from_one() {
        assert_eq!(WindowKind::Main.label(1), "main-1");
        assert_eq!(WindowKind::Main.label(3), "main-3");
    }

    #[test]
    fn the_main_window_fits_the_canvas_and_panels() {
        let spec = spec_for(WindowKind::Main);
        assert!(spec.resizable);
        let (min_w, min_h) = spec.min_size.expect("the main window has a minimum size");
        assert!(spec.size.0 >= min_w && spec.size.1 >= min_h);
    }

    #[test]
    fn the_app_builds_and_opens_one_frameless_main_window() {
        let app = mock_builder()
            .build(mock_context(noop_assets()))
            .expect("the app builds");
        let window = open_or_focus(app.handle(), WindowKind::Main, 1).expect("the window opens");
        assert_eq!(window.label(), "main-1");
        assert!(!window.is_decorated().unwrap());
        // A second request focuses the open window instead of building another.
        open_or_focus(app.handle(), WindowKind::Main, 1).expect("the window is found");
        assert_eq!(app.webview_windows().len(), 1);
    }
}
