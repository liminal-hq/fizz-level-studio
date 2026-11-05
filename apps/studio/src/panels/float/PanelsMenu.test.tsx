// Tests for the Panels menu: listing, toggling, keys and resetting
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PanelsMenu } from './PanelsMenu';

const visible = { palette: true, objects: true, history: false, proposals: true, script: true };

function setup() {
	const onToggle = vi.fn();
	const onReset = vi.fn();
	render(<PanelsMenu visible={visible} onToggle={onToggle} onReset={onReset} />);
	return { onToggle, onReset };
}

describe('PanelsMenu', () => {
	it('is closed until the button opens it, then lists each panel with its state', async () => {
		const user = userEvent.setup();
		setup();
		expect(screen.queryByRole('menu')).toBeNull();
		const button = screen.getByRole('button', { name: 'Panels' });
		expect(button).toHaveAttribute('aria-expanded', 'false');
		await user.click(button);
		expect(button).toHaveAttribute('aria-expanded', 'true');
		const boxes = screen.getAllByRole('menuitemcheckbox');
		expect(
			boxes.map((b) => [b.textContent?.replace('✓', ''), b.getAttribute('aria-checked')]),
		).toEqual([
			['Palette', 'true'],
			['Objects', 'true'],
			['History', 'false'],
			['Proposals', 'true'],
			['Script', 'true'],
		]);
		expect(screen.getByRole('menuitem', { name: 'Reset layout' })).toBeInTheDocument();
	});

	it('asks to show a hidden panel and to hide a shown one, staying open', async () => {
		const user = userEvent.setup();
		const { onToggle } = setup();
		await user.click(screen.getByRole('button', { name: 'Panels' }));
		await user.click(screen.getByRole('menuitemcheckbox', { name: 'History' }));
		expect(onToggle).toHaveBeenLastCalledWith('history', true);
		await user.click(screen.getByRole('menuitemcheckbox', { name: /Script/ }));
		expect(onToggle).toHaveBeenLastCalledWith('script', false);
		expect(screen.getByRole('menu')).toBeInTheDocument();
	});

	it('resets the layout and closes', async () => {
		const user = userEvent.setup();
		const { onReset } = setup();
		await user.click(screen.getByRole('button', { name: 'Panels' }));
		await user.click(screen.getByRole('menuitem', { name: 'Reset layout' }));
		expect(onReset).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('moves between items with the arrow keys, wrapping, and closes on Escape', async () => {
		const user = userEvent.setup();
		setup();
		const button = screen.getByRole('button', { name: 'Panels' });
		await user.click(button);
		const items = [...screen.getAllByRole('menuitemcheckbox'), screen.getByRole('menuitem')];
		expect(items[0]).toHaveFocus();
		await user.keyboard('{ArrowUp}');
		expect(items.at(-1)).toHaveFocus();
		await user.keyboard('{ArrowDown}');
		expect(items[0]).toHaveFocus();
		await user.keyboard('{End}');
		expect(items.at(-1)).toHaveFocus();
		await user.keyboard('{Home}');
		expect(items[0]).toHaveFocus();
		await user.keyboard('{Escape}');
		expect(screen.queryByRole('menu')).toBeNull();
		expect(button).toHaveFocus();
	});

	it('closes when the pointer goes down elsewhere', async () => {
		const user = userEvent.setup();
		setup();
		await user.click(screen.getByRole('button', { name: 'Panels' }));
		fireEvent.pointerDown(document.body);
		expect(screen.queryByRole('menu')).toBeNull();
	});
});
