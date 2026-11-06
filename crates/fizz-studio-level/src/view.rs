// The view of a level: the grid, the things on it, and the script's problems, worked out from the text
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::collections::HashMap;

use fizz_studio_language::messages::message;
use fizz_studio_language::parser::parse;
use fizz_studio_language::raster::{rasterise, World};
use fizz_studio_language::tables::{words, TILES};
use fizz_studio_protocol::{LevelView, ViewDiagnostic, ViewItem, ViewMarker, ViewSpawn, ViewStart};
use fizz_studio_session::Document;

use crate::LevelDocument;

/// The tiles the objects list shows as things of their own.
const MARKER_TILES: [&str; 4] = ["exit", "red-door", "blue-door", "green-door"];

/// A rasteriser line as the view carries it: `None` for 0, which no statement has.
fn line(line: usize) -> Option<u32> {
    (line > 0).then(|| u32::try_from(line).ok()).flatten()
}

/// Every exit and door in the grid, one per column of like cells set by the same line, in column
/// order and then from the bottom up.
fn markers(world: &World) -> Vec<ViewMarker> {
    let mut out = Vec::new();
    for x in 0..world.w {
        let mut y = 0;
        while y < world.h {
            let at = y * world.w + x;
            let kind = &world.tiles[at];
            if !MARKER_TILES.contains(&kind.as_str()) {
                y += 1;
                continue;
            }
            let from = y;
            while y < world.h
                && world.tiles[y * world.w + x] == *kind
                && world.lines[y * world.w + x] == world.lines[at]
            {
                y += 1;
            }
            out.push(ViewMarker {
                kind: kind.clone(),
                x: x as f64,
                y: from as f64,
                height: (y - from) as u32,
                line: line(world.lines[at]),
            });
        }
    }
    out
}

impl LevelDocument {
    /// The level as the canvas draws it. A script that does not make a level (no readable header)
    /// still gives its diagnostics, with an empty grid. The palette is every tile word in the
    /// language's order, `empty` first, so a cell's index means the same after every edit.
    pub fn view(&self) -> LevelView {
        let parsed = parse(self.text());
        let diagnostics = parsed
            .errors
            .iter()
            .map(|d| ViewDiagnostic {
                line: d.line as u32,
                code: d.code.to_string(),
                message: message(d),
            })
            .collect();
        let mut palette: Vec<String> = words(TILES).into_iter().map(String::from).collect();
        let Some(world) = rasterise(&parsed.ast) else {
            return LevelView {
                width: 0,
                height: 0,
                name: String::new(),
                palette,
                cells: Vec::new(),
                items: Vec::new(),
                spawns: Vec::new(),
                start: None,
                markers: Vec::new(),
                diagnostics,
            };
        };
        let mut index: HashMap<String, u16> = palette
            .iter()
            .enumerate()
            .map(|(i, word)| (word.clone(), i as u16))
            .collect();
        let cells = world
            .tiles
            .iter()
            .map(|word| {
                *index.entry(word.clone()).or_insert_with(|| {
                    palette.push(word.clone());
                    (palette.len() - 1) as u16
                })
            })
            .collect();
        let markers = markers(&world);
        LevelView {
            width: world.w as u32,
            height: world.h as u32,
            name: world.name,
            palette,
            cells,
            items: world
                .items
                .into_iter()
                .map(|i| ViewItem {
                    kind: i.kind,
                    x: i.x,
                    y: i.y,
                    line: line(i.line),
                })
                .collect(),
            spawns: world
                .spawns
                .into_iter()
                .map(|s| ViewSpawn {
                    kind: s.kind,
                    x: s.x,
                    y: s.y,
                    dir: s.dir,
                    ride: s.ride,
                    line: line(s.line),
                })
                .collect(),
            start: world.start.map(|s| ViewStart {
                x: s.x,
                y: s.y,
                line: line(s.line),
            }),
            markers,
            diagnostics,
        }
    }
}
