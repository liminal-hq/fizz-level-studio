// Fails when a component under apps/studio/src has a visible string literal instead of a catalogue message
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { findJsxLiterals } from './jsx-literals';

// Run with `bun scripts/check-jsx-literals.ts` (`bun run check:i18n`). Every string a person sees
// goes through `t()`, so JSX text and the visible attributes (`title`, `label`, `placeholder`,
// `alt`, `aria-label` and friends) must not hold a literal. Test files are exempt.

const root = resolve(import.meta.dirname, '..');
const scanned = join(root, 'apps/studio/src');

function componentFiles(directory: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...componentFiles(path));
		else if (entry.name.endsWith('.tsx') && !/\.test\.tsx$/.test(entry.name)) files.push(path);
	}
	return files.sort();
}

const problems: string[] = [];
for (const path of componentFiles(scanned)) {
	for (const literal of findJsxLiterals(readFileSync(path, 'utf8'), path)) {
		const shown = relative(root, path);
		problems.push(
			`${shown}:${literal.line}:${literal.column}  ${literal.where} literal "${literal.text}" should come from t()`,
		);
	}
}

if (problems.length > 0) {
	console.error('Visible strings must come from the message catalogue (apps/studio/src/i18n):');
	for (const problem of problems) console.error(`  ${problem}`);
	process.exit(1);
}
console.log('No visible string literals in JSX.');
