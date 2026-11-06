// Tests for the transparency settings: their defaults, the version 7 migration, ranges and patches
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_protocol::{
    AccentChoice, ColourMode, GlassMode, Settings, SettingsError, SettingsField, SettingsPatch,
    TransparencySettings, WindowBlur,
};
use fizz_studio_settings::{
    apply_patch, migrate, MemoryStorage, SettingsFile, MIGRATIONS, SETTINGS_FILE, SETTINGS_VERSION,
};
use serde_json::Value;

const V6: &str = include_str!("fixtures/v6.json");
const DEFAULTS: &str =
    include_str!("../../../packages/protocol/fixtures/default-transparency.json");

fn memory_file(text: Option<&str>) -> SettingsFile<MemoryStorage> {
    let storage = MemoryStorage::default();
    if let Some(text) = text {
        storage.put(SETTINGS_FILE, text);
    }
    SettingsFile::new(storage)
}

fn with(change: impl FnOnce(&mut TransparencySettings)) -> SettingsPatch {
    let mut transparency = TransparencySettings::default();
    change(&mut transparency);
    SettingsPatch {
        transparency: Some(transparency),
        ..SettingsPatch::default()
    }
}

fn refused_field(patch: &SettingsPatch) -> Option<SettingsField> {
    match apply_patch(&Settings::default(), patch) {
        Err(SettingsError::InvalidField { field, .. }) => Some(field),
        _ => None,
    }
}

#[test]
fn the_document_is_version_seven() {
    assert_eq!(SETTINGS_VERSION, 7);
}

#[test]
fn the_defaults_are_the_shared_fixture() {
    let fixture: TransparencySettings = serde_json::from_str(DEFAULTS).unwrap();
    assert_eq!(fixture, TransparencySettings::default());
    assert_eq!(Settings::default().transparency, fixture);
    let t = TransparencySettings::default();
    assert_eq!(
        (t.blur, t.saturation, t.panel_opacity, t.menu_opacity),
        (16, 120, 88, 96)
    );
    assert!(t.docks && t.floating && !t.menus && !t.dialogs && !t.title_bar);
    assert!(!t.window_enabled && t.solid_when_unfocused);
    assert_eq!(t.window_blur, WindowBlur::Low);
}

#[test]
fn a_version_six_file_migrates_with_the_defaults_and_keeps_its_values() {
    let report = memory_file(Some(V6)).load();
    assert_eq!(report.problem, None);
    let settings = report.settings;
    assert_eq!(settings.transparency, TransparencySettings::default());
    assert_eq!(settings.colour_mode, ColourMode::Dark);
    assert_eq!(
        settings.accent,
        AccentChoice::Custom {
            hex: "#ffaa40".to_owned()
        }
    );
    assert_eq!(settings.glass, GlassMode::Off);
    assert!(settings.larger_controls);
    assert!(settings.ui.menu_bar);
    assert_eq!(settings.locale, "fr-CA");
    assert_eq!(settings.recent_worlds, ["/worlds/b.fizz", "/worlds/a.fizz"]);
}

#[test]
fn the_step_writes_the_group_in_full_and_keeps_one_already_there() {
    let body: Value = serde_json::from_str::<Value>(V6).unwrap()["settings"].clone();
    let migrated = migrate(body.clone(), 6, SETTINGS_VERSION, MIGRATIONS).unwrap();
    assert_eq!(
        migrated["transparency"],
        serde_json::from_str::<Value>(DEFAULTS).unwrap()
    );
    assert_eq!(migrated["glass"], "off");
    let mut kept = body;
    kept["transparency"] = serde_json::json!({ "blur": 30, "menus": true });
    let migrated = migrate(kept, 6, SETTINGS_VERSION, MIGRATIONS).unwrap();
    assert_eq!(migrated["transparency"]["blur"], 30);
    let settings: Settings = serde_json::from_value(migrated).unwrap();
    // A partial group takes the defaults for what it lacks.
    assert_eq!(settings.transparency.blur, 30);
    assert!(settings.transparency.menus);
    assert_eq!(settings.transparency.saturation, 120);
}

