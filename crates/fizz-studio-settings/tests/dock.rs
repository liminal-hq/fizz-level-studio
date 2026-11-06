// Tests for the dock in the settings document: defaults, the shared fixture, rules, migration
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_protocol::{
    DockSettings, PlaceKind, Settings, SettingsError, SettingsField, SettingsPatch, TabGroup,
    ToolPickerPlacement, WindowPlacement, Workspace, ZoneId,
};
use fizz_studio_settings::{
    apply_patch, default_dock, default_layout, default_workspace, default_workspace_for,
    resolve_dock, validate, BlobStorage, MemoryStorage, SettingsFile, BOTTOM_MIN, MAIN_KIND,
    PANEL_IDS, SETTINGS_FILE, SETTINGS_VERSION, SIDE_MIN,
};
use serde_json::{json, Value};

/// The file the frontend's defaults are read from; these tests hold the Rust ones to it.
const FIXTURE: &str = include_str!("../../../packages/protocol/fixtures/default-dock.json");

fn fixture() -> Value {
    serde_json::from_str(FIXTURE).expect("the fixture is JSON")
}

fn field_of(result: Result<(), SettingsError>) -> SettingsField {
    match result.expect_err("expected a refusal") {
        SettingsError::InvalidField { field, .. } => field,
        other => panic!("expected a field error, got {other:?}"),
    }
}

fn with_workspace(edit: impl FnOnce(&mut Workspace)) -> Settings {
    let mut settings = Settings {
        dock: default_dock(),
        ..Settings::default()
    };
    edit(settings.dock.workspaces.get_mut("Paint").unwrap());
    settings
}

fn memory_file(text: &str) -> SettingsFile<MemoryStorage> {
    let storage = MemoryStorage::default();
    storage.put(SETTINGS_FILE, text);
    SettingsFile::new(storage)
}

// The shared fixture

#[test]
fn the_default_workspaces_match_the_fixture_the_frontend_reads() {
    let fixture = fixture();
    let default: Workspace = serde_json::from_value(fixture["default"].clone()).unwrap();
    assert_eq!(default_workspace(), default);
    let dock = default_dock();
    assert_eq!(dock.active, fixture["active"].as_str().unwrap());
    let expected: std::collections::BTreeMap<String, Workspace> =
        serde_json::from_value(fixture["workspaces"].clone()).unwrap();
    assert_eq!(dock.workspaces, expected);
}

#[test]
fn the_limits_match_the_fixture() {
    let limits = &fixture()["limits"];
    assert_eq!(limits["side_min"], SIDE_MIN);
    assert_eq!(limits["bottom_min"], BOTTOM_MIN);
}

#[test]
fn the_floating_defaults_are_the_fixtures_rectangles() {
    let default: Workspace = serde_json::from_value(fixture()["default"].clone()).unwrap();
    let floats = default_layout(MAIN_KIND).panels;
    assert_eq!(floats.len(), PANEL_IDS.len());
    for (id, entry) in &default.panels {
        assert_eq!(floats[id], entry.float, "the {id} panel");
    }
}

// The defaults

#[test]
fn every_panel_is_in_exactly_one_place_in_every_default_workspace() {
    let mut all = default_dock().workspaces;
    all.insert("(default)".to_owned(), default_workspace());
    for (name, workspace) in &all {
        let docked: Vec<&str> = workspace
            .zones
            .all()
            .iter()
            .flat_map(|(_, z)| {
                z.groups
                    .iter()
                    .flat_map(|g| g.tabs.iter().map(String::as_str))
            })
            .collect();
        let mut sorted = docked.clone();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(sorted.len(), docked.len(), "{name} doubles a panel");
        assert_eq!(docked.len(), PANEL_IDS.len(), "{name} loses a panel");
        for id in PANEL_IDS {
            assert!(workspace.panels.contains_key(id), "{name} lacks {id}");
        }
    }
}

#[test]
fn the_default_arrangement_is_palette_left_objects_and_history_right_script_and_proposals_below() {
    let ws = default_workspace();
    let tabs = |zone: ZoneId| -> Vec<String> {
        ws.zones
            .get(zone)
            .groups
            .iter()
            .flat_map(|g| g.tabs.clone())
            .collect()
    };
    assert_eq!(tabs(ZoneId::Left), ["palette"]);
    assert_eq!(tabs(ZoneId::Right), ["objects", "history"]);
    assert_eq!(tabs(ZoneId::Bottom), ["script", "proposals"]);
    assert_eq!(
        [
            ws.zones.left.size,
            ws.zones.right.size,
            ws.zones.bottom.size
        ],
        [196, 264, 180]
    );
}

