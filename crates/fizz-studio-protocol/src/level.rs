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
    /// The script line, counted from 1, of the statement that placed it; `None` where the view
    /// cannot tell.
    pub line: Option<u32>,
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
    /// The script line, counted from 1, of the `spawn` statement; `None` where the view cannot tell.
    pub line: Option<u32>,
}

/// Where Ben starts, in tiles.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct ViewStart {
    pub x: f64,
    pub y: f64,
    /// The script line, counted from 1, of the `start` statement that holds; `None` where the view
    /// cannot tell.
    pub line: Option<u32>,
}

/// A tile that is a thing in its own right, an exit or a door, as one column of like cells: `x`
/// and `y` are its bottom cell and `height` counts the cells upward.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct ViewMarker {
    /// The tile word, such as `exit` or `red-door`.
    pub kind: String,
    pub x: f64,
    pub y: f64,
    pub height: u32,
    /// The script line, counted from 1, of the statement that last set these cells; `None` where
    /// the view cannot tell.
    pub line: Option<u32>,
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
    /// The exits and doors, in column order and then from the bottom up.
    pub markers: Vec<ViewMarker>,
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
    /// A run of items along one row, `row ITEM x=from..to y=y by=by`. `by` is the step in cells
    /// (1 for every cell); the run must land on its step, so `(to - from)` divides by `by`.
    Row {
        item: String,
        x: CellRange,
        y: u32,
        by: u32,
    },
    /// An enemy or prop on one cell, such as `drone x=88 y=7`.
    Spawn { enemy: String, x: u32, y: u32 },
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

/// What the person fills in to make a new level. The target is fixed here and no later edit can
/// change it (R-WLD-02).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct NewLevelRequest {
    /// The name the person sees, on one line and without quotes.
    pub name: String,
    /// A slug of lowercase letters, digits, and hyphens; it names the file or the world folder.
    pub id: String,
    pub width: u32,
    pub height: u32,
    /// Fizz 1 only: the ground height; a quarter of the height when left out.
    pub ground: Option<u32>,
    /// Fizz 1 only: one of the language's theme words.
    pub theme: Option<String>,
    pub target: LevelTarget,
    /// The folder the level file (Fizz 1) or the world folder (Fizz 2) is made in.
    pub folder: String,
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

/// One word of the language, documented, for the Palette and for completion in the Script panel.
/// The text comes from the language crate's data (English (Canada) for now); the webview never keeps
/// its own copy.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct WordDoc {
    pub word: String,
    /// One of `statement`, `section`, `segment`, `tile`, `item`, `enemy`.
    pub kind: String,
    pub syntax: String,
    pub example: String,
    pub note: String,
}

/// What a proposed line does to a cell.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub enum GhostOp {
    Paint,
    Clear,
    Place,
}

/// One cell a pending proposal would change, counted from the bottom-left corner.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct GhostCell {
    pub x: u32,
    pub y: u32,
    pub op: GhostOp,
    /// The tile or item word for a paint or place; `None` for a clear.
    pub word: Option<String>,
}

/// A change Claude proposed that the person has not yet accepted or rejected, read from the
/// level's `<level>.studio.json` sidecar. Read-only: accepting and rejecting come later.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../packages/protocol/src/generated/")]
pub struct GhostProposal {
    /// The proposal's id in the sidecar, such as `h3`.
    pub id: String,
    pub title: String,
    pub why: Option<String>,
    /// The proposed lines, as the sidecar holds them.
    pub lines: Vec<String>,
    /// The cells the lines would change, clipped to the level and in line order.
    pub cells: Vec<GhostCell>,
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
