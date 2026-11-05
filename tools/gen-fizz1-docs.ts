// Writes the language documentation data the Rust crate loads, from the TypeScript docs module.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Usage: bun tools/gen-fizz1-docs.ts [--check]
//
// The output is `crates/fizz-studio-language/data/docs.en-CA.json`: every entry of `DOCS` in order,
// the field notes, the tile notes, and the words `docsFor` returns for each scope (so a Rust test can
// hold its own filtering to the reference). With `--check` nothing is written; the process exits 1
// when the committed file differs from a regenerated one.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOCS, FIELD_NOTES, TILE_NOTES, docsFor } from '../packages/language/src/docs.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'crates', 'fizz-studio-language', 'data', 'docs.en-CA.json');

const scopeWords = (scope: 'level' | 'overworld') =>
	docsFor(scope).map((d) => `${d.kind}:${d.word}`);

const text =
	JSON.stringify(
		{
			docs: DOCS,
			fieldNotes: FIELD_NOTES,
			tileNotes: Object.entries(TILE_NOTES).map(([word, note]) => ({ word, ...note })),
			forLevel: scopeWords('level'),
			forOverworld: scopeWords('overworld'),
		},
		null,
		'\t',
	) + '\n';

if (process.argv.includes('--check')) {
	if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== text) {
		console.error(
			'crates/fizz-studio-language/data/docs.en-CA.json is out of date; run `bun run gen:docs` and commit the result.',
		);
		process.exit(1);
	}
	console.log('docs.en-CA.json is up to date.');
} else {
	mkdirSync(dirname(OUT), { recursive: true });
	writeFileSync(OUT, text);
	console.log(`wrote ${DOCS.length} entries to ${OUT}.`);
}
