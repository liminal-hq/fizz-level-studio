// Exports the overworld scripts into the scratch Rust copy, with a test that each rebuilds the game's overworld.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
import { readFileSync, writeFileSync } from 'node:fs';
import { overworldToRust, parseOverworldOrThrow } from '../packages/language/src/overworld.ts';

const game = new URL('../scratch/rust/episodes/episode-1/game/src/', import.meta.url);
const src = readFileSync(new URL('../overworlds/main.fizz', import.meta.url), 'utf8');
writeFileSync(new URL('ow_fizz.rs', game), overworldToRust(parseOverworldOrThrow(src), 'overworld_fizz'));
writeFileSync(new URL('ow_proof.rs', game), readFileSync(new URL('ow_proof.template.rs', import.meta.url), 'utf8'));
