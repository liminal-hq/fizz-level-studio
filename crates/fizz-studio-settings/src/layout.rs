// The default floating-panel layouts and how a saved layout is laid over them
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Positions are pixels from the top-left of the editor area. The editor's defaults are drawn for a
// 1280 × 800 window: with the title bar and the tool bar that leaves an area of about 1280 × 700,
// and every panel below fits inside it. The frontend still keeps a panel inside whatever area it
// has, so a smaller window pulls panels in rather than losing them.

use fizz_studio_protocol::{PanelLayout, PanelPlacement, Settings};

/// The window kind of the editor.
pub const MAIN_KIND: &str = "main";

fn place(x: i32, y: i32, w: i32, h: i32, collapsed: bool, z: u32) -> PanelPlacement {
    PanelPlacement {
        x,
        y,
        w,
        h,
        collapsed,
        visible: true,
        z,
    }
}

/// The starting arrangement for a window kind: the prototype's palette position, a larger Script
/// panel at the right, and the rest between them. A kind with no floating panels has none.
pub fn default_layout(kind: &str) -> PanelLayout {
    let mut layout = PanelLayout::default();
    if kind == MAIN_KIND {
        let panels = &mut layout.panels;
        panels.insert("palette".to_owned(), place(76, 8, 252, 300, false, 1));
        panels.insert("layers".to_owned(), place(336, 434, 260, 240, false, 6));
        panels.insert("objects".to_owned(), place(336, 126, 260, 300, false, 2));
        panels.insert("history".to_owned(), place(336, 8, 380, 110, false, 3));
        panels.insert("proposals".to_owned(), place(76, 316, 252, 200, true, 4));
        panels.insert("script".to_owned(), place(812, 8, 460, 420, false, 5));
    }
    layout
}

/// The layout in force for `kind`: the defaults, with each panel the person has saved laid over
/// them. A panel added by a newer build therefore appears at its default place in an older saved
/// layout.
pub fn resolve_layout(settings: &Settings, kind: &str) -> PanelLayout {
    let mut layout = default_layout(kind);
    if let Some(saved) = settings.layout.get(kind) {
        for (id, placement) in &saved.panels {
            layout.panels.insert(id.clone(), *placement);
        }
    }
    layout
}
