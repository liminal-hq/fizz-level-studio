// Tests that a dialog button is drawn as a keycap and that each variant maps to its look
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DialogButton } from './DialogActions';

describe('DialogButton as a keycap', () => {
	it('carries the keycap class in every variant', () => {
		render(
			<>
				<DialogButton variant="secondary">Cancel</DialogButton>
				<DialogButton variant="primary">Save</DialogButton>
				<DialogButton variant="danger">Discard</DialogButton>
			</>,
		);
		for (const name of ['Cancel', 'Save', 'Discard']) {
			expect(screen.getByRole('button', { name })).toHaveClass('keycap');
		}
	});

	it('lights only the primary key', () => {
		render(
			<>
				<DialogButton variant="secondary">Cancel</DialogButton>
				<DialogButton variant="primary">Save</DialogButton>
				<DialogButton variant="danger">Discard</DialogButton>
			</>,
		);
		expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('lit');
		expect(screen.getByRole('button', { name: 'Cancel' })).not.toHaveClass('lit');
		expect(screen.getByRole('button', { name: 'Discard' })).not.toHaveClass('lit');
	});

	it('marks only the danger key with the danger class', () => {
		render(
			<>
				<DialogButton variant="secondary">Cancel</DialogButton>
				<DialogButton variant="danger">Discard</DialogButton>
			</>,
		);
		expect(screen.getByRole('button', { name: 'Discard' })).toHaveClass('danger');
		expect(screen.getByRole('button', { name: 'Cancel' })).not.toHaveClass('danger');
	});

	it('draws the danger key as a plain key: a danger label and edge, no filled background', () => {
		const css = readFileSync(join(import.meta.dirname, 'DialogActions.module.css'), 'utf8');
		const rule = css.match(/\.button\.danger \{[^}]*\}/)?.[0] ?? '';
		expect(rule).toContain('color: var(--fls-danger)');
		expect(rule).toContain('border-bottom-color');
		expect(rule).not.toMatch(/background/);
	});
});
