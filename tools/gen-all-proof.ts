// Exports every script in levels/real into the scratch Rust copy, with one comparison test per level.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { parseOrThrow } from '../packages/language/src/parser.ts';
import { toRust } from '../packages/language/src/rust.ts';
import { LEVEL_IDS } from '../packages/language/src/tables.ts';

const dir = new URL('../levels/real/', import.meta.url);
const game = new URL('../scratch/rust/episodes/episode-1/game/src/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.fizz')).sort();
const fns: string[] = [];
const tests: string[] = [];
for (const f of files) {
	const slug = f.replace(/\.fizz$/, '');
	const snake = slug.replace(/-/g, '_');
	fns.push(toRust(parseOrThrow(readFileSync(new URL(f, dir), 'utf8')), `${snake}_fizz`));
	tests.push(`#[test]\nfn ${snake}_matches_the_game() {\n    let real = ${snake}();\n    let generated = ${snake}_fizz();\n    assert!(real.map.data.iter().filter(|&&t| t != 0).count() > 100);\n    assert_same(&real, &generated);\n    println!("${slug}: fingerprint {:#010x}, {} spawns, {} items, {} platforms, {} rooms", generated.fingerprint(), generated.spawns.len(), generated.items.len(), generated.plats.len(), generated.rooms.length_placeholder());\n}\n`.replace('generated.rooms.length_placeholder()', 'generated.rooms.len()'));
}
const cmp = readFileSync(new URL('crater_proof.rs', game), 'utf8');
const assertSame = /fn assert_same[\s\S]*?\n}\n/.exec(cmp)![0];
writeFileSync(new URL('all_fizz.rs', game), fns.join('\n'));
writeFileSync(new URL('all_proof.rs', game), `// Proof that the scripts in levels/real rebuild every level of the game exactly.\n//\n// (c) Copyright 2026 Liminal HQ, Scott Morris\n// SPDX-License-Identifier: Apache-2.0 OR MIT\n\nuse super::*;\n\ninclude!("all_fizz.rs");\n\n${assertSame}\n${tests.join('\n')}`);
console.log(`${files.length} levels exported; ids: ${Object.keys(LEVEL_IDS).length} in the table`);
