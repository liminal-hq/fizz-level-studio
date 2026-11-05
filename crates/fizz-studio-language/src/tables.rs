// Name tables that map Fizz script words to the Rust names the Builder uses.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/// A table of script word and Builder name pairs, in the order the language documents them.
pub type Table = &'static [(&'static str, &'static str)];

/// Whether `word` is a script word in `table`.
pub fn has(table: Table, word: &str) -> bool {
    table.iter().any(|(w, _)| *w == word)
}

/// The script words of `table`, in order.
pub fn words(table: Table) -> Vec<&'static str> {
    table.iter().map(|(w, _)| *w).collect()
}

/// Terrain segments: script word to the `Seg` variant in `levels.rs`.
pub const SEGS: Table = &[
    ("flat", "Flat"),
    ("up", "Up"),
    ("down", "Down"),
    ("up22", "Up22"),
    ("down22", "Down22"),
    ("gap", "Gap"),
    ("pool", "Pool"),
    ("spikes", "Spikes"),
    ("belt-r", "BeltR"),
    ("belt-l", "BeltL"),
];

/// Tiles: script word to the constant in `tiles.rs`. `empty` is the tile `clear` paints.
pub const TILES: Table = &[
    ("empty", "EMPTY"),
    ("fill", "FILL"),
    ("block", "BLOCK"),
    ("one-way", "PLAT"),
    ("spike", "SPIKE"),
    ("choc", "CHOC"),
    ("slope-r45", "R45"),
    ("slope-l45", "L45"),
    ("slope-r22a", "R22A"),
    ("slope-r22b", "R22B"),
    ("slope-l22a", "L22A"),
    ("slope-l22b", "L22B"),
    ("red-door", "DOOR_R"),
    ("blue-door", "DOOR_B"),
    ("green-door", "DOOR_G"),
    ("bridge", "BRIDGE"),
    ("mural-origin", "MURAL"),
    ("mural-part", "MURAL_PART"),
    ("crystal-tile", "CRYS"),
    ("exit", "EXIT"),
    ("grass", "GRASS"),
    ("path", "PATH"),
    ("river", "RIVER"),
    ("tree", "TREE"),
    ("rock", "ROCK"),
    ("conveyor-l", "CONV_L"),
    ("conveyor-r", "CONV_R"),
    ("furnace", "FURNACE"),
    ("wall-bg", "WALLBG"),
    ("rung", "RUNG"),
    ("rung-top", "RUNG_TOP"),
    ("facade", "FACADE"),
    ("gate", "GATE"),
    ("gate-2", "GATE_2"),
    ("gate-3", "GATE_3"),
    ("vine", "VINE"),
    ("cracked", "CRACKED"),
    ("house-a", "HOUSE_A"),
    ("house-b", "HOUSE_B"),
    ("shop", "SHOP"),
    ("fountain", "FOUNTAIN"),
];

/// Items: script word to the `ItemKind` variant in `ents.rs`.
pub const ITEMS: Table = &[
    ("cheezie", "Cheezie"),
    ("choc", "Choc"),
    ("cookie", "Cookie"),
    ("soda", "Soda"),
    ("key-red", "KeyRed"),
    ("key-blue", "KeyBlue"),
    ("key-green", "KeyGreen"),
    ("usb", "Usb"),
];

/// Spawn kinds: script word to the `Kind` variant in `ents.rs`.
pub const KINDS: Table = &[
    ("gloop", "Gloop"),
    ("hopper", "Hopper"),
    ("marsh", "Marsh"),
    ("beetle", "Beetle"),
    ("bat", "Bat"),
    ("pod", "Pod"),
    ("phantom", "Phantom"),
    ("roller", "Roller"),
    ("sentry", "Sentry"),
    ("drone", "Drone"),
    ("boss", "Boss"),
    ("switch", "Switch"),
    ("terminal", "Terminal"),
    ("cage", "Cage"),
    ("mirror", "Mirror"),
    ("swivel", "Swivel"),
    ("crystal-switch", "CrystalSwitch"),
    ("press", "Press"),
    ("target", "Target"),
    ("glyph", "Glyph"),
    ("cameo", "Cameo"),
];

/// Tiles a `liquid` line may name: the ones `Pool` segments can be filled with.
pub const LIQUIDS: &[&str] = &["choc", "furnace"];

/// One row of the `LEVELS` table in `levels.rs`: `Builder::out` takes the theme and area from it by id.
pub struct LevelDef {
    pub id: &'static str,
    pub rust: &'static str,
    pub theme: &'static str,
    pub area: &'static str,
}

pub const LEVEL_IDS: &[LevelDef] = &[
    LevelDef {
        id: "crater",
        rust: "CRATER",
        theme: "crater",
        area: "crater-fields",
    },
    LevelDef {
        id: "caves",
        rust: "CAVES",
        theme: "caves",
        area: "rock-candy-reach",
    },
    LevelDef {
        id: "citadel",
        rust: "CITADEL",
        theme: "citadel",
        area: "frosting-frontier",
    },
    LevelDef {
        id: "meteor-mesa",
        rust: "METEOR_MESA",
        theme: "open-sky",
        area: "crater-fields",
    },
    LevelDef {
        id: "zarg-lookout",
        rust: "ZARG_LOOKOUT",
        theme: "building",
        area: "crater-fields",
    },
    LevelDef {
        id: "marshmallow-meadows",
        rust: "MARSHMALLOW_MEADOWS",
        theme: "open-sky",
        area: "marshmallow-meadows",
    },
    LevelDef {
        id: "bonbon-playhouse",
        rust: "BONBON_PLAYHOUSE",
        theme: "theatre",
        area: "marshmallow-meadows",
    },
    LevelDef {
        id: "fudge-bog",
        rust: "FUDGE_BOG",
        theme: "crater",
        area: "marshmallow-meadows",
    },
    LevelDef {
        id: "mirror-shafts",
        rust: "MIRROR_SHAFTS",
        theme: "shaft",
        area: "rock-candy-reach",
    },
    LevelDef {
        id: "sugar-glass-gallery",
        rust: "SUGAR_GLASS_GALLERY",
        theme: "theatre",
        area: "rock-candy-reach",
    },
    LevelDef {
        id: "frosting-flats",
        rust: "FROSTING_FLATS",
        theme: "open-sky",
        area: "frosting-frontier",
    },
    LevelDef {
        id: "frosting-spire",
        rust: "FROSTING_SPIRE",
        theme: "building",
        area: "frosting-frontier",
    },
    LevelDef {
        id: "cocoa-foundry",
        rust: "COCOA_FOUNDRY",
        theme: "foundry",
        area: "frosting-frontier",
    },
    LevelDef {
        id: "gumdrop-isle",
        rust: "GUMDROP_ISLE",
        theme: "open-sky",
        area: "gumdrop-isle",
    },
    LevelDef {
        id: "whisper-hollow",
        rust: "WHISPER_HOLLOW",
        theme: "caves",
        area: "rock-candy-reach",
    },
    LevelDef {
        id: "saucer",
        rust: "SAUCER",
        theme: "building",
        area: "crater-fields",
    },
];

/// The row of `LEVEL_IDS` for `id`, if there is one.
pub fn level_def(id: &str) -> Option<&'static LevelDef> {
    LEVEL_IDS.iter().find(|d| d.id == id)
}

pub const THEMES: &[&str] = &[
    "crater", "caves", "citadel", "open-sky", "building", "theatre", "shaft", "foundry",
];
pub const AREAS: &[&str] = &[
    "crater-fields",
    "marshmallow-meadows",
    "rock-candy-reach",
    "frosting-frontier",
    "gumdrop-isle",
];
