// Opening a Fizz 1 project folder or a Fizz 2 world folder and listing its level files
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

use std::path::{Path, PathBuf};

use crate::error::WorldError;

/// The file that makes a folder a Fizz 2 world (`spec/WORLD.md`).
pub const WORLD_FILE: &str = "world.fizz";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectKind {
    /// A folder of `.fizz` level files, at its top or in a `levels` folder.
    Fizz1,
    /// A folder with a `world.fizz`, its levels in `levels/` and an optional `overworld.fizz`.
    Fizz2,
}

/// What is in an opened folder. Files are opaque here; the paths are absolute when the root is.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Project {
    pub root: PathBuf,
    pub kind: ProjectKind,
    /// `world.fizz`, for a Fizz 2 world.
    pub world_file: Option<PathBuf>,
    /// `overworld.fizz`, for a Fizz 2 world that has one.
    pub overworld_file: Option<PathBuf>,
    /// Level files in name order.
    pub levels: Vec<PathBuf>,
}

impl Project {
    /// Opens a folder. It is a Fizz 2 world when it has a `world.fizz`, a Fizz 1 project otherwise.
    pub fn open(root: impl AsRef<Path>) -> Result<Project, WorldError> {
        let root = root.as_ref().to_path_buf();
        if !root.is_dir() {
            return Err(WorldError::NotAFolder { path: root });
        }
        let world = root.join(WORLD_FILE);
        if world.is_file() {
            let overworld = root.join("overworld.fizz");
            return Ok(Project {
                kind: ProjectKind::Fizz2,
                world_file: Some(world),
                overworld_file: overworld.is_file().then_some(overworld),
                levels: fizz_files(&root.join("levels"))?,
                root,
            });
        }
        let mut levels = fizz_files(&root)?;
        levels.extend(fizz_files(&root.join("levels"))?);
        Ok(Project {
            kind: ProjectKind::Fizz1,
            world_file: None,
            overworld_file: None,
            levels,
            root,
        })
    }

    /// Every file the studio owns in this folder, for the watcher to expect.
    pub fn files(&self) -> Vec<PathBuf> {
        self.world_file
            .iter()
            .chain(self.overworld_file.iter())
            .chain(self.levels.iter())
            .cloned()
            .collect()
    }
}

/// The `.fizz` files directly in `dir`, by name. A missing folder has none.
fn fizz_files(dir: &Path) -> Result<Vec<PathBuf>, WorldError> {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(WorldError::io(dir, error)),
    };
    let mut found = Vec::new();
    for entry in entries {
        let path = entry.map_err(|e| WorldError::io(dir, e))?.path();
        let is_level = path.is_file()
            && path.extension().is_some_and(|e| e == "fizz")
            && path.file_name().is_some_and(|n| {
                let n = n.to_string_lossy();
                n != WORLD_FILE && n != "overworld.fizz" && !n.starts_with('.')
            });
        if is_level {
            found.push(path);
        }
    }
    found.sort();
    Ok(found)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn touch(root: &Path, relative: &str) {
        let path = root.join(relative);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, "script fizz 0\n").unwrap();
    }

    #[test]
    fn a_folder_of_levels_is_a_fizz_1_project() {
        let dir = tempfile::tempdir().unwrap();
        touch(dir.path(), "b.fizz");
        touch(dir.path(), "a.fizz");
        touch(dir.path(), "levels/c.fizz");
        touch(dir.path(), "notes.txt");
        touch(dir.path(), ".hidden.fizz");
        let project = Project::open(dir.path()).unwrap();
        assert_eq!(project.kind, ProjectKind::Fizz1);
        assert_eq!(project.world_file, None);
        let names: Vec<_> = project
            .levels
            .iter()
            .map(|p| p.file_name().unwrap().to_str().unwrap())
            .collect();
        assert_eq!(names, ["a.fizz", "b.fizz", "c.fizz"]);
    }

    #[test]
    fn a_folder_with_a_world_file_is_a_fizz_2_world() {
        let dir = tempfile::tempdir().unwrap();
        touch(dir.path(), "world.fizz");
        touch(dir.path(), "overworld.fizz");
        touch(dir.path(), "levels/light-2.fizz");
        touch(dir.path(), "levels/light-1.fizz");
        touch(dir.path(), "stray.fizz");
        let project = Project::open(dir.path()).unwrap();
        assert_eq!(project.kind, ProjectKind::Fizz2);
        assert_eq!(project.world_file, Some(dir.path().join("world.fizz")));
        assert_eq!(
            project.overworld_file,
            Some(dir.path().join("overworld.fizz"))
        );
        assert_eq!(
            project.levels,
            [
                dir.path().join("levels/light-1.fizz"),
                dir.path().join("levels/light-2.fizz")
            ]
        );
        assert_eq!(project.files().len(), 4);
    }

    #[test]
    fn a_world_without_an_overworld_or_levels_opens() {
        let dir = tempfile::tempdir().unwrap();
        touch(dir.path(), "world.fizz");
        let project = Project::open(dir.path()).unwrap();
        assert_eq!(project.overworld_file, None);
        assert!(project.levels.is_empty());
    }

    #[test]
    fn a_file_is_not_a_project() {
        let dir = tempfile::tempdir().unwrap();
        touch(dir.path(), "a.fizz");
        assert!(matches!(
            Project::open(dir.path().join("a.fizz")),
            Err(WorldError::NotAFolder { .. })
        ));
    }
}
