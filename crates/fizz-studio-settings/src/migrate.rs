// Migration of an older settings file, one version step at a time
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// A step works on the file's `settings` value as plain JSON, so it can rename or reshape fields
// the current `Settings` no longer has. Steps run in order from the file's version up to the
// current one; `MIGRATIONS` is empty while version 1 is the only version.

use serde_json::Value;

/// One step: turns the `settings` value of version `from` into that of version `from + 1`.
#[derive(Clone, Copy)]
pub struct Migration {
    pub from: u32,
    pub apply: fn(Value) -> Result<Value, String>,
}

/// The steps this build knows, in order.
pub const MIGRATIONS: &[Migration] = &[];

/// Brings `settings` from `version` up to `current` through `steps`. A version newer than
/// `current`, or a gap in the steps, is an error: the file stays untouched for the caller to set
/// aside.
pub fn migrate(
    mut settings: Value,
    version: u32,
    current: u32,
    steps: &[Migration],
) -> Result<Value, String> {
    if version > current {
        return Err(format!(
            "the file is version {version}, newer than this build understands ({current})"
        ));
    }
    let mut at = version;
    while at < current {
        let step = steps
            .iter()
            .find(|s| s.from == at)
            .ok_or_else(|| format!("no migration from version {at}"))?;
        settings = (step.apply)(settings)?;
        at += 1;
    }
    Ok(settings)
}
