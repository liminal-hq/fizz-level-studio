// What to do with a file that changed on disk while the studio holds it
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/// The answer to an outside edit.
#[derive(Clone, PartialEq, Eq)]
pub enum Resolution {
    /// Nothing to do: the disk matches what the studio last saw, or the studio already has the same
    /// text.
    Unchanged,
    /// The file changed on disk and the studio has no unsaved changes: take the disk text as a new
    /// revision marked "edited outside the studio".
    EditedOutside { text: String },
    /// Both sides changed, in places that do not overlap: the merged text has both.
    Merged { text: String },
    /// Both sides changed the same lines. The person is asked; `marked` is the text with conflict
    /// markers for showing them.
    Conflict { marked: String },
}

// Resolutions hold the file's text, so they only ever show sizes.
impl std::fmt::Debug for Resolution {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Resolution::Unchanged => f.write_str("Unchanged"),
            Resolution::EditedOutside { text } => f
                .debug_struct("EditedOutside")
                .field("text_len", &text.len())
                .finish(),
            Resolution::Merged { text } => f
                .debug_struct("Merged")
                .field("text_len", &text.len())
                .finish(),
            Resolution::Conflict { marked } => f
                .debug_struct("Conflict")
                .field("marked_len", &marked.len())
                .finish(),
        }
    }
}

/// Works out what an outside edit means.
///
/// - `base` is the text on disk when the studio last read or wrote the file.
/// - `current` is the text the studio holds now (`base` when there are no unsaved changes).
/// - `disk` is the text on disk now.
///
/// After a `Resolution` other than a conflict, the caller's new `base` is `disk`. The merge is line
/// based (`diffy`); a line the studio owns that changed outside is not special here.
pub fn reconcile(base: &str, current: &str, disk: &str) -> Resolution {
    if disk == base || disk == current {
        return Resolution::Unchanged;
    }
    if current == base {
        return Resolution::EditedOutside {
            text: disk.to_string(),
        };
    }
    match diffy::merge(base, current, disk) {
        Ok(text) => Resolution::Merged { text },
        Err(marked) => Resolution::Conflict { marked },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const BASE: &str = "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\n";

    #[test]
    fn no_unsaved_changes_takes_the_disk_text() {
        let disk = BASE.replace("two", "2");
        assert_eq!(
            reconcile(BASE, BASE, &disk),
            Resolution::EditedOutside { text: disk }
        );
    }

    #[test]
    fn a_save_echo_or_the_same_change_is_nothing() {
        assert_eq!(reconcile(BASE, BASE, BASE), Resolution::Unchanged);
        let edited = BASE.replace("two", "2");
        assert_eq!(reconcile(BASE, &edited, BASE), Resolution::Unchanged);
        assert_eq!(reconcile(BASE, &edited, &edited), Resolution::Unchanged);
    }

    #[test]
    fn non_overlapping_changes_merge() {
        let ours = BASE.replace("two", "TWO");
        let theirs = BASE.replace("seven", "SEVEN");
        match reconcile(BASE, &ours, &theirs) {
            Resolution::Merged { text } => {
                assert_eq!(text, BASE.replace("two", "TWO").replace("seven", "SEVEN"));
            }
            other => panic!("expected a merge, got {other:?}"),
        }
    }

    #[test]
    fn overlapping_changes_are_a_conflict() {
        let ours = BASE.replace("two", "ours");
        let theirs = BASE.replace("two", "theirs");
        match reconcile(BASE, &ours, &theirs) {
            Resolution::Conflict { marked } => {
                assert!(marked.contains("<<<<<<<"));
                assert!(marked.contains("ours"));
                assert!(marked.contains("theirs"));
            }
            other => panic!("expected a conflict, got {other:?}"),
        }
    }

    #[test]
    fn debug_shows_sizes_only() {
        let text = "secret level text".to_string();
        let shown = format!("{:?}", Resolution::EditedOutside { text });
        assert!(!shown.contains("secret"));
    }
}
