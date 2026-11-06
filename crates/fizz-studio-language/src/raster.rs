// The level rasteriser: runs a parsed script on a grid the way the game's Builder would.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use crate::ast::{Ast, Body, RectOp, Seg, Side};
use crate::ast::{Node, Range};
use crate::js::serialize_number;
use serde::{Serialize, Serializer};

// Coordinates and counts are `f64` throughout, as they are numbers in the reference, so a value that
// is not a small whole number behaves as it does there (it indexes nothing, or rounds).

/// A number that serialises as `JSON.stringify` writes it.
struct Js(f64);

impl Serialize for Js {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serialize_number(&self.0, serializer)
    }
}

fn pair<S: Serializer>(p: &[f64; 2], serializer: S) -> Result<S::Ok, S::Error> {
    [Js(p[0]), Js(p[1])].serialize(serializer)
}

fn opt_number<S: Serializer>(n: &Option<f64>, serializer: S) -> Result<S::Ok, S::Error> {
    n.map(Js).serialize(serializer)
}

fn opt_pair<S: Serializer>(p: &Option<[f64; 2]>, serializer: S) -> Result<S::Ok, S::Error> {
    p.map(|p| [Js(p[0]), Js(p[1])]).serialize(serializer)
}

/// An item (a treat, or a thing placed by an edit) on a cell.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ItemAt {
    pub kind: String,
    #[serde(serialize_with = "serialize_number")]
    pub x: f64,
    #[serde(serialize_with = "serialize_number")]
    pub y: f64,
    /// The script line (counted from 1) of the statement that placed it. Not part of the reference's
    /// output, so it is not serialised.
    #[serde(skip)]
    pub line: usize,
}

/// An enemy or object spawn.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct SpawnAt {
    pub kind: String,
    #[serde(serialize_with = "serialize_number")]
    pub x: f64,
    /// Resolved from the ground height when the line gave no `y=`; `None` when there is no ground there.
    #[serde(serialize_with = "opt_number")]
    pub y: Option<f64>,
    #[serde(serialize_with = "opt_number")]
    pub dir: Option<f64>,
    pub ride: bool,
    /// The script line (counted from 1) of the `spawn` statement. Not serialised.
    #[serde(skip)]
    pub line: usize,
}

/// A moving platform.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct HoverAt {
    #[serde(serialize_with = "pair")]
    pub from: [f64; 2],
    #[serde(serialize_with = "pair")]
    pub to: [f64; 2],
    #[serde(serialize_with = "serialize_number")]
    pub speed: f64,
    #[serde(serialize_with = "opt_pair")]
    pub size: Option<[f64; 2]>,
    #[serde(serialize_with = "opt_number")]
    pub dwell: Option<f64>,
}

/// Where Ben starts, in tiles.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct StartAt {
    #[serde(serialize_with = "serialize_number")]
    pub x: f64,
    #[serde(serialize_with = "serialize_number")]
    pub y: f64,
    /// The script line (counted from 1) of the `start` statement that won. Not serialised.
    #[serde(skip)]
    pub line: usize,
}

/// The grid and entity lists a script builds.
#[derive(Debug, Clone, PartialEq)]
pub struct World {
    pub w: usize,
    pub h: usize,
    pub name: String,
    pub id: String,
    pub theme: Option<String>,
    pub area: Option<String>,
    pub ground: f64,
    /// Tile word per cell, index `y * w + x`; row 0 is the bottom.
    pub tiles: Vec<String>,
    /// True where a cell holds a pool liquid rather than a tile from the blocks section.
    pub liquid: Vec<bool>,
    /// The script line (counted from 1) of the last statement that set each cell, index `y * w + x`,
    /// or 0 where no statement did. A statement that sets a cell to the tile it already held still
    /// counts, so this is where the cell was last written, not where it last changed.
    pub lines: Vec<usize>,
    /// The ground height of each column, or -1 where none has been laid.
    pub h_at: Vec<f64>,
    pub items: Vec<ItemAt>,
    pub spawns: Vec<SpawnAt>,
    pub hovers: Vec<HoverAt>,
    /// One bit per switch channel that starts on.
    pub switches: u32,
    pub start: Option<StartAt>,
}

