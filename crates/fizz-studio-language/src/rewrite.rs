// Rewriting one line of a script in place, keeping its spacing, its alignment and its comment
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

//! The parser keeps no column positions and the printer writes a parsed line back byte for byte, so a
//! structured edit that must keep `soda        x=36 y=5` aligned needs its own look at the line. This
//! module reads one line's text into its leading whitespace, its word, its fields and its trailing
//! comment, and changes one piece at a time: every other byte stays as written. It does not touch the
//! parser, the printer or the rasteriser.
//!
//! A [`Line`] never changes: each operation returns the new text of the line, which the caller reads
//! again with [`Line::new`] if it wants to go on.

use crate::js::is_space;

/// A field of a line: `key=value`, a bare flag such as `ride`, or a positional word such as the
/// `3,4` of `start 3,4`. Offsets are bytes into the line's text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Field {
    /// The key of a `key=value` field; `None` for a flag or a positional word.
    pub key: Option<String>,
    /// The whole token, including the key and the `=`.
    pub start: usize,
    pub end: usize,
    /// The value of a `key=value` field, or the whole token for a flag or a word.
    pub value: (usize, usize),
    /// The comma-separated items of the value, each trimmed of whitespace, as `(start, end)`.
    pub items: Vec<(usize, usize)>,
}

/// One line of a script, read for rewriting.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Line {
    raw: String,
    /// The line ended in `\r`, as a line of a CRLF file does once the text is split on `\n`.
    cr: bool,
    indent_end: usize,
    word: (usize, usize),
    fields: Vec<Field>,
    /// Where the last token ends, so where a new field goes.
    code_end: usize,
    /// Where the `//` of a trailing comment starts.
    comment_start: Option<usize>,
}

/// The byte index of the `//` that starts a trailing comment, ignoring any inside a quoted name. It
/// follows the parser's rule exactly.
fn comment_start(body: &str) -> Option<usize> {
    let bytes = body.as_bytes();
    let mut quoted = false;
    for i in 0..bytes.len().saturating_sub(1) {
        if bytes[i] == b'"' {
            quoted = !quoted;
        }
        if !quoted && bytes[i] == b'/' && bytes[i + 1] == b'/' {
            return Some(i);
        }
    }
    None
}

/// Splits `text[start..end]` at commas into trimmed `(start, end)` items.
fn items_of(text: &str, start: usize, end: usize) -> Vec<(usize, usize)> {
    let mut items = Vec::new();
    let mut from = start;
    for (i, c) in text[start..end].char_indices() {
        if c == ',' {
            items.push(trim_span(text, from, start + i));
            from = start + i + 1;
        }
    }
    items.push(trim_span(text, from, end));
    items
}

fn trim_span(text: &str, start: usize, end: usize) -> (usize, usize) {
    let slice = &text[start..end];
    let lead = slice.len() - slice.trim_start_matches(is_space).len();
    let trimmed = slice.trim_matches(is_space);
    (start + lead, start + lead + trimmed.len())
}

