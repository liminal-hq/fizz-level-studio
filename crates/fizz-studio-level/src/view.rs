// The view of a level: the grid, the things on it, and the script's problems, worked out from the text
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::collections::HashMap;

use fizz_studio_language::messages::message;
use fizz_studio_language::parser::parse;
use fizz_studio_language::raster::rasterise;
use fizz_studio_language::tables::{words, TILES};
use fizz_studio_protocol::{LevelView, ViewDiagnostic, ViewItem, ViewSpawn, ViewStart};
use fizz_studio_session::Document;

use crate::LevelDocument;

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
                })
                .collect(),
            start: world.start.map(|s| ViewStart { x: s.x, y: s.y }),
            diagnostics,
        }
    }
}
