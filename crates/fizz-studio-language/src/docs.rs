// The language, documented: one entry for every word a script can use, with its syntax and an example.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The data is `data/docs.en-CA.json`, written by `bun run gen:docs` from the reference's docs module.
// The editor's code completion and the manual read it; the tests keep it complete.

use std::collections::BTreeMap;
use std::sync::OnceLock;

use serde::Deserialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DocKind {
    Statement,
    Section,
    Segment,
    Tile,
    Item,
    Enemy,
    Field,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DocScope {
    Level,
    Overworld,
    Both,
}

/// Which script a word is wanted for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Scope {
    Level,
    Overworld,
}

/// The documentation of one word.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Doc {
    pub word: String,
    pub kind: DocKind,
    pub scope: DocScope,
    /// The section a statement lives in, or `top` for header lines.
    pub section: String,
    pub syntax: String,
    pub example: String,
    pub note: String,
    /// The field names the statement takes, for completion after the word.
    pub fields: Vec<String>,
}

/// A tile word's group, game id and plain-language note.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct TileNote {
    pub word: String,
    pub group: String,
    pub id: u8,
    pub note: String,
}

/// The whole data file: what the generator wrote, in the order it wrote it.
#[derive(Debug, Deserialize)]
pub struct DocData {
    pub docs: Vec<Doc>,
    #[serde(rename = "fieldNotes")]
    pub field_notes: BTreeMap<String, String>,
    #[serde(rename = "tileNotes")]
    pub tile_notes: Vec<TileNote>,
    /// The `kind:word` of each entry the reference returns for a level, in order.
    #[serde(rename = "forLevel")]
    pub for_level: Vec<String>,
    /// The same for an overworld.
    #[serde(rename = "forOverworld")]
    pub for_overworld: Vec<String>,
}

static DATA: OnceLock<DocData> = OnceLock::new();

/// The documentation data, parsed once.
pub fn data() -> &'static DocData {
    DATA.get_or_init(|| {
        serde_json::from_str(include_str!("../data/docs.en-CA.json"))
            .expect("docs.en-CA.json is generated valid")
    })
}

/// Every entry, in the order the language lists them.
pub fn docs() -> &'static [Doc] {
    &data().docs
}

/// What each field name means.
pub fn field_notes() -> &'static BTreeMap<String, String> {
    &data().field_notes
}

/// Every word the language knows for `scope`, grouped as the reference orders them, for completion.
pub fn docs_for(scope: Scope) -> Vec<&'static Doc> {
    docs()
        .iter()
        .filter(|d| {
            d.scope == DocScope::Both
                || matches!(
                    (d.scope, scope),
                    (DocScope::Level, Scope::Level) | (DocScope::Overworld, Scope::Overworld)
                )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse;
    use crate::tables::{words, ITEMS, KINDS, SEGS, TILES};

    fn has(word: &str, scope: Option<Scope>) -> bool {
        docs().iter().any(|d| {
            d.word == word
                && match scope {
                    None => true,
                    Some(Scope::Level) => matches!(d.scope, DocScope::Level | DocScope::Both),
                    Some(Scope::Overworld) => {
                        matches!(d.scope, DocScope::Overworld | DocScope::Both)
                    }
                }
        })
    }

    #[test]
    fn every_tile_item_enemy_and_terrain_word_has_an_entry() {
        for table in [TILES, ITEMS, KINDS, SEGS] {
            for word in words(table) {
                assert!(has(word, None), "{word} has no entry");
            }
        }
    }

    #[test]
    fn every_statement_the_parser_takes_has_an_entry() {
        let level = [
            "level",
            "theme",
            "area",
            "start",
            "arena",
            "walls",
            "liquid",
            "plat",
            "hover",
            "channel",
            "crystal",
            "room",
            "secret-room",
            "wall-behind",
            "mural",
            "ladder",
            "stairs-right",
            "stairs-left",
            "vine-nook",
            "row",
            "pogo-cache",
            "paint",
            "clear",
            "place",
            "terrain",
            "blocks",
            "treats",
            "enemies",
            "edits",
        ];
        for word in level {
            assert!(has(word, Some(Scope::Level)), "{word} has no level entry");
        }
        for word in [
            "overworld",
            "path",
            "scatter",
            "level",
            "tele",
            "saucer",
            "sign",
            "points",
            "start",
            "area",
        ] {
            assert!(
                has(word, Some(Scope::Overworld)),
                "{word} has no overworld entry"
            );
        }
    }

    #[test]
    fn every_entry_has_a_syntax_an_example_and_a_note() {
        for d in docs() {
            assert!(!d.syntax.is_empty() && !d.example.is_empty() && !d.note.is_empty());
        }
    }

    #[test]
    fn every_field_a_statement_lists_is_described() {
        for d in docs() {
            for f in &d.fields {
                assert!(field_notes().contains_key(f), "{f} has no note");
            }
        }
    }

    #[test]
    fn every_tile_word_has_a_note_with_a_unique_id() {
        let notes = &data().tile_notes;
        let mut ids = std::collections::BTreeSet::new();
        for word in words(TILES) {
            assert!(notes.iter().any(|n| n.word == word), "{word} has no note");
        }
        for n in notes {
            assert!(ids.insert(n.id), "tile id {} is used twice", n.id);
        }
    }

    #[test]
    fn level_examples_that_stand_alone_parse() {
        let head =
            "level \"T\" 200x100 ground=4 id=crater\nstart 3,4\nterrain\n  flat 100\nblocks\n";
        for word in [
            "plat",
            "hover",
            "channel",
            "room",
            "secret-room",
            "wall-behind",
            "mural",
            "ladder",
            "stairs-right",
            "stairs-left",
        ] {
            let doc = docs()
                .iter()
                .find(|d| d.word == word && d.scope == DocScope::Level)
                .expect("an entry");
            let result = parse(&format!("{head}  {}\n", doc.example));
            assert!(result.errors.is_empty(), "{word}: {:?}", result.errors);
        }
    }

    #[test]
    fn docs_for_splits_level_and_overworld_words() {
        assert!(docs_for(Scope::Overworld)
            .iter()
            .any(|d| d.word == "scatter"));
        assert!(!docs_for(Scope::Level).iter().any(|d| d.word == "scatter"));
    }

    #[test]
    fn docs_for_matches_the_reference_order() {
        let key = |d: &&Doc| {
            let kind = match d.kind {
                DocKind::Statement => "statement",
                DocKind::Section => "section",
                DocKind::Segment => "segment",
                DocKind::Tile => "tile",
                DocKind::Item => "item",
                DocKind::Enemy => "enemy",
                DocKind::Field => "field",
            };
            format!("{kind}:{}", d.word)
        };
        let level: Vec<String> = docs_for(Scope::Level).iter().map(key).collect();
        let overworld: Vec<String> = docs_for(Scope::Overworld).iter().map(key).collect();
        assert_eq!(level, data().for_level);
        assert_eq!(overworld, data().for_overworld);
    }
}
