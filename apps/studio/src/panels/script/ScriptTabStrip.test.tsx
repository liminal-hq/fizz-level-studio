// Tests for the script tab strip: the tab pattern, the close button, narrow overflow and drag
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ScriptTabStrip, type ScriptTabStripProps } from './ScriptTabStrip';
import type { ScriptTab } from './scriptTabs';

const level: ScriptTab = {
	id: 'level',
	title: 'crater.fizz',
	kind: 'level',
	dirty: false,
	away: false,
};
const gloop: ScriptTab = {
	id: 'gloop',
	title: 'gloop.fizz',
	kind: 'behaviour',
	dirty: false,
	away: false,
};

function setup(over: Partial<ScriptTabStripProps> = {}) {
	const onActivate = vi.fn();
	const onClose = vi.fn();
	const onTabDragStart = vi.fn();
	render(
		<ScriptTabStrip
			tabs={[level]}
			active="level"
			onActivate={onActivate}
			onClose={onClose}
			onTabDragStart={onTabDragStart}
			controls="panel-body-script"
			{...over}
		/>,
	);
	return { onActivate, onClose, onTabDragStart };
}

describe('ScriptTabStrip', () => {
	it('is a tablist of one tab, selected, controlling the panel body', () => {
		setup();
		const list = screen.getByRole('tablist', { name: 'Scripts' });
		const tab = within(list).getByRole('tab', { name: 'crater.fizz' });
		expect(tab).toHaveAttribute('aria-selected', 'true');
		expect(tab).toHaveAttribute('aria-controls', 'panel-body-script');
		expect(tab).toHaveAttribute('tabindex', '0');
		expect(tab).not.toHaveAttribute('title');
		act(() => tab.focus());
		expect(screen.getByRole('tooltip')).toHaveTextContent('crater.fizz');
	});

	it('names the close button for what it does, saying so when there are unsaved changes', () => {
		setup();
		expect(screen.getByRole('button', { name: 'Close crater.fizz' })).toHaveAttribute(
			'tabindex',
			'-1',
		);
		cleanup();
		setup({ tabs: [{ ...level, dirty: true }] });
		const close = screen.getByRole('button', { name: 'Close crater.fizz, unsaved changes' });
		expect(close).toHaveAttribute('data-dirty');
		expect(close.querySelector('circle')).not.toBeNull();
	});

	it('closes from the button, and from Ctrl+W on the tab without reaching the app', async () => {
		const user = userEvent.setup();
		const { onClose } = setup();
		await user.click(screen.getByRole('button', { name: 'Close crater.fizz' }));
		expect(onClose).toHaveBeenLastCalledWith('level');
		const reaches = vi.fn();
		const hear = (event: KeyboardEvent) => event.key === 'w' && reaches();
		document.addEventListener('keydown', hear);
		screen.getByRole('tab', { name: 'crater.fizz' }).focus();
		await user.keyboard('{Control>}w{/Control}');
		document.removeEventListener('keydown', hear);
		expect(onClose).toHaveBeenCalledTimes(2);
		expect(reaches).not.toHaveBeenCalled();
	});

	it('moves between tabs with the arrows, Home and End, one tab in the tab order at a time', async () => {
		const user = userEvent.setup();
		function Strip() {
			const [active, setActive] = useState('level');
			return (
				<ScriptTabStrip
					tabs={[level, gloop]}
					active={active}
					onActivate={setActive}
					onClose={() => {}}
				/>
			);
		}
		render(<Strip />);
		const first = screen.getByRole('tab', { name: 'crater.fizz' });
		const second = screen.getByRole('tab', { name: 'gloop.fizz' });
		expect(second).toHaveAttribute('tabindex', '-1');
		first.focus();
		await user.keyboard('{ArrowRight}');
		expect(second).toHaveFocus();
		expect(second).toHaveAttribute('aria-selected', 'true');
		expect(second).toHaveAttribute('tabindex', '0');
		expect(first).toHaveAttribute('tabindex', '-1');
		await user.keyboard('{ArrowRight}');
		expect(first).toHaveFocus();
		await user.keyboard('{End}');
		expect(second).toHaveFocus();
		await user.keyboard('{Home}');
		expect(first).toHaveFocus();
	});

	it('marks the level script and a behaviour script differently, and a script that is away', () => {
		setup({ tabs: [level, { ...gloop, away: true }], active: 'level' });
		const dots = document.querySelectorAll('[data-kind]');
		expect([...dots].map((dot) => dot.getAttribute('data-kind'))).toEqual(['level', 'behaviour']);
		const away = screen.getByRole('tab', { name: 'gloop.fizz' });
		expect(away).not.toHaveAttribute('title');
		act(() => away.focus());
		expect(screen.getByRole('tooltip')).toHaveTextContent(
			'gloop.fizz, open in its own window; choose to bring it forward',
		);
		expect(away.closest('[data-away]')).not.toBeNull();
	});

	it('activates a tab on click and hands a press on it to the drag', async () => {
		const user = userEvent.setup();
		const { onActivate, onTabDragStart } = setup({ tabs: [level, gloop] });
		await user.click(screen.getByRole('tab', { name: 'gloop.fizz' }));
		expect(onActivate).toHaveBeenCalledWith('gloop');
		expect(onTabDragStart).toHaveBeenCalledWith(expect.anything(), 'gloop');
	});

	it('draws no More tabs button in a wide header, or in a narrow one where the tabs fit', () => {
		setup({ forceOverflow: true });
		expect(screen.queryByRole('button', { name: 'More tabs' })).toBeNull();
		cleanup();
		setup({ narrow: true });
		expect(screen.queryByRole('button', { name: 'More tabs' })).toBeNull();
	});

	it('lists every tab in a More tabs menu when a narrow header overflows, and chooses one', async () => {
		const user = userEvent.setup();
		const { onActivate } = setup({ tabs: [level, gloop], narrow: true, forceOverflow: true });
		const more = screen.getByRole('button', { name: 'More tabs' });
		expect(more).toHaveAttribute('aria-haspopup', 'menu');
		await user.click(more);
		const menu = await screen.findByRole('menu', { name: 'More tabs' });
		const rows = within(menu).getAllByRole('menuitemcheckbox');
		expect(rows.map((row) => row.textContent)).toEqual(['crater.fizz', 'gloop.fizz']);
		expect(rows[0]).toHaveAttribute('aria-checked', 'true');
		await user.click(rows[1]!);
		expect(onActivate).toHaveBeenCalledWith('gloop');
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('measures a narrow strip that really overflows', () => {
		const scroll = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(400);
		const client = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(120);
		try {
			setup({ tabs: [level, gloop], narrow: true });
			fireEvent(window, new Event('resize'));
			expect(screen.getByRole('button', { name: 'More tabs' })).toBeInTheDocument();
		} finally {
			scroll.mockRestore();
			client.mockRestore();
		}
	});
});
