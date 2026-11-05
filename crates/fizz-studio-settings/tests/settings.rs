// Tests for the settings document, its files, the recent list and the store's revisions
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::collections::BTreeMap;
use std::sync::Arc;

use fizz_studio_protocol::{
    AccentChoice, ColourMode, GlassMode, PanelLayout, PanelPlacement, Settings, SettingsError,
    SettingsField, SettingsPatch, UiSettings, RECENT_WORLDS_CAP,
};
use fizz_studio_settings::{
    apply_patch, default_layout, resolve_layout, touch_recent, BlobStorage, DiskStorage,
    MemoryStorage, Migration, SettingsFile, SettingsStore, SETTINGS_FILE, SETTINGS_VERSION,
};
use serde_json::{json, Value};

fn placement(x: i32) -> PanelPlacement {
    PanelPlacement {
        x,
        y: 4,
        w: 300,
        h: 200,
        collapsed: false,
        visible: true,
        z: 1,
    }
}

fn layout_of(id: &str, x: i32) -> PanelLayout {
    PanelLayout {
        panels: BTreeMap::from([(id.to_owned(), placement(x))]),
    }
}

fn memory_file(text: Option<&str>) -> SettingsFile<MemoryStorage> {
    let storage = MemoryStorage::default();
    if let Some(text) = text {
        storage.put(SETTINGS_FILE, text);
    }
    SettingsFile::new(storage)
}

fn dark() -> SettingsPatch {
    SettingsPatch {
        colour_mode: Some(ColourMode::Dark),
        ..SettingsPatch::default()
    }
}

#[test]
fn the_defaults_are_system_colour_normal_controls_en_ca_and_nothing_recent() {
    let settings = Settings::default();
    assert_eq!(settings.colour_mode, ColourMode::System);
    assert!(!settings.larger_controls);
    assert_eq!(settings.locale, "en-CA");
    assert!(settings.recent_worlds.is_empty());
    assert!(settings.layout.is_empty());
    let report = memory_file(None).load();
    assert_eq!(report.settings, settings);
    assert_eq!(report.set_aside, None);
}

#[test]
fn a_file_missing_fields_loads_with_the_defaults_for_them() {
    let file = memory_file(Some(
        r#"{ "version": 1, "settings": { "colour_mode": "dark" } }"#,
    ));
    let report = file.load();
    assert_eq!(report.settings.colour_mode, ColourMode::Dark);
    assert_eq!(report.settings.locale, "en-CA");
    assert_eq!(report.problem, None);
}

fn dark_mode_to_colour_mode(mut settings: Value) -> Result<Value, String> {
    let object = settings
        .as_object_mut()
        .ok_or("settings is not an object")?;
    if object.remove("dark_mode") == Some(Value::Bool(true)) {
        object.insert("colour_mode".to_owned(), json!("dark"));
    }
    if let Some(recent) = object.remove("recent") {
        object.insert("recent_worlds".to_owned(), recent);
    }
    Ok(settings)
}

static TEST_STEPS: &[Migration] = &[Migration {
    from: 0,
    apply: dark_mode_to_colour_mode,
}];

#[test]
fn an_older_file_is_migrated_step_by_step() {
    let fixture = include_str!("fixtures/v0.json");
    let file = SettingsFile::with_migrations(MemoryStorage::default(), 1, TEST_STEPS);
    let settings = file.parse(fixture).expect("the v0 fixture migrates");
    assert_eq!(settings.colour_mode, ColourMode::Dark);
    assert_eq!(settings.recent_worlds, ["/worlds/b", "/worlds/a"]);
    assert_eq!(settings.locale, "fr-CA");
    // Saving writes the current version, so the next load needs no migration.
    file.save(&settings).unwrap();
    let saved: Value = serde_json::from_str(&file.storage().get(SETTINGS_FILE).unwrap()).unwrap();
    assert_eq!(saved["version"], 1);
}

