// Tests for the settings document, its files, the recent list and the store's revisions
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::collections::BTreeMap;
use std::sync::Arc;

use fizz_studio_protocol::{ColourMode, Settings, SettingsError, SettingsPatch, RECENT_WORLDS_CAP};
use fizz_studio_settings::{
    apply_patch, touch_recent, BlobStorage, DiskStorage, MemoryStorage, Migration, SettingsFile,
    SettingsStore, SETTINGS_FILE, SETTINGS_VERSION,
};
use serde_json::{json, Value};

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
fn this_build_has_no_steps_so_an_older_version_is_unreadable_not_guessed() {
    let file = memory_file(Some(r#"{ "version": 0, "settings": {} }"#));
    assert_eq!(SETTINGS_VERSION, 1);
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
    settings.layout.insert("main-1".into(), "{}".into());
    let patch = SettingsPatch {
        locale: Some("fr-CA".into()),
        layout: Some(BTreeMap::from([
            ("main-1".to_owned(), None),
            ("main-2".to_owned(), Some(r#"{"a":1}"#.to_owned())),
        ])),
        ..SettingsPatch::default()
    };
    let next = apply_patch(&settings, &patch).unwrap();
    assert_eq!(next.locale, "fr-CA");
    assert!(!next.layout.contains_key("main-1"));
    assert_eq!(next.layout["main-2"], r#"{"a":1}"#);
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
            "main-1".to_owned(),
            Some("{".to_owned()),
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
