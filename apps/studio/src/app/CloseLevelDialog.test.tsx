// Tests the close question: Cancel, Discard and Save, with the variants that decide their look
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CloseLevelDialog } from './CloseLevelDialog';

describe('CloseLevelDialog', () => {
	it('answers with Cancel, Discard and Save as dialog buttons, Save primary and Discard danger', () => {
		render(
			<CloseLevelDialog
				open
				name="Crater Fields"
				onSave={vi.fn()}
				onDiscard={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);
		// The keycap look itself comes from the chrome's stylesheet, which the chrome's tests cover
		// (the app's test setup does not resolve `composes`); here the variants are what matter.
		const buttons = screen.getAllByRole('button');
		expect(buttons.map((b) => [b.textContent, b.getAttribute('data-variant')])).toEqual([
			['Cancel', 'secondary'],
			['Discard', 'danger'],
			['Save', 'primary'],
		]);
	});
});
