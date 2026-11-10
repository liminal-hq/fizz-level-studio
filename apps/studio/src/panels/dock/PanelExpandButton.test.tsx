// Tests for the maximise and restore button: its names, tooltip, shortcut and the two icons
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PanelExpandButton } from './PanelExpandButton';

describe('PanelExpandButton', () => {
	it('offers Maximise with the corners spread out, and says the keys in its tooltip only', async () => {
		const onToggle = vi.fn();
		render(<PanelExpandButton title="Script" expanded={false} onToggle={onToggle} />);
		const button = screen.getByRole('button', { name: 'Maximise Script' });
		expect(button).not.toHaveAttribute('title');
		act(() => button.focus());
		expect(screen.getByRole('tooltip')).toHaveTextContent('Maximise ScriptCtrlShiftM');
		expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+Shift+M');
		expect(button.querySelector('svg')).toHaveAttribute('data-icon', 'maximise');
		expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
		await userEvent.setup().click(button);
		expect(onToggle).toHaveBeenCalledTimes(1);
	});

	it('offers Restore with a different icon when the panel is maximised', () => {
		render(<PanelExpandButton title="Script" expanded onToggle={() => {}} />);
		const button = screen.getByRole('button', { name: 'Restore Script' });
		expect(button).not.toHaveAttribute('title');
		act(() => button.focus());
		expect(screen.getByRole('tooltip')).toHaveTextContent('Restore ScriptCtrlShiftM');
		expect(button.querySelector('svg')).toHaveAttribute('data-icon', 'restore');
	});
});
