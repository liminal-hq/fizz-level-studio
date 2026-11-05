// The Fizz 2 dialect port: a lossless document with diagnostics, print, and map-row rewrites
//
// Pure Rust with no Tauri. `Fizz2Syntax` is the seam: the provisional dialect in `stub` stands in
// until `fizz-script` (F1) is linked natively (D55). Everything the editor does with a Fizz 2
// level goes through these traits, so the stub can be deleted without the callers changing.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

pub mod stub;

use fizz_studio_profile::Profile;

/// A problem found in a script, at a line and column (both counted from 1).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Diagnostic {
    pub line: usize,
    pub col: usize,
    /// The error code, such as `E103`.
    pub code: &'static str,
    /// The message catalogue key; the arguments fill its placeholders.
    pub key: &'static str,
    pub args: Vec<String>,
}

impl Diagnostic {
    /// The position as `path:line:col`, as the baker reports it.
    pub fn position(&self, path: &str) -> String {
        format!("{path}:{}:{}", self.line, self.col)
    }
}

/// One text change a rewrite made: a whole line replaced.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LinePatch {
    /// The line, counted from 1.
    pub line: usize,
    pub old: String,
    pub new: String,
}

/// Why a map rewrite was refused.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MapError {
    /// The document has no `map` block.
    NoMap,
    /// The cell is outside the map.
    OutOfRange,
    /// The letter is not in the profile's legend.
    UnknownLetter(char),
}

/// A parsed level.
pub trait Fizz2Document {
    /// The text exactly as it was read, with any rewrites applied.
    fn print(&self) -> String;
    /// The dialect and version on the `script` line, when there is one.
    fn dialect(&self) -> Option<(String, u32)>;
    /// The width and height on the `level` line, in tiles.
    fn size(&self) -> Option<(usize, usize)>;
    /// The map rows, top row first, as letters only.
    fn map_rows(&self) -> Vec<String>;
    /// Sets the cell at `x`, `y` (`y` counts up from the bottom), rewriting only that row.
    fn set_cell(
        &mut self,
        x: usize,
        y: usize,
        letter: char,
        profile: &Profile,
    ) -> Result<LinePatch, MapError>;
}

/// A document and what was wrong with it.
pub struct Parsed<D> {
    pub document: D,
    pub diagnostics: Vec<Diagnostic>,
}

/// Reads Fizz 2 scripts.
pub trait Fizz2Syntax {
    type Doc: Fizz2Document;

    /// Parses a script against a profile. A script that cannot be understood still gives a
    /// document that prints back unchanged.
    fn parse(&self, text: &str, profile: &Profile) -> Parsed<Self::Doc>;
}

/// The lists in a `world.fizz` file.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct WorldFile {
    pub name: Option<String>,
    pub id: Option<String>,
    pub pack: Option<String>,
    pub target: Option<String>,
    pub levels: Vec<String>,
    pub defs: Vec<String>,
    pub sprites: Vec<String>,
    pub panels: Vec<String>,
}
