// The view of a Fizz 2 level: the map as a grid, the start, and the dialect's diagnostics in English
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_dialect::stub::ProvisionalDialect;
use fizz_studio_dialect::{Diagnostic, Fizz2Document, Fizz2Syntax};
use fizz_studio_protocol::{LevelView, ViewDiagnostic, ViewStart};
use fizz_studio_session::Document;

use crate::Fizz2LevelDocument;

/// The English text for a diagnostic's catalogue key, with its arguments filled in.
fn message(d: &Diagnostic) -> String {
    let arg = |n: usize| d.args.get(n).map_or("", String::as_str);
    match d.key {
        "dialect.unknown_version" => format!(
            "This target does not read `{} {}` on the script line.",
            arg(0),
            arg(1)
        ),
        "map.row_count" => format!(
            "The map has {} rows, but the level line says {}.",
            arg(0),
            arg(1)
        ),
        "map.row_width" => format!(
            "This map row is {} cells wide, but the level line says {}.",
            arg(0),
            arg(1)
        ),
        "map.unknown_letter" => format!("`{}` is not in this target's map legend.", arg(0)),
        _ => format!("{} ({})", d.code, d.key),
    }
}

/// The quoted name on the `level` line.
fn level_name(text: &str) -> String {
    text.lines()
        .map(str::trim)
        .find(|l| l.split_whitespace().next() == Some("level"))
        .and_then(|l| {
            let open = l.find('"')?;
            let close = l[open + 1..].find('"')?;
            Some(l[open + 1..open + 1 + close].to_owned())
        })
        .unwrap_or_default()
}

/// The `X,Y` of the `start` line, and that line counted from 1.
fn start(text: &str) -> Option<ViewStart> {
    let (index, line) = text
        .lines()
        .map(str::trim)
        .enumerate()
        .find(|(_, l)| l.split_whitespace().next() == Some("start"))?;
    let (x, y) = line.split_whitespace().nth(1)?.split_once(',')?;
    Some(ViewStart {
        x: x.parse().ok()?,
        y: y.parse().ok()?,
        line: u32::try_from(index + 1).ok(),
    })
}

impl Fizz2LevelDocument {
    /// The level as the canvas draws it. The palette is the legend's tile names lowercased with
    /// `empty` first; a letter the legend does not know shows as empty and has a diagnostic.
    pub fn view(&self) -> LevelView {
        let parsed = ProvisionalDialect.parse(self.text(), &self.profile);
        let mut palette = vec!["empty".to_string()];
        for entry in &self.profile.legend {
            let word = entry.tile.to_lowercase();
            if !palette.contains(&word) {
                palette.push(word);
            }
        }
        let rows = parsed.document.map_rows();
        let width = rows.iter().map(|r| r.chars().count()).max().unwrap_or(0);
        let mut cells = Vec::with_capacity(width * rows.len());
        // Row 0 is the bottom of the level, and the map lists the top row first.
        for row in rows.iter().rev() {
            let mut letters = row.chars();
            for _ in 0..width {
                let word = letters
                    .next()
                    .and_then(|c| self.profile.entry(c))
                    .map(|e| e.tile.to_lowercase());
                let index = word
                    .and_then(|w| palette.iter().position(|p| *p == w))
                    .unwrap_or(0);
                cells.push(index as u16);
            }
        }
        LevelView {
            width: width as u32,
            height: rows.len() as u32,
            name: level_name(self.text()),
            palette,
            cells,
            items: Vec::new(),
            spawns: Vec::new(),
            start: start(self.text()),
            markers: Vec::new(),
            sections: Vec::new(),
            diagnostics: parsed
                .diagnostics
                .iter()
                .map(|d| ViewDiagnostic {
                    line: d.line as u32,
                    code: d.code.to_string(),
                    message: message(d),
                })
                .collect(),
        }
    }
}
