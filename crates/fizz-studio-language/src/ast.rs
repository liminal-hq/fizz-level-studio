// The Fizz script AST: one node per source line, each with its line number and original text.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use crate::js::serialize_number;
use serde::Serialize;

/// A decimal number with its source spelling, so floats print as written.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Num {
    #[serde(serialize_with = "serialize_number")]
    pub value: f64,
    pub text: String,
}

/// An inclusive integer range; a single number is `lo == hi`.
///
/// The bounds are `f64` because the language reads whole numbers as JavaScript numbers, so a value
/// past 2^53 rounds and one past 1.8e308 becomes infinite, exactly as in the reference parser.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Range {
    #[serde(serialize_with = "serialize_number")]
    pub lo: f64,
    #[serde(serialize_with = "serialize_number")]
    pub hi: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SectionName {
    Terrain,
    Blocks,
    Treats,
    Enemies,
    Edits,
}

impl SectionName {
    /// The section headers, in the order the language lists them.
    pub const ALL: [SectionName; 5] = [
        SectionName::Terrain,
        SectionName::Blocks,
        SectionName::Treats,
        SectionName::Enemies,
        SectionName::Edits,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            SectionName::Terrain => "terrain",
            SectionName::Blocks => "blocks",
            SectionName::Treats => "treats",
            SectionName::Enemies => "enemies",
            SectionName::Edits => "edits",
        }
    }

    pub fn from_word(word: &str) -> Option<SectionName> {
        SectionName::ALL.into_iter().find(|s| s.as_str() == word)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Right,
    Left,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RectOp {
    Room,
    SecretRoom,
    WallBehind,
}

impl RectOp {
    pub fn as_str(self) -> &'static str {
        match self {
            RectOp::Room => "room",
            RectOp::SecretRoom => "secret-room",
            RectOp::WallBehind => "wall-behind",
        }
    }
}

/// One terrain segment of a `segs` line: a segment word and its count.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Seg {
    pub seg: String,
    #[serde(serialize_with = "serialize_number")]
    pub n: f64,
}

/// What a line says. Serialises with a `type` tag, to the same JSON the TypeScript parser records.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum Body {
    Blank,
    Comment,
    Error {
        code: String,
    },
    Level {
        name: String,
        #[serde(serialize_with = "serialize_number")]
        w: f64,
        #[serde(serialize_with = "serialize_number")]
        h: f64,
        #[serde(serialize_with = "serialize_number")]
        ground: f64,
        id: String,
    },
    Theme {
        name: String,
    },
    Area {
        name: String,
    },
    Start {
        x: Num,
        y: Num,
    },
    Arena {
        x: Range,
        floor: Num,
    },
    Walls,
    Section {
        name: SectionName,
    },
    Segs {
        segs: Vec<Seg>,
    },
    Liquid {
        tile: String,
    },
    Tile {
        tile: String,
        x: Range,
        y: Range,
    },
    Plat {
        x: Range,
        #[serde(serialize_with = "serialize_number")]
        y: f64,
    },
    Hover {
        from: [Num; 2],
        to: [Num; 2],
        speed: Num,
        size: Option<[Num; 2]>,
        dwell: Option<Num>,
    },
    Channel {
        chs: Vec<u8>,
        on: bool,
    },
    Crystal {
        xs: Vec<Range>,
    },
    Rect {
        op: RectOp,
        x: Range,
        y: Range,
    },
    Mural {
        #[serde(serialize_with = "serialize_number")]
        x: f64,
        #[serde(serialize_with = "serialize_number")]
        y: f64,
    },
    Ladder {
        #[serde(serialize_with = "serialize_number")]
        x: f64,
        y: Range,
    },
    Stairs {
        side: Side,
        #[serde(serialize_with = "serialize_number")]
        x: f64,
        #[serde(serialize_with = "serialize_number")]
        y: f64,
        #[serde(serialize_with = "serialize_number")]
        count: f64,
    },
    VineNook {
        #[serde(serialize_with = "serialize_number")]
        x: f64,
        #[serde(serialize_with = "serialize_number")]
        foot: f64,
        #[serde(serialize_with = "serialize_number")]
        shelf: f64,
        #[serde(serialize_with = "serialize_number")]
        dir: f64,
        #[serde(serialize_with = "serialize_number")]
        depth: f64,
        #[serde(serialize_with = "serialize_number")]
        h: f64,
    },
    Item {
        kind: String,
        xs: Vec<Range>,
        #[serde(serialize_with = "serialize_number")]
        y: f64,
    },
    Row {
        kind: String,
        x: Range,
        #[serde(serialize_with = "serialize_number")]
        y: f64,
        #[serde(serialize_with = "serialize_number")]
        by: f64,
    },
    PogoCache {
        x: Range,
        #[serde(serialize_with = "serialize_number")]
        rise: f64,
    },
    Spawn {
        kind: String,
        xs: Vec<Num>,
        y: Option<Num>,
        dir: Option<Num>,
        ride: bool,
    },
    Paint {
        tile: String,
        xs: Vec<Range>,
        ys: Vec<Range>,
    },
    Clear {
        xs: Vec<Range>,
        ys: Vec<Range>,
    },
    Place {
        kind: String,
        xs: Vec<Range>,
        ys: Vec<Range>,
    },
}

/// A line of the script: what it says, where it is, and its original text.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Node {
    #[serde(flatten)]
    pub body: Body,
    /// The 1-based line number in the source (for appended nodes, the line they print on).
    pub line: usize,
    /// The source text of the line, or `None` for a node built in memory.
    pub raw: Option<String>,
    /// The trailing `// ...` comment, without the slashes.
    pub comment: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Ast {
    pub nodes: Vec<Node>,
}
