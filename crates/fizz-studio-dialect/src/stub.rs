// The provisional Fizz 2 dialect
//
// Stands in for F1 (`fizz-script`) until it is linked natively. It reads the `script` line, the
// `level` size, and the `map` block with the profile's legend, and keeps every other line as raw
// text with no diagnostic. It never lowers a level and never claims a script is valid.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use crate::{Diagnostic, Fizz2Document, Fizz2Syntax, LinePatch, MapError, Parsed, WorldFile};
use fizz_studio_profile::Profile;

/// The provisional dialect.
#[derive(Debug, Default, Clone, Copy)]
pub struct ProvisionalDialect;

/// A level kept as its lines.
#[derive(Debug, Clone)]
pub struct ProvisionalDocument {
    lines: Vec<String>,
    dialect: Option<(String, u32)>,
    size: Option<(usize, usize)>,
    /// The line index of each map row, top row first.
    rows: Vec<usize>,
}

impl Fizz2Syntax for ProvisionalDialect {
    type Doc = ProvisionalDocument;

    fn parse(&self, text: &str, profile: &Profile) -> Parsed<ProvisionalDocument> {
        let lines: Vec<String> = text.split('\n').map(str::to_owned).collect();
        let mut diagnostics = Vec::new();
        let mut dialect = None;
        let mut size = None;
        let mut rows = Vec::new();
        let mut in_map = false;
        let mut map_line = 0;

        for (i, line) in lines.iter().enumerate() {
            let trimmed = line.trim();
            let words: Vec<&str> = trimmed.split_whitespace().collect();
            if dialect.is_none() && words.first() == Some(&"script") && words.len() >= 3 {
                let version = words[2].parse::<u32>().unwrap_or(u32::MAX);
                dialect = Some((words[1].to_owned(), version));
                if !profile.accepts(words[1], version) {
                    let col = line.find(words[2]).map_or(1, |c| c + 1);
                    diagnostics.push(Diagnostic {
                        line: i + 1,
                        col,
                        code: "E101",
                        key: "dialect.unknown_version",
                        args: vec![words[1].to_owned(), words[2].to_owned()],
                    });
                }
            }
            if size.is_none() && words.first() == Some(&"level") {
                size = words.iter().find_map(|w| {
                    let (a, b) = w.split_once('x')?;
                    Some((a.parse().ok()?, b.parse().ok()?))
                });
            }
            if trimmed == "map" {
                in_map = true;
                map_line = i + 1;
                continue;
            }
            if in_map {
                if trimmed.starts_with('|') {
                    rows.push(i);
                } else {
                    in_map = false;
                }
            }
        }

        let document = ProvisionalDocument {
            lines,
            dialect,
            size,
            rows,
        };
        check_map(&document, profile, map_line, &mut diagnostics);
        Parsed {
            document,
            diagnostics,
        }
    }
}

/// The span of the characters between the row's bars, as byte offsets, and the cells it holds.
fn row_span(line: &str) -> Option<(usize, usize)> {
    let start = line.find('|')? + 1;
    let end = start + line[start..].find('|')?;
    Some((start, end))
}

fn check_map(
    doc: &ProvisionalDocument,
    profile: &Profile,
    map_line: usize,
    out: &mut Vec<Diagnostic>,
) {
    let Some((w, h)) = doc.size else { return };
    if doc.rows.is_empty() {
        return;
    }
    if doc.rows.len() != h {
        out.push(Diagnostic {
            line: map_line,
            col: 1,
            code: "E103",
            key: "map.row_count",
            args: vec![doc.rows.len().to_string(), h.to_string()],
        });
    }
    for &i in &doc.rows {
        let line = &doc.lines[i];
        let Some((start, end)) = row_span(line) else {
            continue;
        };
        let cells = &line[start..end];
        let width = cells.chars().count();
        if width != w {
            out.push(Diagnostic {
                line: i + 1,
                col: start + 1,
                code: "E103",
                key: "map.row_width",
                args: vec![width.to_string(), w.to_string()],
            });
        }
        for (n, c) in cells.char_indices() {
            if profile.entry(c).is_none() {
                out.push(Diagnostic {
                    line: i + 1,
                    col: start + n + 1,
                    code: "E104",
                    key: "map.unknown_letter",
                    args: vec![c.to_string()],
                });
            }
        }
    }
}

impl Fizz2Document for ProvisionalDocument {
    fn print(&self) -> String {
        self.lines.join("\n")
    }

    fn dialect(&self) -> Option<(String, u32)> {
        self.dialect.clone()
    }

    fn size(&self) -> Option<(usize, usize)> {
        self.size
    }

    fn map_rows(&self) -> Vec<String> {
        self.rows
            .iter()
            .filter_map(|&i| {
                let line = &self.lines[i];
                row_span(line).map(|(s, e)| line[s..e].to_owned())
            })
            .collect()
    }

    fn set_cell(
        &mut self,
        x: usize,
        y: usize,
        letter: char,
        profile: &Profile,
    ) -> Result<LinePatch, MapError> {
        if self.rows.is_empty() {
            return Err(MapError::NoMap);
        }
        if profile.entry(letter).is_none() {
            return Err(MapError::UnknownLetter(letter));
        }
        if y >= self.rows.len() {
            return Err(MapError::OutOfRange);
        }
        let index = self.rows[self.rows.len() - 1 - y];
        let old = self.lines[index].clone();
        let (start, end) = row_span(&old).ok_or(MapError::OutOfRange)?;
        let cells: Vec<char> = old[start..end].chars().collect();
        if x >= cells.len() {
            return Err(MapError::OutOfRange);
        }
        let mut replaced = cells;
        replaced[x] = letter;
        let new = format!(
            "{}{}{}",
            &old[..start],
            replaced.into_iter().collect::<String>(),
            &old[end..]
        );
        self.lines[index] = new.clone();
        Ok(LinePatch {
            line: index + 1,
            old,
            new,
        })
    }
}

/// Reads a `world.fizz` file's header and lists. Anything it does not recognise is ignored here;
/// the file itself is kept as text by whoever holds it.
pub fn parse_world(text: &str) -> WorldFile {
    let mut world = WorldFile::default();
    for line in text.lines() {
        let trimmed = line.trim();
        let Some((word, rest)) = trimmed.split_once(char::is_whitespace) else {
            continue;
        };
        let rest = rest.trim();
        let list = |s: &str| -> Vec<String> {
            s.split(',')
                .map(|p| p.trim().to_owned())
                .filter(|p| !p.is_empty())
                .collect()
        };
        match word {
            "world" => {
                if let Some(open) = rest.find('"') {
                    if let Some(close) = rest[open + 1..].find('"') {
                        world.name = Some(rest[open + 1..open + 1 + close].to_owned());
                    }
                }
                for token in rest.split_whitespace() {
                    match token.split_once('=') {
                        Some(("id", v)) => world.id = Some(v.to_owned()),
                        Some(("pack", v)) => world.pack = Some(v.to_owned()),
                        Some(("target", v)) => world.target = Some(v.to_owned()),
                        _ => {}
                    }
                }
            }
            "levels" => world.levels = list(rest),
            "defs" => world.defs = list(rest),
            "sprites" => world.sprites = list(rest),
            "panels" => world.panels = list(rest),
            _ => {}
        }
    }
    world
}