#[test]
fn a_version_one_file_with_string_layouts_migrates_to_typed_ones() {
    let layout = serde_json::to_string(&layout_of("script", 40)).unwrap();
    let text = json!({
        "version": 1,
        "settings": {
            "colour_mode": "dark",
            "layout": { "main": layout, "about": "{ not json", "odd": 7 }
        }
    })
    .to_string();
    let report = memory_file(Some(&text)).load();
    assert_eq!(report.problem, None);
    assert_eq!(report.settings.colour_mode, ColourMode::Dark);
    assert_eq!(report.settings.layout.len(), 1);
    assert_eq!(report.settings.layout["main"], layout_of("script", 40));
}

#[test]
fn a_version_one_file_without_layouts_migrates_untouched() {
    let report = memory_file(Some(
        r#"{ "version": 1, "settings": { "locale": "fr-CA" } }"#,
    ))
    .load();
    assert_eq!(report.problem, None);
    assert_eq!(report.settings.locale, "fr-CA");
}

#[test]
fn a_version_with_no_step_is_unreadable_not_guessed() {
    let file = memory_file(Some(r#"{ "version": 0, "settings": {} }"#));
    assert_eq!(SETTINGS_VERSION, 5);
    let report = file.load();
    assert!(report
        .problem
        .unwrap()
        .contains("no migration from version 0"));
    assert_eq!(
        report.set_aside.as_deref(),
        Some("settings.json.unreadable-1")
    );
}

#[test]
fn a_save_keeps_the_previous_generation() {
    let file = memory_file(None);
    let first = Settings {
        larger_controls: true,
        ..Settings::default()
    };
    file.save(&first).unwrap();
    assert!(file.storage().get("settings.json.prev").is_none());
    let mut second = first.clone();
    second.locale = "fr-CA".to_owned();
    file.save(&second).unwrap();
    let prev = file.parse(&file.storage().get("settings.json.prev").unwrap());
    assert_eq!(prev.unwrap(), first);
    assert_eq!(
        file.parse(&file.storage().get(SETTINGS_FILE).unwrap())
            .unwrap(),
        second
    );
}

#[test]
fn an_unreadable_file_is_set_aside_and_never_overwritten() {
    let file = memory_file(Some("{ not json"));
    let report = file.load();
    assert_eq!(report.settings, Settings::default());
    assert_eq!(
        report.set_aside.as_deref(),
        Some("settings.json.unreadable-1")
    );
    let storage = file.storage();
    assert_eq!(
        storage.get("settings.json.unreadable-1").unwrap(),
        "{ not json"
    );
    assert!(storage.get(SETTINGS_FILE).is_none());

    // A second bad file gets the next number rather than replacing the first.
    storage.put(SETTINGS_FILE, "also bad");
    let report = file.load();
    assert_eq!(
        report.set_aside.as_deref(),
        Some("settings.json.unreadable-2")
    );
    assert_eq!(
        storage.get("settings.json.unreadable-1").unwrap(),
        "{ not json"
    );
}

#[test]
fn a_file_from_a_newer_build_or_with_a_bad_value_is_set_aside() {
    for text in [
        r#"{ "version": 9, "settings": {} }"#,
        r#"{ "version": 1, "settings": { "locale": "" } }"#,
        r#"{ "version": 1, "settings": { "colour_mode": "mauve" } }"#,
        r#"{ "settings": {} }"#,
    ] {
        let file = memory_file(Some(text));
        let report = file.load();
        assert!(report.set_aside.is_some(), "{text}");
        assert_eq!(
            file.storage().get("settings.json.unreadable-1").unwrap(),
            text
        );
    }
}

#[test]
fn when_a_bad_file_cannot_be_set_aside_it_is_not_overwritten_by_a_save() {
    let storage = MemoryStorage::with(SETTINGS_FILE, "garbage");
    storage.set_failing(true);
    let file = SettingsFile::new(storage);
    let report = file.load();
    assert_eq!(report.set_aside, None);
    assert!(report.problem.is_some());
    file.storage().set_failing(false);
    assert!(file.save(&Settings::default()).is_err());
    assert_eq!(file.storage().get(SETTINGS_FILE).unwrap(), "garbage");
}

#[test]
fn the_disk_storage_writes_atomically_and_sets_files_aside() {
    let dir = tempfile::tempdir().unwrap();
    let file = SettingsFile::new(DiskStorage::new(dir.path().join("config")));
    let mut settings = Settings::default();
    touch_recent(&mut settings, "/worlds/a");
    file.save(&settings).unwrap();
    file.save(&Settings::default()).unwrap();
    assert!(dir.path().join("config/settings.json.prev").is_file());
    assert_eq!(file.load().settings, Settings::default());
    std::fs::write(dir.path().join("config/settings.json"), "nope").unwrap();
    let report = file.load();
    assert_eq!(
        report.set_aside.as_deref(),
        Some("settings.json.unreadable-1")
    );
    assert!(dir
        .path()
        .join("config/settings.json.unreadable-1")
        .is_file());
}

#[test]
fn recent_worlds_are_most_recent_first_without_duplicates_and_capped() {
    let mut settings = Settings::default();
    touch_recent(&mut settings, "/a");
    touch_recent(&mut settings, "/b");
    touch_recent(&mut settings, "/a");
    assert_eq!(settings.recent_worlds, ["/a", "/b"]);
    touch_recent(&mut settings, "");
    assert_eq!(settings.recent_worlds.len(), 2);
    for n in 0..30 {
        touch_recent(&mut settings, &format!("/w{n}"));
    }
    assert_eq!(settings.recent_worlds.len(), RECENT_WORLDS_CAP);
    assert_eq!(RECENT_WORLDS_CAP, 12);
    assert_eq!(settings.recent_worlds[0], "/w29");
    assert_eq!(settings.recent_worlds[11], "/w18");
}

#[test]
fn a_patch_changes_named_fields_and_removes_a_layout_with_null() {
    let mut settings = Settings::default();
    settings
        .layout
        .insert("main".into(), layout_of("script", 1));
    let patch = SettingsPatch {
        locale: Some("fr-CA".into()),
        layout: Some(BTreeMap::from([
            ("main".to_owned(), None),
            ("other".to_owned(), Some(layout_of("palette", 9))),
        ])),
        ..SettingsPatch::default()
    };
    let next = apply_patch(&settings, &patch).unwrap();
    assert_eq!(next.locale, "fr-CA");
    assert!(!next.layout.contains_key("main"));
    assert_eq!(next.layout["other"], layout_of("palette", 9));
}

#[test]
fn bad_patch_values_are_refused() {
    let settings = Settings::default();
    let empty = SettingsPatch {
        locale: Some(" ".into()),
        ..SettingsPatch::default()
    };
    assert!(matches!(
        apply_patch(&settings, &empty),
        Err(SettingsError::Invalid { .. })
    ));
    let bad_layout = SettingsPatch {
        layout: Some(BTreeMap::from([(
            "main".to_owned(),
            Some(PanelLayout {
                panels: BTreeMap::from([(
                    "script".to_owned(),
                    PanelPlacement {
                        w: 0,
                        ..placement(0)
                    },
                )]),
            }),
        )])),
        ..SettingsPatch::default()
    };
    assert!(matches!(
        apply_patch(&settings, &bad_layout),
        Err(SettingsError::Invalid { .. })
    ));
}

#[test]
fn the_revision_rises_by_one_per_change_and_a_quiet_patch_does_not_raise_it() {
    let (store, _) = SettingsStore::open(memory_file(None));
    assert_eq!(store.snapshot().revision, 0);
    let one = store.update(&dark(), 0).unwrap();
    assert_eq!(one.revision, 1);
    let same = store.update(&dark(), 1).unwrap();
    assert_eq!(same.revision, 1);
    let two = store.touch_recent("/a").unwrap();
    assert_eq!(two.revision, 2);
    let three = store.clear_recent().unwrap();
    assert_eq!(three.revision, 3);
    assert_eq!(store.clear_recent().unwrap().revision, 3);
}

#[test]
fn a_stale_update_is_refused_and_changes_nothing() {
    let (store, _) = SettingsStore::open(memory_file(None));
    store.touch_recent("/a").unwrap();
    let refused = store.update(&dark(), 0).unwrap_err();
    assert_eq!(
        refused,
        SettingsError::Stale {
            based_on: 0,
            current: 1
        }
    );
    assert!(refused.to_string().contains("revision 0"));
    assert_eq!(store.snapshot().settings.colour_mode, ColourMode::System);
    // A revision from the future is as wrong as an old one.
    assert!(matches!(
        store.update(&dark(), 5),
        Err(SettingsError::Stale { .. })
    ));
}

#[test]
fn a_failed_save_changes_neither_the_settings_nor_the_revision() {
    let storage = Arc::new(MemoryStorage::default());
    let (store, _) = SettingsStore::open(SettingsFile::new(storage.clone()));
    store.touch_recent("/a").unwrap();
    storage.set_failing(true);
    let refused = store.update(&dark(), 1).unwrap_err();
    assert!(matches!(refused, SettingsError::Storage { .. }));
    assert!(store.touch_recent("/b").is_err());
    let after = store.snapshot();
    assert_eq!(after.revision, 1);
    assert_eq!(after.settings.recent_worlds, ["/a"]);
    assert_eq!(after.settings.colour_mode, ColourMode::System);
    storage.set_failing(false);
    assert_eq!(store.update(&dark(), 1).unwrap().revision, 2);
}

#[test]
fn the_revision_never_decreases_across_a_run_of_mixed_operations() {
    let (store, _) = SettingsStore::open(memory_file(None));
    let mut last = store.snapshot().revision;
    for n in 0..40u64 {
        let _ = match n % 4 {
            0 => store.touch_recent(&format!("/w{}", n % 7)),
            1 => store.update(&dark(), last),
            2 => store.update(&dark(), last + 3), // always stale
            _ => store.clear_recent(),
        };
        let now = store.snapshot().revision;
        assert!(now >= last, "{now} < {last}");
        last = now;
    }
}

#[test]
fn what_was_saved_is_there_when_the_store_opens_again() {
    let storage = Arc::new(MemoryStorage::default());
    let (store, _) = SettingsStore::open(SettingsFile::new(storage.clone()));
    store.touch_recent("/a").unwrap();
    store.update(&dark(), 1).unwrap();
    let (again, report) = SettingsStore::open(SettingsFile::new(storage));
    assert_eq!(report.problem, None);
    assert_eq!(again.snapshot().revision, 0);
    assert_eq!(again.snapshot().settings, store.snapshot().settings);
}

#[test]
fn observers_hear_each_change_in_order() {
    use std::sync::{Arc, Mutex};
    let (store, _) = SettingsStore::open(memory_file(None));
    let heard = Arc::new(Mutex::new(Vec::new()));
    let sink = heard.clone();
    store.observe(move |s| sink.lock().unwrap().push(s.revision));
    store.touch_recent("/a").unwrap();
    store.update(&dark(), 1).unwrap();
    store.update(&dark(), 2).unwrap(); // quiet
    assert_eq!(*heard.lock().unwrap(), vec![1, 2]);
}

#[test]
fn memory_storage_rename_refuses_to_replace() {
    let storage = MemoryStorage::with("a", "1");
    storage.put("b", "2");
    assert!(storage.rename("a", "b").is_err());
    assert_eq!(storage.read("b").unwrap().unwrap(), "2");
}

#[test]
fn the_editor_defaults_fit_a_1280_by_700_area_and_keep_the_palette_where_the_prototype_does() {
    let layout = default_layout("main");
    let ids: Vec<&str> = layout.panels.keys().map(String::as_str).collect();
    assert_eq!(
        ids,
        ["history", "objects", "palette", "proposals", "script"]
    );
    let palette = layout.panels["palette"];
    assert_eq!(
        (palette.x, palette.y, palette.w, palette.h),
        (76, 8, 252, 300)
    );
    let script = layout.panels["script"];
    assert_eq!((script.w, script.h), (460, 420));
    for (id, p) in &layout.panels {
        assert!(
            p.x + p.w <= 1280 && p.y + p.h <= 700,
            "{id} leaves the area"
        );
        assert!(p.visible);
    }
    let mut z: Vec<u32> = layout.panels.values().map(|p| p.z).collect();
    z.sort_unstable();
    z.dedup();
    assert_eq!(z.len(), layout.panels.len(), "z-order is distinct");
    assert!(default_layout("about").panels.is_empty());
}

#[test]
fn a_saved_layout_is_laid_over_the_defaults_panel_by_panel() {
    let mut settings = Settings::default();
    settings
        .layout
        .insert("main".into(), layout_of("script", 5));
    let layout = resolve_layout(&settings, "main");
    assert_eq!(layout.panels["script"].x, 5);
    assert_eq!(
        layout.panels["palette"],
        default_layout("main").panels["palette"]
    );
    assert_eq!(layout.panels.len(), 5);
}

#[test]
fn saving_and_resetting_a_layout_changes_the_revision_and_survives_a_reload() {
    let (store, _) = SettingsStore::open(memory_file(None));
    let saved = store.set_layout("main", layout_of("script", 77)).unwrap();
    assert_eq!(saved.revision, 1);
    assert_eq!(saved.settings.layout["main"], layout_of("script", 77));
    let again = store.set_layout("main", layout_of("script", 77)).unwrap();
    assert_eq!(again.revision, 1, "an unchanged layout is quiet");
    let reset = store.reset_layout("main").unwrap();
    assert_eq!(reset.revision, 2);
    assert!(reset.settings.layout.is_empty());
}

#[test]
fn a_layout_with_no_room_is_refused_and_changes_nothing() {
    let (store, _) = SettingsStore::open(memory_file(None));
    let bad = PanelLayout {
        panels: BTreeMap::from([(
            "script".to_owned(),
            PanelPlacement {
                h: 0,
                ..placement(0)
            },
        )]),
    };
    assert!(matches!(
        store.set_layout("main", bad),
        Err(SettingsError::Invalid { .. })
    ));
    assert!(matches!(
        store.set_layout("", layout_of("script", 1)),
        Err(SettingsError::Invalid { .. })
    ));
    assert_eq!(store.snapshot().revision, 0);
}

#[test]
fn the_accent_and_glass_default_to_the_system() {
    let settings = Settings::default();
    assert_eq!(settings.accent, AccentChoice::System);
    assert_eq!(settings.glass, GlassMode::System);
}

#[test]
fn a_version_two_file_migrates_to_three_with_the_default_accent_and_glass() {
    let file = memory_file(Some(
        r#"{ "version": 2, "settings": { "colour_mode": "dark", "locale": "fr-CA" } }"#,
    ));
    let report = file.load();
    assert_eq!(report.problem, None);
    assert_eq!(report.settings.colour_mode, ColourMode::Dark);
    assert_eq!(report.settings.accent, AccentChoice::System);
    assert_eq!(report.settings.glass, GlassMode::System);
    // A version one file passes through both steps.
    let older = memory_file(Some(r#"{ "version": 1, "settings": {} }"#)).load();
    assert_eq!(older.problem, None);
    assert_eq!(older.settings.accent, AccentChoice::System);
}

#[test]
fn a_version_two_migration_keeps_an_accent_that_is_already_there() {
    let file = memory_file(Some(
        r##"{ "version": 2, "settings": { "accent": { "kind": "custom", "hex": "#123abc" }, "glass": "off" } }"##,
    ));
    let settings = file.load().settings;
    assert_eq!(
        settings.accent,
        AccentChoice::Custom {
            hex: "#123abc".to_owned()
        }
    );
    assert_eq!(settings.glass, GlassMode::Off);
}

#[test]
fn a_patch_sets_the_accent_and_glass() {
    let patch = SettingsPatch {
        accent: Some(AccentChoice::AfterglowOrange),
        glass: Some(GlassMode::Off),
        ..SettingsPatch::default()
    };
    let next = apply_patch(&Settings::default(), &patch).unwrap();
    assert_eq!(next.accent, AccentChoice::AfterglowOrange);
    assert_eq!(next.glass, GlassMode::Off);
    assert_eq!(next.colour_mode, ColourMode::System);
}

#[test]
fn a_bad_custom_accent_is_refused_and_names_its_field() {
    for hex in [
        "", "#fff", "123456", "#12345g", "#ABCDEF", "#1234567", "red",
    ] {
        let patch = SettingsPatch {
            accent: Some(AccentChoice::Custom {
                hex: hex.to_owned(),
            }),
            ..SettingsPatch::default()
        };
        let refused = apply_patch(&Settings::default(), &patch).unwrap_err();
        assert!(
            matches!(
                refused,
                SettingsError::InvalidField {
                    field: SettingsField::AccentHex,
                    ..
                }
            ),
            "{hex}"
        );
    }
}

#[test]
fn the_accent_and_glass_survive_a_save_and_load() {
    let store_file = memory_file(None);
    let settings = Settings {
        accent: AccentChoice::Custom {
            hex: "#00e5ff".to_owned(),
        },
        glass: GlassMode::On,
        ..Settings::default()
    };
    store_file.save(&settings).unwrap();
    let saved: Value =
        serde_json::from_str(&store_file.storage().get(SETTINGS_FILE).unwrap()).unwrap();
    assert_eq!(saved["version"], 5);
    assert_eq!(saved["settings"]["accent"]["kind"], "custom");
    assert_eq!(saved["settings"]["glass"], "on");
    assert_eq!(store_file.load().settings, settings);
}

#[test]
fn a_file_with_a_bad_custom_accent_is_set_aside() {
    let file = memory_file(Some(
        r##"{ "version": 3, "settings": { "accent": { "kind": "custom", "hex": "nope" } } }"##,
    ));
    assert!(file.load().set_aside.is_some());
}

#[test]
fn the_menu_bar_defaults_off() {
    assert!(!Settings::default().ui.menu_bar);
    assert!(!UiSettings::default().menu_bar);
}

#[test]
fn a_version_four_file_migrates_to_five_with_the_menu_bar_off() {
    let file = memory_file(Some(
        r#"{ "version": 4, "settings": { "colour_mode": "dark" } }"#,
    ));
    let report = file.load();
    assert_eq!(report.problem, None);
    assert_eq!(report.settings.colour_mode, ColourMode::Dark);
    assert!(!report.settings.ui.menu_bar);
    // The step writes the field itself, so the file on disk says so after the next save.
    let migrated = fizz_studio_settings::migrate(
        json!({ "colour_mode": "dark" }),
        4,
        SETTINGS_VERSION,
        fizz_studio_settings::MIGRATIONS,
    )
    .unwrap();
    assert_eq!(migrated["ui"]["menu_bar"], false);
    // An older file passes through every step.
    let older = memory_file(Some(r#"{ "version": 1, "settings": {} }"#)).load();
    assert_eq!(older.problem, None);
    assert!(!older.settings.ui.menu_bar);
}

#[test]
fn a_migration_keeps_a_menu_bar_choice_that_is_already_there() {
    let file = memory_file(Some(
        r#"{ "version": 4, "settings": { "ui": { "menu_bar": true } } }"#,
    ));
    assert!(file.load().settings.ui.menu_bar);
}

#[test]
fn a_patch_sets_the_menu_bar_and_it_survives_a_save_and_load() {
    let patch = SettingsPatch {
        ui: Some(UiSettings { menu_bar: true }),
        ..SettingsPatch::default()
    };
    let next = apply_patch(&Settings::default(), &patch).unwrap();
    assert!(next.ui.menu_bar);
    assert_eq!(next.colour_mode, ColourMode::System);
    let file = memory_file(None);
    file.save(&next).unwrap();
    let saved: Value = serde_json::from_str(&file.storage().get(SETTINGS_FILE).unwrap()).unwrap();
    assert_eq!(saved["settings"]["ui"]["menu_bar"], true);
    assert_eq!(file.load().settings, next);
    // A patch that names nothing leaves it alone.
    let same = apply_patch(&next, &SettingsPatch::default()).unwrap();
    assert!(same.ui.menu_bar);
}