impl World {
    fn empty(w: usize, h: usize, ground: f64) -> World {
        World {
            w,
            h,
            name: String::new(),
            id: String::new(),
            theme: None,
            area: None,
            ground,
            tiles: vec!["empty".to_string(); w * h],
            liquid: vec![false; w * h],
            lines: vec![0; w * h],
            h_at: vec![-1.0; w],
            items: Vec::new(),
            spawns: Vec::new(),
            hovers: Vec::new(),
            switches: 0,
            start: None,
        }
    }
}

struct Builder {
    world: World,
    x: f64,
    ground: f64,
    liquid_tile: String,
    /// The line of the statement being applied, recorded beside what it builds.
    line: usize,
}

impl Builder {
    fn inside(&self, x: f64, y: f64) -> bool {
        x >= 0.0 && y >= 0.0 && x < self.world.w as f64 && y < self.world.h as f64
    }

    fn index(&self, x: f64, y: f64) -> usize {
        (y * self.world.w as f64 + x) as usize
    }

    fn set(&mut self, x: f64, y: f64, tile: &str, liquid: bool) {
        if !self.inside(x, y) {
            return;
        }
        let at = self.index(x, y);
        self.world.tiles[at] = tile.to_string();
        self.world.liquid[at] = liquid;
        self.world.lines[at] = self.line;
    }

    fn get(&self, x: f64, y: f64) -> &str {
        if self.inside(x, y) {
            &self.world.tiles[self.index(x, y)]
        } else {
            "empty"
        }
    }

    fn fill(&mut self, x0: f64, x1: f64, y0: f64, y1: f64, tile: &str, liquid: bool) {
        let mut x = x0;
        while x <= x1 {
            let mut y = y0;
            while y <= y1 {
                self.set(x, y, tile, liquid);
                y += 1.0;
            }
            x += 1.0;
        }
    }

    fn col(&mut self, x: f64, h: f64) {
        self.fill(x, x, 0.0, h - 1.0, "fill", false);
        if x >= 0.0 && x < self.world.w as f64 {
            self.world.h_at[x as usize] = h;
        }
    }

    fn set_h(&mut self, x: f64, v: f64) {
        if x >= 0.0 && x < self.world.w as f64 {
            self.world.h_at[x as usize] = v;
        }
    }

    /// The recorded ground height of the column at `x`, or -1 when there is none.
    fn ground_at(&self, x: f64) -> f64 {
        let x = x.floor();
        if x >= 0.0 && x < self.world.h_at.len() as f64 {
            self.world.h_at[x as usize]
        } else {
            -1.0
        }
    }

    fn run(&mut self, segs: &[Seg]) {
        for Seg { seg, n } in segs {
            let mut i = 0.0;
            while i < *n {
                i += 1.0;
                let x = self.x;
                let g = self.ground;
                match seg.as_str() {
                    "flat" => {
                        self.col(x, g);
                        self.x += 1.0;
                    }
                    "up" => {
                        self.col(x, g);
                        self.set(x, g, "slope-r45", false);
                        self.set_h(x, g + 0.5);
                        self.x += 1.0;
                        self.ground += 1.0;
                    }
                    "down" => {
                        self.ground -= 1.0;
                        let g = self.ground;
                        self.col(x, g);
                        self.set(x, g, "slope-l45", false);
                        self.set_h(x, g + 0.5);
                        self.x += 1.0;
                    }
                    "up22" => {
                        self.col(x, g);
                        self.set(x, g, "slope-r22a", false);
                        self.col(x + 1.0, g);
                        self.set(x + 1.0, g, "slope-r22b", false);
                        self.x += 2.0;
                        self.ground += 1.0;
                    }
                    "down22" => {
                        self.ground -= 1.0;
                        let g = self.ground;
                        self.col(x, g);
                        self.set(x, g, "slope-l22a", false);
                        self.col(x + 1.0, g);
                        self.set(x + 1.0, g, "slope-l22b", false);
                        self.x += 2.0;
                    }
                    "gap" => self.x += 1.0,
                    "pool" => {
                        self.set(x, 0.0, "fill", false);
                        let liquid = self.liquid_tile.clone();
                        self.fill(x, x, 1.0, g - 2.0, &liquid, true);
                        self.set_h(x, g - 1.0);
                        self.x += 1.0;
                    }
                    "spikes" => {
                        self.col(x, g);
                        self.set(x, g, "spike", false);
                        self.x += 1.0;
                    }
                    "belt-r" | "belt-l" => {
                        self.col(x, g);
                        let belt = if seg == "belt-r" {
                            "conveyor-r"
                        } else {
                            "conveyor-l"
                        };
                        self.set(x, g - 1.0, belt, false);
                        self.x += 1.0;
                    }
                    _ => {}
                }
            }
        }
    }

