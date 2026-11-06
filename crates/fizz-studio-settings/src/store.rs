// The store: the settings in force, one writer, and a revision that only ever rises
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::sync::{Mutex, MutexGuard};

use std::collections::BTreeMap;

use fizz_studio_protocol::{PanelLayout, Settings, SettingsError, SettingsPatch, SettingsSnapshot};

use crate::document::{LoadReport, SettingsFile};
use crate::rules::{apply_patch, clear_recent, touch_recent};
use crate::storage::BlobStorage;

/// Runs with the new snapshot after every change, while the store's lock is held, so observers see
/// the revisions in order.
pub type Observer = Box<dyn Fn(&SettingsSnapshot) + Send + Sync>;

/// The settings every window reads. Every change goes through here, under one lock, is saved, and
/// then gets the next revision; a change that fails to save leaves the settings and the revision
/// as they were.
pub struct SettingsStore<S: BlobStorage> {
    file: SettingsFile<S>,
    current: Mutex<SettingsSnapshot>,
    observers: Mutex<Vec<Observer>>,
}

fn locked<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    // A poisoned lock only means another thread panicked; the snapshot itself is always whole.
    mutex.lock().unwrap_or_else(|e| e.into_inner())
}

impl<S: BlobStorage> SettingsStore<S> {
    /// Loads the file (or the defaults) at revision 0, and reports what loading did.
    pub fn open(file: SettingsFile<S>) -> (Self, LoadReport) {
        let report = file.load();
        let store = Self {
            current: Mutex::new(SettingsSnapshot {
                revision: 0,
                settings: report.settings.clone(),
            }),
            observers: Mutex::new(Vec::new()),
            file,
        };
        (store, report)
    }

    /// Adds something to run after every change, after those added before it: the plugin
    /// announces the change to the windows, and the app fits the window effects to it. An observer
    /// runs while the store's lock is held, so it must not call back into the store.
    pub fn observe(&self, observer: impl Fn(&SettingsSnapshot) + Send + Sync + 'static) {
        locked(&self.observers).push(Box::new(observer));
    }

    pub fn snapshot(&self) -> SettingsSnapshot {
        locked(&self.current).clone()
    }

    /// Lays `patch` over the settings, but only if the caller last saw `based_on`: otherwise
    /// [`SettingsError::Stale`] and nothing changes. A patch that changes nothing is quiet and
    /// returns the snapshot unchanged, with no new revision.
    pub fn update(
        &self,
        patch: &SettingsPatch,
        based_on: u64,
    ) -> Result<SettingsSnapshot, SettingsError> {
        let mut current = locked(&self.current);
        if based_on != current.revision {
            return Err(SettingsError::Stale {
                based_on,
                current: current.revision,
            });
        }
        let next = apply_patch(&current.settings, patch)?;
        self.commit(&mut current, next)
    }

    /// Saves the panel layout of a window kind. The newest save wins: a layout is the arrangement
    /// of one window, so it is not checked against a revision.
    pub fn set_layout(
        &self,
        kind: &str,
        layout: PanelLayout,
    ) -> Result<SettingsSnapshot, SettingsError> {
        self.change_layout(kind, Some(layout))
    }

    /// Forgets the saved layout of a window kind, so the defaults apply again.
    pub fn reset_layout(&self, kind: &str) -> Result<SettingsSnapshot, SettingsError> {
        self.change_layout(kind, None)
    }

    fn change_layout(
        &self,
        kind: &str,
        layout: Option<PanelLayout>,
    ) -> Result<SettingsSnapshot, SettingsError> {
        let mut current = locked(&self.current);
        let patch = SettingsPatch {
            layout: Some(BTreeMap::from([(kind.to_owned(), layout)])),
            ..SettingsPatch::default()
        };
        let next = apply_patch(&current.settings, &patch)?;
        self.commit(&mut current, next)
    }

    /// Puts `path` at the front of the recent list.
    pub fn touch_recent(&self, path: &str) -> Result<SettingsSnapshot, SettingsError> {
        let mut current = locked(&self.current);
        let mut next = current.settings.clone();
        touch_recent(&mut next, path);
        self.commit(&mut current, next)
    }

    /// Empties the recent list.
    pub fn clear_recent(&self) -> Result<SettingsSnapshot, SettingsError> {
        let mut current = locked(&self.current);
        let mut next = current.settings.clone();
        clear_recent(&mut next);
        self.commit(&mut current, next)
    }

    /// Saves `next`, then makes it current with the next revision. The caller holds the lock.
    fn commit(
        &self,
        current: &mut SettingsSnapshot,
        next: Settings,
    ) -> Result<SettingsSnapshot, SettingsError> {
        if next == current.settings {
            return Ok(current.clone());
        }
        self.file
            .save(&next)
            .map_err(|e| SettingsError::Storage { message: e.0 })?;
        *current = SettingsSnapshot {
            revision: current.revision + 1,
            settings: next,
        };
        for observer in locked(&self.observers).iter() {
            observer(current);
        }
        Ok(current.clone())
    }
}
