// Whether this build leaves the webview's own right-click menu available behind Shift
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The studio draws its own context menus and blocks the webview's. A debug build keeps one way
// back to the native menu, whose Inspect item opens the web inspector: Shift+right-click. The
// decision is the prevent-default plugin's, so the page and the plugin cannot disagree: the plugin
// leaves the menu alone in a debug build and blocks it on every `contextmenu` in a release build,
// whatever the page does. The page asks here, never `import.meta.env.DEV`, because `app:build` makes
// a production bundle and puts it in a debug binary.

use tauri_plugin_prevent_default::Flags;

/// True when the plugin leaves the native context menu to the webview (a debug build).
pub fn native_menu_allowed() -> bool {
    !Flags::debug().contains(Flags::CONTEXT_MENU)
}

/// Asked once by the page: may a Shift+right-click reach the native menu?
#[tauri::command]
pub fn app_native_menu_allowed() -> bool {
    native_menu_allowed()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_native_menu_follows_the_build() {
        // The plugin keeps the menu in a debug build and blocks it in a release build.
        assert_eq!(native_menu_allowed(), cfg!(debug_assertions));
    }
}
