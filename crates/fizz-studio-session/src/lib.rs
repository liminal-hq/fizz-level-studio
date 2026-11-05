// The session of one open document: intents in, patches out, one writer, named undo and redo
//
// Pure Rust with no Tauri. The design follows Folio's `folio-session` (`spec/DESKTOP.md`, "State"):
// the session owns the document, every change bumps a monotonic revision, history lives here and not
// in the frontend, and a view that computed something for an old revision is refused.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

mod document;
mod error;
mod session;

pub use document::{Document, Edit, PlainText, PlainTextIntent};
pub use error::{DocumentError, SessionError};
pub use session::{Author, Patch, Request, Session, StepInfo, WriterToken};
