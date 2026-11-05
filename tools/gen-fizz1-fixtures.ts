// Writes the Fizz 1 conformance corpus by running the TypeScript language package over every input.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
//
// Usage: bun tools/gen-fizz1-fixtures.ts [--check]
//
// Each input becomes `fixtures/fizz1/<group>/<name>.fizz` (the input), `.print` (the printed output)
// and `.json` (the full AST and the errors). An `edits/` case adds `.edits.json` (the edits applied)
// and `.after` (the printed script once they are appended). With `--check` nothing is written; the process exits 1
// when the committed fixtures differ from regenerated ones. The Rust crate's tests read the same files.
import { spawnSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../packages/language/src/parser.ts';
import { print } from '../packages/language/src/printer.ts';
import { appendEdits } from '../packages/language/src/edits.ts';
import { CASES, EDIT_CASES } from './fizz1-cases.ts';
import type { Case, EditCase } from './fizz1-cases.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'fixtures', 'fizz1');

/** The tracked level scripts under `levels/` and `scratch/` that parse without errors. */
function levelCases(): Case[] {
	const listed = spawnSync('git', ['ls-files', '-z', '--', 'levels', 'scratch'], {
		cwd: ROOT,
		encoding: 'utf8',
	});
	if (listed.status !== 0) throw new Error(`git ls-files failed: ${listed.stderr}`);
	const cases: Case[] = [];
	for (const path of listed.stdout.split('\0').filter((p) => p.endsWith('.fizz'))) {
		const source = readFileSync(join(ROOT, path), 'utf8');
		if (parse(source).errors.length > 0) continue;
		const parts = path.replace(/\.fizz$/, '').split('/');
		cases.push({ id: `${parts[0]}/${parts.slice(1).join('-')}`, from: path, source });
	}
	return cases;
}

/** Every fixture file the corpus holds, as path (relative to `fixtures/fizz1`) to contents. */
function build(): Map<string, string> {
	const files = new Map<string, string>();
	const ids = new Set<string>();
	for (const c of [...levelCases(), ...CASES, ...EDIT_CASES]) {
		if (ids.has(c.id)) throw new Error(`duplicate case id ${c.id}`);
		ids.add(c.id);
		const { ast, errors } = parse(c.source);
		const doc = {
			id: c.id,
			from: c.from,
			ast,
			errors: errors.map(({ line, code, message, fix }) => ({ line, code, message, fix })),
		};
		files.set(`${c.id}.fizz`, c.source);
		files.set(`${c.id}.print`, print(ast));
		files.set(`${c.id}.json`, JSON.stringify(doc, null, '\t') + '\n');
		if ('edits' in c) {
			// The edits applied, and the text the script prints as afterwards.
			const edits = (c as EditCase).edits;
			files.set(`${c.id}.edits.json`, JSON.stringify(edits, null, '\t') + '\n');
			files.set(`${c.id}.after`, print(appendEdits(ast, edits)));
		}
	}
	return files;
}

function existing(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const found: string[] = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) found.push(...existing(full));
		else found.push(relative(OUT, full));
	}
	return found;
}

const wanted = build();
const onDisk = existing(OUT);

if (process.argv.includes('--check')) {
	const problems: string[] = [];
	for (const [path, text] of wanted) {
		const full = join(OUT, path);
		if (!existsSync(full)) problems.push(`missing: ${path}`);
		else if (readFileSync(full, 'utf8') !== text) problems.push(`differs: ${path}`);
	}
	for (const path of onDisk) {
		if (!wanted.has(path)) problems.push(`stale: ${path}`);
	}
	if (problems.length > 0) {
		console.error(problems.join('\n'));
		console.error(
			`\nfixtures/fizz1 is out of date; run \`bun run gen:fizz1\` and commit the result.`,
		);
		process.exit(1);
	}
	console.log(`fixtures/fizz1 is up to date (${wanted.size} files).`);
} else {
	for (const path of onDisk) {
		if (!wanted.has(path)) rmSync(join(OUT, path));
	}
	for (const [path, text] of wanted) {
		const full = join(OUT, path);
		mkdirSync(dirname(full), { recursive: true });
		writeFileSync(full, text);
	}
	console.log(`wrote ${wanted.size} files to fixtures/fizz1.`);
}
