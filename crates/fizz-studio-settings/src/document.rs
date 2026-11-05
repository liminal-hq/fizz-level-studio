// The settings file: loading with migration and recovery, and saving with a previous generation
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The file is `{ "version": N, "settings": { ... } }`. A save first copies the file in place to
// `settings.json.prev`, so one earlier generation always survives. A file that cannot be read, is
// not valid, or was written by a newer build is moved to `settings.json.unreadable-<n>` and the
// defaults apply; it is never overwritten.

use std::fmt;

use fizz_studio_protocol::Settings;
use serde_json::{json, Value};

use crate::migrate::{migrate, Migration, MIGRATIONS};
use crate::rules::validate;
use crate::storage::{BlobStorage, StorageError};

/// The version of the file this build writes.
pub const SETTINGS_VERSION: u32 = 3;

/// The name of the settings file in the storage.
pub const SETTINGS_FILE: &str = "settings.json";

fn previous_name() -> String {
    format!("{SETTINGS_FILE}.prev")
}

fn unreadable_name(n: u32) -> String {
    format!("{SETTINGS_FILE}.unreadable-{n}")
}

/// Why a file's text is not usable settings.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocumentError(pub String);

impl fmt::Display for DocumentError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for DocumentError {}

/// What loading found.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LoadReport {
    pub settings: Settings,
    /// The name an unreadable file was moved to, when there was one.
    pub set_aside: Option<String>,
    /// Why the file was unusable, when it was.
    pub problem: Option<String>,
}

/// The settings file in a storage.
pub struct SettingsFile<S: BlobStorage> {
    storage: S,
    current: u32,
    steps: &'static [Migration],
    /// Set when an unusable file could not be moved aside: saving would overwrite it.
    blocked: std::sync::atomic::AtomicBool,
}

impl<S: BlobStorage> SettingsFile<S> {
    pub fn new(storage: S) -> Self {
        Self::with_migrations(storage, SETTINGS_VERSION, MIGRATIONS)
    }

    /// A file at `current` version with its own migration steps; the tests use it to prove the
    /// mechanism before a real second version exists.
    pub fn with_migrations(storage: S, current: u32, steps: &'static [Migration]) -> Self {
        Self {
            storage,
            current,
            steps,
            blocked: std::sync::atomic::AtomicBool::new(false),
        }
    }

    pub fn storage(&self) -> &S {
        &self.storage
    }

    /// Reads `text` as a settings file of this build's version, migrating if it is older.
    pub fn parse(&self, text: &str) -> Result<Settings, DocumentError> {
        let fail = |why: String| DocumentError(why);
        let root: Value = serde_json::from_str(text).map_err(|e| fail(e.to_string()))?;
        let version = root
            .get("version")
            .and_then(Value::as_u64)
            .and_then(|v| u32::try_from(v).ok())
            .ok_or_else(|| fail("the file has no version".to_owned()))?;
        let body = root
            .get("settings")
            .cloned()
            .ok_or_else(|| fail("the file has no settings".to_owned()))?;
        let body = migrate(body, version, self.current, self.steps).map_err(fail)?;
        let settings: Settings =
            serde_json::from_value(body).map_err(|e| DocumentError(e.to_string()))?;
        validate(&settings).map_err(|e| DocumentError(e.to_string()))?;
        Ok(settings)
    }

    /// The saved settings, or the defaults when there is no file or it cannot be used. A file that
    /// cannot be used is moved aside first, so nothing later overwrites it.
    pub fn load(&self) -> LoadReport {
        let defaults = |set_aside, problem| LoadReport {
            settings: Settings::default(),
            set_aside,
            problem,
        };
        let problem = match self.storage.read(SETTINGS_FILE) {
            Ok(None) => return defaults(None, None),
            Ok(Some(text)) => match self.parse(&text) {
                Ok(settings) => {
                    return LoadReport {
                        settings,
                        set_aside: None,
                        problem: None,
                    }
                }
                Err(why) => why.to_string(),
            },
            Err(why) => why.to_string(),
        };
        match self.set_aside() {
            Ok(name) => defaults(Some(name), Some(problem)),
            Err(why) => {
                self.blocked
                    .store(true, std::sync::atomic::Ordering::Release);
                defaults(
                    None,
                    Some(format!("{problem}; it could not be set aside: {why}")),
                )
            }
        }
    }

    fn set_aside(&self) -> Result<String, StorageError> {
        let mut n = 1;
        while self
            .storage
            .read(&unreadable_name(n))
            .ok()
            .flatten()
            .is_some()
        {
            n += 1;
        }
        let name = unreadable_name(n);
        self.storage.rename(SETTINGS_FILE, &name)?;
        Ok(name)
    }

    /// Writes `settings`, keeping the file it replaces as the previous generation.
    pub fn save(&self, settings: &Settings) -> Result<(), StorageError> {
        if self.blocked.load(std::sync::atomic::Ordering::Acquire) {
            return Err(StorageError(
                "the unreadable settings file could not be set aside, so it is not overwritten"
                    .to_owned(),
            ));
        }
        if let Some(old) = self.storage.read(SETTINGS_FILE)? {
            self.storage.write(&previous_name(), &old)?;
        }
        let text = serde_json::to_string_pretty(&json!({
            "version": self.current,
            "settings": settings,
        }))
        .map_err(|e| StorageError(e.to_string()))?;
        self.storage.write(SETTINGS_FILE, &format!("{text}\n"))
    }
}