    fn item(&mut self, kind: &str, x: f64, y: f64) {
        self.world.items.push(ItemAt {
            kind: kind.to_string(),
            x,
            y,
            line: self.line,
        });
    }

    fn crys(&mut self, x: f64) {
        let y = self.ground_at(x).ceil();
        self.set(x, y, "crystal-tile", false);
    }
}

/// Every whole number the ranges cover, in order.
fn cells(ranges: &[Range]) -> Vec<f64> {
    let mut out = Vec::new();
    for r in ranges {
        let mut v = r.lo;
        while v <= r.hi {
            out.push(v);
            v += 1.0;
        }
    }
    out
}

/// Runs the script in file order, as the Builder would, and returns the grid and entity lists.
/// Returns `None` when the script has no level header.
pub fn rasterise(ast: &Ast) -> Option<World> {
    let (name, w, h, ground, id) = ast.nodes.iter().find_map(|n| match &n.body {
        Body::Level {
            name,
            w,
            h,
            ground,
            id,
        } => Some((name, *w, *h, *ground, id)),
        _ => None,
    })?;
    let mut world = World::empty(w as usize, h as usize, ground);
    world.name = name.clone();
    world.id = id.clone();
    let mut b = Builder {
        world,
        x: 0.0,
        ground,
        liquid_tile: "choc".to_string(),
        line: 0,
    };
    for n in &ast.nodes {
        b.line = n.line;
        apply(&mut b, n);
    }
    Some(b.world)
}