impl Line {
    /// Reads a line's text as the script holds it, with its `\r` if it has one.
    pub fn new(raw: &str) -> Line {
        let cr = raw.ends_with('\r');
        let body = if cr { &raw[..raw.len() - 1] } else { raw };
        let comment_start = comment_start(body);
        let code_limit = comment_start.unwrap_or(body.len());
        let code = &body[..code_limit];
        let indent_end = code.len() - code.trim_start_matches(is_space).len();

        // Tokens run to whitespace, but whitespace beside a comma belongs to the token, as the
        // parser tightens commas before it splits.
        let mut tokens: Vec<(usize, usize)> = Vec::new();
        let mut i = indent_end;
        while i < code.len() {
            let start = i;
            let mut end = i;
            let chars: Vec<(usize, char)> = code[i..].char_indices().collect();
            let mut k = 0;
            while k < chars.len() {
                let (offset, c) = chars[k];
                if is_space(c) {
                    // A run of whitespace: it joins the token when a comma is on either side.
                    let mut run_end = k;
                    while run_end < chars.len() && is_space(chars[run_end].1) {
                        run_end += 1;
                    }
                    let before_comma = k > 0 && chars[k - 1].1 == ',';
                    let after_comma = run_end < chars.len() && chars[run_end].1 == ',';
                    if (before_comma || after_comma) && run_end < chars.len() {
                        k = run_end;
                        continue;
                    }
                    break;
                }
                end = start + offset + c.len_utf8();
                k += 1;
            }
            tokens.push((start, end));
            i = end;
            while let Some(c) = code[i..].chars().next() {
                if is_space(c) {
                    i += c.len_utf8();
                } else {
                    break;
                }
            }
        }

        let word = tokens.first().copied().unwrap_or((indent_end, indent_end));
        let mut fields = Vec::new();
        for &(start, end) in tokens.iter().skip(1) {
            let token = &code[start..end];
            let (key, value_start) = match token.find('=') {
                Some(at) if at > 0 => (Some(token[..at].to_string()), start + at + 1),
                _ => (None, start),
            };
            fields.push(Field {
                key,
                start,
                end,
                value: (value_start, end),
                items: items_of(code, value_start, end),
            });
        }
        let code_end = tokens.last().map_or(indent_end, |t| t.1);
        Line {
            raw: raw.to_string(),
            cr,
            indent_end,
            word,
            fields,
            code_end,
            comment_start,
        }
    }

    /// The line's text as read.
    pub fn raw(&self) -> &str {
        &self.raw
    }

    /// The leading whitespace.
    pub fn indent(&self) -> &str {
        &self.raw[..self.indent_end]
    }

    /// The first word, such as `soda` or `place`.
    pub fn word(&self) -> &str {
        &self.raw[self.word.0..self.word.1]
    }

    /// Every field after the word, in order.
    pub fn fields(&self) -> &[Field] {
        &self.fields
    }

    /// The `key=value` field with this key.
    pub fn field(&self, key: &str) -> Option<&Field> {
        self.fields.iter().find(|f| f.key.as_deref() == Some(key))
    }

    /// The value text of a `key=value` field.
    pub fn value(&self, key: &str) -> Option<&str> {
        self.field(key).map(|f| &self.raw[f.value.0..f.value.1])
    }

    /// The text of one comma-separated item of a field's value.
    pub fn item(&self, key: &str, index: usize) -> Option<&str> {
        let field = self.field(key)?;
        let (s, e) = *field.items.get(index)?;
        Some(&self.raw[s..e])
    }

    /// Whether a bare flag such as `ride` is on the line.
    pub fn has_flag(&self, name: &str) -> bool {
        self.fields
            .iter()
            .any(|f| f.key.is_none() && &self.raw[f.start..f.end] == name)
    }

    /// The positional fields (those with no key), such as the `3,4` of `start 3,4`.
    pub fn positionals(&self) -> impl Iterator<Item = &Field> {
        self.fields.iter().filter(|f| f.key.is_none())
    }

    /// The trailing comment from its `//` to the end of the line, with no `\r`.
    pub fn comment(&self) -> Option<&str> {
        let start = self.comment_start?;
        let end = if self.cr {
            self.raw.len() - 1
        } else {
            self.raw.len()
        };
        Some(&self.raw[start..end])
    }

    fn splice(&self, start: usize, end: usize, with: &str) -> String {
        let mut out = String::with_capacity(self.raw.len() + with.len());
        out.push_str(&self.raw[..start]);
        out.push_str(with);
        out.push_str(&self.raw[end..]);
        out
    }

    /// Replaces the bytes of the value of `key=...` with `text`, so alignment elsewhere on the line
    /// is untouched. `None` when the line has no such field.
    pub fn set_value(&self, key: &str, text: &str) -> Option<String> {
        let field = self.field(key)?;
        Some(self.splice(field.value.0, field.value.1, text))
    }

    /// Replaces one comma item of a positional field, such as the `4` of `start 3,4`.
    pub fn set_positional_item(&self, index: usize, item: usize, text: &str) -> Option<String> {
        let field = self.positionals().nth(index)?;
        let (s, e) = *field.items.get(item)?;
        Some(self.splice(s, e, text))
    }

