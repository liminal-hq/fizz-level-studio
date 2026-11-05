// The script line that last set a cell
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use fizz_studio_language::ast::Ast;
use fizz_studio_language::parser::parse;
use fizz_studio_language::raster::{rasterise, World};
use fizz_studio_session::Document;

use crate::LevelDocument;

/// Everything the script has put on one cell, to tell when a statement changed it.
#[derive(PartialEq)]
struct Here {
    tile: Option<String>,
    items: Vec<(String, i64, i64)>,
    spawns: Vec<(String, i64, Option<i64>)>,
    start: bool,
}

impl Here {
    /// True when the cell holds nothing but empty space.
    fn is_bare(&self) -> bool {
        self.tile.as_deref().is_none_or(|t| t == "empty")
            && self.items.is_empty()
            && self.spawns.is_empty()
            && !self.start
    }
}

fn here(world: &World, x: i64, y: i64) -> Here {
    let tile = (x >= 0 && y >= 0 && (x as usize) < world.w && (y as usize) < world.h)
        .then(|| world.tiles[y as usize * world.w + x as usize].clone());
    Here {
        tile,
        items: world
            .items
            .iter()
            .map(|i| (i.kind.clone(), i.x.floor() as i64, i.y.floor() as i64))
            .filter(|i| i.1 == x && i.2 == y)
            .collect(),
        spawns: world
            .spawns
            .iter()
            .map(|s| {
                (
                    s.kind.clone(),
                    s.x.floor() as i64,
                    s.y.map(|y| y.floor() as i64),
                )
            })
            .filter(|s| s.1 == x && s.2.is_none_or(|sy| sy == y))
            .collect(),
        start: world
            .start
            .as_ref()
            .is_some_and(|s| s.x.floor() as i64 == x && s.y.floor() as i64 == y),
    }
}

impl LevelDocument {
    /// The line (counted from 1) of the last statement that changed what is on the cell, in file
    /// order: the paint, item, spawn or start that left it as it is now. `None` when the script
    /// makes no level or nothing in the script touches the cell. A later statement that repaints
    /// the same tile does not change the cell, so it is not the answer.
    pub fn cell_line(&self, x: i64, y: i64) -> Option<u32> {
        let parsed = parse(self.text());
        let nodes = &parsed.ast.nodes;
        let last = here(&rasterise(&parsed.ast)?, x, y);
        // Walk back through the prefixes of the script until the cell differs from its final state.
        for count in (1..=nodes.len()).rev() {
            let prefix = Ast {
                nodes: nodes[..count - 1].to_vec(),
            };
            let before = rasterise(&prefix).map(|world| here(&world, x, y));
            if before.as_ref() != Some(&last) {
                if before.is_none() && last.is_bare() {
                    return None;
                }
                return Some(nodes[count - 1].line as u32);
            }
        }
        None
    }
}
