// The errors the files crate reports
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::path::PathBuf;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum WorldError {
    #[error("{path}: {source}", path = path.display())]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("{path} is not a folder", path = path.display())]
    NotAFolder { path: PathBuf },
    #[error("{id:?} is not a usable recovery id")]
    BadRecoveryId { id: String },
    #[error("{path:?} is not a relative path inside the copy")]
    BadRelativePath { path: PathBuf },
    #[error("the file watcher failed: {0}")]
    Watch(#[from] notify::Error),
}

impl WorldError {
    pub(crate) fn io(path: impl Into<PathBuf>, source: std::io::Error) -> Self {
        WorldError::Io {
            path: path.into(),
            source,
        }
    }
}
