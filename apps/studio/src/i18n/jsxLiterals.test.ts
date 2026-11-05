// Tests the JSX literal detector that keeps visible strings in the message catalogue
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { describe, expect, it } from 'vitest';
import { findJsxLiterals } from '../../../../scripts/jsx-literals';

describe('findJsxLiterals', () => {
	it('finds JSX text with its line and column', () => {
		const found = findJsxLiterals('const a = (\n\t<p>Hello there</p>\n);');
		expect(found).toEqual([{ line: 2, column: 5, where: 'text', text: 'Hello there' }]);
	});

	it('finds literals in visible attributes, braced or not', () => {
		const found = findJsxLiterals(
			`const a = <input title="Name" placeholder={'Type'} aria-label={\`Close\`} alt="Pic" />;`,
		);
		expect(found.map((f) => f.where)).toEqual(['title', 'placeholder', 'aria-label', 'alt']);
	});

	it('finds a string expression used as a child', () => {
		expect(findJsxLiterals(`const a = <p>{'Hello'}</p>;`)).toHaveLength(1);
	});

	it('accepts catalogue lookups, other attributes, punctuation and whitespace', () => {
		const source = [
			`const a = (`,
			`\t<div className="box" data-testid="window-label" aria-label={t('x')} title={name}>`,
			`\t\t{t('app.name')} · {count} —`,
			`\t\t<span>{value}</span>`,
			`\t</div>`,
			`);`,
		].join('\n');
		expect(findJsxLiterals(source)).toEqual([]);
	});
});
