// Which window: the kinds of window the app opens and the labels that name them
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// A window's label says what it is, and the capability files match on those labels:
// `main-{n}`, `panel-{panel}-{n}`, `new-world`, `preferences`, `about`, and `tear-ghost`.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Every panel the editor has, in the order the Panels menu lists them. A panel window may be made
/// for any of these and for nothing else; the settings crate keeps a dock entry for each.
pub const PANEL_IDS: [&str; 5] = ["palette", "objects", "history", "proposals", "script"];

/// Which window, by what it is: the part of a label that is not decoration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "kebab-case")]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
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

    /// Whether the app may open this window. A panel window is made only for a panel in
    /// [`PANEL_IDS`]: a label can name any panel (the parser is lenient so capabilities and old
    /// labels read), but a window for an unknown one is refused.
    pub fn is_openable(&self) -> bool {
        match self {
            WindowId::Panel { panel, .. } => PANEL_IDS.contains(&panel.as_str()),
            _ => true,
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
    fn every_editor_panel_may_have_a_window_and_no_other_may() {
        for panel in PANEL_IDS {
            let id = WindowId::Panel {
                panel: panel.into(),
                n: 1,
            };
            assert!(id.is_openable(), "{panel}");
            assert_eq!(WindowId::parse(&id.label()), Some(id));
        }
        for panel in ["game-view", "scripts", "", "Script"] {
            let id = WindowId::Panel {
                panel: panel.into(),
                n: 1,
            };
            assert!(!id.is_openable(), "{panel:?}");
        }
        assert!(WindowId::Preferences.is_openable() && WindowId::Main { n: 2 }.is_openable());
    }

    #[test]
    fn a_window_id_crosses_the_boundary_as_a_tagged_object() {
        let json = serde_json::to_string(&WindowId::Panel {
            panel: "script".into(),
            n: 1,
        })
        .unwrap();
        assert_eq!(json, r#"{"kind":"panel","panel":"script","n":1}"#);
        let back: WindowId = serde_json::from_str(r#"{"kind":"preferences"}"#).unwrap();
        assert_eq!(back, WindowId::Preferences);
    }
}
