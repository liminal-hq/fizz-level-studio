// Autosave of unsaved levels into recovery copies, and the ids and background timer that serve it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use crate::open::OpenLevel;

/// How long a level waits between recovery copies unless the plugin is told otherwise.
pub const AUTOSAVE_INTERVAL: Duration = Duration::from_secs(5);

/// The file inside a recovery copy that holds the level's text.
pub(crate) const COPY_FILE: &str = "level.fizz";

/// Where recovery copies go and how often they are kept.
#[derive(Debug, Clone)]
pub struct RecoveryConfig {
    /// The recovery folder. `None` means `recovery` under the app's data directory, or a temporary
    /// folder (with a warning) if the system names no data directory.
    pub dir: Option<PathBuf>,
    /// The least time between two copies of the same level.
    pub interval: Duration,
}

impl Default for RecoveryConfig {
    fn default() -> Self {
        Self {
            dir: None,
            interval: AUTOSAVE_INTERVAL,
        }
    }
}

/// A stable id for the recovery copy of the level at `path`: a hash of the path, so a level has at
/// most one copy. FNV-1a, written out so the id never changes between builds.
pub(crate) fn recovery_id(path: &Path) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in path.to_string_lossy().as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("level-{hash:016x}")
}

/// The autosave timer. Dropping it stops the timer and waits for a tick in progress to finish, so
/// that nothing is written to the recovery folder once the handle is gone.
pub(crate) struct AutosaveHandle {
    stop: Option<Sender<()>>,
    thread: Option<JoinHandle<()>>,
}

impl Drop for AutosaveHandle {
    fn drop(&mut self) {
        drop(self.stop.take());
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

/// Keeps recovery copies on a timer until the returned handle is dropped.
pub(crate) fn start_autosave(
    levels: Arc<Mutex<HashMap<String, OpenLevel>>>,
    interval: Duration,
) -> std::io::Result<AutosaveHandle> {
    let (stop, stopped) = mpsc::channel::<()>();
    // Look more often than the interval, so a level is never left waiting for a whole extra tick.
    let tick = (interval / 4).max(Duration::from_millis(1));
    let thread = std::thread::Builder::new()
        .name("fizz-studio-autosave".to_string())
        .spawn(move || {
            while let Err(RecvTimeoutError::Timeout) = stopped.recv_timeout(tick) {
                let mut levels = levels.lock().unwrap_or_else(|e| e.into_inner());
                let now = Instant::now();
                for level in levels.values_mut() {
                    level.keep_copy(now);
                }
            }
        })?;
    Ok(AutosaveHandle {
        stop: Some(stop),
        thread: Some(thread),
    })
}
