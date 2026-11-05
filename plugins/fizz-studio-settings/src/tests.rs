// Plugin tests: the store and its commands run against a mock Tauri app with real windows
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::sync::{Arc, Mutex};

use fizz_studio_protocol::{ColourMode, SettingsError, SettingsPatch, SettingsSnapshot};
use fizz_studio_settings::{BlobStorage, MemoryStorage};
use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime};
use tauri::{Listener, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::{commands, init, Store, EVENT};

type App = tauri::App<MockRuntime>;

const LABELS: [&str; 3] = ["main-1", "preferences", "about"];

fn app_with(storage: Arc<dyn BlobStorage>) -> App {
    let app = mock_builder()
        .plugin(init(storage))
        .build(mock_context(noop_assets()))
        .expect("the mock app builds");
    for label in LABELS {
        WebviewWindowBuilder::new(&app, label, WebviewUrl::App("index.html".into()))
            .build()
            .expect("the mock window opens");
    }
    app
}

fn store(app: &App) -> tauri::State<'_, Store> {
    app.state::<Store>()
}

/// Collects the snapshots a window hears.
fn hear(app: &App, label: &str) -> Arc<Mutex<Vec<SettingsSnapshot>>> {
    let heard = Arc::new(Mutex::new(Vec::new()));
    let sink = heard.clone();
    app.get_webview_window(label)
        .unwrap()
        .listen(EVENT, move |event| {
            sink.lock()
                .unwrap()
                .push(serde_json::from_str(event.payload()).expect("a snapshot"));
        });
    heard
}

fn dark() -> SettingsPatch {
    SettingsPatch {
        colour_mode: Some(ColourMode::Dark),
        ..SettingsPatch::default()
    }
}

#[test]
fn a_fresh_app_starts_at_revision_zero_with_the_defaults() {
    let app = app_with(Arc::new(MemoryStorage::default()));
    let snapshot = commands::settings_get(store(&app));
    assert_eq!(snapshot.revision, 0);
    assert_eq!(snapshot.settings.locale, "en-CA");
}

#[test]
fn two_windows_both_hear_a_change_and_the_caller_gets_it_back() {
    let storage = Arc::new(MemoryStorage::default());
    let app = app_with(storage.clone());
    let heard: Vec<_> = LABELS.iter().map(|label| hear(&app, label)).collect();
    let answer = commands::settings_update(store(&app), dark(), 0).unwrap();
    assert_eq!(answer.revision, 1);
    for window in &heard {
        let got = window.lock().unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0], answer);
        assert_eq!(got[0].settings.colour_mode, ColourMode::Dark);
    }
    assert!(storage.get("settings.json").unwrap().contains("\"dark\""));
}

#[test]
fn recent_worlds_changes_are_announced_with_rising_revisions() {
    let app = app_with(Arc::new(MemoryStorage::default()));
    let heard: Vec<_> = LABELS.iter().map(|label| hear(&app, label)).collect();
    commands::recent_touch(store(&app), "/worlds/a".into()).unwrap();
    commands::recent_touch(store(&app), "/worlds/b".into()).unwrap();
    commands::recent_clear(store(&app)).unwrap();
    for window in heard {
        let revisions: Vec<u64> = window.lock().unwrap().iter().map(|s| s.revision).collect();
        assert_eq!(revisions, vec![1, 2, 3]);
    }
    assert!(store(&app).snapshot().settings.recent_worlds.is_empty());
}

#[test]
fn a_stale_update_is_refused_with_both_revisions_and_nobody_hears_it() {
    let app = app_with(Arc::new(MemoryStorage::default()));
    commands::recent_touch(store(&app), "/worlds/a".into()).unwrap();
    let heard = hear(&app, "preferences");
    let refused = commands::settings_update(store(&app), dark(), 0).unwrap_err();
    assert_eq!(
        refused,
        SettingsError::Stale {
            based_on: 0,
            current: 1
        }
    );
    assert_eq!(
        serde_json::to_value(&refused).unwrap(),
        serde_json::json!({ "kind": "stale", "based_on": 0, "current": 1 })
    );
    assert!(heard.lock().unwrap().is_empty());
    assert_eq!(
        store(&app).snapshot().settings.colour_mode,
        ColourMode::System
    );
}

#[test]
fn a_save_that_fails_is_refused_and_not_announced() {
    let storage = Arc::new(MemoryStorage::default());
    storage.set_failing(true);
    let app = app_with(storage);
    let heard = hear(&app, "main-1");
    let refused = commands::settings_update(store(&app), dark(), 0).unwrap_err();
    assert!(matches!(refused, SettingsError::Storage { .. }));
    assert_eq!(store(&app).snapshot().revision, 0);
    assert!(heard.lock().unwrap().is_empty());
}

#[test]
fn a_patch_that_changes_nothing_is_quiet() {
    let app = app_with(Arc::new(MemoryStorage::default()));
    let heard = hear(&app, "main-1");
    let answer = commands::settings_update(store(&app), SettingsPatch::default(), 0).unwrap();
    assert_eq!(answer.revision, 0);
    assert!(heard.lock().unwrap().is_empty());
}

#[test]
fn settings_saved_by_an_earlier_run_load_at_revision_zero() {
    let storage = Arc::new(MemoryStorage::with(
        "settings.json",
        r#"{ "version": 1, "settings": { "colour_mode": "light", "recent_worlds": ["/w"] } }"#,
    ));
    let app = app_with(storage);
    let snapshot = commands::settings_get(store(&app));
    assert_eq!(snapshot.revision, 0);
    assert_eq!(snapshot.settings.colour_mode, ColourMode::Light);
    assert_eq!(snapshot.settings.recent_worlds, ["/w"]);
}

#[test]
fn the_layout_commands_give_defaults_then_the_saved_places_and_back() {
    let app = app_with(Arc::new(MemoryStorage::default()));
    let defaults = commands::layout_get(store(&app), "main".to_owned());
    assert_eq!(defaults.panels.len(), 5);
    let mut moved = defaults.clone();
    moved.panels.get_mut("script").unwrap().x = 100;
    let saved = commands::layout_set(store(&app), "main".to_owned(), moved).unwrap();
    assert_eq!(saved.panels["script"].x, 100);
    assert_eq!(
        commands::layout_get(store(&app), "main".to_owned()).panels["script"].x,
        100
    );
    let back = commands::layout_reset(store(&app), "main".to_owned()).unwrap();
    assert_eq!(back, defaults);
}

#[test]
fn a_saved_layout_is_announced_to_every_window() {
    let app = app_with(Arc::new(MemoryStorage::default()));
    let heard = hear(&app, "main-1");
    let mut layout = commands::layout_get(store(&app), "main".to_owned());
    layout.panels.get_mut("palette").unwrap().collapsed = true;
    commands::layout_set(store(&app), "main".to_owned(), layout).unwrap();
    let heard = heard.lock().unwrap();
    assert_eq!(heard.len(), 1);
    assert!(heard[0].settings.layout["main"].panels["palette"].collapsed);
}