#[test]
fn the_workspaces_vary_the_default_as_designed() {
    let paint = default_workspace_for("Paint");
    assert!(
        !paint.zones.left.collapsed
            && !paint.zones.right.collapsed
            && !paint.zones.bottom.collapsed
    );
    assert_eq!(paint, default_workspace());
    let script = default_workspace_for("Script");
    assert!(script.zones.bottom.size > default_workspace().zones.bottom.size);
    assert_eq!(script.zones.bottom.groups[0].active, "script");
    let review = default_workspace_for("Review");
    assert!(review.zones.right.size > default_workspace().zones.right.size);
    assert_eq!(review.zones.right.groups[0].active, "proposals");
    assert_eq!(default_workspace_for("Anything else"), default_workspace());
    assert_eq!(default_dock().active, "Paint");
}

#[test]
fn a_fresh_document_has_no_saved_dock_and_resolves_to_the_defaults() {
    let settings = Settings::default();
    assert!(settings.dock.workspaces.is_empty());
    assert_eq!(resolve_dock(&settings), default_dock());
    assert!(validate(&settings).is_ok());
    let saved = Settings {
        dock: DockSettings {
            active: "Paint".to_owned(),
            workspaces: [("Paint".to_owned(), default_workspace())].into(),
        },
        ..Settings::default()
    };
    assert_eq!(resolve_dock(&saved), saved.dock);
}

#[test]
fn the_defaults_are_valid() {
    let settings = Settings {
        dock: default_dock(),
        ..Settings::default()
    };
    assert!(validate(&settings).is_ok());
}

// Validation

#[test]
fn a_panel_the_editor_does_not_have_is_refused() {
    let settings = with_workspace(|ws| {
        let entry = ws.panels["palette"].clone();
        ws.panels.insert("ghost".to_owned(), entry);
    });
    assert_eq!(field_of(validate(&settings)), SettingsField::WorkspacePanel);
}

#[test]
fn a_missing_panel_is_refused() {
    let settings = with_workspace(|ws| {
        ws.panels.remove("script");
    });
    assert_eq!(field_of(validate(&settings)), SettingsField::WorkspacePanel);
}

#[test]
fn a_doubled_panel_is_refused() {
    let settings = with_workspace(|ws| {
        ws.zones.left.groups[0].tabs.push("objects".to_owned());
    });
    assert_eq!(field_of(validate(&settings)), SettingsField::WorkspacePanel);
}

#[test]
fn a_docked_panel_in_no_group_and_a_grouped_panel_that_is_not_docked_are_refused() {
    let lost = with_workspace(|ws| ws.zones.left.groups.clear());
    assert_eq!(field_of(validate(&lost)), SettingsField::WorkspacePanel);
    let floating =
        with_workspace(|ws| ws.panels.get_mut("palette").unwrap().place = PlaceKind::Floating);
    assert_eq!(field_of(validate(&floating)), SettingsField::WorkspacePanel);
}

#[test]
fn an_empty_group_or_a_showing_tab_it_does_not_hold_is_refused() {
    let empty = with_workspace(|ws| {
        ws.zones.left.groups.push(TabGroup {
            tabs: vec![],
            active: String::new(),
        });
    });
    assert_eq!(field_of(validate(&empty)), SettingsField::WorkspaceTabs);
    let wrong = with_workspace(|ws| ws.zones.right.groups[0].active = "palette".to_owned());
    assert_eq!(field_of(validate(&wrong)), SettingsField::WorkspaceTabs);
}

#[test]
fn zone_sizes_out_of_range_are_refused() {
    for size in [0, SIDE_MIN - 1, 4_001, -5] {
        let settings = with_workspace(|ws| ws.zones.left.size = size);
        assert_eq!(
            field_of(validate(&settings)),
            SettingsField::ZoneSize,
            "{size}"
        );
    }
    let short = with_workspace(|ws| ws.zones.bottom.size = BOTTOM_MIN - 1);
    assert_eq!(field_of(validate(&short)), SettingsField::ZoneSize);
    let edge = with_workspace(|ws| {
        ws.zones.bottom.size = BOTTOM_MIN;
        ws.zones.left.size = 4_000;
    });
    assert!(validate(&edge).is_ok());
}