    /// The text of one comma item of a positional field.
    pub fn positional_item(&self, index: usize, item: usize) -> Option<&str> {
        let field = self.positionals().nth(index)?;
        let (s, e) = *field.items.get(item)?;
        Some(&self.raw[s..e])
    }

    /// This line's indent and trailing whitespace and comment around `code` in place of the words and
    /// fields: how one statement becomes another (`row cheezie x=17..20 y=7` becomes
    /// `cheezie x=17,19..20 y=7`) without losing the comment.
    pub fn replace_code(&self, code: &str) -> String {
        format!("{}{}{}", self.indent(), code, &self.raw[self.code_end..])
    }

    /// Replaces one positional field (counted among the positionals) with `text`.
    pub fn set_positional(&self, index: usize, text: &str) -> Option<String> {
        let field = self.positionals().nth(index)?;
        Some(self.splice(field.start, field.end, text))
    }

    /// Adds ` key=value` (or a bare ` key` when `value` is `None`) after the last field, before any
    /// trailing spaces and the comment.
    pub fn add_field(&self, key: &str, value: Option<&str>) -> String {
        let added = match value {
            Some(value) => format!(" {key}={value}"),
            None => format!(" {key}"),
        };
        self.splice(self.code_end, self.code_end, &added)
    }

    /// Removes the field with this key, or the flag with this name, and the whitespace before it.
    pub fn remove_field(&self, key: &str) -> Option<String> {
        let field = self.fields.iter().find(|f| {
            f.key.as_deref() == Some(key) || (f.key.is_none() && &self.raw[f.start..f.end] == key)
        })?;
        let before = &self.raw[..field.start];
        let start = before.len() - before.trim_end_matches(is_space).len();
        Some(self.splice(field.start - start, field.end, ""))
    }

    /// Replaces one item of a comma list with `pieces` joined by commas, or removes the item (and one
    /// comma beside it) when `pieces` is empty. `17..20` with `18` made `["17", "19..20"]` is the way
    /// a range becomes pieces. `None` when there is no such field or item.
    pub fn list_splice(&self, key: &str, index: usize, pieces: &[String]) -> Option<String> {
        let field = self.field(key)?;
        let (s, e) = *field.items.get(index)?;
        if !pieces.is_empty() {
            return Some(self.splice(s, e, &pieces.join(",")));
        }
        if field.items.len() == 1 {
            return None;
        }
        // Take the comma after the item, with the whitespace around it, or the one before the last.
        if let Some(&(next, _)) = field.items.get(index + 1) {
            Some(self.splice(s, next, ""))
        } else {
            let (_, prev_end) = field.items[index - 1];
            Some(self.splice(prev_end, e, ""))
        }
    }

    /// Replaces one item of a comma list.
    pub fn list_replace(&self, key: &str, index: usize, text: &str) -> Option<String> {
        self.list_splice(key, index, &[text.to_string()])
    }

    /// Removes one item of a comma list. A list of one item cannot lose it: remove the line.
    pub fn list_remove(&self, key: &str, index: usize) -> Option<String> {
        self.list_splice(key, index, &[])
    }

    /// Replaces the whole comma list with `items`, joined by commas.
    pub fn set_list(&self, key: &str, items: &[String]) -> Option<String> {
        self.set_value(key, &items.join(","))
    }

    /// The line without its trailing comment and the whitespace before it; the `\r` stays.
    pub fn without_comment(&self) -> String {
        let Some(start) = self.comment_start else {
            return self.raw.clone();
        };
        let body = &self.raw[..start];
        let kept = body.trim_end_matches(is_space);
        let mut out = kept.to_string();
        if self.cr {
            out.push('\r');
        }
        out
    }

    /// A line that holds only this line's trailing comment, at this line's indent, with its `\r`.
    /// This is what is left when the statement that carried the comment is deleted.
    pub fn comment_only(&self) -> Option<String> {
        let comment = self.comment()?;
        let mut out = format!("{}{}", self.indent(), comment);
        if self.cr {
            out.push('\r');
        }
        Some(out)
    }
}

