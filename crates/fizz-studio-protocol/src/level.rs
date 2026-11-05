// What the webview sees of an open level: a view of the grid, the edits it can ask for, the errors
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The session in Rust owns the level's text. The webview never parses it: it draws this view, sends
// an edit with the revision it was drawn from, and gets back the next snapshot, so a stale answer is
// refused rather than applied.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// A thing placed on a cell.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct ViewItem {
    pub kind: String,
    pub x: f64,
    pub y: f64,
}

/// An enemy or object spawn. `y` is `None` where the line gave none and no ground lies under it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct ViewSpawn {
    pub kind: String,
    pub x: f64,
    pub y: Option<f64>,
    pub dir: Option<f64>,
    pub ride: bool,
}

/// Where Ben starts, in tiles.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct ViewStart {
    pub x: f64,
    pub y: f64,
}

/// A problem in the script, on a line counted from 1. Fizz 1 errors carry a line and no column.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct ViewDiagnostic {
    pub line: u32,
    pub code: String,
    /// The message, in the language the catalogue shows (English (Canada) for now).
    pub message: String,
}

/// The level as the canvas draws it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct LevelView {
    pub width: u32,
    pub height: u32,
    pub name: String,
    /// The tile words the cells use, such as `empty` and `grass`; a cell is an index into this list.
    pub palette: Vec<String>,
    /// One palette index per cell, `y * width + x`, row 0 at the bottom.
    pub cells: Vec<u16>,
    pub items: Vec<ViewItem>,
    pub spawns: Vec<ViewSpawn>,
    pub start: Option<ViewStart>,
    pub diagnostics: Vec<ViewDiagnostic>,
}

/// A run of cells on one axis, `[from, to]` inclusive.
pub type CellRange = [u32; 2];

/// What the person asks of a level. Each is appended to the script's `edits` block; no line already
/// written is ever rewritten. `x` by `y` is a cross product, as in the language.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "kebab-case")]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub enum LevelEdit {
    Paint {
        tile: String,
        x: Vec<CellRange>,
        y: Vec<CellRange>,
    },
    Clear {
        x: Vec<CellRange>,
        y: Vec<CellRange>,
    },
    Place {
        item: String,
        x: Vec<CellRange>,
        y: Vec<CellRange>,
    },
}

/// Which game's language a level is written in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub enum LevelTarget {
    Fizz1,
    Fizz2,
}

/// An open level: its text, its view, and where it is in its history.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct LevelSnapshot {
    /// The key the other level commands take.
    pub id: String,
    pub path: String,
    pub revision: u64,
    pub saved_revision: u64,
    /// The whole script: the source of truth.
    pub text: String,
    pub view: LevelView,
    pub can_undo: bool,
    pub can_redo: bool,
    /// The name of the step undo would undo, such as `Paint grass`.
    pub undo_name: Option<String>,
    pub redo_name: Option<String>,
    /// Who made the last change: `person`, `claude`, or `outside`.
    pub author: String,
    /// True when the last change came from outside the studio and has not been saved.
    pub edited_outside: bool,
    /// Which game's language the level is written in.
    pub target: LevelTarget,
    /// A message key the canvas shows above the grid, such as `level.flatFallback`.
    pub banner: Option<String>,
}

/// What kind of project a folder is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub enum ProjectKind {
    Fizz1,
    Fizz2,
}

/// A project folder and the level files in it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct ProjectInfo {
    pub root: String,
    pub kind: ProjectKind,
    pub world_file: Option<String>,
    pub levels: Vec<String>,
}

/// Why a level command was refused. Nothing changed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub enum LevelError {
    /// The edit was based on a revision that is not the current one; read the level again.
    Stale { based_on: u64, current: u64 },
    /// No level is open under that id.
    NotOpen { id: String },
    /// The edit names something the language does not have, or a range outside the level.
    Invalid { message: String },
    /// The file could not be read or written.
    Io { message: String },
}

/// A recovery copy left by a session that did not close cleanly: an unsaved level and when the
/// studio last kept it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct RecoveryEntry {
    /// The key `recovery_restore` and `recovery_discard` take.
    pub id: String,
    /// The level file the copy is of.
    pub path: String,
    /// The file's name, for the start screen.
    pub name: String,
    /// When the copy was kept, in milliseconds since the Unix epoch.
    pub saved_at_ms: u64,
}