fn apply(b: &mut Builder, n: &Node) {
    let w = b.world.w as f64;
    let h = b.world.h as f64;
    match &n.body {
        Body::Theme { name } => b.world.theme = Some(name.clone()),
        Body::Area { name } => b.world.area = Some(name.clone()),
        Body::Start { x, y } => {
            b.world.start = Some(StartAt {
                x: x.value,
                y: y.value,
                line: b.line,
            })
        }
        Body::Walls => {
            b.fill(0.0, 0.0, 0.0, h - 1.0, "block", false);
            b.fill(w - 1.0, w - 1.0, 0.0, h - 1.0, "block", false);
        }
        Body::Segs { segs } => b.run(segs),
        Body::Liquid { tile } => b.liquid_tile = tile.clone(),
        Body::Tile { tile, x, y } => b.fill(x.lo, x.hi, y.lo, y.hi, tile, false),
        Body::Plat { x, y } => b.fill(x.lo, x.hi, *y, *y, "one-way", false),
        Body::Hover {
            from,
            to,
            speed,
            size,
            dwell,
        } => b.world.hovers.push(HoverAt {
            from: [from[0].value, from[1].value],
            to: [to[0].value, to[1].value],
            speed: speed.value,
            size: size.as_ref().map(|s| [s[0].value, s[1].value]),
            dwell: dwell.as_ref().map(|d| d.value),
        }),
        Body::Channel { chs, on } => {
            for c in chs {
                // JavaScript shifts by the count modulo 32, which `wrapping_shl` does too.
                let bit = 1u32.wrapping_shl(u32::from(*c));
                b.world.switches = if *on {
                    b.world.switches | bit
                } else {
                    b.world.switches & !bit
                };
            }
        }
        Body::Crystal { xs } => {
            for x in cells(xs) {
                b.crys(x);
            }
        }
        Body::Rect { op, x, y } => {
            let tile = if *op == RectOp::WallBehind {
                "wall-bg"
            } else {
                "facade"
            };
            let mut cx = x.lo;
            while cx <= x.hi {
                let mut cy = y.lo;
                while cy <= y.hi {
                    if b.get(cx, cy) == "empty" {
                        b.set(cx, cy, tile, false);
                    }
                    cy += 1.0;
                }
                cx += 1.0;
            }
        }
        Body::Mural { x, y } => {
            b.fill(*x, x + 2.0, *y, y + 1.0, "mural-part", false);
            b.set(*x, *y, "mural-origin", false);
        }
        Body::Ladder { x, y } => {
            b.fill(*x, *x, y.lo, y.hi - 1.0, "rung", false);
            b.set(*x, y.hi, "rung-top", false);
        }
        Body::Stairs { side, x, y, count } => {
            let mut i = 0.0;
            while i < *count {
                if *side == Side::Right {
                    b.fill(x + i, x + i, *y, y + i - 1.0, "fill", false);
                    b.set(x + i, y + i, "slope-r45", false);
                } else {
                    let rise = count - 1.0 - i;
                    b.fill(x + i, x + i, *y, y + rise - 1.0, "fill", false);
                    b.set(x + i, y + rise, "slope-l45", false);
                }
                i += 1.0;
            }
        }
        Body::VineNook {
            x,
            foot,
            shelf,
            dir,
            depth,
            h: height,
        } => {
            let far = x + dir * (3.0 + depth);
            let x0 = x.min(far);
            let x1 = x.max(far);
            b.fill(x0, x1, shelf - 2.0, shelf - 1.0, "fill", false);
            b.fill(x0, x1, *shelf, shelf + height - 1.0, "empty", false);
            let cx = x + dir * 3.0;
            b.fill(cx, cx, *shelf, shelf + height - 1.0, "cracked", false);
            b.fill(*x, *x, *foot, shelf + 1.0, "vine", false);
        }
        Body::Item { kind, xs, y } => {
            for x in cells(xs) {
                b.item(kind, x, *y);
            }
        }
        Body::Row { kind, x, y, by } => {
            let mut cx = x.lo;
            while cx <= x.hi {
                b.item(kind, cx, *y);
                cx += by;
            }
        }
        Body::PogoCache { x, rise } => {
            let stand = b.ground_at(x.lo).trunc() + rise;
            b.fill(x.lo, x.hi, stand - 1.0, stand - 1.0, "one-way", false);
            b.item("cookie", x.lo + 1.0, stand);
            b.item("cheezie", x.lo, stand);
            b.item("cheezie", x.hi, stand);
        }
        Body::Spawn {
            kind,
            xs,
            y,
            dir,
            ride,
        } => {
            for x in xs {
                let at = y.as_ref().map_or_else(|| b.ground_at(x.value), |y| y.value);
                b.world.spawns.push(SpawnAt {
                    kind: kind.clone(),
                    x: x.value,
                    y: (at >= 0.0).then_some(at),
                    dir: dir.as_ref().map(|d| d.value),
                    ride: *ride,
                    line: b.line,
                });
            }
        }
        Body::Paint { tile, xs, ys } => {
            for x in cells(xs) {
                for y in cells(ys) {
                    b.set(x, y, tile, false);
                }
            }
        }
        Body::Clear { xs, ys } => {
            for x in cells(xs) {
                for y in cells(ys) {
                    b.set(x, y, "empty", false);
                }
            }
        }
        Body::Place { kind, xs, ys } => {
            for x in cells(xs) {
                for y in cells(ys) {
                    b.item(kind, x, y);
                }
            }
        }
        _ => {}
    }
}
