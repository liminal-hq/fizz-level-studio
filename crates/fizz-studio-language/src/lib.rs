// The Fizz 1 level language for the studio
//
// Pure Rust with no Tauri. The crate is a port of `packages/language` (D56); the TypeScript package
// stays the reference until this crate matches every conformance fixture and proof.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

/// The name reports use for this crate.
pub const CRATE_NAME: &str = "fizz-studio-language";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_itself() {
        assert_eq!(CRATE_NAME, "fizz-studio-language");
    }
}
