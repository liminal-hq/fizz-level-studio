// Tests that the parser and printer still produce every committed conformance fixture.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from '../src/parser.ts';
import { print } from '../src/printer.ts';

const ROOT = new URL('../../../fixtures/fizz1/', import.meta.url).pathname;

function inputs(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) return inputs(full);
		return full.endsWith('.fizz') ? [relative(ROOT, full).replace(/\.fizz$/, '')] : [];
	});
}

const ids = inputs(ROOT).sort();

describe('conformance fixtures', () => {
	test('the corpus is present', () => {
		expect(ids.length).toBeGreaterThan(100);
	});

	for (const id of ids) {
		test(id, () => {
			const source = readFileSync(join(ROOT, `${id}.fizz`), 'utf8');
			expect(existsSync(join(ROOT, `${id}.print`))).toBe(true);
			const recorded = JSON.parse(readFileSync(join(ROOT, `${id}.json`), 'utf8'));
			const { ast, errors } = parse(source);
			expect(print(ast)).toBe(readFileSync(join(ROOT, `${id}.print`), 'utf8'));
			expect(JSON.parse(JSON.stringify(ast))).toEqual(recorded.ast);
			expect(errors.map(({ line, code, message, fix }) => ({ line, code, message, fix }))).toEqual(
				recorded.errors,
			);
		});
	}
});