/// The pieces of a range item (`17..20`, or `17`) that remain when `cell` is taken out, in order:
/// `17..20` without 18 is `["17", "19..20"]`. An item that does not hold the cell, or is not a
/// whole-number range, comes back as it was.
pub fn pieces_without(item: &str, cell: i64) -> Vec<String> {
    pieces_with(item, cell, None)
}

/// Like [`pieces_without`], with `replacement` standing where the cell was.
pub fn pieces_replacing(item: &str, cell: i64, replacement: &str) -> Vec<String> {
    pieces_with(item, cell, Some(replacement))
}

fn pieces_with(item: &str, cell: i64, replacement: Option<&str>) -> Vec<String> {
    let Some((lo, hi)) = parse_range(item) else {
        return vec![item.to_string()];
    };
    if cell < lo || cell > hi {
        return vec![item.to_string()];
    }
    let mut out = Vec::new();
    if cell > lo {
        out.push(range_text(lo, cell - 1));
    }
    if let Some(text) = replacement {
        out.push(text.to_string());
    }
    if cell < hi {
        out.push(range_text(cell + 1, hi));
    }
    out
}

/// `a` or `a..b` with whole numbers.
pub fn parse_range(item: &str) -> Option<(i64, i64)> {
    match item.split_once("..") {
        Some((lo, hi)) => Some((lo.parse().ok()?, hi.parse().ok()?)),
        None => {
            let n = item.parse().ok()?;
            Some((n, n))
        }
    }
}