#[test]
fn an_older_file_passes_through_every_step_to_the_defaults() {
    let report = memory_file(Some(r#"{ "version": 1, "settings": {} }"#)).load();
    assert_eq!(report.problem, None);
    assert_eq!(
        report.settings.transparency,
        TransparencySettings::default()
    );
}

#[test]
fn values_outside_their_range_are_refused_and_name_their_field() {
    use SettingsField::*;
    assert_eq!(
        refused_field(&with(|t| t.blur = 41)),
        Some(TransparencyBlur)
    );
    assert_eq!(
        refused_field(&with(|t| t.saturation = 99)),
        Some(TransparencySaturation)
    );
    assert_eq!(
        refused_field(&with(|t| t.saturation = 201)),
        Some(TransparencySaturation)
    );
    assert_eq!(
        refused_field(&with(|t| t.panel_opacity = 39)),
        Some(TransparencyPanelOpacity)
    );
    assert_eq!(
        refused_field(&with(|t| t.panel_opacity = 101)),
        Some(TransparencyPanelOpacity)
    );
    assert_eq!(
        refused_field(&with(|t| t.menu_opacity = 59)),
        Some(TransparencyMenuOpacity)
    );
    assert_eq!(
        refused_field(&with(|t| t.menu_opacity = 101)),
        Some(TransparencyMenuOpacity)
    );
}

#[test]
fn the_ends_of_each_range_are_accepted() {
    for patch in [
        with(|t| t.blur = 0),
        with(|t| t.blur = 40),
        with(|t| t.saturation = 100),
        with(|t| t.saturation = 200),
        with(|t| t.panel_opacity = 40),
        with(|t| t.panel_opacity = 100),
        with(|t| t.menu_opacity = 60),
        with(|t| t.menu_opacity = 100),
    ] {
        assert!(
            apply_patch(&Settings::default(), &patch).is_ok(),
            "{patch:?}"
        );
    }
}

#[test]
fn a_patch_replaces_the_group_and_leaves_the_rest_alone() {
    let patch = with(|t| {
        t.blur = 24;
        t.menus = true;
        t.window_enabled = true;
        t.window_blur = WindowBlur::High;
        t.solid_when_unfocused = false;
    });
    let next = apply_patch(&Settings::default(), &patch).unwrap();
    assert_eq!(next.transparency.blur, 24);
    assert!(next.transparency.menus && next.transparency.window_enabled);
    assert_eq!(next.transparency.window_blur, WindowBlur::High);
    assert_eq!(next.glass, GlassMode::System);
    // A patch that names nothing keeps it.
    let same = apply_patch(&next, &SettingsPatch::default()).unwrap();
    assert_eq!(same.transparency, next.transparency);
}

#[test]
fn the_group_survives_a_save_and_load() {
    let file = memory_file(None);
    let next = apply_patch(
        &Settings::default(),
        &with(|t| {
            t.saturation = 180;
            t.dialogs = true;
            t.window_blur = WindowBlur::Off;
        }),
    )
    .unwrap();
    file.save(&next).unwrap();
    let saved: Value = serde_json::from_str(&file.storage().get(SETTINGS_FILE).unwrap()).unwrap();
    assert_eq!(saved["version"], 7);
    assert_eq!(saved["settings"]["transparency"]["saturation"], 180);
    assert_eq!(saved["settings"]["transparency"]["window_blur"], "off");
    assert_eq!(file.load().settings, next);
}

#[test]
fn a_file_with_a_value_out_of_range_is_set_aside() {
    let file = memory_file(Some(
        r#"{ "version": 7, "settings": { "transparency": { "blur": 90 } } }"#,
    ));
    assert!(file.load().set_aside.is_some());
}