#[test]
fn rectangles_that_are_not_on_a_screen_are_refused() {
    let float = with_workspace(|ws| ws.panels.get_mut("palette").unwrap().float.w = 0);
    assert_eq!(field_of(validate(&float)), SettingsField::WorkspaceRect);
    let window = with_workspace(|ws| {
        ws.panels.get_mut("palette").unwrap().window = Some(WindowPlacement {
            x: 0,
            y: 0,
            w: 0,
            h: 10,
        });
    });
    assert_eq!(field_of(validate(&window)), SettingsField::WorkspaceRect);
    let none = with_workspace(|ws| {
        ws.zones.left.groups.clear();
        ws.panels.get_mut("palette").unwrap().place = PlaceKind::Window;
    });
    assert_eq!(field_of(validate(&none)), SettingsField::WorkspaceRect);
}

#[test]
fn a_tool_picker_off_the_map_is_refused_and_one_on_it_is_accepted() {
    let off = with_workspace(|ws| ws.tool_picker = Some(ToolPickerPlacement { x: -1, y: 4 }));
    assert_eq!(field_of(validate(&off)), SettingsField::WorkspaceRect);
    let far = with_workspace(|ws| ws.tool_picker = Some(ToolPickerPlacement { x: 4, y: 20_001 }));
    assert_eq!(field_of(validate(&far)), SettingsField::WorkspaceRect);
    let on = with_workspace(|ws| ws.tool_picker = Some(ToolPickerPlacement { x: 300, y: 40 }));
    assert!(validate(&on).is_ok());
}

#[test]
fn a_window_on_a_screen_to_the_left_is_accepted() {
    let settings = with_workspace(|ws| {
        ws.zones.left.groups.clear();
        let entry = ws.panels.get_mut("palette").unwrap();
        entry.place = PlaceKind::Window;
        entry.window = Some(WindowPlacement {
            x: -1920,
            y: -40,
            w: 400,
            h: 500,
        });
    });
    assert!(validate(&settings).is_ok());
}

#[test]
fn a_window_that_returns_to_a_window_is_refused() {
    let settings =
        with_workspace(|ws| ws.panels.get_mut("palette").unwrap().window_from = PlaceKind::Window);
    assert_eq!(field_of(validate(&settings)), SettingsField::WorkspacePanel);
}

#[test]
fn workspace_names_and_the_active_one_are_checked() {
    let mut empty = Settings {
        dock: default_dock(),
        ..Settings::default()
    };
    let ws = empty.dock.workspaces["Paint"].clone();
    empty.dock.workspaces.insert("  ".to_owned(), ws.clone());
    assert_eq!(field_of(validate(&empty)), SettingsField::WorkspaceName);

    let mut long = Settings {
        dock: default_dock(),
        ..Settings::default()
    };
    long.dock.workspaces.insert("x".repeat(65), ws);
    assert_eq!(field_of(validate(&long)), SettingsField::WorkspaceName);

    let mut gone = Settings {
        dock: default_dock(),
        ..Settings::default()
    };
    gone.dock.active = "Nope".to_owned();
    assert_eq!(field_of(validate(&gone)), SettingsField::WorkspaceName);

    let named_but_none = Settings {
        dock: DockSettings {
            active: "Paint".to_owned(),
            ..DockSettings::default()
        },
        ..Settings::default()
    };
    assert_eq!(
        field_of(validate(&named_but_none)),
        SettingsField::WorkspaceName
    );
}

#[test]
fn a_patch_replaces_the_dock_or_is_refused_and_changes_nothing() {
    let settings = Settings::default();
    let patch = SettingsPatch {
        dock: Some(default_dock()),
        ..SettingsPatch::default()
    };
    assert_eq!(apply_patch(&settings, &patch).unwrap().dock, default_dock());

    let mut bad = default_dock();
    bad.workspaces
        .get_mut("Paint")
        .unwrap()
        .panels
        .remove("palette");
    let refused = SettingsPatch {
        dock: Some(bad),
        ..SettingsPatch::default()
    };
    assert!(apply_patch(&settings, &refused).is_err());
    assert!(settings.dock.workspaces.is_empty());
}

// Round trip and migration

#[test]
fn a_dock_round_trips_through_the_file() {
    let file = SettingsFile::new(MemoryStorage::default());
    let mut settings = Settings {
        dock: default_dock(),
        ..Settings::default()
    };
    let moved = settings.dock.workspaces.get_mut("Review").unwrap();
    moved.panels.get_mut("script").unwrap().window = Some(WindowPlacement {
        x: 2000,
        y: 30,
        w: 700,
        h: 500,
    });
    moved.tool_picker = Some(ToolPickerPlacement { x: 420, y: 96 });
    settings.dock.active = "Review".to_owned();
    file.save(&settings).unwrap();
    let report = file.load();
    assert!(report.problem.is_none(), "{:?}", report.problem);
    assert_eq!(report.settings, settings);
    let text = file.storage().read(SETTINGS_FILE).unwrap().unwrap();
    assert_eq!(
        serde_json::from_str::<Value>(&text).unwrap()["version"],
        SETTINGS_VERSION
    );
}