/// `a` for a single cell, `a..b` for a run.
pub fn range_text(lo: i64, hi: i64) -> String {
    if lo == hi {
        lo.to_string()
    } else {
        format!("{lo}..{hi}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_reads_the_word_fields_and_comment() {
        let line = Line::new("  soda        x=36 y=5   // a snack");
        assert_eq!(line.indent(), "  ");
        assert_eq!(line.word(), "soda");
        assert_eq!(line.value("x"), Some("36"));
        assert_eq!(line.value("y"), Some("5"));
        assert_eq!(line.comment(), Some("// a snack"));
        assert_eq!(line.fields().len(), 2);
    }

    #[test]
    fn set_value_keeps_the_alignment_of_everything_else() {
        let line = Line::new("  soda        x=36 y=5   // a snack");
        assert_eq!(
            line.set_value("x", "37").unwrap(),
            "  soda        x=37 y=5   // a snack"
        );
        assert_eq!(
            line.set_value("x", "1234").unwrap(),
            "  soda        x=1234 y=5   // a snack"
        );
        assert_eq!(line.set_value("dir", "1"), None);
    }

    #[test]
    fn tabs_and_columns_are_kept() {
        let line = Line::new("\tgloop\t\tx=35,62,85\ty=4");
        assert_eq!(line.indent(), "\t");
        assert_eq!(
            line.set_value("y", "5").unwrap(),
            "\tgloop\t\tx=35,62,85\ty=5"
        );
        assert_eq!(
            line.list_replace("x", 1, "63").unwrap(),
            "\tgloop\t\tx=35,63,85\ty=4"
        );
    }

    #[test]
    fn a_crlf_line_keeps_its_carriage_return() {
        let line = Line::new("  soda x=36 y=5  // note\r");
        assert_eq!(line.comment(), Some("// note"));
        assert_eq!(
            line.set_value("y", "6").unwrap(),
            "  soda x=36 y=6  // note\r"
        );
        assert_eq!(line.without_comment(), "  soda x=36 y=5\r");
        assert_eq!(line.comment_only().unwrap(), "  // note\r");
        let plain = Line::new("  soda x=36 y=5\r");
        assert_eq!(plain.add_field("dir", Some("1")), "  soda x=36 y=5 dir=1\r");
        assert_eq!(plain.comment(), None);
    }

    #[test]
    fn slashes_inside_a_quoted_name_are_not_a_comment() {
        let line = Line::new("level \"a // b\" 192x28 ground=4 id=x // real");
        assert_eq!(line.comment(), Some("// real"));
        let none = Line::new("level \"a // b\" 192x28 ground=4 id=x");
        assert_eq!(none.comment(), None);
        assert_eq!(none.value("ground"), Some("4"));
    }

    #[test]
    fn flags_and_positionals_are_fields_without_keys() {
        let line = Line::new("  gloop x=35 y=4 ride  // rides");
        assert!(line.has_flag("ride"));
        assert_eq!(
            line.remove_field("ride").unwrap(),
            "  gloop x=35 y=4  // rides"
        );
        let start = Line::new("start 3,4   // here");
        assert_eq!(start.positionals().count(), 1);
        assert_eq!(
            start.set_positional(0, "5,6").unwrap(),
            "start 5,6   // here"
        );
        assert_eq!(start.positional_item(0, 1), Some("4"));
    }

    #[test]
    fn whitespace_beside_a_comma_belongs_to_the_list() {
        let line = Line::new("  cheezie x=10, 26 , 60  y=7");
        assert_eq!(line.field("x").unwrap().items.len(), 3);
        assert_eq!(line.item("x", 1), Some("26"));
        assert_eq!(line.value("y"), Some("7"));
        assert_eq!(
            line.list_replace("x", 1, "27").unwrap(),
            "  cheezie x=10, 27 , 60  y=7"
        );
    }

    #[test]
    fn add_field_goes_after_the_last_field_before_the_comment() {
        let line = Line::new("  gloop     x=35,62,85   // three");
        assert_eq!(
            line.add_field("y", Some("4")),
            "  gloop     x=35,62,85 y=4   // three"
        );
        assert_eq!(
            line.add_field("ride", None),
            "  gloop     x=35,62,85 ride   // three"
        );
    }

    #[test]
    fn remove_field_takes_the_space_before_it() {
        let line = Line::new("  gloop  x=35  y=4  dir=1");
        assert_eq!(line.remove_field("dir").unwrap(), "  gloop  x=35  y=4");
        assert_eq!(line.remove_field("y").unwrap(), "  gloop  x=35  dir=1");
        assert_eq!(line.remove_field("nope"), None);
    }

    #[test]
    fn list_remove_takes_one_comma() {
        let line = Line::new("  gloop x=35,62,85 y=4");
        assert_eq!(line.list_remove("x", 0).unwrap(), "  gloop x=62,85 y=4");
        assert_eq!(line.list_remove("x", 1).unwrap(), "  gloop x=35,85 y=4");
        assert_eq!(line.list_remove("x", 2).unwrap(), "  gloop x=35,62 y=4");
        let one = Line::new("  soda x=36 y=5");
        assert_eq!(one.list_remove("x", 0), None);
    }

    #[test]
    fn a_range_becomes_pieces() {
        assert_eq!(pieces_without("17..20", 18), ["17", "19..20"]);
        assert_eq!(pieces_without("17..20", 17), ["18..20"]);
        assert_eq!(pieces_without("17..20", 20), ["17..19"]);
        assert_eq!(pieces_without("17..19", 18), ["17", "19"]);
        assert_eq!(pieces_without("17", 17), Vec::<String>::new());
        assert_eq!(pieces_without("17..20", 25), ["17..20"]);
        assert_eq!(pieces_replacing("17..20", 18, "30"), ["17", "30", "19..20"]);
        assert_eq!(pieces_replacing("5", 5, "6"), ["6"]);
        let line = Line::new("  cheezie x=10,17..20,60 y=7");
        let pieces = pieces_without(line.item("x", 1).unwrap(), 18);
        assert_eq!(
            line.list_splice("x", 1, &pieces).unwrap(),
            "  cheezie x=10,17,19..20,60 y=7"
        );
    }

    #[test]
    fn untouched_bytes_stay_byte_for_byte() {
        let raw = "  \t cheezie  \t x=10,26,60   y=7 \t  // note \"q\" //";
        let line = Line::new(raw);
        assert_eq!(line.set_value("y", "7").unwrap(), raw);
        assert_eq!(line.comment(), Some("// note \"q\" //"));
    }
}
