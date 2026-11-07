// Which layers are locked, as the level's `<level>.studio.json` sidecar keeps them
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// The lock lives in the sidecar's `layers.locked` list of layer ids, which travels with the level
// and which the MCP server reads again before every edit. The studio is the only writer of that
// key: it rewrites the file keeping every other key (and their order), and the server keeps the key
// whenever it writes the rest.

use indexmap::IndexMap;
use serde_json::{json, Map, Value};

use crate::layers::LAYER_ORDER;

/// The locked layers a sidecar's text names, as known layer ids in panel order. A sidecar that is
/// not JSON, or has no `layers.locked` list, locks nothing; a word that is not a layer is ignored.
pub fn locked_layers(sidecar: &str) -> Vec<String> {
    let Ok(Value::Object(root)) = serde_json::from_str::<Value>(sidecar) else {
        return Vec::new();
    };
    let named: Vec<&str> = root
        .get("layers")
        .and_then(|layers| layers.get("locked"))
        .and_then(Value::as_array)
        .map(|list| list.iter().filter_map(Value::as_str).collect())
        .unwrap_or_default();
    LAYER_ORDER
        .into_iter()
        .filter(|id| named.contains(id))
        .map(str::to_owned)
        .collect()
}

/// The sidecar's text with `layers.locked` set to `locked` and every other key as it was. `existing`
/// is the file's current text, or `None` when there is no file. `Ok(None)` means nothing needs
/// writing (no file and nothing locked). A file that is not a JSON object is an error, so the
/// studio never overwrites a sidecar it cannot read.
pub fn sidecar_with_locks(
    existing: Option<&str>,
    locked: &[String],
) -> Result<Option<String>, String> {
    let mut root: IndexMap<String, Value> = match existing {
        None if locked.is_empty() => return Ok(None),
        None => IndexMap::new(),
        Some(text) => serde_json::from_str(text).map_err(|_| {
            "the sidecar file is not a JSON object, so the lock was not saved".to_owned()
        })?,
    };
    let ids: Vec<Value> = LAYER_ORDER
        .into_iter()
        .filter(|id| locked.iter().any(|l| l == id))
        .map(|id| json!(id))
        .collect();
    if ids.is_empty() {
        if let Some(Value::Object(layers)) = root.get_mut("layers") {
            layers.remove("locked");
            if layers.is_empty() {
                root.shift_remove("layers");
            }
        }
    } else {
        let layers = root
            .entry("layers".to_owned())
            .or_insert_with(|| Value::Object(Map::new()));
        match layers {
            Value::Object(map) => {
                map.insert("locked".to_owned(), Value::Array(ids));
            }
            other => *other = json!({ "locked": ids }),
        }
    }
    let mut text = serde_json::to_string_pretty(&root).map_err(|e| e.to_string())?;
    text.push('\n');
    Ok(Some(text))
}

#[cfg(test)]
mod tests {
    use super::*;

    const MCP: &str = r#"{
  "version": 1,
  "mode": "propose",
  "nextId": 3,
  "nextNote": 1,
  "history": [],
  "notes": []
}
"#;

    #[test]
    fn reads_the_known_layers_in_panel_order() {
        let text = r#"{"layers":{"locked":["edits","treats","nonsense",7]}}"#;
        assert_eq!(locked_layers(text), ["treats", "edits"]);
    }

    #[test]
    fn a_sidecar_that_says_nothing_or_is_broken_locks_nothing() {
        for text in [
            "",
            "not json",
            "[]",
            "{}",
            r#"{"layers":{}}"#,
            r#"{"layers":{"locked":"treats"}}"#,
        ] {
            assert!(locked_layers(text).is_empty(), "{text}");
        }
    }

    #[test]
    fn adds_the_key_last_and_keeps_every_other_key_in_order() {
        let written = sidecar_with_locks(Some(MCP), &["treats".to_owned()])
            .unwrap()
            .unwrap();
        assert_eq!(
            written,
            MCP.replace(
                "  \"notes\": []\n}",
                "  \"notes\": [],\n  \"layers\": {\n    \"locked\": [\n      \"treats\"\n    ]\n  }\n}"
            )
        );
        assert_eq!(locked_layers(&written), ["treats"]);
    }

    #[test]
    fn removing_the_last_lock_removes_the_key_and_gives_back_the_file() {
        let locked = sidecar_with_locks(Some(MCP), &["treats".to_owned()])
            .unwrap()
            .unwrap();
        let back = sidecar_with_locks(Some(&locked), &[]).unwrap().unwrap();
        assert_eq!(back, MCP);
    }

    #[test]
    fn keeps_other_keys_inside_layers_and_writes_ids_in_panel_order() {
        let text = r#"{"layers":{"future":1}}"#;
        let written = sidecar_with_locks(Some(text), &["edits".to_owned(), "terrain".to_owned()])
            .unwrap()
            .unwrap();
        let value: Value = serde_json::from_str(&written).unwrap();
        assert_eq!(value["layers"]["future"], 1);
        assert_eq!(value["layers"]["locked"], json!(["terrain", "edits"]));
    }

    #[test]
    fn with_no_file_nothing_locked_writes_nothing_and_a_lock_makes_one() {
        assert_eq!(sidecar_with_locks(None, &[]).unwrap(), None);
        let made = sidecar_with_locks(None, &["enemies".to_owned()])
            .unwrap()
            .unwrap();
        assert_eq!(locked_layers(&made), ["enemies"]);
        assert!(made.ends_with("}\n"));
    }

    #[test]
    fn a_file_that_is_not_an_object_is_never_overwritten() {
        for text in ["", "nonsense", "[1]"] {
            assert!(
                sidecar_with_locks(Some(text), &["edits".to_owned()]).is_err(),
                "{text}"
            );
        }
    }
}