#[test]
fn a_version_three_file_with_no_saved_layout_gets_an_empty_dock_meaning_the_defaults() {
    let file = memory_file(r#"{ "version": 3, "settings": { "locale": "fr-CA" } }"#);
    let report = file.load();
    assert!(report.problem.is_none(), "{:?}", report.problem);
    assert_eq!(report.settings.locale, "fr-CA");
    assert!(report.settings.dock.workspaces.is_empty());
    assert_eq!(resolve_dock(&report.settings), default_dock());
}

#[test]
fn a_version_three_file_keeps_the_owners_floating_rectangles_as_each_panels_floating_place() {
    let text = json!({
        "version": 3,
        "settings": {
            "layout": { "main": { "panels": {
                "palette": { "x": 500, "y": 40, "w": 300, "h": 240, "collapsed": false, "visible": true, "z": 9 }
            } } }
        }
    })
    .to_string();
    let report = memory_file(&text).load();
    assert!(report.problem.is_none(), "{:?}", report.problem);
    let dock = &report.settings.dock;
    assert_eq!(dock.active, "Paint");
    for ws in dock.workspaces.values() {
        let palette = &ws.panels["palette"];
        assert_eq!(palette.place, PlaceKind::Docked);
        assert_eq!(
            (palette.float.x, palette.float.y, palette.float.z),
            (500, 40, 9)
        );
        // Panels the owner never moved keep the default rectangle, and none is lost.
        assert_eq!(
            ws.panels["script"].float,
            default_layout(MAIN_KIND).panels["script"]
        );
        assert_eq!(ws.panels.len(), PANEL_IDS.len());
    }
    // The old floating layout stays for the floating panels that still read it.
    assert!(report.settings.layout.contains_key(MAIN_KIND));
    assert!(validate(&report.settings).is_ok());
}

#[test]
fn a_version_three_file_that_already_has_a_dock_keeps_it() {
    let mut dock = default_dock();
    dock.active = "Script".to_owned();
    let text = json!({ "version": 3, "settings": { "dock": dock } }).to_string();
    assert_eq!(memory_file(&text).load().settings.dock.active, "Script");
}

#[test]
fn a_version_five_file_gives_every_workspace_an_unset_tool_picker() {
    let mut dock = serde_json::to_value(default_dock()).unwrap();
    for workspace in dock["workspaces"].as_object_mut().unwrap().values_mut() {
        workspace.as_object_mut().unwrap().remove("tool_picker");
    }
    let migrated = fizz_studio_settings::migrate(
        json!({ "dock": dock.clone() }),
        5,
        SETTINGS_VERSION,
        fizz_studio_settings::MIGRATIONS,
    )
    .unwrap();
    for workspace in migrated["dock"]["workspaces"].as_object().unwrap().values() {
        assert_eq!(workspace["tool_picker"], Value::Null);
    }
    let text = json!({ "version": 5, "settings": { "dock": dock } }).to_string();
    let report = memory_file(&text).load();
    assert!(report.problem.is_none(), "{:?}", report.problem);
    assert_eq!(report.settings.dock, default_dock());
}

#[test]
fn a_version_five_file_keeps_a_tool_picker_place_already_there() {
    let mut dock = serde_json::to_value(default_dock()).unwrap();
    dock["workspaces"]["Paint"]["tool_picker"] = json!({ "x": 50, "y": 60 });
    let text = json!({ "version": 5, "settings": { "dock": dock } }).to_string();
    let report = memory_file(&text).load();
    assert!(report.problem.is_none(), "{:?}", report.problem);
    assert_eq!(
        report.settings.dock.workspaces["Paint"].tool_picker,
        Some(ToolPickerPlacement { x: 50, y: 60 })
    );
}

#[test]
fn a_file_with_a_broken_dock_is_set_aside_not_half_loaded() {
    let mut dock = default_dock();
    dock.workspaces
        .get_mut("Paint")
        .unwrap()
        .panels
        .remove("palette");
    let text = json!({ "version": 4, "settings": { "dock": dock } }).to_string();
    let file = memory_file(&text);
    let report = file.load();
    assert!(report.problem.is_some());
    assert_eq!(
        report.set_aside.as_deref(),
        Some("settings.json.unreadable-1")
    );
    assert!(report.settings.dock.workspaces.is_empty());
}
