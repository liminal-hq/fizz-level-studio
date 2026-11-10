// Tests for the toolbar settings: their defaults, the version 8 migration, patches and the shipped file
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_protocol::{Settings, SettingsPatch, ToolbarMode, UiSettings};
use fizz_studio_settings::{
    apply_patch, migrate, MemoryStorage, SettingsFile, MIGRATIONS, SETTINGS_FILE, SETTINGS_VERSION,
};
use serde_json::{json, Value};

const V7: &str = include_str!("fixtures/v7.json");

fn memory_file(text: &str) -> SettingsFile<MemoryStorage> {
    let storage = MemoryStorage::default();
    storage.put(SETTINGS_FILE, text);
    SettingsFile::new(storage)
}

#[test]
fn the_classic_toolbar_is_the_default_with_the_ribbon_open() {
    let ui = UiSettings::default();
    assert_eq!(ui.toolbar, ToolbarMode::Classic);
    assert!(!ui.ribbon_folded);
    assert!(!ui.menu_bar);
    assert_eq!(Settings::default().ui, ui);
}

#[test]
fn the_toolbar_is_written_in_lower_case() {
    for (mode, word) in [
        (ToolbarMode::Classic, "classic"),
        (ToolbarMode::Ribbon, "ribbon"),
        (ToolbarMode::Hidden, "hidden"),
    ] {
        assert_eq!(serde_json::to_value(mode).unwrap(), json!(word));
        assert_eq!(
            serde_json::from_value::<ToolbarMode>(json!(word)).unwrap(),
            mode
        );
    }
}

#[test]
fn a_version_seven_file_loads_with_the_classic_toolbar_and_keeps_its_values() {
    let report = memory_file(V7).load();
    assert_eq!(report.problem, None);
    let settings = report.settings;
    assert_eq!(settings.ui.toolbar, ToolbarMode::Classic);
    assert!(!settings.ui.ribbon_folded);
    // What version 7 had is carried over untouched.
    assert!(settings.ui.menu_bar);
    assert_eq!(settings.locale, "en-CA");
    assert_eq!(settings.recent_worlds, ["/worlds/a.fizz"]);
    assert_eq!(settings.transparency.blur, 30);
}

#[test]
fn the_step_writes_the_two_values_and_keeps_ones_already_there() {
    let body: Value = serde_json::from_str::<Value>(V7).unwrap()["settings"].clone();
    let migrated = migrate(body.clone(), 7, SETTINGS_VERSION, MIGRATIONS).unwrap();
    assert_eq!(migrated["ui"]["toolbar"], "classic");
    assert_eq!(migrated["ui"]["ribbon_folded"], false);
    assert_eq!(migrated["ui"]["menu_bar"], true);
    let mut kept = body;
    kept["ui"] = json!({ "menu_bar": false, "toolbar": "ribbon", "ribbon_folded": true });
    let migrated = migrate(kept, 7, SETTINGS_VERSION, MIGRATIONS).unwrap();
    assert_eq!(migrated["ui"]["toolbar"], "ribbon");
    assert_eq!(migrated["ui"]["ribbon_folded"], true);
}

#[test]
fn a_file_with_no_ui_takes_the_whole_default() {
    let migrated = migrate(json!({}), 7, SETTINGS_VERSION, MIGRATIONS).unwrap();
    let settings: Settings = serde_json::from_value(migrated).unwrap();
    assert_eq!(settings.ui, UiSettings::default());
}

#[test]
fn an_older_file_passes_through_every_step_to_the_classic_toolbar() {
    let report =
        memory_file(r#"{ "version": 4, "settings": { "ui": { "menu_bar": true } } }"#).load();
    assert_eq!(report.problem, None);
    assert!(report.settings.ui.menu_bar);
    assert_eq!(report.settings.ui.toolbar, ToolbarMode::Classic);
}

#[test]
fn a_partial_ui_group_takes_the_defaults_for_what_it_lacks() {
    let settings: Settings =
        serde_json::from_value(json!({ "ui": { "toolbar": "hidden" } })).unwrap();
    assert_eq!(settings.ui.toolbar, ToolbarMode::Hidden);
    assert!(!settings.ui.menu_bar);
    assert!(!settings.ui.ribbon_folded);
}

#[test]
fn a_patch_sets_the_toolbar_and_the_fold_and_they_survive_a_save_and_load() {
    let patch = SettingsPatch {
        ui: Some(UiSettings {
            menu_bar: false,
            toolbar: ToolbarMode::Ribbon,
            ribbon_folded: true,
        }),
        ..SettingsPatch::default()
    };
    let next = apply_patch(&Settings::default(), &patch).unwrap();
    assert_eq!(next.ui.toolbar, ToolbarMode::Ribbon);
    assert!(next.ui.ribbon_folded);
    let file = SettingsFile::new(MemoryStorage::default());
    file.save(&next).unwrap();
    let saved: Value = serde_json::from_str(&file.storage().get(SETTINGS_FILE).unwrap()).unwrap();
    assert_eq!(saved["version"], 8);
    assert_eq!(saved["settings"]["ui"]["toolbar"], "ribbon");
    assert!(file.load().settings.ui.ribbon_folded);
}

#[test]
fn a_toolbar_the_build_does_not_know_is_not_taken() {
    let bad = serde_json::from_value::<Settings>(json!({ "ui": { "toolbar": "floating" } }));
    assert!(bad.is_err());
}
